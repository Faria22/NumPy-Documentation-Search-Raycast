import { inflateSync } from "zlib";

const INVENTORY_URL = "https://numpy.org/doc/stable/objects.inv";
const DOCUMENT_BASE_URL = "https://numpy.org/doc/stable/";
const ALLOWED_ROLES = new Set([
  "py:function",
  "py:method",
  "py:attribute",
  "py:data",
  "py:class",
  "py:property",
  "py:module",
  "py:exception",
]);

export interface InventoryItem {
  id: string;
  name: string;
  shortName: string;
  role: string;
  url: string;
  docPath: string;
  displayName: string;
}

let cachedInventoryPromise: Promise<InventoryItem[]> | null = null;

export async function getInventory(): Promise<InventoryItem[]> {
  if (!cachedInventoryPromise) {
    cachedInventoryPromise = downloadInventory().catch((error) => {
      cachedInventoryPromise = null;
      throw error;
    });
  }

  return cachedInventoryPromise;
}

async function downloadInventory(): Promise<InventoryItem[]> {
  const response = await fetch(INVENTORY_URL);

  if (!response.ok) {
    throw new Error(`Failed to load NumPy inventory: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const lines = parseInventory(buffer);
  const filtered = dedupeAndFilter(lines);

  filtered.sort((a, b) => a.shortName.localeCompare(b.shortName));

  return filtered;
}

interface RawInventoryLine {
  name: string;
  role: string;
  priority: number;
  uri: string;
  displayName: string;
}

function parseInventory(buffer: Buffer): RawInventoryLine[] {
  let offset = 0;

  function readLine() {
    const nextNewline = buffer.indexOf(0x0a, offset);
    const end = nextNewline === -1 ? buffer.length : nextNewline;
    const line = buffer.subarray(offset, end).toString("utf-8");
    offset = end + 1;
    return line;
  }

  // Header (ignored apart from validation)
  const header = readLine();
  if (!header.startsWith("# Sphinx inventory version")) {
    throw new Error("Unexpected objects.inv header");
  }
  readLine(); // project metadata
  readLine(); // version metadata
  readLine(); // blank separator

  const compressed = buffer.subarray(offset);
  const decompressed = inflateSync(compressed).toString("utf-8");

  return decompressed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, role, priority, uri, ...rest] = line.split(" ");
      const displayName = rest.length > 0 ? rest.join(" ") : name;
      return {
        name,
        role,
        priority: Number(priority),
        uri,
        displayName,
      };
    });
}

function dedupeAndFilter(lines: RawInventoryLine[]): InventoryItem[] {
  const seen = new Map<string, InventoryItem>();

  for (const line of lines) {
    if (!line.name.startsWith("numpy.")) {
      continue;
    }

    if (!ALLOWED_ROLES.has(line.role)) {
      continue;
    }

    const urlPath = resolveUri(line.uri, line.name);
    const url = new URL(urlPath, DOCUMENT_BASE_URL).toString();
    const shortName = line.name.startsWith("numpy.") ? line.name.slice("numpy.".length) : line.name;
    const displayName = line.displayName === "-" ? line.name : line.displayName;

    const item: InventoryItem = {
      id: line.name,
      name: line.name,
      shortName,
      role: line.role,
      url,
      docPath: urlPath,
      displayName,
    };

    if (!seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }

  return Array.from(seen.values());
}

function resolveUri(uri: string, name: string): string {
  let resolved = uri;

  if (resolved.includes("$")) {
    resolved = resolved.replace(/\$/g, name);
  }

  if (resolved.includes("%s")) {
    resolved = resolved.replace(/%s/g, name);
  }

  return resolved;
}

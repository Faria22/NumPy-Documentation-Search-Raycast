import fetch from "node-fetch";
import * as cheerio from "cheerio";
import type { InventoryItem } from "./inventory";

export interface DocFieldItem {
  name: string;
  type?: string;
  description?: string;
}

export interface DocDetail {
  signature?: string;
  description: string[];
  parameters: DocFieldItem[];
  returns: DocFieldItem[];
}

export async function fetchDocDetail(item: InventoryItem): Promise<DocDetail> {
  console.log(`[numpy-docs] Fetching detail for ${item.id}`, item.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 10000);

  try {
    const response = (await fetch(item.url, { signal: controller.signal })) as any;

    console.log("[numpy-docs] Detail response status", item.id, response.status, response.statusText);

    if (!response.ok) {
      console.error("[numpy-docs] Detail request failed", item.url, response.status, response.statusText);
      throw new Error(`Failed to load documentation: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`[numpy-docs] Detail response length for ${item.id}:`, html.length);
    console.log(`[numpy-docs] Detail response preview for ${item.id}:`, html.slice(0, 120));
    return parseDocDetail(html, item);
  } catch (error) {
    clearTimeout(timeout);
    if ((error as Error).name === "AbortError") {
      console.error("[numpy-docs] Detail request timed out", item.url);
    }
    console.error("[numpy-docs] Detail fetch error", item.id, (error as Error).name, (error as Error).message);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function parseDocDetail(html: string, item: InventoryItem): DocDetail {
  const $ = cheerio.load(html);

  const anchor = extractAnchor(item.url);
  let target = anchor ? $("[id='" + anchor + "']") : $("section").first();
  console.log(`[numpy-docs] Parsing detail for ${item.id} using anchor`, anchor);
  if (!target || target.length === 0) {
    target = $("dl.py").first().children("dt").first();
    console.log(`[numpy-docs] Fallback target used for ${item.id}`);
  }

  const definition = target.closest("dl");

  let signature = normalizeWhitespace(target.text()).replace(/[#¶]$/, "");
  signature = signature.replace(/numpy\.\s+/g, "numpy.").replace(/\s+\(/g, "(");
  console.log(`[numpy-docs] Extracted signature for ${item.id}:`, signature);

  if (signature && !signature.includes(item.name)) {
    if (signature.startsWith(item.shortName)) {
      signature = `${item.name}${signature.slice(item.shortName.length)}`;
    } else if (!signature.includes(item.shortName)) {
      signature = `${item.name} ${signature}`.trim();
    }
  }

  let detailNode = target.next("dd");

  if ((!detailNode || detailNode.length === 0) && definition && definition.length > 0) {
    detailNode = definition.find("> dd").first();
  }

  const description = extractDescription($, detailNode);
  const { parameters, returns } = extractFieldLists($, detailNode);
  console.log(`[numpy-docs] Parsed detail counts for ${item.id}:`, {
    descriptionCount: description.length,
    parameterCount: parameters.length,
    returnCount: returns.length,
  });

  return {
    signature: signature || undefined,
    description,
    parameters,
    returns,
  };
}

export function buildMarkdown(item: InventoryItem, detail: DocDetail): string {
  const lines: string[] = [];

  if (detail.signature) {
    lines.push("```python");
    lines.push(detail.signature);
    lines.push("```");
    lines.push("");
  }

  if (detail.description.length > 0) {
    lines.push(detail.description.join("\n\n"));
    lines.push("");
  }

  if (detail.parameters.length > 0) {
    lines.push("#### Parameters");
    lines.push("");
    for (const param of detail.parameters) {
      lines.push(formatFieldItem(param));
    }
    lines.push("");
  }

  if (detail.returns.length > 0) {
    lines.push("#### Returns");
    lines.push("");
    for (const value of detail.returns) {
      lines.push(formatFieldItem(value));
    }
    lines.push("");
  }

  lines.push(`Source: [${item.shortName}](${item.url})`);

  return lines.join("\n").trim();
}

function extractAnchor(url: string): string | undefined {
  const hashIndex = url.indexOf("#");
  if (hashIndex === -1) {
    return undefined;
  }
  return url.slice(hashIndex + 1);
}

function extractDescription($: cheerio.CheerioAPI, detailNode: cheerio.Cheerio): string[] {
  const description: string[] = [];

  if (!detailNode || detailNode.length === 0) {
    return description;
  }

  const children = detailNode.children().toArray();

  for (const child of children) {
    const node = $(child);
    if (node.is("dl.field-list")) {
      break;
    }

    if (node.is("div.admonition")) {
      continue;
    }

    if (node.is("p")) {
      const text = normalizeWhitespace(node.text());
      if (text) {
        description.push(text);
      }
    }
  }

  return description;
}

function extractFieldLists(
  $: cheerio.CheerioAPI,
  detailNode: cheerio.Cheerio,
): { parameters: DocFieldItem[]; returns: DocFieldItem[] } {
  const parameters: DocFieldItem[] = [];
  const returns: DocFieldItem[] = [];

  if (!detailNode || detailNode.length === 0) {
    return { parameters, returns };
  }

  detailNode.find("dl.field-list").each((_, fieldList) => {
    const $fieldList = $(fieldList);
    const definitionTerms = $fieldList.children("dt");

    definitionTerms.each((index, dt) => {
      const heading = normalizeWhitespace($(dt).text()).replace(/:$/, "");
      const content = $fieldList.children("dd").eq(index);

      if (heading.toLowerCase() === "parameters") {
        parameters.push(...parseFieldDefinition($, content));
      }

      if (heading.toLowerCase() === "returns") {
        returns.push(...parseFieldDefinition($, content));
      }
    });
  });

  return { parameters, returns };
}

function parseFieldDefinition($: cheerio.CheerioAPI, container: cheerio.Cheerio): DocFieldItem[] {
  const items: DocFieldItem[] = [];

  if (!container || container.length === 0) {
    return items;
  }

  const innerList = container.find("dl").first();

  innerList.children("dt").each((_, definitionTerm) => {
    const term = $(definitionTerm);
    const classifier = term
      .find("span.classifier")
      .map((__, span) => normalizeWhitespace($(span).text()))
      .get();
    const nameNode = term.clone();
    nameNode.find("span.classifier").remove();
    const name = normalizeWhitespace(nameNode.text());

    const descriptionNode = term.next("dd");
    const paragraphs = descriptionNode
      .find("p")
      .map((__, p) => normalizeWhitespace($(p).text()))
      .get()
      .filter(Boolean);

    const description = paragraphs.length > 0 ? paragraphs.join(" ") : normalizeWhitespace(descriptionNode.text());

    items.push({
      name,
      type: classifier.filter(Boolean).join(", ") || undefined,
      description: description || undefined,
    });
  });

  return items;
}

function formatFieldItem(item: DocFieldItem): string {
  const parts: string[] = [];
  parts.push(`- **${item.name}**`);

  if (item.type) {
    parts.push(`*${item.type}*`);
  }

  if (item.description) {
    parts.push(`— ${item.description}`);
  }

  return parts.join(" ");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

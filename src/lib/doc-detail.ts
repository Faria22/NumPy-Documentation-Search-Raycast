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

export function parseDocDetail(html: string, item: InventoryItem): DocDetail {
  const $ = cheerio.load(html);

  const anchor = extractAnchor(item.url);
  let target = anchor ? $("[id='" + anchor + "']") : $("section").first();
  if (!target || target.length === 0) {
    target = $("dl.py").first().children("dt").first();
  }

  const definition = target.closest("dl");

  let signature = normalizeWhitespace(target.text()).replace(/[#¶]$/, "");
  signature = signature.replace(/numpy\.\s+/g, "numpy.").replace(/\s+\(/g, "(");
  signature = signature.replace(/\[source\]\s*$/i, "").trim();

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
    const enhancedSignature = enhanceSignatureWithTypes(detail.signature, detail.parameters, detail.returns);
    lines.push(enhancedSignature);
    lines.push("```");
    lines.push("");
  }

  if (detail.description.length > 0) {
    lines.push(detail.description.join("\n\n"));
    lines.push("");
  }

  if (detail.parameters.length > 0) {
    lines.push("## Parameters");
    lines.push("");
    for (const param of detail.parameters) {
      const formattedParam = formatFieldItem(param);
      // Split the formatted parameter and add each line individually
      lines.push(...formattedParam.split("\n"));
    }
    lines.push("");
  }

  if (detail.returns.length > 0) {
    lines.push("## Returns");
    lines.push("");
    for (const value of detail.returns) {
      const formattedReturn = formatFieldItem(value);
      // Split the formatted return value and add each line individually
      lines.push(...formattedReturn.split("\n"));
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

function enhanceSignatureWithTypes(signature: string, parameters: DocFieldItem[], returns: DocFieldItem[]): string {
  // Extract function name and params from signature
  const match = signature.match(/^([^(]+)\((.*)\)\s*$/);
  if (!match) {
    // If signature doesn't match expected pattern, add def keyword at least
    return `def ${signature}:`;
  }

  const funcName = match[1].trim();
  const paramsStr = match[2].trim();

  // Parse parameters from signature
  const paramParts = paramsStr
    ? paramsStr
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  // Build enhanced params with type hints
  const enhancedParams = paramParts.map((param) => {
    // Extract param name and default value
    const equalIndex = param.indexOf("=");
    let paramName: string;
    let defaultValue: string | null = null;

    if (equalIndex !== -1) {
      paramName = param.slice(0, equalIndex).trim();
      defaultValue = param.slice(equalIndex + 1).trim();
    } else {
      paramName = param.trim();
    }

    // Find type info from parameters list
    const paramInfo = parameters.find((p) => p.name === paramName);
    const typeAnnotation = paramInfo?.type ? `: ${paramInfo.type}` : "";

    if (defaultValue) {
      return `${paramName}${typeAnnotation} = ${defaultValue}`;
    }
    return `${paramName}${typeAnnotation}`;
  });

  // Build return type annotation
  const returnType = returns.length > 0 && returns[0].type ? ` -> ${returns[0].type}` : "";

  // Build enhanced signature with def keyword, type hints, and trailing colon
  return `def ${funcName}(${enhancedParams.join(", ")})${returnType}:`;
}

function formatFieldItem(item: DocFieldItem): string {
  const lines: string[] = [];

  // First line: parameter name and type
  let firstLine = `${item.name}`;
  if (item.type) {
    firstLine += ` : *${item.type}*`;
  }
  lines.push(firstLine);

  // Second line: description with indentation
  if (item.description) {
    lines.push(`> ${item.description}`);
  }

  // Add blank line after each parameter for better markdown rendering
  lines.push("");

  return lines.join("\n");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

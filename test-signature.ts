import { readFileSync } from "node:fs";
import { parseDocDetail, buildMarkdown } from "./src/lib/doc-detail";
import type { InventoryItem } from "./src/lib/inventory";

const html = readFileSync("src/__tests__/fixtures/numpy.linspace.html", "utf8");
const item: InventoryItem = {
  id: "numpy.linspace",
  name: "numpy.linspace",
  shortName: "linspace",
  role: "py:function",
  url: "https://numpy.org/doc/stable/reference/generated/numpy.linspace.html#numpy.linspace",
  docPath: "reference/generated/numpy.linspace.html#numpy.linspace",
  displayName: "numpy.linspace",
};

const detail = parseDocDetail(html, item);
console.log("Current signature:");
console.log(detail.signature);
console.log("\nMarkdown output:");
const markdown = buildMarkdown(item, detail);
console.log(markdown.split("\n").slice(0, 10).join("\n"));

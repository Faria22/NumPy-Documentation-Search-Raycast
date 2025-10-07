import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildMarkdown, parseDocDetail } from "../lib/doc-detail";
import type { InventoryItem } from "../lib/inventory";

function loadFixture(name: string) {
  const path = `${__dirname}/fixtures/${name}`;
  return readFileSync(path, "utf8");
}

describe("parseDocDetail", () => {
  it("parses numpy.linspace documentation", () => {
    const html = loadFixture("numpy.linspace.html");
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

    expect(detail.signature).toContain("numpy.linspace");
    expect(detail.signature).not.toContain("[source]");
    expect(detail.description.length).toBeGreaterThan(0);
    expect(detail.parameters.length).toBeGreaterThan(1);
    expect(detail.returns.length).toBeGreaterThan(0);

    const markdown = buildMarkdown(item, detail);
    expect(markdown).toContain("#### Parameters");
    expect(markdown).toContain("#### Returns");
  });

  it("parses numpy.ndarray.any method documentation", () => {
    const html = loadFixture("numpy.ndarray.any.html");
    const item: InventoryItem = {
      id: "numpy.ndarray.any",
      name: "numpy.ndarray.any",
      shortName: "ndarray.any",
      role: "py:method",
      url: "https://numpy.org/doc/stable/reference/generated/numpy.ndarray.any.html#numpy.ndarray.any",
      docPath: "reference/generated/numpy.ndarray.any.html#numpy.ndarray.any",
      displayName: "numpy.ndarray.any",
    };

    const detail = parseDocDetail(html, item);

    expect(detail.signature).toContain("numpy.ndarray.any");
    expect(detail.signature).not.toContain("[source]");
    expect(detail.description.length).toBeGreaterThan(0);
    expect(detail.parameters.length).toBeGreaterThanOrEqual(0);

    const markdown = buildMarkdown(item, detail);
    expect(markdown).toContain("Source: [ndarray.any]");
  });
});

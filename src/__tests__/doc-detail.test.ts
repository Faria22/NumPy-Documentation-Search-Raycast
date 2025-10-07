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
    expect(markdown).toContain("## Parameters");
    expect(markdown).toContain("## Returns");
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
    expect(markdown).toContain("## Returns");
  });

  it("always includes signature as Python code block in markdown", () => {
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
    const markdown = buildMarkdown(item, detail);

    // Should start with ```python code block
    expect(markdown).toMatch(/^```python\n/);

    // Should contain the signature in the markdown
    expect(markdown).toContain(detail.signature);

    // Count occurrences of the signature - should appear exactly once
    const signatureOccurrences = (
      markdown.match(new RegExp(detail.signature!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []
    ).length;
    expect(signatureOccurrences).toBe(1);
  });

  it("signature appears as fenced Python code block", () => {
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

    // Signature should always be in markdown as a Python code block
    const markdown = buildMarkdown(item, detail);
    expect(markdown).toMatch(/^```python\n/);
    expect(markdown).toContain(detail.signature);
  });

  it("preserves inline code blocks in parameter descriptions", () => {
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
    const markdown = buildMarkdown(item, detail);

    // Check that inline code blocks are preserved in parameter descriptions
    expect(markdown).toContain("`endpoint`");
    expect(markdown).toContain("`False`");
    expect(markdown).toContain("`num + 1`");
  });
});

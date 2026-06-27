import { describe, it, expect } from "vitest";
import { getExplanation, listCategories, renderExplanation } from "../src/explain/index.js";

describe("getExplanation", () => {
  it("returns an object with the expected fields for 'large-files'", () => {
    const exp = getExplanation("large-files");
    expect(exp).not.toBeNull();
    expect(exp!.title).toBeTruthy();
    expect(exp!.summary).toBeTruthy();
    expect(exp!.whyItMatters).toBeTruthy();
    expect(Array.isArray(exp!.howToFix)).toBe(true);
    expect(exp!.howToFix.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown category", () => {
    const exp = getExplanation("nonexistent-category-xyz");
    expect(exp).toBeNull();
  });

  it("returns the correct category value on the returned object", () => {
    const exp = getExplanation("complexity");
    expect(exp).not.toBeNull();
    expect(exp!.category).toBe("complexity");
  });

  it("returns a severity value of 'critical', 'warning', or 'info'", () => {
    const exp = getExplanation("security");
    expect(exp).not.toBeNull();
    expect(["critical", "warning", "info"]).toContain(exp!.severity);
  });
});

describe("listCategories", () => {
  it("returns an array of strings", () => {
    const cats = listCategories();
    expect(Array.isArray(cats)).toBe(true);
    expect(cats.length).toBeGreaterThan(0);
    for (const c of cats) {
      expect(typeof c).toBe("string");
    }
  });

  it("includes 'large-files'", () => {
    expect(listCategories()).toContain("large-files");
  });

  it("includes 'complexity'", () => {
    expect(listCategories()).toContain("complexity");
  });

  it("includes 'security'", () => {
    expect(listCategories()).toContain("security");
  });

  it("returns a sorted list", () => {
    const cats = listCategories();
    const sorted = [...cats].sort();
    expect(cats).toEqual(sorted);
  });
});

describe("renderExplanation", () => {
  it("returns a string", () => {
    const exp = getExplanation("large-files")!;
    const output = renderExplanation(exp);
    expect(typeof output).toBe("string");
  });

  it("contains the title", () => {
    const exp = getExplanation("large-files")!;
    const output = renderExplanation(exp);
    expect(output).toContain("Large Files");
  });

  it("contains the summary text", () => {
    const exp = getExplanation("large-files")!;
    const output = renderExplanation(exp);
    // Strip ANSI codes for easier matching
    const plain = output.replace(/\x1B\[[0-9;]*m/g, "");
    expect(plain).toContain("Source files that have grown too large");
  });

  it("contains 'HOW TO FIX' section header", () => {
    const exp = getExplanation("large-files")!;
    const plain = renderExplanation(exp).replace(/\x1B\[[0-9;]*m/g, "");
    expect(plain).toContain("HOW TO FIX");
  });

  it("contains 'WHY IT MATTERS' section header", () => {
    const exp = getExplanation("large-files")!;
    const plain = renderExplanation(exp).replace(/\x1B\[[0-9;]*m/g, "");
    expect(plain).toContain("WHY IT MATTERS");
  });

  it("renders both 'Bad' and 'Good' sections when an example exists", () => {
    const exp = getExplanation("large-files")!;
    expect(exp.example).toBeDefined();
    const plain = renderExplanation(exp).replace(/\x1B\[[0-9;]*m/g, "");
    expect(plain).toContain("Bad:");
    expect(plain).toContain("Good:");
  });

  it("does not include EXAMPLE section for entries without an example", () => {
    const exp = getExplanation("duplicates")!;
    expect(exp.example).toBeUndefined();
    const plain = renderExplanation(exp).replace(/\x1B\[[0-9;]*m/g, "");
    expect(plain).not.toContain("✗ Bad:");
    expect(plain).not.toContain("✓ Good:");
  });

  it("includes severity in the output", () => {
    const exp = getExplanation("security")!;
    const plain = renderExplanation(exp).replace(/\x1B\[[0-9;]*m/g, "");
    expect(plain).toContain("Severity: CRITICAL");
  });

  it("includes the category tag in the output", () => {
    const exp = getExplanation("circular-deps")!;
    const plain = renderExplanation(exp).replace(/\x1B\[[0-9;]*m/g, "");
    expect(plain).toContain("[circular-deps]");
  });
});

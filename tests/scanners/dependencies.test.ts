import { describe, it, expect } from "vitest";
import path from "path";
import { DependencyScanner } from "../../src/scanners/dependencies.js";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("DependencyScanner", () => {
  const scanner = new DependencyScanner();

  it("detects unused dependencies", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats as { unusedCount: number; unused: string[] };

    expect(stats.unusedCount).toBeGreaterThan(0);
    expect(stats.unused).toContain("unused-package");
    expect(stats.unused).toContain("another-unused");
  });

  it("does NOT flag packages that are imported in source", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats as { unused: string[] };

    expect(stats.unused).not.toContain("express");
    expect(stats.unused).not.toContain("lodash");
    expect(stats.unused).not.toContain("axios");
  });

  it("generates findings for unused deps", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    const unusedFindings = result.findings.filter(
      (f) => f.category === "unused-deps"
    );
    expect(unusedFindings.length).toBeGreaterThan(0);
    expect(unusedFindings[0].severity).toBe("warning");
  });

  it("handles missing package.json gracefully", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "no-package"));

    expect(result.findings).toEqual([]);
  });

  it("handles empty dependencies gracefully", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "empty-project"));

    expect(result.findings).toEqual([]);
  });

  it("reports correct total dep count in stats", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats as { deps: number; devDeps: number; total: number };

    expect(stats.deps).toBe(6);
    expect(stats.devDeps).toBe(2);
    expect(stats.total).toBe(8);
  });
});

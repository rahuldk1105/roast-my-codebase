import { describe, it, expect } from "vitest";
import path from "path";
import { DuplicateScanner } from "../../src/scanners/duplicates.js";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("DuplicateScanner", () => {
  const scanner = new DuplicateScanner();

  it("detects duplicated code blocks across files", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    const duplicateFindings = result.findings.filter(
      (f) => f.category === "duplicates"
    );
    expect(duplicateFindings.length).toBeGreaterThan(0);
  });

  it("returns stats with block count", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats as {
      totalBlocks: number;
      totalDuplicateLines: number;
    };

    expect(stats.totalBlocks).toBeDefined();
    expect(stats.totalDuplicateLines).toBeDefined();
  });

  it("handles empty project", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "empty-project"));

    expect(result.findings).toEqual([]);
  });

  it("handles project with no duplicates gracefully", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "no-package"));

    expect(result.findings).toEqual([]);
  });
});

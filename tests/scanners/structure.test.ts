import { describe, it, expect } from "vitest";
import path from "path";
import { StructureScanner } from "../../src/scanners/structure.js";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("StructureScanner", () => {
  const scanner = new StructureScanner();

  it("detects deep nesting in sample project", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats as { maxDepth: number };

    // src/deep/nested/folder/structure/here/deep-file.ts = 7 levels
    expect(stats.maxDepth).toBeGreaterThanOrEqual(7);
  });

  it("detects utility file patterns", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats as { utilFiles: number };

    // helpers.ts, common.ts, shared.ts
    expect(stats.utilFiles).toBeGreaterThanOrEqual(3);
  });

  it("generates finding for utility explosion (3+ util files)", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    const utilFindings = result.findings.filter(
      (f) => f.id === "util-explosion" || f.id === "util-files"
    );
    expect(utilFindings.length).toBeGreaterThan(0);
  });

  it("handles empty project without errors", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "empty-project"));

    expect(result.findings).toEqual([]);
  });

  it("returns stats even for minimal projects", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "empty-project"));
    const stats = result.stats as { maxDepth: number; totalFolders: number };

    expect(stats.maxDepth).toBeDefined();
    expect(stats.totalFolders).toBeDefined();
  });
});

import { describe, it, expect } from "vitest";
import path from "path";
import { FileScanner } from "../../src/scanners/files.js";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("FileScanner", () => {
  const scanner = new FileScanner();

  it("scans sample project and returns stats", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    expect(result.stats).toBeDefined();
    expect(result.stats.sourceFiles).toBeGreaterThan(0);
    expect(result.stats.totalFiles).toBeGreaterThan(0);
    expect(result.stats.totalLines).toBeGreaterThan(0);
    expect(result.stats.largestFiles).toBeInstanceOf(Array);
    expect(result.stats.largestFiles.length).toBeGreaterThan(0);
  });

  it("detects large files (500+ lines)", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    const largeFileFindings = result.findings.filter(
      (f) => f.category === "large-files"
    );
    expect(largeFileFindings.length).toBeGreaterThan(0);

    const bigFile = largeFileFindings.find((f) =>
      f.file?.includes("big-file.ts")
    );
    expect(bigFile).toBeDefined();
  });

  it("returns correct dependency counts from package.json", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    expect(result.stats.dependencies).toBe(6);
    expect(result.stats.devDependencies).toBe(2);
  });

  it("handles empty project without errors", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "empty-project"));

    expect(result.stats.sourceFiles).toBe(0);
    expect(result.stats.totalLines).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it("handles directory with no package.json", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "no-package"));

    expect(result.stats.dependencies).toBe(0);
    expect(result.stats.devDependencies).toBe(0);
  });

  it("largest files are sorted descending", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    const files = result.stats.largestFiles;
    for (let i = 1; i < files.length; i++) {
      expect(files[i - 1].lines).toBeGreaterThanOrEqual(files[i].lines);
    }
  });
});

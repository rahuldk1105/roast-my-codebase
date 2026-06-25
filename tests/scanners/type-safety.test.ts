import { describe, it, expect } from "vitest";
import path from "path";
import { TypeSafetyScanner } from "../../src/scanners/type-safety.js";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("TypeSafetyScanner", () => {
  const scanner = new TypeSafetyScanner();

  it("detects `any` usage", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats;

    expect(stats.totalAny).toBeGreaterThan(0);
    expect(result.findings.length).toBeGreaterThan(0);
    const anyFinding = result.findings.find(
      (f) => f.id.startsWith("type-safety-any")
    );
    expect(anyFinding).toBeDefined();
    expect(anyFinding!.category).toBe("type-safety");
  });

  it("detects @ts-ignore comments", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats;

    expect(stats.totalTsIgnore).toBeGreaterThan(0);
  });

  it("does not count `any` inside comments", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats;

    // The fixture unsafe-types.ts has "// Several `: any` annotations" as a comment
    // which should NOT be counted. Actual code usages:
    //   unsafe-types.ts: 4 `: any` + 2 `as any` = 6
    //   complex-function.ts: 3 `: any` on one line = 3
    // Total = 9 (the comment line is correctly excluded)
    expect(stats.totalAny).toBe(9);
  });

  it("does not false-positive on words containing `any`", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats;

    // "company" and "manyThings" in unsafe-types.ts should NOT be counted.
    // Only actual `: any` and `as any` patterns should match.
    // If "company" or "manyThings" were false-positived, count would be > 9.
    expect(stats.totalAny).toBe(9);
  });

  it("returns empty for clean TypeScript", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "empty-project"));
    const stats = result.stats;

    expect(stats.totalAny).toBe(0);
    expect(stats.totalTsIgnore).toBe(0);
    expect(stats.totalTsNocheck).toBe(0);
    expect(stats.totalTsExpectError).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it("handles empty project", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "no-package"));
    const stats = result.stats;

    expect(stats.totalAny).toBe(0);
    expect(stats.totalTsIgnore).toBe(0);
    expect(stats.totalTsNocheck).toBe(0);
    expect(stats.totalTsExpectError).toBe(0);
    expect(stats.worstOffenders).toEqual([]);
    expect(result.findings).toEqual([]);
  });
});

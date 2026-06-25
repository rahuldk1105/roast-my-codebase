import { describe, it, expect } from "vitest";
import path from "path";
import { ComplexityScanner } from "../../src/scanners/complexity.js";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("ComplexityScanner", () => {
  const scanner = new ComplexityScanner();

  it("detects simple function with low complexity", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    // simpleHelper has complexity 1 (no branches), should not appear in findings
    const simpleFindings = result.findings.filter(
      (f) => f.message.includes("simpleHelper")
    );
    expect(simpleFindings).toHaveLength(0);
  });

  it("detects complex function with many branches", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    // processOrder has many branches, should be flagged
    const complexFindings = result.findings.filter(
      (f) => f.message.includes("processOrder")
    );
    expect(complexFindings).toHaveLength(1);
    expect(complexFindings[0].severity).toMatch(/warning|critical/);
    expect(complexFindings[0].category).toBe("complexity");
    expect(complexFindings[0].file).toContain("complex-function.ts");
  });

  it("returns correct stats", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    expect(result.stats).toBeDefined();
    expect(result.stats.totalFunctions).toBeGreaterThan(0);
    expect(result.stats.averageComplexity).toBeGreaterThan(0);
    expect(result.stats.maxComplexity).toBeGreaterThanOrEqual(15);
    expect(result.stats.complexFunctions).toBeGreaterThanOrEqual(1);
  });

  it("handles empty project", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "empty-project"));

    expect(result.findings).toEqual([]);
    expect(result.stats.totalFunctions).toBe(0);
    expect(result.stats.averageComplexity).toBe(0);
    expect(result.stats.maxComplexity).toBe(0);
    expect(result.stats.complexFunctions).toBe(0);
  });
});

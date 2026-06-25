import { describe, it, expect } from "vitest";
import path from "path";
import { CircularDependencyScanner } from "../../src/scanners/circular.js";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("CircularDependencyScanner", () => {
  const scanner = new CircularDependencyScanner();

  it("detects circular dependencies between auth.ts and user.ts", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats as { cycleCount: number };

    expect(stats.cycleCount).toBeGreaterThan(0);
  });

  it("generates findings for cycles", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    const circularFindings = result.findings.filter(
      (f) => f.category === "circular-deps"
    );
    expect(circularFindings.length).toBeGreaterThan(0);
    expect(circularFindings[0].severity).toBe("warning");
    expect(circularFindings[0].message).toContain("Circular dependency");
  });

  it("includes cycle chain in detail", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    const circularFindings = result.findings.filter(
      (f) => f.category === "circular-deps"
    );
    const detail = circularFindings[0]?.detail || "";
    expect(detail).toContain("→");
  });

  it("handles project with no circular deps", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "empty-project"));
    const stats = result.stats as { cycleCount: number };

    expect(stats.cycleCount).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it("handles directory with no source files", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "no-package"));
    const stats = result.stats as { cycleCount: number };

    expect(stats.cycleCount).toBe(0);
    expect(result.findings).toEqual([]);
  });
});

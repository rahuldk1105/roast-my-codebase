import { describe, it, expect } from "vitest";
import { calculateHealth } from "../src/scoring/index.js";
import { Finding } from "../src/types/index.js";

describe("calculateHealth", () => {
  it("returns 100 for no findings", () => {
    const result = calculateHealth([]);

    expect(result.score).toBe(100);
    expect(result.grade).toBe("A");
    expect(result.label).toBe("Excellent");
  });

  it("deducts for large files", () => {
    const findings: Finding[] = [
      {
        id: "large-file-1",
        severity: "warning",
        category: "large-files",
        message: "big.ts is 1000 lines",
      },
    ];
    const result = calculateHealth(findings);

    expect(result.score).toBe(97);
  });

  it("deducts more for extreme files", () => {
    const findings: Finding[] = [
      {
        id: "large-file-extreme-1",
        severity: "critical",
        category: "large-files",
        message: "huge.ts is 2500 lines",
      },
    ];
    const result = calculateHealth(findings);

    expect(result.score).toBe(95);
  });

  it("deducts for circular dependencies", () => {
    const findings: Finding[] = [
      {
        id: "circular-1",
        severity: "warning",
        category: "circular-deps",
        message: "Circular dependency: a → b → a",
      },
    ];
    const result = calculateHealth(findings);

    expect(result.score).toBe(95);
  });

  it("deducts for unused deps", () => {
    const findings: Finding[] = [
      {
        id: "unused-dep-foo",
        severity: "warning",
        category: "unused-deps",
        message: '"foo" appears unused',
      },
    ];
    const result = calculateHealth(findings);

    expect(result.score).toBe(98);
  });

  it("deducts for TODOs based on count in message", () => {
    const findings: Finding[] = [
      {
        id: "todo-count",
        severity: "info",
        category: "todos",
        message: "Found 20 comment markers (15 TODO, 3 FIXME, 2 HACK/XXX)",
      },
    ];
    const result = calculateHealth(findings);

    // -0.25 * 20 = -5
    expect(result.score).toBe(95);
  });

  it("clamps score to 0 minimum", () => {
    const findings: Finding[] = Array.from({ length: 30 }, (_, i) => ({
      id: `circular-${i}`,
      severity: "warning" as const,
      category: "circular-deps",
      message: "cycle",
    }));
    const result = calculateHealth(findings);

    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("clamps score to 100 maximum", () => {
    const result = calculateHealth([]);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("assigns correct grades at boundaries", () => {
    // We can't test exact boundaries easily, but test the grade mapping
    expect(calculateHealth([]).grade).toBe("A");

    const manyFindings: Finding[] = Array.from({ length: 5 }, (_, i) => ({
      id: `circular-${i}`,
      severity: "warning" as const,
      category: "circular-deps",
      message: "cycle",
    }));
    // -5 * 5 = -25 → score 75
    const result = calculateHealth(manyFindings);
    expect(result.score).toBe(75);
    expect(result.grade).toBe("C");
    expect(result.label).toBe("Fair");
  });
});

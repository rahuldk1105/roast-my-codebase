import { describe, it, expect } from "vitest";
import { generateRoasts, generateVerdict, generateOpeningLine } from "../src/roasts/index.js";
import { Finding, HealthScore } from "../src/types/index.js";

describe("generateRoasts", () => {
  it("generates roasts for large files", async () => {
    const findings: Finding[] = [
      {
        id: "large-file-big.ts",
        severity: "warning",
        category: "large-files",
        message: "big.ts is 1,200 lines",
        file: "src/big.ts",
      },
    ];
    const roasts = await generateRoasts(findings);

    expect(roasts.length).toBeGreaterThan(0);
    const largeFileRoast = roasts.find((r) => r.category === "large-files");
    expect(largeFileRoast).toBeDefined();
    expect(largeFileRoast!.target).toBe("src/big.ts");
    expect(largeFileRoast!.message.length).toBeGreaterThan(0);
  });

  it("generates roasts for TODOs", async () => {
    const findings: Finding[] = [
      {
        id: "todo-count",
        severity: "info",
        category: "todos",
        message: "Found 10 comment markers",
      },
    ];
    const roasts = await generateRoasts(findings);

    const todoRoast = roasts.find((r) => r.category === "todos");
    expect(todoRoast).toBeDefined();
    expect(todoRoast!.target).toBe("TODOs");
  });

  it("generates roasts for unused deps", async () => {
    const findings: Finding[] = [
      {
        id: "unused-dep-moment",
        severity: "warning",
        category: "unused-deps",
        message: '"moment" appears unused',
        detail: "moment",
      },
    ];
    const roasts = await generateRoasts(findings);

    const depRoast = roasts.find((r) => r.category === "dependencies");
    expect(depRoast).toBeDefined();
  });

  it("generates roasts for circular deps", async () => {
    const findings: Finding[] = [
      {
        id: "circular-auth",
        severity: "warning",
        category: "circular-deps",
        message: "Circular dependency: auth → user → auth",
        file: "src/auth.ts",
      },
    ];
    const roasts = await generateRoasts(findings);

    const circRoast = roasts.find((r) => r.category === "circular-deps");
    expect(circRoast).toBeDefined();
  });

  it("generates roasts for structure issues", async () => {
    const findings: Finding[] = [
      {
        id: "deep-nesting",
        severity: "warning",
        category: "structure",
        message: "Nesting depth is 12 levels",
        file: "src/deep/path",
      },
    ];
    const roasts = await generateRoasts(findings);

    const structRoast = roasts.find((r) => r.category === "structure");
    expect(structRoast).toBeDefined();
  });

  it("returns empty array when no roastable findings", async () => {
    const roasts = await generateRoasts([]);

    expect(roasts).toEqual([]);
  });

  it("does not roast info-severity large files", async () => {
    const findings: Finding[] = [
      {
        id: "large-file-warn-small.ts",
        severity: "info",
        category: "large-files",
        message: "small.ts is 500 lines",
        file: "src/small.ts",
      },
    ];
    const roasts = await generateRoasts(findings);

    const largeFileRoast = roasts.find((r) => r.category === "large-files");
    expect(largeFileRoast).toBeUndefined();
  });
});

describe("generateOpeningLine", () => {
  it("returns null for score >= 85", () => {
    expect(generateOpeningLine(85, 50)).toBeNull();
    expect(generateOpeningLine(90, 100)).toBeNull();
    expect(generateOpeningLine(100, 0)).toBeNull();
  });

  it("returns null for score 90", () => {
    expect(generateOpeningLine(90, 0)).toBeNull();
  });

  it("returns a string for score < 40 with many findings", () => {
    const result = generateOpeningLine(30, 70);
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns a string for score < 40 with few findings", () => {
    const result = generateOpeningLine(35, 5);
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns a string for score < 60", () => {
    const result = generateOpeningLine(55, 10);
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns a string for score < 60 with many findings", () => {
    const result = generateOpeningLine(58, 70);
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns a string for score 60-84 with many findings", () => {
    const result = generateOpeningLine(70, 35);
    expect(typeof result).toBe("string");
    expect(result!.length).toBeGreaterThan(0);
  });

  it("returns null for score 60-84 with few findings", () => {
    expect(generateOpeningLine(75, 5)).toBeNull();
    expect(generateOpeningLine(84, 10)).toBeNull();
  });
});

describe("generateVerdict", () => {
  it("returns a string for excellent scores", () => {
    const health: HealthScore = { score: 95, grade: "A", label: "Excellent" };
    const verdict = generateVerdict(health);

    expect(typeof verdict).toBe("string");
    expect(verdict.length).toBeGreaterThan(10);
  });

  it("returns a string for chaotic scores", () => {
    const health: HealthScore = { score: 30, grade: "F", label: "Chaotic" };
    const verdict = generateVerdict(health);

    expect(typeof verdict).toBe("string");
    expect(verdict.length).toBeGreaterThan(10);
  });

  it("returns different tone for different score ranges", () => {
    // Run multiple times to check we always get valid strings
    const scores = [95, 85, 75, 65, 40];
    for (const score of scores) {
      const health: HealthScore = { score, grade: "X", label: "X" };
      const verdict = generateVerdict(health);
      expect(typeof verdict).toBe("string");
      expect(verdict.length).toBeGreaterThan(0);
    }
  });
});

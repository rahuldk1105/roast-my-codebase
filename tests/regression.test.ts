import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { checkRegression, formatRegressionOutput } from "../src/regression/index.js";
import type { HealthHistory } from "../src/history/index.js";

/**
 * Write a HealthHistory object as .roast-history.json in the given directory.
 */
function writeHistory(dir: string, history: HealthHistory): void {
  fs.writeFileSync(
    path.join(dir, ".roast-history.json"),
    JSON.stringify(history, null, 2),
    "utf-8"
  );
}

/**
 * Build a minimal HealthHistory with a list of scores.
 */
function historyFromScores(scores: number[]): HealthHistory {
  return {
    projectName: "test-project",
    snapshots: scores.map((score, i) => ({
      timestamp: Date.now() + i * 1000,
      date: new Date().toISOString(),
      score,
      grade: "B",
      totalFindings: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      categoryCounts: {},
    })),
  };
}

describe("checkRegression", () => {
  it("returns isRegression: false when no history file exists", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-reg-test-"));
    try {
      const result = checkRegression(tempDir, 80, 0);
      expect(result.isRegression).toBe(false);
      expect(result.previousScore).toBeNull();
      expect(result.message).toBe("No history to compare against");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns isRegression: false when history has 0 snapshots", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-reg-test-"));
    try {
      writeHistory(tempDir, { projectName: "test", snapshots: [] });
      const result = checkRegression(tempDir, 80, 0);
      expect(result.isRegression).toBe(false);
      expect(result.previousScore).toBeNull();
      expect(result.message).toBe("No history to compare against");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("detects regression when score drops more than tolerance", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-reg-test-"));
    try {
      writeHistory(tempDir, historyFromScores([85]));
      const result = checkRegression(tempDir, 70, 0);
      expect(result.isRegression).toBe(true);
      expect(result.scoreDelta).toBe(-15);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns isRegression: false when score drops within tolerance", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-reg-test-"));
    try {
      writeHistory(tempDir, historyFromScores([85]));
      // Drops 5 points, tolerance is 5 — not a regression
      const result = checkRegression(tempDir, 80, 5);
      expect(result.isRegression).toBe(false);
      expect(result.scoreDelta).toBe(-5);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns isRegression: false when score stays the same", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-reg-test-"));
    try {
      writeHistory(tempDir, historyFromScores([80]));
      const result = checkRegression(tempDir, 80, 0);
      expect(result.isRegression).toBe(false);
      expect(result.scoreDelta).toBe(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns isRegression: false when score improves", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-reg-test-"));
    try {
      writeHistory(tempDir, historyFromScores([75]));
      const result = checkRegression(tempDir, 90, 0);
      expect(result.isRegression).toBe(false);
      expect(result.scoreDelta).toBe(15);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("scoreDelta is negative when score dropped", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-reg-test-"));
    try {
      writeHistory(tempDir, historyFromScores([90]));
      const result = checkRegression(tempDir, 70, 0);
      expect(result.scoreDelta).toBe(-20);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("previousScore is null when no history exists", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-reg-test-"));
    try {
      const result = checkRegression(tempDir, 80, 0);
      expect(result.previousScore).toBeNull();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("previousScore matches the last snapshot score when history exists", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-reg-test-"));
    try {
      // Three snapshots; last one has score 88
      writeHistory(tempDir, historyFromScores([70, 80, 88]));
      const result = checkRegression(tempDir, 85, 0);
      expect(result.previousScore).toBe(88);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("formatRegressionOutput", () => {
  it("contains ✗ for a regression", () => {
    const regressionResult = {
      isRegression: true,
      previousScore: 85,
      currentScore: 70,
      scoreDelta: -15,
      message: "Score dropped 15 points (85 → 70) — exceeds tolerance of 0",
    };
    const output = formatRegressionOutput(regressionResult);
    expect(output).toContain("✗");
  });

  it("contains ✓ for an improvement", () => {
    const improvementResult = {
      isRegression: false,
      previousScore: 70,
      currentScore: 85,
      scoreDelta: 15,
      message: "Score improved (70 → 85)",
    };
    const output = formatRegressionOutput(improvementResult);
    expect(output).toContain("✓");
  });
});

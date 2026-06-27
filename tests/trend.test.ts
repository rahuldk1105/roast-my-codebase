import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { checkTrendGating, formatTrendResult } from "../src/trend/index.js";
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

// ---------------------------------------------------------------------------
// checkTrendGating
// ---------------------------------------------------------------------------

describe("checkTrendGating — insufficient data", () => {
  it("returns insufficient-data when no history file exists", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      const result = checkTrendGating(tempDir, 80, 3);
      expect(result.trend).toBe("insufficient-data");
      expect(result.shouldFail).toBe(false);
      expect(result.consecutiveDrops).toBe(0);
      expect(result.message).toBe("Insufficient history for trend analysis");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns insufficient-data when history has 0 snapshots", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      writeHistory(tempDir, { projectName: "test", snapshots: [] });
      const result = checkTrendGating(tempDir, 80, 3);
      expect(result.trend).toBe("insufficient-data");
      expect(result.shouldFail).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns insufficient-data when history has fewer snapshots than required", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      // 2 snapshots, but 3 required
      writeHistory(tempDir, historyFromScores([90, 85]));
      const result = checkTrendGating(tempDir, 80, 3);
      expect(result.trend).toBe("insufficient-data");
      expect(result.shouldFail).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("checkTrendGating — failure detection", () => {
  it("detects 3 consecutive drops and sets shouldFail: true", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      // History: 90, 85, 80 — then current 75 = 3 consecutive drops
      writeHistory(tempDir, historyFromScores([90, 85, 80]));
      const result = checkTrendGating(tempDir, 75, 3);
      expect(result.shouldFail).toBe(true);
      expect(result.consecutiveDrops).toBe(3);
      expect(result.trend).toBe("declining");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("does NOT fail with only 2 consecutive drops when 3 required", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      // History: 90, 90, 85 — then current 80 = 2 consecutive drops
      writeHistory(tempDir, historyFromScores([90, 90, 85]));
      const result = checkTrendGating(tempDir, 80, 3);
      expect(result.shouldFail).toBe(false);
      expect(result.consecutiveDrops).toBe(2);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("does NOT fail when drops are non-consecutive (drop, rise, drop)", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      // History: 90, 80, 88 — then current 75
      // Sequence: 90→80 (drop), 80→88 (rise), 88→75 (drop)
      // Only 1 consecutive drop at the end
      writeHistory(tempDir, historyFromScores([90, 80, 88]));
      const result = checkTrendGating(tempDir, 75, 3);
      expect(result.shouldFail).toBe(false);
      expect(result.consecutiveDrops).toBe(1);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("consecutiveDrops count is accurate for 3-drop sequence", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      writeHistory(tempDir, historyFromScores([100, 90, 80]));
      const result = checkTrendGating(tempDir, 70, 3);
      expect(result.consecutiveDrops).toBe(3);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("shouldFail: true is set when consecutiveDrops reaches requiredDrops", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      writeHistory(tempDir, historyFromScores([80, 70, 60]));
      const result = checkTrendGating(tempDir, 50, 3);
      expect(result.shouldFail).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("works with custom consecutiveDropsRequired of 2", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      // History: 90, 80 (2 snapshots) — then current 70 = 2 consecutive drops
      writeHistory(tempDir, historyFromScores([90, 80]));
      const result = checkTrendGating(tempDir, 70, 2);
      expect(result.shouldFail).toBe(true);
      expect(result.consecutiveDrops).toBe(2);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("checkTrendGating — trend labels", () => {
  it("detects improving trend when every step goes up", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      writeHistory(tempDir, historyFromScores([70, 80, 85]));
      const result = checkTrendGating(tempDir, 90, 3);
      expect(result.trend).toBe("improving");
      expect(result.shouldFail).toBe(false);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("all scores equal is treated as stable (not declining)", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      writeHistory(tempDir, historyFromScores([80, 80, 80]));
      const result = checkTrendGating(tempDir, 80, 3);
      expect(result.shouldFail).toBe(false);
      expect(result.consecutiveDrops).toBe(0);
      // stable or improving — equal scores satisfy "every step >= previous"
      expect(["stable", "improving"]).toContain(result.trend);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("mixed pattern results in stable when last step is not a drop", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      // History: 80, 75, 78 — then current 78 (no drop at end, only 0 consecutive drops)
      writeHistory(tempDir, historyFromScores([80, 75, 78]));
      const result = checkTrendGating(tempDir, 78, 3);
      expect(result.shouldFail).toBe(false);
      expect(result.consecutiveDrops).toBe(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("checkTrendGating — scores array", () => {
  it("includes history scores and currentScore in scores array", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      writeHistory(tempDir, historyFromScores([70, 75, 80]));
      const result = checkTrendGating(tempDir, 85, 3);
      // Should be the 3 most-recent history scores + current
      expect(result.scores).toEqual([70, 75, 80, 85]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("uses only the last N history snapshots when history is longer", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-trend-test-"));
    try {
      // 5 snapshots in history, but only last 3 are used
      writeHistory(tempDir, historyFromScores([50, 60, 70, 75, 80]));
      const result = checkTrendGating(tempDir, 85, 3);
      expect(result.scores).toEqual([70, 75, 80, 85]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// formatTrendResult
// ---------------------------------------------------------------------------

describe("formatTrendResult", () => {
  it("returns string containing ✗ for a failure", () => {
    const result = checkTrendGating.length; // just to reference module (no-op)
    const failResult = {
      shouldFail: true,
      consecutiveDrops: 3,
      requiredDrops: 3,
      scores: [90, 80, 70, 60],
      message: "Score has dropped for 3 consecutive runs (90 → 80 → 70 → 60) — trend failure",
      trend: "declining" as const,
    };
    const output = formatTrendResult(failResult);
    expect(output).toContain("✗");
  });

  it("returns string containing ⚠ for declining but not yet failing", () => {
    const decliningResult = {
      shouldFail: false,
      consecutiveDrops: 2,
      requiredDrops: 3,
      scores: [90, 85, 80, 75],
      message: "Score dropping for 2 run(s) — 1 more drop will trigger failure",
      trend: "declining" as const,
    };
    const output = formatTrendResult(decliningResult);
    expect(output).toContain("⚠");
  });

  it("returns string containing ✓ for improving trend", () => {
    const improvingResult = {
      shouldFail: false,
      consecutiveDrops: 0,
      requiredDrops: 3,
      scores: [70, 75, 80, 85],
      message: "Score improving (70 → 75 → 80 → 85)",
      trend: "improving" as const,
    };
    const output = formatTrendResult(improvingResult);
    expect(output).toContain("✓");
  });

  it("returns string for stable/insufficient-data without ✗ or ✓", () => {
    const stableResult = {
      shouldFail: false,
      consecutiveDrops: 0,
      requiredDrops: 3,
      scores: [80],
      message: "Insufficient history for trend analysis",
      trend: "insufficient-data" as const,
    };
    const output = formatTrendResult(stableResult);
    expect(output).not.toContain("✗");
    expect(output).not.toContain("✓");
  });

  it("includes sparkline block characters in output", () => {
    const result = {
      shouldFail: false,
      consecutiveDrops: 0,
      requiredDrops: 3,
      scores: [70, 80, 90],
      message: "Score improving (70 → 80 → 90)",
      trend: "improving" as const,
    };
    const output = formatTrendResult(result);
    const sparklineChars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
    const containsSparkline = sparklineChars.some((ch) => output.includes(ch));
    expect(containsSparkline).toBe(true);
  });

  it("sparkline has correct number of characters matching scores length", () => {
    const scores = [60, 70, 80, 90];
    const result = {
      shouldFail: false,
      consecutiveDrops: 0,
      requiredDrops: 3,
      scores,
      message: "Score improving",
      trend: "improving" as const,
    };
    const output = formatTrendResult(result);
    // Extract the sparkline part after "Trend: "
    const trendMatch = output.match(/Trend: ([▁▂▃▄▅▆▇█]+)/);
    expect(trendMatch).not.toBeNull();
    expect(trendMatch![1].length).toBe(scores.length);
  });

  it("handles single data point gracefully (1-element scores)", () => {
    const result = {
      shouldFail: false,
      consecutiveDrops: 0,
      requiredDrops: 3,
      scores: [80],
      message: "Insufficient history for trend analysis",
      trend: "insufficient-data" as const,
    };
    expect(() => formatTrendResult(result)).not.toThrow();
    const output = formatTrendResult(result);
    const trendMatch = output.match(/Trend: ([▁▂▃▄▅▆▇█]+)/);
    expect(trendMatch).not.toBeNull();
    expect(trendMatch![1].length).toBe(1);
  });

  it("handles two data points gracefully (2-element scores)", () => {
    const result = {
      shouldFail: false,
      consecutiveDrops: 1,
      requiredDrops: 3,
      scores: [80, 70],
      message: "Score dropping for 1 run(s) — 2 more drops will trigger failure",
      trend: "declining" as const,
    };
    expect(() => formatTrendResult(result)).not.toThrow();
    const output = formatTrendResult(result);
    const trendMatch = output.match(/Trend: ([▁▂▃▄▅▆▇█]+)/);
    expect(trendMatch).not.toBeNull();
    expect(trendMatch![1].length).toBe(2);
  });
});

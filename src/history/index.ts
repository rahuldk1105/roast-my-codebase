/**
 * Historical health tracking - Track codebase health over time
 */

import fs from "fs";
import path from "path";
import { HealthScore, Finding } from "../types/index.js";
import { spawnSync } from "child_process";

export interface HealthSnapshot {
  timestamp: number;
  date: string;
  score: number;
  grade: string;
  totalFindings: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  categoryCounts: Record<string, number>;
  commitHash?: string;
  commitMessage?: string;
}

export interface HealthHistory {
  projectName: string;
  snapshots: HealthSnapshot[];
}

export interface TrendAnalysis {
  trend: "improving" | "declining" | "stable";
  scoreChange: number;
  periodDays: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  improvementRate: number; // score change per day
}

const HISTORY_FILE = ".roast-history.json";

/**
 * Load health history from file
 */
export function loadHistory(rootDir: string): HealthHistory | null {
  const historyPath = path.join(rootDir, HISTORY_FILE);

  if (!fs.existsSync(historyPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(historyPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Warning: Failed to load health history: ${error}`);
    return null;
  }
}

/**
 * Save health history to file
 */
export function saveHistory(rootDir: string, history: HealthHistory): void {
  const historyPath = path.join(rootDir, HISTORY_FILE);

  try {
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf-8");
  } catch (error) {
    console.warn(`Warning: Failed to save health history: ${error}`);
  }
}

/**
 * Create a health snapshot from current state
 */
export function createSnapshot(
  health: HealthScore,
  findings: Finding[],
  rootDir: string
): HealthSnapshot {
  // Get git commit info if available
  let commitHash: string | undefined;
  let commitMessage: string | undefined;

  try {
    const hashResult = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: "pipe",
    });

    if (hashResult.status === 0) {
      commitHash = hashResult.stdout.trim();

      const messageResult = spawnSync(
        "git",
        ["log", "-1", "--pretty=%B"],
        {
          cwd: rootDir,
          encoding: "utf-8",
          stdio: "pipe",
        }
      );

      if (messageResult.status === 0) {
        commitMessage = messageResult.stdout.trim().split("\n")[0]; // First line only
      }
    }
  } catch {
    // Not a git repo or git not available
  }

  // Count findings by category
  const categoryCounts: Record<string, number> = {};
  findings.forEach((finding) => {
    categoryCounts[finding.category] = (categoryCounts[finding.category] || 0) + 1;
  });

  return {
    timestamp: Date.now(),
    date: new Date().toISOString(),
    score: health.score,
    grade: health.grade,
    totalFindings: findings.length,
    criticalCount: findings.filter((f) => f.severity === "critical").length,
    warningCount: findings.filter((f) => f.severity === "warning").length,
    infoCount: findings.filter((f) => f.severity === "info").length,
    categoryCounts,
    commitHash,
    commitMessage,
  };
}

/**
 * Add snapshot to history
 */
export function addSnapshot(
  rootDir: string,
  projectName: string,
  snapshot: HealthSnapshot
): HealthHistory {
  let history = loadHistory(rootDir);

  if (!history) {
    history = {
      projectName,
      snapshots: [],
    };
  }

  // Add new snapshot
  history.snapshots.push(snapshot);

  // Keep only last 100 snapshots to avoid file bloat
  if (history.snapshots.length > 100) {
    history.snapshots = history.snapshots.slice(-100);
  }

  saveHistory(rootDir, history);

  return history;
}

/**
 * Analyze trend over a period
 */
export function analyzeTrend(
  history: HealthHistory,
  days: number = 30
): TrendAnalysis | null {
  if (history.snapshots.length < 2) {
    return null;
  }

  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  // Get snapshots within the period
  const recentSnapshots = history.snapshots.filter(
    (s) => s.timestamp >= cutoff
  );

  if (recentSnapshots.length < 2) {
    return null;
  }

  const scores = recentSnapshots.map((s) => s.score);
  const firstScore = recentSnapshots[0].score;
  const lastScore = recentSnapshots[recentSnapshots.length - 1].score;
  const scoreChange = lastScore - firstScore;

  const averageScore =
    scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const bestScore = Math.max(...scores);
  const worstScore = Math.min(...scores);

  const actualDays =
    (recentSnapshots[recentSnapshots.length - 1].timestamp -
      recentSnapshots[0].timestamp) /
    (24 * 60 * 60 * 1000);

  const improvementRate = actualDays > 0 ? scoreChange / actualDays : 0;

  let trend: "improving" | "declining" | "stable";
  if (scoreChange > 5) {
    trend = "improving";
  } else if (scoreChange < -5) {
    trend = "declining";
  } else {
    trend = "stable";
  }

  return {
    trend,
    scoreChange,
    periodDays: Math.round(actualDays),
    averageScore: Math.round(averageScore * 10) / 10,
    bestScore,
    worstScore,
    improvementRate: Math.round(improvementRate * 100) / 100,
  };
}

/**
 * Get snapshots for a time period
 */
export function getSnapshotsByPeriod(
  history: HealthHistory,
  days: number
): HealthSnapshot[] {
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  return history.snapshots.filter((s) => s.timestamp >= cutoff);
}

/**
 * Generate ASCII chart of health trend
 */
export function generateTrendChart(
  snapshots: HealthSnapshot[],
  width: number = 50,
  height: number = 10
): string {
  if (snapshots.length < 2) {
    return "Not enough data for chart";
  }

  const scores = snapshots.map((s) => s.score);
  const minScore = Math.min(...scores, 0);
  const maxScore = Math.max(...scores, 100);
  const range = maxScore - minScore;

  const lines: string[] = [];

  // Generate chart lines
  for (let i = height; i >= 0; i--) {
    const value = minScore + (range * i) / height;
    let line = `${Math.round(value).toString().padStart(3)} ┤`;

    for (let j = 0; j < width; j++) {
      const snapshotIndex = Math.floor((j / width) * snapshots.length);
      const snapshot = snapshots[snapshotIndex];
      const normalizedScore =
        ((snapshot.score - minScore) / range) * height;

      if (Math.abs(normalizedScore - i) < 0.5) {
        line += "●";
      } else if (normalizedScore > i) {
        line += " ";
      } else {
        line += " ";
      }
    }

    lines.push(line);
  }

  // Add x-axis
  const firstDate = new Date(snapshots[0].timestamp);
  const lastDate = new Date(snapshots[snapshots.length - 1].timestamp);

  const xAxis =
    "    └" +
    "─".repeat(width) +
    "→";
  lines.push(xAxis);

  const dateLabel =
    "     " +
    firstDate.toLocaleDateString().padEnd(width - 15) +
    lastDate.toLocaleDateString();
  lines.push(dateLabel);

  return lines.join("\n");
}

/**
 * Get category trend - which categories are improving/declining
 */
export function getCategoryTrends(
  history: HealthHistory,
  days: number = 30
): Record<string, number> {
  const recentSnapshots = getSnapshotsByPeriod(history, days);

  if (recentSnapshots.length < 2) {
    return {};
  }

  const firstSnapshot = recentSnapshots[0];
  const lastSnapshot = recentSnapshots[recentSnapshots.length - 1];

  const trends: Record<string, number> = {};

  // Compare first and last snapshots for each category
  const allCategories = new Set([
    ...Object.keys(firstSnapshot.categoryCounts),
    ...Object.keys(lastSnapshot.categoryCounts),
  ]);

  allCategories.forEach((category) => {
    const firstCount = firstSnapshot.categoryCounts[category] || 0;
    const lastCount = lastSnapshot.categoryCounts[category] || 0;
    trends[category] = lastCount - firstCount;
  });

  return trends;
}

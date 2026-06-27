/**
 * Trend gating — fail CI only after N consecutive score drops
 */

import chalk from "chalk";
import { loadHistory } from "../history/index.js";

export interface TrendGatingResult {
  shouldFail: boolean;
  consecutiveDrops: number;
  requiredDrops: number;
  scores: number[]; // last N scores (history) + currentScore
  message: string;
  trend: "declining" | "improving" | "stable" | "insufficient-data";
}

/**
 * Produce a mini sparkline from an array of numeric scores.
 * Uses 8 Unicode block characters to visualise relative magnitude.
 * Gracefully handles 1- or 2-element arrays.
 */
function sparkline(scores: number[]): string {
  const blocks = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  return scores
    .map((s) => blocks[Math.floor(((s - min) / range) * 7)])
    .join("");
}

/**
 * Determine whether the score has been consistently declining over the last
 * `consecutiveDropsRequired` snapshots (plus the current run).
 *
 * @param rootDir                  - Project root (where .roast-history.json lives)
 * @param currentScore             - Score produced by the current run
 * @param consecutiveDropsRequired - How many consecutive drops must be observed (default 3)
 */
export function checkTrendGating(
  rootDir: string,
  currentScore: number,
  consecutiveDropsRequired: number = 3
): TrendGatingResult {
  const history = loadHistory(rootDir);

  // Not enough history to perform trend analysis
  if (!history || history.snapshots.length < consecutiveDropsRequired) {
    return {
      shouldFail: false,
      consecutiveDrops: 0,
      requiredDrops: consecutiveDropsRequired,
      scores: [currentScore],
      message: "Insufficient history for trend analysis",
      trend: "insufficient-data",
    };
  }

  // Take the last `consecutiveDropsRequired` snapshots from history
  const recent = history.snapshots.slice(-consecutiveDropsRequired);

  // Full sequence to examine: historical scores + current
  const scores = [...recent.map((s) => s.score), currentScore];

  // Count consecutive drops from the END of the sequence
  // A "drop" at position i means scores[i] < scores[i-1]
  let consecutiveDrops = 0;
  for (let i = scores.length - 1; i >= 1; i--) {
    if (scores[i] < scores[i - 1]) {
      consecutiveDrops++;
    } else {
      break;
    }
  }

  const shouldFail = consecutiveDrops >= consecutiveDropsRequired;

  // Determine overall trend label
  let trend: TrendGatingResult["trend"];
  if (consecutiveDrops >= 2) {
    trend = "declining";
  } else {
    // Check if every consecutive step improved
    const allImproving = scores.every(
      (s, i) => i === 0 || s >= scores[i - 1]
    );
    trend = allImproving ? "improving" : "stable";
  }

  // Build human-readable message
  let message: string;
  if (shouldFail) {
    message = `Score has dropped for ${consecutiveDrops} consecutive runs (${scores.join(" → ")}) — trend failure`;
  } else if (consecutiveDrops >= 1) {
    const remaining = consecutiveDropsRequired - consecutiveDrops;
    message = `Score dropping for ${consecutiveDrops} run(s) — ${remaining} more drop${remaining === 1 ? "" : "s"} will trigger failure`;
  } else if (trend === "improving") {
    message = `Score improving (${scores.join(" → ")})`;
  } else {
    message = "Score stable";
  }

  return {
    shouldFail,
    consecutiveDrops,
    requiredDrops: consecutiveDropsRequired,
    scores,
    message,
    trend,
  };
}

/**
 * Format a TrendGatingResult as a chalk-coloured string for console output.
 * Includes a visual sparkline and contextual icon.
 */
export function formatTrendResult(result: TrendGatingResult): string {
  const spark = sparkline(result.scores);
  const sparkSuffix = `\n  Trend: ${spark} (last ${result.scores.length} run${result.scores.length === 1 ? "" : "s"})`;

  if (result.shouldFail) {
    return (
      chalk.red(`✗ TREND FAILURE: ${result.message}`) +
      chalk.dim(`\n  Scores: ${result.scores.join(" → ")}`) +
      chalk.dim(sparkSuffix)
    );
  }

  if (result.trend === "declining") {
    return chalk.yellow(`⚠ ${result.message}`) + chalk.dim(sparkSuffix);
  }

  if (result.trend === "improving") {
    return chalk.green(`✓ ${result.message}`) + chalk.dim(sparkSuffix);
  }

  // stable or insufficient-data
  return chalk.dim(`  ${result.message}`) + chalk.dim(sparkSuffix);
}

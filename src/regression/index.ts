/**
 * Regression detection - fail CI if health score dropped since last snapshot
 */

import chalk from "chalk";
import { loadHistory } from "../history/index.js";

export interface RegressionResult {
  isRegression: boolean;
  previousScore: number | null;
  currentScore: number;
  scoreDelta: number;
  previousCommit?: string;
  message: string;
}

/**
 * Check whether the current score is a regression compared to the last tracked snapshot.
 *
 * @param rootDir     - Root directory of the project (where .roast-history.json lives)
 * @param currentScore - The score produced by the current run
 * @param tolerance   - How many points the score is allowed to drop before it is a regression (default 0)
 */
export function checkRegression(
  rootDir: string,
  currentScore: number,
  tolerance: number
): RegressionResult {
  const history = loadHistory(rootDir);

  if (!history || history.snapshots.length < 1) {
    return {
      isRegression: false,
      previousScore: null,
      currentScore,
      scoreDelta: 0,
      message: "No history to compare against",
    };
  }

  const lastSnapshot = history.snapshots[history.snapshots.length - 1];
  const previousScore = lastSnapshot.score;
  const previousCommit = lastSnapshot.commitHash;

  const scoreDelta = currentScore - previousScore;
  const isRegression = scoreDelta < -tolerance;

  let message: string;
  if (isRegression) {
    message = `Score dropped ${Math.abs(scoreDelta)} points (${previousScore} → ${currentScore}) — exceeds tolerance of ${tolerance}`;
  } else if (scoreDelta < 0) {
    message = `Score dropped ${Math.abs(scoreDelta)} points but within tolerance (${tolerance})`;
  } else {
    message = `Score ${scoreDelta >= 0 ? "improved" : "unchanged"} (${previousScore} → ${currentScore})`;
  }

  return {
    isRegression,
    previousScore,
    currentScore,
    scoreDelta,
    previousCommit,
    message,
  };
}

/**
 * Format a RegressionResult as a chalk-colored string suitable for console output.
 */
export function formatRegressionOutput(result: RegressionResult): string {
  if (result.isRegression) {
    return chalk.red(`✗ REGRESSION: ${result.message}`);
  }

  if (result.previousScore !== null && result.scoreDelta < 0) {
    return chalk.yellow(`⚠ ${result.message}`);
  }

  return chalk.green(`✓ ${result.message}`);
}

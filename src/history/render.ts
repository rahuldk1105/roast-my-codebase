/**
 * Render historical health data
 */

import chalk from "chalk";
import { HealthHistory, TrendAnalysis, HealthSnapshot, analyzeTrend, generateTrendChart, getCategoryTrends } from "./index.js";

/**
 * Render complete history report
 */
export function renderHistoryReport(history: HealthHistory, days: number = 30): string {
  const output: string[] = [];

  output.push(chalk.bold.cyan("\n📊 Health History Report\n"));
  output.push(chalk.dim("─".repeat(60)));
  output.push("");

  // Project info
  output.push(chalk.white(`Project: ${history.projectName}`));
  output.push(
    chalk.white(`Total snapshots: ${history.snapshots.length}`)
  );
  output.push("");

  if (history.snapshots.length === 0) {
    output.push(chalk.yellow("No health data recorded yet."));
    output.push(
      chalk.dim("Run with --track flag to start tracking health over time.")
    );
    return output.join("\n");
  }

  // Latest snapshot
  const latest = history.snapshots[history.snapshots.length - 1];
  output.push(chalk.bold("Current Health"));
  output.push(
    `  Score: ${getScoreColor(latest.score)}${latest.score}/100${chalk.reset()} (${latest.grade})`
  );
  output.push(`  Findings: ${latest.totalFindings}`);
  output.push(
    `  ${chalk.red("●")} ${latest.criticalCount} critical  ${chalk.yellow("●")} ${latest.warningCount} warnings  ${chalk.blue("●")} ${latest.infoCount} info`
  );
  if (latest.commitHash) {
    output.push(chalk.dim(`  Commit: ${latest.commitHash}`));
  }
  output.push("");

  // Trend analysis
  const trend = analyzeTrend(history, days);
  if (trend) {
    output.push(chalk.bold(`Trend Analysis (Last ${trend.periodDays} days)`));
    output.push("");

    // Trend indicator
    const trendIcon = getTrendIcon(trend.trend);
    const trendColor = getTrendColor(trend.trend);
    output.push(
      `  ${trendIcon} ${trendColor(trend.trend.toUpperCase())} ${chalk.dim(`(${trend.scoreChange > 0 ? "+" : ""}${trend.scoreChange} points)`)}`
    );
    output.push("");

    // Statistics
    output.push(chalk.white("  Statistics:"));
    output.push(`    Average score: ${trend.averageScore}/100`);
    output.push(`    Best score: ${chalk.green(trend.bestScore)}/100`);
    output.push(`    Worst score: ${chalk.red(trend.worstScore)}/100`);
    output.push(
      `    Improvement rate: ${trend.improvementRate > 0 ? chalk.green("+") : chalk.red("")}${trend.improvementRate} points/day`
    );
    output.push("");

    // Visual chart
    output.push(chalk.bold("  Score Trend"));
    output.push("");
    const recentSnapshots = history.snapshots.filter(
      (s) => s.timestamp >= Date.now() - days * 24 * 60 * 60 * 1000
    );
    const chart = generateTrendChart(recentSnapshots, 50, 8);
    output.push(
      chart
        .split("\n")
        .map((line) => "  " + line)
        .join("\n")
    );
    output.push("");

    // Category trends
    const categoryTrends = getCategoryTrends(history, days);
    const improving = Object.entries(categoryTrends)
      .filter(([_, change]) => change < 0)
      .sort(([_, a], [__, b]) => a - b);

    const declining = Object.entries(categoryTrends)
      .filter(([_, change]) => change > 0)
      .sort(([_, a], [__, b]) => b - a);

    if (improving.length > 0 || declining.length > 0) {
      output.push(chalk.bold("  Category Changes"));
      output.push("");

      if (improving.length > 0) {
        output.push(chalk.green("  ↓ Improving:"));
        improving.slice(0, 5).forEach(([category, change]) => {
          output.push(
            `    ${chalk.green("✓")} ${category}: ${chalk.green(change)} issues`
          );
        });
        if (improving.length > 5) {
          output.push(chalk.dim(`    ...and ${improving.length - 5} more`));
        }
        output.push("");
      }

      if (declining.length > 0) {
        output.push(chalk.red("  ↑ Declining:"));
        declining.slice(0, 5).forEach(([category, change]) => {
          output.push(
            `    ${chalk.red("✗")} ${category}: ${chalk.red("+" + change)} issues`
          );
        });
        if (declining.length > 5) {
          output.push(chalk.dim(`    ...and ${declining.length - 5} more`));
        }
        output.push("");
      }
    }
  }

  // Recent snapshots
  const recentCount = Math.min(10, history.snapshots.length);
  output.push(chalk.bold(`Recent Snapshots (Last ${recentCount})`));
  output.push("");

  history.snapshots
    .slice(-recentCount)
    .reverse()
    .forEach((snapshot) => {
      const date = new Date(snapshot.timestamp);
      const dateStr = date.toLocaleString();
      const scoreColor = getScoreColor(snapshot.score);

      output.push(
        `  ${dateStr} - ${scoreColor}${snapshot.score}${chalk.reset()} (${snapshot.grade}) - ${snapshot.totalFindings} issues`
      );

      if (snapshot.commitHash) {
        output.push(
          chalk.dim(`    ${snapshot.commitHash}: ${snapshot.commitMessage}`)
        );
      }
    });

  output.push("");
  output.push(chalk.dim("─".repeat(60)));
  output.push("");

  return output.join("\n");
}

/**
 * Render compact trend summary
 */
export function renderTrendSummary(history: HealthHistory, days: number = 7): string {
  const trend = analyzeTrend(history, days);

  if (!trend) {
    return chalk.dim("No trend data available yet");
  }

  const trendIcon = getTrendIcon(trend.trend);
  const trendColor = getTrendColor(trend.trend);
  const changeStr =
    trend.scoreChange > 0
      ? chalk.green(`+${trend.scoreChange}`)
      : trend.scoreChange < 0
      ? chalk.red(`${trend.scoreChange}`)
      : chalk.dim("±0");

  return `${trendIcon} ${trendColor(trend.trend)} (${changeStr} over ${trend.periodDays} days)`;
}

/**
 * Get color for score
 */
function getScoreColor(score: number): (text: string) => string {
  if (score >= 90) return chalk.green;
  if (score >= 80) return chalk.greenBright;
  if (score >= 70) return chalk.yellow;
  if (score >= 60) return chalk.hex("#FFA500"); // orange
  return chalk.red;
}

/**
 * Get icon for trend
 */
function getTrendIcon(trend: "improving" | "declining" | "stable"): string {
  switch (trend) {
    case "improving":
      return chalk.green("↗");
    case "declining":
      return chalk.red("↘");
    case "stable":
      return chalk.blue("→");
  }
}

/**
 * Get color function for trend
 */
function getTrendColor(
  trend: "improving" | "declining" | "stable"
): (text: string) => string {
  switch (trend) {
    case "improving":
      return chalk.green;
    case "declining":
      return chalk.red;
    case "stable":
      return chalk.blue;
  }
}

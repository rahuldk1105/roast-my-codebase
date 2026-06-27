import chalk from "chalk";
import boxen from "boxen";
import { RoastReport } from "../types/index.js";
import { renderAsciiGrade } from "./ascii-art.js";

export { renderJsonReport } from "./json.js";
export { generateBadgeSvg, saveBadge } from "./badge.js";
export { renderAsciiGrade, getAsciiGrade } from "./ascii-art.js";
export { renderMarkdownReport } from "./markdown.js";
export { renderHtmlReport, saveHtmlReport } from "./html.js";
export { detectPRContext, postPRComment, formatPRComment } from "./pr-comment.js";
export { renderSarifReport, saveSarifReport } from "./sarif.js";

export function renderReport(report: RoastReport, options?: { ascii?: boolean }): string {
  const sections: string[] = [];

  // ASCII art grade (if enabled)
  if (options?.ascii) {
    sections.push(renderAsciiGrade(report.health));
    sections.push("");
  }

  // Header
  sections.push(
    boxen(chalk.bold.white("  Roast My Codebase  ") + "  " + flame(), {
      padding: { top: 0, bottom: 0, left: 2, right: 2 },
      borderStyle: "double",
      borderColor: "yellow",
      textAlignment: "center",
    })
  );

  sections.push("");

  // Project info
  sections.push(chalk.dim(`  Project: ${report.projectName}`));
  sections.push("");

  // Health Score
  const scoreColor = getScoreColor(report.health.score);
  sections.push(
    chalk.bold("  Health Score: ") +
      scoreColor(
        `${report.health.score}/100  ${report.health.grade}  ${report.health.label}`
      )
  );
  sections.push("");
  sections.push(renderHealthBar(report.health.score));
  sections.push("");

  // Stats
  sections.push(chalk.bold.white("  Project Summary"));
  sections.push(chalk.dim("  " + "─".repeat(40)));
  sections.push(
    `  ${chalk.cyan("Files Scanned")}      ${report.stats.sourceFiles.toLocaleString()}`
  );
  sections.push(
    `  ${chalk.cyan("Total Files")}        ${report.stats.totalFiles.toLocaleString()}`
  );
  sections.push(
    `  ${chalk.cyan("Lines of Code")}      ${report.stats.totalLines.toLocaleString()}`
  );
  sections.push(
    `  ${chalk.cyan("Dependencies")}       ${report.stats.dependencies}`
  );
  sections.push(
    `  ${chalk.cyan("Dev Dependencies")}   ${report.stats.devDependencies}`
  );
  sections.push("");

  // Findings summary
  const warnings = report.findings.filter((f) => f.severity === "warning");
  const criticals = report.findings.filter((f) => f.severity === "critical");
  const infos = report.findings.filter((f) => f.severity === "info");

  if (criticals.length > 0 || warnings.length > 0 || infos.length > 0) {
    sections.push(chalk.bold.white("  Findings"));
    sections.push(chalk.dim("  " + "─".repeat(40)));

    if (criticals.length > 0) {
      sections.push(
        `  ${chalk.red("●")} ${chalk.red.bold(`${criticals.length} critical`)}`
      );
    }
    if (warnings.length > 0) {
      sections.push(
        `  ${chalk.yellow("●")} ${chalk.yellow(`${warnings.length} warnings`)}`
      );
    }
    if (infos.length > 0) {
      sections.push(`  ${chalk.blue("●")} ${chalk.blue(`${infos.length} info`)}`);
    }
    sections.push("");

    // Key findings detail
    const keyFindings = [...criticals, ...warnings].slice(0, 8);
    for (const finding of keyFindings) {
      const icon =
        finding.severity === "critical" ? chalk.red("✗") : chalk.yellow("⚠");
      sections.push(`  ${icon} ${chalk.white(finding.message)}`);
    }
    sections.push("");
  }

  // Roasts
  if (report.roasts.length > 0) {
    sections.push(
      boxen(chalk.bold.yellow(" Roast Time ") + " " + flame(), {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderStyle: "round",
        borderColor: "yellow",
      })
    );
    sections.push("");

    for (const roast of report.roasts) {
      sections.push(`  ${chalk.bold.white(roast.target)}`);
      sections.push(`  ${chalk.yellow(roast.message)}`);
      sections.push("");
    }
  }

  // Fix Suggestions
  if (report.fixes && report.fixes.length > 0) {
    sections.push(
      boxen(chalk.bold.cyan(" Fix Suggestions ") + " 📝", {
        padding: { top: 0, bottom: 0, left: 1, right: 1 },
        borderStyle: "round",
        borderColor: "cyan",
      })
    );
    sections.push("");

    for (const fix of report.fixes) {
      const target = fix.finding.file || fix.finding.category;
      sections.push(`  ${chalk.cyan("📝")} ${chalk.dim(target)}`);
      sections.push(`     ${chalk.white(fix.suggestion)}`);
      sections.push("");
    }
  }

  // Verdict
  sections.push(chalk.dim("  " + "─".repeat(40)));
  sections.push("");
  sections.push(chalk.bold.white("  Verdict"));
  sections.push("");
  sections.push(`  ${chalk.italic(report.verdict)}`);
  sections.push("");
  sections.push(
    chalk.dim("  ─────────────────────────────────────────")
  );
  sections.push(
    chalk.dim("  roast-my-codebase · github.com/your-username/roast-my-codebase")
  );
  sections.push("");

  return sections.join("\n");
}

function flame(): string {
  return chalk.redBright("🔥");
}

function getScoreColor(score: number) {
  if (score >= 90) return chalk.green;
  if (score >= 80) return chalk.greenBright;
  if (score >= 70) return chalk.yellow;
  if (score >= 60) return chalk.rgb(255, 165, 0);
  return chalk.red;
}

function renderHealthBar(score: number): string {
  const width = 30;
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;

  const color = getScoreColor(score);
  const bar =
    color("█".repeat(filled)) + chalk.dim("░".repeat(empty));

  return `  [${bar}]`;
}

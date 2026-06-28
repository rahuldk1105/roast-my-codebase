import chalk from "chalk";
import boxen from "boxen";
import { RoastReport } from "../types/index.js";
import { renderAsciiGrade } from "./ascii-art.js";
import { generateOpeningLine } from "../roasts/index.js";

export { renderJsonReport } from "./json.js";
export { generateBadgeSvg, saveBadge } from "./badge.js";
export { renderAsciiGrade, getAsciiGrade } from "./ascii-art.js";
export { renderMarkdownReport } from "./markdown.js";
export { renderHtmlReport, saveHtmlReport } from "./html.js";
export { detectPRContext, postPRComment, formatPRComment } from "./pr-comment.js";
export { renderSarifReport, saveSarifReport } from "./sarif.js";
export { renderJUnitReport, saveJUnitReport } from "./junit.js";
export { buildFolderTree, renderHotmap } from "./hotmap.js";
export type { FolderNode } from "./hotmap.js";
export { isGitHubActions, writeGitHubStepSummary } from "./github-summary.js";
export { calculateScoreBreakdown } from '../scoring/breakdown.js';
export type { ScoreBreakdown, CategoryScore } from '../scoring/breakdown.js';
export { saveAllReports } from './output-dir.js';
export type { OutputDirResult } from './output-dir.js';

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

  // Opening line (only shown when score < 85)
  const openingLine = generateOpeningLine(report.health.score, report.findings.length);
  if (openingLine) {
    sections.push(chalk.italic.dim(`  ${openingLine}`));
    sections.push('');
  }

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

  // Map scanner finding categories to roast categories (roasts.ts may group multiple scanner
  // categories under one roast category, e.g. "dependencies" covers "unused-deps").
  const FINDING_TO_ROAST_CATEGORY: Record<string, string> = {
    "unused-deps": "dependencies",
    "nextjs-metadata": "framework",
    "nextjs-client-server": "framework",
    "react-error-boundary": "framework",
    "secrets": "security",
    "env-in-git": "security",
    "eval-usage": "security",
    "npm-audit": "npm-audit",
    "dep-outdated": "dep-outdated",
    "ruby-style": "ruby-issues",
    "php-smell": "php-issues",
    "swift-async": "swift-issues",
    "kotlin-coroutine": "kotlin-issues",
    "db-n-plus-one": "database",
    "db-sql-injection": "database",
    "db-over-fetch": "database",
    "db-destructive": "database",
  };

  // Build roast lookup maps for inline display
  const roastByFile = new Map<string, string>();
  const roastByCategory = new Map<string, string>();
  for (const roast of report.roasts) {
    if (roast.target === "codebase") continue;
    roastByCategory.set(roast.category, roast.message);
    // Looks like a file path (has / or dot without spaces)
    if (roast.target.includes("/") || (roast.target.includes(".") && !roast.target.includes(" "))) {
      roastByFile.set(roast.target, roast.message);
    }
  }

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

    // Key findings with inline roast commentary
    const shownRoastKeys = new Set<string>();
    const keyFindings = [...criticals, ...warnings].slice(0, 8);
    for (const finding of keyFindings) {
      const icon =
        finding.severity === "critical" ? chalk.red("✗") : chalk.yellow("⚠");
      sections.push(`  ${icon} ${chalk.white(finding.message)}`);

      // Try file-specific roast first, then direct category, then aliased category
      let roastMsg: string | undefined;
      let roastKey: string | undefined;

      if (finding.file && roastByFile.has(finding.file)) {
        roastKey = `file:${finding.file}`;
        if (!shownRoastKeys.has(roastKey)) {
          roastMsg = roastByFile.get(finding.file);
        }
      }
      if (!roastMsg) {
        const resolvedCategory = FINDING_TO_ROAST_CATEGORY[finding.category] ?? finding.category;
        roastKey = `cat:${resolvedCategory}`;
        if (!shownRoastKeys.has(roastKey)) {
          roastMsg = roastByCategory.get(resolvedCategory);
        }
      }
      if (roastMsg && roastKey) {
        sections.push(`     ${chalk.italic.dim(roastMsg)}`);
        shownRoastKeys.add(roastKey);
      }
    }
    sections.push("");
  }

  // Codebase-level combo roast as a brief coda
  const comboRoast = report.roasts.find((r) => r.target === "codebase");
  if (comboRoast) {
    sections.push(chalk.italic.yellow(`  ${comboRoast.message}`));
    sections.push("");
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

  // Share CTA
  const tweetText = encodeURIComponent(
    `My codebase just got roasted 🔥\n\nHealth Score: ${report.health.score}/100 ${report.health.grade} — ${report.health.label}\n\n"${report.verdict}"\n\nroast yours 👇`
  );
  const tweetUrl = `https://x.com/intent/tweet?text=${tweetText}&url=https://github.com/rahuldk1105/roast-my-codebase`;
  sections.push(chalk.dim("  " + "─".repeat(40)));
  sections.push("");
  sections.push(`  ${chalk.bold("Share your roast")} ${chalk.dim("→")} ${chalk.cyan(tweetUrl)}`);
  sections.push("");
  sections.push(
    chalk.dim("  roast-my-codebase · github.com/rahuldk1105/roast-my-codebase")
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

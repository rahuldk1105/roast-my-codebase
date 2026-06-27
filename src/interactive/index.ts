/**
 * Interactive mode - Walk users through fixing issues one by one
 */

import { confirm, select } from "@inquirer/prompts";
import chalk from "chalk";
import { Finding, RoastReport } from "../types/index.js";
import { applyAutoFix } from "./fixes.js";

export interface InteractiveSession {
  totalFindings: number;
  fixedCount: number;
  skippedCount: number;
  errorCount: number;
}

/**
 * Run interactive mode - guide user through fixing issues
 */
export async function runInteractiveMode(
  report: RoastReport,
  rootDir: string,
  dryRun: boolean = false
): Promise<InteractiveSession> {
  const session: InteractiveSession = {
    totalFindings: 0,
    fixedCount: 0,
    skippedCount: 0,
    errorCount: 0,
  };

  console.log(chalk.bold.cyan("\n🔧 Interactive Fix Mode\n"));
  console.log(chalk.dim("Let's fix these issues together!\n"));

  // Filter findings that have fix suggestions
  const fixableFindings = report.findings.filter(
    (f) => report.fixes?.some((fix) => fix.findingId === f.id)
  );

  const nonFixableFindings = report.findings.filter(
    (f) => !report.fixes?.some((fix) => fix.findingId === f.id)
  );

  session.totalFindings = fixableFindings.length;

  if (fixableFindings.length === 0) {
    console.log(chalk.green("✓ No fixable issues found!\n"));
    if (nonFixableFindings.length > 0) {
      console.log(
        chalk.yellow(
          `⚠ ${nonFixableFindings.length} issues require manual fixes.\n`
        )
      );
    }
    return session;
  }

  console.log(
    chalk.white(
      `Found ${chalk.bold(fixableFindings.length)} fixable issues.\n`
    )
  );

  // Group findings by severity
  const critical = fixableFindings.filter((f) => f.severity === "critical");
  const warnings = fixableFindings.filter((f) => f.severity === "warning");
  const info = fixableFindings.filter((f) => f.severity === "info");

  console.log(chalk.red(`  🔴 ${critical.length} critical`));
  console.log(chalk.yellow(`  ⚠️  ${warnings.length} warnings`));
  console.log(chalk.blue(`  ℹ️  ${info.length} info\n`));

  // Ask if user wants to continue
  const shouldContinue = await confirm({
    message: "Start fixing issues?",
    default: true,
  });

  if (!shouldContinue) {
    console.log(chalk.dim("\nExiting interactive mode.\n"));
    return session;
  }

  // Process findings in severity order
  const orderedFindings = [...critical, ...warnings, ...info];

  for (let i = 0; i < orderedFindings.length; i++) {
    const finding = orderedFindings[i];
    const fix = report.fixes?.find((f) => f.findingId === finding.id);

    if (!fix) continue;

    console.log(chalk.dim(`\n─────────────────────────────────────────`));
    console.log(
      chalk.white(
        `Issue ${i + 1}/${orderedFindings.length} - ${getSeverityIcon(finding.severity)}`
      )
    );
    console.log(chalk.dim(`─────────────────────────────────────────\n`));

    // Display finding details
    console.log(chalk.bold(finding.message));
    if (finding.file) {
      console.log(chalk.dim(`  File: ${finding.file}`));
    }
    if (finding.detail) {
      console.log(chalk.dim(`  Detail: ${finding.detail}`));
    }
    console.log();

    // Display fix suggestion
    console.log(chalk.cyan("💡 Fix suggestion:"));
    console.log(chalk.white(`  ${fix.suggestion}`));
    console.log();

    // Check if auto-fixable
    const isAutoFixable = fix.autoFixable || false;

    if (isAutoFixable) {
      console.log(chalk.green("✓ This can be fixed automatically!\n"));

      const action = await select({
        message: "What would you like to do?",
        choices: [
          {
            name: dryRun
              ? "Preview fix (dry run)"
              : "Apply fix automatically",
            value: "apply",
            description: dryRun
              ? "Show what would be fixed"
              : "Let the tool fix this for you",
          },
          {
            name: "Show details",
            value: "details",
            description: "See more information about this issue",
          },
          {
            name: "Skip",
            value: "skip",
            description: "Leave this for later",
          },
          {
            name: "Exit interactive mode",
            value: "exit",
            description: "Stop fixing issues",
          },
        ],
      });

      if (action === "exit") {
        console.log(
          chalk.dim(`\nFixed ${session.fixedCount} issues. Goodbye!\n`)
        );
        break;
      }

      if (action === "skip") {
        session.skippedCount++;
        console.log(chalk.yellow("⏭  Skipped\n"));
        continue;
      }

      if (action === "details") {
        await showFindingDetails(finding, fix);
        i--; // Repeat this finding
        continue;
      }

      if (action === "apply") {
        try {
          const result = await applyAutoFix(finding, fix, rootDir, dryRun);

          if (result.success) {
            session.fixedCount++;
            if (dryRun) {
              console.log(chalk.green("\n✓ Preview:"));
              console.log(chalk.dim(result.message));
            } else {
              console.log(chalk.green(`\n✓ ${result.message}`));
            }
          } else {
            session.errorCount++;
            console.log(chalk.red(`\n✗ ${result.message}`));
          }
        } catch (error) {
          session.errorCount++;
          console.log(
            chalk.red(
              `\n✗ Failed to apply fix: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      }
    } else {
      // Manual fix required
      console.log(
        chalk.yellow("⚠ This requires manual intervention.\n")
      );

      const action = await select({
        message: "What would you like to do?",
        choices: [
          {
            name: "Mark as done (I fixed it manually)",
            value: "done",
            description: "You've fixed this issue yourself",
          },
          {
            name: "Show details",
            value: "details",
            description: "See more information about this issue",
          },
          {
            name: "Skip",
            value: "skip",
            description: "Leave this for later",
          },
          {
            name: "Exit interactive mode",
            value: "exit",
            description: "Stop fixing issues",
          },
        ],
      });

      if (action === "exit") {
        console.log(
          chalk.dim(`\nFixed ${session.fixedCount} issues. Goodbye!\n`)
        );
        break;
      }

      if (action === "skip") {
        session.skippedCount++;
        console.log(chalk.yellow("⏭  Skipped\n"));
        continue;
      }

      if (action === "details") {
        await showFindingDetails(finding, fix);
        i--; // Repeat this finding
        continue;
      }

      if (action === "done") {
        session.fixedCount++;
        console.log(chalk.green("✓ Marked as done\n"));
      }
    }
  }

  // Summary
  console.log(chalk.dim("\n─────────────────────────────────────────"));
  console.log(chalk.bold.cyan("\n📊 Interactive Session Summary\n"));
  console.log(chalk.white(`  Total issues: ${session.totalFindings}`));
  console.log(chalk.green(`  ✓ Fixed: ${session.fixedCount}`));
  console.log(chalk.yellow(`  ⏭  Skipped: ${session.skippedCount}`));
  if (session.errorCount > 0) {
    console.log(chalk.red(`  ✗ Errors: ${session.errorCount}`));
  }
  console.log();

  if (session.fixedCount > 0 && !dryRun) {
    console.log(
      chalk.green(`🎉 Great work! You've improved your codebase.\n`)
    );
  }

  return session;
}

/**
 * Show detailed information about a finding
 */
async function showFindingDetails(finding: Finding, fix: any): Promise<void> {
  console.log(chalk.dim("\n─────────────────────────────────────────"));
  console.log(chalk.bold.cyan("📋 Detailed Information\n"));

  console.log(chalk.white("Finding:"));
  console.log(`  ID: ${chalk.dim(finding.id)}`);
  console.log(`  Category: ${chalk.dim(finding.category)}`);
  console.log(`  Severity: ${getSeverityBadge(finding.severity)}`);
  if (finding.file) {
    console.log(`  File: ${chalk.dim(finding.file)}`);
  }
  console.log();

  console.log(chalk.white("Message:"));
  console.log(`  ${finding.message}`);
  if (finding.detail) {
    console.log();
    console.log(chalk.white("Details:"));
    console.log(`  ${finding.detail}`);
  }
  console.log();

  console.log(chalk.white("Fix Suggestion:"));
  console.log(`  ${fix.suggestion}`);
  console.log();

  if (fix.command) {
    console.log(chalk.white("Command:"));
    console.log(chalk.dim(`  ${fix.command}`));
    console.log();
  }

  await confirm({
    message: "Press Enter to continue",
    default: true,
  });
}

/**
 * Get severity icon
 */
function getSeverityIcon(severity: string): string {
  switch (severity) {
    case "critical":
      return chalk.red("🔴 Critical");
    case "warning":
      return chalk.yellow("⚠️  Warning");
    case "info":
      return chalk.blue("ℹ️  Info");
    default:
      return severity;
  }
}

/**
 * Get severity badge
 */
function getSeverityBadge(severity: string): string {
  switch (severity) {
    case "critical":
      return chalk.bgRed.white.bold(" CRITICAL ");
    case "warning":
      return chalk.bgYellow.black.bold(" WARNING ");
    case "info":
      return chalk.bgBlue.white.bold(" INFO ");
    default:
      return severity;
  }
}

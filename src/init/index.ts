/**
 * Interactive wizard to generate .roastrc.json
 */

import { select, confirm, input, checkbox } from "@inquirer/prompts";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { RoastConfig } from "../config/index.js";

export interface WizardAnswers {
  threshold: number;
  largeFileThreshold: number;
  disabledScanners: string[];
  ignorePatterns: string[];
  aiEnabled: boolean;
}

/**
 * Pure helper that builds a RoastConfig from wizard answers.
 * Exported for testing purposes.
 */
export function buildConfig(answers: WizardAnswers): RoastConfig {
  const { largeFileThreshold, disabledScanners, ignorePatterns, aiEnabled } =
    answers;

  const config: RoastConfig = {
    thresholds: {
      largeFile: largeFileThreshold,
      extremeFile: largeFileThreshold * 4,
    },
    scanners: {
      disabled: disabledScanners,
    },
    ignore: ignorePatterns,
    ...(aiEnabled ? { ai: { enabled: true } } : {}),
  };

  return config;
}

/**
 * Run the interactive init wizard to generate .roastrc.json
 */
export async function runInitWizard(rootDir: string): Promise<void> {
  console.log(chalk.bold.cyan("\n  roast-my-codebase config wizard\n"));
  console.log(
    chalk.dim("  Let's create a .roastrc.json tailored to your project.\n")
  );

  // ── 1. Health score threshold ──────────────────────────────────────────────
  const thresholdChoice = await select({
    message: "What minimum health score should fail CI? (default: 70)",
    choices: [
      {
        name: "60 — lenient (good for legacy projects)",
        value: "60",
      },
      {
        name: "70 — recommended",
        value: "70",
      },
      {
        name: "80 — strict",
        value: "80",
      },
      {
        name: "Enter custom value",
        value: "custom",
      },
    ],
    default: "70",
  });

  let threshold: number;
  if (thresholdChoice === "custom") {
    const raw = await input({
      message: "Enter minimum health score (1-100):",
      default: "70",
      validate: (val) => {
        const n = parseInt(val, 10);
        if (isNaN(n) || n < 1 || n > 100) {
          return "Please enter a number between 1 and 100";
        }
        return true;
      },
    });
    threshold = parseInt(raw, 10);
  } else {
    threshold = parseInt(thresholdChoice, 10);
  }

  // ── 2. Large file threshold ────────────────────────────────────────────────
  const largeFileChoice = await select({
    message: "What line count should flag a file as \"large\"?",
    choices: [
      {
        name: "500 lines (default)",
        value: "500",
      },
      {
        name: "300 lines (strict)",
        value: "300",
      },
      {
        name: "1000 lines (lenient)",
        value: "1000",
      },
    ],
    default: "500",
  });

  const largeFileThreshold = parseInt(largeFileChoice, 10);

  // ── 3. Scanners to disable ─────────────────────────────────────────────────
  const disabledScanners = await checkbox({
    message: "Which scanners would you like to disable? (space to select, enter to confirm)",
    choices: [
      { name: "test-coverage", value: "test-coverage" },
      { name: "git-insights", value: "git-insights" },
      { name: "dep-health", value: "dep-health" },
      { name: "duplicates", value: "duplicates" },
      { name: "framework", value: "framework" },
    ],
  });

  // ── 4. Ignore patterns ─────────────────────────────────────────────────────
  const wantsIgnorePatterns = await select({
    message: "Add custom ignore patterns? (e.g. vendor, generated)",
    choices: [
      { name: "No", value: "no" },
      { name: "Yes — enter patterns", value: "yes" },
    ],
    default: "no",
  });

  let ignorePatterns: string[] = [];
  if (wantsIgnorePatterns === "yes") {
    const raw = await input({
      message: "Enter patterns (comma-separated):",
      default: "",
    });
    ignorePatterns = raw
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  // ── 5. AI roasts ───────────────────────────────────────────────────────────
  const aiEnabled = await confirm({
    message: "Enable AI-powered roasts? (requires ANTHROPIC_API_KEY)",
    default: false,
  });

  // ── 6. Preview and confirm ─────────────────────────────────────────────────
  const config = buildConfig({
    threshold,
    largeFileThreshold,
    disabledScanners,
    ignorePatterns,
    aiEnabled,
  });

  console.log(chalk.dim("\n  Config preview:"));
  console.log(
    chalk.dim(
      JSON.stringify(config, null, 2)
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n")
    )
  );
  console.log();

  const shouldWrite = await confirm({
    message: `Write .roastrc.json to ${rootDir}?`,
    default: true,
  });

  if (!shouldWrite) {
    console.log("Cancelled.");
    return;
  }

  const configPath = path.join(rootDir, ".roastrc.json");

  if (fs.existsSync(configPath)) {
    const shouldOverwrite = await confirm({
      message: ".roastrc.json already exists. Overwrite?",
      default: false,
    });

    if (!shouldOverwrite) {
      console.log("Cancelled.");
      return;
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(chalk.green("\n  Created .roastrc.json"));
  console.log(
    chalk.dim("  Run: npx roast-my-codebase to scan with your new config\n")
  );
}

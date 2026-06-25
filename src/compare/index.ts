import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import chalk from "chalk";
import { Finding, HealthScore } from "../types/index.js";

export interface ComparisonResult {
  currentScore: number;
  branchScore: number;
  scoreDelta: number;
  newFindings: Finding[];
  resolvedFindings: Finding[];
  unchangedCount: number;
}

export async function compareWithBranch(
  rootDir: string,
  branchName: string,
  scanFunc: (dir: string) => Promise<{ findings: Finding[]; health: HealthScore }>
): Promise<ComparisonResult> {
  // Check if in a git repo
  const gitCheck = spawnSync("git", ["rev-parse", "--git-dir"], {
    cwd: rootDir,
    stdio: "ignore"
  });
  if (gitCheck.status !== 0) {
    throw new Error("Not in a git repository. --compare requires git.");
  }

  // Check if branch exists
  const branchCheck = spawnSync("git", ["rev-parse", "--verify", branchName], {
    cwd: rootDir,
    stdio: "ignore"
  });
  if (branchCheck.status !== 0) {
    throw new Error(`Branch "${branchName}" not found.`);
  }

  // Scan current directory
  console.log(chalk.dim(`Scanning current working directory...`));
  const currentResult = await scanFunc(rootDir);

  // Create temporary worktree for branch
  const worktreePath = path.join(rootDir, "..", `.roast-worktree-${Date.now()}`);
  console.log(chalk.dim(`Checking out ${branchName} to temporary worktree...`));

  try {
    const addWorktree = spawnSync("git", ["worktree", "add", worktreePath, branchName], {
      cwd: rootDir,
      stdio: "ignore",
    });

    if (addWorktree.status !== 0) {
      throw new Error(`Failed to create worktree for branch "${branchName}".`);
    }

    // Scan branch
    console.log(chalk.dim(`Scanning ${branchName}...`));
    const branchResult = await scanFunc(worktreePath);

    // Compare findings
    const currentFindingIds = new Set(currentResult.findings.map(f => f.id));
    const branchFindingIds = new Set(branchResult.findings.map(f => f.id));

    const newFindings = currentResult.findings.filter(
      f => !branchFindingIds.has(f.id)
    );
    const resolvedFindings = branchResult.findings.filter(
      f => !currentFindingIds.has(f.id)
    );
    const unchangedCount = currentResult.findings.filter(
      f => branchFindingIds.has(f.id)
    ).length;

    return {
      currentScore: currentResult.health.score,
      branchScore: branchResult.health.score,
      scoreDelta: currentResult.health.score - branchResult.health.score,
      newFindings,
      resolvedFindings,
      unchangedCount,
    };
  } finally {
    // Cleanup worktree
    const removeWorktree = spawnSync("git", ["worktree", "remove", worktreePath, "--force"], {
      cwd: rootDir,
      stdio: "ignore",
    });

    // Best effort cleanup if git worktree remove failed
    if (removeWorktree.status !== 0 && fs.existsSync(worktreePath)) {
      try {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

export function renderComparison(comparison: ComparisonResult, branchName: string) {
  console.log("");
  console.log(chalk.bold.white("  Comparison Results"));
  console.log(chalk.dim("  ────────────────────────────────────────"));

  // Score comparison
  const deltaColor = comparison.scoreDelta > 0 ? chalk.green : comparison.scoreDelta < 0 ? chalk.red : chalk.dim;
  const deltaSign = comparison.scoreDelta > 0 ? "+" : "";
  console.log(`  Current:   ${comparison.currentScore}/100`);
  console.log(`  ${branchName.padEnd(8)}: ${comparison.branchScore}/100`);
  console.log(`  Delta:     ${deltaColor(deltaSign + comparison.scoreDelta)}`);
  console.log("");

  // New findings
  if (comparison.newFindings.length > 0) {
    console.log(chalk.red(`  ✗ ${comparison.newFindings.length} new issues:`));
    for (const finding of comparison.newFindings.slice(0, 5)) {
      console.log(`    ${chalk.red("+")} ${finding.message}`);
    }
    if (comparison.newFindings.length > 5) {
      console.log(`    ${chalk.dim(`...and ${comparison.newFindings.length - 5} more`)}`);
    }
    console.log("");
  }

  // Resolved findings
  if (comparison.resolvedFindings.length > 0) {
    console.log(chalk.green(`  ✓ ${comparison.resolvedFindings.length} issues resolved:`));
    for (const finding of comparison.resolvedFindings.slice(0, 5)) {
      console.log(`    ${chalk.green("-")} ${finding.message}`);
    }
    if (comparison.resolvedFindings.length > 5) {
      console.log(`    ${chalk.dim(`...and ${comparison.resolvedFindings.length - 5} more`)}`);
    }
    console.log("");
  }

  // Unchanged
  console.log(chalk.dim(`  ${comparison.unchangedCount} unchanged issues`));
  console.log("");
}

import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { randomBytes } from "crypto";
import { tmpdir } from "os";
import chalk from "chalk";
import { Finding, HealthScore } from "../types/index.js";
import { isValidBranchName } from "../utils/security.js";

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
  // Validate branch name to prevent command injection
  if (!isValidBranchName(branchName)) {
    throw new Error(
      `Invalid branch name: "${branchName}". Branch names must contain only alphanumeric characters, slashes, dashes, underscores, and dots.`
    );
  }

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

  // Create temporary worktree for branch with cryptographically secure random name
  const randomId = randomBytes(8).toString("hex");
  const worktreePath = path.join(tmpdir(), `.roast-worktree-${randomId}`);
  console.log(chalk.dim(`Checking out ${branchName} to temporary worktree...`));

  let cleanupAttempted = false;

  const cleanupWorktree = async (retries: number = 3) => {
    if (cleanupAttempted) return;
    cleanupAttempted = true;

    for (let i = 0; i < retries; i++) {
      const result = spawnSync("git", ["worktree", "remove", worktreePath, "--force"], {
        cwd: rootDir,
        stdio: "ignore",
      });

      if (result.status === 0) return;

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
    }

    // Final fallback: manual cleanup
    if (fs.existsSync(worktreePath)) {
      try {
        fs.rmSync(worktreePath, { recursive: true, force: true });
      } catch {
        // Ignore final cleanup errors
      }
    }
  };

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

    const result = {
      currentScore: currentResult.health.score,
      branchScore: branchResult.health.score,
      scoreDelta: currentResult.health.score - branchResult.health.score,
      newFindings,
      resolvedFindings,
      unchangedCount,
    };

    // Cleanup worktree
    await cleanupWorktree();

    return result;
  } catch (error) {
    // Ensure cleanup on error
    await cleanupWorktree();
    throw error;
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

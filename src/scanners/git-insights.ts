import { spawnSync } from "child_process";
import { Scanner, ScanResult, Finding } from "../types/index.js";

export class GitInsightsScanner implements Scanner {
  name = "git-insights";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    // Check if git repo
    const gitCheck = spawnSync("git", ["rev-parse", "--git-dir"], {
      cwd: rootDir,
      stdio: "pipe",
    });

    if (gitCheck.status !== 0) {
      return { findings: [], stats: { isGitRepo: false } };
    }

    // 1. File churn analysis
    const churnResult = spawnSync(
      "git",
      ["log", "--name-only", "--format=", "--since=6 months ago"],
      { cwd: rootDir, encoding: "utf-8" }
    );

    if (churnResult.status === 0 && churnResult.stdout) {
      const churnMap = this.analyzeChurn(churnResult.stdout);
      for (const [file, count] of churnMap.entries()) {
        if (count >= 100) {
          findings.push({
            id: `high-churn-${file}`,
            severity: "critical",
            category: "git-churn",
            message: `${file} changed ${count} times in 6 months — high instability`,
            file,
            detail: `${count} changes`,
          });
        } else if (count >= 50) {
          findings.push({
            id: `moderate-churn-${file}`,
            severity: "warning",
            category: "git-churn",
            message: `${file} changed ${count} times in 6 months`,
            file,
            detail: `${count} changes`,
          });
        }
      }
    }

    // 2. PR size analysis
    const prSizeStats = this.analyzePRSize(rootDir);
    if (prSizeStats.avgFilesPerPR > 0) {
      if (prSizeStats.avgFilesPerPR > 40) {
        findings.push({
          id: "large-pr-size",
          severity: "critical",
          category: "pr-size",
          message: `Average PR changes ${Math.round(prSizeStats.avgFilesPerPR)} files — PRs are too large`,
          detail: `${Math.round(prSizeStats.avgFilesPerPR)} files per PR`,
        });
      } else if (prSizeStats.avgFilesPerPR > 20) {
        findings.push({
          id: "moderate-pr-size",
          severity: "warning",
          category: "pr-size",
          message: `Average PR changes ${Math.round(prSizeStats.avgFilesPerPR)} files`,
          detail: `${Math.round(prSizeStats.avgFilesPerPR)} files per PR`,
        });
      }
    }

    // 3. Stale branches
    const staleBranches = this.findStaleBranches(rootDir);
    if (staleBranches.length > 0) {
      findings.push({
        id: "stale-branches",
        severity: "info",
        category: "stale-branches",
        message: `${staleBranches.length} branches haven't been updated in 90+ days`,
        detail: staleBranches.slice(0, 5).join(", "),
      });
    }

    return {
      findings,
      stats: {
        isGitRepo: true,
        avgPRSize: prSizeStats.avgFilesPerPR,
        staleBranchCount: staleBranches.length,
        highChurnFiles: findings.filter((f) => f.category === "git-churn")
          .length,
      },
    };
  }

  private analyzeChurn(gitOutput: string): Map<string, number> {
    const churnMap = new Map<string, number>();
    const lines = gitOutput.split("\n").filter((line) => line.trim() !== "");

    for (const file of lines) {
      const normalized = file.trim();
      if (normalized) {
        churnMap.set(normalized, (churnMap.get(normalized) || 0) + 1);
      }
    }

    return churnMap;
  }

  private analyzePRSize(rootDir: string): { avgFilesPerPR: number } {
    // Get merge commits from the last 6 months
    const mergeResult = spawnSync(
      "git",
      ["log", "--format=%H", "--merges", "--since=6 months ago"],
      { cwd: rootDir, encoding: "utf-8" }
    );

    if (mergeResult.status !== 0 || !mergeResult.stdout) {
      return { avgFilesPerPR: 0 };
    }

    const mergeCommits = mergeResult.stdout
      .split("\n")
      .filter((line) => line.trim() !== "");

    if (mergeCommits.length === 0) {
      return { avgFilesPerPR: 0 };
    }

    // Count files changed in each merge commit
    let totalFiles = 0;
    let validMerges = 0;

    for (const commit of mergeCommits) {
      const diffResult = spawnSync(
        "git",
        ["diff-tree", "--no-commit-id", "--name-only", "-r", commit],
        { cwd: rootDir, encoding: "utf-8" }
      );

      if (diffResult.status === 0 && diffResult.stdout) {
        const files = diffResult.stdout
          .split("\n")
          .filter((line) => line.trim() !== "");
        totalFiles += files.length;
        validMerges++;
      }
    }

    return {
      avgFilesPerPR: validMerges > 0 ? totalFiles / validMerges : 0,
    };
  }

  private findStaleBranches(rootDir: string): string[] {
    const branchResult = spawnSync(
      "git",
      ["branch", "-a", "--format=%(refname:short) %(committerdate:unix)"],
      { cwd: rootDir, encoding: "utf-8" }
    );

    if (branchResult.status !== 0 || !branchResult.stdout) {
      return [];
    }

    const staleBranches: string[] = [];
    const now = Math.floor(Date.now() / 1000); // Unix timestamp
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60;

    const lines = branchResult.stdout.split("\n");
    for (const line of lines) {
      const match = line.match(/^(.+?)\s+(\d+)$/);
      if (match) {
        const [, branchName, timestamp] = match;
        const ts = parseInt(timestamp, 10);
        if (ts < ninetyDaysAgo) {
          // Filter out HEAD and origin/HEAD references
          if (
            !branchName.includes("HEAD") &&
            !branchName.includes("origin/main") &&
            !branchName.includes("origin/master")
          ) {
            staleBranches.push(branchName);
          }
        }
      }
    }

    return staleBranches;
  }
}

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { Finding } from "../types/index.js";

export interface IncrementalResult {
  changedFiles: string[];
  isIncremental: boolean;
  baseRef: string;
}

export function getChangedFiles(rootDir: string, baseRef?: string): IncrementalResult {
  // Check if rootDir is a git repo
  const gitCheck = spawnSync("git", ["rev-parse", "--git-dir"], {
    cwd: rootDir,
    stdio: "ignore",
  });

  if (gitCheck.status !== 0) {
    return { changedFiles: [], isIncremental: false, baseRef: "" };
  }

  // If a baseRef is provided (e.g., "main"), get files changed since branching from it
  if (baseRef) {
    const diffResult = spawnSync(
      "git",
      ["diff", "--name-only", `${baseRef}...HEAD`],
      { cwd: rootDir, encoding: "utf-8" }
    );

    if (diffResult.status !== 0) {
      // Fallback: return empty but still incremental
      return { changedFiles: [], isIncremental: true, baseRef };
    }

    const files = parseGitOutput(diffResult.stdout)
      .map((f) => path.join(rootDir, f))
      .filter((f) => fs.existsSync(f));

    return { changedFiles: files, isIncremental: true, baseRef };
  }

  // No baseRef provided — use HEAD (unstaged + staged changes)
  const unstagedResult = spawnSync(
    "git",
    ["diff", "--name-only", "HEAD"],
    { cwd: rootDir, encoding: "utf-8" }
  );

  const stagedResult = spawnSync(
    "git",
    ["diff", "--name-only", "--cached"],
    { cwd: rootDir, encoding: "utf-8" }
  );

  const unstagedFiles =
    unstagedResult.status === 0 ? parseGitOutput(unstagedResult.stdout) : [];
  const stagedFiles =
    stagedResult.status === 0 ? parseGitOutput(stagedResult.stdout) : [];

  // Merge and deduplicate
  const merged = Array.from(new Set([...unstagedFiles, ...stagedFiles]));

  // Resolve to absolute paths and filter to only existing files
  const changedFiles = merged
    .map((f) => path.join(rootDir, f))
    .filter((f) => fs.existsSync(f));

  return { changedFiles, isIncremental: true, baseRef: "HEAD" };
}

function parseGitOutput(stdout: string): string[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function filterFindingsByFiles(
  findings: Finding[],
  changedFiles: string[],
  rootDir: string
): Finding[] {
  if (changedFiles.length === 0) {
    // No changed files — keep global findings, drop file-specific ones
    return findings.filter((f) => !f.file);
  }

  // Normalize changedFiles to a set of normalized absolute paths
  const normalizedChanged = new Set(
    changedFiles.map((f) => path.normalize(f))
  );

  return findings.filter((finding) => {
    // Global findings (no file) are always kept
    if (!finding.file) {
      return true;
    }

    // Resolve the finding's file to an absolute path for comparison
    const findingAbsolute = path.isAbsolute(finding.file)
      ? path.normalize(finding.file)
      : path.normalize(path.join(rootDir, finding.file));

    // Also try normalizing with forward/backward slash variants
    const findingForward = findingAbsolute.replace(/\\/g, "/");
    const findingBackward = findingAbsolute.replace(/\//g, "\\");

    if (normalizedChanged.has(findingAbsolute)) {
      return true;
    }

    // Check against forward and backward slash variants in the set
    for (const changed of normalizedChanged) {
      const changedForward = changed.replace(/\\/g, "/");
      const changedBackward = changed.replace(/\//g, "\\");
      if (
        changedForward === findingForward ||
        changedBackward === findingBackward
      ) {
        return true;
      }
    }

    return false;
  });
}

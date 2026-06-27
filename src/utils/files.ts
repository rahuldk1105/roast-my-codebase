import fs from "fs";
import path from "path";
import picomatch from "picomatch";
import { Finding } from "../types/index.js";

export function readFileLines(filePath: string): string[] {
  try {
    return fs.readFileSync(filePath, "utf-8").split("\n");
  } catch {
    return [];
  }
}

export function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

export function readJson(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function relativePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

/**
 * Load and parse a .roastignore file from the given directory.
 * Returns an array of fast-glob-compatible ignore patterns.
 * Returns [] if no .roastignore file exists.
 */
export function loadRoastIgnore(rootDir: string): string[] {
  const ignorePath = path.join(rootDir, ".roastignore");

  if (!fs.existsSync(ignorePath)) {
    return [];
  }

  let content: string;
  try {
    content = fs.readFileSync(ignorePath, "utf-8");
  } catch {
    return [];
  }

  const patterns: string[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    // Skip blank lines and comments
    if (!line || line.startsWith("#")) {
      continue;
    }

    patterns.push(convertIgnorePattern(line));
  }

  return patterns;
}

/**
 * Convert a gitignore-style pattern to a fast-glob compatible pattern.
 */
function convertIgnorePattern(pattern: string): string {
  // Already a glob pattern (contains *)
  if (pattern.includes("*")) {
    // If it has no slash prefix and no path separator, prefix with **/
    if (!pattern.startsWith("/") && !pattern.includes("/")) {
      return `**/${pattern}`;
    }
    // Strip leading slash if present
    if (pattern.startsWith("/")) {
      return pattern.slice(1);
    }
    return pattern;
  }

  // Leading slash: anchor to root — e.g. /build → build/**
  if (pattern.startsWith("/")) {
    const name = pattern.slice(1);
    return `${name}/**`;
  }

  // Trailing slash: directory pattern — e.g. dist/ → **/dist/**
  if (pattern.endsWith("/")) {
    const name = pattern.slice(0, -1);
    return `**/${name}/**`;
  }

  // Pattern contains a slash but not leading — treat as relative path glob
  if (pattern.includes("/")) {
    return `${pattern}/**`;
  }

  // Plain name — e.g. vendor → **/vendor/**
  // But could be a specific file like config.secret.ts
  // Heuristic: if it contains a dot and no slash, treat as a file pattern
  if (pattern.includes(".")) {
    return `**/${pattern}`;
  }

  // Directory name — e.g. vendor → **/vendor/**
  return `**/${pattern}/**`;
}

/**
 * Filter out findings whose file paths match any of the given ignore patterns.
 * Findings without a file property are always kept.
 */
export function filterIgnoredFindings(
  findings: Finding[],
  ignorePatterns: string[],
  _rootDir: string
): Finding[] {
  if (ignorePatterns.length === 0) return findings;

  const matchers = ignorePatterns.map((p) => picomatch(p, { dot: true }));

  return findings.filter((finding) => {
    if (!finding.file) return true; // keep global findings

    const normalized = finding.file.replace(/\\/g, "/");

    return !matchers.some((match) => match(normalized));
  });
}

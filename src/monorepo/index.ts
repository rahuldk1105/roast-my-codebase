import fs from "fs";
import path from "path";
import fg from "fast-glob";
import chalk from "chalk";
import { HealthScore, Finding, ProjectStats } from "../types/index.js";

export interface WorkspacePackage {
  name: string;
  path: string;
  relativePath: string;
}

export interface PackageScanResult {
  package: WorkspacePackage;
  health: HealthScore;
  findings: Finding[];
  stats: ProjectStats;
}

export interface MonorepoReport {
  packages: PackageScanResult[];
  rollupHealth: HealthScore;
  totalFindings: number;
  worstPackage: PackageScanResult;
  bestPackage: PackageScanResult;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function readJsonSafe(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isValidPackageDir(dir: string, rootDir: string): boolean {
  // skip the root itself
  if (path.resolve(dir) === path.resolve(rootDir)) return false;
  const pkgPath = path.join(dir, "package.json");
  return fs.existsSync(pkgPath);
}

function getPackageName(dir: string): string {
  try {
    const pkg = readJsonSafe(path.join(dir, "package.json"));
    if (pkg && typeof pkg.name === "string" && pkg.name) return pkg.name;
  } catch {
    // fall through
  }
  return path.basename(dir);
}

function expandGlobs(globs: string[], rootDir: string): string[] {
  const results: string[] = [];
  for (const pattern of globs) {
    try {
      const matches = fg.sync(pattern, {
        cwd: rootDir,
        onlyDirectories: true,
        absolute: true,
      });
      results.push(...matches);
    } catch {
      // skip invalid globs
    }
  }
  return results;
}

function deduplicateByPath(dirs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of dirs) {
    const resolved = path.resolve(d);
    if (!seen.has(resolved)) {
      seen.add(resolved);
      out.push(resolved);
    }
  }
  return out;
}

// ── workspace detection ──────────────────────────────────────────────────────

function detectNpmYarnWorkspaces(rootDir: string): string[] {
  const pkg = readJsonSafe(path.join(rootDir, "package.json"));
  if (!pkg) return [];

  let globs: string[] = [];
  if (Array.isArray(pkg.workspaces)) {
    globs = (pkg.workspaces as unknown[]).filter((g): g is string => typeof g === "string");
  } else if (
    pkg.workspaces &&
    typeof pkg.workspaces === "object" &&
    !Array.isArray(pkg.workspaces)
  ) {
    const ws = pkg.workspaces as Record<string, unknown>;
    if (Array.isArray(ws.packages)) {
      globs = (ws.packages as unknown[]).filter((g): g is string => typeof g === "string");
    }
  }

  return expandGlobs(globs, rootDir);
}

function detectPnpmWorkspaces(rootDir: string): string[] {
  const yamlPath = path.join(rootDir, "pnpm-workspace.yaml");
  if (!fs.existsSync(yamlPath)) return [];

  const content = fs.readFileSync(yamlPath, "utf-8");
  const globs: string[] = [];

  for (const line of content.split(/\r?\n/)) {
    // match lines like:   - 'packages/*'  or   - "apps/*"  or   - packages/*
    const m = line.match(/^\s+-\s+['"]?([^'"#\s]+)['"]?/);
    if (m && m[1]) {
      globs.push(m[1]);
    }
  }

  return expandGlobs(globs, rootDir);
}

function detectLernaPackages(rootDir: string): string[] {
  const lernaPath = path.join(rootDir, "lerna.json");
  if (!fs.existsSync(lernaPath)) return [];

  const lerna = readJsonSafe(lernaPath);
  if (!lerna) return [];

  let globs: string[] = [];
  if (Array.isArray(lerna.packages)) {
    globs = (lerna.packages as unknown[]).filter((g): g is string => typeof g === "string");
  }
  if (globs.length === 0) {
    // lerna default
    globs = ["packages/*"];
  }

  return expandGlobs(globs, rootDir);
}

function detectNxPackages(rootDir: string): string[] {
  const nxPath = path.join(rootDir, "nx.json");
  if (!fs.existsSync(nxPath)) return [];

  const nx = readJsonSafe(nxPath);
  if (!nx) return [];

  const dirs: string[] = [];

  // workspaceLayout
  const layout = nx.workspaceLayout as Record<string, unknown> | undefined;
  const appsDir = (layout?.appsDir as string | undefined) ?? "apps";
  const libsDir = (layout?.libsDir as string | undefined) ?? "libs";

  dirs.push(...expandGlobs([`${appsDir}/*`, `${libsDir}/*`], rootDir));

  // projects object
  const projects = nx.projects;
  if (projects && typeof projects === "object" && !Array.isArray(projects)) {
    for (const val of Object.values(projects as Record<string, unknown>)) {
      const root =
        typeof val === "string"
          ? val
          : (val as Record<string, unknown>)?.root as string | undefined;
      if (typeof root === "string") {
        const absRoot = path.resolve(rootDir, root);
        dirs.push(absRoot);
      }
    }
  }

  return dirs;
}

function fallbackAutoDetect(rootDir: string): string[] {
  return expandGlobs(["packages/*", "apps/*"], rootDir);
}

// ── public API ───────────────────────────────────────────────────────────────

export function detectWorkspacePackages(rootDir: string): WorkspacePackage[] {
  const allDirs: string[] = [];

  const npm = detectNpmYarnWorkspaces(rootDir);
  allDirs.push(...npm);

  const pnpm = detectPnpmWorkspaces(rootDir);
  allDirs.push(...pnpm);

  const lerna = detectLernaPackages(rootDir);
  allDirs.push(...lerna);

  const nx = detectNxPackages(rootDir);
  allDirs.push(...nx);

  const usedFallback = allDirs.length === 0;
  if (usedFallback) {
    allDirs.push(...fallbackAutoDetect(rootDir));
  }

  const unique = deduplicateByPath(allDirs);

  return unique
    .filter((dir) => isValidPackageDir(dir, rootDir))
    .map((dir) => ({
      name: getPackageName(dir),
      path: dir,
      relativePath: path.relative(rootDir, dir),
    }));
}

// ── rendering ────────────────────────────────────────────────────────────────

type ChalkFn = (text: string) => string;

function scoreColor(score: number): ChalkFn {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  return chalk.red;
}

function issueColor(findings: Finding[]): ChalkFn {
  if (findings.some((f) => f.severity === "critical")) return chalk.red;
  if (findings.some((f) => f.severity === "warning")) return chalk.yellow;
  return chalk.dim;
}

function issueIcon(findings: Finding[]): string {
  if (findings.some((f) => f.severity === "critical")) return " 🔴";
  if (findings.some((f) => f.severity === "warning")) return " ⚠";
  return " ✓";
}

function pad(str: string, width: number): string {
  // visible-length pad (strip ANSI codes for length)
  const visible = str.replace(/\x1b\[[0-9;]*m/g, "");
  const diff = width - visible.length;
  return diff > 0 ? str + " ".repeat(diff) : str;
}

export function renderMonorepoReport(report: MonorepoReport): string {
  const lines: string[] = [];

  const SEP = chalk.dim("  ─────────────────────────────────────────────");
  const WIDE_SEP = chalk.dim("  ──────────────────────────────────────────");

  lines.push("");
  lines.push(chalk.bold("  Monorepo Health Report"));
  lines.push(WIDE_SEP);
  lines.push("");

  // Header row
  const hdr =
    "  " +
    pad(chalk.bold("Package"), 30) +
    pad(chalk.bold("Score"), 10) +
    pad(chalk.bold("Grade"), 7) +
    chalk.bold("Issues");
  lines.push(hdr);
  lines.push(SEP);

  for (const result of report.packages) {
    const col = scoreColor(result.health.score);
    const issueCount = result.findings.length;
    const issColor = issueColor(result.findings);
    const icon = issueIcon(result.findings);

    const nameStr = pad(result.package.name, 30);
    const scoreStr = pad(col(`${result.health.score}/100`), 10);
    const gradeStr = pad(col(result.health.grade), 7);
    const issueStr = issColor(`${issueCount}`) + chalk.dim(icon);

    lines.push("  " + nameStr + scoreStr + gradeStr + issueStr);
  }

  lines.push(SEP);

  // Rollup row
  const rCol = scoreColor(report.rollupHealth.score);
  const rollupName = pad(chalk.bold("Rollup"), 30);
  const rollupScore = pad(rCol(`${report.rollupHealth.score}/100`), 10);
  const rollupGrade = pad(rCol(report.rollupHealth.grade), 7);
  const rollupIssues = chalk.dim(`${report.totalFindings}`);
  lines.push("  " + rollupName + rollupScore + rollupGrade + rollupIssues);

  lines.push("");

  // Worst / Best summary
  const worst = report.worstPackage;
  const best = report.bestPackage;

  const worstCol = scoreColor(worst.health.score);
  const bestCol = scoreColor(best.health.score);

  lines.push(
    chalk.red("  🔴 Worst:  ") +
      worstCol(worst.package.name.padEnd(20)) +
      chalk.dim(`(${worst.health.score}/100)`) +
      chalk.dim(" — needs the most love")
  );
  lines.push(
    chalk.green("  ✓  Best:   ") +
      bestCol(best.package.name.padEnd(20)) +
      chalk.dim(`(${best.health.score}/100)`) +
      chalk.dim(" — shining example")
  );

  lines.push("");

  return lines.join("\n");
}

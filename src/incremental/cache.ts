import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { Finding, HealthScore } from "../types/index.js";

export interface ScanCache {
  timestamp: number;
  gitHash: string;
  findings: Finding[];
  health: HealthScore;
}

const CACHE_FILENAME = ".roast-cache.json";

export function loadCache(rootDir: string): ScanCache | null {
  const cachePath = path.join(rootDir, CACHE_FILENAME);
  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(raw) as ScanCache;

    // Basic validation: ensure required fields are present
    if (
      typeof parsed.timestamp !== "number" ||
      typeof parsed.gitHash !== "string" ||
      !Array.isArray(parsed.findings) ||
      typeof parsed.health !== "object" ||
      parsed.health === null
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveCache(rootDir: string, cache: ScanCache): void {
  const cachePath = path.join(rootDir, CACHE_FILENAME);
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
}

export function getCurrentGitHash(rootDir: string): string | null {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    encoding: "utf-8",
    stdio: "pipe",
  });

  if (result.status !== 0 || !result.stdout) {
    return null;
  }

  return result.stdout.trim() || null;
}

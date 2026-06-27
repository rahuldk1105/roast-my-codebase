import fg from "fast-glob";
import fs from "fs";
import path from "path";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { SAFE_GLOB_OPTIONS } from "../utils/constants.js";

interface BundleCache {
  timestamp: number;
  sizes: Record<string, number>; // relative path -> bytes
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const OUTPUT_DIRS = ["dist", "build", ".next", "out", ".output"];

export class BundleSizeScanner implements Scanner {
  name = "bundle-size";

  async scan(rootDir: string): Promise<ScanResult> {
    // Find the first existing output directory
    let outputDir: string | null = null;
    for (const dir of OUTPUT_DIRS) {
      const candidate = path.join(rootDir, dir);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        outputDir = candidate;
        break;
      }
    }

    if (!outputDir) {
      return {
        findings: [],
        stats: { skipped: true, reason: "No build output found (run build first)" },
      };
    }

    // Scan for JS/CSS/WASM files
    const files = await fg(["**/*.{js,mjs,cjs,css,wasm}"], {
      cwd: outputDir,
      ignore: ["**/node_modules/**", "**/*.map", "**/*.LICENSE.*"],
      ...SAFE_GLOB_OPTIONS,
      absolute: true,
    });

    // Measure each file's size
    const currentSizes: Record<string, number> = {};
    let totalBytes = 0;
    for (const file of files) {
      const rel = path.relative(outputDir, file).replace(/\\/g, "/");
      const size = fs.statSync(file).size;
      currentSizes[rel] = size;
      totalBytes += size;
    }

    // Load previous cache
    const cachePath = path.join(rootDir, ".roast-bundle-sizes.json");
    let previousCache: BundleCache | null = null;
    if (fs.existsSync(cachePath)) {
      try {
        previousCache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      } catch { /* ignore */ }
    }

    const findings: Finding[] = [];

    if (!previousCache) {
      // No baseline: only warn if total is large
      if (totalBytes > 5 * 1024 * 1024) {
        findings.push({
          id: "bundle-size-total-critical",
          severity: "critical",
          category: "bundle-size",
          message: `Total bundle size is ${formatBytes(totalBytes)} — that's a lot to send over the wire`,
          detail: `${formatBytes(totalBytes)}`,
        });
      } else if (totalBytes > 1024 * 1024) {
        findings.push({
          id: "bundle-size-total-warning",
          severity: "warning",
          category: "bundle-size",
          message: `Total bundle size is ${formatBytes(totalBytes)}`,
          detail: `${formatBytes(totalBytes)}`,
        });
      }
    } else {
      const previousSizes = previousCache.sizes;

      // Check each current file against previous
      for (const [file, curr] of Object.entries(currentSizes)) {
        const prev = previousSizes[file];
        if (prev === undefined) {
          // New file
          if (curr > 100 * 1024) {
            findings.push({
              id: `bundle-size-new-${file}`,
              severity: "info",
              category: "bundle-size",
              message: `New bundle file ${file} (${formatBytes(curr)})`,
              file,
              detail: formatBytes(curr),
            });
          }
        } else {
          const delta = ((curr - prev) / prev) * 100;
          const growthBytes = curr - prev;
          if (delta > 50 && growthBytes > 50 * 1024) {
            findings.push({
              id: `bundle-size-critical-${file}`,
              severity: "critical",
              category: "bundle-size",
              message: `${file} grew ${delta.toFixed(0)}% (${formatBytes(prev)} → ${formatBytes(curr)})`,
              file,
              detail: `+${delta.toFixed(0)}%`,
            });
          } else if (delta > 10 && growthBytes > 10 * 1024) {
            findings.push({
              id: `bundle-size-warning-${file}`,
              severity: "warning",
              category: "bundle-size",
              message: `${file} grew ${delta.toFixed(0)}% (${formatBytes(prev)} → ${formatBytes(curr)})`,
              file,
              detail: `+${delta.toFixed(0)}%`,
            });
          }
        }
      }

      // Check for removed files
      for (const file of Object.keys(previousSizes)) {
        if (!(file in currentSizes)) {
          findings.push({
            id: `bundle-size-removed-${file}`,
            severity: "info",
            category: "bundle-size",
            message: `${file} removed from bundle`,
            file,
          });
        }
      }

      // Check total bundle growth
      const prevTotal = Object.values(previousSizes).reduce((a, b) => a + b, 0);
      if (prevTotal > 0) {
        const totalDelta = ((totalBytes - prevTotal) / prevTotal) * 100;
        if (totalDelta > 20) {
          findings.push({
            id: "bundle-size-total-growth",
            severity: "warning",
            category: "bundle-size",
            message: `Total bundle size grew ${totalDelta.toFixed(0)}% (${formatBytes(prevTotal)} → ${formatBytes(totalBytes)})`,
            detail: `+${totalDelta.toFixed(0)}%`,
          });
        }
      }
    }

    // Always save current sizes to cache
    const newCache: BundleCache = { timestamp: Date.now(), sizes: currentSizes };
    try {
      fs.writeFileSync(cachePath, JSON.stringify(newCache, null, 2), "utf-8");
    } catch { /* ignore write errors */ }

    const relativeOutputDir = outputDir.replace(rootDir, ".");

    return {
      findings,
      stats: {
        totalBytes,
        totalFormatted: formatBytes(totalBytes),
        fileCount: files.length,
        outputDir: relativeOutputDir,
        hasBaseline: previousCache !== null,
      },
    };
  }
}

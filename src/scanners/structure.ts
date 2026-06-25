import fg from "fast-glob";
import path from "path";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";

const UTIL_PATTERNS = [
  "utils",
  "helpers",
  "common",
  "shared",
  "misc",
  "lib",
  "tools",
];

export class StructureScanner implements Scanner {
  name = "structure";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const allFiles = await fg("**/*", {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      onlyFiles: true,
    });

    // Detect excessive nesting
    let maxDepth = 0;
    let deepestPath = "";
    for (const file of allFiles) {
      const depth = file.split("/").length;
      if (depth > maxDepth) {
        maxDepth = depth;
        deepestPath = file;
      }
    }

    if (maxDepth > 10) {
      findings.push({
        id: "deep-nesting",
        severity: "warning",
        category: "structure",
        message: `Maximum nesting depth is ${maxDepth} levels — someone really loves subdirectories`,
        file: deepestPath,
        detail: `${maxDepth} levels deep`,
      });
    } else if (maxDepth > 7) {
      findings.push({
        id: "moderate-nesting",
        severity: "info",
        category: "structure",
        message: `Nesting depth reaches ${maxDepth} levels`,
        file: deepestPath,
      });
    }

    // Detect folders with too many files
    const folderCounts = new Map<string, number>();
    for (const file of allFiles) {
      const dir = path.dirname(file);
      folderCounts.set(dir, (folderCounts.get(dir) || 0) + 1);
    }

    for (const [dir, count] of folderCounts) {
      if (count > 50) {
        findings.push({
          id: `large-folder-${dir}`,
          severity: "warning",
          category: "structure",
          message: `${dir}/ contains ${count} files — this folder needs a filing cabinet`,
          file: dir,
        });
      }
    }

    // Detect utility file explosion
    const utilFiles: string[] = [];
    for (const file of allFiles) {
      const basename = path.basename(file, path.extname(file)).toLowerCase();
      if (UTIL_PATTERNS.some((p) => basename.includes(p))) {
        utilFiles.push(file);
      }
    }

    if (utilFiles.length > 5) {
      findings.push({
        id: "util-explosion",
        severity: "warning",
        category: "structure",
        message: `${utilFiles.length} utility/helper files detected — the junk drawer is overflowing`,
        detail: utilFiles.slice(0, 5).join(", "),
      });
    } else if (utilFiles.length > 2) {
      findings.push({
        id: "util-files",
        severity: "info",
        category: "structure",
        message: `${utilFiles.length} utility/helper files`,
      });
    }

    // Detect large React components (files with Component/Page in name > 500 lines)
    const componentFiles = await fg(
      ["**/*.tsx", "**/*.jsx"],
      {
        cwd: rootDir,
        ignore: IGNORE_PATTERNS,
      }
    );

    // Component size is already handled by FileScanner's large file detection
    // Here we just count total components for stats
    return {
      findings,
      stats: {
        maxDepth,
        utilFiles: utilFiles.length,
        componentFiles: componentFiles.length,
        totalFolders: folderCounts.size,
      },
    };
  }
}

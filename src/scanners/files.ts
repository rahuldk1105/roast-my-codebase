import fg from "fast-glob";
import path from "path";
import { Scanner, ScanResult, Finding, ProjectStats } from "../types/index.js";
import {
  SOURCE_EXTENSIONS,
  IGNORE_PATTERNS,
  LARGE_FILE_THRESHOLDS,
} from "../utils/constants.js";
import { countLines, relativePath } from "../utils/files.js";

export class FileScanner implements Scanner {
  name = "files";

  async scan(rootDir: string): Promise<ScanResult & { stats: ProjectStats }> {
    const findings: Finding[] = [];

    const extGlob = SOURCE_EXTENSIONS.map((e) => `**/*${e}`);
    const allFiles = await fg(extGlob, {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    const allProjectFiles = await fg("**/*", {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      onlyFiles: true,
    });

    const fileSizes: { path: string; lines: number }[] = [];
    let totalLines = 0;

    for (const file of allFiles) {
      const lines = countLines(file);
      totalLines += lines;
      const rel = relativePath(rootDir, file);
      fileSizes.push({ path: rel, lines });

      if (lines >= LARGE_FILE_THRESHOLDS.extreme) {
        findings.push({
          id: `large-file-extreme-${rel}`,
          severity: "critical",
          category: "large-files",
          message: `${rel} is ${lines.toLocaleString()} lines — this file has its own gravitational field`,
          file: rel,
          detail: `${lines} lines`,
        });
      } else if (lines >= LARGE_FILE_THRESHOLDS.large) {
        findings.push({
          id: `large-file-${rel}`,
          severity: "warning",
          category: "large-files",
          message: `${rel} is ${lines.toLocaleString()} lines`,
          file: rel,
          detail: `${lines} lines`,
        });
      } else if (lines >= LARGE_FILE_THRESHOLDS.warning) {
        findings.push({
          id: `large-file-warn-${rel}`,
          severity: "info",
          category: "large-files",
          message: `${rel} is ${lines.toLocaleString()} lines`,
          file: rel,
          detail: `${lines} lines`,
        });
      }
    }

    fileSizes.sort((a, b) => b.lines - a.lines);

    const pkgPath = path.join(rootDir, "package.json");
    let dependencies = 0;
    let devDependencies = 0;
    try {
      const pkg = await import("fs").then((fs) =>
        JSON.parse(fs.readFileSync(pkgPath, "utf-8"))
      );
      dependencies = Object.keys(pkg.dependencies || {}).length;
      devDependencies = Object.keys(pkg.devDependencies || {}).length;
    } catch {
      // no package.json
    }

    const stats: ProjectStats = {
      totalFiles: allProjectFiles.length,
      sourceFiles: allFiles.length,
      totalLines,
      largestFiles: fileSizes.slice(0, 5),
      dependencies,
      devDependencies,
    };

    return { findings, stats };
  }
}

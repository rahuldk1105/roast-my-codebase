import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { SOURCE_EXTENSIONS, IGNORE_PATTERNS,
  SAFE_GLOB_OPTIONS,
} from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

const WINDOW_SIZE = 6;
const MIN_DUPLICATE_LINES = 6;

interface DuplicateLocation {
  file: string;
  startLine: number;
  endLine: number;
}

export class DuplicateScanner implements Scanner {
  name = "duplicates";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const extGlob = SOURCE_EXTENSIONS.map((e) => `**/*${e}`);
    const files = await fg(extGlob, {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      ...SAFE_GLOB_OPTIONS,
      absolute: true,
    });

    const hashMap = new Map<string, DuplicateLocation[]>();

    // First pass: hash all code windows
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");
        const rel = relativePath(rootDir, file);

        for (let i = 0; i <= lines.length - WINDOW_SIZE; i++) {
          const window = lines.slice(i, i + WINDOW_SIZE);
          const normalized = this.normalizeWindow(window);

          // Skip if mostly blank or imports
          if (this.shouldSkipWindow(normalized)) continue;

          const hash = this.hashString(normalized.join("\n"));
          if (!hashMap.has(hash)) {
            hashMap.set(hash, []);
          }
          hashMap.get(hash)!.push({
            file: rel,
            startLine: i + 1,
            endLine: i + WINDOW_SIZE,
          });
        }
      } catch {
        // skip unreadable files
      }
    }

    // Second pass: find duplicates
    const duplicates: Array<{
      locations: DuplicateLocation[];
      blockSize: number;
    }> = [];

    for (const [hash, locations] of hashMap) {
      if (locations.length < 2) continue;

      // Check if locations are in different files or far apart in same file
      const uniqueLocations = this.filterUniqueLocations(locations);
      if (uniqueLocations.length < 2) continue;

      // Try to extend the duplicate block
      const blockSize = this.calculateBlockSize(
        uniqueLocations,
        files,
        rootDir
      );
      duplicates.push({ locations: uniqueLocations, blockSize });
    }

    // Sort by block size and take top 10
    duplicates.sort((a, b) => b.blockSize - a.blockSize);
    const topDuplicates = duplicates.slice(0, 10);

    let totalDuplicateLines = 0;
    for (const dup of topDuplicates) {
      const severity =
        dup.blockSize >= 15 ? "warning" : dup.blockSize >= 6 ? "info" : "info";
      const locs = dup.locations
        .slice(0, 2)
        .map((l) => `${l.file}:${l.startLine}`)
        .join(" and ");

      findings.push({
        id: `duplicate-${dup.locations[0].file}-${dup.locations[0].startLine}`,
        severity,
        category: "duplicates",
        message: `${dup.blockSize}-line duplicate found in ${locs}${dup.locations.length > 2 ? ` (and ${dup.locations.length - 2} more)` : ""}`,
        file: dup.locations[0].file,
        detail: `${dup.blockSize} lines duplicated`,
      });
      totalDuplicateLines += dup.blockSize * dup.locations.length;
    }

    return {
      findings,
      stats: {
        totalBlocks: topDuplicates.length,
        totalDuplicateLines,
        filesAnalyzed: files.length,
      },
    };
  }

  private normalizeWindow(lines: string[]): string[] {
    return lines.map((line) => {
      // Remove comments
      let normalized = line.replace(/\/\/.*$/, "");
      normalized = normalized.replace(/\/\*.*?\*\//g, "");
      // Trim and collapse whitespace
      normalized = normalized.trim().replace(/\s+/g, " ");
      return normalized;
    });
  }

  private shouldSkipWindow(normalized: string[]): boolean {
    // Skip if mostly blank
    const nonBlank = normalized.filter((l) => l.length > 0);
    if (nonBlank.length < 3) return true;

    // Skip if mostly imports
    const imports = normalized.filter(
      (l) => l.startsWith("import ") || l.startsWith("export ")
    );
    if (imports.length > normalized.length * 0.5) return true;

    return false;
  }

  private filterUniqueLocations(
    locations: DuplicateLocation[]
  ): DuplicateLocation[] {
    const unique: DuplicateLocation[] = [];

    for (const loc of locations) {
      // Check if this location is far enough from existing ones
      const isDuplicate = unique.some(
        (u) =>
          u.file === loc.file &&
          Math.abs(u.startLine - loc.startLine) < WINDOW_SIZE * 2
      );
      if (!isDuplicate) {
        unique.push(loc);
      }
    }

    return unique;
  }

  private calculateBlockSize(
    locations: DuplicateLocation[],
    files: string[],
    rootDir: string
  ): number {
    // For simplicity, return WINDOW_SIZE
    // In a real implementation, we'd extend forward/backward to find the full block
    return WINDOW_SIZE;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

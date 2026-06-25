import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

interface TypeSafetyStats {
  totalAny: number;
  totalTsIgnore: number;
  totalTsNocheck: number;
  totalTsExpectError: number;
  worstOffenders: { path: string; violations: number }[];
}

export class TypeSafetyScanner implements Scanner {
  name = "type-safety";

  async scan(rootDir: string): Promise<ScanResult & { stats: TypeSafetyStats }> {
    const findings: Finding[] = [];

    const allFiles = await fg(["**/*.ts", "**/*.tsx"], {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    let totalAny = 0;
    let totalTsIgnore = 0;
    let totalTsNocheck = 0;
    let totalTsExpectError = 0;

    const fileViolations: { path: string; violations: number }[] = [];

    for (const file of allFiles) {
      const rel = relativePath(rootDir, file);
      let content: string;
      try {
        content = fs.readFileSync(file, "utf-8");
      } catch {
        continue;
      }

      const lines = content.split("\n");
      let inBlockComment = false;
      let fileAnyCount = 0;
      let fileTsIgnore = 0;
      let fileTsNocheck = 0;
      let fileTsExpectError = 0;

      for (const line of lines) {
        const trimmed = line.trim();

        // Track block comments
        if (inBlockComment) {
          if (trimmed.includes("*/")) {
            inBlockComment = false;
          }
          continue;
        }

        if (trimmed.startsWith("/*")) {
          if (!trimmed.includes("*/")) {
            inBlockComment = true;
          }
          continue;
        }

        // Skip single-line comments for `any` detection
        const isComment = trimmed.startsWith("//");

        // Detect @ts-ignore, @ts-nocheck, @ts-expect-error (these ARE in comments)
        if (/@ts-ignore/.test(line)) {
          fileTsIgnore++;
        }
        if (/@ts-nocheck/.test(line)) {
          fileTsNocheck++;
        }
        if (/@ts-expect-error/.test(line)) {
          fileTsExpectError++;
        }

        // Skip comment lines for `any` counting
        if (isComment) {
          continue;
        }

        // Detect `: any` and `as any` with word boundary
        const colonAny = line.match(/:\s*any\b/g);
        const asAny = line.match(/\bas\s+any\b/g);

        if (colonAny) {
          fileAnyCount += colonAny.length;
        }
        if (asAny) {
          fileAnyCount += asAny.length;
        }
      }

      totalAny += fileAnyCount;
      totalTsIgnore += fileTsIgnore;
      totalTsNocheck += fileTsNocheck;
      totalTsExpectError += fileTsExpectError;

      const totalFileViolations = fileAnyCount + fileTsIgnore + fileTsNocheck + fileTsExpectError;
      if (totalFileViolations > 0) {
        fileViolations.push({ path: rel, violations: totalFileViolations });
      }

      // Finding for @ts-nocheck per file
      if (fileTsNocheck > 0) {
        findings.push({
          id: `ts-nocheck-${rel}`,
          severity: "warning",
          category: "type-safety",
          message: `${rel} uses @ts-nocheck — entire file skips type checking`,
          file: rel,
          detail: `${fileTsNocheck} @ts-nocheck directive(s)`,
        });
      }
    }

    // Findings based on total any count
    if (totalAny > 20) {
      findings.push({
        id: "type-safety-any-critical",
        severity: "critical",
        category: "type-safety",
        message: `${totalAny} uses of \`any\` — the type system is being bypassed wholesale`,
        detail: `${totalAny} total any usages across the codebase`,
      });
    } else if (totalAny >= 6) {
      findings.push({
        id: "type-safety-any-warning",
        severity: "warning",
        category: "type-safety",
        message: `${totalAny} uses of \`any\` — significant type safety gaps`,
        detail: `${totalAny} total any usages across the codebase`,
      });
    } else if (totalAny >= 1) {
      findings.push({
        id: "type-safety-any-info",
        severity: "info",
        category: "type-safety",
        message: `${totalAny} uses of \`any\` — minor type safety gaps`,
        detail: `${totalAny} total any usages across the codebase`,
      });
    }

    // Finding for @ts-ignore count
    if (totalTsIgnore > 5) {
      findings.push({
        id: "type-safety-ts-ignore",
        severity: "warning",
        category: "type-safety",
        message: `${totalTsIgnore} @ts-ignore comments — errors are being silenced`,
        detail: `${totalTsIgnore} total @ts-ignore directives`,
      });
    }

    // Sort worst offenders
    fileViolations.sort((a, b) => b.violations - a.violations);
    const worstOffenders = fileViolations.slice(0, 5);

    const stats: TypeSafetyStats = {
      totalAny,
      totalTsIgnore,
      totalTsNocheck,
      totalTsExpectError,
      worstOffenders,
    };

    return { findings, stats };
  }
}

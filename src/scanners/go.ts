/**
 * Go-specific scanners
 */

import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

export class GoComplexityScanner implements Scanner {
  name = "go-complexity";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.go"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/vendor/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        const functions = this.extractFunctions(content);

        for (const func of functions) {
          const complexity = this.calculateComplexity(func.body);

          if (complexity >= 20) {
            findings.push({
              id: `go-complexity-${rel}-${func.name}`,
              severity: "critical",
              category: "complexity",
              message: `Function ${func.name} has cyclomatic complexity of ${complexity}`,
              file: rel,
              detail: `${complexity} decision points`,
            });
          } else if (complexity >= 10) {
            findings.push({
              id: `go-complexity-${rel}-${func.name}`,
              severity: "warning",
              category: "complexity",
              message: `Function ${func.name} has cyclomatic complexity of ${complexity}`,
              file: rel,
              detail: `${complexity} decision points`,
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }

  private extractFunctions(content: string): Array<{ name: string; body: string }> {
    const functions: Array<{ name: string; body: string }> = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // eslint-disable-next-line security/detect-unsafe-regex
      const funcMatch = line.match(/^func\s+(?:\([^)]{0,200}\)\s+)?(\w+)\s*\(/);

      if (funcMatch) {
        const name = funcMatch[1];
        let braceCount = 0;
        let body = "";
        let started = false;

        for (let j = i; j < lines.length; j++) {
          body += lines[j] + "\n";
          for (const ch of lines[j]) {
            if (ch === "{") { braceCount++; started = true; }
            if (ch === "}") { braceCount--; }
          }
          if (started && braceCount <= 0) break;
        }

        functions.push({ name, body });
      }
    }

    return functions;
  }

  private calculateComplexity(code: string): number {
    let complexity = 1;

    const patterns = [
      /\bif\b/g,
      /\belse if\b/g,
      /\bfor\b/g,
      /\bcase\b/g,
      /\b&&\b/g,
      /\b\|\|\b/g,
      /\bselect\b/g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }
}

export class GoErrorHandlingScanner implements Scanner {
  name = "go-error-handling";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.go"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/vendor/**", "**/*_test.go"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Detect blank identifier error ignoring: _ = someFunc()
        const ignoredErrors = content.match(/\b_\s*=\s*\w+\([^)]*\)/g);
        const blankErrCount = ignoredErrors ? ignoredErrors.length : 0;

        if (blankErrCount >= 5) {
          findings.push({
            id: `go-ignored-errors-${rel}`,
            severity: "warning",
            category: "go-error-handling",
            message: `${rel} ignores ${blankErrCount} error returns with blank identifier`,
            file: rel,
            detail: "Ignored errors can mask bugs in production",
          });
        } else if (blankErrCount >= 3) {
          findings.push({
            id: `go-ignored-errors-${rel}`,
            severity: "info",
            category: "go-error-handling",
            message: `${rel} ignores ${blankErrCount} error returns`,
            file: rel,
          });
        }

        // Detect panic() usage in non-test code
        const panicCalls = content.match(/\bpanic\s*\(/g);
        if (panicCalls && panicCalls.length > 0) {
          findings.push({
            id: `go-panic-${rel}`,
            severity: "warning",
            category: "go-error-handling",
            message: `${rel} uses panic() ${panicCalls.length} time(s)`,
            file: rel,
            detail: "Prefer returning errors over panic in library code",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

export class GoLintScanner implements Scanner {
  name = "go-lint";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.go"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/vendor/**"],
      absolute: true,
    });

    let totalExported = 0;
    let undocumentedExported = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Check exported functions/types without doc comments
          const exportedMatch = line.match(
            /^(?:func|type|var|const)\s+([A-Z]\w*)/
          );

          if (exportedMatch) {
            totalExported++;
            const prevLine = i > 0 ? lines[i - 1].trim() : "";
            if (!prevLine.startsWith("//")) {
              undocumentedExported++;
            }
          }
        }

        // Detect init() functions (can be a code smell if overused)
        const initFuncs = content.match(/^func\s+init\s*\(\s*\)/gm);
        if (initFuncs && initFuncs.length > 1) {
          findings.push({
            id: `go-multi-init-${rel}`,
            severity: "info",
            category: "go-lint",
            message: `${rel} has ${initFuncs.length} init() functions`,
            file: rel,
            detail: "Multiple init() functions can make initialization order unclear",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    if (totalExported > 0) {
      const undocPercent = Math.round((undocumentedExported / totalExported) * 100);
      if (undocPercent > 50) {
        findings.push({
          id: "go-undocumented-exports",
          severity: "warning",
          category: "go-lint",
          message: `${undocPercent}% of exported symbols lack documentation comments`,
          detail: `${undocumentedExported} of ${totalExported} exported symbols`,
        });
      }
    }

    return { findings };
  }
}

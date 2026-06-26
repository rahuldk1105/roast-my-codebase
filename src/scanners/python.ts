/**
 * Python-specific scanners
 */

import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

export class PythonComplexityScanner implements Scanner {
  name = "python-complexity";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.py"], {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Detect complex functions (simplified - counts indentation and branches)
        const functions = this.extractFunctions(content);

        for (const func of functions) {
          const complexity = this.calculateComplexity(func.body);

          if (complexity >= 20) {
            findings.push({
              id: `py-complexity-${rel}-${func.name}`,
              severity: "critical",
              category: "complexity",
              message: `Function ${func.name} has cyclomatic complexity of ${complexity}`,
              file: rel,
              detail: `${complexity} decision points`,
            });
          } else if (complexity >= 10) {
            findings.push({
              id: `py-complexity-${rel}-${func.name}`,
              severity: "warning",
              category: "complexity",
              message: `Function ${func.name} has cyclomatic complexity of ${complexity}`,
              file: rel,
              detail: `${complexity} decision points`,
            });
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return { findings };
  }

  private extractFunctions(content: string): Array<{ name: string; body: string }> {
    const functions: Array<{ name: string; body: string }> = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const funcMatch = line.match(/^\s*def\s+(\w+)\s*\(/);

      if (funcMatch) {
        const name = funcMatch[1];
        const indent = line.match(/^\s*/)?.[0].length || 0;

        // Find function body
        let body = line + "\n";
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          const nextIndent = nextLine.match(/^\s*/)?.[0].length || 0;

          // Empty lines or comments continue
          if (nextLine.trim() === "" || nextLine.trim().startsWith("#")) {
            body += nextLine + "\n";
            continue;
          }

          // If indent is less than or equal to function, we're done
          if (nextIndent <= indent) {
            break;
          }

          body += nextLine + "\n";
        }

        functions.push({ name, body });
      }
    }

    return functions;
  }

  private calculateComplexity(code: string): number {
    let complexity = 1; // Base complexity

    // Count decision points
    const patterns = [
      /\bif\b/g,
      /\belif\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\band\b/g,
      /\bor\b/g,
      /\bexcept\b/g,
      /\bwith\b/g,
      /\?/g, // Ternary
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }
}

export class PythonTypeHintsScanner implements Scanner {
  name = "python-type-hints";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.py"], {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    let totalFunctions = 0;
    let untypedFunctions = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Find function definitions
        const funcPattern = /def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*\w+)?:/g;
        const functions = Array.from(content.matchAll(funcPattern));

        for (const match of functions) {
          totalFunctions++;
          const fullDef = match[0];

          // Check if function has type hints (: type or -> return type)
          const hasParamTypes = /:\s*\w+/.test(fullDef);
          const hasReturnType = /->/.test(fullDef);

          if (!hasParamTypes && !hasReturnType) {
            untypedFunctions++;
          }
        }
      } catch {
        // Skip files that can't be read
      }
    }

    if (totalFunctions > 0) {
      const untypedPercent = Math.round(
        (untypedFunctions / totalFunctions) * 100
      );

      if (untypedPercent > 70) {
        findings.push({
          id: "py-type-hints-low",
          severity: "warning",
          category: "type-safety",
          message: `${untypedPercent}% of Python functions lack type hints`,
          detail: `${untypedFunctions} of ${totalFunctions} functions`,
        });
      }
    }

    return {
      findings,
      stats: {
        totalFunctions,
        untypedFunctions,
        untypedPercent: totalFunctions > 0 ? Math.round((untypedFunctions / totalFunctions) * 100) : 0,
      },
    };
  }
}

export class PythonImportsScanner implements Scanner {
  name = "python-imports";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.py"], {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Check for wildcard imports
        const wildcardImports = content.match(/from\s+[\w.]+\s+import\s+\*/g);
        if (wildcardImports && wildcardImports.length > 0) {
          findings.push({
            id: `py-wildcard-import-${rel}`,
            severity: "warning",
            category: "python-imports",
            message: `${rel} uses wildcard imports (${wildcardImports.length} found)`,
            file: rel,
            detail: "Wildcard imports pollute namespace",
          });
        }

        // Check for relative imports beyond parent
        const deepRelative = content.match(/from\s+\.{3,}/g);
        if (deepRelative && deepRelative.length > 0) {
          findings.push({
            id: `py-deep-relative-${rel}`,
            severity: "info",
            category: "python-imports",
            message: `${rel} uses deep relative imports`,
            file: rel,
            detail: "Consider absolute imports",
          });
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return { findings };
  }
}

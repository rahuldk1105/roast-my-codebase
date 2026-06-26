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
        // eslint-disable-next-line security/detect-unsafe-regex
        const funcPattern = /def\s+(\w+)\s*\([^)]{0,500}\)(?:\s*->\s*\w+)?:/g;
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

export class PythonDocstringScanner implements Scanner {
  name = "python-docstrings";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.py"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/*test*/**", "**/tests/**", "**/setup.py"],
      absolute: true,
    });

    let totalPublicFunctions = 0;
    let undocumentedFunctions = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const funcMatch = line.match(/^\s*def\s+([a-zA-Z]\w*)\s*\(/);

          if (funcMatch && !funcMatch[1].startsWith("_")) {
            totalPublicFunctions++;
            const nextNonEmpty = this.getNextNonEmptyLine(lines, i + 1);
            if (!nextNonEmpty || (!nextNonEmpty.includes('"""') && !nextNonEmpty.includes("'''"))) {
              undocumentedFunctions++;
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    if (totalPublicFunctions > 0) {
      const undocPercent = Math.round((undocumentedFunctions / totalPublicFunctions) * 100);

      if (undocPercent > 70) {
        findings.push({
          id: "py-docstrings-low",
          severity: "warning",
          category: "python-docstrings",
          message: `${undocPercent}% of public functions lack docstrings`,
          detail: `${undocumentedFunctions} of ${totalPublicFunctions} public functions undocumented`,
        });
      } else if (undocPercent > 40) {
        findings.push({
          id: "py-docstrings-moderate",
          severity: "info",
          category: "python-docstrings",
          message: `${undocPercent}% of public functions lack docstrings`,
          detail: `${undocumentedFunctions} of ${totalPublicFunctions} public functions undocumented`,
        });
      }
    }

    return {
      findings,
      stats: { totalPublicFunctions, undocumentedFunctions },
    };
  }

  private getNextNonEmptyLine(lines: string[], startIdx: number): string | null {
    for (let i = startIdx; i < Math.min(startIdx + 3, lines.length); i++) {
      const trimmed = lines[i].trim();
      if (trimmed.length > 0) return trimmed;
    }
    return null;
  }
}

export class PythonCodeSmellScanner implements Scanner {
  name = "python-code-smells";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.py"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/*test*/**", "**/tests/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Detect bare except clauses
        const bareExcepts = content.match(/^\s*except\s*:/gm);
        if (bareExcepts && bareExcepts.length > 0) {
          findings.push({
            id: `py-bare-except-${rel}`,
            severity: "warning",
            category: "python-smells",
            message: `${rel} uses bare except: ${bareExcepts.length} time(s)`,
            file: rel,
            detail: "Bare except catches SystemExit, KeyboardInterrupt — use except Exception:",
          });
        }

        // Detect mutable default arguments
        const mutableDefaults = content.match(
          /def\s+\w+\s*\([^)]*(?:=\s*(?:\[\]|\{\}|\bset\(\)))[^)]*\)/g
        );
        if (mutableDefaults && mutableDefaults.length > 0) {
          findings.push({
            id: `py-mutable-default-${rel}`,
            severity: "warning",
            category: "python-smells",
            message: `${rel} has ${mutableDefaults.length} mutable default argument(s)`,
            file: rel,
            detail: "Mutable defaults are shared across calls — use None and create inside function",
          });
        }

        // Detect global statement usage
        const globals = content.match(/^\s*global\s+\w+/gm);
        if (globals && globals.length >= 3) {
          findings.push({
            id: `py-globals-${rel}`,
            severity: "warning",
            category: "python-smells",
            message: `${rel} uses global statement ${globals.length} times`,
            file: rel,
            detail: "Excessive globals indicate poor encapsulation",
          });
        }

        // Detect overly long lines (PEP 8: 79 chars, common: 120 chars)
        const lines = content.split("\n");
        let longLineCount = 0;
        for (const line of lines) {
          if (line.length > 120 && !line.trim().startsWith("#") && !line.includes("http")) {
            longLineCount++;
          }
        }
        if (longLineCount >= 20) {
          findings.push({
            id: `py-long-lines-${rel}`,
            severity: "info",
            category: "python-smells",
            message: `${rel} has ${longLineCount} lines exceeding 120 characters`,
            file: rel,
            detail: "Consider reformatting with black or ruff",
          });
        }

        // Detect nested function depth (3+ levels)
        let maxDepth = 0;
        let currentDepth = 0;
        for (const line of lines) {
          if (line.match(/^\s*def\s+/)) {
            const indent = (line.match(/^\s*/)?.[0].length || 0) / 4;
            currentDepth = indent;
            if (currentDepth > maxDepth) maxDepth = currentDepth;
          }
        }
        if (maxDepth >= 3) {
          findings.push({
            id: `py-nested-functions-${rel}`,
            severity: "info",
            category: "python-smells",
            message: `${rel} has functions nested ${maxDepth} levels deep`,
            file: rel,
            detail: "Deeply nested functions are hard to test and reason about",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

export class PythonSecurityScanner implements Scanner {
  name = "python-security";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.py"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/*test*/**", "**/tests/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Detect eval/exec usage
        const evalExec = content.match(/\b(?:eval|exec)\s*\(/g);
        if (evalExec && evalExec.length > 0) {
          findings.push({
            id: `py-eval-${rel}`,
            severity: "critical",
            category: "python-security",
            message: `${rel} uses eval()/exec() ${evalExec.length} time(s)`,
            file: rel,
            detail: "eval/exec can execute arbitrary code — use ast.literal_eval for data",
          });
        }

        // Detect pickle usage (insecure deserialization)
        if (/\bpickle\.(?:load|loads)\s*\(/.test(content)) {
          findings.push({
            id: `py-pickle-${rel}`,
            severity: "warning",
            category: "python-security",
            message: `${rel} uses pickle deserialization`,
            file: rel,
            detail: "Pickle can execute arbitrary code during deserialization — use json or msgpack",
          });
        }

        // Detect subprocess with shell=True
        if (/subprocess\.\w+\([^)]*shell\s*=\s*True/s.test(content)) {
          findings.push({
            id: `py-shell-true-${rel}`,
            severity: "warning",
            category: "python-security",
            message: `${rel} uses subprocess with shell=True`,
            file: rel,
            detail: "shell=True enables shell injection — pass args as a list instead",
          });
        }

        // Detect hardcoded passwords/secrets
        const secretPatterns = content.match(
          /(?:password|passwd|secret|api_key|token)\s*=\s*['"][^'"]{8,}['"]/gi
        );
        if (secretPatterns && secretPatterns.length > 0) {
          findings.push({
            id: `py-hardcoded-secret-${rel}`,
            severity: "critical",
            category: "python-security",
            message: `${rel} may have hardcoded secrets (${secretPatterns.length} found)`,
            file: rel,
            detail: "Use environment variables or a secrets manager",
          });
        }

        // Detect SQL string formatting (injection risk)
        const sqlInjection = content.match(
          /(?:execute|cursor\.execute)\s*\(\s*(?:f['"]|['"].*%|['"].*\.format)/g
        );
        if (sqlInjection && sqlInjection.length > 0) {
          findings.push({
            id: `py-sql-injection-${rel}`,
            severity: "critical",
            category: "python-security",
            message: `${rel} has potential SQL injection (${sqlInjection.length} found)`,
            file: rel,
            detail: "Use parameterized queries instead of string formatting",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

export class PythonClassDesignScanner implements Scanner {
  name = "python-class-design";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.py"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/*test*/**", "**/tests/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);
        const lines = content.split("\n");

        // Detect God classes (too many methods)
        const classes = this.extractClasses(lines);

        for (const cls of classes) {
          if (cls.methodCount >= 20) {
            findings.push({
              id: `py-god-class-${rel}-${cls.name}`,
              severity: "warning",
              category: "python-design",
              message: `Class ${cls.name} in ${rel} has ${cls.methodCount} methods`,
              file: rel,
              detail: "Consider splitting into smaller, focused classes",
            });
          }

          // Detect classes with no methods (data class candidate)
          if (cls.methodCount === 0 && cls.lineCount > 3) {
            findings.push({
              id: `py-dataclass-candidate-${rel}-${cls.name}`,
              severity: "info",
              category: "python-design",
              message: `Class ${cls.name} in ${rel} has no methods — consider @dataclass`,
              file: rel,
            });
          }
        }

        // Detect excessive inheritance depth
        const deepInheritance = content.match(
          // eslint-disable-next-line security/detect-unsafe-regex
          /class\s+\w+\s*\(\s*\w+(?:\.\w+)*(?:\s*,\s*\w+(?:\.\w+)*){3,}\s*\)/g
        );
        if (deepInheritance) {
          findings.push({
            id: `py-multi-inherit-${rel}`,
            severity: "info",
            category: "python-design",
            message: `${rel} has classes with 4+ parent classes`,
            file: rel,
            detail: "Deep multiple inheritance creates complex MRO — prefer composition",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }

  private extractClasses(lines: string[]): Array<{ name: string; methodCount: number; lineCount: number }> {
    const classes: Array<{ name: string; methodCount: number; lineCount: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const classMatch = lines[i].match(/^class\s+(\w+)/);
      if (classMatch) {
        const name = classMatch[1];
        const classIndent = (lines[i].match(/^\s*/)?.[0].length || 0);
        let methodCount = 0;
        let lineCount = 0;

        for (let j = i + 1; j < lines.length; j++) {
          const line = lines[j];
          if (line.trim() === "") { lineCount++; continue; }

          const indent = (line.match(/^\s*/)?.[0].length || 0);
          if (indent <= classIndent && line.trim().length > 0) break;

          lineCount++;
          if (line.match(/^\s+def\s+/)) methodCount++;
        }

        classes.push({ name, methodCount, lineCount });
      }
    }

    return classes;
  }
}

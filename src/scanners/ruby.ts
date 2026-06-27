/**
 * Ruby-specific scanners
 */

import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

export class RubyComplexityScanner implements Scanner {
  name = "ruby-complexity";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.rb"], {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        const methods = this.extractMethods(content);

        for (const method of methods) {
          const complexity = this.calculateComplexity(method.body);

          if (complexity >= 15) {
            findings.push({
              id: `ruby-complexity-${rel}-${method.name}`,
              severity: "critical",
              category: "complexity",
              message: `Method ${method.name} has cyclomatic complexity of ${complexity}`,
              file: rel,
              detail: `${complexity} decision points`,
            });
          } else if (complexity >= 8) {
            findings.push({
              id: `ruby-complexity-${rel}-${method.name}`,
              severity: "warning",
              category: "complexity",
              message: `Method ${method.name} has cyclomatic complexity of ${complexity}`,
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

  private extractMethods(content: string): Array<{ name: string; body: string }> {
    const methods: Array<{ name: string; body: string }> = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const methodMatch = line.match(/^\s*def\s+(\w+)/);

      if (methodMatch) {
        const name = methodMatch[1];
        let body = line + "\n";
        let depth = 1;

        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          body += nextLine + "\n";

          // Track nested blocks that increase depth
          if (/\b(?:def|do|begin|if|unless|while|until|for|case|class|module)\b/.test(nextLine) &&
              !/\bend\b/.test(nextLine)) {
            depth++;
          }
          if (/\bend\b/.test(nextLine)) {
            depth--;
            if (depth <= 0) break;
          }
        }

        methods.push({ name, body });
      }
    }

    return methods;
  }

  private calculateComplexity(code: string): number {
    let complexity = 1;

    const patterns = [
      /\bif\b/g,
      /\belsif\b/g,
      /\bunless\b/g,
      /\bwhile\b/g,
      /\buntil\b/g,
      /\bfor\b/g,
      /\bcase\b/g,
      /\bwhen\b/g,
      /&&/g,
      /\|\|/g,
      /\brescue\b/g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }
}

export class RubyCodeSmellScanner implements Scanner {
  name = "ruby-code-smells";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.rb"], {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // God classes: count def occurrences per file
        const defCount = (content.match(/\bdef\s+/g) || []).length;
        if (defCount > 20) {
          findings.push({
            id: `ruby-god-class-${rel}`,
            severity: "warning",
            category: "ruby-issues",
            message: `${rel} defines ${defCount} methods — consider splitting`,
            file: rel,
            detail: "Large classes violate Single Responsibility Principle",
          });
        }

        // String interpolation in SQL
        // eslint-disable-next-line security/detect-unsafe-regex
        const sqlInterpolation = content.match(/(?:where|find_by_sql|execute)\s*\(?\s*["'][^"']*#\{/gi);
        if (sqlInterpolation && sqlInterpolation.length > 0) {
          findings.push({
            id: `ruby-sql-injection-${rel}`,
            severity: "critical",
            category: "security",
            message: `Potential SQL injection via string interpolation in ${rel}`,
            file: rel,
            detail: "Use parameterized queries instead of string interpolation",
          });
        }

        // eval usage
        const evalUsage = content.match(/\beval\s*\(/g);
        if (evalUsage && evalUsage.length > 0) {
          findings.push({
            id: `ruby-eval-${rel}`,
            severity: "warning",
            category: "security",
            message: `eval() usage in ${rel}`,
            file: rel,
            detail: "eval() executes arbitrary code — avoid if possible",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

export class RubyStyleScanner implements Scanner {
  name = "ruby-style";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.rb"], {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);
        const lines = content.split("\n");
        const isTestFile = /(?:spec|test)/.test(rel);

        // Missing frozen_string_literal
        if (!content.startsWith("# frozen_string_literal: true")) {
          findings.push({
            id: `ruby-frozen-string-literal-${rel}`,
            severity: "info",
            category: "ruby-style",
            message: `${rel} missing frozen_string_literal comment — performance improvement available`,
            file: rel,
            detail: "Add '# frozen_string_literal: true' at the top of the file",
          });
        }

        // puts in production code
        if (!isTestFile && /\bputs\s+/.test(content)) {
          findings.push({
            id: `ruby-puts-${rel}`,
            severity: "info",
            category: "ruby-style",
            message: `puts() in ${rel} — use a logger instead`,
            file: rel,
            detail: "Use Rails.logger or a proper logging framework",
          });
        }

        // Long methods: methods with >30 lines between def and end
        for (let i = 0; i < lines.length; i++) {
          const methodMatch = lines[i].match(/^\s*def\s+(\w+)/);
          if (methodMatch) {
            const name = methodMatch[1];
            let depth = 1;
            let methodLines = 0;

            for (let j = i + 1; j < lines.length; j++) {
              const nextLine = lines[j];
              methodLines++;

              if (/\b(?:def|do|begin|if|unless|while|until|for|case|class|module)\b/.test(nextLine) &&
                  !/\bend\b/.test(nextLine)) {
                depth++;
              }
              if (/\bend\b/.test(nextLine)) {
                depth--;
                if (depth <= 0) break;
              }
            }

            if (methodLines > 30) {
              findings.push({
                id: `ruby-long-method-${rel}-${name}`,
                severity: "warning",
                category: "ruby-style",
                message: `Method ${name} is ${methodLines} lines — consider splitting`,
                file: rel,
                detail: "Long methods are harder to test and understand",
              });
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

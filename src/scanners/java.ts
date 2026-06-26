/**
 * Java-specific scanners
 */

import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

export class JavaComplexityScanner implements Scanner {
  name = "java-complexity";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.java"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/target/**", "**/build/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        const methods = this.extractMethods(content);

        for (const method of methods) {
          const complexity = this.calculateComplexity(method.body);

          if (complexity >= 20) {
            findings.push({
              id: `java-complexity-${rel}-${method.name}`,
              severity: "critical",
              category: "complexity",
              message: `Method ${method.name} has cyclomatic complexity of ${complexity}`,
              file: rel,
              detail: `${complexity} decision points`,
            });
          } else if (complexity >= 10) {
            findings.push({
              id: `java-complexity-${rel}-${method.name}`,
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
      const methodMatch = line.match(
        // eslint-disable-next-line security/detect-unsafe-regex
        /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:\w+(?:<[^>]{0,100}>)?)\s+(\w+)\s*\(/
      );

      if (methodMatch && !line.includes("class ") && !line.includes("interface ")) {
        const name = methodMatch[1];
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

        methods.push({ name, body });
      }
    }

    return methods;
  }

  private calculateComplexity(code: string): number {
    let complexity = 1;

    const patterns = [
      /\bif\s*\(/g,
      /\belse if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /&&/g,
      /\|\|/g,
      /\?[^?]/g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }
}

export class JavaCodeSmellScanner implements Scanner {
  name = "java-code-smells";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.java"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/target/**", "**/build/**", "**/*Test.java", "**/*Tests.java"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Detect God classes (too many methods)
        const methodCount = (content.match(
          // eslint-disable-next-line security/detect-unsafe-regex
          /^\s*(?:public|private|protected)\s+(?:static\s+)?(?:\w+)\s+\w+\s*\(/gm
        ) || []).length;

        if (methodCount >= 30) {
          findings.push({
            id: `java-god-class-${rel}`,
            severity: "warning",
            category: "java-smells",
            message: `${rel} has ${methodCount} methods — possible God class`,
            file: rel,
            detail: "Consider splitting into smaller, focused classes",
          });
        }

        // Detect raw types (generics without type parameters)
        const rawTypes = content.match(/\b(?:List|Map|Set|Collection|Iterator)\s+\w+/g);
        if (rawTypes && rawTypes.length >= 3) {
          findings.push({
            id: `java-raw-types-${rel}`,
            severity: "info",
            category: "java-smells",
            message: `${rel} uses raw types ${rawTypes.length} times`,
            file: rel,
            detail: "Use parameterized types for type safety (e.g., List<String>)",
          });
        }

        // Detect @SuppressWarnings usage
        const suppressions = content.match(/@SuppressWarnings/g);
        if (suppressions && suppressions.length >= 3) {
          findings.push({
            id: `java-suppressions-${rel}`,
            severity: "info",
            category: "java-smells",
            message: `${rel} suppresses ${suppressions.length} warnings`,
            file: rel,
            detail: "Fix warnings instead of suppressing them",
          });
        }

        // Detect System.out.println (should use logger)
        const sysout = content.match(/System\.(out|err)\.(println|print|printf)\s*\(/g);
        if (sysout && sysout.length >= 3) {
          findings.push({
            id: `java-sysout-${rel}`,
            severity: "info",
            category: "java-smells",
            message: `${rel} uses System.out/err ${sysout.length} times`,
            file: rel,
            detail: "Use a logging framework (SLF4J, Log4j) instead",
          });
        }

        // Detect empty catch blocks
        const emptyCatch = content.match(/catch\s*\([^)]*\)\s*\{\s*\}/g);
        if (emptyCatch && emptyCatch.length > 0) {
          findings.push({
            id: `java-empty-catch-${rel}`,
            severity: "warning",
            category: "java-smells",
            message: `${rel} has ${emptyCatch.length} empty catch block(s)`,
            file: rel,
            detail: "Empty catch blocks silently swallow exceptions",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

export class JavaNamingScanner implements Scanner {
  name = "java-naming";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.java"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/target/**", "**/build/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);
        const fileName = rel.split("/").pop() || "";

        // Check class name matches file name
        const classMatch = content.match(/public\s+(?:class|interface|enum)\s+(\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          const expectedFile = `${className}.java`;
          if (fileName !== expectedFile) {
            findings.push({
              id: `java-naming-mismatch-${rel}`,
              severity: "warning",
              category: "java-naming",
              message: `Class ${className} doesn't match file name ${fileName}`,
              file: rel,
            });
          }
        }

        // Detect non-standard constant naming (should be UPPER_SNAKE_CASE)
        const badConstants = content.match(
          /\bstatic\s+final\s+\w+\s+([a-z]\w*)\s*=/g
        );
        if (badConstants && badConstants.length >= 3) {
          findings.push({
            id: `java-constant-naming-${rel}`,
            severity: "info",
            category: "java-naming",
            message: `${rel} has ${badConstants.length} constants not in UPPER_SNAKE_CASE`,
            file: rel,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

/**
 * C#-specific scanners
 */

import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

export class CSharpComplexityScanner implements Scanner {
  name = "csharp-complexity";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.cs"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/bin/**", "**/obj/**"],
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
              id: `csharp-complexity-${rel}-${method.name}`,
              severity: "critical",
              category: "complexity",
              message: `Method ${method.name} has cyclomatic complexity of ${complexity}`,
              file: rel,
              detail: `${complexity} decision points`,
            });
          } else if (complexity >= 10) {
            findings.push({
              id: `csharp-complexity-${rel}-${method.name}`,
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
        /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?(?:virtual\s+)?(?:override\s+)?(?:\w+(?:<[^>]{0,100}>)?)\s+(\w+)\s*\(/
      );

      if (methodMatch && !line.includes("class ") && !line.includes("interface ") && !line.includes("namespace ")) {
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
      /\bforeach\s*\(/g,
      /\bwhile\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /&&/g,
      /\|\|/g,
      /\?\?/g,
      /\?[^?.\s]/g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }
}

export class CSharpCodeSmellScanner implements Scanner {
  name = "csharp-code-smells";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.cs"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/bin/**", "**/obj/**", "**/*Test*.cs", "**/Migrations/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Detect God classes
        const methodCount = (content.match(
          // eslint-disable-next-line security/detect-unsafe-regex
          /^\s*(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?(?:\w+)\s+\w+\s*\(/gm
        ) || []).length;

        if (methodCount >= 30) {
          findings.push({
            id: `csharp-god-class-${rel}`,
            severity: "warning",
            category: "csharp-smells",
            message: `${rel} has ${methodCount} methods — possible God class`,
            file: rel,
            detail: "Consider applying Single Responsibility Principle",
          });
        }

        // Detect regions (often used to hide complexity)
        const regions = content.match(/#region/g);
        if (regions && regions.length >= 5) {
          findings.push({
            id: `csharp-regions-${rel}`,
            severity: "info",
            category: "csharp-smells",
            message: `${rel} has ${regions.length} #region blocks`,
            file: rel,
            detail: "Excessive regions often hide classes that are too large",
          });
        }

        // Detect empty catch blocks
        // eslint-disable-next-line security/detect-unsafe-regex
        const emptyCatch = content.match(/catch\s*(?:\([^)]{0,100}\))?\s*\{\s*\}/g);
        if (emptyCatch && emptyCatch.length > 0) {
          findings.push({
            id: `csharp-empty-catch-${rel}`,
            severity: "warning",
            category: "csharp-smells",
            message: `${rel} has ${emptyCatch.length} empty catch block(s)`,
            file: rel,
            detail: "Empty catch blocks silently swallow exceptions",
          });
        }

        // Detect Console.WriteLine (should use ILogger)
        const consoleWrites = content.match(/Console\.(Write|WriteLine)\s*\(/g);
        if (consoleWrites && consoleWrites.length >= 3) {
          findings.push({
            id: `csharp-console-${rel}`,
            severity: "info",
            category: "csharp-smells",
            message: `${rel} uses Console.Write* ${consoleWrites.length} times`,
            file: rel,
            detail: "Use ILogger/logging framework instead of Console output",
          });
        }

        // Detect #pragma warning disable
        const pragmas = content.match(/#pragma\s+warning\s+disable/g);
        if (pragmas && pragmas.length >= 3) {
          findings.push({
            id: `csharp-pragma-${rel}`,
            severity: "info",
            category: "csharp-smells",
            message: `${rel} disables ${pragmas.length} compiler warnings`,
            file: rel,
            detail: "Fix warnings instead of suppressing them",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

export class CSharpAsyncScanner implements Scanner {
  name = "csharp-async";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.cs"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/bin/**", "**/obj/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Detect async void (should be async Task)
        const asyncVoid = content.match(/\basync\s+void\s+\w+/g);
        if (asyncVoid && asyncVoid.length > 0) {
          findings.push({
            id: `csharp-async-void-${rel}`,
            severity: "warning",
            category: "csharp-async",
            message: `${rel} has ${asyncVoid.length} async void method(s)`,
            file: rel,
            detail: "async void cannot be awaited and exceptions are unobservable. Use async Task instead.",
          });
        }

        // Detect .Result or .Wait() (sync over async)
        const syncOverAsync = content.match(/\.(?:Result|Wait\(\))/g);
        if (syncOverAsync && syncOverAsync.length >= 3) {
          findings.push({
            id: `csharp-sync-over-async-${rel}`,
            severity: "warning",
            category: "csharp-async",
            message: `${rel} has ${syncOverAsync.length} sync-over-async calls (.Result/.Wait())`,
            file: rel,
            detail: "Use await instead of .Result/.Wait() to avoid deadlocks",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

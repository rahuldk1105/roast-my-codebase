/**
 * Kotlin-specific scanners
 */

import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

export class KotlinComplexityScanner implements Scanner {
  name = "kotlin-complexity";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.kt"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/*.kts", "**/build/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        const functions = this.extractFunctions(content);

        for (const func of functions) {
          const complexity = this.calculateComplexity(func.body);

          if (complexity >= 15) {
            findings.push({
              id: `kotlin-complexity-${rel}-${func.name}`,
              severity: "critical",
              category: "complexity",
              message: `Function ${func.name} has cyclomatic complexity of ${complexity}`,
              file: rel,
              detail: `${complexity} decision points`,
            });
          } else if (complexity >= 8) {
            findings.push({
              id: `kotlin-complexity-${rel}-${func.name}`,
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
       
      const funcMatch = line.match(/(?:fun)\s+(\w+)\s*[(<]/);

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
      /\bwhen\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bcatch\b/g,
      /&&/g,
      /\|\|/g,
      /\?:/g,
      /\?\./g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }
}

export class KotlinCodeSmellScanner implements Scanner {
  name = "kotlin-code-smells";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.kt"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/build/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // !! force-not-null: count per file
        const forceNotNull = (content.match(/!!/g) || []).length;
        if (forceNotNull > 3) {
          findings.push({
            id: `kotlin-force-not-null-${rel}`,
            severity: "warning",
            category: "kotlin-issues",
            message: `${rel} has ${forceNotNull} !! operators — use safe calls or let`,
            file: rel,
            detail: "!! throws NullPointerException — use ?.let, ?: or require()",
          });
        }

        // God class: count fun occurrences per file
        const funCount = (content.match(/\bfun\s+/g) || []).length;
        if (funCount > 20) {
          findings.push({
            id: `kotlin-god-class-${rel}`,
            severity: "warning",
            category: "kotlin-issues",
            message: `${rel} defines ${funCount} functions — possible God class`,
            file: rel,
            detail: "Consider splitting into smaller, focused classes",
          });
        }

        // println usage
        if (/\bprintln\s*\(/.test(content)) {
          findings.push({
            id: `kotlin-println-${rel}`,
            severity: "info",
            category: "kotlin-issues",
            message: `println() in ${rel} — use a logging framework`,
            file: rel,
            detail: "Use SLF4J, Timber, or another logging framework",
          });
        }

        // Mutable public state: var on a public property (not inside function)
        const lines = content.split("\n");
        for (const line of lines) {
          // Look for top-level or class-level var declarations (not inside function body)
          // eslint-disable-next-line security/detect-unsafe-regex
          if (/^\s*(?:public\s+)?var\s+\w+/.test(line) && !/^\s+(?:val|var)\s/.test(line.trimStart().replace(/^public\s+/, ""))) {
            findings.push({
              id: `kotlin-mutable-public-${rel}`,
              severity: "info",
              category: "kotlin-issues",
              message: `Public mutable property in ${rel} — consider val`,
              file: rel,
              detail: "Prefer immutable properties (val) over mutable ones (var) for public API",
            });
            break; // Only report once per file
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

export class KotlinCoroutineScanner implements Scanner {
  name = "kotlin-coroutines";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.kt"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/build/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);
        const isTestFile = /(?:test|Test)/.test(rel);

        // GlobalScope usage
        if (/GlobalScope\./.test(content)) {
          findings.push({
            id: `kotlin-global-scope-${rel}`,
            severity: "warning",
            category: "kotlin-coroutine",
            message: `GlobalScope in ${rel} — use structured concurrency instead`,
            file: rel,
            detail: "GlobalScope leaks coroutines — use viewModelScope, lifecycleScope, or CoroutineScope with proper lifecycle",
          });
        }

        // runBlocking in production code
        if (!isTestFile && /\brunBlocking\s*\{/.test(content)) {
          findings.push({
            id: `kotlin-run-blocking-${rel}`,
            severity: "warning",
            category: "kotlin-coroutine",
            message: `runBlocking in ${rel} — blocks thread, use coroutine scope`,
            file: rel,
            detail: "runBlocking blocks the calling thread — use launch or async from a coroutine scope",
          });
        }

        // Thread.sleep in suspend functions (blocking call in coroutine)
        const suspendWithBlocking = content.match(/suspend.*fun[\s\S]{0,200}Thread\.sleep/);
        if (suspendWithBlocking) {
          findings.push({
            id: `kotlin-blocking-in-suspend-${rel}`,
            severity: "warning",
            category: "kotlin-coroutine",
            message: `Blocking call in suspend function in ${rel}`,
            file: rel,
            detail: "Use delay() instead of Thread.sleep() in suspend functions",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

/**
 * Swift-specific scanners
 */

import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

export class SwiftComplexityScanner implements Scanner {
  name = "swift-complexity";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.swift"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/.build/**"],
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
              id: `swift-complexity-${rel}-${func.name}`,
              severity: "critical",
              category: "complexity",
              message: `Function ${func.name} has cyclomatic complexity of ${complexity}`,
              file: rel,
              detail: `${complexity} decision points`,
            });
          } else if (complexity >= 8) {
            findings.push({
              id: `swift-complexity-${rel}-${func.name}`,
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
      const funcMatch = line.match(/(?:func|init)\s+(\w+)\s*[(<]/);

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
      /\bguard\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /&&/g,
      /\|\|/g,
      /\?\?/g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }
}

export class SwiftCodeSmellScanner implements Scanner {
  name = "swift-code-smells";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.swift"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/.build/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Force unwrap: count ! used as force-unwrap per file
        const forceUnwraps = (content.match(/\w+!\./g) || []).length +
          (content.match(/\w+!\s*[,)\]]/g) || []).length;
        if (forceUnwraps > 5) {
          findings.push({
            id: `swift-force-unwrap-${rel}`,
            severity: "warning",
            category: "swift-issues",
            message: `${rel} has ${forceUnwraps} force unwraps — use optional binding instead`,
            file: rel,
            detail: "Force unwrapping can cause runtime crashes — use if let, guard let, or ??",
          });
        }

        // print() statements
        if (/\bprint\s*\(/.test(content)) {
          findings.push({
            id: `swift-print-${rel}`,
            severity: "info",
            category: "swift-issues",
            message: `print() in ${rel} — use os_log or Logger`,
            file: rel,
            detail: "Use os_log or the unified logging system for production code",
          });
        }

        // Large SwiftUI view files: count @State vars
        const stateVarCount = (content.match(/@State\s+(?:private\s+)?var\s+/g) || []).length;
        if (stateVarCount > 20) {
          findings.push({
            id: `swift-large-view-${rel}`,
            severity: "warning",
            category: "swift-issues",
            message: `${rel} has ${stateVarCount} @State vars — consider extracting ViewModel`,
            file: rel,
            detail: "Views with many state variables are hard to maintain — use ObservableObject",
          });
        }

        // TODO/FIXME
        const todos = content.match(/\/\/\s*(?:TODO|FIXME):/g);
        if (todos && todos.length > 0) {
          findings.push({
            id: `swift-todos-${rel}`,
            severity: "info",
            category: "todos",
            message: `${rel} has ${todos.length} TODO/FIXME comment(s)`,
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

export class SwiftAsyncScanner implements Scanner {
  name = "swift-async";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.swift"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/.build/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Callback pyramid: nested completion handler patterns
        // eslint-disable-next-line security/detect-unsafe-regex
        const callbackNesting = (content.match(/\{[^}]*completion\s*\(/g) || []).length;
        if (callbackNesting > 3) {
          findings.push({
            id: `swift-callback-pyramid-${rel}`,
            severity: "warning",
            category: "swift-async",
            message: `Callback nesting detected in ${rel} — consider async/await`,
            file: rel,
            detail: "Nested completion handlers reduce readability — Swift async/await is available since 5.5",
          });
        }

        // DispatchQueue.main.async in file that also uses async/await
        const hasDispatchMain = /DispatchQueue\.main\.async/.test(content);
        const hasAsyncAwait = /\basync\b/.test(content) && /\bawait\b/.test(content);
        if (hasDispatchMain && hasAsyncAwait) {
          findings.push({
            id: `swift-mixed-concurrency-${rel}`,
            severity: "info",
            category: "swift-async",
            message: `Mixed concurrency patterns in ${rel}`,
            file: rel,
            detail: "Mixing DispatchQueue and async/await can lead to subtle bugs — prefer @MainActor",
          });
        }

        // @Published without @MainActor or ObservableObject
        const hasPublished = /@Published\b/.test(content);
        const hasMainActor = /@MainActor\b/.test(content);
        const hasObservableObject = /ObservableObject/.test(content);
        if (hasPublished && !hasMainActor && !hasObservableObject) {
          findings.push({
            id: `swift-published-no-mainactor-${rel}`,
            severity: "info",
            category: "swift-async",
            message: `@Published properties in ${rel} without @MainActor or ObservableObject`,
            file: rel,
            detail: "Ensure @Published properties are updated on the main thread",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

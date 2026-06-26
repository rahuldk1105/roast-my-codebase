/**
 * Rust-specific scanners
 */

import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

export class RustComplexityScanner implements Scanner {
  name = "rust-complexity";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.rs"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/target/**"],
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
              id: `rust-complexity-${rel}-${func.name}`,
              severity: "critical",
              category: "complexity",
              message: `Function ${func.name} has cyclomatic complexity of ${complexity}`,
              file: rel,
              detail: `${complexity} decision points`,
            });
          } else if (complexity >= 10) {
            findings.push({
              id: `rust-complexity-${rel}-${func.name}`,
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
      const funcMatch = line.match(/^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);

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
      /\bwhile\b/g,
      /\bloop\b/g,
      /\bmatch\b/g,
      /=>/g,
      /&&/g,
      /\|\|/g,
      /\?/g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }
}

export class RustUnsafeScanner implements Scanner {
  name = "rust-unsafe";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.rs"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/target/**"],
      absolute: true,
    });

    let totalUnsafeBlocks = 0;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Count unsafe blocks
        const unsafeBlocks = content.match(/\bunsafe\s*\{/g);
        const unsafeFns = content.match(/\bunsafe\s+fn\b/g);

        const fileUnsafe = (unsafeBlocks?.length || 0) + (unsafeFns?.length || 0);
        totalUnsafeBlocks += fileUnsafe;

        if (fileUnsafe >= 5) {
          findings.push({
            id: `rust-unsafe-heavy-${rel}`,
            severity: "warning",
            category: "rust-unsafe",
            message: `${rel} has ${fileUnsafe} unsafe blocks/functions`,
            file: rel,
            detail: "Heavy unsafe usage increases risk of memory safety issues",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    if (totalUnsafeBlocks >= 20) {
      findings.push({
        id: "rust-unsafe-total",
        severity: "warning",
        category: "rust-unsafe",
        message: `Project has ${totalUnsafeBlocks} total unsafe blocks/functions`,
        detail: "Consider wrapping unsafe code in safe abstractions",
      });
    }

    return { findings };
  }
}

export class RustClippyHintsScanner implements Scanner {
  name = "rust-clippy-hints";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.rs"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/target/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        // Detect .unwrap() usage (panic on None/Err)
        const unwraps = content.match(/\.unwrap\(\)/g);
        if (unwraps && unwraps.length >= 10) {
          findings.push({
            id: `rust-unwrap-heavy-${rel}`,
            severity: "warning",
            category: "rust-clippy",
            message: `${rel} uses .unwrap() ${unwraps.length} times`,
            file: rel,
            detail: "Prefer .expect(), ?, or proper error handling over .unwrap()",
          });
        }

        // Detect .clone() overuse
        const clones = content.match(/\.clone\(\)/g);
        if (clones && clones.length >= 15) {
          findings.push({
            id: `rust-clone-heavy-${rel}`,
            severity: "info",
            category: "rust-clippy",
            message: `${rel} uses .clone() ${clones.length} times`,
            file: rel,
            detail: "Excessive cloning may indicate ownership issues",
          });
        }

        // Detect #[allow(dead_code)] suppression
        const deadCodeAllows = content.match(/#\[allow\(dead_code\)]/g);
        if (deadCodeAllows && deadCodeAllows.length >= 3) {
          findings.push({
            id: `rust-dead-code-${rel}`,
            severity: "info",
            category: "rust-clippy",
            message: `${rel} suppresses dead_code warnings ${deadCodeAllows.length} times`,
            file: rel,
            detail: "Consider removing unused code instead of suppressing warnings",
          });
        }

        // Detect todo!() and unimplemented!() macros
        const todos = content.match(/\b(?:todo|unimplemented)!\s*\(/g);
        if (todos && todos.length > 0) {
          findings.push({
            id: `rust-todo-macro-${rel}`,
            severity: "info",
            category: "rust-clippy",
            message: `${rel} has ${todos.length} todo!()/unimplemented!() macro(s)`,
            file: rel,
            detail: "These will panic at runtime if reached",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

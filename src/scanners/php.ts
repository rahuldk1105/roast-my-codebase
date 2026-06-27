/**
 * PHP-specific scanners
 */

import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

export class PHPComplexityScanner implements Scanner {
  name = "php-complexity";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.php"], {
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

          if (complexity >= 15) {
            findings.push({
              id: `php-complexity-${rel}-${func.name}`,
              severity: "critical",
              category: "complexity",
              message: `Function ${func.name} has cyclomatic complexity of ${complexity}`,
              file: rel,
              detail: `${complexity} decision points`,
            });
          } else if (complexity >= 8) {
            findings.push({
              id: `php-complexity-${rel}-${func.name}`,
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
       
      const funcMatch = line.match(/(?:function|public|private|protected|static)\s+function\s+(\w+)/);

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
      /\bif\s*\(/g,
      /\belseif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bwhile\s*\(/g,
      /\bfor\s*\(/g,
      /\bforeach\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /&&/g,
      /\|\|/g,
      /\?:/g,
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }
}

export class PHPSecurityScanner implements Scanner {
  name = "php-security";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.php"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/vendor/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);
        const isTestFile = /(?:test|spec)/i.test(rel);

        // $_GET/$_POST directly in SQL query
         
        const sqlInjection = content.match(/(?:mysql_query|mysqli_query|PDO.*query)\s*\(\s*["'][^"']*\$_(?:GET|POST|REQUEST)/gi);
        if (sqlInjection && sqlInjection.length > 0) {
          findings.push({
            id: `php-sql-injection-${rel}`,
            severity: "critical",
            category: "security",
            message: `SQL injection risk: user input in query in ${rel}`,
            file: rel,
            detail: "Use prepared statements with parameterized queries",
          });
        }

        // eval() usage — detects the string pattern in scanned PHP code, not calling eval itself
        const evalUsage = content.match(/\beval\s*\(/g);
        if (evalUsage && evalUsage.length > 0) {
          findings.push({
            id: `php-eval-${rel}`,
            severity: "warning",
            category: "security",
            message: `eval() usage in ${rel}`,
            file: rel,
            detail: "eval() can execute arbitrary code — avoid if possible",
          });
        }

        // system()/exec()/shell_exec()
        const cmdExec = content.match(/\b(system|exec|shell_exec|passthru|popen)\s*\(/g);
        if (cmdExec && cmdExec.length > 0) {
          const fn = cmdExec[0].split("(")[0].trim();
          findings.push({
            id: `php-cmd-exec-${rel}`,
            severity: "warning",
            category: "security",
            message: `Command execution function ${fn} in ${rel}`,
            file: rel,
            detail: "Command execution functions can be exploited for RCE",
          });
        }

        // var_dump/print_r in non-test files
        if (!isTestFile) {
          const debugOutput = content.match(/\b(?:var_dump|print_r)\s*\(/g);
          if (debugOutput && debugOutput.length > 0) {
            findings.push({
              id: `php-debug-output-${rel}`,
              severity: "info",
              category: "security",
              message: `Debug output function in ${rel}`,
              file: rel,
              detail: "Remove var_dump/print_r from production code",
            });
          }
        }

        // MD5 for passwords
         
        const md5Password = content.match(/md5\s*\(\s*\$(?:pass|password|pwd)/gi);
        if (md5Password && md5Password.length > 0) {
          findings.push({
            id: `php-md5-password-${rel}`,
            severity: "critical",
            category: "security",
            message: `MD5 is not suitable for password hashing in ${rel}`,
            file: rel,
            detail: "Use password_hash() with PASSWORD_BCRYPT or PASSWORD_ARGON2ID",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

export class PHPCodeSmellScanner implements Scanner {
  name = "php-code-smells";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.php"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/vendor/**"],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);
        const lines = content.split("\n").slice(0, 5).join("\n");

        // Missing strict types in first 5 lines
        if (!lines.includes("declare(strict_types=1)")) {
          findings.push({
            id: `php-strict-types-${rel}`,
            severity: "info",
            category: "php-smell",
            message: `${rel} missing strict_types declaration`,
            file: rel,
            detail: "Add 'declare(strict_types=1);' at the top of the file",
          });
        }

        // God class: count function occurrences per file
        const funcCount = (content.match(/\bfunction\s+/g) || []).length;
        if (funcCount > 20) {
          findings.push({
            id: `php-god-class-${rel}`,
            severity: "warning",
            category: "php-smell",
            message: `${rel} defines ${funcCount} functions — possible God class`,
            file: rel,
            detail: "Consider splitting into smaller, focused classes",
          });
        }

        // Long parameter lists
         
        const longParams = content.match(/function\s+\w+\s*\([^)]{200,}\)/g);
        if (longParams && longParams.length > 0) {
          findings.push({
            id: `php-long-params-${rel}`,
            severity: "warning",
            category: "php-smell",
            message: `Function with too many parameters in ${rel}`,
            file: rel,
            detail: "Consider using a parameter object or builder pattern",
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return { findings };
  }
}

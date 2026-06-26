import fg from "fast-glob";
import fs from "fs";
import { spawnSync } from "child_process";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: "warning" | "critical";
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "AWS Access Key",
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: "critical",
  },
  {
    name: "Private Key",
    pattern: /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/g,
    severity: "critical",
  },
  {
    name: "Generic API Key",
    pattern: /(api[_-]?key|apikey|secret[_-]?key)\s*[=:]\s*['"][A-Za-z0-9_-]{20,1000}['"]/gi,
    severity: "warning",
  },
  {
    name: "JWT Token",
    pattern: /eyJ[A-Za-z0-9_-]{1,500}\.eyJ[A-Za-z0-9_-]{1,500}\.[A-Za-z0-9_-]{1,500}/g,
    severity: "warning",
  },
];

export class SecurityScanner implements Scanner {
  name = "security";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    // 1. Hardcoded secrets detection
    const secretFindings = await this.detectSecrets(rootDir);
    findings.push(...secretFindings);

    // 2. .env files in git
    const envFindings = await this.detectEnvInGit(rootDir);
    findings.push(...envFindings);

    // 3. eval() usage
    const evalFindings = await this.detectEvalUsage(rootDir);
    findings.push(...evalFindings);

    return {
      findings,
      stats: {
        secretsFound: secretFindings.length,
        envFilesInGit: envFindings.length,
        evalUsage: evalFindings.length,
      },
    };
  }

  private async detectSecrets(rootDir: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"], {
      cwd: rootDir,
      ignore: [
        ...IGNORE_PATTERNS,
        "**/test/**",
        "**/tests/**",
        "**/__tests__/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/examples/**",
        "**/demo/**",
      ],
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        for (const { name, pattern, severity } of SECRET_PATTERNS) {
          pattern.lastIndex = 0; // Reset regex state
          const matches = content.match(pattern);
          if (matches) {
            findings.push({
              id: `secret-${rel}-${name.replace(/\s+/g, "-")}`,
              severity,
              category: "secrets",
              message: `Potential ${name} found in ${rel}`,
              file: rel,
              detail: `${matches.length} match(es)`,
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return findings;
  }

  private async detectEnvInGit(rootDir: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check if git repo
    const gitCheck = spawnSync("git", ["rev-parse", "--git-dir"], {
      cwd: rootDir,
      stdio: "pipe",
    });

    if (gitCheck.status !== 0) {
      return findings; // Not a git repo
    }

    // Get tracked files
    const envFiles = spawnSync("git", ["ls-files"], {
      cwd: rootDir,
      encoding: "utf-8",
      stdio: "pipe",
    });

    if (envFiles.status === 0 && envFiles.stdout) {
      const trackedFiles = envFiles.stdout.split("\n").filter(Boolean);
      const envInGit = trackedFiles.filter((f) => /\.env(\.|$)/.test(f));

      for (const envFile of envInGit) {
        findings.push({
          id: `env-in-git-${envFile}`,
          severity: "critical",
          category: "env-in-git",
          message: `${envFile} is tracked in git — secrets may be exposed`,
          file: envFile,
        });
      }
    }

    return findings;
  }

  private async detectEvalUsage(rootDir: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    const files = await fg(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"], {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const rel = relativePath(rootDir, file);

        if (/\beval\s*\(/.test(content)) {
          findings.push({
            id: `eval-${rel}`,
            severity: "warning",
            category: "eval-usage",
            message: `${rel} uses eval() — potential code injection risk`,
            file: rel,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }

    return findings;
  }
}

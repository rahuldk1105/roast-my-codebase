import fg from "fast-glob";
import { Scanner, ScanResult, Finding, CustomRule } from "../types/index.js";
import { IGNORE_PATTERNS, SAFE_GLOB_OPTIONS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";
import { readFileSafely } from "../utils/security.js";

const DEFAULT_FILE_PATTERN =
  "**/*.{ts,tsx,js,jsx,py,go,rs,java,cs,rb,php,swift,kt}";

export class CustomRulesScanner implements Scanner {
  name = "custom-rules";
  private rules: CustomRule[];

  constructor(rules: CustomRule[]) {
    this.rules = rules;
  }

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    for (const rule of this.rules) {
      // Compile regex — skip rule if pattern is invalid
      let regex: RegExp;
      try {
        regex = new RegExp(rule.pattern);
      } catch {
        console.warn(
          `custom-rules: skipping rule "${rule.id}" — invalid regex pattern: ${rule.pattern}`
        );
        continue;
      }

      const filePattern = rule.filePattern || DEFAULT_FILE_PATTERN;
      const ignorePatterns = [
        ...IGNORE_PATTERNS,
        ...(rule.exclude || []),
      ];

      const files = await fg(filePattern, {
        cwd: rootDir,
        ignore: ignorePatterns,
        ...SAFE_GLOB_OPTIONS,
        absolute: true,
      });

      const maxPerFile = rule.maxPerFile ?? 1;

      for (const file of files) {
        const content = readFileSafely(file);
        if (content === null) continue;

        const rel = relativePath(rootDir, file);
        const lines = content.split("\n");
        let countForFile = 0;

        for (let i = 0; i < lines.length; i++) {
          if (countForFile >= maxPerFile) break;

          // Reset lastIndex each iteration (needed for 'g' flag regexes)
          regex.lastIndex = 0;
          if (!regex.test(lines[i])) continue;

          const message = rule.message
            .replace(/\{file\}/g, rel)
            .replace(/\{line\}/g, String(i + 1));

          const finding: Finding = {
            id: `custom-${rule.id}-${rel}-${i}`,
            severity: rule.severity,
            category: rule.category || "custom-rule",
            message,
            file: rel,
            detail: `Line ${i + 1}: ${lines[i].trim().slice(0, 100)}`,
          };

          findings.push(finding);
          countForFile++;
        }
      }
    }

    return { findings };
  }
}

import fg from "fast-glob";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS, SAFE_GLOB_OPTIONS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

const TEST_FILE_GLOBS = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.test.js",
  "**/*.test.jsx",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/*.spec.js",
  "**/*.spec.jsx",
  "**/__tests__/**/*.ts",
  "**/__tests__/**/*.tsx",
  "**/__tests__/**/*.js",
  "**/__tests__/**/*.jsx",
];

interface TestQualityStats {
  testFiles: number;
  totalFindings: number;
  skippedTests: number;
  focusedTests: number;
}

export class TestQualityScanner implements Scanner {
  name = "test-quality";

  async scan(rootDir: string): Promise<ScanResult & { stats: TestQualityStats }> {
    const findings: Finding[] = [];

    const files = await fg(TEST_FILE_GLOBS, {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      ...SAFE_GLOB_OPTIONS,
      absolute: true,
    });

    let totalSkipped = 0;
    let totalFocused = 0;

    // For duplicate description detection
    const descriptionCounts = new Map<string, number>();

    for (const file of files) {
      const rel = relativePath(rootDir, file);
      let content: string;
      try {
        content = fs.readFileSync(file, "utf-8");
      } catch {
        continue;
      }

      // Strip single-line comments to avoid false positives from commented-out code.
      // We join non-comment lines for pattern matching that should not match comments.
      const nonCommentLines = content
        .split("\n")
        .map((line) => {
          const trimmed = line.trimStart();
          return trimmed.startsWith("//") ? "" : line;
        })
        .join("\n");

      // --- Check 9: Test file with no tests ---
      // Recognise plain calls and method calls like it.skip / it.only / test.skip / test.only
      // eslint-disable-next-line security/detect-unsafe-regex
      const hasTestCalls = /\bit[\s.[(]|\btest[\s.[(]|\bdescribe[\s.[(]/.test(content);
      if (!hasTestCalls) {
        findings.push({
          id: `test-quality-no-tests-${rel}`,
          severity: "warning",
          category: "test-quality",
          message: `${rel} looks like a test file but has no test cases`,
          file: rel,
        });
        continue;
      }

      // --- Check 1: Empty describe/test blocks ---
      // Match patterns like: describe('name', () => {}) or it('name', () => {})
      // The empty body can be in the arrow function: it('foo', () => {})
      // Also matches: describe('name') {} style (less common)
      // eslint-disable-next-line security/detect-unsafe-regex
      const emptyArrowBlockRe = /\b(?:describe|it|test)(?:\.skip|\.only)?\s*\([^)]*\)\s*=>\s*\{\s*\}/g;
      // eslint-disable-next-line security/detect-unsafe-regex
      const emptyCallbackRe = /\b(?:describe|it|test)(?:\.skip|\.only)?\s*\(\s*['"`][^'"`]*['"`]\s*,\s*\(\s*\)\s*\{\s*\}\s*\)/g;

      const emptyMatches =
        (content.match(emptyArrowBlockRe) || []).length +
        (content.match(emptyCallbackRe) || []).length;

      if (emptyMatches > 0) {
        findings.push({
          id: `test-quality-empty-block-${rel}`,
          severity: "warning",
          category: "test-quality",
          message: `Empty test block in ${rel} — tests that do nothing are worse than no tests`,
          file: rel,
        });
      }

      // --- Check 2: No assertions ratio ---
      // eslint-disable-next-line security/detect-unsafe-regex
      const itCount = (content.match(/\bit\s*\(/g) || []).length;
      // eslint-disable-next-line security/detect-unsafe-regex
      const testCount = (content.match(/\btest\s*\(/g) || []).length;
      const totalTestCount = itCount + testCount;

      const expectCount =
        (content.match(/\bexpect\s*\(/g) || []).length +
        (content.match(/\bassert\./g) || []).length +
        (content.match(/\bshould\./g) || []).length +
        (content.match(/\bsinon\.assert\b/g) || []).length +
        (content.match(/\bchai\.assert\b/g) || []).length;

      if (totalTestCount >= 3 && expectCount / totalTestCount < 0.3) {
        findings.push({
          id: `test-quality-no-assert-${rel}`,
          severity: "warning",
          category: "test-quality",
          message: `${rel} has ${totalTestCount} tests but only ${expectCount} assertions — tests may not be verifying anything`,
          file: rel,
        });
      }

      // --- Check 3: Always-true assertions ---
      // Use nonCommentLines so patterns inside // comments don't trigger false positives.
      // eslint-disable-next-line security/detect-unsafe-regex
      const alwaysTruePatterns = [
        /expect\s*\(\s*true\s*\)\s*\.\s*toBe\s*\(\s*true\s*\)/,
        /expect\s*\(\s*1\s*\)\s*\.\s*toBe\s*\(\s*1\s*\)/,
        /assert\s*\(\s*true\s*\)/,
      ];

      // Check for identical string comparisons: expect('foo').toBe('foo')
      // eslint-disable-next-line security/detect-unsafe-regex
      const stringSelfCompare = /expect\s*\(\s*(['"])([^'"]+)\1\s*\)\s*\.\s*toBe\s*\(\s*(['"])([^'"]+)\3\s*\)/g;
      let strMatch: RegExpExecArray | null;
      let hasAlwaysTrue = alwaysTruePatterns.some((re) => re.test(nonCommentLines));

      if (!hasAlwaysTrue) {
        stringSelfCompare.lastIndex = 0;
        // eslint-disable-next-line no-cond-assign
        while ((strMatch = stringSelfCompare.exec(nonCommentLines)) !== null) {
          if (strMatch[2] === strMatch[4]) {
            hasAlwaysTrue = true;
            break;
          }
        }
      }

      if (hasAlwaysTrue) {
        findings.push({
          id: `test-quality-always-true-${rel}`,
          severity: "critical",
          category: "test-quality",
          message: `${rel} has always-true assertions — these tests always pass regardless of code behavior`,
          file: rel,
        });
      }

      // --- Check 4: Skipped tests (count for project-level finding) ---
      // Use nonCommentLines so commented-out it.skip() calls don't inflate the count.
      // eslint-disable-next-line security/detect-unsafe-regex
      const skipPatterns = [
        /\bit\.skip\s*\(/g,
        /\btest\.skip\s*\(/g,
        /\bxit\s*\(/g,
        /\bxdescribe\s*\(/g,
        /\bdescribe\.skip\s*\(/g,
      ];
      for (const re of skipPatterns) {
        const matches = nonCommentLines.match(re) || [];
        totalSkipped += matches.length;
      }

      // --- Check 5: Console.log in tests ---
      if (/\bconsole\.log\s*\(/.test(content)) {
        findings.push({
          id: `test-quality-console-log-${rel}`,
          severity: "info",
          category: "test-quality",
          message: `${rel} has console.log in tests — clean up debug output`,
          file: rel,
        });
      }

      // --- Check 6: Focused tests (.only) ---
      // eslint-disable-next-line security/detect-unsafe-regex
      const onlyPatterns = [
        /\bit\.only\s*\(/g,
        /\btest\.only\s*\(/g,
        /\bdescribe\.only\s*\(/g,
      ];
      let fileFocused = 0;
      for (const re of onlyPatterns) {
        const matches = content.match(re) || [];
        fileFocused += matches.length;
      }
      totalFocused += fileFocused;

      if (fileFocused > 0) {
        findings.push({
          id: `test-quality-only-${rel}`,
          severity: "critical",
          category: "test-quality",
          message: `${rel} uses .only — this makes other tests not run in CI`,
          file: rel,
        });
      }

      // --- Check 7: Hardcoded sleep/wait ---
      // eslint-disable-next-line security/detect-unsafe-regex
      const sleepPatterns = [
        /setTimeout\s*\(.*\d{3,}/,
        /\bsleep\s*\(\d+\)/,
        /await\s+new\s+Promise.*setTimeout/,
      ];
      const hasSleep = sleepPatterns.some((re) => re.test(content));
      if (hasSleep) {
        findings.push({
          id: `test-quality-sleep-${rel}`,
          severity: "warning",
          category: "test-quality",
          message: `${rel} has hardcoded delays in tests — use proper async patterns`,
          file: rel,
        });
      }

      // --- Check 8: Collect test description strings for copy-paste detection ---
      // eslint-disable-next-line security/detect-unsafe-regex
      const descRe = /\b(?:it|test)\s*\(\s*(['"`])((?:(?!\1).)+)\1/g;
      let descMatch: RegExpExecArray | null;
      // eslint-disable-next-line no-cond-assign
      while ((descMatch = descRe.exec(content)) !== null) {
        const desc = descMatch[2];
        descriptionCounts.set(desc, (descriptionCounts.get(desc) ?? 0) + 1);
      }

      // --- Check 10: Snapshot tests without update strategy ---
      // eslint-disable-next-line security/detect-unsafe-regex
      const snapshotCount =
        (content.match(/\btoMatchSnapshot\s*\(\s*\)/g) || []).length +
        (content.match(/\btoMatchInlineSnapshot\s*\(/g) || []).length;

      if (snapshotCount > 3) {
        findings.push({
          id: `test-quality-snapshot-${rel}`,
          severity: "info",
          category: "test-quality",
          message: `${rel} uses snapshot tests — ensure snapshots are reviewed on changes`,
          file: rel,
        });
      }
    }

    // --- Check 4 (project-level): Skipped tests ---
    if (totalSkipped > 3) {
      findings.push({
        id: "test-quality-skipped",
        severity: "info",
        category: "test-quality",
        message: `${totalSkipped} skipped tests across the project — ${totalSkipped > 10 ? "they may have been forgotten" : "remember to re-enable them"}`,
      });
    }

    // --- Check 8 (project-level): Duplicate test descriptions ---
    let duplicateFindingsCount = 0;
    for (const [desc, count] of descriptionCounts.entries()) {
      if (count >= 3 && duplicateFindingsCount < 5) {
        findings.push({
          id: `test-quality-duplicate-desc-${desc.slice(0, 40).replace(/\s+/g, "-")}`,
          severity: "info",
          category: "test-quality",
          message: `Test description "${desc}" appears ${count} times — possible copy-paste`,
        });
        duplicateFindingsCount++;
      }
    }

    return {
      findings,
      stats: {
        testFiles: files.length,
        totalFindings: findings.length,
        skippedTests: totalSkipped,
        focusedTests: totalFocused,
      },
    };
  }
}

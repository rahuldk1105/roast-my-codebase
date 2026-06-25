import fg from "fast-glob";
import path from "path";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";

export class TestCoverageScanner implements Scanner {
  name = "test-coverage";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    // Get all source files
    const sourceFiles = await fg(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"], {
      cwd: rootDir,
      ignore: [
        ...IGNORE_PATTERNS,
        "**/*.test.*",
        "**/*.spec.*",
        "**/__tests__/**",
        "**/*.d.ts",
        "**/index.ts",
        "**/index.js",
        "**/*.config.*",
      ],
      absolute: false,
    });

    // Get all test files
    const testFiles = await fg(
      [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.test.js",
        "**/*.test.jsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/*.spec.js",
        "**/*.spec.jsx",
      ],
      {
        cwd: rootDir,
        ignore: IGNORE_PATTERNS,
        absolute: false,
      }
    );

    const testFileSet = new Set(testFiles.map(normalizeTestPath));

    // Check each source file for corresponding test
    let missingTestCount = 0;
    for (const sourceFile of sourceFiles) {
      const hasTest = hasCorrespondingTest(sourceFile, testFileSet);

      if (!hasTest) {
        missingTestCount++;
        if (missingTestCount <= 10) {
          findings.push({
            id: `missing-test-${sourceFile}`,
            severity: "info",
            category: "test-coverage",
            message: `${sourceFile} has no corresponding test file`,
            file: sourceFile,
          });
        }
      }
    }

    if (missingTestCount > 10) {
      findings.push({
        id: "many-missing-tests",
        severity: "info",
        category: "test-coverage",
        message: `...and ${missingTestCount - 10} more files without tests`,
      });
    }

    const coveragePercent =
      sourceFiles.length > 0
        ? ((sourceFiles.length - missingTestCount) / sourceFiles.length * 100).toFixed(1)
        : "100.0";

    return {
      findings,
      stats: {
        sourceFiles: sourceFiles.length,
        missingTests: missingTestCount,
        coveragePercent,
      },
    };
  }
}

function hasCorrespondingTest(sourceFile: string, testFileSet: Set<string>): boolean {
  const dir = path.dirname(sourceFile);
  const base = path.basename(sourceFile, path.extname(sourceFile));
  const ext = path.extname(sourceFile);

  // Check common test locations
  const possibleTests = [
    path.join(dir, `${base}.test${ext}`),
    path.join(dir, `${base}.spec${ext}`),
    path.join(dir, "__tests__", `${base}.test${ext}`),
    path.join(dir, "__tests__", `${base}.spec${ext}`),
  ];

  return possibleTests.some((test) => testFileSet.has(normalizeTestPath(test)));
}

function normalizeTestPath(testPath: string): string {
  // Normalize path separators for cross-platform compatibility
  return testPath.replace(/\\/g, "/");
}

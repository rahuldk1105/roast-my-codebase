import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { TestQualityScanner } from "../../src/scanners/test-quality.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const alwaysTrueFixture = `
import { describe, it, expect } from 'vitest';
describe('foo', () => {
  it('always passes', () => {
    expect(true).toBe(true);
  });
});
`;

const onlyFixture = `
it.only('focused test', () => {
  expect(1).toBe(1);
});
`;

const skippedFixture = `
it.skip('skipped 1', () => {});
it.skip('skipped 2', () => {});
it.skip('skipped 3', () => {});
it.skip('skipped 4', () => {});
`;

const noAssertFixture = `
describe('suite', () => {
  it('test 1', () => { const x = 1; });
  it('test 2', () => { const y = 2; });
  it('test 3', () => { const z = 3; });
  it('test 4', () => { const w = 4; });
  it('test 5', () => { const v = 5; });
});
`;

const emptyBlockFixture = `
describe('empty', () => {
  it('empty test', () => {});
});
`;

const consoleLogFixture = `
import { it, expect } from 'vitest';
it('logs stuff', () => {
  console.log('debug value');
  expect(1).toBe(1);
});
`;

const cleanFixture = `
import { describe, it, expect } from 'vitest';
describe('clean suite', () => {
  it('adds numbers', () => {
    expect(1 + 1).toBe(2);
  });
  it('subtracts numbers', () => {
    expect(5 - 3).toBe(2);
  });
  it('multiplies numbers', () => {
    expect(2 * 3).toBe(6);
  });
});
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeTestFile(dir: string, name: string, content: string): void {
  fs.writeFileSync(path.join(dir, name), content, "utf-8");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TestQualityScanner", () => {
  let tmpDir: string;
  const scanner = new TestQualityScanner();

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-quality-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects always-true assertions", async () => {
    writeTestFile(tmpDir, "foo.test.ts", alwaysTrueFixture);

    const result = await scanner.scan(tmpDir);
    const finding = result.findings.find((f) =>
      f.id.includes("always-true")
    );

    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("critical");
    expect(finding!.category).toBe("test-quality");
    expect(finding!.message).toContain("always-true assertions");
  });

  it("detects .only with critical severity", async () => {
    writeTestFile(tmpDir, "focused.test.ts", onlyFixture);

    const result = await scanner.scan(tmpDir);
    const finding = result.findings.find((f) =>
      f.id.includes("only")
    );

    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("critical");
    expect(finding!.category).toBe("test-quality");
    expect(finding!.message).toContain(".only");
  });

  it("triggers project-level finding when skipped tests exceed 3", async () => {
    writeTestFile(tmpDir, "skipped.test.ts", skippedFixture);

    const result = await scanner.scan(tmpDir);
    const finding = result.findings.find((f) =>
      f.id === "test-quality-skipped"
    );

    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("info");
    expect(finding!.category).toBe("test-quality");
    expect(finding!.message).toMatch(/4 skipped tests/);
  });

  it("does not add skipped finding when skip count is 3 or fewer", async () => {
    const fewSkips = `
      it.skip('s1', () => {});
      it.skip('s2', () => {});
      it.skip('s3', () => {});
    `;
    writeTestFile(tmpDir, "few-skipped.test.ts", fewSkips);

    const result = await scanner.scan(tmpDir);
    const finding = result.findings.find((f) =>
      f.id === "test-quality-skipped"
    );

    expect(finding).toBeUndefined();
  });

  it("triggers warning when assertion ratio is too low", async () => {
    writeTestFile(tmpDir, "no-assert.test.ts", noAssertFixture);

    const result = await scanner.scan(tmpDir);
    const finding = result.findings.find((f) =>
      f.id.includes("no-assert")
    );

    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
    expect(finding!.category).toBe("test-quality");
    expect(finding!.message).toContain("assertions");
  });

  it("detects empty test blocks", async () => {
    writeTestFile(tmpDir, "empty.test.ts", emptyBlockFixture);

    const result = await scanner.scan(tmpDir);
    const finding = result.findings.find((f) =>
      f.id.includes("empty-block")
    );

    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
    expect(finding!.category).toBe("test-quality");
    expect(finding!.message).toContain("Empty test block");
  });

  it("detects console.log in test files", async () => {
    writeTestFile(tmpDir, "console.test.ts", consoleLogFixture);

    const result = await scanner.scan(tmpDir);
    const finding = result.findings.find((f) =>
      f.id.includes("console-log")
    );

    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("info");
    expect(finding!.category).toBe("test-quality");
    expect(finding!.message).toContain("console.log");
  });

  it("produces no findings for a clean test file", async () => {
    writeTestFile(tmpDir, "clean.test.ts", cleanFixture);

    const result = await scanner.scan(tmpDir);

    // Clean file should produce no findings (the clean fixture has good assertions)
    expect(result.findings).toHaveLength(0);
  });

  it("assigns category 'test-quality' to all findings", async () => {
    writeTestFile(tmpDir, "always-true.test.ts", alwaysTrueFixture);
    writeTestFile(tmpDir, "only.test.ts", onlyFixture);
    writeTestFile(tmpDir, "skipped.test.ts", skippedFixture);

    const result = await scanner.scan(tmpDir);

    for (const finding of result.findings) {
      expect(finding.category).toBe("test-quality");
    }
  });

  it("detects test file with no test cases", async () => {
    writeTestFile(tmpDir, "empty-file.test.ts", "// just a comment\nconst x = 1;\n");

    const result = await scanner.scan(tmpDir);
    const finding = result.findings.find((f) =>
      f.id.includes("no-tests")
    );

    expect(finding).toBeDefined();
    expect(finding!.severity).toBe("warning");
    expect(finding!.category).toBe("test-quality");
    expect(finding!.message).toContain("no test cases");
  });

  it("returns correct stats", async () => {
    writeTestFile(tmpDir, "skipped.test.ts", skippedFixture);
    writeTestFile(tmpDir, "focused.test.ts", onlyFixture);

    const result = await scanner.scan(tmpDir);
    const stats = result.stats as {
      testFiles: number;
      totalFindings: number;
      skippedTests: number;
      focusedTests: number;
    };

    expect(stats.testFiles).toBe(2);
    expect(stats.skippedTests).toBe(4);
    expect(stats.focusedTests).toBe(1);
    expect(stats.totalFindings).toBe(result.findings.length);
  });

  it("returns empty findings for empty directory", async () => {
    const result = await scanner.scan(tmpDir);

    expect(result.findings).toHaveLength(0);
  });

  // --- Edge cases: comment-matching false positives ---

  it("does NOT count it.skip inside a comment as a skipped test", async () => {
    const commented = `
import { describe, it, expect } from 'vitest';
describe('suite', () => {
  // it.skip('was disabled for some reason', () => {});
  it('real test', () => {
    expect(1 + 1).toBe(2);
  });
  it('real test 2', () => {
    expect(2 + 2).toBe(4);
  });
  it('real test 3', () => {
    expect(3 + 3).toBe(6);
  });
  it('real test 4', () => {
    expect(4 + 4).toBe(8);
  });
});
`;
    writeTestFile(tmpDir, "comment-skip.test.ts", commented);
    const result = await scanner.scan(tmpDir);
    const stats = result.stats as { skippedTests: number };
    // The commented-out it.skip should not be counted
    expect(stats.skippedTests).toBe(0);
    // No project-level skipped finding should trigger
    const skippedFinding = result.findings.find((f) => f.id === "test-quality-skipped");
    expect(skippedFinding).toBeUndefined();
  });

  it("does NOT flag expect(true).toBe(true) inside a comment as always-true", async () => {
    const commented = `
import { describe, it, expect } from 'vitest';
describe('suite', () => {
  it('real test', () => {
    // expect(true).toBe(true); // old assertion removed
    expect(1 + 1).toBe(2);
  });
});
`;
    writeTestFile(tmpDir, "comment-assert.test.ts", commented);
    const result = await scanner.scan(tmpDir);
    const alwaysTrue = result.findings.find((f) => f.id.includes("always-true"));
    expect(alwaysTrue).toBeUndefined();
  });

  it("detects describe.only as a focused test (not just it.only)", async () => {
    const describeOnly = `
import { describe, it, expect } from 'vitest';
describe.only('focused suite', () => {
  it('test 1', () => { expect(1).toBe(1); });
});
`;
    writeTestFile(tmpDir, "describe-only.test.ts", describeOnly);
    const result = await scanner.scan(tmpDir);
    const stats = result.stats as { focusedTests: number };
    expect(stats.focusedTests).toBeGreaterThan(0);
    const onlyFinding = result.findings.find((f) => f.id.includes("only"));
    expect(onlyFinding).toBeDefined();
    expect(onlyFinding!.severity).toBe("critical");
  });
});

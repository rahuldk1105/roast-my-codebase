import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { isGitHubActions, writeGitHubStepSummary } from "../src/report/github-summary.js";
import { RoastReport } from "../src/types/index.js";

function makeReport(overrides: Partial<RoastReport> = {}): RoastReport {
  return {
    projectName: "test-project",
    stats: {
      totalFiles: 50,
      sourceFiles: 40,
      totalLines: 12500,
      largestFiles: [],
      dependencies: 12,
      devDependencies: 8,
    },
    health: {
      score: 72,
      grade: "B",
      label: "Good",
    },
    findings: [
      {
        id: "f1",
        severity: "critical",
        category: "complexity",
        message: "auth.service.ts is too complex",
        file: "auth.service.ts",
      },
      {
        id: "f2",
        severity: "warning",
        category: "dead-code",
        message: "Unused export formatDate",
        file: "utils/helpers.ts",
      },
      {
        id: "f3",
        severity: "info",
        category: "style",
        message: "Consider adding JSDoc comments",
      },
    ],
    roasts: [
      {
        target: "auth.service.ts",
        message: "This file has achieved sentience.",
        category: "complexity",
      },
    ],
    verdict: "Your codebase needs some love.",
    fixes: [],
    ...overrides,
  };
}

describe("isGitHubActions", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    originalEnv.GITHUB_ACTIONS = process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_ACTIONS;
  });

  afterEach(() => {
    if (originalEnv.GITHUB_ACTIONS === undefined) {
      delete process.env.GITHUB_ACTIONS;
    } else {
      process.env.GITHUB_ACTIONS = originalEnv.GITHUB_ACTIONS;
    }
  });

  it("returns false when GITHUB_ACTIONS env is not set", () => {
    expect(isGitHubActions()).toBe(false);
  });

  it("returns true when GITHUB_ACTIONS=true", () => {
    process.env.GITHUB_ACTIONS = "true";
    expect(isGitHubActions()).toBe(true);
  });

  it("returns true for any truthy GITHUB_ACTIONS value", () => {
    process.env.GITHUB_ACTIONS = "1";
    expect(isGitHubActions()).toBe(true);
  });
});

describe("writeGitHubStepSummary", () => {
  const originalEnv: Record<string, string | undefined> = {};
  let tmpFile: string | null = null;

  beforeEach(() => {
    originalEnv.GITHUB_STEP_SUMMARY = process.env.GITHUB_STEP_SUMMARY;
    delete process.env.GITHUB_STEP_SUMMARY;
    tmpFile = null;
  });

  afterEach(() => {
    if (originalEnv.GITHUB_STEP_SUMMARY === undefined) {
      delete process.env.GITHUB_STEP_SUMMARY;
    } else {
      process.env.GITHUB_STEP_SUMMARY = originalEnv.GITHUB_STEP_SUMMARY;
    }
    // Clean up temp file
    if (tmpFile && fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  });

  function createTempFile(): string {
    const file = path.join(os.tmpdir(), `roast-test-summary-${Date.now()}.md`);
    fs.writeFileSync(file, "", "utf-8");
    return file;
  }

  it("writes nothing when GITHUB_STEP_SUMMARY is not set", () => {
    // Should not throw
    expect(() => writeGitHubStepSummary(makeReport())).not.toThrow();
  });

  it("writes to the summary file when GITHUB_STEP_SUMMARY is set", () => {
    tmpFile = createTempFile();
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    writeGitHubStepSummary(makeReport());

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });

  it("written content contains the health score", () => {
    tmpFile = createTempFile();
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    writeGitHubStepSummary(makeReport());

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content).toContain("72/100");
  });

  it("written content contains the project name", () => {
    tmpFile = createTempFile();
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    writeGitHubStepSummary(makeReport());

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content).toContain("test-project");
  });

  it("written content includes a findings table for critical findings", () => {
    tmpFile = createTempFile();
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    writeGitHubStepSummary(makeReport());

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content).toContain("Top Findings");
    expect(content).toContain("auth.service.ts is too complex");
  });

  it("appends to existing content (does not overwrite)", () => {
    tmpFile = createTempFile();
    fs.writeFileSync(tmpFile, "# Existing content\n", "utf-8");
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    writeGitHubStepSummary(makeReport());

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content).toContain("# Existing content");
    expect(content).toContain("72/100");
  });

  it("gracefully handles report with no findings", () => {
    tmpFile = createTempFile();
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    const report = makeReport({ findings: [] });
    expect(() => writeGitHubStepSummary(report)).not.toThrow();

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content).toContain("72/100");
    // No findings table should appear when there are no criticals/warnings
    expect(content).not.toContain("Top Findings");
  });

  it("gracefully handles missing stats gracefully", () => {
    tmpFile = createTempFile();
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    const report = makeReport({
      stats: {
        totalFiles: 0,
        sourceFiles: 0,
        totalLines: 0,
        largestFiles: [],
        dependencies: 0,
        devDependencies: 0,
      },
    });
    expect(() => writeGitHubStepSummary(report)).not.toThrow();

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content).toContain("| Files | 0 |");
  });

  it("uses correct score emoji for high score (>=80)", () => {
    tmpFile = createTempFile();
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    writeGitHubStepSummary(makeReport({ health: { score: 85, grade: "A", label: "Excellent" } }));

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content).toContain("✅");
  });

  it("uses warning emoji for mid score (60-79)", () => {
    tmpFile = createTempFile();
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    writeGitHubStepSummary(makeReport({ health: { score: 65, grade: "C", label: "Fair" } }));

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content).toContain("⚠️");
  });

  it("uses red circle emoji for low score (<60)", () => {
    tmpFile = createTempFile();
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    writeGitHubStepSummary(makeReport({ health: { score: 40, grade: "F", label: "Failing" } }));

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content).toContain("🔴");
  });

  it("contains the verdict text", () => {
    tmpFile = createTempFile();
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    writeGitHubStepSummary(makeReport());

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content).toContain("Your codebase needs some love.");
  });

  it("contains roast-my-codebase footer link", () => {
    tmpFile = createTempFile();
    process.env.GITHUB_STEP_SUMMARY = tmpFile;

    writeGitHubStepSummary(makeReport());

    const content = fs.readFileSync(tmpFile, "utf-8");
    expect(content).toContain("roast-my-codebase");
  });

  it("silently ignores write errors for non-writable path", () => {
    process.env.GITHUB_STEP_SUMMARY = "/nonexistent/path/summary.md";

    // Should not throw even if file is not writable
    expect(() => writeGitHubStepSummary(makeReport())).not.toThrow();
  });
});

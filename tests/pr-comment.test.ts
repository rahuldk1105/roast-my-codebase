import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { formatPRComment, detectPRContext } from "../src/report/pr-comment.js";
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

describe("formatPRComment", () => {
  it("returns a string", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(typeof result).toBe("string");
  });

  it("contains the health score", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(result).toContain("72/100");
  });

  it("contains the grade emoji for B grade", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    // B grade → 🟢
    expect(result).toContain("🟢");
  });

  it("contains ✅ for A grade", () => {
    const report = makeReport({ health: { score: 95, grade: "A+", label: "Excellent" } });
    const result = formatPRComment(report);
    expect(result).toContain("✅");
  });

  it("contains 🔴 for F grade", () => {
    const report = makeReport({ health: { score: 30, grade: "F", label: "Failing" } });
    const result = formatPRComment(report);
    expect(result).toContain("🔴");
  });

  it("contains the roast-my-codebase HTML marker", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(result).toContain("<!-- roast-my-codebase -->");
  });

  it("contains stats table headers", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(result).toContain("| Metric | Value |");
    expect(result).toContain("| Files  |");
    expect(result).toContain("| Lines  |");
    expect(result).toContain("| Deps   |");
  });

  it("contains findings summary with critical count", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(result).toContain("1 critical");
  });

  it("contains findings summary with warning count", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(result).toContain("1 warnings");
  });

  it("contains top finding file reference", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(result).toContain("`auth.service.ts`");
  });

  it("contains roast target in blockquote", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(result).toContain("> 🔥 **auth.service.ts**");
  });

  it("contains verdict in italics", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(result).toContain("*Your codebase needs some love.*");
  });

  it("contains footer link", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(result).toContain("roast-my-codebase");
    expect(result).toContain("https://github.com/rahuldk1105/roast-my-codebase");
  });

  it("stays within GitHub comment character limit", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(result.length).toBeLessThanOrEqual(65000);
  });

  it("handles report with no findings", () => {
    const report = makeReport({ findings: [] });
    const result = formatPRComment(report);
    expect(typeof result).toBe("string");
    expect(result).toContain("72/100");
  });

  it("handles report with no roasts", () => {
    const report = makeReport({ roasts: [] });
    const result = formatPRComment(report);
    expect(typeof result).toBe("string");
    expect(result).toContain("<!-- roast-my-codebase -->");
  });

  it("formats large line counts with k suffix", () => {
    const report = makeReport({
      stats: {
        totalFiles: 100,
        sourceFiles: 80,
        totalLines: 64000,
        largestFiles: [],
        dependencies: 10,
        devDependencies: 5,
      },
    });
    const result = formatPRComment(report);
    expect(result).toContain("64k");
  });

  it("renders health bar with filled and empty blocks", () => {
    const report = makeReport();
    const result = formatPRComment(report);
    expect(result).toMatch(/\[█+░+\]/);
  });
});

describe("detectPRContext", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    originalEnv.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    originalEnv.GH_TOKEN = process.env.GH_TOKEN;
    originalEnv.GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
    originalEnv.GITHUB_EVENT_PATH = process.env.GITHUB_EVENT_PATH;

    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_EVENT_PATH;
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(originalEnv)) {
      if (val === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = val;
      }
    }
  });

  it("returns null when no env vars are set", () => {
    expect(detectPRContext()).toBeNull();
  });

  it("returns null when GITHUB_TOKEN is missing", () => {
    process.env.GITHUB_REPOSITORY = "owner/repo";
    process.env.GITHUB_EVENT_PATH = "/nonexistent/path.json";
    expect(detectPRContext()).toBeNull();
  });

  it("returns null when GITHUB_REPOSITORY is missing", () => {
    process.env.GITHUB_TOKEN = "tok";
    process.env.GITHUB_EVENT_PATH = "/nonexistent/path.json";
    expect(detectPRContext()).toBeNull();
  });

  it("returns null when GITHUB_EVENT_PATH is missing", () => {
    process.env.GITHUB_TOKEN = "tok";
    process.env.GITHUB_REPOSITORY = "owner/repo";
    expect(detectPRContext()).toBeNull();
  });

  it("returns null when event file does not exist", () => {
    process.env.GITHUB_TOKEN = "tok";
    process.env.GITHUB_REPOSITORY = "owner/repo";
    process.env.GITHUB_EVENT_PATH = "/does/not/exist/event.json";
    expect(detectPRContext()).toBeNull();
  });

  it("reads GITHUB_REPOSITORY correctly when set", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    const tmpFile = path.join(os.tmpdir(), `roast-test-event-${Date.now()}.json`);
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({ pull_request: { number: 42 } }),
      "utf-8"
    );

    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPOSITORY = "myorg/myrepo";
    process.env.GITHUB_EVENT_PATH = tmpFile;

    const result = detectPRContext();

    fs.unlinkSync(tmpFile);

    expect(result).not.toBeNull();
    expect(result?.repo).toBe("myorg/myrepo");
    expect(result?.token).toBe("test-token");
    expect(result?.prNumber).toBe(42);
  });

  it("uses GH_TOKEN as fallback when GITHUB_TOKEN is not set", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    const tmpFile = path.join(os.tmpdir(), `roast-test-event-${Date.now()}.json`);
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({ pull_request: { number: 7 } }),
      "utf-8"
    );

    process.env.GH_TOKEN = "gh-fallback-token";
    process.env.GITHUB_REPOSITORY = "myorg/myrepo";
    process.env.GITHUB_EVENT_PATH = tmpFile;

    const result = detectPRContext();

    fs.unlinkSync(tmpFile);

    expect(result).not.toBeNull();
    expect(result?.token).toBe("gh-fallback-token");
  });

  it("returns null when event file has no pull_request key", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    const tmpFile = path.join(os.tmpdir(), `roast-test-event-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ push: { ref: "refs/heads/main" } }), "utf-8");

    process.env.GITHUB_TOKEN = "tok";
    process.env.GITHUB_REPOSITORY = "myorg/myrepo";
    process.env.GITHUB_EVENT_PATH = tmpFile;

    const result = detectPRContext();

    fs.unlinkSync(tmpFile);

    expect(result).toBeNull();
  });

  it("returns null when event file contains invalid JSON", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    const tmpFile = path.join(os.tmpdir(), `roast-test-event-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, "{ not valid json {{", "utf-8");

    process.env.GITHUB_TOKEN = "tok";
    process.env.GITHUB_REPOSITORY = "myorg/myrepo";
    process.env.GITHUB_EVENT_PATH = tmpFile;

    const result = detectPRContext();

    fs.unlinkSync(tmpFile);

    expect(result).toBeNull();
  });
});

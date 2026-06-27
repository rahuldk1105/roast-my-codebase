import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { renderJUnitReport, saveJUnitReport } from "../src/report/junit.js";
import { RoastReport, Finding } from "../src/types/index.js";

function makeReport(findings: Finding[], score = 75): RoastReport {
  return {
    projectName: "test-project",
    stats: {
      totalFiles: 10,
      sourceFiles: 8,
      totalLines: 500,
      largestFiles: [],
      dependencies: 3,
      devDependencies: 2,
    },
    health: { score, grade: "B", label: "Good" },
    findings,
    roasts: [],
    verdict: "Decent codebase.",
    fixes: [],
  };
}

describe("renderJUnitReport", () => {
  it("should return a string starting with the XML declaration", () => {
    const report = makeReport([]);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toMatch(/^<\?xml version="1\.0"/);
  });

  it("should contain a <testsuites element", () => {
    const report = makeReport([]);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toContain("<testsuites");
  });

  it("should produce <failure type=\"error\" for a critical finding", () => {
    const report = makeReport([
      {
        id: "f1",
        severity: "critical",
        category: "large-files",
        message: "File is too large",
        file: "src/big.ts",
      },
    ]);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toContain('<failure message="File is too large" type="error">');
  });

  it("should produce <failure type=\"warning\" for a warning finding", () => {
    const report = makeReport([
      {
        id: "f2",
        severity: "warning",
        category: "console-logs",
        message: "Console.log found",
        file: "src/app.ts",
      },
    ]);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toContain('<failure message="Console.log found" type="warning">');
  });

  it("should produce a passing <testcase (no <failure) for an info finding", () => {
    const report = makeReport([
      {
        id: "f3",
        severity: "info",
        category: "missing-tests",
        message: "No tests found",
      },
    ]);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toContain("<testcase");
    expect(output).not.toContain("<failure");
  });

  it("should group findings by category — one <testsuite per category", () => {
    const report = makeReport([
      { id: "f4", severity: "warning", category: "large-files", message: "File A large", file: "src/a.ts" },
      { id: "f5", severity: "warning", category: "large-files", message: "File B large", file: "src/b.ts" },
      { id: "f6", severity: "info",    category: "missing-tests", message: "No tests" },
    ]);
    const output = renderJUnitReport(report, "/tmp");
    // Count occurrences of <testsuite (not testsuites)
    const matches = output.match(/<testsuite /g) ?? [];
    // large-files, missing-tests, health-score → 3 suites
    expect(matches.length).toBe(3);
    expect(output).toContain('name="large-files"');
    expect(output).toContain('name="missing-tests"');
  });

  it("should escape XML special characters in messages", () => {
    const report = makeReport([
      {
        id: "f7",
        severity: "warning",
        category: "security",
        message: "Bad char & <script> 'quote' \"dquote\"",
        file: "src/evil.ts",
      },
    ]);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toContain("&amp;");
    expect(output).toContain("&lt;");
    expect(output).toContain("&gt;");
    expect(output).toContain("&apos;");
    expect(output).toContain("&quot;");
    // Raw unescaped '<' must not appear in attribute values
    const rawLtInAttr = /message="[^"]*<[^"]*"/;
    expect(rawLtInAttr.test(output)).toBe(false);
    // Raw '&' not followed by an XML entity must not appear in attribute values
    const rawAmpInAttr = /message="[^"]*&(?!amp;|lt;|gt;|quot;|apos;)[^"]*"/;
    expect(rawAmpInAttr.test(output)).toBe(false);
  });

  it("should always include a health-score testsuite", () => {
    const report = makeReport([]);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toContain('name="health-score"');
  });

  it("health-score testsuite should be passing when score >= 60", () => {
    const report = makeReport([], 80);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toContain("Health score: 80/100");
    // No failure in health-score section
    const healthSuiteMatch = output.match(/<testsuite name="health-score"[\s\S]*?<\/testsuite>/);
    expect(healthSuiteMatch).toBeTruthy();
    expect(healthSuiteMatch![0]).not.toContain("<failure");
  });

  it("health-score testsuite should be failing when score < 60", () => {
    const report = makeReport([], 40);
    const output = renderJUnitReport(report, "/tmp");
    const healthSuiteMatch = output.match(/<testsuite name="health-score"[\s\S]*?<\/testsuite>/);
    expect(healthSuiteMatch).toBeTruthy();
    expect(healthSuiteMatch![0]).toContain("<failure");
  });

  it("total tests count in testsuites should equal number of findings + 1 (health score)", () => {
    const findings: Finding[] = [
      { id: "f8", severity: "critical", category: "sec", message: "A" },
      { id: "f9", severity: "warning",  category: "sec", message: "B" },
      { id: "f10", severity: "info",    category: "perf", message: "C" },
    ];
    const report = makeReport(findings, 75);
    const output = renderJUnitReport(report, "/tmp");
    const match = output.match(/<testsuites[^>]*tests="(\d+)"/);
    expect(match).toBeTruthy();
    expect(parseInt(match![1], 10)).toBe(findings.length + 1);
  });

  it("critical findings count toward errors in testsuite", () => {
    const report = makeReport([
      { id: "f11", severity: "critical", category: "large-files", message: "Huge", file: "src/x.ts" },
    ]);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toContain('errors="1"');
  });

  it("warning findings count toward failures in testsuite", () => {
    const report = makeReport([
      { id: "f12", severity: "warning", category: "console-logs", message: "Console", file: "src/y.ts" },
    ]);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toContain('failures="1"');
  });

  it("testcase name should be truncated to 100 chars", () => {
    const longMessage = "A".repeat(150);
    const report = makeReport([
      { id: "f13", severity: "info", category: "misc", message: longMessage },
    ]);
    const output = renderJUnitReport(report, "/tmp");
    // The name attribute should contain at most 100 'A's
    const nameMatch = output.match(/name="([^"]+)"/);
    if (nameMatch) {
      expect(nameMatch[1].length).toBeLessThanOrEqual(100);
    }
  });

  it("testcase classname should fall back to category when finding has no file", () => {
    const report = makeReport([
      { id: "f14", severity: "info", category: "missing-tests", message: "No tests" },
    ]);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toContain('classname="missing-tests"');
  });

  it("testcase classname should use file when finding has a file", () => {
    const report = makeReport([
      { id: "f15", severity: "info", category: "large-files", message: "Big", file: "src/big.ts" },
    ]);
    const output = renderJUnitReport(report, "/tmp");
    expect(output).toContain('classname="src/big.ts"');
  });
});

describe("saveJUnitReport", () => {
  const testDir = path.join(process.cwd(), "tests", "fixtures", "junit-test");
  const junitPath = path.join(testDir, ".roast-junit.xml");

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(junitPath)) {
      fs.unlinkSync(junitPath);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
  });

  it("should write JUnit XML content to .roast-junit.xml", () => {
    const report = makeReport([]);
    const xml = renderJUnitReport(report, testDir);
    saveJUnitReport(xml, testDir);

    expect(fs.existsSync(junitPath)).toBe(true);
    const content = fs.readFileSync(junitPath, "utf-8");
    expect(content).toBe(xml);
  });

  it("should overwrite an existing JUnit XML file", () => {
    const report1 = makeReport([]);
    const xml1 = renderJUnitReport(report1, testDir);
    saveJUnitReport(xml1, testDir);

    const report2 = makeReport([
      { id: "f1", severity: "critical", category: "large-files", message: "Big file", file: "src/huge.ts" },
    ]);
    const xml2 = renderJUnitReport(report2, testDir);
    saveJUnitReport(xml2, testDir);

    const content = fs.readFileSync(junitPath, "utf-8");
    expect(content).toBe(xml2);
    expect(content).toContain("large-files");
  });
});

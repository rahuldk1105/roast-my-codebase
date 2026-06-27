import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { renderSarifReport, saveSarifReport } from "../src/report/sarif.js";
import { RoastReport, Finding } from "../src/types/index.js";

function makeReport(findings: Finding[]): RoastReport {
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
    health: { score: 75, grade: "B", label: "Good" },
    findings,
    roasts: [],
    verdict: "Decent codebase.",
    fixes: [],
  };
}

describe("renderSarifReport", () => {
  it("should return valid JSON", () => {
    const report = makeReport([]);
    const output = renderSarifReport(report, "/tmp");
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("should have version 2.1.0", () => {
    const report = makeReport([]);
    const sarif = JSON.parse(renderSarifReport(report, "/tmp"));
    expect(sarif.version).toBe("2.1.0");
  });

  it("should have correct tool driver name", () => {
    const report = makeReport([]);
    const sarif = JSON.parse(renderSarifReport(report, "/tmp"));
    expect(sarif.runs[0].tool.driver.name).toBe("roast-my-codebase");
  });

  it("should map critical severity to level 'error'", () => {
    const report = makeReport([
      {
        id: "f1",
        severity: "critical",
        category: "large-files",
        message: "File is too large",
        file: "src/big.ts",
      },
    ]);
    const sarif = JSON.parse(renderSarifReport(report, "/tmp"));
    expect(sarif.runs[0].results[0].level).toBe("error");
  });

  it("should map warning severity to level 'warning'", () => {
    const report = makeReport([
      {
        id: "f2",
        severity: "warning",
        category: "console-logs",
        message: "Console.log found",
        file: "src/app.ts",
      },
    ]);
    const sarif = JSON.parse(renderSarifReport(report, "/tmp"));
    expect(sarif.runs[0].results[0].level).toBe("warning");
  });

  it("should map info severity to level 'note'", () => {
    const report = makeReport([
      {
        id: "f3",
        severity: "info",
        category: "missing-tests",
        message: "No tests found",
      },
    ]);
    const sarif = JSON.parse(renderSarifReport(report, "/tmp"));
    expect(sarif.runs[0].results[0].level).toBe("note");
  });

  it("should set correct uri for findings with files", () => {
    const report = makeReport([
      {
        id: "f4",
        severity: "warning",
        category: "large-files",
        message: "Large file",
        file: "src/foo/bar.ts",
      },
    ]);
    const sarif = JSON.parse(renderSarifReport(report, "/tmp"));
    const location =
      sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation;
    expect(location.uri).toBe("src/foo/bar.ts");
    expect(location.uriBaseId).toBe("%SRCROOT%");
  });

  it("should use uri '.' for findings without files", () => {
    const report = makeReport([
      {
        id: "f5",
        severity: "info",
        category: "missing-tests",
        message: "No tests found",
      },
    ]);
    const sarif = JSON.parse(renderSarifReport(report, "/tmp"));
    const location =
      sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation;
    expect(location.uri).toBe(".");
    expect(location.uriBaseId).toBeUndefined();
  });

  it("should deduplicate rules by category", () => {
    const report = makeReport([
      {
        id: "f6",
        severity: "warning",
        category: "large-files",
        message: "File A is large",
        file: "src/a.ts",
      },
      {
        id: "f7",
        severity: "warning",
        category: "large-files",
        message: "File B is large",
        file: "src/b.ts",
      },
      {
        id: "f8",
        severity: "info",
        category: "missing-tests",
        message: "No tests",
      },
    ]);
    const sarif = JSON.parse(renderSarifReport(report, "/tmp"));
    const rules = sarif.runs[0].tool.driver.rules;
    // Should have exactly 2 unique categories
    expect(rules.length).toBe(2);
    const ruleIds = rules.map((r: { id: string }) => r.id);
    expect(ruleIds).toContain("large-files");
    expect(ruleIds).toContain("missing-tests");
  });

  it("should convert category to PascalCase rule name", () => {
    const report = makeReport([
      {
        id: "f9",
        severity: "warning",
        category: "nextjs-metadata",
        message: "Missing metadata",
      },
    ]);
    const sarif = JSON.parse(renderSarifReport(report, "/tmp"));
    const rule = sarif.runs[0].tool.driver.rules[0];
    expect(rule.name).toBe("NextjsMetadata");
  });

  it("should deduplicate artifacts by file path", () => {
    const report = makeReport([
      {
        id: "f10",
        severity: "warning",
        category: "large-files",
        message: "File A is large",
        file: "src/a.ts",
      },
      {
        id: "f11",
        severity: "warning",
        category: "console-logs",
        message: "Console.log in A",
        file: "src/a.ts",
      },
      {
        id: "f12",
        severity: "info",
        category: "missing-tests",
        message: "File B lacks tests",
        file: "src/b.ts",
      },
    ]);
    const sarif = JSON.parse(renderSarifReport(report, "/tmp"));
    const artifacts = sarif.runs[0].artifacts;
    expect(artifacts.length).toBe(2);
    const uris = artifacts.map((a: { location: { uri: string } }) => a.location.uri);
    expect(uris).toContain("src/a.ts");
    expect(uris).toContain("src/b.ts");
  });
});

describe("saveSarifReport", () => {
  const testDir = path.join(process.cwd(), "tests", "fixtures", "sarif-test");
  const sarifPath = path.join(testDir, ".roast-results.sarif");

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(sarifPath)) {
      fs.unlinkSync(sarifPath);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
  });

  it("should write SARIF content to .roast-results.sarif", () => {
    const report = makeReport([]);
    const sarif = renderSarifReport(report, testDir);
    saveSarifReport(sarif, testDir);

    expect(fs.existsSync(sarifPath)).toBe(true);
    const content = fs.readFileSync(sarifPath, "utf-8");
    expect(content).toBe(sarif);
  });

  it("should overwrite an existing SARIF file", () => {
    const report1 = makeReport([]);
    const sarif1 = renderSarifReport(report1, testDir);
    saveSarifReport(sarif1, testDir);

    const report2 = makeReport([
      {
        id: "f1",
        severity: "critical",
        category: "large-files",
        message: "Big file",
        file: "src/huge.ts",
      },
    ]);
    const sarif2 = renderSarifReport(report2, testDir);
    saveSarifReport(sarif2, testDir);

    const content = fs.readFileSync(sarifPath, "utf-8");
    expect(content).toBe(sarif2);
    expect(content).toContain("large-files");
  });
});

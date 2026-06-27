import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { saveAllReports } from "../src/report/output-dir.js";
import { RoastReport, Finding } from "../src/types/index.js";

function makeReport(findings: Finding[] = []): RoastReport {
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

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "roast-output-dir-test-"));
}

function rmDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
}

describe("saveAllReports", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmDir(tempDir);
  });

  it("creates the output directory if it does not exist", async () => {
    const outputDir = path.join(tempDir, "new-reports");
    expect(fs.existsSync(outputDir)).toBe(false);

    await saveAllReports(makeReport(), outputDir, tempDir);

    expect(fs.existsSync(outputDir)).toBe(true);
    expect(fs.statSync(outputDir).isDirectory()).toBe(true);
  });

  it("creates all 5 expected report files", async () => {
    const outputDir = path.join(tempDir, "reports");
    await saveAllReports(makeReport(), outputDir, tempDir);

    const expectedFiles = [
      "roast-report.json",
      "roast-report.md",
      "roast-report.html",
      "roast-results.sarif",
      "roast-results.xml",
    ];

    for (const filename of expectedFiles) {
      const filePath = path.join(outputDir, filename);
      expect(fs.existsSync(filePath), `Expected ${filename} to exist`).toBe(true);
    }
  });

  it("returns files array with 5 entries on success", async () => {
    const outputDir = path.join(tempDir, "reports");
    const result = await saveAllReports(makeReport(), outputDir, tempDir);

    expect(result.files).toHaveLength(5);
  });

  it("returns empty errors array on success", async () => {
    const outputDir = path.join(tempDir, "reports");
    const result = await saveAllReports(makeReport(), outputDir, tempDir);

    expect(result.errors).toHaveLength(0);
  });

  it("returns the output directory in result.dir", async () => {
    const outputDir = path.join(tempDir, "reports");
    const result = await saveAllReports(makeReport(), outputDir, tempDir);

    expect(result.dir).toBe(outputDir);
  });

  it("all written files are non-empty", async () => {
    const outputDir = path.join(tempDir, "reports");
    const result = await saveAllReports(makeReport(), outputDir, tempDir);

    for (const filePath of result.files) {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content.length, `Expected ${path.basename(filePath)} to be non-empty`).toBeGreaterThan(0);
    }
  });

  it("JSON file contains valid JSON", async () => {
    const outputDir = path.join(tempDir, "reports");
    await saveAllReports(makeReport(), outputDir, tempDir);

    const jsonPath = path.join(outputDir, "roast-report.json");
    const content = fs.readFileSync(jsonPath, "utf-8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it("JSON file contains correct health score", async () => {
    const outputDir = path.join(tempDir, "reports");
    const report = makeReport();
    await saveAllReports(report, outputDir, tempDir);

    const jsonPath = path.join(outputDir, "roast-report.json");
    const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    expect(parsed.health.score).toBe(75);
  });

  it("SARIF file is valid JSON with correct schema version", async () => {
    const outputDir = path.join(tempDir, "reports");
    await saveAllReports(makeReport(), outputDir, tempDir);

    const sarifPath = path.join(outputDir, "roast-results.sarif");
    const content = fs.readFileSync(sarifPath, "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.version).toBe("2.1.0");
  });

  it("XML file contains JUnit structure", async () => {
    const outputDir = path.join(tempDir, "reports");
    await saveAllReports(makeReport(), outputDir, tempDir);

    const xmlPath = path.join(outputDir, "roast-results.xml");
    const content = fs.readFileSync(xmlPath, "utf-8");
    expect(content).toContain("testsuites");
  });

  it("works with an existing directory without error", async () => {
    const outputDir = path.join(tempDir, "existing-dir");
    fs.mkdirSync(outputDir);

    const result = await saveAllReports(makeReport(), outputDir, tempDir);

    expect(result.errors).toHaveLength(0);
    expect(result.files).toHaveLength(5);
  });

  it("works with nested directory path", async () => {
    const outputDir = path.join(tempDir, "a", "b", "c", "reports");
    const result = await saveAllReports(makeReport(), outputDir, tempDir);

    expect(result.errors).toHaveLength(0);
    expect(fs.existsSync(outputDir)).toBe(true);
    expect(result.files).toHaveLength(5);
  });

  it("files array contains full absolute paths", async () => {
    const outputDir = path.join(tempDir, "reports");
    const result = await saveAllReports(makeReport(), outputDir, tempDir);

    for (const filePath of result.files) {
      expect(path.isAbsolute(filePath), `Expected ${filePath} to be absolute`).toBe(true);
    }
  });

  it("handles a non-writable directory gracefully with errors array populated", async () => {
    // Create a file (not a dir) at the output path to trigger a mkdirSync failure
    const outputDir = path.join(tempDir, "not-a-dir");
    fs.writeFileSync(outputDir, "i am a file, not a directory");

    const result = await saveAllReports(makeReport(), outputDir, tempDir);

    // Either the directory creation fails (errors includes a dir error)
    // or writes fail — either way errors should be non-empty
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

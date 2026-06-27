import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { CustomRulesScanner } from "../src/scanners/custom-rules.js";
import { CustomRule } from "../src/types/index.js";
import { calculateHealth } from "../src/scoring/index.js";

let tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-custom-rules-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
  tmpDirs = [];
});

describe("CustomRulesScanner", () => {
  it("returns no findings when rules array is empty", async () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "index.ts"), "console.log('hello');\n");

    const scanner = new CustomRulesScanner([]);
    const result = await scanner.scan(dir);

    expect(result.findings).toHaveLength(0);
  });

  it("detects a pattern match in a temp file", async () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "index.ts"), "console.log('hello');\n");

    const rule: CustomRule = {
      id: "no-console",
      name: "No console.log",
      pattern: "console\\.log\\(",
      severity: "warning",
      message: "Found console.log",
    };

    const scanner = new CustomRulesScanner([rule]);
    const result = await scanner.scan(dir);

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].severity).toBe("warning");
    expect(result.findings[0].message).toBe("Found console.log");
    expect(result.findings[0].id).toContain("custom-no-console");
  });

  it("substitutes {file} and {line} placeholders in message", async () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "src.ts"), "debugger;\n");

    const rule: CustomRule = {
      id: "no-debugger",
      name: "No debugger",
      pattern: "debugger",
      severity: "warning",
      message: "debugger found in {file} at line {line}",
    };

    const scanner = new CustomRulesScanner([rule]);
    const result = await scanner.scan(dir);

    expect(result.findings.length).toBeGreaterThan(0);
    const finding = result.findings[0];
    expect(finding.message).toContain("src.ts");
    expect(finding.message).toContain("1"); // line 1
    expect(finding.message).not.toContain("{file}");
    expect(finding.message).not.toContain("{line}");
  });

  it("limits results per file to maxPerFile", async () => {
    const dir = makeTmpDir();
    // 5 matching lines
    const lines = Array.from({ length: 5 }, (_, i) => `console.log(${i});`).join("\n");
    fs.writeFileSync(path.join(dir, "many.ts"), lines + "\n");

    const rule: CustomRule = {
      id: "no-console",
      name: "No console.log",
      pattern: "console\\.log\\(",
      severity: "warning",
      message: "console.log found",
      maxPerFile: 2,
    };

    const scanner = new CustomRulesScanner([rule]);
    const result = await scanner.scan(dir);

    expect(result.findings).toHaveLength(2);
  });

  it("skips rules with invalid regex patterns without throwing", async () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "test.ts"), "const x = 1;\n");

    const badRule: CustomRule = {
      id: "bad-regex",
      name: "Bad regex",
      pattern: "[invalid(regex",
      severity: "warning",
      message: "should not appear",
    };

    const scanner = new CustomRulesScanner([badRule]);

    // Should not throw
    await expect(scanner.scan(dir)).resolves.toBeDefined();
    const result = await scanner.scan(dir);
    expect(result.findings).toHaveLength(0);
  });

  it("restricts scanning to files matching filePattern", async () => {
    const dir = makeTmpDir();
    // .ts file — should be scanned
    fs.writeFileSync(path.join(dir, "app.ts"), "console.log('ts');\n");
    // .py file — should NOT be scanned with *.ts pattern
    fs.writeFileSync(path.join(dir, "app.py"), "console.log('py')\n");

    const rule: CustomRule = {
      id: "no-console",
      name: "No console.log",
      pattern: "console\\.log\\(",
      severity: "info",
      message: "console found in {file}",
      filePattern: "**/*.ts",
    };

    const scanner = new CustomRulesScanner([rule]);
    const result = await scanner.scan(dir);

    // Only the .ts file should be matched
    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    expect(result.findings.every((f) => f.file?.endsWith(".ts"))).toBe(true);
  });

  it("respects exclude patterns", async () => {
    const dir = makeTmpDir();
    const srcDir = path.join(dir, "src");
    const vendorDir = path.join(dir, "vendor");
    fs.mkdirSync(srcDir);
    fs.mkdirSync(vendorDir);

    fs.writeFileSync(path.join(srcDir, "app.ts"), "console.log('app');\n");
    fs.writeFileSync(path.join(vendorDir, "lib.ts"), "console.log('vendor');\n");

    const rule: CustomRule = {
      id: "no-console",
      name: "No console.log",
      pattern: "console\\.log\\(",
      severity: "warning",
      message: "console in {file}",
      filePattern: "**/*.ts",
      exclude: ["**/vendor/**"],
    };

    const scanner = new CustomRulesScanner([rule]);
    const result = await scanner.scan(dir);

    // vendor file should be excluded
    expect(result.findings.every((f) => !f.file?.includes("vendor"))).toBe(true);
    // src file should be included
    expect(result.findings.some((f) => f.file?.includes("src"))).toBe(true);
  });

  it("sets category from rule.category field", async () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "index.ts"), "eval('bad');\n");

    const rule: CustomRule = {
      id: "no-eval",
      name: "No eval",
      pattern: "eval\\(",
      severity: "critical",
      message: "eval detected in {file}",
      category: "security-custom",
    };

    const scanner = new CustomRulesScanner([rule]);
    const result = await scanner.scan(dir);

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].category).toBe("security-custom");
  });

  it("defaults category to 'custom-rule' when not specified", async () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "index.ts"), "TODO: fix this\n");

    const rule: CustomRule = {
      id: "no-todo",
      name: "No inline TODO",
      pattern: "TODO:",
      severity: "info",
      message: "TODO found",
    };

    const scanner = new CustomRulesScanner([rule]);
    const result = await scanner.scan(dir);

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].category).toBe("custom-rule");
  });

  it("scoring: custom-rule warning finding reduces health score", () => {
    const finding = {
      id: "custom-no-console-src/app.ts-0",
      severity: "warning" as const,
      category: "custom-rule",
      message: "console.log found",
      file: "src/app.ts",
    };

    const healthBefore = calculateHealth([]);
    const healthAfter = calculateHealth([finding]);

    expect(healthAfter.score).toBeLessThan(healthBefore.score);
    // warning custom rule deducts -2
    expect(healthBefore.score - healthAfter.score).toBe(2);
  });

  it("scoring: custom-rule critical finding deducts more than warning", () => {
    const warning = {
      id: "custom-no-console-src/app.ts-0",
      severity: "warning" as const,
      category: "custom-rule",
      message: "warning finding",
    };

    const critical = {
      id: "custom-no-eval-src/app.ts-0",
      severity: "critical" as const,
      category: "custom-rule",
      message: "critical finding",
    };

    const healthWarning = calculateHealth([warning]);
    const healthCritical = calculateHealth([critical]);

    expect(healthCritical.score).toBeLessThan(healthWarning.score);
  });
});

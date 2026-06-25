import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TestCoverageScanner } from "../src/scanners/test-coverage.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("TestCoverageScanner", () => {
  const scanner = new TestCoverageScanner();
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(__dirname, `test-fixture-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should return no findings for 100% test coverage", async () => {
    // Create source files with corresponding tests
    fs.writeFileSync(path.join(testDir, "utils.ts"), "export const add = (a, b) => a + b;");
    fs.writeFileSync(path.join(testDir, "utils.test.ts"), "test('add', () => {});");

    fs.writeFileSync(path.join(testDir, "helper.js"), "export const helper = () => {};");
    fs.writeFileSync(path.join(testDir, "helper.spec.js"), "test('helper', () => {});");

    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(0);
    expect(result.stats).toEqual({
      sourceFiles: 2,
      missingTests: 0,
      coveragePercent: "100.0",
    });
  });

  it("should detect missing test files", async () => {
    // Create source files without tests
    fs.writeFileSync(path.join(testDir, "uncovered.ts"), "export const fn = () => {};");
    fs.writeFileSync(path.join(testDir, "another.js"), "export const fn2 = () => {};");

    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(2);

    // Check that both files are reported (order may vary)
    const messages = result.findings.map(f => f.message);
    expect(messages.some(m => m.includes("uncovered.ts"))).toBe(true);
    expect(messages.some(m => m.includes("another.js"))).toBe(true);

    expect(result.findings[0].severity).toBe("info");
    expect(result.findings[0].category).toBe("test-coverage");

    expect(result.stats).toEqual({
      sourceFiles: 2,
      missingTests: 2,
      coveragePercent: "0.0",
    });
  });

  it("should recognize __tests__ directory pattern", async () => {
    // Create source file with test in __tests__ directory
    fs.writeFileSync(path.join(testDir, "component.tsx"), "export const Component = () => {};");

    const testsDir = path.join(testDir, "__tests__");
    fs.mkdirSync(testsDir);
    fs.writeFileSync(path.join(testsDir, "component.test.tsx"), "test('component', () => {});");

    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(0);
    expect(result.stats).toMatchObject({
      sourceFiles: 1,
      missingTests: 0,
      coveragePercent: "100.0",
    });
  });

  it("should handle mixed .test and .spec patterns", async () => {
    // Some files with .test, some with .spec
    fs.writeFileSync(path.join(testDir, "file1.ts"), "export const fn1 = () => {};");
    fs.writeFileSync(path.join(testDir, "file1.test.ts"), "test('fn1', () => {});");

    fs.writeFileSync(path.join(testDir, "file2.ts"), "export const fn2 = () => {};");
    fs.writeFileSync(path.join(testDir, "file2.spec.ts"), "test('fn2', () => {});");

    fs.writeFileSync(path.join(testDir, "file3.ts"), "export const fn3 = () => {};");
    // No test for file3

    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].message).toContain("file3.ts");
    expect(result.stats).toMatchObject({
      sourceFiles: 3,
      missingTests: 1,
      coveragePercent: "66.7",
    });
  });

  it("should exclude config files from source files", async () => {
    // Config files should not need tests
    fs.writeFileSync(path.join(testDir, "jest.config.js"), "module.exports = {};");
    fs.writeFileSync(path.join(testDir, "vite.config.ts"), "export default {};");
    fs.writeFileSync(path.join(testDir, "rollup.config.js"), "export default {};");

    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(0);
    expect(result.stats).toMatchObject({
      sourceFiles: 0,
      missingTests: 0,
      coveragePercent: "100.0",
    });
  });

  it("should exclude index files from source files", async () => {
    // Index files typically just re-export, don't need tests
    fs.writeFileSync(path.join(testDir, "index.ts"), "export * from './utils';");
    fs.writeFileSync(path.join(testDir, "index.js"), "export * from './helper';");

    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(0);
    expect(result.stats).toMatchObject({
      sourceFiles: 0,
      missingTests: 0,
    });
  });

  it("should exclude type definition files", async () => {
    // .d.ts files don't need tests
    fs.writeFileSync(path.join(testDir, "types.d.ts"), "export type Foo = string;");
    fs.writeFileSync(path.join(testDir, "global.d.ts"), "declare global {}");

    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(0);
    expect(result.stats).toMatchObject({
      sourceFiles: 0,
      missingTests: 0,
    });
  });

  it("should report only first 10 files, then summarize rest", async () => {
    // Create 15 source files without tests
    for (let i = 1; i <= 15; i++) {
      fs.writeFileSync(path.join(testDir, `file${i}.ts`), `export const fn${i} = () => {};`);
    }

    const result = await scanner.scan(testDir);

    // 10 individual findings + 1 summary
    expect(result.findings).toHaveLength(11);

    // First 10 are individual files
    for (let i = 0; i < 10; i++) {
      expect(result.findings[i].id).toMatch(/^missing-test-/);
    }

    // Last one is summary
    expect(result.findings[10]).toMatchObject({
      id: "many-missing-tests",
      message: "...and 5 more files without tests",
    });

    expect(result.stats).toMatchObject({
      sourceFiles: 15,
      missingTests: 15,
      coveragePercent: "0.0",
    });
  });

  it("should handle nested directory structures", async () => {
    // Create nested structure
    const srcDir = path.join(testDir, "src");
    const utilsDir = path.join(srcDir, "utils");
    const componentsDir = path.join(srcDir, "components");

    fs.mkdirSync(utilsDir, { recursive: true });
    fs.mkdirSync(componentsDir, { recursive: true });

    fs.writeFileSync(path.join(utilsDir, "math.ts"), "export const add = (a, b) => a + b;");
    fs.writeFileSync(path.join(utilsDir, "math.test.ts"), "test('add', () => {});");

    fs.writeFileSync(
      path.join(componentsDir, "Button.tsx"),
      "export const Button = () => {};"
    );
    // No test for Button

    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].message).toContain("Button.tsx");
    expect(result.stats).toMatchObject({
      sourceFiles: 2,
      missingTests: 1,
      coveragePercent: "50.0",
    });
  });

  it("should handle empty project", async () => {
    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(0);
    expect(result.stats).toMatchObject({
      sourceFiles: 0,
      missingTests: 0,
      coveragePercent: "100.0",
    });
  });

  it("should match test files with different extensions", async () => {
    // Source file is .tsx, test is .tsx
    fs.writeFileSync(path.join(testDir, "component.tsx"), "export const Component = () => {};");
    fs.writeFileSync(path.join(testDir, "component.test.tsx"), "test('component', () => {});");

    // Source file is .ts, test is .ts
    fs.writeFileSync(path.join(testDir, "utils.ts"), "export const fn = () => {};");
    fs.writeFileSync(path.join(testDir, "utils.test.ts"), "test('fn', () => {});");

    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(0);
    expect(result.stats).toMatchObject({
      sourceFiles: 2,
      missingTests: 0,
      coveragePercent: "100.0",
    });
  });

  it("should not count test files as source files needing tests", async () => {
    // Test files should not be counted as source files
    fs.writeFileSync(path.join(testDir, "foo.test.ts"), "test('foo', () => {});");
    fs.writeFileSync(path.join(testDir, "bar.spec.js"), "test('bar', () => {});");

    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(0);
    expect(result.stats).toMatchObject({
      sourceFiles: 0,
      missingTests: 0,
    });
  });

  it("should handle partially tested project", async () => {
    // Some files with tests, some without
    fs.writeFileSync(path.join(testDir, "tested1.ts"), "export const fn1 = () => {};");
    fs.writeFileSync(path.join(testDir, "tested1.test.ts"), "test('fn1', () => {});");

    fs.writeFileSync(path.join(testDir, "tested2.ts"), "export const fn2 = () => {};");
    fs.writeFileSync(path.join(testDir, "tested2.spec.ts"), "test('fn2', () => {});");

    fs.writeFileSync(path.join(testDir, "untested1.ts"), "export const fn3 = () => {};");
    fs.writeFileSync(path.join(testDir, "untested2.ts"), "export const fn4 = () => {};");

    const result = await scanner.scan(testDir);

    expect(result.findings).toHaveLength(2);
    expect(result.stats).toMatchObject({
      sourceFiles: 4,
      missingTests: 2,
      coveragePercent: "50.0",
    });
  });
});

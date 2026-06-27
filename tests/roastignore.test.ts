import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { loadRoastIgnore, filterIgnoredFindings } from "../src/utils/files.js";
import { Finding } from "../src/types/index.js";

describe("loadRoastIgnore", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roastignore-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns [] when no .roastignore file exists", () => {
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toEqual([]);
  });

  it("returns [] for an empty .roastignore file", () => {
    fs.writeFileSync(path.join(tempDir, ".roastignore"), "");
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toEqual([]);
  });

  it("skips blank lines", () => {
    fs.writeFileSync(
      path.join(tempDir, ".roastignore"),
      "\nvendor\n\n  \ndist/\n"
    );
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toHaveLength(2);
  });

  it("skips lines starting with #", () => {
    fs.writeFileSync(
      path.join(tempDir, ".roastignore"),
      "# This is a comment\nvendor\n# another comment\n"
    );
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toHaveLength(1);
    expect(patterns).not.toContain("# This is a comment");
  });

  it("converts plain name 'vendor' to '**/vendor/**'", () => {
    fs.writeFileSync(path.join(tempDir, ".roastignore"), "vendor\n");
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toContain("**/vendor/**");
  });

  it("converts '/build' to 'build/**'", () => {
    fs.writeFileSync(path.join(tempDir, ".roastignore"), "/build\n");
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toContain("build/**");
  });

  it("converts 'dist/' to '**/dist/**'", () => {
    fs.writeFileSync(path.join(tempDir, ".roastignore"), "dist/\n");
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toContain("**/dist/**");
  });

  it("keeps glob pattern '**/*.min.js' as-is (already has *)", () => {
    fs.writeFileSync(path.join(tempDir, ".roastignore"), "**/*.min.js\n");
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toContain("**/*.min.js");
  });

  it("prefixes bare glob like '*.min.js' with **/ since it has no slash", () => {
    fs.writeFileSync(path.join(tempDir, ".roastignore"), "*.min.js\n");
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toContain("**/*.min.js");
  });

  it("converts specific file 'config.secret.ts' to '**/config.secret.ts'", () => {
    fs.writeFileSync(path.join(tempDir, ".roastignore"), "config.secret.ts\n");
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toContain("**/config.secret.ts");
  });

  it("handles trimming of whitespace around pattern names", () => {
    fs.writeFileSync(path.join(tempDir, ".roastignore"), "  vendor  \n");
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toContain("**/vendor/**");
  });

  it("handles multiple patterns at once", () => {
    fs.writeFileSync(
      path.join(tempDir, ".roastignore"),
      "# Ignore these\nvendor\n/build\ndist/\n**/*.min.js\n"
    );
    const patterns = loadRoastIgnore(tempDir);
    expect(patterns).toHaveLength(4);
    expect(patterns).toContain("**/vendor/**");
    expect(patterns).toContain("build/**");
    expect(patterns).toContain("**/dist/**");
    expect(patterns).toContain("**/*.min.js");
  });
});

describe("filterIgnoredFindings", () => {
  const rootDir = "/project";

  const makeFinding = (id: string, file?: string): Finding => ({
    id,
    severity: "warning",
    category: "test",
    message: `Finding ${id}`,
    file,
  });

  it("returns all findings unchanged when ignorePatterns is empty", () => {
    const findings: Finding[] = [
      makeFinding("f1", "src/foo.ts"),
      makeFinding("f2", "src/bar.ts"),
    ];
    const result = filterIgnoredFindings(findings, [], rootDir);
    expect(result).toHaveLength(2);
  });

  it("keeps findings without a file property (global findings)", () => {
    const findings: Finding[] = [
      makeFinding("no-file"),
      makeFinding("with-file", "src/foo.ts"),
    ];
    const result = filterIgnoredFindings(findings, ["**/vendor/**"], rootDir);
    // no-file has no file, so it stays
    expect(result.find((f) => f.id === "no-file")).toBeDefined();
  });

  it("removes findings whose file matches an ignore pattern", () => {
    const findings: Finding[] = [
      makeFinding("f1", "vendor/somelib/index.ts"),
      makeFinding("f2", "src/app.ts"),
    ];
    const result = filterIgnoredFindings(findings, ["**/vendor/**"], rootDir);
    expect(result.find((f) => f.id === "f1")).toBeUndefined();
    expect(result.find((f) => f.id === "f2")).toBeDefined();
  });

  it("handles '**/generated/**' pattern correctly", () => {
    const findings: Finding[] = [
      makeFinding("gen1", "src/generated/api-client.ts"),
      makeFinding("gen2", "generated/types.ts"),
      makeFinding("normal", "src/components/Button.ts"),
    ];
    const result = filterIgnoredFindings(findings, ["**/generated/**"], rootDir);
    expect(result.find((f) => f.id === "gen1")).toBeUndefined();
    expect(result.find((f) => f.id === "gen2")).toBeUndefined();
    expect(result.find((f) => f.id === "normal")).toBeDefined();
  });

  it("handles Windows-style backslash paths by normalizing to forward slashes", () => {
    const findings: Finding[] = [
      makeFinding("win1", "vendor\\somelib\\index.ts"),
      makeFinding("normal", "src\\app.ts"),
    ];
    const result = filterIgnoredFindings(findings, ["**/vendor/**"], rootDir);
    expect(result.find((f) => f.id === "win1")).toBeUndefined();
    expect(result.find((f) => f.id === "normal")).toBeDefined();
  });

  it("applies multiple patterns, removing findings matching any pattern", () => {
    const findings: Finding[] = [
      makeFinding("f1", "vendor/lib.ts"),
      makeFinding("f2", "build/output.js"),
      makeFinding("f3", "src/main.ts"),
    ];
    const result = filterIgnoredFindings(findings, ["**/vendor/**", "build/**"], rootDir);
    expect(result.find((f) => f.id === "f1")).toBeUndefined();
    expect(result.find((f) => f.id === "f2")).toBeUndefined();
    expect(result.find((f) => f.id === "f3")).toBeDefined();
  });

  it("handles specific file patterns like '**/config.secret.ts'", () => {
    const findings: Finding[] = [
      makeFinding("secret", "config/config.secret.ts"),
      makeFinding("normal", "config/config.ts"),
    ];
    const result = filterIgnoredFindings(findings, ["**/config.secret.ts"], rootDir);
    expect(result.find((f) => f.id === "secret")).toBeUndefined();
    expect(result.find((f) => f.id === "normal")).toBeDefined();
  });

  it("returns empty array when all findings are ignored", () => {
    const findings: Finding[] = [
      makeFinding("f1", "vendor/a.ts"),
      makeFinding("f2", "vendor/b.ts"),
    ];
    const result = filterIgnoredFindings(findings, ["**/vendor/**"], rootDir);
    expect(result).toHaveLength(0);
  });

  it("returns all findings when none match any pattern", () => {
    const findings: Finding[] = [
      makeFinding("f1", "src/a.ts"),
      makeFinding("f2", "src/b.ts"),
    ];
    const result = filterIgnoredFindings(findings, ["**/vendor/**"], rootDir);
    expect(result).toHaveLength(2);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { findReadmePath, updateReadmeBadge } from "../src/readme/index.js";
import { HealthScore } from "../src/types/index.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "roast-readme-test-"));
}

function removeDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const sampleHealth: HealthScore = {
  score: 72,
  grade: "B",
  label: "Good",
};

describe("findReadmePath", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    removeDir(tmpDir);
  });

  it("returns null when no README exists", () => {
    expect(findReadmePath(tmpDir)).toBeNull();
  });

  it("finds README.md (canonical)", () => {
    const readmePath = path.join(tmpDir, "README.md");
    fs.writeFileSync(readmePath, "# Hello", "utf-8");
    expect(findReadmePath(tmpDir)).toBe(readmePath);
  });

  it("finds readme.md (lowercase)", () => {
    const readmePath = path.join(tmpDir, "readme.md");
    fs.writeFileSync(readmePath, "# Hello", "utf-8");
    const found = findReadmePath(tmpDir);
    // On case-insensitive filesystems (Windows/macOS), the actual filename on disk
    // may differ in casing from what was written; we just need a result back.
    expect(found).not.toBeNull();
    expect(found!.toLowerCase()).toBe(readmePath.toLowerCase());
  });

  it("prefers README.md over readme.md when both exist", () => {
    const canonicalPath = path.join(tmpDir, "README.md");
    const lowercasePath = path.join(tmpDir, "readme.md");
    fs.writeFileSync(canonicalPath, "# Canonical", "utf-8");
    fs.writeFileSync(lowercasePath, "# Lowercase", "utf-8");
    expect(findReadmePath(tmpDir)).toBe(canonicalPath);
  });
});

describe("updateReadmeBadge", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    removeDir(tmpDir);
  });

  it("returns no-readme when no README exists", () => {
    const result = updateReadmeBadge(tmpDir, sampleHealth);
    expect(result.updated).toBe(false);
    expect(result.method).toBe("no-readme");
  });

  it("does NOT create a README if one does not exist", () => {
    updateReadmeBadge(tmpDir, sampleHealth);
    expect(fs.existsSync(path.join(tmpDir, "README.md"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, "readme.md"))).toBe(false);
  });

  it("updates a line containing the Codebase Health badge (method: badge-line)", () => {
    const readmePath = path.join(tmpDir, "README.md");
    fs.writeFileSync(
      readmePath,
      "# My Project\n\n![Codebase Health](.roast-badge.svg)\n\nSome text\n",
      "utf-8"
    );
    const result = updateReadmeBadge(tmpDir, sampleHealth);
    expect(result.updated).toBe(true);
    expect(result.method).toBe("badge-line");
  });

  it("updated content contains the new score for badge-line", () => {
    const readmePath = path.join(tmpDir, "README.md");
    fs.writeFileSync(
      readmePath,
      "# My Project\n\n![Codebase Health](.roast-badge.svg)\n\nSome text\n",
      "utf-8"
    );
    updateReadmeBadge(tmpDir, sampleHealth);
    const content = fs.readFileSync(readmePath, "utf-8");
    expect(content).toContain("72/100");
    expect(content).toContain(".roast-badge.svg");
  });

  it("updates the <!-- roast-score-start --> block (method: html-comment)", () => {
    const readmePath = path.join(tmpDir, "README.md");
    fs.writeFileSync(
      readmePath,
      "# My Project\n\n<!-- roast-score-start -->\nold badge line\n<!-- roast-score-end -->\n\nEnd\n",
      "utf-8"
    );
    const result = updateReadmeBadge(tmpDir, sampleHealth);
    expect(result.updated).toBe(true);
    expect(result.method).toBe("html-comment");
  });

  it("updated content contains new score after html-comment update", () => {
    const readmePath = path.join(tmpDir, "README.md");
    fs.writeFileSync(
      readmePath,
      "# My Project\n\n<!-- roast-score-start -->\nold badge line\n<!-- roast-score-end -->\n",
      "utf-8"
    );
    updateReadmeBadge(tmpDir, sampleHealth);
    const content = fs.readFileSync(readmePath, "utf-8");
    expect(content).toContain("72/100");
    expect(content).toContain("<!-- roast-score-start -->");
    expect(content).toContain("<!-- roast-score-end -->");
  });

  it("appends to README when no badge marker exists (method: appended)", () => {
    const readmePath = path.join(tmpDir, "README.md");
    fs.writeFileSync(readmePath, "# My Project\n\nSome content\n", "utf-8");
    const result = updateReadmeBadge(tmpDir, sampleHealth);
    expect(result.updated).toBe(true);
    expect(result.method).toBe("appended");
  });

  it("appended content contains the score and roast-score markers", () => {
    const readmePath = path.join(tmpDir, "README.md");
    fs.writeFileSync(readmePath, "# My Project\n\nSome content\n", "utf-8");
    updateReadmeBadge(tmpDir, sampleHealth);
    const content = fs.readFileSync(readmePath, "utf-8");
    expect(content).toContain("72/100");
    expect(content).toContain("<!-- roast-score-start -->");
    expect(content).toContain("<!-- roast-score-end -->");
  });

  it("stores previousContent in the result", () => {
    const originalContent = "# My Project\n\nSome content\n";
    const readmePath = path.join(tmpDir, "README.md");
    fs.writeFileSync(readmePath, originalContent, "utf-8");
    const result = updateReadmeBadge(tmpDir, sampleHealth);
    expect(result.previousContent).toBe(originalContent);
  });

  it("stores previousContent even for badge-line updates", () => {
    const originalContent = "# My Project\n\n![Codebase Health](.roast-badge.svg)\n";
    const readmePath = path.join(tmpDir, "README.md");
    fs.writeFileSync(readmePath, originalContent, "utf-8");
    const result = updateReadmeBadge(tmpDir, sampleHealth);
    expect(result.previousContent).toBe(originalContent);
  });
});

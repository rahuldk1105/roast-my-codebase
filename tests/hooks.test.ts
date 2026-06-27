import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import os from "os";
import {
  detectHuskySetup,
  installPreCommitHook,
  uninstallPreCommitHook,
  isHookInstalled,
} from "../src/hooks/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "roast-hooks-test-"));
}

function removeTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function gitInit(dir: string): void {
  const result = spawnSync("git", ["init"], { cwd: dir, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(`git init failed: ${result.stderr}`);
  }
}

// ---------------------------------------------------------------------------
// detectHuskySetup
// ---------------------------------------------------------------------------

describe("detectHuskySetup", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(tmpDir);
  });

  it("returns false when no .husky dir and no package.json", () => {
    expect(detectHuskySetup(tmpDir)).toBe(false);
  });

  it("returns false when package.json has no husky dep", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test", devDependencies: { typescript: "^5" } }),
      "utf-8"
    );
    expect(detectHuskySetup(tmpDir)).toBe(false);
  });

  it("returns true when .husky/ directory exists", () => {
    fs.mkdirSync(path.join(tmpDir, ".husky"));
    expect(detectHuskySetup(tmpDir)).toBe(true);
  });

  it("returns true when package.json has husky in devDependencies", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test", devDependencies: { husky: "^9" } }),
      "utf-8"
    );
    expect(detectHuskySetup(tmpDir)).toBe(true);
  });

  it("returns true when package.json has husky in dependencies", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { husky: "^9" } }),
      "utf-8"
    );
    expect(detectHuskySetup(tmpDir)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isHookInstalled
// ---------------------------------------------------------------------------

describe("isHookInstalled", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    removeTempDir(tmpDir);
  });

  it("returns false for a fresh temp directory", () => {
    expect(isHookInstalled(tmpDir)).toBe(false);
  });

  it("returns true after installPreCommitHook in a git repo", () => {
    gitInit(tmpDir);
    installPreCommitHook(tmpDir, 60);
    expect(isHookInstalled(tmpDir)).toBe(true);
  });

  it("returns true when .git/hooks/pre-commit contains roast-my-codebase", () => {
    gitInit(tmpDir);
    const hooksDir = path.join(tmpDir, ".git", "hooks");
    if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(
      path.join(hooksDir, "pre-commit"),
      "npx roast-my-codebase --json\n",
      "utf-8"
    );
    expect(isHookInstalled(tmpDir)).toBe(true);
  });

  it("returns true when .husky/pre-commit contains roast-my-codebase", () => {
    fs.mkdirSync(path.join(tmpDir, ".husky"));
    fs.writeFileSync(
      path.join(tmpDir, ".husky", "pre-commit"),
      "npx roast-my-codebase --json\n",
      "utf-8"
    );
    expect(isHookInstalled(tmpDir)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// installPreCommitHook — native git hook
// ---------------------------------------------------------------------------

describe("installPreCommitHook (native git)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    gitInit(tmpDir);
  });

  afterEach(() => {
    removeTempDir(tmpDir);
  });

  it("creates .git/hooks/pre-commit when .git/ exists", () => {
    const result = installPreCommitHook(tmpDir, 60);
    expect(result.success).toBe(true);
    const hookPath = path.join(tmpDir, ".git", "hooks", "pre-commit");
    expect(fs.existsSync(hookPath)).toBe(true);
  });

  it("hook file contains the threshold value", () => {
    installPreCommitHook(tmpDir, 75);
    const hookPath = path.join(tmpDir, ".git", "hooks", "pre-commit");
    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("75");
  });

  it("hook file contains roast-my-codebase", () => {
    installPreCommitHook(tmpDir, 60);
    const hookPath = path.join(tmpDir, ".git", "hooks", "pre-commit");
    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("roast-my-codebase");
  });

  it("returns alreadyInstalled: true when called twice", () => {
    installPreCommitHook(tmpDir, 60);
    const second = installPreCommitHook(tmpDir, 60);
    expect(second.alreadyInstalled).toBe(true);
  });

  it("returns huskyDetected: false for plain git repo", () => {
    const result = installPreCommitHook(tmpDir, 60);
    expect(result.huskyDetected).toBe(false);
  });

  it("returns success: false when .git directory is missing", () => {
    const plainDir = makeTempDir();
    try {
      const result = installPreCommitHook(plainDir, 60);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/not a git repository/i);
    } finally {
      removeTempDir(plainDir);
    }
  });

  it("appends to an existing pre-commit hook rather than overwriting", () => {
    const hooksDir = path.join(tmpDir, ".git", "hooks");
    if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });
    const hookPath = path.join(hooksDir, "pre-commit");
    const originalContent = "#!/usr/bin/env sh\necho 'existing hook'\n";
    fs.writeFileSync(hookPath, originalContent, "utf-8");

    installPreCommitHook(tmpDir, 60);

    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("existing hook");
    expect(content).toContain("roast-my-codebase");
  });
});

// ---------------------------------------------------------------------------
// installPreCommitHook — husky
// ---------------------------------------------------------------------------

describe("installPreCommitHook (husky)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    // Simulate husky presence via .husky/ directory
    fs.mkdirSync(path.join(tmpDir, ".husky"));
  });

  afterEach(() => {
    removeTempDir(tmpDir);
  });

  it("creates .husky/pre-commit when husky is detected", () => {
    const result = installPreCommitHook(tmpDir, 60);
    expect(result.success).toBe(true);
    expect(result.huskyDetected).toBe(true);
    const hookPath = path.join(tmpDir, ".husky", "pre-commit");
    expect(fs.existsSync(hookPath)).toBe(true);
  });

  it("husky hook file contains the threshold value", () => {
    installPreCommitHook(tmpDir, 80);
    const content = fs.readFileSync(
      path.join(tmpDir, ".husky", "pre-commit"),
      "utf-8"
    );
    expect(content).toContain("80");
  });

  it("husky hook file contains roast-my-codebase", () => {
    installPreCommitHook(tmpDir, 60);
    const content = fs.readFileSync(
      path.join(tmpDir, ".husky", "pre-commit"),
      "utf-8"
    );
    expect(content).toContain("roast-my-codebase");
  });

  it("husky hook file contains husky.sh source line", () => {
    installPreCommitHook(tmpDir, 60);
    const content = fs.readFileSync(
      path.join(tmpDir, ".husky", "pre-commit"),
      "utf-8"
    );
    expect(content).toContain("husky.sh");
  });

  it("returns alreadyInstalled: true when called twice", () => {
    installPreCommitHook(tmpDir, 60);
    const second = installPreCommitHook(tmpDir, 60);
    expect(second.alreadyInstalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// uninstallPreCommitHook
// ---------------------------------------------------------------------------

describe("uninstallPreCommitHook", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    gitInit(tmpDir);
  });

  afterEach(() => {
    removeTempDir(tmpDir);
  });

  it("removes the pre-commit hook file", () => {
    installPreCommitHook(tmpDir, 60);
    const hookPath = path.join(tmpDir, ".git", "hooks", "pre-commit");
    expect(fs.existsSync(hookPath)).toBe(true);

    const result = uninstallPreCommitHook(tmpDir);
    expect(result.success).toBe(true);
    expect(fs.existsSync(hookPath)).toBe(false);
  });

  it("returns success: false when no hook is installed", () => {
    const result = uninstallPreCommitHook(tmpDir);
    expect(result.success).toBe(false);
  });

  it("isHookInstalled returns false after uninstall", () => {
    installPreCommitHook(tmpDir, 60);
    expect(isHookInstalled(tmpDir)).toBe(true);
    uninstallPreCommitHook(tmpDir);
    expect(isHookInstalled(tmpDir)).toBe(false);
  });

  it("preserves other hook content when uninstalling", () => {
    const hooksDir = path.join(tmpDir, ".git", "hooks");
    if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });
    const hookPath = path.join(hooksDir, "pre-commit");

    // Write a hook with existing content plus roast appended
    const original = "#!/usr/bin/env sh\necho 'run tests'\nnpm test\n";
    fs.writeFileSync(hookPath, original, "utf-8");
    installPreCommitHook(tmpDir, 60); // appends roast lines

    uninstallPreCommitHook(tmpDir);

    const remaining = fs.readFileSync(hookPath, "utf-8");
    expect(remaining).not.toContain("roast-my-codebase");
    expect(remaining).toContain("npm test");
  });
});

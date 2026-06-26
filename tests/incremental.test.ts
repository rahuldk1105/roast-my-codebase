import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { filterFindingsByFiles } from "../src/incremental/index.js";
import { loadCache, saveCache, getCurrentGitHash, ScanCache } from "../src/incremental/cache.js";
import { Finding } from "../src/types/index.js";

// ── filterFindingsByFiles ──────────────────────────────────────────────────

describe("filterFindingsByFiles", () => {
  const rootDir = "/project";

  const fileFinding: Finding = {
    id: "large-file-src-index",
    severity: "warning",
    category: "large-files",
    message: "src/index.ts is too large",
    file: "src/index.ts",
  };

  const anotherFileFinding: Finding = {
    id: "todo-src-auth",
    severity: "info",
    category: "todos",
    message: "TODOs found in src/auth.ts",
    file: "src/auth.ts",
  };

  const globalFinding: Finding = {
    id: "circular-count",
    severity: "warning",
    category: "circular-deps",
    message: "3 circular dependency cycles detected",
    // no `file` field — global finding
  };

  it("keeps findings whose file is in changedFiles", () => {
    const changedFiles = [path.join(rootDir, "src/index.ts")];
    const result = filterFindingsByFiles(
      [fileFinding, anotherFileFinding, globalFinding],
      changedFiles,
      rootDir
    );
    expect(result).toContainEqual(fileFinding);
    expect(result).not.toContainEqual(anotherFileFinding);
  });

  it("always keeps global findings (no file property)", () => {
    const changedFiles = [path.join(rootDir, "src/index.ts")];
    const result = filterFindingsByFiles(
      [fileFinding, globalFinding],
      changedFiles,
      rootDir
    );
    expect(result).toContainEqual(globalFinding);
  });

  it("keeps all global findings when changedFiles is empty", () => {
    const result = filterFindingsByFiles(
      [fileFinding, anotherFileFinding, globalFinding],
      [],
      rootDir
    );
    expect(result).toContainEqual(globalFinding);
    expect(result).not.toContainEqual(fileFinding);
    expect(result).not.toContainEqual(anotherFileFinding);
  });

  it("handles multiple changed files", () => {
    const changedFiles = [
      path.join(rootDir, "src/index.ts"),
      path.join(rootDir, "src/auth.ts"),
    ];
    const result = filterFindingsByFiles(
      [fileFinding, anotherFileFinding, globalFinding],
      changedFiles,
      rootDir
    );
    expect(result).toContainEqual(fileFinding);
    expect(result).toContainEqual(anotherFileFinding);
    expect(result).toContainEqual(globalFinding);
  });

  it("normalizes paths with forward slashes", () => {
    // changedFiles uses backslash (Windows-style absolute), finding.file uses forward slash
    const changedFiles = [path.join(rootDir, "src/index.ts")];
    const findingWithForwardSlash: Finding = {
      ...fileFinding,
      file: "src/index.ts",
    };
    const result = filterFindingsByFiles(
      [findingWithForwardSlash],
      changedFiles,
      rootDir
    );
    expect(result).toContainEqual(findingWithForwardSlash);
  });

  it("normalizes paths with backward slashes", () => {
    // finding.file uses backslash path
    const changedFiles = [path.join(rootDir, "src/index.ts")];
    const findingWithBackslash: Finding = {
      ...fileFinding,
      file: "src\\index.ts",
    };
    const result = filterFindingsByFiles(
      [findingWithBackslash],
      changedFiles,
      rootDir
    );
    expect(result).toContainEqual(findingWithBackslash);
  });

  it("excludes file findings not in changedFiles", () => {
    const changedFiles = [path.join(rootDir, "src/utils.ts")];
    const result = filterFindingsByFiles(
      [fileFinding, anotherFileFinding],
      changedFiles,
      rootDir
    );
    expect(result).toHaveLength(0);
  });

  it("handles absolute file paths in findings", () => {
    const absoluteFileFinding: Finding = {
      id: "large-file-abs",
      severity: "warning",
      category: "large-files",
      message: "absolute path finding",
      file: path.join(rootDir, "src/index.ts"),
    };
    const changedFiles = [path.join(rootDir, "src/index.ts")];
    const result = filterFindingsByFiles(
      [absoluteFileFinding],
      changedFiles,
      rootDir
    );
    expect(result).toContainEqual(absoluteFileFinding);
  });

  it("returns empty array when no findings match and none are global", () => {
    const changedFiles = [path.join(rootDir, "src/new-file.ts")];
    const result = filterFindingsByFiles(
      [fileFinding, anotherFileFinding],
      changedFiles,
      rootDir
    );
    expect(result).toHaveLength(0);
  });
});

// ── Cache ──────────────────────────────────────────────────────────────────

describe("loadCache", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns null for a missing cache file", () => {
    const result = loadCache(tmpDir);
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    fs.writeFileSync(path.join(tmpDir, ".roast-cache.json"), "not json");
    const result = loadCache(tmpDir);
    expect(result).toBeNull();
  });

  it("returns null for JSON missing required fields", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".roast-cache.json"),
      JSON.stringify({ timestamp: 123 })
    );
    const result = loadCache(tmpDir);
    expect(result).toBeNull();
  });

  it("loads a valid cache file", () => {
    const cache: ScanCache = {
      timestamp: Date.now(),
      gitHash: "abc123def456",
      findings: [
        {
          id: "test-finding",
          severity: "info",
          category: "todos",
          message: "TODO found",
          file: "src/index.ts",
        },
      ],
      health: { score: 85, grade: "B", label: "Good" },
    };
    fs.writeFileSync(
      path.join(tmpDir, ".roast-cache.json"),
      JSON.stringify(cache, null, 2)
    );

    const result = loadCache(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.gitHash).toBe("abc123def456");
    expect(result!.findings).toHaveLength(1);
    expect(result!.health.score).toBe(85);
  });
});

describe("saveCache", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a readable cache file", () => {
    const cache: ScanCache = {
      timestamp: 1700000000000,
      gitHash: "deadbeef",
      findings: [],
      health: { score: 100, grade: "A", label: "Excellent" },
    };
    saveCache(tmpDir, cache);

    const cachePath = path.join(tmpDir, ".roast-cache.json");
    expect(fs.existsSync(cachePath)).toBe(true);

    const loaded = loadCache(tmpDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.gitHash).toBe("deadbeef");
    expect(loaded!.health.grade).toBe("A");
  });

  it("round-trips findings correctly", () => {
    const findings: Finding[] = [
      {
        id: "circular-1",
        severity: "critical",
        category: "circular-deps",
        message: "a → b → a",
        file: "src/a.ts",
        detail: "cycle of length 2",
      },
    ];
    const cache: ScanCache = {
      timestamp: Date.now(),
      gitHash: "cafebabe",
      findings,
      health: { score: 70, grade: "C", label: "Fair" },
    };
    saveCache(tmpDir, cache);

    const loaded = loadCache(tmpDir);
    expect(loaded!.findings[0].id).toBe("circular-1");
    expect(loaded!.findings[0].detail).toBe("cycle of length 2");
  });
});

describe("getCurrentGitHash", () => {
  it("returns null for a non-git directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-nogit-"));
    try {
      const result = getCurrentGitHash(tmpDir);
      expect(result).toBeNull();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

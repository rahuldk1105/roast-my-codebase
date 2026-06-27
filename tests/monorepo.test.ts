import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  detectWorkspacePackages,
  renderMonorepoReport,
  type MonorepoReport,
  type PackageScanResult,
  type WorkspacePackage,
} from "../src/monorepo/index.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "roast-mono-test-"));
}

function removeDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

/** Create a minimal sub-package with package.json */
function mkPackage(rootDir: string, relDir: string, name: string): string {
  const absDir = path.join(rootDir, relDir);
  writeJson(path.join(absDir, "package.json"), { name });
  return absDir;
}

/** Minimal HealthScore */
function makeHealth(score: number) {
  const grade =
    score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  return { score, grade, label: "test" };
}

/** Build a minimal PackageScanResult */
function makePkgResult(
  pkg: WorkspacePackage,
  score: number,
  findings: { severity: "info" | "warning" | "critical" }[] = []
): PackageScanResult {
  const realFindings = findings.map((f, i) => ({
    id: `f-${i}`,
    severity: f.severity,
    category: "test",
    message: "test finding",
  }));
  return {
    package: pkg,
    health: makeHealth(score),
    findings: realFindings,
    stats: {
      totalFiles: 1,
      sourceFiles: 1,
      totalLines: 10,
      largestFiles: [],
      dependencies: 0,
      devDependencies: 0,
    },
  };
}

// ── detectWorkspacePackages ───────────────────────────────────────────────────

describe("detectWorkspacePackages", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    removeDir(tmpDir);
  });

  it("returns empty array when no workspace config exists and no packages/apps dirs", () => {
    // Just a bare root with no package.json
    const result = detectWorkspacePackages(tmpDir);
    expect(result).toEqual([]);
  });

  it("returns empty array when package.json has no workspaces field", () => {
    writeJson(path.join(tmpDir, "package.json"), { name: "root" });
    const result = detectWorkspacePackages(tmpDir);
    expect(result).toEqual([]);
  });

  // ── npm / yarn workspaces ──────────────────────────────────────────────────

  it("detects npm workspaces from package.json workspaces array", () => {
    writeJson(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["packages/*"],
    });
    mkPackage(tmpDir, "packages/alpha", "@org/alpha");
    mkPackage(tmpDir, "packages/beta", "@org/beta");

    const result = detectWorkspacePackages(tmpDir);
    const names = result.map((p) => p.name).sort();
    expect(names).toEqual(["@org/alpha", "@org/beta"]);
  });

  it("detects npm workspaces from package.json workspaces object form", () => {
    writeJson(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: { packages: ["packages/*"] },
    });
    mkPackage(tmpDir, "packages/core", "@org/core");

    const result = detectWorkspacePackages(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("@org/core");
  });

  it("handles multiple workspace globs", () => {
    writeJson(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["packages/*", "apps/*"],
    });
    mkPackage(tmpDir, "packages/lib", "@org/lib");
    mkPackage(tmpDir, "apps/web", "@org/web");

    const result = detectWorkspacePackages(tmpDir);
    const names = result.map((p) => p.name).sort();
    expect(names).toContain("@org/lib");
    expect(names).toContain("@org/web");
  });

  // ── pnpm workspaces ────────────────────────────────────────────────────────

  it("detects pnpm workspaces from pnpm-workspace.yaml", () => {
    writeFile(
      path.join(tmpDir, "pnpm-workspace.yaml"),
      `packages:\n  - 'packages/*'\n  - 'apps/*'\n`
    );
    mkPackage(tmpDir, "packages/sdk", "@org/sdk");
    mkPackage(tmpDir, "apps/dashboard", "@org/dashboard");

    const result = detectWorkspacePackages(tmpDir);
    const names = result.map((p) => p.name).sort();
    expect(names).toContain("@org/sdk");
    expect(names).toContain("@org/dashboard");
  });

  it("detects pnpm workspaces with double-quoted entries", () => {
    writeFile(
      path.join(tmpDir, "pnpm-workspace.yaml"),
      `packages:\n  - "packages/*"\n`
    );
    mkPackage(tmpDir, "packages/utils", "@org/utils");

    const result = detectWorkspacePackages(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("@org/utils");
  });

  it("returns empty array when pnpm-workspace.yaml is absent", () => {
    // Ensure no workspace yaml but also no package.json workspaces
    writeJson(path.join(tmpDir, "package.json"), { name: "root" });
    const result = detectWorkspacePackages(tmpDir);
    expect(result).toEqual([]);
  });

  // ── lerna ──────────────────────────────────────────────────────────────────

  it("detects lerna packages from lerna.json", () => {
    writeJson(path.join(tmpDir, "lerna.json"), {
      packages: ["packages/*"],
    });
    mkPackage(tmpDir, "packages/one", "@lerna/one");
    mkPackage(tmpDir, "packages/two", "@lerna/two");

    const result = detectWorkspacePackages(tmpDir);
    const names = result.map((p) => p.name).sort();
    expect(names).toContain("@lerna/one");
    expect(names).toContain("@lerna/two");
  });

  it("falls back to packages/* default when lerna.json has no packages field", () => {
    writeJson(path.join(tmpDir, "lerna.json"), { version: "1.0.0" });
    mkPackage(tmpDir, "packages/thing", "@lerna/thing");

    const result = detectWorkspacePackages(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("@lerna/thing");
  });

  // ── root skip ─────────────────────────────────────────────────────────────

  it("skips the root directory itself", () => {
    writeJson(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["packages/*"],
    });
    // Only root, no sub-packages
    const result = detectWorkspacePackages(tmpDir);
    expect(result).toEqual([]);
  });

  it("does not include root even if it matches a glob", () => {
    writeJson(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["."],
    });
    const result = detectWorkspacePackages(tmpDir);
    expect(result).toEqual([]);
  });

  // ── requires package.json in each found directory ─────────────────────────

  it("skips directories that have no package.json", () => {
    writeJson(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["packages/*"],
    });
    // Create a dir without package.json
    fs.mkdirSync(path.join(tmpDir, "packages", "no-pkg"), { recursive: true });
    // Create a dir with package.json
    mkPackage(tmpDir, "packages/has-pkg", "@org/has-pkg");

    const result = detectWorkspacePackages(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("@org/has-pkg");
  });

  // ── malformed / edge-cases ─────────────────────────────────────────────────

  it("handles malformed package.json gracefully — falls back to dir basename", () => {
    writeJson(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["packages/*"],
    });
    const pkgDir = path.join(tmpDir, "packages", "broken");
    fs.mkdirSync(pkgDir, { recursive: true });
    // Write invalid JSON
    fs.writeFileSync(path.join(pkgDir, "package.json"), "{ not valid json", "utf-8");

    const result = detectWorkspacePackages(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("broken");
  });

  it("returns correct relativePath for each package", () => {
    writeJson(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["packages/*"],
    });
    mkPackage(tmpDir, "packages/rel-pkg", "@org/rel-pkg");

    const result = detectWorkspacePackages(tmpDir);
    expect(result).toHaveLength(1);
    // relativePath should be something like "packages/rel-pkg" (or with OS sep)
    expect(result[0].relativePath).toMatch(/packages[/\\]rel-pkg/);
  });

  it("deduplicates packages found by multiple detection methods", () => {
    // Both npm workspaces and pnpm-workspace.yaml point to same glob
    writeJson(path.join(tmpDir, "package.json"), {
      name: "root",
      workspaces: ["packages/*"],
    });
    writeFile(
      path.join(tmpDir, "pnpm-workspace.yaml"),
      `packages:\n  - 'packages/*'\n`
    );
    mkPackage(tmpDir, "packages/shared", "@org/shared");

    const result = detectWorkspacePackages(tmpDir);
    // Should only appear once despite being found by both methods
    expect(result).toHaveLength(1);
  });

  // ── fallback auto-detect ──────────────────────────────────────────────────

  it("uses fallback auto-detect when no workspace config is found", () => {
    // No package.json, no workspace config at all
    mkPackage(tmpDir, "packages/auto", "@auto/pkg");

    const result = detectWorkspacePackages(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("@auto/pkg");
  });
});

// ── renderMonorepoReport ─────────────────────────────────────────────────────

describe("renderMonorepoReport", () => {
  function makePkg(name: string, relPath: string): WorkspacePackage {
    return { name, path: `/mock/${relPath}`, relativePath: relPath };
  }

  it("returns a string", () => {
    const pkg = makePkg("@app/api", "packages/api");
    const result = makePkgResult(pkg, 82);

    const report: MonorepoReport = {
      packages: [result],
      rollupHealth: makeHealth(82),
      totalFindings: result.findings.length,
      worstPackage: result,
      bestPackage: result,
    };

    expect(typeof renderMonorepoReport(report)).toBe("string");
  });

  it("contains all package names", () => {
    const p1 = makePkg("@app/api", "packages/api");
    const p2 = makePkg("@app/web", "packages/web");
    const r1 = makePkgResult(p1, 82);
    const r2 = makePkgResult(p2, 71);

    const report: MonorepoReport = {
      packages: [r1, r2],
      rollupHealth: makeHealth(77),
      totalFindings: r1.findings.length + r2.findings.length,
      worstPackage: r2,
      bestPackage: r1,
    };

    const output = renderMonorepoReport(report);
    expect(output).toContain("@app/api");
    expect(output).toContain("@app/web");
  });

  it("contains the rollup score", () => {
    const pkg = makePkg("@app/shared", "packages/shared");
    const result = makePkgResult(pkg, 55);

    const report: MonorepoReport = {
      packages: [result],
      rollupHealth: makeHealth(55),
      totalFindings: 10,
      worstPackage: result,
      bestPackage: result,
    };

    const output = renderMonorepoReport(report);
    expect(output).toContain("55/100");
  });

  it("contains worst and best package info", () => {
    const p1 = makePkg("@app/ui", "packages/ui");
    const p2 = makePkg("@app/legacy", "packages/legacy");
    const r1 = makePkgResult(p1, 91);
    const r2 = makePkgResult(p2, 42);

    const report: MonorepoReport = {
      packages: [r1, r2],
      rollupHealth: makeHealth(67),
      totalFindings: r1.findings.length + r2.findings.length,
      worstPackage: r2,
      bestPackage: r1,
    };

    const output = renderMonorepoReport(report);
    expect(output).toContain("Worst");
    expect(output).toContain("Best");
    expect(output).toContain("@app/legacy");
    expect(output).toContain("@app/ui");
  });

  it("contains Rollup label in output", () => {
    const pkg = makePkg("@app/core", "packages/core");
    const result = makePkgResult(pkg, 75);

    const report: MonorepoReport = {
      packages: [result],
      rollupHealth: makeHealth(75),
      totalFindings: 5,
      worstPackage: result,
      bestPackage: result,
    };

    const output = renderMonorepoReport(report);
    expect(output).toContain("Rollup");
  });

  it("contains Monorepo Health Report heading", () => {
    const pkg = makePkg("@app/service", "packages/service");
    const result = makePkgResult(pkg, 80);

    const report: MonorepoReport = {
      packages: [result],
      rollupHealth: makeHealth(80),
      totalFindings: 0,
      worstPackage: result,
      bestPackage: result,
    };

    const output = renderMonorepoReport(report);
    expect(output).toContain("Monorepo Health Report");
  });

  it("contains individual package score in output", () => {
    const pkg = makePkg("@app/auth", "packages/auth");
    const result = makePkgResult(pkg, 67);

    const report: MonorepoReport = {
      packages: [result],
      rollupHealth: makeHealth(67),
      totalFindings: result.findings.length,
      worstPackage: result,
      bestPackage: result,
    };

    const output = renderMonorepoReport(report);
    expect(output).toContain("67/100");
  });

  it("shows grade for each package", () => {
    const pkg = makePkg("@app/graded", "packages/graded");
    const result = makePkgResult(pkg, 85); // should be grade B

    const report: MonorepoReport = {
      packages: [result],
      rollupHealth: makeHealth(85),
      totalFindings: 0,
      worstPackage: result,
      bestPackage: result,
    };

    const output = renderMonorepoReport(report);
    expect(output).toContain("B");
  });
});

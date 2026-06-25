import { describe, it, expect } from "vitest";
import path from "path";
import { DeadExportScanner } from "../../src/scanners/dead-exports.js";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("DeadExportScanner", () => {
  const scanner = new DeadExportScanner();

  it("detects unused exports", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats as {
      totalExports: number;
      deadExports: number;
      percentDead: number;
    };

    // dead-exports.ts has 5 exports that are never imported
    expect(stats.deadExports).toBeGreaterThan(0);
    expect(stats.totalExports).toBeGreaterThan(0);
    expect(stats.percentDead).toBeGreaterThan(0);

    const deadFindings = result.findings.filter(
      (f) => f.category === "dead-exports"
    );
    expect(deadFindings.length).toBeGreaterThan(0);

    // Check that dead-exports.ts exports appear in findings
    const deadExportFiles = deadFindings
      .filter((f) => f.file)
      .map((f) => f.file);
    expect(deadExportFiles).toContain("src/dead-exports.ts");
  });

  it("does not flag exports that are imported elsewhere", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    const deadFindings = result.findings.filter(
      (f) => f.category === "dead-exports"
    );

    // getPermissions from auth.ts is imported by user.ts
    // getUser from user.ts is imported by auth.ts
    // These should NOT be flagged as dead
    const permFindings = deadFindings.filter(
      (f) => f.file === "src/auth.ts" && f.detail?.includes("getPermissions")
    );
    expect(permFindings).toHaveLength(0);

    const userFindings = deadFindings.filter(
      (f) => f.file === "src/user.ts" && f.detail?.includes("getUser")
    );
    expect(userFindings).toHaveLength(0);
  });

  it("handles project with no exports", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "empty-project"));
    const stats = result.stats as {
      totalExports: number;
      deadExports: number;
      percentDead: number;
    };

    expect(stats.totalExports).toBe(0);
    expect(stats.deadExports).toBe(0);
    expect(stats.percentDead).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it("handles empty project", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "no-package"));
    const stats = result.stats as {
      totalExports: number;
      deadExports: number;
      percentDead: number;
    };

    expect(stats.totalExports).toBe(0);
    expect(stats.deadExports).toBe(0);
    expect(stats.percentDead).toBe(0);
    expect(result.findings).toEqual([]);
  });
});

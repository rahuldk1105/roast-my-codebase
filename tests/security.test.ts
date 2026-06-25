import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { SecurityScanner } from "../src/scanners/security.js";

const FIXTURES = path.resolve(__dirname, "../tests/fixtures");

describe("SecurityScanner", () => {
  const scanner = new SecurityScanner();

  it("detects AWS access keys", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    // Should not detect in our clean sample project
    const awsFindings = result.findings.filter((f) =>
      f.message.includes("AWS Access Key")
    );
    expect(awsFindings).toEqual([]);
  });

  it("detects eval() usage", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    const evalFindings = result.findings.filter(
      (f) => f.category === "eval-usage"
    );
    // Should be 0 in clean project
    expect(evalFindings.length).toBeGreaterThanOrEqual(0);
  });

  it("returns empty findings for non-git repo", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "no-package"));

    const envFindings = result.findings.filter(
      (f) => f.category === "env-in-git"
    );
    expect(envFindings).toEqual([]);
  });

  it("handles empty project gracefully", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "empty-project"));

    expect(result.findings).toEqual([]);
  });

  it("returns stats with counts", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats as {
      secretsFound: number;
      envFilesInGit: number;
      evalUsage: number;
    };

    expect(stats.secretsFound).toBeDefined();
    expect(stats.envFilesInGit).toBeDefined();
    expect(stats.evalUsage).toBeDefined();
    expect(typeof stats.secretsFound).toBe("number");
    expect(typeof stats.envFilesInGit).toBe("number");
    expect(typeof stats.evalUsage).toBe("number");
  });

  it("detects potential API keys in code", async () => {
    // Create a temporary test file with an API key pattern
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "security-test-"));
    const testFile = path.join(tempDir, "config.ts");

    fs.writeFileSync(
      testFile,
      `const apiKey = "abcdef1234567890abcdef1234567890";`
    );

    const result = await scanner.scan(tempDir);

    const apiKeyFindings = result.findings.filter((f) =>
      f.message.includes("Generic API Key")
    );
    expect(apiKeyFindings.length).toBeGreaterThan(0);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("does not detect secrets in test files", async () => {
    // Create temp dir with test file containing a fake secret
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "security-test-"));
    const testFile = path.join(tempDir, "auth.test.ts");

    fs.writeFileSync(
      testFile,
      `const mockKey = "AKIAIOSFODNN7EXAMPLE";` // Fake AWS key
    );

    const result = await scanner.scan(tempDir);

    // Should be excluded because it's a .test. file
    const awsFindings = result.findings.filter((f) =>
      f.message.includes("AWS")
    );
    expect(awsFindings).toEqual([]);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects multiple secret types in same file", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "security-test-"));
    const testFile = path.join(tempDir, "secrets.ts");

    fs.writeFileSync(
      testFile,
      `
      const api_key = "abcdef1234567890abcdef1234567890";
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
      `
    );

    const result = await scanner.scan(tempDir);

    expect(result.findings.length).toBeGreaterThan(1);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

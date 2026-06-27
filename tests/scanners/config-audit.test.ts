import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { ConfigAuditScanner } from "../../src/scanners/config-audit.js";

describe("ConfigAuditScanner", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-audit-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ──────────────────────────────────────────────
  // TypeScript checks
  // ──────────────────────────────────────────────

  describe("TypeScript", () => {
    it("emits warning when no tsconfig.json exists", async () => {
      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-no-tsconfig");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("warning");
      expect(finding?.category).toBe("config-audit");
    });

    it("emits warning when strict is false", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { strict: false } })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-ts-no-strict");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("warning");
      expect(finding?.message).toContain("strict mode disabled");
    });

    it("does not emit strict finding when strict is true", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noUncheckedIndexedAccess: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
            exactOptionalPropertyTypes: true,
          },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const strictFinding = result.findings.find((f) => f.id === "config-ts-no-strict");
      expect(strictFinding).toBeUndefined();
    });

    it("emits info when skipLibCheck is true", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            skipLibCheck: true,
          },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-ts-skip-lib-check");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
      expect(finding?.message).toContain("skipLibCheck");
    });

    it("emits warning when target is ES5", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            target: "ES5",
          },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-ts-old-target");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("warning");
      expect(finding?.message).toContain("ES5");
    });

    it("emits warning when target is ES3", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            target: "ES3",
          },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-ts-old-target");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("warning");
    });

    it("does not emit old-target finding for ES2022", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            target: "ES2022",
          },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-ts-old-target");
      expect(finding).toBeUndefined();
    });

    it("emits info for allowJs without checkJs", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            allowJs: true,
          },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-ts-allow-js-no-check");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
    });

    it("does not emit allowJs finding when checkJs is also true", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            allowJs: true,
            checkJs: true,
          },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-ts-allow-js-no-check");
      expect(finding).toBeUndefined();
    });

    it("handles tsconfig with no compilerOptions without crashing", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({ include: ["src/**/*"] })
      );

      const scanner = new ConfigAuditScanner();
      await expect(scanner.scan(tmpDir)).resolves.not.toThrow();

      const result = await scanner.scan(tmpDir);
      // Should have findings for missing options but no crash
      expect(result.findings).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
    });

    it("strips JSON comments before parsing tsconfig", async () => {
      const tsconfigWithComments = `{
  // This is a comment
  "compilerOptions": {
    /* block comment */
    "strict": true,
    "target": "ES2022"
  }
}`;
      fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), tsconfigWithComments);

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      // strict: true — no strict finding
      const strictFinding = result.findings.find((f) => f.id === "config-ts-no-strict");
      expect(strictFinding).toBeUndefined();

      // target: ES2022 — no old-target finding
      const targetFinding = result.findings.find((f) => f.id === "config-ts-old-target");
      expect(targetFinding).toBeUndefined();
    });

    it("falls back to tsconfig.base.json if tsconfig.json is absent", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.base.json"),
        JSON.stringify({ compilerOptions: { strict: false } })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const strictFinding = result.findings.find((f) => f.id === "config-ts-no-strict");
      expect(strictFinding).toBeDefined();
      expect(strictFinding?.file).toBe("tsconfig.base.json");
    });
  });

  // ──────────────────────────────────────────────
  // ESLint checks
  // ──────────────────────────────────────────────

  describe("ESLint", () => {
    it("emits info when no ESLint config exists", async () => {
      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-no-eslint");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
      expect(finding?.message).toContain("No ESLint config");
    });

    it("does not emit no-eslint finding when .eslintrc.json exists", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".eslintrc.json"),
        JSON.stringify({
          extends: ["eslint:recommended", "@typescript-eslint/recommended", "prettier"],
          plugins: ["@typescript-eslint"],
          rules: {
            "no-console": "warn",
            "no-unused-vars": "error",
          },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const noEslint = result.findings.find((f) => f.id === "config-no-eslint");
      expect(noEslint).toBeUndefined();
    });

    it("emits info when ESLint has no extends", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".eslintrc.json"),
        JSON.stringify({
          rules: { "no-console": "warn" },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-eslint-no-extends");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
    });

    it("emits warning for missing @typescript-eslint when tsconfig.json exists", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { strict: true } })
      );
      fs.writeFileSync(
        path.join(tmpDir, ".eslintrc.json"),
        JSON.stringify({
          extends: ["eslint:recommended"],
          rules: { "no-console": "warn", "no-unused-vars": "error" },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-eslint-no-ts-plugin");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("warning");
      expect(finding?.message).toContain("@typescript-eslint");
    });

    it("does not emit @typescript-eslint warning when no tsconfig exists", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".eslintrc.json"),
        JSON.stringify({
          extends: ["eslint:recommended"],
          rules: { "no-console": "warn", "no-unused-vars": "error" },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-eslint-no-ts-plugin");
      expect(finding).toBeUndefined();
    });

    it("emits info for no-console rule missing", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".eslintrc.json"),
        JSON.stringify({
          extends: ["eslint:recommended"],
          rules: { "no-unused-vars": "error" },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-eslint-no-console-rule");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
    });

    it("emits info for missing unused-vars rule", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".eslintrc.json"),
        JSON.stringify({
          extends: ["eslint:recommended"],
          rules: { "no-console": "warn" },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-eslint-no-unused-vars");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
    });

    it("does not emit unused-vars finding when @typescript-eslint/no-unused-vars is set", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".eslintrc.json"),
        JSON.stringify({
          extends: ["eslint:recommended"],
          rules: {
            "no-console": "warn",
            "@typescript-eslint/no-unused-vars": "error",
          },
        })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-eslint-no-unused-vars");
      expect(finding).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────
  // Prettier checks
  // ──────────────────────────────────────────────

  describe("Prettier", () => {
    it("emits info when no Prettier config and no prettier in package.json", async () => {
      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-no-prettier");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
    });

    it("does not emit no-prettier finding when prettier is in package.json devDependencies", async () => {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ devDependencies: { prettier: "^3.0.0" } })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-no-prettier");
      expect(finding).toBeUndefined();
    });

    it("emits info when printWidth is greater than 120", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".prettierrc.json"),
        JSON.stringify({ printWidth: 200 })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-prettier-wide-print");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
      expect(finding?.message).toContain("200");
    });

    it("does not emit printWidth finding when printWidth is 120 or less", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".prettierrc.json"),
        JSON.stringify({ printWidth: 120 })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-prettier-wide-print");
      expect(finding).toBeUndefined();
    });

    it("emits info when semi is false", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".prettierrc.json"),
        JSON.stringify({ semi: false })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-prettier-no-semi");
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("info");
      expect(finding?.message).toContain("semicolons disabled");
    });

    it("does not emit semi finding when semi is true", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".prettierrc.json"),
        JSON.stringify({ semi: true })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find((f) => f.id === "config-prettier-no-semi");
      expect(finding).toBeUndefined();
    });

    it("uses .prettierrc (no extension) as JSON config", async () => {
      fs.writeFileSync(
        path.join(tmpDir, ".prettierrc"),
        JSON.stringify({ semi: false, printWidth: 200 })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      const semiFinding = result.findings.find((f) => f.id === "config-prettier-no-semi");
      expect(semiFinding).toBeDefined();

      const widthFinding = result.findings.find((f) => f.id === "config-prettier-wide-print");
      expect(widthFinding).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────
  // General / clean config
  // ──────────────────────────────────────────────

  describe("General", () => {
    it("returns ScanResult with findings array and totalChecks stat", async () => {
      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      expect(result.findings).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
      expect((result.stats as { totalChecks: number }).totalChecks).toBe(result.findings.length);
    });

    it("scanner name is config-audit", () => {
      const scanner = new ConfigAuditScanner();
      expect(scanner.name).toBe("config-audit");
    });

    it("all findings have category config-audit", async () => {
      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      for (const finding of result.findings) {
        expect(finding.category).toBe("config-audit");
      }
    });

    it("produces minimal findings for a well-configured project", async () => {
      // Write a clean tsconfig
      fs.writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            noUncheckedIndexedAccess: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
            exactOptionalPropertyTypes: true,
            target: "ES2022",
          },
        })
      );

      // Write a clean eslint config with all required rules
      fs.writeFileSync(
        path.join(tmpDir, ".eslintrc.json"),
        JSON.stringify({
          extends: ["eslint:recommended", "@typescript-eslint/recommended"],
          plugins: ["@typescript-eslint"],
          rules: {
            "no-console": "warn",
            "@typescript-eslint/no-unused-vars": "error",
          },
        })
      );

      // Write a clean prettier config
      fs.writeFileSync(
        path.join(tmpDir, ".prettierrc.json"),
        JSON.stringify({ printWidth: 80, semi: true })
      );

      const scanner = new ConfigAuditScanner();
      const result = await scanner.scan(tmpDir);

      // Only informational findings (for noUncheckedIndexedAccess etc. that are info)
      const warnings = result.findings.filter((f) => f.severity === "warning");
      expect(warnings).toHaveLength(0);
    });
  });
});

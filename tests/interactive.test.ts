import { describe, it, expect } from "vitest";
import { applyAutoFix } from "../src/interactive/fixes.js";
import { Finding } from "../src/types/index.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("Interactive Mode - Auto Fixes", () => {
  describe("TODO Comment Fixes", () => {
    it("should add issue references to TODO comments in dry-run mode", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const testFile = path.join(tempDir, "test.ts");

      fs.writeFileSync(testFile, `
// TODO: Fix this bug
function example() {
  // FIXME: Refactor
  return true;
}
`);

      const finding: Finding = {
        id: "todo-1",
        severity: "info",
        category: "todos",
        message: "TODO comment found",
        file: "test.ts",
      };

      const fix = {
        findingId: "todo-1",
        suggestion: "Add issue references",
        autoFixable: true,
      };

      const result = await applyAutoFix(finding, fix, tempDir, true);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Would add issue references");

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should add issue references to TODO comments when not dry-run", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const testFile = path.join(tempDir, "test.ts");

      const originalContent = `
// TODO: Fix this bug
function example() {
  // FIXME: Refactor
  return true;
}
`;
      fs.writeFileSync(testFile, originalContent);

      const finding: Finding = {
        id: "todo-1",
        severity: "info",
        category: "todos",
        message: "TODO comment found",
        file: "test.ts",
      };

      const fix = {
        findingId: "todo-1",
        suggestion: "Add issue references",
        autoFixable: true,
      };

      const result = await applyAutoFix(finding, fix, tempDir, false);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Added issue references");

      const modifiedContent = fs.readFileSync(testFile, "utf-8");
      expect(modifiedContent).toContain("TODO: Fix this bug (Issue: #TODO - create issue)");
      expect(modifiedContent).toContain("FIXME: Refactor (Issue: #TODO - create issue)");

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should handle files with no TODOs gracefully", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const testFile = path.join(tempDir, "test.ts");

      fs.writeFileSync(testFile, `
function example() {
  return true;
}
`);

      const finding: Finding = {
        id: "todo-1",
        severity: "info",
        category: "todos",
        message: "TODO comment found",
        file: "test.ts",
      };

      const fix = {
        findingId: "todo-1",
        suggestion: "Add issue references",
        autoFixable: true,
      };

      const result = await applyAutoFix(finding, fix, tempDir, false);

      expect(result.success).toBe(false);
      expect(result.message).toContain("No TODOs found");

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe("Dead Export Fixes", () => {
    it("should remove dead exports in dry-run mode", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const testFile = path.join(tempDir, "test.ts");

      fs.writeFileSync(testFile, `
export const unusedFunction = () => {
  return 42;
};

export function usedFunction() {
  return 100;
}
`);

      const finding: Finding = {
        id: "dead-export-1",
        severity: "info",
        category: "dead-exports",
        message: "`unusedFunction` is exported but never imported",
        file: "test.ts",
      };

      const fix = {
        findingId: "dead-export-1",
        suggestion: "Remove dead export",
        autoFixable: true,
      };

      const result = await applyAutoFix(finding, fix, tempDir, true);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Would remove dead export");

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should remove dead exports when not dry-run", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const testFile = path.join(tempDir, "test.ts");

      const originalContent = `
export const unusedFunction = () => {
  return 42;
};

export function usedFunction() {
  return 100;
}
`;
      fs.writeFileSync(testFile, originalContent);

      const finding: Finding = {
        id: "dead-export-1",
        severity: "info",
        category: "dead-exports",
        message: "`unusedFunction` is exported but never imported",
        file: "test.ts",
      };

      const fix = {
        findingId: "dead-export-1",
        suggestion: "Remove dead export",
        autoFixable: true,
      };

      const result = await applyAutoFix(finding, fix, tempDir, false);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Removed dead export");

      const modifiedContent = fs.readFileSync(testFile, "utf-8");
      expect(modifiedContent).not.toContain("export const unusedFunction");
      expect(modifiedContent).toContain("export function usedFunction");

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe("Unused Dependency Fixes", () => {
    it("should handle unused dependencies in dry-run mode", async () => {
      const finding: Finding = {
        id: "unused-dep-1",
        severity: "warning",
        category: "unused-dependencies",
        message: "`lodash` is installed but never imported",
        detail: "lodash",
      };

      const fix = {
        findingId: "unused-dep-1",
        suggestion: "Remove unused dependency",
        autoFixable: true,
        command: "npm uninstall lodash",
      };

      const result = await applyAutoFix(finding, fix, process.cwd(), true);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Would run: npm uninstall lodash");
    });
  });

  describe("Next.js Client Server Fixes", () => {
    it("should prepend 'use client' in dry-run mode", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const testFile = path.join(tempDir, "page.tsx");

      fs.writeFileSync(testFile, `export default function Page() { return null; }\n`);

      const finding: Finding = {
        id: "nextjs-cs-1",
        severity: "warning",
        category: "nextjs-client-server",
        message: "Component uses client hooks without 'use client'",
        file: "page.tsx",
      };

      const fix = { findingId: "nextjs-cs-1", suggestion: "Add use client", autoFixable: true };

      const result = await applyAutoFix(finding, fix, tempDir, true);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Would prepend 'use client'");

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should prepend 'use client' when not dry-run", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const testFile = path.join(tempDir, "page.tsx");

      fs.writeFileSync(testFile, `export default function Page() { return null; }\n`);

      const finding: Finding = {
        id: "nextjs-cs-2",
        severity: "warning",
        category: "nextjs-client-server",
        message: "Component uses client hooks without 'use client'",
        file: "page.tsx",
      };

      const fix = { findingId: "nextjs-cs-2", suggestion: "Add use client", autoFixable: true };

      const result = await applyAutoFix(finding, fix, tempDir, false);

      expect(result.success).toBe(true);
      const content = fs.readFileSync(testFile, "utf-8");
      expect(content.startsWith("'use client';")).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should not modify file that already has 'use client'", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const testFile = path.join(tempDir, "page.tsx");

      fs.writeFileSync(testFile, `'use client';\n\nexport default function Page() { return null; }\n`);

      const finding: Finding = {
        id: "nextjs-cs-3",
        severity: "warning",
        category: "nextjs-client-server",
        message: "Component uses client hooks without 'use client'",
        file: "page.tsx",
      };

      const fix = { findingId: "nextjs-cs-3", suggestion: "Add use client", autoFixable: true };

      const result = await applyAutoFix(finding, fix, tempDir, false);

      expect(result.success).toBe(false);
      expect(result.message).toContain("already has 'use client'");

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe("Type Safety Fixes", () => {
    it("should replace @ts-ignore with @ts-expect-error in dry-run mode", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const testFile = path.join(tempDir, "code.ts");

      fs.writeFileSync(testFile, `// @ts-ignore\nconst x: string = 42;\n`);

      const finding: Finding = {
        id: "ts-1",
        severity: "warning",
        category: "type-safety",
        message: "Found @ts-ignore suppression",
        file: "code.ts",
      };

      const fix = { findingId: "ts-1", suggestion: "Replace with ts-expect-error", autoFixable: true };

      const result = await applyAutoFix(finding, fix, tempDir, true);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Would replace");
      expect(result.message).toContain("@ts-ignore");

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should replace @ts-ignore with @ts-expect-error when not dry-run", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const testFile = path.join(tempDir, "code.ts");

      fs.writeFileSync(testFile, `// @ts-ignore\nconst x: string = 42;\n// @ts-ignore some reason\nconst y = x;\n`);

      const finding: Finding = {
        id: "ts-2",
        severity: "warning",
        category: "type-safety",
        message: "Found @ts-ignore suppression",
        file: "code.ts",
      };

      const fix = { findingId: "ts-2", suggestion: "Replace with ts-expect-error", autoFixable: true };

      const result = await applyAutoFix(finding, fix, tempDir, false);

      expect(result.success).toBe(true);
      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).not.toContain("@ts-ignore");
      expect(content).toContain("@ts-expect-error -- TODO: fix type error");

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should skip non-@ts-ignore findings", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));

      const finding: Finding = {
        id: "ts-3",
        severity: "warning",
        category: "type-safety",
        message: "Using `any` type",
        file: "code.ts",
      };

      const fix = { findingId: "ts-3", suggestion: "Fix type", autoFixable: true };

      const result = await applyAutoFix(finding, fix, tempDir, false);

      expect(result.success).toBe(false);
      expect(result.message).toContain("only supports @ts-ignore");

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe("Test Coverage Fixes", () => {
    it("should report what file would be created in dry-run mode", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));

      const finding: Finding = {
        id: "cov-1",
        severity: "info",
        category: "test-coverage",
        message: "No tests found for this file",
        file: "src/utils/helper.ts",
      };

      const fix = { findingId: "cov-1", suggestion: "Create test file", autoFixable: true };

      const result = await applyAutoFix(finding, fix, tempDir, true);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Would create test file");
      expect(result.message).toContain("tests/utils/helper.test.ts");

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should create a skeleton test file when not dry-run", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));

      const finding: Finding = {
        id: "cov-2",
        severity: "info",
        category: "test-coverage",
        message: "No tests found for this file",
        file: "src/utils/helper.ts",
      };

      const fix = { findingId: "cov-2", suggestion: "Create test file", autoFixable: true };

      const result = await applyAutoFix(finding, fix, tempDir, false);

      expect(result.success).toBe(true);
      const testPath = path.join(tempDir, "tests/utils/helper.test.ts");
      expect(fs.existsSync(testPath)).toBe(true);
      const content = fs.readFileSync(testPath, "utf-8");
      expect(content).toContain("describe('helper'");
      expect(content).toContain("from 'vitest'");

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should not overwrite an existing test file", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const testPath = path.join(tempDir, "tests/utils/helper.test.ts");
      fs.mkdirSync(path.dirname(testPath), { recursive: true });
      fs.writeFileSync(testPath, "// existing tests\n");

      const finding: Finding = {
        id: "cov-3",
        severity: "info",
        category: "test-coverage",
        message: "No tests found for this file",
        file: "src/utils/helper.ts",
      };

      const fix = { findingId: "cov-3", suggestion: "Create test file", autoFixable: true };

      const result = await applyAutoFix(finding, fix, tempDir, false);

      expect(result.success).toBe(false);
      expect(result.message).toContain("already exists");

      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe("Unsupported Category", () => {
    it("should return error for unsupported categories", async () => {
      const finding: Finding = {
        id: "unsupported-1",
        severity: "warning",
        category: "unsupported-category",
        message: "Unsupported issue",
      };

      const fix = {
        findingId: "unsupported-1",
        suggestion: "Fix it",
        autoFixable: false,
      };

      const result = await applyAutoFix(finding, fix, process.cwd(), false);

      expect(result.success).toBe(false);
      expect(result.message).toContain("No auto-fix available");
    });
  });
});

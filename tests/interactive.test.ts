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

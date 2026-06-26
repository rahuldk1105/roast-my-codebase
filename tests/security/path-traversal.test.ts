import { describe, it, expect } from "vitest";
import path from "path";
import os from "os";
import { validateOutputPath, validatePluginPath } from "../../src/utils/security.js";

describe("Path Traversal Protection", () => {
  describe("Output Path Validation", () => {
    const rootDir = path.resolve("/project");

    it("should accept valid output paths", () => {
      expect(validateOutputPath(rootDir, ".roast-report.md")).toBe(
        path.join(rootDir, ".roast-report.md")
      );
      expect(validateOutputPath(rootDir, "reports/output.md")).toBe(
        path.join(rootDir, "reports/output.md")
      );
    });

    it("should reject path traversal attempts", () => {
      expect(() => validateOutputPath(rootDir, "../../../etc/passwd")).toThrow(
        /escapes project directory/
      );
      expect(() => validateOutputPath(rootDir, "../../outside.md")).toThrow(
        /escapes project directory/
      );
    });

    it("should reject absolute paths outside project", () => {
      expect(() => validateOutputPath(rootDir, "/etc/passwd")).toThrow(
        /escapes project directory/
      );
      expect(() => validateOutputPath(rootDir, "/tmp/evil.md")).toThrow(
        /escapes project directory/
      );
    });

    it("should handle Windows paths correctly", () => {
      if (os.platform() === "win32") {
        expect(() => validateOutputPath("C:\\project", "..\\..\\Windows\\System32")).toThrow(
          /escapes project directory/
        );
      }
    });

    it("should accept paths within subdirectories", () => {
      expect(validateOutputPath(rootDir, "docs/reports/output.md")).toBe(
        path.join(rootDir, "docs/reports/output.md")
      );
    });
  });

  describe("Plugin Path Validation", () => {
    const rootDir = path.resolve("/project");

    it("should accept valid plugin paths", () => {
      expect(validatePluginPath(rootDir, "roast-plugin-graphql")).toBe(
        path.resolve(rootDir, "node_modules", "roast-plugin-graphql")
      );
      expect(validatePluginPath(rootDir, "@company/roast-plugin-internal")).toBe(
        path.resolve(rootDir, "node_modules", "@company/roast-plugin-internal")
      );
    });

    it("should reject path traversal attempts", () => {
      expect(() => validatePluginPath(rootDir, "../../../malicious")).toThrow(
        /escapes node_modules/
      );
      expect(() => validatePluginPath(rootDir, "../../etc/passwd")).toThrow(
        /escapes node_modules/
      );
    });

    it("should reject absolute paths", () => {
      expect(() => validatePluginPath(rootDir, "/etc/passwd")).toThrow(
        /escapes node_modules/
      );
    });
  });
});

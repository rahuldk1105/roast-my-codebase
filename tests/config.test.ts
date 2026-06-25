import { describe, it, expect } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { loadConfig, isScannerDisabled, getThreshold, getDeduction } from "../src/config/index.js";

describe("Config", () => {
  it("returns default config when no .roastrc.json exists", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    const config = loadConfig(tempDir);

    expect(config.thresholds?.largeFile).toBe(500);
    expect(config.thresholds?.extremeFile).toBe(2000);
    expect(config.scanners?.disabled).toEqual([]);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads and merges user config", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    const configPath = path.join(tempDir, ".roastrc.json");

    fs.writeFileSync(
      configPath,
      JSON.stringify({
        thresholds: {
          largeFile: 1000,
        },
        scanners: {
          disabled: ["test-coverage"],
        },
      })
    );

    const config = loadConfig(tempDir);

    expect(config.thresholds?.largeFile).toBe(1000);
    expect(config.thresholds?.extremeFile).toBe(2000); // Default preserved
    expect(config.scanners?.disabled).toContain("test-coverage");

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("handles invalid JSON gracefully", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    const configPath = path.join(tempDir, ".roastrc.json");

    fs.writeFileSync(configPath, "{ invalid json }");

    const config = loadConfig(tempDir);

    // Should return defaults
    expect(config.thresholds?.largeFile).toBe(500);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("checks if scanner is disabled", () => {
    const config = {
      scanners: {
        disabled: ["test-coverage", "framework"],
      },
    };

    expect(isScannerDisabled(config, "test-coverage")).toBe(true);
    expect(isScannerDisabled(config, "framework")).toBe(true);
    expect(isScannerDisabled(config, "security")).toBe(false);
  });

  it("gets threshold values", () => {
    const config = {
      thresholds: {
        largeFile: 1000,
        extremeFile: 3000,
      },
    };

    expect(getThreshold(config, "largeFile")).toBe(1000);
    expect(getThreshold(config, "extremeFile")).toBe(3000);
    expect(getThreshold(config, "highChurn")).toBe(50); // Default
  });

  it("gets custom deduction values", () => {
    const config = {
      deductions: {
        secret: -20,
        missingTest: -1,
      },
    };

    expect(getDeduction(config, "secret", -10)).toBe(-20);
    expect(getDeduction(config, "missingTest", -0.5)).toBe(-1);
    expect(getDeduction(config, "gitChurn", -3)).toBe(-3); // Uses default
  });

  it("merges ignore patterns", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    const configPath = path.join(tempDir, ".roastrc.json");

    fs.writeFileSync(
      configPath,
      JSON.stringify({
        ignore: ["**/vendor/**", "**/third-party/**"],
      })
    );

    const config = loadConfig(tempDir);

    expect(config.ignore).toContain("**/vendor/**");
    expect(config.ignore).toContain("**/third-party/**");

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("merges plugin list", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-test-"));
    const configPath = path.join(tempDir, ".roastrc.json");

    fs.writeFileSync(
      configPath,
      JSON.stringify({
        plugins: ["roast-plugin-example", "@company/roast-plugin-internal"],
      })
    );

    const config = loadConfig(tempDir);

    expect(config.plugins).toContain("roast-plugin-example");
    expect(config.plugins).toContain("@company/roast-plugin-internal");

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

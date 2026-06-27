import { describe, it, expect } from "vitest";
import { buildConfig } from "../src/init/index.js";

describe("buildConfig", () => {
  it("sets largeFile threshold from answers", () => {
    const config = buildConfig({
      threshold: 70,
      largeFileThreshold: 500,
      disabledScanners: [],
      ignorePatterns: [],
      aiEnabled: false,
    });

    expect(config.thresholds?.largeFile).toBe(500);
  });

  it("sets extremeFile to largeFile * 4", () => {
    const config = buildConfig({
      threshold: 70,
      largeFileThreshold: 300,
      disabledScanners: [],
      ignorePatterns: [],
      aiEnabled: false,
    });

    expect(config.thresholds?.extremeFile).toBe(1200);
  });

  it("extremeFile is always largeFile * 4 for any input", () => {
    for (const largeFile of [100, 250, 500, 750, 1000]) {
      const config = buildConfig({
        threshold: 70,
        largeFileThreshold: largeFile,
        disabledScanners: [],
        ignorePatterns: [],
        aiEnabled: false,
      });

      expect(config.thresholds?.extremeFile).toBe(largeFile * 4);
    }
  });

  it("preserves empty disabledScanners array", () => {
    const config = buildConfig({
      threshold: 70,
      largeFileThreshold: 500,
      disabledScanners: [],
      ignorePatterns: [],
      aiEnabled: false,
    });

    expect(config.scanners?.disabled).toEqual([]);
  });

  it("populates disabledScanners when provided", () => {
    const config = buildConfig({
      threshold: 70,
      largeFileThreshold: 500,
      disabledScanners: ["test-coverage", "git-insights"],
      ignorePatterns: [],
      aiEnabled: false,
    });

    expect(config.scanners?.disabled).toEqual(["test-coverage", "git-insights"]);
  });

  it("omits ai field when aiEnabled is false", () => {
    const config = buildConfig({
      threshold: 70,
      largeFileThreshold: 500,
      disabledScanners: [],
      ignorePatterns: [],
      aiEnabled: false,
    });

    expect(config.ai).toBeUndefined();
  });

  it("includes ai.enabled: true when aiEnabled is true", () => {
    const config = buildConfig({
      threshold: 70,
      largeFileThreshold: 500,
      disabledScanners: [],
      ignorePatterns: [],
      aiEnabled: true,
    });

    expect(config.ai).toBeDefined();
    expect(config.ai?.enabled).toBe(true);
  });

  it("includes ignore patterns correctly", () => {
    const config = buildConfig({
      threshold: 70,
      largeFileThreshold: 500,
      disabledScanners: [],
      ignorePatterns: ["vendor", "generated", "**/tmp/**"],
      aiEnabled: false,
    });

    expect(config.ignore).toEqual(["vendor", "generated", "**/tmp/**"]);
  });

  it("preserves empty ignore patterns", () => {
    const config = buildConfig({
      threshold: 70,
      largeFileThreshold: 500,
      disabledScanners: [],
      ignorePatterns: [],
      aiEnabled: false,
    });

    expect(config.ignore).toEqual([]);
  });

  it("produces a valid RoastConfig shape", () => {
    const config = buildConfig({
      threshold: 80,
      largeFileThreshold: 300,
      disabledScanners: ["duplicates", "framework"],
      ignorePatterns: ["vendor"],
      aiEnabled: true,
    });

    // Required top-level keys
    expect(config).toHaveProperty("thresholds");
    expect(config).toHaveProperty("scanners");
    expect(config).toHaveProperty("ignore");

    // Correct nested shape
    expect(typeof config.thresholds?.largeFile).toBe("number");
    expect(typeof config.thresholds?.extremeFile).toBe("number");
    expect(Array.isArray(config.scanners?.disabled)).toBe(true);
    expect(Array.isArray(config.ignore)).toBe(true);
  });

  it("all five scanner names can be disabled", () => {
    const all = ["test-coverage", "git-insights", "dep-health", "duplicates", "framework"];
    const config = buildConfig({
      threshold: 60,
      largeFileThreshold: 1000,
      disabledScanners: all,
      ignorePatterns: [],
      aiEnabled: false,
    });

    expect(config.scanners?.disabled).toEqual(all);
  });
});

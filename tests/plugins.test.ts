import { describe, it, expect, vi, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { loadPlugins } from "../src/plugins/index.js";
import { isValidPluginName } from "../src/utils/security.js";
import { RoastConfig } from "../src/config/index.js";

describe("isValidPluginName", () => {
  it("accepts roast-plugin-foo", () => {
    expect(isValidPluginName("roast-plugin-foo")).toBe(true);
  });

  it("accepts @scope/roast-plugin-foo", () => {
    expect(isValidPluginName("@scope/roast-plugin-foo")).toBe(true);
  });

  it("accepts @company/roast-plugin-internal", () => {
    expect(isValidPluginName("@company/roast-plugin-internal")).toBe(true);
  });

  it("rejects ../evil (path traversal)", () => {
    expect(isValidPluginName("../evil")).toBe(false);
  });

  it("rejects __proto__", () => {
    expect(isValidPluginName("__proto__")).toBe(false);
  });

  it("rejects plain lodash", () => {
    expect(isValidPluginName("lodash")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidPluginName("")).toBe(false);
  });

  it("rejects arbitrary package without roast-plugin prefix", () => {
    expect(isValidPluginName("my-custom-scanner")).toBe(false);
  });

  it("rejects scoped package without roast-plugin prefix", () => {
    expect(isValidPluginName("@scope/my-package")).toBe(false);
  });
});

describe("loadPlugins", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    warnSpy.mockClear();
  });

  it("returns empty array when no plugins configured", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugins-test-"));
    const config: RoastConfig = { plugins: [] };

    const scanners = await loadPlugins(config, tempDir);

    expect(scanners).toEqual([]);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when plugins field is absent", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugins-test-"));
    const config: RoastConfig = {};

    const scanners = await loadPlugins(config, tempDir);

    expect(scanners).toEqual([]);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("warns and skips plugin with invalid name", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugins-test-"));
    const config: RoastConfig = { plugins: ["../evil-plugin"] };

    const scanners = await loadPlugins(config, tempDir);

    expect(scanners).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid plugin name")
    );
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("warns and skips missing plugins gracefully", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugins-test-"));
    const config: RoastConfig = { plugins: ["roast-plugin-nonexistent-xyz"] };

    const scanners = await loadPlugins(config, tempDir);

    expect(scanners).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Plugin "roast-plugin-nonexistent-xyz" not found')
    );
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("warns and skips plugins with invalid name pattern (plain package)", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugins-test-"));
    const config: RoastConfig = { plugins: ["express"] };

    const scanners = await loadPlugins(config, tempDir);

    expect(scanners).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid plugin name")
    );
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("warns and skips plugin named __proto__", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugins-test-"));
    const config: RoastConfig = { plugins: ["__proto__"] };

    const scanners = await loadPlugins(config, tempDir);

    expect(scanners).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Invalid plugin name")
    );
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});

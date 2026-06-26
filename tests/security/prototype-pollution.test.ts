import { describe, it, expect } from "vitest";
import { validateConfig, safeJsonParse } from "../../src/config/validation.js";

describe("Prototype Pollution Protection", () => {
  describe("Safe JSON Parse", () => {
    it("should parse normal JSON safely", () => {
      const json = '{"name": "test", "value": 123}';
      const result = safeJsonParse(json);
      expect(result).toEqual({ name: "test", value: 123 });
    });

    it("should detect and remove __proto__ pollution attempts", () => {
      const maliciousJson = '{"__proto__": {"isAdmin": true}, "name": "test"}';
      const result = safeJsonParse(maliciousJson) as any;

      expect(result).toBeDefined();
      expect(result.name).toBe("test");
      // Check that __proto__ property was removed (not inherited)
      expect(result.hasOwnProperty("__proto__")).toBe(false);
      expect((result as any).isAdmin).toBeUndefined();
    });

    it("should detect and remove constructor pollution attempts", () => {
      const maliciousJson = '{"constructor": {"prototype": {"isAdmin": true}}}';
      const result = safeJsonParse(maliciousJson) as any;

      expect(result).toBeDefined();
      // Check that constructor property was removed (not inherited)
      expect(result.hasOwnProperty("constructor")).toBe(false);
    });

    it("should return null on invalid JSON", () => {
      const invalidJson = "{ invalid json }";
      const result = safeJsonParse(invalidJson);
      expect(result).toBeNull();
    });
  });

  describe("Config Validation", () => {
    it("should validate and accept valid config", () => {
      const validConfig = {
        thresholds: {
          largeFile: 1000,
          extremeFile: 2000,
        },
        scanners: {
          disabled: ["test-coverage"],
        },
      };

      const result = validateConfig(validConfig);
      expect(result.thresholds?.largeFile).toBe(1000);
      expect(result.thresholds?.extremeFile).toBe(2000);
      expect(result.scanners?.disabled).toContain("test-coverage");
    });

    it("should reject __proto__ in config", () => {
      const maliciousConfig = {
        __proto__: { isAdmin: true },
        thresholds: { largeFile: 1000 },
      };

      const result = validateConfig(maliciousConfig);
      // Check that __proto__ was not copied as own property
      expect(result.hasOwnProperty("__proto__")).toBe(false);
      expect((result as any).isAdmin).toBeUndefined();
    });

    it("should reject __proto__ in deductions", () => {
      const maliciousConfig = {
        deductions: {
          __proto__: -999,
          constructor: -999,
          prototype: -999,
          normalKey: -10,
        },
      };

      const result = validateConfig(maliciousConfig);
      expect(result.deductions).toBeDefined();
      // Check that dangerous keys were not copied as own properties
      expect(result.deductions!.hasOwnProperty("__proto__")).toBe(false);
      expect(result.deductions!.hasOwnProperty("constructor")).toBe(false);
      expect(result.deductions!.hasOwnProperty("prototype")).toBe(false);
      expect(result.deductions!.normalKey).toBe(-10);
    });

    it("should filter out non-number threshold values", () => {
      const badConfig = {
        thresholds: {
          largeFile: "not a number",
          extremeFile: 2000,
          negative: -100,
        },
      };

      const result = validateConfig(badConfig);
      expect(result.thresholds?.largeFile).toBeUndefined();
      expect(result.thresholds?.extremeFile).toBe(2000);
      expect(result.thresholds?.negative).toBeUndefined(); // Negative values rejected
    });

    it("should filter out non-string scanner names", () => {
      const badConfig = {
        scanners: {
          disabled: ["valid", 123, null, "another-valid", {}],
        },
      };

      const result = validateConfig(badConfig);
      expect(result.scanners?.disabled).toEqual(["valid", "another-valid"]);
    });

    it("should filter out non-string ignore patterns", () => {
      const badConfig = {
        ignore: ["**/node_modules/**", 123, null, "**/dist/**"],
      };

      const result = validateConfig(badConfig);
      expect(result.ignore).toEqual(["**/node_modules/**", "**/dist/**"]);
    });

    it("should reject non-object config", () => {
      expect(() => validateConfig("not an object")).toThrow(/must be an object/);
      expect(() => validateConfig(123)).toThrow(/must be an object/);
      expect(() => validateConfig(null)).toThrow(/must be an object/);
    });

    it("should not pollute Object.prototype", () => {
      const maliciousConfig = {
        __proto__: { polluted: true },
        thresholds: { largeFile: 1000 },
      };

      validateConfig(maliciousConfig);

      // Check that Object.prototype was not polluted
      expect((Object.prototype as any).polluted).toBeUndefined();
      expect({}.hasOwnProperty("polluted")).toBe(false);
    });
  });
});

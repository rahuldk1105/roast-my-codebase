/**
 * Configuration validation to prevent prototype pollution and type confusion
 */

import { RoastConfig } from "./index.js";

/**
 * Validates and sanitizes user configuration to prevent prototype pollution
 * Returns a clean, validated config object
 */
export function validateConfig(userConfig: unknown): Partial<RoastConfig> {
  if (typeof userConfig !== "object" || userConfig === null) {
    throw new Error("Invalid config: must be an object");
  }

  const validated: Partial<RoastConfig> = {};
  const config = userConfig as Record<string, unknown>;

  // Validate thresholds
  if ("thresholds" in config && typeof config.thresholds === "object" && config.thresholds !== null) {
    const thresholds = config.thresholds as Record<string, unknown>;
    validated.thresholds = {};

    if ("largeFile" in thresholds && typeof thresholds.largeFile === "number" && thresholds.largeFile > 0) {
      validated.thresholds.largeFile = thresholds.largeFile;
    }

    if ("extremeFile" in thresholds && typeof thresholds.extremeFile === "number" && thresholds.extremeFile > 0) {
      validated.thresholds.extremeFile = thresholds.extremeFile;
    }

    if ("highChurn" in thresholds && typeof thresholds.highChurn === "number" && thresholds.highChurn > 0) {
      validated.thresholds.highChurn = thresholds.highChurn;
    }

    if ("criticalChurn" in thresholds && typeof thresholds.criticalChurn === "number" && thresholds.criticalChurn > 0) {
      validated.thresholds.criticalChurn = thresholds.criticalChurn;
    }

    if ("largePR" in thresholds && typeof thresholds.largePR === "number" && thresholds.largePR > 0) {
      validated.thresholds.largePR = thresholds.largePR;
    }

    if ("criticalPR" in thresholds && typeof thresholds.criticalPR === "number" && thresholds.criticalPR > 0) {
      validated.thresholds.criticalPR = thresholds.criticalPR;
    }
  }

  // Validate scanners
  if ("scanners" in config && typeof config.scanners === "object" && config.scanners !== null) {
    const scanners = config.scanners as Record<string, unknown>;
    validated.scanners = {};

    if ("disabled" in scanners && Array.isArray(scanners.disabled)) {
      validated.scanners.disabled = scanners.disabled.filter(
        (item) => typeof item === "string"
      );
    }
  }

  // Validate ignore patterns
  if ("ignore" in config && Array.isArray(config.ignore)) {
    validated.ignore = config.ignore.filter((item) => typeof item === "string");
  }

  // Validate deductions
  if ("deductions" in config && typeof config.deductions === "object" && config.deductions !== null) {
    const deductions = config.deductions as Record<string, unknown>;
    validated.deductions = {};

    for (const [key, value] of Object.entries(deductions)) {
      // Only allow string keys and number values
      if (typeof key === "string" && typeof value === "number") {
        // Prevent prototype pollution by checking for dangerous keys
        if (
          key !== "__proto__" &&
          key !== "constructor" &&
          key !== "prototype"
        ) {
          validated.deductions[key] = value;
        }
      }
    }
  }

  // Validate plugins
  if ("plugins" in config && Array.isArray(config.plugins)) {
    validated.plugins = config.plugins.filter((item) => typeof item === "string");
  }

  return validated;
}

/**
 * Safely parses JSON without prototype pollution
 * Returns parsed object or null on error
 */
export function safeJsonParse(content: string): unknown {
  try {
    const parsed = JSON.parse(content);

    // Check for prototype pollution attempts
    if (
      parsed &&
      typeof parsed === "object" &&
      ("__proto__" in parsed || "constructor" in parsed || "prototype" in parsed)
    ) {
      console.warn("Warning: Detected prototype pollution attempt in JSON");

      // Create clean object without dangerous keys
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (key !== "__proto__" && key !== "constructor" && key !== "prototype") {
          cleaned[key] = value;
        }
      }
      return cleaned;
    }

    return parsed;
  } catch (_error) {
    return null;
  }
}

/**
 * Configuration validation to prevent prototype pollution and type confusion
 */

import { RoastConfig } from "./index.js";
import { CustomRule } from "../types/index.js";

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

  // Validate AI config
  if ("ai" in config && typeof config.ai === "object" && config.ai !== null) {
    const ai = config.ai as Record<string, unknown>;
    validated.ai = {};

    if ("enabled" in ai && typeof ai.enabled === "boolean") {
      validated.ai.enabled = ai.enabled;
    }

    if ("apiKey" in ai && typeof ai.apiKey === "string") {
      validated.ai.apiKey = ai.apiKey;
    }

    if ("model" in ai && typeof ai.model === "string") {
      validated.ai.model = ai.model;
    }

    if ("maxTokens" in ai && typeof ai.maxTokens === "number" && ai.maxTokens > 0) {
      validated.ai.maxTokens = ai.maxTokens;
    }

    if ("temperature" in ai && typeof ai.temperature === "number" && ai.temperature >= 0 && ai.temperature <= 2) {
      validated.ai.temperature = ai.temperature;
    }

    if ("cacheEnabled" in ai && typeof ai.cacheEnabled === "boolean") {
      validated.ai.cacheEnabled = ai.cacheEnabled;
    }

    if ("cachePath" in ai && typeof ai.cachePath === "string") {
      validated.ai.cachePath = ai.cachePath;
    }
  }

  // Validate custom rules
  if ("rules" in config && Array.isArray(config.rules)) {
    validated.rules = [];
    for (const rule of config.rules) {
      if (typeof rule !== "object" || rule === null) continue;
      const r = rule as Record<string, unknown>;

      // Required fields
      if (typeof r.id !== "string" || !r.id.match(/^[a-zA-Z0-9_-]+$/)) continue;
      if (typeof r.name !== "string" || r.name.length > 200) continue;
      if (typeof r.pattern !== "string" || r.pattern.length > 500) continue;
      if (!["critical", "warning", "info"].includes(r.severity as string)) continue;
      if (typeof r.message !== "string" || r.message.length > 500) continue;

      // Optional fields
      const validated_rule: CustomRule = {
        id: r.id,
        name: r.name,
        pattern: r.pattern,
        severity: r.severity as "critical" | "warning" | "info",
        message: r.message,
      };

      if (typeof r.filePattern === "string") validated_rule.filePattern = r.filePattern;
      if (Array.isArray(r.exclude)) validated_rule.exclude = r.exclude.filter((e: unknown) => typeof e === "string") as string[];
      if (typeof r.maxPerFile === "number" && r.maxPerFile > 0 && r.maxPerFile <= 100) {
        validated_rule.maxPerFile = r.maxPerFile;
      }
      if (typeof r.category === "string" && r.category.match(/^[a-zA-Z0-9_-]+$/)) {
        validated_rule.category = r.category;
      }

      validated.rules!.push(validated_rule);
    }
  }

  // Validate notify config
  if ('notify' in config && typeof config.notify === 'object' && config.notify !== null) {
    const n = config.notify as Record<string, unknown>;
    validated.notify = {};

    if (typeof n.url === 'string' && n.url.length < 500) {
      try {
        new URL(n.url);
        validated.notify.url = n.url;
      } catch { /* skip invalid URLs */ }
    }

    if (['slack', 'teams', 'discord', 'generic'].includes(n.platform as string)) {
      validated.notify.platform = n.platform as 'slack' | 'teams' | 'discord' | 'generic';
    }

    if (typeof n.onlyOnRegression === 'boolean') {
      validated.notify.onlyOnRegression = n.onlyOnRegression;
    }

    if (typeof n.threshold === 'number' && n.threshold >= 0 && n.threshold <= 100) {
      validated.notify.threshold = n.threshold;
    }
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

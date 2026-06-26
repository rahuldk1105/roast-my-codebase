import fs from "fs";
import path from "path";
import { validateConfig, safeJsonParse } from "./validation.js";

export interface RoastConfig {
  // Thresholds
  thresholds?: {
    largeFile?: number;
    extremeFile?: number;
    highChurn?: number;
    criticalChurn?: number;
    largePR?: number;
    criticalPR?: number;
  };

  // Scanner control
  scanners?: {
    disabled?: string[];
  };

  // Ignore patterns (added to default ignore patterns)
  ignore?: string[];

  // Health deductions (overrides defaults)
  deductions?: {
    [key: string]: number;
  };

  // Plugin packages (npm package names)
  plugins?: string[];
}

const DEFAULT_CONFIG: RoastConfig = {
  thresholds: {
    largeFile: 500,
    extremeFile: 2000,
    highChurn: 50,
    criticalChurn: 100,
    largePR: 20,
    criticalPR: 40,
  },
  scanners: {
    disabled: [],
  },
  ignore: [],
  deductions: {},
  plugins: [],
};

export function loadConfig(rootDir: string): RoastConfig {
  const configPath = path.join(rootDir, ".roastrc.json");

  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");

    // Safe JSON parsing to prevent prototype pollution
    const parsed = safeJsonParse(content);

    if (!parsed) {
      console.warn("Warning: Failed to parse .roastrc.json");
      return DEFAULT_CONFIG;
    }

    // Validate and sanitize configuration
    const userConfig = validateConfig(parsed);

    // Merge with defaults
    return {
      thresholds: {
        ...DEFAULT_CONFIG.thresholds,
        ...userConfig.thresholds,
      },
      scanners: {
        disabled: [
          ...(DEFAULT_CONFIG.scanners?.disabled || []),
          ...(userConfig.scanners?.disabled || []),
        ],
      },
      ignore: [
        ...(DEFAULT_CONFIG.ignore || []),
        ...(userConfig.ignore || []),
      ],
      deductions: {
        ...DEFAULT_CONFIG.deductions,
        ...userConfig.deductions,
      },
      plugins: [
        ...(DEFAULT_CONFIG.plugins || []),
        ...(userConfig.plugins || []),
      ],
    };
  } catch (error) {
    console.warn(`Warning: Failed to load .roastrc.json: ${error}`);
    return DEFAULT_CONFIG;
  }
}

export function isScannerDisabled(
  config: RoastConfig,
  scannerName: string
): boolean {
  return config.scanners?.disabled?.includes(scannerName) || false;
}

export function getThreshold(
  config: RoastConfig,
  key: keyof NonNullable<RoastConfig["thresholds"]>
): number {
  return config.thresholds?.[key] || DEFAULT_CONFIG.thresholds![key]!;
}

export function getDeduction(
  config: RoastConfig,
  key: string,
  defaultValue: number
): number {
  return config.deductions?.[key] ?? defaultValue;
}

export function getIgnorePatterns(config: RoastConfig): string[] {
  return config.ignore || [];
}

export function getPlugins(config: RoastConfig): string[] {
  return config.plugins || [];
}

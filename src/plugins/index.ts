import path from "path";
import { Scanner } from "../types/index.js";
import { RoastConfig } from "../config/index.js";
import { isValidPluginName, validatePluginPath, sanitizeError } from "../utils/security.js";

export interface PluginManifest {
  name: string;
  version: string;
  scanner: Scanner;
}

export async function loadPlugins(
  config: RoastConfig,
  rootDir: string
): Promise<Scanner[]> {
  const plugins = config.plugins || [];
  const scanners: Scanner[] = [];

  for (const pluginName of plugins) {
    try {
      // Validate plugin name to prevent path traversal and arbitrary code execution
      if (!isValidPluginName(pluginName)) {
        console.warn(
          `Warning: Invalid plugin name "${pluginName}" - must match pattern @scope/roast-plugin-* or roast-plugin-*`
        );
        continue;
      }

      // Try to load from node_modules
      const pluginModule = await loadPluginModule(pluginName, rootDir);

      if (!pluginModule) {
        console.warn(`Warning: Plugin "${pluginName}" not found`);
        continue;
      }

      // Validate plugin structure
      if (!isValidPlugin(pluginModule)) {
        console.warn(
          `Warning: Plugin "${pluginName}" does not export a valid scanner`
        );
        continue;
      }

      scanners.push(pluginModule.scanner);
    } catch (error) {
      console.warn(`Warning: Failed to load plugin "${pluginName}": ${sanitizeError(error)}`);
    }
  }

  return scanners;
}

async function loadPluginModule(
  pluginName: string,
  rootDir: string
): Promise<PluginManifest | null> {
  try {
    // Validate and resolve plugin path to prevent traversal
    const pluginPath = validatePluginPath(rootDir, pluginName);
    const module = await import(pluginPath);
    return module.default || module;
  } catch {
    try {
      // Try absolute import as fallback (for globally installed plugins)
      const module = await import(pluginName);
      return module.default || module;
    } catch {
      return null;
    }
  }
}

function isValidPlugin(plugin: any): plugin is PluginManifest {
  return (
    plugin &&
    typeof plugin.name === "string" &&
    typeof plugin.version === "string" &&
    plugin.scanner &&
    typeof plugin.scanner.name === "string" &&
    typeof plugin.scanner.scan === "function"
  );
}

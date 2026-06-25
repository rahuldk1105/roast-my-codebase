import { Scanner } from "../types/index.js";
import { RoastConfig } from "../config/index.js";

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
      console.warn(`Warning: Failed to load plugin "${pluginName}": ${error}`);
    }
  }

  return scanners;
}

async function loadPluginModule(
  pluginName: string,
  rootDir: string
): Promise<PluginManifest | null> {
  try {
    // Try relative to root dir
    const pluginPath = `${rootDir}/node_modules/${pluginName}`;
    const module = await import(pluginPath);
    return module.default || module;
  } catch {
    try {
      // Try absolute import
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

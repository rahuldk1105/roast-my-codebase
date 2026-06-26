/**
 * Auto-fix implementations for various finding types
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { Finding } from "../types/index.js";

export interface FixResult {
  success: boolean;
  message: string;
}

export interface FixSuggestion {
  findingId: string;
  suggestion: string;
  autoFixable: boolean;
  command?: string;
}

/**
 * Apply automatic fix for a finding
 */
export async function applyAutoFix(
  finding: Finding,
  fix: FixSuggestion,
  rootDir: string,
  dryRun: boolean = false
): Promise<FixResult> {
  // Route to appropriate fix handler based on category
  switch (finding.category) {
    case "unused-dependencies":
      return fixUnusedDependency(finding, rootDir, dryRun);

    case "todos":
      return fixTodoComment(finding, rootDir, dryRun);

    case "dead-exports":
      return fixDeadExport(finding, rootDir, dryRun);

    default:
      return {
        success: false,
        message: `No auto-fix available for category: ${finding.category}`,
      };
  }
}

/**
 * Fix unused dependency by removing it
 */
function fixUnusedDependency(
  finding: Finding,
  rootDir: string,
  dryRun: boolean
): FixResult {
  // Extract package name from message
  const match = finding.message.match(/`([^`]+)`/);
  if (!match) {
    return {
      success: false,
      message: "Could not extract package name from finding",
    };
  }

  const packageName = match[1];
  const pkgPath = path.join(rootDir, "package.json");

  try {
    if (dryRun) {
      return {
        success: true,
        message: `Would run: npm uninstall ${packageName}`,
      };
    }

    // Run npm uninstall
    const result = spawnSync("npm", ["uninstall", packageName], {
      cwd: rootDir,
      stdio: "pipe",
      encoding: "utf-8",
    });

    if (result.status === 0) {
      return {
        success: true,
        message: `Removed unused dependency: ${packageName}`,
      };
    } else {
      return {
        success: false,
        message: `Failed to remove ${packageName}: ${result.stderr}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error removing dependency: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Fix TODO comment by adding issue tracker reference
 */
function fixTodoComment(
  finding: Finding,
  rootDir: string,
  dryRun: boolean
): FixResult {
  if (!finding.file) {
    return {
      success: false,
      message: "No file specified for TODO fix",
    };
  }

  const filePath = path.join(rootDir, finding.file);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    // Find TODO lines
    const todoPattern = /\/\/\s*(TODO|FIXME|HACK|XXX):\s*(.+)/i;
    let modified = false;
    const newLines = lines.map((line) => {
      const match = line.match(todoPattern);
      if (match && !line.includes("Issue:") && !line.includes("#")) {
        modified = true;
        const indent = line.match(/^\s*/)?.[0] || "";
        return `${indent}// ${match[1]}: ${match[2]} (Issue: #TODO - create issue)`;
      }
      return line;
    });

    if (!modified) {
      return {
        success: false,
        message: "No TODOs found to fix",
      };
    }

    if (dryRun) {
      const changedLines = newLines.filter(
        (line, i) => line !== lines[i]
      ).length;
      return {
        success: true,
        message: `Would add issue references to ${changedLines} TODO comment(s)`,
      };
    }

    fs.writeFileSync(filePath, newLines.join("\n"), "utf-8");

    return {
      success: true,
      message: `Added issue references to TODO comments in ${finding.file}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error fixing TODOs: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Fix dead export by removing it
 */
function fixDeadExport(
  finding: Finding,
  rootDir: string,
  dryRun: boolean
): FixResult {
  if (!finding.file) {
    return {
      success: false,
      message: "No file specified for dead export fix",
    };
  }

  // Extract export name from message
  const match = finding.message.match(/`([^`]+)`/);
  if (!match) {
    return {
      success: false,
      message: "Could not extract export name from finding",
    };
  }

  const exportName = match[1];
  const filePath = path.join(rootDir, finding.file);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    // Find and remove export lines
    const exportPattern = new RegExp(
      `export\\s+(const|let|var|function|class|type|interface)\\s+${exportName}\\b`,
      "i"
    );

    let modified = false;
    const newLines = lines.filter((line) => {
      if (exportPattern.test(line)) {
        modified = true;
        return false; // Remove this line
      }
      return true;
    });

    if (!modified) {
      return {
        success: false,
        message: `Export ${exportName} not found in ${finding.file}`,
      };
    }

    if (dryRun) {
      return {
        success: true,
        message: `Would remove dead export: ${exportName} from ${finding.file}`,
      };
    }

    fs.writeFileSync(filePath, newLines.join("\n"), "utf-8");

    return {
      success: true,
      message: `Removed dead export: ${exportName} from ${finding.file}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error fixing dead export: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

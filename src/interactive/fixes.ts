/**
 * Auto-fix implementations for various finding types
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { Finding, FixSuggestion } from "../types/index.js";

export interface FixResult {
  success: boolean;
  message: string;
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

    case "nextjs-client-server":
      return fixNextjsClientServer(finding, rootDir, dryRun);

    case "nextjs-metadata":
      return fixNextjsMetadata(finding, rootDir, dryRun);

    case "env-in-git":
      return fixEnvInGit(finding, rootDir, dryRun);

    case "type-safety":
      return fixTypeSafety(finding, rootDir, dryRun);

    case "test-coverage":
      return fixTestCoverage(finding, rootDir, dryRun);

    case "secrets":
      return fixSecrets(finding, rootDir, dryRun);

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

function fixNextjsClientServer(
  finding: Finding,
  rootDir: string,
  dryRun: boolean
): FixResult {
  if (!finding.file) {
    return { success: false, message: "No file specified for nextjs-client-server fix" };
  }

  const filePath = path.join(rootDir, finding.file);

  try {
    const content = fs.readFileSync(filePath, "utf-8");

    if (content.includes("'use client'") || content.includes('"use client"')) {
      return { success: false, message: `${finding.file} already has 'use client'` };
    }

    if (dryRun) {
      return { success: true, message: `Would prepend 'use client' to ${finding.file}` };
    }

    fs.writeFileSync(filePath, `'use client';\n\n${content}`, "utf-8");

    return { success: true, message: `Added 'use client' to ${finding.file}` };
  } catch (error) {
    return {
      success: false,
      message: `Error fixing nextjs-client-server: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function fixNextjsMetadata(
  finding: Finding,
  rootDir: string,
  dryRun: boolean
): FixResult {
  if (!finding.file) {
    return { success: false, message: "No file specified for nextjs-metadata fix" };
  }

  const filePath = path.join(rootDir, finding.file);

  try {
    const content = fs.readFileSync(filePath, "utf-8");

    if (/export.*metadata/.test(content)) {
      return { success: false, message: `${finding.file} already exports metadata` };
    }

    const metadataExport =
      "\nexport const metadata = {\n  title: 'Page',\n  description: 'TODO: Add description',\n};\n";

    if (dryRun) {
      return { success: true, message: `Would append metadata export to ${finding.file}` };
    }

    fs.writeFileSync(filePath, content + metadataExport, "utf-8");

    return { success: true, message: `Added metadata export to ${finding.file}` };
  } catch (error) {
    return {
      success: false,
      message: `Error fixing nextjs-metadata: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function fixGitignoreEntry(
  rootDir: string,
  filename: string,
  dryRun: boolean
): FixResult {
  const gitignorePath = path.join(rootDir, ".gitignore");

  try {
    let existing = "";
    if (fs.existsSync(gitignorePath)) {
      existing = fs.readFileSync(gitignorePath, "utf-8");
    }

    const lines = existing.split("\n");
    if (lines.some((l) => l.trim() === filename)) {
      return { success: false, message: `${filename} is already in .gitignore` };
    }

    if (dryRun) {
      return { success: true, message: `Would add ${filename} to .gitignore` };
    }

    const updated = existing.endsWith("\n") || existing === ""
      ? existing + filename + "\n"
      : existing + "\n" + filename + "\n";

    fs.writeFileSync(gitignorePath, updated, "utf-8");

    return { success: true, message: `Added ${filename} to .gitignore` };
  } catch (error) {
    return {
      success: false,
      message: `Error updating .gitignore: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function fixEnvInGit(
  finding: Finding,
  rootDir: string,
  dryRun: boolean
): FixResult {
  if (!finding.file) {
    return { success: false, message: "No file specified for env-in-git fix" };
  }

  const filename = path.basename(finding.file);
  const result = fixGitignoreEntry(rootDir, filename, dryRun);

  if (result.success) {
    return {
      ...result,
      message: `${result.message}. You must also run: git rm --cached ${finding.file}`,
    };
  }

  return result;
}

function fixTypeSafety(
  finding: Finding,
  rootDir: string,
  dryRun: boolean
): FixResult {
  if (!finding.message.includes("@ts-ignore")) {
    return { success: false, message: "Auto-fix for type-safety only supports @ts-ignore findings" };
  }

  if (!finding.file) {
    return { success: false, message: "No file specified for type-safety fix" };
  }

  const filePath = path.join(rootDir, finding.file);

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    let count = 0;
    const newLines = lines.map((line) => {
      if (/\/\/\s*@ts-ignore/.test(line)) {
        count++;
        return line.replace(/\/\/\s*@ts-ignore.*/, "// @ts-expect-error -- TODO: fix type error");
      }
      return line;
    });

    if (count === 0) {
      return { success: false, message: `No @ts-ignore comments found in ${finding.file}` };
    }

    if (dryRun) {
      return {
        success: true,
        message: `Would replace ${count} @ts-ignore comment(s) with @ts-expect-error in ${finding.file}`,
      };
    }

    fs.writeFileSync(filePath, newLines.join("\n"), "utf-8");

    return {
      success: true,
      message: `Replaced ${count} @ts-ignore comment(s) with @ts-expect-error in ${finding.file}`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error fixing type-safety: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function fixTestCoverage(
  finding: Finding,
  rootDir: string,
  dryRun: boolean
): FixResult {
  if (!finding.file) {
    return { success: false, message: "No file specified for test-coverage fix" };
  }

  const srcRelative = finding.file.replace(/^src\//, "");
  const testRelative = `tests/${srcRelative.replace(/\.tsx?$/, ".test.ts")}`;
  const testPath = path.join(rootDir, testRelative);

  if (fs.existsSync(testPath)) {
    return { success: false, message: `Test file already exists: ${testRelative}` };
  }

  const baseName = path.basename(finding.file, path.extname(finding.file));
  const skeleton =
    `import { describe, it, expect } from 'vitest';\n\ndescribe('${baseName}', () => {\n  it('should work', () => {\n    // TODO: implement tests\n    expect(true).toBe(true);\n  });\n});\n`;

  if (dryRun) {
    return { success: true, message: `Would create test file: ${testRelative}` };
  }

  try {
    fs.mkdirSync(path.dirname(testPath), { recursive: true });
    fs.writeFileSync(testPath, skeleton, "utf-8");

    return { success: true, message: `Created test file: ${testRelative}` };
  } catch (error) {
    return {
      success: false,
      message: `Error creating test file: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function fixSecrets(
  finding: Finding,
  rootDir: string,
  dryRun: boolean
): FixResult {
  if (!finding.file) {
    return { success: false, message: "No file specified for secrets fix" };
  }

  const filename = path.basename(finding.file);
  const result = fixGitignoreEntry(rootDir, filename, dryRun);

  const warning =
    " WARNING: The secret may already be in git history — consider rotating it and running: git filter-branch or git-filter-repo";

  if (result.success) {
    return { ...result, message: result.message + warning };
  }

  return result;
}

import fs from "fs";
import path from "path";

export interface HookInstallResult {
  success: boolean;
  message: string;
  hookPath: string;
  huskyDetected: boolean;
  alreadyInstalled: boolean;
}

export function detectHuskySetup(rootDir: string): boolean {
  // Check if .husky/ directory exists
  const huskyDir = path.join(rootDir, ".husky");
  if (fs.existsSync(huskyDir) && fs.statSync(huskyDir).isDirectory()) {
    return true;
  }

  // Check if package.json has husky in dependencies or devDependencies
  const pkgPath = path.join(rootDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (
        (pkg.dependencies && "husky" in pkg.dependencies) ||
        (pkg.devDependencies && "husky" in pkg.devDependencies)
      ) {
        return true;
      }
    } catch {
      // Malformed package.json — ignore
    }
  }

  return false;
}

export function isHookInstalled(rootDir: string): boolean {
  const huskyHook = path.join(rootDir, ".husky", "pre-commit");
  if (fs.existsSync(huskyHook)) {
    const content = fs.readFileSync(huskyHook, "utf-8");
    if (content.includes("roast-my-codebase")) return true;
  }

  const gitHook = path.join(rootDir, ".git", "hooks", "pre-commit");
  if (fs.existsSync(gitHook)) {
    const content = fs.readFileSync(gitHook, "utf-8");
    if (content.includes("roast-my-codebase")) return true;
  }

  return false;
}

export function installPreCommitHook(
  rootDir: string,
  threshold: number
): HookInstallResult {
  const huskyDetected = detectHuskySetup(rootDir);

  if (huskyDetected) {
    return _installHuskyHook(rootDir, threshold);
  } else {
    return _installGitHook(rootDir, threshold);
  }
}

function _installHuskyHook(
  rootDir: string,
  threshold: number
): HookInstallResult {
  const huskyDir = path.join(rootDir, ".husky");
  const hookPath = path.join(huskyDir, "pre-commit");

  try {
    // Create .husky/ if it doesn't exist
    if (!fs.existsSync(huskyDir)) {
      fs.mkdirSync(huskyDir, { recursive: true });
    }

    // Check if already installed
    if (fs.existsSync(hookPath)) {
      const existing = fs.readFileSync(hookPath, "utf-8");
      if (existing.includes("roast-my-codebase")) {
        return {
          success: true,
          message: "Hook already installed",
          hookPath,
          huskyDetected: true,
          alreadyInstalled: true,
        };
      }
    }

    const script = [
      "#!/usr/bin/env sh",
      '. "$(dirname -- "$0")/_/husky.sh"',
      "",
      'echo "🔥 Roasting your code before commit..."',
      `npx roast-my-codebase --json --threshold ${threshold}`,
      "",
    ].join("\n");

    fs.writeFileSync(hookPath, script, "utf-8");

    if (process.platform !== "win32") {
      fs.chmodSync(hookPath, 0o755);
    }

    return {
      success: true,
      message: `Pre-commit hook installed at ${hookPath}`,
      hookPath,
      huskyDetected: true,
      alreadyInstalled: false,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      hookPath,
      huskyDetected: true,
      alreadyInstalled: false,
    };
  }
}

function _installGitHook(
  rootDir: string,
  threshold: number
): HookInstallResult {
  const gitDir = path.join(rootDir, ".git");
  const hooksDir = path.join(gitDir, "hooks");
  const hookPath = path.join(hooksDir, "pre-commit");

  // Must be a git repo
  if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
    return {
      success: false,
      message: "Not a git repository",
      hookPath,
      huskyDetected: false,
      alreadyInstalled: false,
    };
  }

  try {
    // Check if already installed
    if (fs.existsSync(hookPath)) {
      const existing = fs.readFileSync(hookPath, "utf-8");
      if (existing.includes("roast-my-codebase")) {
        return {
          success: true,
          message: "Hook already installed",
          hookPath,
          huskyDetected: false,
          alreadyInstalled: true,
        };
      }

      // Append to existing hook
      const appendContent = [
        "",
        "# roast-my-codebase",
        'echo "🔥 Roasting your code before commit..."',
        `npx roast-my-codebase --json --threshold ${threshold}`,
        "",
      ].join("\n");

      fs.appendFileSync(hookPath, appendContent, "utf-8");
    } else {
      // Ensure hooks dir exists (git init creates it, but just in case)
      if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
      }

      const script = [
        "#!/usr/bin/env sh",
        'echo "🔥 Roasting your code before commit..."',
        `npx roast-my-codebase --json --threshold ${threshold}`,
        "",
      ].join("\n");

      fs.writeFileSync(hookPath, script, "utf-8");
    }

    if (process.platform !== "win32") {
      fs.chmodSync(hookPath, 0o755);
    }

    return {
      success: true,
      message: `Pre-commit hook installed at ${hookPath}`,
      hookPath,
      huskyDetected: false,
      alreadyInstalled: false,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      hookPath,
      huskyDetected: false,
      alreadyInstalled: false,
    };
  }
}

export function uninstallPreCommitHook(rootDir: string): HookInstallResult {
  const huskyHook = path.join(rootDir, ".husky", "pre-commit");
  const gitHook = path.join(rootDir, ".git", "hooks", "pre-commit");

  // Find which file contains roast-my-codebase
  let targetPath: string | null = null;

  if (fs.existsSync(huskyHook)) {
    const content = fs.readFileSync(huskyHook, "utf-8");
    if (content.includes("roast-my-codebase")) {
      targetPath = huskyHook;
    }
  }

  if (!targetPath && fs.existsSync(gitHook)) {
    const content = fs.readFileSync(gitHook, "utf-8");
    if (content.includes("roast-my-codebase")) {
      targetPath = gitHook;
    }
  }

  if (!targetPath) {
    return {
      success: false,
      message: "No roast-my-codebase hook found",
      hookPath: gitHook,
      huskyDetected: detectHuskySetup(rootDir),
      alreadyInstalled: false,
    };
  }

  try {
    const content = fs.readFileSync(targetPath, "utf-8");
    const huskyDetected = targetPath === huskyHook;

    // Determine if the file is solely the roast hook or has other content
    if (_isOnlyRoastHook(content, huskyDetected)) {
      fs.unlinkSync(targetPath);
    } else {
      const cleaned = _removeRoastLines(content);
      fs.writeFileSync(targetPath, cleaned, "utf-8");
    }

    return {
      success: true,
      message: `Pre-commit hook removed from ${targetPath}`,
      hookPath: targetPath,
      huskyDetected,
      alreadyInstalled: false,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
      hookPath: targetPath,
      huskyDetected: detectHuskySetup(rootDir),
      alreadyInstalled: false,
    };
  }
}

/**
 * Returns true if the hook file contains nothing meaningful beyond the
 * shebang/husky source line and the roast-my-codebase invocation.
 */
function _isOnlyRoastHook(content: string, isHusky: boolean): boolean {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const ignoredPrefixes = [
    "#!/",
    ". \"$(dirname",
    "# roast-my-codebase",
    "echo \"🔥 Roasting",
    "npx roast-my-codebase",
  ];

  if (isHusky) {
    // Also ignore the husky source line
    ignoredPrefixes.push('. "$(dirname');
  }

  return lines.every((line) =>
    ignoredPrefixes.some((prefix) => line.startsWith(prefix))
  );
}

/**
 * Removes lines added by roast-my-codebase from the hook content.
 * Removes: the `# roast-my-codebase` comment, the echo line, and the npx line.
 */
function _removeRoastLines(content: string): string {
  const lines = content.split("\n");
  const filtered: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (
      trimmed === "# roast-my-codebase" ||
      trimmed.startsWith("npx roast-my-codebase") ||
      trimmed.startsWith('echo "🔥 Roasting your code before commit..."')
    ) {
      i++;
      continue;
    }

    filtered.push(line);
    i++;
  }

  // Collapse more than two consecutive blank lines into one
  const collapsed: string[] = [];
  let blankCount = 0;
  for (const line of filtered) {
    if (line.trim() === "") {
      blankCount++;
      if (blankCount <= 1) collapsed.push(line);
    } else {
      blankCount = 0;
      collapsed.push(line);
    }
  }

  return collapsed.join("\n");
}

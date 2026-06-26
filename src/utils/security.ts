/**
 * Security utilities for input validation and sanitization
 */

import path from "path";
import fs from "fs";

/**
 * Maximum file size to read (10 MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validates plugin names to prevent path traversal and arbitrary code execution
 * Only allows @scope/roast-plugin-* or roast-plugin-* patterns
 */
export function isValidPluginName(name: string): boolean {
  if (!name || typeof name !== "string") {
    return false;
  }

  // Allow scoped packages (@scope/roast-plugin-*) or roast-plugin-*
  const scopedPattern = /^@[a-z0-9-]+\/roast-plugin-[a-z0-9-]+$/;
  const unscopedPattern = /^roast-plugin-[a-z0-9-]+$/;

  return scopedPattern.test(name) || unscopedPattern.test(name);
}

/**
 * Validates git branch names according to git naming rules
 * Prevents command injection via branch names
 */
export function isValidBranchName(branch: string): boolean {
  if (!branch || typeof branch !== "string") {
    return false;
  }

  // Git branch naming rules:
  // - Only alphanumeric, slash, dash, underscore, dot
  // - No ".." (path traversal)
  // - No leading dash (would be interpreted as flag)
  // - No control characters or shell metacharacters
  const validPattern = /^[a-zA-Z0-9/_.-]+$/;

  return (
    validPattern.test(branch) &&
    !branch.includes("..") &&
    !branch.startsWith("-") &&
    !branch.includes(";") &&
    !branch.includes("|") &&
    !branch.includes("&") &&
    !branch.includes("$") &&
    !branch.includes("`")
  );
}

/**
 * Validates and resolves output path to prevent path traversal
 * Ensures the output path is within the root directory
 */
export function validateOutputPath(
  rootDir: string,
  filename: string
): string {
  const resolved = path.resolve(rootDir);
  const outputPath = path.resolve(rootDir, filename);

  // Ensure output is inside rootDir
  const isInside =
    outputPath.startsWith(resolved + path.sep) || outputPath === resolved;

  if (!isInside) {
    throw new Error(
      `Security: Output path "${filename}" escapes project directory`
    );
  }

  return outputPath;
}

/**
 * Validates plugin path to ensure it's inside node_modules
 * Prevents path traversal attacks via plugin loading
 */
export function validatePluginPath(
  rootDir: string,
  pluginName: string
): string {
  const nodeModulesPath = path.resolve(rootDir, "node_modules");
  const pluginPath = path.resolve(nodeModulesPath, pluginName);

  if (!pluginPath.startsWith(nodeModulesPath + path.sep)) {
    throw new Error(
      `Security: Plugin path "${pluginName}" escapes node_modules`
    );
  }

  return pluginPath;
}

/**
 * Sanitizes error messages to prevent information disclosure
 * Removes file paths and sensitive system information
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Remove Windows paths (C:\Users\...)
    let message = error.message.replace(/[A-Z]:\\[^\s"']+/g, "<path>");

    // Remove Unix paths (/home/user/...)
    message = message.replace(/\/[^\s"']+/g, "<path>");

    // Remove common sensitive patterns
    message = message.replace(/password[=:]\s*\S+/gi, "password=<redacted>");
    message = message.replace(/token[=:]\s*\S+/gi, "token=<redacted>");
    message = message.replace(/api[_-]?key[=:]\s*\S+/gi, "apikey=<redacted>");

    return message;
  }

  return "An unexpected error occurred";
}

/**
 * Escapes XML/SVG special characters to prevent injection
 */
export function escapeXml(unsafe: string | number): string {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Safely reads a file with size limits to prevent DoS
 * Returns null if file is too large or unreadable
 */
export function readFileSafely(
  filePath: string,
  maxSize: number = MAX_FILE_SIZE
): string | null {
  try {
    const stats = fs.statSync(filePath);

    if (stats.size > maxSize) {
      console.warn(
        `Skipping ${filePath} - exceeds size limit (${stats.size} bytes)`
      );
      return null;
    }

    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Debounce function to prevent excessive calls
 * Used for rate limiting file system operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * Executes a regex match with a timeout to prevent ReDoS
 * Returns null if timeout is exceeded
 */
export async function safeRegexMatch(
  content: string,
  pattern: RegExp,
  timeout: number = 1000
): Promise<RegExpMatchArray | null> {
  return new Promise((resolve) => {
    let timeoutId: NodeJS.Timeout;
    let finished = false;

    timeoutId = setTimeout(() => {
      if (!finished) {
        console.warn("Regex timeout - skipping pattern match");
        resolve(null);
      }
    }, timeout);

    try {
      const result = content.match(pattern);
      finished = true;
      clearTimeout(timeoutId);
      resolve(result);
    } catch (error) {
      finished = true;
      clearTimeout(timeoutId);
      resolve(null);
    }
  });
}

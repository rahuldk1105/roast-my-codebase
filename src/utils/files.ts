import fs from "fs";
import path from "path";

export function readFileLines(filePath: string): string[] {
  try {
    return fs.readFileSync(filePath, "utf-8").split("\n");
  } catch {
    return [];
  }
}

export function countLines(filePath: string): number {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

export function readJson(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function relativePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

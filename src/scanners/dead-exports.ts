import fg from "fast-glob";
import path from "path";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { SOURCE_EXTENSIONS, IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

interface ExportInfo {
  name: string;
  kind: "function" | "class" | "const" | "type" | "interface" | "default";
  file: string;
}

export class DeadExportScanner implements Scanner {
  name = "dead-exports";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const extGlob = SOURCE_EXTENSIONS.map((e) => `**/*${e}`);
    const files = await fg(extGlob, {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    if (files.length === 0) {
      return {
        findings,
        stats: { totalExports: 0, deadExports: 0, percentDead: 0 },
      };
    }

    // Determine entry points from package.json
    const entryPoints = this.getEntryPoints(rootDir);

    // First pass: collect all named exports from each file
    const allExports: ExportInfo[] = [];
    const fileContents = new Map<string, string>();

    for (const file of files) {
      const rel = relativePath(rootDir, file);

      // Skip index/barrel files
      if (this.isBarrelFile(rel)) continue;

      try {
        const content = fs.readFileSync(file, "utf-8");
        fileContents.set(rel, content);
        const exports = this.extractExports(content, rel);
        allExports.push(...exports);
      } catch {
        // skip unreadable files
      }
    }

    if (allExports.length === 0) {
      return {
        findings,
        stats: { totalExports: 0, deadExports: 0, percentDead: 0 },
      };
    }

    // Second pass: find all imports and track what symbols are used
    const usedExports = new Set<string>(); // "file::name" keys

    for (const file of files) {
      const rel = relativePath(rootDir, file);
      let content = fileContents.get(rel);
      if (!content) {
        try {
          content = fs.readFileSync(file, "utf-8");
        } catch {
          continue;
        }
      }

      this.trackImports(content, file, rootDir, allExports, usedExports);
    }

    // Compare: find dead exports
    const deadExports: ExportInfo[] = [];
    for (const exp of allExports) {
      const key = `${exp.file}::${exp.name}`;
      if (usedExports.has(key)) continue;

      // Exclude default exports from entry files
      if (exp.name === "default" && entryPoints.has(exp.file)) continue;

      deadExports.push(exp);
    }

    // Generate findings (capped at 15)
    for (const dead of deadExports.slice(0, 15)) {
      const severity =
        dead.kind === "type" || dead.kind === "interface" ? "info" : "warning";
      const exportLabel = dead.name === "default" ? "default export" : `"${dead.name}"`;

      findings.push({
        id: `dead-export-${dead.file}-${dead.name}`,
        severity,
        category: "dead-exports",
        message: `Exported ${dead.kind} ${exportLabel} in ${dead.file} is never imported`,
        file: dead.file,
        detail: `${dead.kind} ${dead.name}`,
      });
    }

    if (deadExports.length > 15) {
      findings.push({
        id: "dead-exports-overflow",
        severity: "info",
        category: "dead-exports",
        message: `...and ${deadExports.length - 15} more dead exports`,
      });
    }

    const totalExports = allExports.length;
    const totalDead = deadExports.length;
    const percentDead =
      totalExports > 0 ? Math.round((totalDead / totalExports) * 100) : 0;

    return {
      findings,
      stats: { totalExports, deadExports: totalDead, percentDead },
    };
  }

  private getEntryPoints(rootDir: string): Set<string> {
    const entryPoints = new Set<string>();
    try {
      const pkgPath = path.join(rootDir, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

      const candidates: string[] = [];
      if (pkg.main) candidates.push(pkg.main);
      if (pkg.module) candidates.push(pkg.module);
      if (pkg.bin) {
        if (typeof pkg.bin === "string") {
          candidates.push(pkg.bin);
        } else {
          candidates.push(...Object.values(pkg.bin as Record<string, string>));
        }
      }

      for (const entry of candidates) {
        const normalized = entry.replace(/^\.\//, "").replace(/\\/g, "/");
        entryPoints.add(normalized);
        // Also add without extension variants
        const stripped = normalized.replace(/\.(js|mjs|cjs|ts|tsx)$/, "");
        for (const ext of SOURCE_EXTENSIONS) {
          entryPoints.add(stripped + ext);
        }
      }
    } catch {
      // no package.json
    }
    return entryPoints;
  }

  private isBarrelFile(rel: string): boolean {
    const basename = path.basename(rel);
    return /^index\.(ts|tsx|js|jsx|mjs|cjs)$/.test(basename);
  }

  private extractExports(content: string, file: string): ExportInfo[] {
    const exports: ExportInfo[] = [];

    // export function NAME
    const funcRegex = /export\s+function\s+(\w+)/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      exports.push({ name: match[1], kind: "function", file });
    }

    // export const NAME (also let, var)
    const constRegex = /export\s+(?:const|let|var)\s+(\w+)/g;
    while ((match = constRegex.exec(content)) !== null) {
      exports.push({ name: match[1], kind: "const", file });
    }

    // export class NAME
    const classRegex = /export\s+class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      exports.push({ name: match[1], kind: "class", file });
    }

    // export interface NAME
    const ifaceRegex = /export\s+interface\s+(\w+)/g;
    while ((match = ifaceRegex.exec(content)) !== null) {
      exports.push({ name: match[1], kind: "interface", file });
    }

    // export type NAME
    const typeRegex = /export\s+type\s+(\w+)/g;
    while ((match = typeRegex.exec(content)) !== null) {
      exports.push({ name: match[1], kind: "type", file });
    }

    // export { NAME, NAME2 }
    const namedRegex = /export\s*\{([^}]+)\}/g;
    while ((match = namedRegex.exec(content)) !== null) {
      const names = match[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0].trim());
      for (const name of names) {
        if (name) {
          exports.push({ name, kind: "const", file });
        }
      }
    }

    // export default
    const defaultRegex = /export\s+default\s+/g;
    while ((match = defaultRegex.exec(content)) !== null) {
      exports.push({ name: "default", kind: "default", file });
    }

    return exports;
  }

  private trackImports(
    content: string,
    filePath: string,
    rootDir: string,
    allExports: ExportInfo[],
    usedExports: Set<string>
  ): void {
    const currentFile = relativePath(rootDir, filePath);

    // import { NAME, NAME2 } from "./file"
    const namedImportRegex =
      /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = namedImportRegex.exec(content)) !== null) {
      const names = match[1].split(",").map((n) => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts[0].trim();
      });
      const resolved = this.resolveImport(match[2], filePath, rootDir);
      if (resolved && resolved !== currentFile) {
        for (const name of names) {
          if (name) usedExports.add(`${resolved}::${name}`);
        }
      }
    }

    // import NAME from "./file" (default import)
    const defaultImportRegex =
      /import\s+(\w+)\s+from\s*['"](\.[^'"]+)['"]/g;
    while ((match = defaultImportRegex.exec(content)) !== null) {
      const resolved = this.resolveImport(match[2], filePath, rootDir);
      if (resolved && resolved !== currentFile) {
        usedExports.add(`${resolved}::default`);
      }
    }

    // import * as NAME from "./file" (namespace import - marks all exports as used)
    const namespaceImportRegex =
      /import\s*\*\s*as\s+\w+\s+from\s*['"](\.[^'"]+)['"]/g;
    while ((match = namespaceImportRegex.exec(content)) !== null) {
      const resolved = this.resolveImport(match[1], filePath, rootDir);
      if (resolved && resolved !== currentFile) {
        // Mark all exports from this file as used
        for (const exp of allExports) {
          if (exp.file === resolved) {
            usedExports.add(`${resolved}::${exp.name}`);
          }
        }
      }
    }

    // export * from "./file" (re-export marks all exports as used)
    const reExportRegex = /export\s*\*\s*from\s*['"](\.[^'"]+)['"]/g;
    while ((match = reExportRegex.exec(content)) !== null) {
      const resolved = this.resolveImport(match[1], filePath, rootDir);
      if (resolved && resolved !== currentFile) {
        for (const exp of allExports) {
          if (exp.file === resolved) {
            usedExports.add(`${resolved}::${exp.name}`);
          }
        }
      }
    }

    // export { NAME } from "./file" (named re-export)
    const namedReExportRegex =
      /export\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
    while ((match = namedReExportRegex.exec(content)) !== null) {
      const names = match[1].split(",").map((n) => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts[0].trim();
      });
      const resolved = this.resolveImport(match[2], filePath, rootDir);
      if (resolved && resolved !== currentFile) {
        for (const name of names) {
          if (name) usedExports.add(`${resolved}::${name}`);
        }
      }
    }
  }

  private resolveImport(
    importPath: string,
    fromFile: string,
    rootDir: string
  ): string | null {
    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importPath);
    const rel = relativePath(rootDir, resolved);

    // Strip .js/.mjs/.cjs extension (TS projects import .js but files are .ts)
    const stripped = rel.replace(/\.(js|mjs|cjs)$/, "");

    const candidates = [rel, stripped];
    for (const base of candidates) {
      for (const ext of ["", ...SOURCE_EXTENSIONS]) {
        const candidate = base + ext;
        if (fs.existsSync(path.join(rootDir, candidate))) {
          return candidate;
        }
      }
      // Try index files
      for (const ext of SOURCE_EXTENSIONS) {
        const candidateIndex = base + "/index" + ext;
        if (fs.existsSync(path.join(rootDir, candidateIndex))) {
          return candidateIndex;
        }
      }
    }

    return null;
  }
}

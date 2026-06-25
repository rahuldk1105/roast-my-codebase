import fg from "fast-glob";
import path from "path";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { SOURCE_EXTENSIONS, IGNORE_PATTERNS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

export class CircularDependencyScanner implements Scanner {
  name = "circular";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const extGlob = SOURCE_EXTENSIONS.map((e) => `**/*${e}`);
    const files = await fg(extGlob, {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    // Build import graph
    const graph = new Map<string, Set<string>>();

    for (const file of files) {
      const rel = relativePath(rootDir, file);
      const imports = this.extractImports(file, rootDir);
      graph.set(rel, imports);
    }

    // Detect cycles using DFS
    const cycles = this.findCycles(graph);

    for (const cycle of cycles.slice(0, 5)) {
      const chain = cycle.join(" → ");
      findings.push({
        id: `circular-${cycle[0]}`,
        severity: "warning",
        category: "circular-deps",
        message: `Circular dependency: ${chain}`,
        file: cycle[0],
        detail: chain,
      });
    }

    if (cycles.length > 5) {
      findings.push({
        id: "circular-overflow",
        severity: "warning",
        category: "circular-deps",
        message: `...and ${cycles.length - 5} more circular dependency chains`,
      });
    }

    return {
      findings,
      stats: { cycleCount: cycles.length },
    };
  }

  private extractImports(filePath: string, rootDir: string): Set<string> {
    const imports = new Set<string>();
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const dir = path.dirname(filePath);

      const importRegex =
        /(?:import|export)\s+.*?from\s+['"](\.[^'"]+)['"]/g;
      const requireRegex = /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

      for (const regex of [importRegex, requireRegex]) {
        let match;
        while ((match = regex.exec(content)) !== null) {
          const resolved = this.resolveImport(match[1], dir, rootDir);
          if (resolved) {
            imports.add(resolved);
          }
        }
      }
    } catch {
      // skip
    }
    return imports;
  }

  private resolveImport(
    importPath: string,
    fromDir: string,
    rootDir: string
  ): string | null {
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

  private findCycles(graph: Map<string, Set<string>>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const stack: string[] = [];

    const dfs = (node: string) => {
      if (cycles.length >= 10) return; // cap search
      visited.add(node);
      inStack.add(node);
      stack.push(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!graph.has(neighbor)) continue;

        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (inStack.has(neighbor)) {
          const cycleStart = stack.indexOf(neighbor);
          const cycle = stack.slice(cycleStart);
          cycle.push(neighbor);
          cycles.push(cycle);
        }
      }

      stack.pop();
      inStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }
}

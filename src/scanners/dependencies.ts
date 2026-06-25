import fg from "fast-glob";
import path from "path";
import fs from "fs";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { SOURCE_EXTENSIONS, IGNORE_PATTERNS } from "../utils/constants.js";

export class DependencyScanner implements Scanner {
  name = "dependencies";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];
    const pkgPath = path.join(rootDir, "package.json");

    if (!fs.existsSync(pkgPath)) {
      return { findings };
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    const totalDeps = deps.length + devDeps.length;

    if (totalDeps > 150) {
      findings.push({
        id: "excessive-deps",
        severity: "critical",
        category: "dependencies",
        message: `${totalDeps} total dependencies — this package.json has commitment issues`,
      });
    } else if (totalDeps > 80) {
      findings.push({
        id: "many-deps",
        severity: "warning",
        category: "dependencies",
        message: `${totalDeps} total dependencies`,
      });
    }

    // Detect likely unused dependencies
    const extGlob = SOURCE_EXTENSIONS.map((e) => `**/*${e}`);
    const sourceFiles = await fg(extGlob, {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      absolute: true,
    });

    const allImports = new Set<string>();
    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        // Match: import ... from 'pkg', import 'pkg', require('pkg')
        const patterns = [
          /from\s+['"]([^./][^'"]*)['"]/g,
          /import\s+['"]([^./][^'"]*)['"]/g,
          /require\s*\(\s*['"]([^./][^'"]*)['"]\s*\)/g,
        ];
        for (const regex of patterns) {
          for (const match of content.matchAll(regex)) {
            const pkg = match[1].startsWith("@")
              ? match[1].split("/").slice(0, 2).join("/")
              : match[1].split("/")[0];
            allImports.add(pkg);
          }
        }
      } catch {
        // skip unreadable files
      }
    }

    // Check config files for deps that might be used without explicit imports
    const configFiles = await fg(
      [
        "*.config.*",
        ".babelrc",
        ".eslintrc*",
        "tsconfig.json",
        "jest.config.*",
        "vite.config.*",
        "next.config.*",
        "tailwind.config.*",
        "postcss.config.*",
      ],
      { cwd: rootDir, absolute: true }
    );

    for (const cf of configFiles) {
      try {
        const content = fs.readFileSync(cf, "utf-8");
        for (const dep of deps) {
          if (content.includes(dep)) {
            allImports.add(dep);
          }
        }
      } catch {
        // skip
      }
    }

    // Known implicit deps that don't need explicit imports
    const implicitDeps = new Set([
      "typescript",
      "@types/node",
      "@types/react",
      "@types/react-dom",
      "eslint",
      "prettier",
      "husky",
      "lint-staged",
      "nodemon",
      "ts-node",
      "tsx",
      "concurrently",
      "cross-env",
      "dotenv",
      "env-cmd",
    ]);

    const unusedDeps: string[] = [];
    for (const dep of deps) {
      if (implicitDeps.has(dep)) continue;
      if (dep.startsWith("@types/")) continue;
      if (!allImports.has(dep)) {
        unusedDeps.push(dep);
      }
    }

    if (unusedDeps.length > 0) {
      for (const dep of unusedDeps.slice(0, 10)) {
        findings.push({
          id: `unused-dep-${dep}`,
          severity: "warning",
          category: "unused-deps",
          message: `"${dep}" appears unused — paying rent for no reason`,
          detail: dep,
        });
      }

      if (unusedDeps.length > 10) {
        findings.push({
          id: "unused-deps-overflow",
          severity: "warning",
          category: "unused-deps",
          message: `...and ${unusedDeps.length - 10} more potentially unused dependencies`,
        });
      }
    }

    return {
      findings,
      stats: {
        deps: deps.length,
        devDeps: devDeps.length,
        total: totalDeps,
        unusedCount: unusedDeps.length,
        unused: unusedDeps,
      },
    };
  }
}

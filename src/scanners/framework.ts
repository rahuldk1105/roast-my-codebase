import fg from "fast-glob";
import fs from "fs";
import path from "path";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS } from "../utils/constants.js";

export class FrameworkScanner implements Scanner {
  name = "framework";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    // Detect framework from package.json
    const pkgPath = path.join(rootDir, "package.json");
    let isNextJS = false;
    let isReact = false;

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        isNextJS = !!(pkg.dependencies?.next || pkg.devDependencies?.next);
        isReact = !!(pkg.dependencies?.react || pkg.devDependencies?.react);
      } catch (error) {
        // Invalid package.json, skip framework checks
        return { findings: [], stats: { isNextJS: false, isReact: false } };
      }
    }

    // If not Next.js or React, return early
    if (!isNextJS && !isReact) {
      return { findings: [], stats: { isNextJS: false, isReact: false } };
    }

    // Next.js checks
    if (isNextJS) {
      // 1. Check for App Router pages without metadata
      const appPages = await fg(["app/**/page.{ts,tsx,js,jsx}"], {
        cwd: rootDir,
        ignore: IGNORE_PATTERNS,
        absolute: true,
      });

      for (const pagePath of appPages) {
        try {
          const content = fs.readFileSync(pagePath, "utf-8");
          const hasMetadata =
            /export\s+(const|function)\s+metadata/.test(content) ||
            /export\s+(async\s+)?function\s+generateMetadata/.test(content);

          if (!hasMetadata) {
            const rel = path.relative(rootDir, pagePath).replace(/\\/g, "/");
            findings.push({
              id: `no-metadata-${rel}`,
              severity: "warning",
              category: "nextjs-metadata",
              message: `${rel} missing metadata export — SEO impact`,
              file: rel,
            });
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      // 2. Server/Client component mismatch
      const serverComponents = await fg(["app/**/*.{ts,tsx}"], {
        cwd: rootDir,
        ignore: IGNORE_PATTERNS,
        absolute: true,
      });

      for (const compPath of serverComponents) {
        try {
          const content = fs.readFileSync(compPath, "utf-8");
          const isClientComponent = /['"]use client['"]/.test(content);

          if (!isClientComponent) {
            const hasClientHooks =
              /\b(useState|useEffect|useLayoutEffect|useReducer)\s*\(/.test(
                content
              );

            if (hasClientHooks) {
              const rel = path.relative(rootDir, compPath).replace(/\\/g, "/");
              findings.push({
                id: `server-client-mismatch-${rel}`,
                severity: "warning",
                category: "nextjs-client-server",
                message: `${rel} uses client hooks without 'use client' directive`,
                file: rel,
              });
            }
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    }

    // React checks
    if (isReact) {
      // Check for error boundaries in root components
      const rootComponents = await fg(
        [
          "app/layout.{ts,tsx}",
          "app/error.{ts,tsx}",
          "pages/_app.{ts,tsx,js,jsx}",
          "src/App.{ts,tsx,js,jsx}",
        ],
        {
          cwd: rootDir,
          ignore: IGNORE_PATTERNS,
          absolute: true,
        }
      );

      if (rootComponents.length > 0) {
        for (const compPath of rootComponents) {
          try {
            const content = fs.readFileSync(compPath, "utf-8");
            const hasErrorBoundary =
              /ErrorBoundary|componentDidCatch|static getDerivedStateFromError/.test(
                content
              );

            if (!hasErrorBoundary) {
              const rel = path.relative(rootDir, compPath).replace(/\\/g, "/");
              findings.push({
                id: `no-error-boundary-${rel}`,
                severity: "info",
                category: "react-error-boundary",
                message: `${rel} could benefit from an error boundary`,
                file: rel,
              });
            }
          } catch (error) {
            // Skip files that can't be read
            continue;
          }
        }
      }
    }

    return {
      findings,
      stats: { isNextJS, isReact },
    };
  }
}

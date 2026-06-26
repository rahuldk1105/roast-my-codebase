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
    let isVue = false;
    let isAngular = false;
    let isSvelte = false;
    let isExpress = false;

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        isNextJS = !!(pkg.dependencies?.next || pkg.devDependencies?.next);
        isReact = !!(pkg.dependencies?.react || pkg.devDependencies?.react);
        isVue = !!(pkg.dependencies?.vue || pkg.devDependencies?.vue);
        isAngular = !!(pkg.dependencies?.["@angular/core"] || pkg.devDependencies?.["@angular/core"]);
        isSvelte = !!(pkg.dependencies?.svelte || pkg.devDependencies?.svelte);
        isExpress = !!(pkg.dependencies?.express || pkg.devDependencies?.express);
      } catch (error) {
        // Invalid package.json, skip framework checks
        return { findings: [], stats: { isNextJS: false, isReact: false } };
      }
    }

    // Detect FastAPI from requirements.txt or pyproject.toml
    let isFastAPI = false;
    const requirementsPath = path.join(rootDir, "requirements.txt");
    const pyprojectPath = path.join(rootDir, "pyproject.toml");
    if (fs.existsSync(requirementsPath)) {
      try {
        const content = fs.readFileSync(requirementsPath, "utf-8");
        if (content.toLowerCase().includes("fastapi")) {
          isFastAPI = true;
        }
      } catch (error) {
        // skip
      }
    }
    if (!isFastAPI && fs.existsSync(pyprojectPath)) {
      try {
        const content = fs.readFileSync(pyprojectPath, "utf-8");
        if (content.toLowerCase().includes("fastapi")) {
          isFastAPI = true;
        }
      } catch (error) {
        // skip
      }
    }

    // If no supported framework found, return early
    if (!isNextJS && !isReact && !isVue && !isAngular && !isSvelte && !isExpress && !isFastAPI) {
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
            // eslint-disable-next-line security/detect-unsafe-regex -- Bounded by file content
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

    // Vue checks
    if (isVue) {
      const vueFiles = await fg(["**/*.vue"], {
        cwd: rootDir,
        ignore: IGNORE_PATTERNS,
        absolute: true,
      });

      for (const filePath of vueFiles) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const rel = path.relative(rootDir, filePath).replace(/\\/g, "/");

          // 1. Options API vs Composition API
          if (
            /export\s+default\s+\{/.test(content) &&
            !/setup\s*\(/.test(content) &&
            !/<script\s+setup/.test(content)
          ) {
            findings.push({
              id: `vue-options-api-${rel}`,
              severity: "info",
              category: "vue-issues",
              message: "Composition API is recommended over Options API in Vue 3",
              file: rel,
            });
          }

          // 2. v-for without :key
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/v-for=/.test(line) && !/:key/.test(line)) {
              findings.push({
                id: `vue-vfor-no-key-${rel}-${i}`,
                severity: "warning",
                category: "vue-issues",
                message: "v-for without :key — Vue needs keys to track list items",
                file: rel,
              });
            }
          }

          // 3. Deep watchers without optimization
          if (/watch\s*:[\s\S]*?deep\s*:\s*true/.test(content)) {
            findings.push({
              id: `vue-deep-watcher-${rel}`,
              severity: "info",
              category: "vue-issues",
              message: "Deep watcher detected — consider computed properties for better performance",
              file: rel,
            });
          }
        } catch (error) {
          continue;
        }
      }
    }

    // Angular checks
    if (isAngular) {
      const tsFiles = await fg(["**/*.ts"], {
        cwd: rootDir,
        ignore: IGNORE_PATTERNS,
        absolute: true,
      });

      for (const filePath of tsFiles) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const rel = path.relative(rootDir, filePath).replace(/\\/g, "/");

          if (!/@Component\s*\(/.test(content)) continue;

          // 1. Missing OnPush change detection
          if (!/changeDetection\s*:\s*ChangeDetectionStrategy\.OnPush/.test(content)) {
            findings.push({
              id: `angular-no-onpush-${rel}`,
              severity: "info",
              category: "angular-issues",
              message: "Component missing OnPush change detection strategy — performance improvement available",
              file: rel,
            });
          }

          // 2. Direct DOM manipulation
          if (/document\.getElementById|document\.querySelector/.test(content)) {
            findings.push({
              id: `angular-direct-dom-${rel}`,
              severity: "warning",
              category: "angular-issues",
              message: "Direct DOM manipulation in Angular — use Renderer2 or ViewChild instead",
              file: rel,
            });
          }

          // 3. Any in Angular event handlers
          if (/\(event\s*:\s*any\)/.test(content)) {
            findings.push({
              id: `angular-event-any-${rel}`,
              severity: "info",
              category: "angular-issues",
              message: "Typed event handler recommended over (event: any)",
              file: rel,
            });
          }
        } catch (error) {
          continue;
        }
      }
    }

    // Svelte checks
    if (isSvelte) {
      const svelteFiles = await fg(["**/*.svelte"], {
        cwd: rootDir,
        ignore: IGNORE_PATTERNS,
        absolute: true,
      });

      for (const filePath of svelteFiles) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const rel = path.relative(rootDir, filePath).replace(/\\/g, "/");

          // 1. Reactive statement side effects
          // eslint-disable-next-line security/detect-unsafe-regex
          if (/\$:\s.{0,100}(fetch\(|console\.log\(|localStorage)/.test(content)) {
            findings.push({
              id: `svelte-reactive-side-effects-${rel}`,
              severity: "info",
              category: "svelte-issues",
              message: "Reactive statement with side effects — consider using lifecycle hooks instead",
              file: rel,
            });
          }

          // 2. Missing accessibility on buttons
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/<button/.test(line) && !/aria-label/.test(line)) {
              findings.push({
                id: `svelte-button-a11y-${rel}-${i}`,
                severity: "info",
                category: "svelte-issues",
                message: "Button without accessible label",
                file: rel,
              });
            }
          }
        } catch (error) {
          continue;
        }
      }
    }

    // Express checks
    if (isExpress) {
      const jsFiles = await fg(["**/*.{js,ts,mjs,cjs}"], {
        cwd: rootDir,
        ignore: IGNORE_PATTERNS,
        absolute: true,
      });

      let hasErrorHandler = false;
      const routeFiles: string[] = [];

      for (const filePath of jsFiles) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");

          if (/app\.use\s*\(/.test(content)) {
            // eslint-disable-next-line security/detect-unsafe-regex
            if (/app\.use\s*\(\s*(?:[^,]+,\s*)?\(\s*err\s*,\s*req\s*,\s*res\s*,\s*next\s*\)/.test(content)) {
              hasErrorHandler = true;
            }
          }

          if (/app\.(get|post|put|delete|patch)\s*\(/.test(content)) {
            routeFiles.push(filePath);
          }
        } catch (error) {
          continue;
        }
      }

      // 1. Missing error handling middleware
      if (!hasErrorHandler) {
        findings.push({
          id: "express-no-error-handler",
          severity: "warning",
          category: "express-issues",
          message: "No Express error handling middleware detected — unhandled errors will crash the server",
        });
      }

      // 2. No rate limiting
      let hasRateLimit = false;
      for (const filePath of jsFiles) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          if (/express-rate-limit|rate-limit/.test(content)) {
            hasRateLimit = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!hasRateLimit) {
        findings.push({
          id: "express-no-rate-limit",
          severity: "info",
          category: "express-issues",
          message: "No rate limiting detected — consider adding express-rate-limit",
        });
      }

      // 3. Synchronous file operations in route handlers
      for (const filePath of routeFiles) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const rel = path.relative(rootDir, filePath).replace(/\\/g, "/");
          if (/fs\.readFileSync|fs\.writeFileSync/.test(content)) {
            findings.push({
              id: `express-sync-fs-${rel}`,
              severity: "warning",
              category: "express-issues",
              message: "Synchronous file I/O in Express route — use async versions to avoid blocking",
              file: rel,
            });
          }
        } catch (error) {
          continue;
        }
      }
    }

    // FastAPI checks
    if (isFastAPI) {
      const pyFiles = await fg(["**/*.py"], {
        cwd: rootDir,
        ignore: IGNORE_PATTERNS,
        absolute: true,
      });

      for (const filePath of pyFiles) {
        try {
          const content = fs.readFileSync(filePath, "utf-8");
          const rel = path.relative(rootDir, filePath).replace(/\\/g, "/");

          if (!/@app\./.test(content)) continue;

          // 1. Missing response_model
          const routeMatches = content.match(/@app\.(get|post|put|delete|patch)\s*\([^)]*\)/g) || [];
          for (const match of routeMatches) {
            if (!/response_model\s*=/.test(match)) {
              findings.push({
                id: `fastapi-no-response-model-${rel}-${match.slice(0, 20)}`,
                severity: "info",
                category: "fastapi-issues",
                message: "FastAPI route missing response_model — add for automatic docs and validation",
                file: rel,
              });
              break;
            }
          }

          // 2. Sync endpoints (def, not async def)
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (
              /^\s*def\s+/.test(line) &&
              !/^\s*async\s+def\s+/.test(line) &&
              i > 0 &&
              /@app\./.test(lines[i - 1])
            ) {
              findings.push({
                id: `fastapi-sync-endpoint-${rel}-${i}`,
                severity: "warning",
                category: "fastapi-issues",
                message: "Synchronous FastAPI endpoint — use async def for better performance",
                file: rel,
              });
            }
          }

          // 3. POST without status_code
          const postMatches = content.match(/@app\.post\s*\([^)]*\)/g) || [];
          for (const match of postMatches) {
            if (!/status_code\s*=/.test(match)) {
              findings.push({
                id: `fastapi-no-status-code-${rel}-${match.slice(0, 20)}`,
                severity: "info",
                category: "fastapi-issues",
                message: "POST endpoint missing explicit status_code",
                file: rel,
              });
              break;
            }
          }
        } catch (error) {
          continue;
        }
      }
    }

    return {
      findings,
      stats: { isNextJS, isReact },
    };
  }
}

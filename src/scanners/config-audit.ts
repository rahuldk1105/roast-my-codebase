import fs from "fs";
import path from "path";
import { Scanner, ScanResult, Finding } from "../types/index.js";

function stripJsonComments(str: string): string {
  return str.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function tryParseJson(filePath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(stripJsonComments(raw));
  } catch {
    return null;
  }
}

export class ConfigAuditScanner implements Scanner {
  name = "config-audit";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    findings.push(...this.auditTypeScript(rootDir));
    findings.push(...this.auditESLint(rootDir));
    findings.push(...this.auditPrettier(rootDir));

    return { findings, stats: { totalChecks: findings.length } };
  }

  private auditTypeScript(rootDir: string): Finding[] {
    const findings: Finding[] = [];

    const tsconfigPath = path.join(rootDir, "tsconfig.json");
    const tsconfigBasePath = path.join(rootDir, "tsconfig.base.json");

    let configFile: string | null = null;
    let configFileName = "tsconfig.json";

    if (fs.existsSync(tsconfigPath)) {
      configFile = tsconfigPath;
    } else if (fs.existsSync(tsconfigBasePath)) {
      configFile = tsconfigBasePath;
      configFileName = "tsconfig.base.json";
    }

    if (!configFile) {
      findings.push({
        id: "config-no-tsconfig",
        severity: "warning",
        category: "config-audit",
        message: "No tsconfig.json found — TypeScript config missing",
        file: "tsconfig.json",
      });
      return findings;
    }

    const parsed = tryParseJson(configFile);
    if (!parsed) {
      return findings;
    }

    const compilerOptions = (parsed.compilerOptions ?? {}) as Record<string, unknown>;

    // strict
    if (compilerOptions.strict !== true) {
      findings.push({
        id: "config-ts-no-strict",
        severity: "warning",
        category: "config-audit",
        message: `${configFileName}: strict mode disabled — enables 8 strictness checks at once`,
        file: configFileName,
      });
    }

    // noUncheckedIndexedAccess
    if (!compilerOptions.noUncheckedIndexedAccess) {
      findings.push({
        id: "config-ts-no-unchecked-index",
        severity: "info",
        category: "config-audit",
        message: `${configFileName}: noUncheckedIndexedAccess not enabled — array index access can return undefined`,
        file: configFileName,
      });
    }

    // noImplicitReturns
    if (!compilerOptions.noImplicitReturns) {
      findings.push({
        id: "config-ts-no-implicit-returns",
        severity: "info",
        category: "config-audit",
        message: `${configFileName}: noImplicitReturns not set — functions can return undefined implicitly`,
        file: configFileName,
      });
    }

    // noFallthroughCasesInSwitch
    if (!compilerOptions.noFallthroughCasesInSwitch) {
      findings.push({
        id: "config-ts-no-fallthrough",
        severity: "info",
        category: "config-audit",
        message: `${configFileName}: noFallthroughCasesInSwitch not set`,
        file: configFileName,
      });
    }

    // exactOptionalPropertyTypes
    if (!compilerOptions.exactOptionalPropertyTypes) {
      findings.push({
        id: "config-ts-no-exact-optional",
        severity: "info",
        category: "config-audit",
        message: `${configFileName}: exactOptionalPropertyTypes not set — optional props accept undefined explicitly`,
        file: configFileName,
      });
    }

    // target ES3 or ES5
    const target = (compilerOptions.target as string | undefined)?.toUpperCase();
    if (target === "ES3" || target === "ES5") {
      findings.push({
        id: "config-ts-old-target",
        severity: "warning",
        category: "config-audit",
        message: `${configFileName}: target is ${compilerOptions.target} — modern Node.js supports ES2022+`,
        file: configFileName,
      });
    }

    // skipLibCheck: true
    if (compilerOptions.skipLibCheck === true) {
      findings.push({
        id: "config-ts-skip-lib-check",
        severity: "info",
        category: "config-audit",
        message: `${configFileName}: skipLibCheck: true — type errors in dependencies are ignored`,
        file: configFileName,
      });
    }

    // allowJs without checkJs
    if (compilerOptions.allowJs === true && compilerOptions.checkJs !== true) {
      findings.push({
        id: "config-ts-allow-js-no-check",
        severity: "info",
        category: "config-audit",
        message: `${configFileName}: allowJs without checkJs — JS files are included but not type-checked`,
        file: configFileName,
      });
    }

    return findings;
  }

  private auditESLint(rootDir: string): Finding[] {
    const findings: Finding[] = [];

    const eslintFileNames = [
      ".eslintrc.json",
      ".eslintrc.js",
      ".eslintrc.cjs",
      ".eslintrc.yaml",
      ".eslintrc.yml",
      "eslint.config.js",
      "eslint.config.mjs",
    ];

    let foundEslintFile: string | null = null;
    for (const name of eslintFileNames) {
      if (fs.existsSync(path.join(rootDir, name))) {
        foundEslintFile = name;
        break;
      }
    }

    if (!foundEslintFile) {
      findings.push({
        id: "config-no-eslint",
        severity: "info",
        category: "config-audit",
        message: "No ESLint config found — consider adding linting",
        file: ".eslintrc.json",
      });
      return findings;
    }

    // Only analyze JSON and YAML variants — skip .js files (need eval)
    const isJsonVariant = foundEslintFile === ".eslintrc.json";
    const isYamlVariant = foundEslintFile === ".eslintrc.yaml" || foundEslintFile === ".eslintrc.yml";

    if (!isJsonVariant && !isYamlVariant) {
      // Found a .js config — we know ESLint is configured, skip deep analysis
      return findings;
    }

    let parsed: Record<string, unknown> | null = null;
    if (isJsonVariant) {
      parsed = tryParseJson(path.join(rootDir, foundEslintFile));
    }
    // YAML parsing would need a library — skip deep analysis for YAML too
    if (!parsed) {
      return findings;
    }

    const extendsArr = parsed.extends;
    const pluginsArr = parsed.plugins;

    const extendsStr = JSON.stringify(extendsArr ?? "");
    const pluginsStr = JSON.stringify(pluginsArr ?? "");

    // extends missing
    if (!extendsArr || (Array.isArray(extendsArr) && extendsArr.length === 0)) {
      findings.push({
        id: "config-eslint-no-extends",
        severity: "info",
        category: "config-audit",
        message: "ESLint has no extends — no base ruleset configured",
        file: foundEslintFile,
      });
    }

    // No @typescript-eslint in extends or plugins (if TS project)
    const tsconfigExists = fs.existsSync(path.join(rootDir, "tsconfig.json")) ||
      fs.existsSync(path.join(rootDir, "tsconfig.base.json"));
    if (tsconfigExists) {
      const hasTypescriptEslint =
        extendsStr.includes("@typescript-eslint") ||
        pluginsStr.includes("@typescript-eslint");
      if (!hasTypescriptEslint) {
        findings.push({
          id: "config-eslint-no-ts-plugin",
          severity: "warning",
          category: "config-audit",
          message: "ESLint missing @typescript-eslint — TypeScript-specific rules disabled",
          file: foundEslintFile,
        });
      }
    }

    // No prettier in extends or plugins (if prettier is in package.json)
    const pkgPath = path.join(rootDir, "package.json");
    let prettierInPkg = false;
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
        const deps = (pkg.dependencies ?? {}) as Record<string, unknown>;
        const devDeps = (pkg.devDependencies ?? {}) as Record<string, unknown>;
        prettierInPkg = "prettier" in deps || "prettier" in devDeps;
      } catch {
        // ignore
      }
    }

    if (prettierInPkg) {
      const hasPrettierInConfig =
        extendsStr.includes("prettier") ||
        pluginsStr.includes("prettier");
      if (!hasPrettierInConfig) {
        findings.push({
          id: "config-eslint-no-prettier",
          severity: "info",
          category: "config-audit",
          message: "ESLint not configured with prettier — formatting conflicts possible",
          file: foundEslintFile,
        });
      }
    }

    // no-console rule missing
    const rules = (parsed.rules ?? {}) as Record<string, unknown>;
    if (!("no-console" in rules)) {
      findings.push({
        id: "config-eslint-no-console-rule",
        severity: "info",
        category: "config-audit",
        message: "ESLint: no-console rule not configured",
        file: foundEslintFile,
      });
    }

    // unused variables not flagged
    if (!("no-unused-vars" in rules) && !("@typescript-eslint/no-unused-vars" in rules)) {
      findings.push({
        id: "config-eslint-no-unused-vars",
        severity: "info",
        category: "config-audit",
        message: "ESLint: unused variables not flagged",
        file: foundEslintFile,
      });
    }

    return findings;
  }

  private auditPrettier(rootDir: string): Finding[] {
    const findings: Finding[] = [];

    const prettierFileNames = [
      ".prettierrc",
      ".prettierrc.json",
      ".prettierrc.js",
      "prettier.config.js",
    ];

    let foundPrettierFile: string | null = null;
    for (const name of prettierFileNames) {
      if (fs.existsSync(path.join(rootDir, name))) {
        foundPrettierFile = name;
        break;
      }
    }

    // Check if prettier is in package.json dependencies
    const pkgPath = path.join(rootDir, "package.json");
    let prettierInPkg = false;
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
        const deps = (pkg.dependencies ?? {}) as Record<string, unknown>;
        const devDeps = (pkg.devDependencies ?? {}) as Record<string, unknown>;
        prettierInPkg = "prettier" in deps || "prettier" in devDeps;
      } catch {
        // ignore
      }
    }

    if (!foundPrettierFile && !prettierInPkg) {
      findings.push({
        id: "config-no-prettier",
        severity: "info",
        category: "config-audit",
        message: "No Prettier config found — code formatting not standardized",
        file: ".prettierrc",
      });
      return findings;
    }

    // Only analyze JSON variants for deeper checks
    if (!foundPrettierFile) {
      return findings;
    }

    const isJsonVariant =
      foundPrettierFile === ".prettierrc" ||
      foundPrettierFile === ".prettierrc.json";

    if (!isJsonVariant) {
      return findings;
    }

    const parsed = tryParseJson(path.join(rootDir, foundPrettierFile));
    if (!parsed) {
      return findings;
    }

    // printWidth > 120
    const printWidth = parsed.printWidth as number | undefined;
    if (typeof printWidth === "number" && printWidth > 120) {
      findings.push({
        id: "config-prettier-wide-print",
        severity: "info",
        category: "config-audit",
        message: `Prettier printWidth is ${printWidth} — very long lines reduce readability`,
        file: foundPrettierFile,
      });
    }

    // semi: false
    if (parsed.semi === false) {
      findings.push({
        id: "config-prettier-no-semi",
        severity: "info",
        category: "config-audit",
        message: "Prettier: semicolons disabled — personal preference, ensure team alignment",
        file: foundPrettierFile,
      });
    }

    return findings;
  }
}

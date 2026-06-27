import { Command } from "commander";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ora from "ora";
import chalk from "chalk";
import {
  FileScanner,
  TodoScanner,
  DependencyScanner,
  CircularDependencyScanner,
  StructureScanner,
  ComplexityScanner,
  DuplicateScanner,
  DeadExportScanner,
  TypeSafetyScanner,
  TestCoverageScanner,
  GitInsightsScanner,
  SecurityScanner,
  FrameworkScanner,
  PythonComplexityScanner,
  PythonTypeHintsScanner,
  PythonImportsScanner,
  PythonDocstringScanner,
  PythonCodeSmellScanner,
  PythonSecurityScanner,
  PythonClassDesignScanner,
  GoComplexityScanner,
  GoErrorHandlingScanner,
  GoLintScanner,
  RustComplexityScanner,
  RustUnsafeScanner,
  RustClippyHintsScanner,
  JavaComplexityScanner,
  JavaCodeSmellScanner,
  JavaNamingScanner,
  CSharpComplexityScanner,
  CSharpCodeSmellScanner,
  CSharpAsyncScanner,
  DepHealthScanner,
  RubyComplexityScanner,
  RubyCodeSmellScanner,
  RubyStyleScanner,
  PHPComplexityScanner,
  PHPSecurityScanner,
  PHPCodeSmellScanner,
  SwiftComplexityScanner,
  SwiftCodeSmellScanner,
  SwiftAsyncScanner,
  KotlinComplexityScanner,
  KotlinCodeSmellScanner,
  KotlinCoroutineScanner,
  TestQualityScanner,
  CustomRulesScanner,
  LicenseScanner,
  ConfigAuditScanner,
  DatabaseScanner,
  BundleSizeScanner,
} from "../scanners/index.js";
import { detectProjectLanguage } from "../languages/index.js";
import { calculateHealth } from "../scoring/index.js";
import { generateRoasts, generateVerdict } from "../roasts/index.js";
import { renderReport, renderJsonReport, renderMarkdownReport, generateBadgeSvg, saveBadge } from "../report/index.js";
import { Finding, RoastReport, Scanner, HealthScore } from "../types/index.js";
import { generateFixSuggestions } from "../fixes/index.js";
import { startWatchMode, renderWatchSummary } from "../watch/index.js";
import { compareWithBranch, renderComparison } from "../compare/index.js";
import { loadConfig } from "../config/index.js";
import { loadRoastIgnore, filterIgnoredFindings } from "../utils/files.js";
import { buildIgnorePatterns } from "../utils/constants.js";
import { validateOutputPath, sanitizeError } from "../utils/security.js";
import { runInteractiveMode } from "../interactive/index.js";
import { loadHistory, addSnapshot, createSnapshot } from "../history/index.js";
import { renderHistoryReport, renderTrendSummary } from "../history/render.js";
import { renderHtmlReport, saveHtmlReport, renderSarifReport, saveSarifReport, detectPRContext, postPRComment, renderJUnitReport, saveJUnitReport } from "../report/index.js";
import { getChangedFiles, filterFindingsByFiles } from "../incremental/index.js";
import { detectPackageManager, writeCIWorkflow } from "../ci/index.js";
import { checkRegression, formatRegressionOutput } from "../regression/index.js";
import { installPreCommitHook, uninstallPreCommitHook } from "../hooks/index.js";
import { loadPlugins } from "../plugins/index.js";
import { startDashboard } from "../serve/index.js";

function loadPackageVersion(): string {
  const __filename = fileURLToPath(import.meta.url);
  let dir = path.dirname(__filename);
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.name === "roast-my-codebase") return pkg.version;
    }
    dir = path.dirname(dir);
  }
  return "1.0.0";
}

export function createCli(): Command {
  const program = new Command();

  program
    .name("roast-my-codebase")
    .description("Get roasted. Get better. Ship faster.")
    .version(loadPackageVersion())
    .argument("[path]", "path to scan", ".")
    .option("--json", "Output results as JSON")
    .option("--markdown", "Output results as markdown")
    .option("--markdown-file", "Save markdown report to .roast-report.md")
    .option("--fix", "Show actionable fix suggestions")
    .option("--ai-roasts", "Generate AI-powered contextual roasts (requires ANTHROPIC_API_KEY)")
    .option("--interactive", "Interactive mode - walk through fixing issues")
    .option("--dry-run", "Preview fixes without applying them (use with --interactive)")
    .option("--track", "Track health over time in .roast-history.json")
    .option("--history [days]", "Show health history (default: last 30 days)", parseInt)
    .option("--watch", "Watch for file changes and re-run analysis")
    .option("--compare <branch>", "Compare current codebase with a git branch")
    .option("--badge", "Generate health badge SVG (.roast-badge.svg)")
    .option("--ascii", "Show ASCII art grade in output")
    .option("--html-file", "Save HTML report to .roast-report.html")
    .option("--incremental", "Only analyze files changed since last commit (faster)")
    .option("--since <ref>", "Only analyze files changed since git ref (e.g., main)")
    .option("--sarif", "Output results as SARIF (for GitHub Code Scanning)")
    .option("--sarif-file", "Save SARIF results to .roast-results.sarif")
    .option("--junit", "Output results as JUnit XML (for Jenkins/GitLab/Bitbucket)")
    .option("--junit-file", "Save JUnit XML to .roast-junit.xml")
    .option("--pr-comment", "Post report as GitHub PR comment (uses GITHUB_TOKEN)")
    .option("--init-ci", "Generate .github/workflows/roast.yml CI workflow")
    .option("--fail-on-regression", "Fail if health score dropped since last --track snapshot")
    .option("--regression-tolerance <points>", "Points of drop to allow before failing (default: 0)", parseInt)
    .option("--install-hooks", "Install git pre-commit hook to run roast before every commit")
    .option("--uninstall-hooks", "Remove the roast pre-commit hook")
    .option("--show-ignored", "Show which patterns are active in .roastignore")
    .option("--hotmap", "Show ASCII directory tree with issue density per folder")
    .option("--hotmap-depth <n>", "Max depth for hotmap tree (default: 4)", parseInt)
    .option("--list-plugins", "List all configured roast plugins")
    .option("--init-plugin <name>", "Scaffold a new roast plugin package")
    .option("--serve", "Open interactive web dashboard in browser")
    .option("--port <number>", "Port for --serve dashboard (default: 7777)", parseInt)
    .option("--bundle", "Scan build output for bundle size regressions")
    .option(
      "--threshold <score>",
      "Exit with code 1 if health score is below threshold (use with --json)",
      parseInt
    )
    .action(async (targetPath: string, options: { json?: boolean; markdown?: boolean; markdownFile?: boolean; fix?: boolean; aiRoasts?: boolean; interactive?: boolean; dryRun?: boolean; track?: boolean; history?: number | boolean; watch?: boolean; compare?: string; badge?: boolean; ascii?: boolean; threshold?: number; htmlFile?: boolean; incremental?: boolean; since?: string; sarif?: boolean; sarifFile?: boolean; junit?: boolean; junitFile?: boolean; prComment?: boolean; initCi?: boolean; failOnRegression?: boolean; regressionTolerance?: number; installHooks?: boolean; uninstallHooks?: boolean; showIgnored?: boolean; hotmap?: boolean; hotmapDepth?: number; listPlugins?: boolean; initPlugin?: string; serve?: boolean; port?: number; bundle?: boolean }) => {
      const rootDir = path.resolve(targetPath);

      if (options.initCi) {
        const pm = detectPackageManager(rootDir);
        const ciConfig = {
          threshold: options.threshold ?? 60,
          prComment: true,
          sarif: true,
          nodeVersion: "20.x",
          packageManager: pm,
        };
        const result = writeCIWorkflow(rootDir, ciConfig);
        if (result.alreadyExists) {
          console.log(chalk.yellow(`\n⚠ ${result.path} already exists — not overwriting.\n`));
          console.log(chalk.dim("  Delete it and re-run to regenerate.\n"));
        } else {
          console.log(chalk.green(`\n✓ Created ${result.path}\n`));
          console.log(chalk.dim("  Add GITHUB_TOKEN secret in repo settings if not already present.\n"));
          console.log(chalk.dim("  Commit and push to activate.\n"));
        }
        process.exit(0);
      }

      if (options.installHooks) {
        const threshold = options.threshold ?? 60;
        const result = installPreCommitHook(rootDir, threshold);
        if (result.alreadyInstalled) {
          console.log(chalk.yellow(`\n⚠ Hook already installed at ${result.hookPath}\n`));
        } else if (result.success) {
          const hookType = result.huskyDetected ? "husky" : "git";
          console.log(chalk.green(`\n✓ Pre-commit hook installed (${hookType}) at ${result.hookPath}\n`));
          console.log(chalk.dim(`  Threshold: ${threshold}/100 — commits that drop below this will be blocked.\n`));
          if (!result.huskyDetected) {
            console.log(chalk.dim("  Tip: Consider using husky for team-wide hook sharing.\n"));
          }
        } else {
          console.log(chalk.red(`\n✗ Failed to install hook: ${result.message}\n`));
          process.exit(1);
        }
        process.exit(0);
      }

      if (options.uninstallHooks) {
        const result = uninstallPreCommitHook(rootDir);
        if (result.success) {
          console.log(chalk.green(`\n✓ Pre-commit hook removed from ${result.hookPath}\n`));
        } else {
          console.log(chalk.yellow(`\n⚠ ${result.message}\n`));
        }
        process.exit(0);
      }

      if (options.showIgnored) {
        const roastIgnorePatternsForDisplay = loadRoastIgnore(rootDir);
        if (roastIgnorePatternsForDisplay.length === 0) {
          console.log(chalk.yellow("\nNo .roastignore file found.\n"));
        } else {
          console.log(chalk.bold("\n.roastignore patterns:\n"));
          roastIgnorePatternsForDisplay.forEach((p) =>
            console.log(chalk.dim(`  ${p}`))
          );
          console.log();
        }
        process.exit(0);
      }

      if (options.initPlugin) {
        const pluginName = options.initPlugin;
        const SAFE_PLUGIN_NAME = /^[a-z0-9-]+$/;
        if (!SAFE_PLUGIN_NAME.test(pluginName.replace(/^roast-plugin-/, ''))) {
          console.error('Error: Plugin name must contain only lowercase letters, numbers, and hyphens.');
          process.exit(1);
        }
        const fullName = pluginName.startsWith('roast-plugin-') ? pluginName : `roast-plugin-${pluginName}`;
        let pluginDir: string;
        try {
          pluginDir = validateOutputPath(rootDir, fullName);
        } catch {
          console.error(`Error: Plugin name "${fullName}" would escape the project directory.`);
          process.exit(1);
        }

        try {
          fs.mkdirSync(path.join(pluginDir!, 'src'), { recursive: false });
        } catch (e: any) {
          if (e.code === 'EEXIST') {
            console.log(chalk.yellow(`\n⚠ Directory ${fullName} already exists.\n`));
            process.exit(1);
          }
          fs.mkdirSync(path.join(pluginDir!, 'src'), { recursive: true });
        }

        fs.writeFileSync(path.join(pluginDir!, 'package.json'), JSON.stringify({
          name: fullName, version: '0.1.0',
          description: 'A roast-my-codebase plugin',
          type: 'module', main: 'dist/index.js',
          scripts: { build: 'tsc', dev: 'tsc --watch' },
          peerDependencies: { 'roast-my-codebase': '>=1.0.0' },
          devDependencies: { typescript: '^5.0.0' }
        }, null, 2));

        fs.writeFileSync(path.join(pluginDir!, 'src', 'index.ts'),
`import type { Scanner, ScanResult, Finding } from 'roast-my-codebase/types';

export default {
  name: '${fullName}',
  version: '0.1.0',
  scanner: {
    name: '${fullName}',
    async scan(rootDir: string): Promise<ScanResult> {
      const findings: Finding[] = [];
      // TODO: implement your scanner logic here
      return { findings };
    }
  }
};
`);

        fs.writeFileSync(path.join(pluginDir!, 'tsconfig.json'), JSON.stringify({
          compilerOptions: {
            target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
            outDir: './dist', rootDir: './src', strict: true, declaration: true
          },
          include: ['src/**/*']
        }, null, 2));

        console.log(chalk.green(`\n✓ Plugin scaffolded at ./${fullName}/\n`));
        console.log(chalk.dim(`  1. cd ${fullName}\n  2. npm install\n  3. npm run build\n  4. Add "${fullName}" to .roastrc.json plugins array\n`));
        process.exit(0);
      }

      if (options.bundle) {
        if (!fs.existsSync(rootDir)) {
          console.error(`Error: "${rootDir}" does not exist.`);
          process.exit(1);
        }
        const { BundleSizeScanner: BundleSizeScannerDynamic } = await import('../scanners/bundle.js');
        const scanner = new BundleSizeScannerDynamic();
        const result = await scanner.scan(rootDir);

        const stats = result.stats as Record<string, unknown>;

        if (stats?.skipped) {
          console.log(chalk.yellow(`\n⚠ ${stats.reason}\n`));
          process.exit(0);
        }

        console.log(chalk.bold(`\n  Bundle Size Report`));
        console.log(chalk.dim(`  Output: ${stats?.outputDir}  Total: ${chalk.white(String(stats?.totalFormatted))}  Files: ${stats?.fileCount}`));
        console.log();

        if (result.findings.length === 0) {
          if (stats?.hasBaseline) {
            console.log(chalk.green('  ✓ No bundle size regressions detected\n'));
          } else {
            console.log(chalk.dim('  ✓ Baseline recorded — run again to detect regressions\n'));
          }
        } else {
          for (const f of result.findings) {
            const icon = f.severity === 'critical' ? chalk.red('✗') : f.severity === 'warning' ? chalk.yellow('⚠') : chalk.dim('ℹ');
            console.log(`  ${icon} ${f.message}`);
          }
          console.log();
        }
        process.exit(0);
      }

      if (!fs.existsSync(rootDir)) {
        console.error(`Error: "${rootDir}" does not exist.`);
        process.exit(1);
      }

      if (!fs.statSync(rootDir).isDirectory()) {
        console.error(`Error: "${rootDir}" is not a directory.`);
        process.exit(1);
      }

      // History mode - show historical health data
      if (options.history !== undefined) {
        const history = loadHistory(rootDir);

        if (!history) {
          console.log(
            chalk.yellow("\n⚠ No health history found.\n")
          );
          console.log(
            chalk.dim("Run with --track flag to start tracking health over time.\n")
          );
          process.exit(0);
        }

        const days = typeof options.history === "number" ? options.history : 30;
        console.log(renderHistoryReport(history, days));
        process.exit(0);
      }

      // Load configuration
      const config = loadConfig(rootDir);

      // Load .roastignore and build combined ignore patterns
      const roastIgnorePatterns = loadRoastIgnore(rootDir);
      const configIgnorePatterns = config.ignore || [];
      const allIgnorePatterns = buildIgnorePatterns([...configIgnorePatterns, ...roastIgnorePatterns]);

      // Build AI config from options and config file
      const aiConfig = {
        enabled: options.aiRoasts || config.ai?.enabled || false,
        apiKey: config.ai?.apiKey,
        model: config.ai?.model,
        maxTokens: config.ai?.maxTokens,
        temperature: config.ai?.temperature,
        cacheEnabled: config.ai?.cacheEnabled,
        cachePath: config.ai?.cachePath,
      };

      const pluginScanners = await loadPlugins(config, rootDir);
      const customRulesScanner = config.rules && config.rules.length > 0
        ? new CustomRulesScanner(config.rules)
        : null;

      if (options.listPlugins) {
        const pluginList = config.plugins || [];
        if (pluginList.length === 0) {
          console.log(chalk.yellow('\n  No plugins configured.\n'));
          console.log(chalk.dim('  Add plugins to .roastrc.json: { "plugins": ["roast-plugin-graphql"] }\n'));
        } else {
          console.log(chalk.bold('\n  Installed plugins:\n'));
          for (const name of pluginList) {
            const loaded = pluginScanners.find(s => s.name === name || s.name.includes(name));
            const status = loaded ? chalk.green('✓ loaded') : chalk.red('✗ not found');
            console.log(`  • ${chalk.dim(name)}  ${status}`);
          }
          console.log();
        }
        process.exit(0);
      }

      // Define scanner function for reuse in comparison mode
      const runScanners = async (scanRootDir: string, ignorePatterns: string[] = []): Promise<{ findings: Finding[]; health: HealthScore }> => {
        const allFindings: Finding[] = [];

        // Group 0: FileScanner (needed for stats, run first)
        const fileScanner = new FileScanner();
        const fileResult = await fileScanner.scan(scanRootDir);
        allFindings.push(...fileResult.findings);

        // Group 1: All independent scanners in parallel
        const [
          todoResult,
          depResult,
          circularResult,
          structureResult,
          complexityResult,
          duplicateResult,
          deadExportResult,
          typeSafetyResult,
          testCoverageResult,
          gitInsightsResult,
          securityResult,
          frameworkResult,
          depHealthResult,
          testQualityResult,
          licenseResult,
          databaseResult,
          configAuditResult,
          bundleSizeResult,
        ] = await Promise.all([
          new TodoScanner().scan(scanRootDir),
          new DependencyScanner().scan(scanRootDir),
          new CircularDependencyScanner().scan(scanRootDir),
          new StructureScanner().scan(scanRootDir),
          new ComplexityScanner().scan(scanRootDir),
          new DuplicateScanner().scan(scanRootDir),
          new DeadExportScanner().scan(scanRootDir),
          new TypeSafetyScanner().scan(scanRootDir),
          new TestCoverageScanner().scan(scanRootDir),
          new GitInsightsScanner().scan(scanRootDir),
          new SecurityScanner().scan(scanRootDir),
          new FrameworkScanner().scan(scanRootDir),
          new DepHealthScanner().scan(scanRootDir),
          new TestQualityScanner().scan(scanRootDir),
          new LicenseScanner().scan(scanRootDir),
          new DatabaseScanner().scan(scanRootDir),
          new ConfigAuditScanner().scan(scanRootDir),
          new BundleSizeScanner().scan(scanRootDir),
        ]);

        allFindings.push(
          ...todoResult.findings,
          ...depResult.findings,
          ...circularResult.findings,
          ...structureResult.findings,
          ...complexityResult.findings,
          ...duplicateResult.findings,
          ...deadExportResult.findings,
          ...typeSafetyResult.findings,
          ...testCoverageResult.findings,
          ...gitInsightsResult.findings,
          ...securityResult.findings,
          ...frameworkResult.findings,
          ...depHealthResult.findings,
          ...testQualityResult.findings,
          ...licenseResult.findings,
          ...databaseResult.findings,
          ...configAuditResult.findings,
          ...bundleSizeResult.findings,
        );

        // Group 3: Plugin scanners (sequential — unknown side effects)
        for (const pluginScanner of pluginScanners) {
          try {
            const pluginResult = await pluginScanner.scan(scanRootDir);
            allFindings.push(...pluginResult.findings);
          } catch { /* skip failed plugins */ }
        }

        // Custom rules scanner
        if (customRulesScanner) {
          try {
            const customResult = await customRulesScanner.scan(scanRootDir);
            allFindings.push(...customResult.findings);
          } catch { /* skip on error */ }
        }

        const filteredScanFindings = filterIgnoredFindings(allFindings, ignorePatterns, scanRootDir);
        const health = calculateHealth(filteredScanFindings);
        return { findings: filteredScanFindings, health };
      };

      // Handle comparison mode
      if (options.compare) {
        try {
          const comparison = await compareWithBranch(rootDir, options.compare, (dir) => runScanners(dir, allIgnorePatterns));
          renderComparison(comparison, options.compare);
        } catch (error) {
          console.error(`\nComparison failed: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
        return;
      }

      // Watch mode
      if (options.watch) {
        // Create scanner instances
        const scanners: Scanner[] = [
          new FileScanner(),
          new TodoScanner(),
          new DependencyScanner(),
          new CircularDependencyScanner(),
          new StructureScanner(),
          new ComplexityScanner(),
          new DuplicateScanner(),
          new DeadExportScanner(),
          new TypeSafetyScanner(),
          new TestCoverageScanner(),
          new GitInsightsScanner(),
          new SecurityScanner(),
          new FrameworkScanner(),
          new DepHealthScanner(),
          new TypeSafetyScanner(),
          new TestQualityScanner(),
          new LicenseScanner(),
          new DatabaseScanner(),
          new ConfigAuditScanner(),
          new BundleSizeScanner(),
          ...pluginScanners,
          ...(customRulesScanner ? [customRulesScanner] : []),
        ];

        const projectName = getProjectName(rootDir);
        let isFirstRun = true;

        await startWatchMode(rootDir, scanners, async (findings, health, delta, stats) => {
          if (isFirstRun) {
            // First run: show full report
            const roasts = await generateRoasts(findings, aiConfig, rootDir);
            const verdict = generateVerdict(health);

            const fixes = options.fix ? generateFixSuggestions(findings) : undefined;

            const report: RoastReport = {
              projectName,
              stats: stats!,
              health,
              findings,
              roasts,
              verdict,
              fixes,
            };

            console.log(renderReport(report, { ascii: options.ascii }));
            isFirstRun = false;
          } else {
            // Subsequent runs: show compact summary
            const findingCounts = {
              critical: findings.filter((f) => f.severity === "critical").length,
              warning: findings.filter((f) => f.severity === "warning").length,
              info: findings.filter((f) => f.severity === "info").length,
            };

            renderWatchSummary(health, delta, findingCounts);
          }
        });

        return;
      }

      // Regular mode
      console.log("");
      const spinner = ora({
        text: "Scanning your codebase...",
        spinner: "dots",
      }).start();

      try {
        const allFindings: Finding[] = [];

        // Group 0: FileScanner (need its stats for the report)
        const fileScanner = new FileScanner();
        const fileResult = await fileScanner.scan(rootDir);
        allFindings.push(...fileResult.findings);
        const stats = fileResult.stats;

        // Group 1: All independent scanners in parallel
        spinner.text = "Running core scanners...";
        const [
          todoResult,
          depResult,
          circularResult,
          structureResult,
          complexityResult,
          duplicateResult,
          deadExportResult,
          typeSafetyResult,
          testCoverageResult,
          gitInsightsResult,
          securityResult,
          frameworkResult,
          depHealthResult,
          testQualityResult,
          licenseResult,
          databaseResult,
          configAuditResult,
          bundleSizeResult,
        ] = await Promise.all([
          new TodoScanner().scan(rootDir),
          new DependencyScanner().scan(rootDir),
          new CircularDependencyScanner().scan(rootDir),
          new StructureScanner().scan(rootDir),
          new ComplexityScanner().scan(rootDir),
          new DuplicateScanner().scan(rootDir),
          new DeadExportScanner().scan(rootDir),
          new TypeSafetyScanner().scan(rootDir),
          new TestCoverageScanner().scan(rootDir),
          new GitInsightsScanner().scan(rootDir),
          new SecurityScanner().scan(rootDir),
          new FrameworkScanner().scan(rootDir),
          new DepHealthScanner().scan(rootDir),
          new TestQualityScanner().scan(rootDir),
          new LicenseScanner().scan(rootDir),
          new DatabaseScanner().scan(rootDir),
          new ConfigAuditScanner().scan(rootDir),
          new BundleSizeScanner().scan(rootDir),
        ]);

        allFindings.push(
          ...todoResult.findings,
          ...depResult.findings,
          ...circularResult.findings,
          ...structureResult.findings,
          ...complexityResult.findings,
          ...duplicateResult.findings,
          ...deadExportResult.findings,
          ...typeSafetyResult.findings,
          ...testCoverageResult.findings,
          ...gitInsightsResult.findings,
          ...securityResult.findings,
          ...frameworkResult.findings,
          ...depHealthResult.findings,
          ...testQualityResult.findings,
          ...licenseResult.findings,
          ...databaseResult.findings,
          ...configAuditResult.findings,
          ...bundleSizeResult.findings,
        );

        // Group 2: Language-specific scanners in parallel
        spinner.text = "Running language-specific scanners...";
        const detectedLanguages = detectProjectLanguage(rootDir, fs);
        const languageScanPromises: Promise<void>[] = [];

        if (detectedLanguages.includes("python")) {
          languageScanPromises.push(
            Promise.all([
              new PythonComplexityScanner().scan(rootDir),
              new PythonTypeHintsScanner().scan(rootDir),
              new PythonImportsScanner().scan(rootDir),
              new PythonDocstringScanner().scan(rootDir),
              new PythonCodeSmellScanner().scan(rootDir),
              new PythonSecurityScanner().scan(rootDir),
              new PythonClassDesignScanner().scan(rootDir),
            ]).then((results) => {
              allFindings.push(...results.flatMap((r) => r.findings));
            }),
          );
        }

        if (detectedLanguages.includes("go")) {
          languageScanPromises.push(
            Promise.all([
              new GoComplexityScanner().scan(rootDir),
              new GoErrorHandlingScanner().scan(rootDir),
              new GoLintScanner().scan(rootDir),
            ]).then((results) => {
              allFindings.push(...results.flatMap((r) => r.findings));
            }),
          );
        }

        if (detectedLanguages.includes("rust")) {
          languageScanPromises.push(
            Promise.all([
              new RustComplexityScanner().scan(rootDir),
              new RustUnsafeScanner().scan(rootDir),
              new RustClippyHintsScanner().scan(rootDir),
            ]).then((results) => {
              allFindings.push(...results.flatMap((r) => r.findings));
            }),
          );
        }

        if (detectedLanguages.includes("java")) {
          languageScanPromises.push(
            Promise.all([
              new JavaComplexityScanner().scan(rootDir),
              new JavaCodeSmellScanner().scan(rootDir),
              new JavaNamingScanner().scan(rootDir),
            ]).then((results) => {
              allFindings.push(...results.flatMap((r) => r.findings));
            }),
          );
        }

        if (detectedLanguages.includes("csharp")) {
          languageScanPromises.push(
            Promise.all([
              new CSharpComplexityScanner().scan(rootDir),
              new CSharpCodeSmellScanner().scan(rootDir),
              new CSharpAsyncScanner().scan(rootDir),
            ]).then((results) => {
              allFindings.push(...results.flatMap((r) => r.findings));
            }),
          );
        }

        if (detectedLanguages.includes("ruby")) {
          languageScanPromises.push(
            Promise.all([
              new RubyComplexityScanner().scan(rootDir),
              new RubyCodeSmellScanner().scan(rootDir),
              new RubyStyleScanner().scan(rootDir),
            ]).then((results) => {
              allFindings.push(...results.flatMap((r) => r.findings));
            }),
          );
        }

        if (detectedLanguages.includes("php")) {
          languageScanPromises.push(
            Promise.all([
              new PHPComplexityScanner().scan(rootDir),
              new PHPSecurityScanner().scan(rootDir),
              new PHPCodeSmellScanner().scan(rootDir),
            ]).then((results) => {
              allFindings.push(...results.flatMap((r) => r.findings));
            }),
          );
        }

        if (detectedLanguages.includes("swift")) {
          languageScanPromises.push(
            Promise.all([
              new SwiftComplexityScanner().scan(rootDir),
              new SwiftCodeSmellScanner().scan(rootDir),
              new SwiftAsyncScanner().scan(rootDir),
            ]).then((results) => {
              allFindings.push(...results.flatMap((r) => r.findings));
            }),
          );
        }

        if (detectedLanguages.includes("kotlin")) {
          languageScanPromises.push(
            Promise.all([
              new KotlinComplexityScanner().scan(rootDir),
              new KotlinCodeSmellScanner().scan(rootDir),
              new KotlinCoroutineScanner().scan(rootDir),
            ]).then((results) => {
              allFindings.push(...results.flatMap((r) => r.findings));
            }),
          );
        }

        await Promise.all(languageScanPromises);

        // Run plugin scanners
        if (pluginScanners.length > 0) {
          for (const pluginScanner of pluginScanners) {
            spinner.text = `Running plugin: ${pluginScanner.name}...`;
            try {
              const pluginResult = await pluginScanner.scan(rootDir);
              allFindings.push(...pluginResult.findings);
            } catch (error) {
              console.warn(`\nWarning: Plugin "${pluginScanner.name}" failed: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }

        // Run custom rules scanner
        if (customRulesScanner) {
          spinner.text = "Running custom rules...";
          try {
            const customResult = await customRulesScanner.scan(rootDir);
            allFindings.push(...customResult.findings);
          } catch (error) {
            console.warn(`\nWarning: Custom rules scanner failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        spinner.stop();

        // Apply .roastignore / config ignore filtering
        const ignoredFilteredFindings = filterIgnoredFindings(allFindings, [...configIgnorePatterns, ...roastIgnorePatterns], rootDir);

        // Calculate health
        const health = calculateHealth(ignoredFilteredFindings);

        // Generate roasts (with AI if enabled)
        const roasts = await generateRoasts(ignoredFilteredFindings, aiConfig, rootDir);

        // Generate verdict
        const verdict = generateVerdict(health);

        // Get project name
        const projectName = getProjectName(rootDir);

        // Generate fix suggestions if --fix flag is provided
        const fixes = options.fix ? generateFixSuggestions(ignoredFilteredFindings) : undefined;

        // Build report
        const report: RoastReport = {
          projectName,
          stats,
          health,
          findings: ignoredFilteredFindings,
          roasts,
          verdict,
          fixes,
        };

        // Incremental mode — filter findings to changed files only
        if (options.incremental || options.since) {
          const incrementalResult = getChangedFiles(rootDir, options.since);
          if (incrementalResult.isIncremental) {
            const filteredFindings = filterFindingsByFiles(allFindings, incrementalResult.changedFiles, rootDir);
            const changedCount = incrementalResult.changedFiles.length;
            console.log(chalk.dim(`\n  Incremental scan: ${changedCount} changed file(s) since ${incrementalResult.baseRef}\n`));
            report.findings = filteredFindings;
            report.health = calculateHealth(filteredFindings);
          } else {
            console.log(chalk.yellow("  Not a git repo — running full scan\n"));
          }
        }

        // Track health history if requested
        if (options.track) {
          const snapshot = createSnapshot(health, ignoredFilteredFindings, rootDir);
          const history = addSnapshot(rootDir, projectName, snapshot);

          console.log(chalk.green("\n✓ Health snapshot saved to .roast-history.json"));

          // Show mini trend if we have enough data
          const trendSummary = renderTrendSummary(history, 7);
          if (trendSummary) {
            console.log(chalk.dim("  Last 7 days: ") + trendSummary);
          }
          console.log();
        }

        // Regression check
        if (options.failOnRegression) {
          const tolerance = options.regressionTolerance ?? 0;
          const regression = checkRegression(rootDir, health.score, tolerance);
          console.log("\n" + formatRegressionOutput(regression));
          if (regression.isRegression) {
            process.exit(1);
          }
        }

        // Interactive mode
        if (options.interactive) {
          // Show report first
          console.log(renderReport(report, { ascii: options.ascii }));

          // Then start interactive fixing
          await runInteractiveMode(report, rootDir, options.dryRun || false);
          return;
        }

        // Serve dashboard mode — start HTTP server and keep process alive
        if (options.serve) {
          startDashboard(report, options.port ?? 7777, {
            watch: true,
            rootDir,
            rescan: async () => {
              const freshFindings: Finding[] = [];

              const fileScanner = new FileScanner();
              const fileResult = await fileScanner.scan(rootDir);
              freshFindings.push(...fileResult.findings);
              const freshStats = fileResult.stats;

              const [
                todoResult, depResult, circularResult, structureResult,
                complexityResult, duplicateResult, deadExportResult,
                typeSafetyResult, testCoverageResult, gitInsightsResult,
                securityResult, frameworkResult, depHealthResult,
              ] = await Promise.all([
                new TodoScanner().scan(rootDir),
                new DependencyScanner().scan(rootDir),
                new CircularDependencyScanner().scan(rootDir),
                new StructureScanner().scan(rootDir),
                new ComplexityScanner().scan(rootDir),
                new DuplicateScanner().scan(rootDir),
                new DeadExportScanner().scan(rootDir),
                new TypeSafetyScanner().scan(rootDir),
                new TestCoverageScanner().scan(rootDir),
                new GitInsightsScanner().scan(rootDir),
                new SecurityScanner().scan(rootDir),
                new FrameworkScanner().scan(rootDir),
                new DepHealthScanner().scan(rootDir),
              ]);
              freshFindings.push(
                ...todoResult.findings, ...depResult.findings, ...circularResult.findings,
                ...structureResult.findings, ...complexityResult.findings, ...duplicateResult.findings,
                ...deadExportResult.findings, ...typeSafetyResult.findings, ...testCoverageResult.findings,
                ...gitInsightsResult.findings, ...securityResult.findings, ...frameworkResult.findings,
                ...depHealthResult.findings,
              );

              const filteredFresh = filterIgnoredFindings(freshFindings, allIgnorePatterns, rootDir);
              const freshHealth = calculateHealth(filteredFresh);
              const freshRoasts = await generateRoasts(filteredFresh, aiConfig, rootDir);
              const freshVerdict = generateVerdict(freshHealth);

              return {
                projectName: getProjectName(rootDir),
                stats: freshStats,
                health: freshHealth,
                findings: filteredFresh,
                roasts: freshRoasts,
                verdict: freshVerdict,
              };
            },
          });
          return; // keep process alive — server stays running
        }

        // Render
        if (options.junit || options.junitFile) {
          const junitOutput = renderJUnitReport(report, rootDir);
          if (options.junitFile) {
            saveJUnitReport(junitOutput, rootDir);
            console.log(chalk.green('\n✓ JUnit report saved to .roast-junit.xml\n'));
          } else {
            console.log(junitOutput);
          }
        } else if (options.sarif || options.sarifFile) {
          const sarifOutput = renderSarifReport(report, rootDir);
          if (options.sarifFile) {
            saveSarifReport(sarifOutput, rootDir);
            console.log(chalk.green("\n✓ SARIF report saved to .roast-results.sarif\n"));
          } else {
            console.log(sarifOutput);
          }
        } else if (options.json) {
          console.log(renderJsonReport(report));

          // Check threshold if provided
          if (options.threshold !== undefined && report.health.score < options.threshold) {
            process.exit(1);
          }
        } else if (options.markdown || options.markdownFile) {
          const markdownOutput = renderMarkdownReport(report);

          if (options.markdownFile) {
            try {
              // Validate output path to prevent path traversal
              const outputPath = validateOutputPath(rootDir, ".roast-report.md");
              fs.writeFileSync(outputPath, markdownOutput, "utf-8");
              console.log(`\n✓ Markdown report saved to ${outputPath}\n`);
            } catch (error) {
              console.error(`Failed to save markdown report: ${sanitizeError(error)}`);
              process.exit(1);
            }
          } else {
            // Print to console
            console.log(markdownOutput);
          }
        } else {
          console.log(renderReport(report, { ascii: options.ascii }));
        }

        // Generate badge if requested
        if (options.badge) {
          const badgeSvg = generateBadgeSvg(health);
          saveBadge(badgeSvg, rootDir);
        }

        // Post PR comment if requested
        if (options.prComment) {
          const prConfig = detectPRContext();
          if (prConfig) {
            spinner.start("Posting PR comment...");
            await postPRComment(report, prConfig);
            spinner.stop();
            console.log(chalk.green("\n✓ PR comment posted\n"));
          } else {
            console.log(chalk.yellow("\n⚠ Could not detect PR context (is GITHUB_TOKEN set?)\n"));
          }
        }

        // Save HTML report if requested
        if (options.htmlFile) {
          const htmlOutput = renderHtmlReport(report);
          saveHtmlReport(htmlOutput, rootDir);
          console.log(chalk.green(`\n✓ HTML report saved to .roast-report.html\n`));
        }

        // Show hotmap if requested
        if (options.hotmap) {
          const tree = buildFolderTree(report.findings, rootDir);
          console.log(renderHotmap(tree, options.hotmapDepth ?? 4));
        }
      } catch (error) {
        spinner.stop();
        console.error("Analysis failed:", sanitizeError(error));

        // Log full error to debug file if DEBUG env var is set
        if (process.env.DEBUG) {
          try {
            const debugPath = path.join(rootDir, ".roast-debug.log");
            const timestamp = new Date().toISOString();
            const errorStr = error instanceof Error ? error.stack : String(error);
            fs.appendFileSync(debugPath, `${timestamp}: ${errorStr}\n`);
            console.log(`Debug info saved to ${debugPath}`);
          } catch {
            // Ignore debug logging errors
          }
        }

        process.exit(1);
      }
    });

  return program;
}

function getProjectName(rootDir: string): string {
  const pkgPath = path.join(rootDir, "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.name || path.basename(rootDir);
  } catch {
    return path.basename(rootDir);
  }
}

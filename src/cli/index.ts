import { Command } from "commander";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ora from "ora";
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
} from "../scanners/index.js";
import { calculateHealth } from "../scoring/index.js";
import { generateRoasts, generateVerdict } from "../roasts/index.js";
import { renderReport, renderJsonReport, renderMarkdownReport, generateBadgeSvg, saveBadge } from "../report/index.js";
import { Finding, RoastReport, Scanner, HealthScore } from "../types/index.js";
import { generateFixSuggestions } from "../fixes/index.js";
import { startWatchMode, renderWatchSummary } from "../watch/index.js";
import { compareWithBranch, renderComparison } from "../compare/index.js";
import { loadConfig } from "../config/index.js";
import { validateOutputPath, sanitizeError } from "../utils/security.js";
import { runInteractiveMode } from "../interactive/index.js";

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
    .option("--interactive", "Interactive mode - walk through fixing issues")
    .option("--dry-run", "Preview fixes without applying them (use with --interactive)")
    .option("--watch", "Watch for file changes and re-run analysis")
    .option("--compare <branch>", "Compare current codebase with a git branch")
    .option("--badge", "Generate health badge SVG (.roast-badge.svg)")
    .option("--ascii", "Show ASCII art grade in output")
    .option(
      "--threshold <score>",
      "Exit with code 1 if health score is below threshold (use with --json)",
      parseInt
    )
    .action(async (targetPath: string, options: { json?: boolean; markdown?: boolean; markdownFile?: boolean; fix?: boolean; interactive?: boolean; dryRun?: boolean; watch?: boolean; compare?: string; badge?: boolean; ascii?: boolean; threshold?: number }) => {
      const rootDir = path.resolve(targetPath);

      if (!fs.existsSync(rootDir)) {
        console.error(`Error: "${rootDir}" does not exist.`);
        process.exit(1);
      }

      if (!fs.statSync(rootDir).isDirectory()) {
        console.error(`Error: "${rootDir}" is not a directory.`);
        process.exit(1);
      }

      // Load configuration (currently not used but kept for future scanner filtering)
      // const _config = loadConfig(rootDir);

      // Load plugins (currently not integrated into scanners array)
      // const _pluginScanners = await loadPlugins(config, rootDir);

      // Define scanner function for reuse in comparison mode
      const runScanners = async (scanRootDir: string): Promise<{ findings: Finding[]; health: HealthScore }> => {
        const allFindings: Finding[] = [];

        const fileScanner = new FileScanner();
        const fileResult = await fileScanner.scan(scanRootDir);
        allFindings.push(...fileResult.findings);

        const todoScanner = new TodoScanner();
        const todoResult = await todoScanner.scan(scanRootDir);
        allFindings.push(...todoResult.findings);

        const depScanner = new DependencyScanner();
        const depResult = await depScanner.scan(scanRootDir);
        allFindings.push(...depResult.findings);

        const circularScanner = new CircularDependencyScanner();
        const circularResult = await circularScanner.scan(scanRootDir);
        allFindings.push(...circularResult.findings);

        const structureScanner = new StructureScanner();
        const structureResult = await structureScanner.scan(scanRootDir);
        allFindings.push(...structureResult.findings);

        const complexityScanner = new ComplexityScanner();
        const complexityResult = await complexityScanner.scan(scanRootDir);
        allFindings.push(...complexityResult.findings);

        const duplicateScanner = new DuplicateScanner();
        const duplicateResult = await duplicateScanner.scan(scanRootDir);
        allFindings.push(...duplicateResult.findings);

        const deadExportScanner = new DeadExportScanner();
        const deadExportResult = await deadExportScanner.scan(scanRootDir);
        allFindings.push(...deadExportResult.findings);

        const typeSafetyScanner = new TypeSafetyScanner();
        const typeSafetyResult = await typeSafetyScanner.scan(scanRootDir);
        allFindings.push(...typeSafetyResult.findings);

        const testCoverageScanner = new TestCoverageScanner();
        const testCoverageResult = await testCoverageScanner.scan(scanRootDir);
        allFindings.push(...testCoverageResult.findings);

        const gitInsightsScanner = new GitInsightsScanner();
        const gitInsightsResult = await gitInsightsScanner.scan(scanRootDir);
        allFindings.push(...gitInsightsResult.findings);

        const securityScanner = new SecurityScanner();
        const securityResult = await securityScanner.scan(scanRootDir);
        allFindings.push(...securityResult.findings);

        const frameworkScanner = new FrameworkScanner();
        const frameworkResult = await frameworkScanner.scan(scanRootDir);
        allFindings.push(...frameworkResult.findings);

        const health = calculateHealth(allFindings);
        return { findings: allFindings, health };
      };

      // Handle comparison mode
      if (options.compare) {
        try {
          const comparison = await compareWithBranch(rootDir, options.compare, runScanners);
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
          new TypeSafetyScanner(),
        ];

        const projectName = getProjectName(rootDir);
        let isFirstRun = true;

        await startWatchMode(rootDir, scanners, (findings, health, delta, stats) => {
          if (isFirstRun) {
            // First run: show full report
            const roasts = generateRoasts(findings);
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

        // Run scanners
        const fileScanner = new FileScanner();
        const fileResult = await fileScanner.scan(rootDir);
        allFindings.push(...fileResult.findings);
        const stats = fileResult.stats;

        spinner.text = "Detecting TODOs...";
        const todoScanner = new TodoScanner();
        const todoResult = await todoScanner.scan(rootDir);
        allFindings.push(...todoResult.findings);

        spinner.text = "Analyzing dependencies...";
        const depScanner = new DependencyScanner();
        const depResult = await depScanner.scan(rootDir);
        allFindings.push(...depResult.findings);

        spinner.text = "Checking for circular dependencies...";
        const circularScanner = new CircularDependencyScanner();
        const circularResult = await circularScanner.scan(rootDir);
        allFindings.push(...circularResult.findings);

        spinner.text = "Analyzing project structure...";
        const structureScanner = new StructureScanner();
        const structureResult = await structureScanner.scan(rootDir);
        allFindings.push(...structureResult.findings);

        spinner.text = "Calculating code complexity...";
        const complexityScanner = new ComplexityScanner();
        const complexityResult = await complexityScanner.scan(rootDir);
        allFindings.push(...complexityResult.findings);

        spinner.text = "Detecting duplicate code...";
        const duplicateScanner = new DuplicateScanner();
        const duplicateResult = await duplicateScanner.scan(rootDir);
        allFindings.push(...duplicateResult.findings);

        spinner.text = "Finding dead exports...";
        const deadExportScanner = new DeadExportScanner();
        const deadExportResult = await deadExportScanner.scan(rootDir);
        allFindings.push(...deadExportResult.findings);

        spinner.text = "Auditing type safety...";
        const typeSafetyScanner = new TypeSafetyScanner();
        const typeSafetyResult = await typeSafetyScanner.scan(rootDir);
        allFindings.push(...typeSafetyResult.findings);

        spinner.text = "Checking test coverage...";
        const testCoverageScanner = new TestCoverageScanner();
        const testCoverageResult = await testCoverageScanner.scan(rootDir);
        allFindings.push(...testCoverageResult.findings);

        spinner.text = "Analyzing git history...";
        const gitInsightsScanner = new GitInsightsScanner();
        const gitInsightsResult = await gitInsightsScanner.scan(rootDir);
        allFindings.push(...gitInsightsResult.findings);

        spinner.text = "Scanning security surface...";
        const securityScanner = new SecurityScanner();
        const securityResult = await securityScanner.scan(rootDir);
        allFindings.push(...securityResult.findings);

        spinner.text = "Checking framework best practices...";
        const frameworkScanner = new FrameworkScanner();
        const frameworkResult = await frameworkScanner.scan(rootDir);
        allFindings.push(...frameworkResult.findings);

        spinner.stop();

        // Calculate health
        const health = calculateHealth(allFindings);

        // Generate roasts
        const roasts = generateRoasts(allFindings);

        // Generate verdict
        const verdict = generateVerdict(health);

        // Get project name
        const projectName = getProjectName(rootDir);

        // Generate fix suggestions if --fix flag is provided
        const fixes = options.fix ? generateFixSuggestions(allFindings) : undefined;

        // Build report
        const report: RoastReport = {
          projectName,
          stats,
          health,
          findings: allFindings,
          roasts,
          verdict,
          fixes,
        };

        // Interactive mode
        if (options.interactive) {
          // Show report first
          console.log(renderReport(report, { ascii: options.ascii }));

          // Then start interactive fixing
          await runInteractiveMode(report, rootDir, options.dryRun || false);
          return;
        }

        // Render
        if (options.json) {
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

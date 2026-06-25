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
} from "../scanners/index.js";
import { calculateHealth } from "../scoring/index.js";
import { generateRoasts, generateVerdict } from "../roasts/index.js";
import { renderReport, renderJsonReport } from "../report/index.js";
import { Finding, RoastReport, Scanner, ProjectStats, HealthScore } from "../types/index.js";
import { generateFixSuggestions } from "../fixes/index.js";
import { startWatchMode, renderWatchSummary } from "../watch/index.js";
import { compareWithBranch, renderComparison } from "../compare/index.js";

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
    .option("--fix", "Show actionable fix suggestions")
    .option("--watch", "Watch for file changes and re-run analysis")
    .option("--compare <branch>", "Compare current codebase with a git branch")
    .option(
      "--threshold <score>",
      "Exit with code 1 if health score is below threshold (use with --json)",
      parseInt
    )
    .action(async (targetPath: string, options: { json?: boolean; fix?: boolean; watch?: boolean; compare?: string; threshold?: number }) => {
      const rootDir = path.resolve(targetPath);

      if (!fs.existsSync(rootDir)) {
        console.error(`Error: "${rootDir}" does not exist.`);
        process.exit(1);
      }

      if (!fs.statSync(rootDir).isDirectory()) {
        console.error(`Error: "${rootDir}" is not a directory.`);
        process.exit(1);
      }

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

            console.log(renderReport(report));
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

        // Render
        if (options.json) {
          console.log(renderJsonReport(report));

          // Check threshold if provided
          if (options.threshold !== undefined && report.health.score < options.threshold) {
            process.exit(1);
          }
        } else {
          console.log(renderReport(report));
        }
      } catch (error) {
        spinner.stop();
        console.error("Analysis failed:", error);
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

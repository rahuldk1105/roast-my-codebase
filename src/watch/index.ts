import chokidar from "chokidar";
import chalk from "chalk";
import { Scanner, Finding, HealthScore, ProjectStats } from "../types/index.js";
import { calculateHealth } from "../scoring/index.js";

interface WatchState {
  lastScore: number;
  lastFindings: Finding[];
  runCount: number;
}

export async function startWatchMode(
  rootDir: string,
  scanners: Scanner[],
  onScan: (findings: Finding[], health: HealthScore, delta: number | null, stats?: ProjectStats) => void
) {
  const state: WatchState = {
    lastScore: 0,
    lastFindings: [],
    runCount: 0,
  };

  const runScan = async () => {
    const allFindings: Finding[] = [];
    let stats: ProjectStats | undefined;

    for (const scanner of scanners) {
      const result = await scanner.scan(rootDir);
      allFindings.push(...result.findings);

      // Capture stats from FileScanner (first scanner)
      if ((result as any).stats) {
        stats = (result as any).stats;
      }
    }

    const health = calculateHealth(allFindings);
    const delta = state.runCount > 0 ? health.score - state.lastScore : null;

    state.lastScore = health.score;
    state.lastFindings = allFindings;
    state.runCount++;

    onScan(allFindings, health, delta, stats);
  };

  // Initial scan
  await runScan();

  // Watch for changes
  const watcher = chokidar.watch(["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"], {
    cwd: rootDir,
    ignored: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**"],
    ignoreInitial: true,
    persistent: true,
  });

  console.log(chalk.dim("\n👀 Watching for changes... (Press Ctrl+C to stop)\n"));

  watcher.on("change", async (filePath) => {
    console.log(chalk.dim(`\n📝 Changed: ${filePath}`));
    await runScan();
  });

  // Handle cleanup
  process.on("SIGINT", () => {
    watcher.close();
    process.exit(0);
  });
}

export function renderWatchSummary(
  health: HealthScore,
  delta: number | null,
  findingCounts: { critical: number; warning: number; info: number }
) {
  const deltaStr =
    delta !== null
      ? delta > 0
        ? chalk.green(` +${delta}`)
        : delta < 0
        ? chalk.red(` ${delta}`)
        : chalk.dim(" ±0")
      : "";

  console.log(`\n  Health: ${health.score}/100${deltaStr} ${health.grade} ${health.label}`);

  if (findingCounts.critical > 0) {
    console.log(`  ${chalk.red("✗")} ${findingCounts.critical} critical`);
  }
  if (findingCounts.warning > 0) {
    console.log(`  ${chalk.yellow("⚠")} ${findingCounts.warning} warnings`);
  }
  if (findingCounts.info > 0) {
    console.log(`  ${chalk.blue("●")} ${findingCounts.info} info`);
  }

  console.log("");
}

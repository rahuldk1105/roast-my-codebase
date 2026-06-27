export type Severity = "info" | "warning" | "critical";

/**
 * Custom lint rule defined in .roastrc.json
 * Example:
 * {
 *   "id": "no-console",
 *   "name": "No console.log in source",
 *   "pattern": "console\\.log\\(",
 *   "severity": "warning",
 *   "message": "console.log in {file} — use a logger",
 *   "filePattern": "src/**\/*.ts",
 *   "maxPerFile": 3
 * }
 */
export interface CustomRule {
  id: string;                          // unique ID, e.g. "no-console"
  name: string;                        // human-readable name
  pattern: string;                     // regex string to match against file content
  severity: "critical" | "warning" | "info";
  message: string;                     // displayed in findings, supports {file} and {line} placeholders
  filePattern?: string;                // glob to filter which files to scan, e.g. "**/*.ts"
  exclude?: string[];                  // glob patterns to exclude
  maxPerFile?: number;                 // max findings per file (default: 1)
  category?: string;                   // defaults to "custom-rule"
}

export interface Finding {
  id: string;
  severity: Severity;
  category: string;
  message: string;
  file?: string;
  detail?: string;
}

export interface ScanResult {
  findings: Finding[];
  stats?: unknown;
}

export interface Scanner {
  name: string;
  scan(rootDir: string): Promise<ScanResult>;
}

export interface ProjectStats {
  totalFiles: number;
  sourceFiles: number;
  totalLines: number;
  largestFiles: { path: string; lines: number }[];
  dependencies: number;
  devDependencies: number;
}

export interface HealthScore {
  score: number;
  grade: string;
  label: string;
}

export interface FixSuggestion {
  findingId: string;
  finding: Finding;
  suggestion: string;
  autoFixable: boolean;
  command?: string;
}

export interface RoastReport {
  projectName: string;
  stats: ProjectStats;
  health: HealthScore;
  findings: Finding[];
  roasts: Roast[];
  verdict: string;
  fixes?: FixSuggestion[];
}

export interface Roast {
  target: string;
  message: string;
  category: string;
}

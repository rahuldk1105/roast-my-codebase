export type Severity = "info" | "warning" | "critical";

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

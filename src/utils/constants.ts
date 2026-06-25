export const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];

export const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/.git/**",
  "**/.turbo/**",
  "**/.cache/**",
  "**/out/**",
  "**/.output/**",
];

export const LARGE_FILE_THRESHOLDS = {
  warning: 500,
  large: 1000,
  extreme: 2000,
};

export const HEALTH_DEDUCTIONS = {
  unusedDependency: -2,
  todo: -0.25,
  largeFile: -3,
  extremeFile: -5,
  circularDependency: -5,
  criticalIssue: -10,
  excessiveDeps: -5,
  deepNesting: -2,
  utilExplosion: -1,
  complexFunction: -2,
  veryComplexFunction: -4,
  duplicateCode: -3,
  deadExport: -1,
  typeSafetyIssue: -2,
  criticalTypeSafety: -5,
  gitChurn: -3,
  largePRSize: -2,
  secret: -10,
  envInGit: -10,
  evalUsage: -3,
  missingTest: -0.5,
  frameworkViolation: -2,
};

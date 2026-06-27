/**
 * Exit code taxonomy for roast-my-codebase
 *
 * 0  — Success, all checks passed
 * 1  — Generic failure (threshold exceeded OR unhandled error)
 * 2  — Health threshold exceeded (--threshold flag)
 * 3  — Regression detected (--fail-on-regression)
 * 4  — Trend failure (--fail-on-trend)
 * 5  — Security critical findings present
 * 6  — License compliance violation (GPL/AGPL in deps)
 */

export const EXIT_CODES = {
  SUCCESS: 0,
  GENERIC_FAILURE: 1,
  THRESHOLD_EXCEEDED: 2,
  REGRESSION: 3,
  TREND_FAILURE: 4,
  SECURITY_CRITICAL: 5,
  LICENSE_VIOLATION: 6,
} as const;

export type ExitCode = typeof EXIT_CODES[keyof typeof EXIT_CODES];

export function getExitCode(findings: import('../types/index.js').Finding[], options: {
  thresholdExceeded?: boolean;
  regression?: boolean;
  trendFailure?: boolean;
}): ExitCode {
  // Priority order: regression > trend > threshold > security > license > success
  if (options.regression) return EXIT_CODES.REGRESSION;
  if (options.trendFailure) return EXIT_CODES.TREND_FAILURE;
  if (options.thresholdExceeded) return EXIT_CODES.THRESHOLD_EXCEEDED;

  const hasSecurityCritical = findings.some(f =>
    f.severity === 'critical' &&
    ['secrets', 'env-in-git', 'security', 'db-sql-injection', 'python-security', 'php-issues'].includes(f.category)
  );
  if (hasSecurityCritical) return EXIT_CODES.SECURITY_CRITICAL;

  const hasLicenseViolation = findings.some(f =>
    f.category === 'license-compliance' && f.severity === 'critical'
  );
  if (hasLicenseViolation) return EXIT_CODES.LICENSE_VIOLATION;

  return EXIT_CODES.SUCCESS;
}

/**
 * Auto-detect exit code based purely on findings (no threshold/regression context).
 * Used when --exit-codes is set and no other failure condition triggered.
 */
export function getAutoExitCode(findings: import('../types/index.js').Finding[]): ExitCode {
  const hasSecurityCritical = findings.some(f =>
    f.severity === 'critical' &&
    ['secrets', 'env-in-git', 'db-sql-injection', 'python-security'].includes(f.category)
  );
  if (hasSecurityCritical) return EXIT_CODES.SECURITY_CRITICAL;

  const hasLicenseViolation = findings.some(f =>
    f.category === 'license-compliance' && f.severity === 'critical'
  );
  if (hasLicenseViolation) return EXIT_CODES.LICENSE_VIOLATION;

  return EXIT_CODES.SUCCESS;
}

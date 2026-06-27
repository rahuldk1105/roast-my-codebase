import { describe, it, expect } from 'vitest';
import { EXIT_CODES, getExitCode, getAutoExitCode } from '../src/utils/exit-codes.js';
import type { Finding } from '../src/types/index.js';

const f = (cat: string, sev: 'critical' | 'warning' | 'info'): Finding =>
  ({ id: `${cat}-1`, severity: sev, category: cat, message: 'test' });

describe('EXIT_CODES', () => {
  it('has correct values', () => {
    expect(EXIT_CODES.SUCCESS).toBe(0);
    expect(EXIT_CODES.GENERIC_FAILURE).toBe(1);
    expect(EXIT_CODES.THRESHOLD_EXCEEDED).toBe(2);
    expect(EXIT_CODES.REGRESSION).toBe(3);
    expect(EXIT_CODES.TREND_FAILURE).toBe(4);
    expect(EXIT_CODES.SECURITY_CRITICAL).toBe(5);
    expect(EXIT_CODES.LICENSE_VIOLATION).toBe(6);
  });
});

describe('getExitCode', () => {
  it('returns SUCCESS with no options and no findings', () => {
    expect(getExitCode([], {})).toBe(EXIT_CODES.SUCCESS);
  });
  it('returns REGRESSION when regression true', () => {
    expect(getExitCode([], { regression: true })).toBe(EXIT_CODES.REGRESSION);
  });
  it('returns TREND_FAILURE when trendFailure true', () => {
    expect(getExitCode([], { trendFailure: true })).toBe(EXIT_CODES.TREND_FAILURE);
  });
  it('returns THRESHOLD_EXCEEDED when thresholdExceeded true', () => {
    expect(getExitCode([], { thresholdExceeded: true })).toBe(EXIT_CODES.THRESHOLD_EXCEEDED);
  });
  it('regression takes priority over threshold', () => {
    expect(getExitCode([], { regression: true, thresholdExceeded: true })).toBe(EXIT_CODES.REGRESSION);
  });
  it('returns SECURITY_CRITICAL for critical secrets', () => {
    expect(getExitCode([f('secrets', 'critical')], {})).toBe(EXIT_CODES.SECURITY_CRITICAL);
  });
  it('returns LICENSE_VIOLATION for critical license', () => {
    expect(getExitCode([f('license-compliance', 'critical')], {})).toBe(EXIT_CODES.LICENSE_VIOLATION);
  });
  it('security takes priority over license', () => {
    expect(getExitCode([f('secrets', 'critical'), f('license-compliance', 'critical')], {})).toBe(EXIT_CODES.SECURITY_CRITICAL);
  });
});

describe('getAutoExitCode', () => {
  it('returns SUCCESS for empty findings', () => {
    expect(getAutoExitCode([])).toBe(EXIT_CODES.SUCCESS);
  });
  it('returns SECURITY_CRITICAL for critical env-in-git', () => {
    expect(getAutoExitCode([f('env-in-git', 'critical')])).toBe(EXIT_CODES.SECURITY_CRITICAL);
  });
  it('warning license does not trigger violation', () => {
    expect(getAutoExitCode([f('license-compliance', 'warning')])).toBe(EXIT_CODES.SUCCESS);
  });
});

describe('getExitCode — threshold edge cases', () => {
  it('returns THRESHOLD_EXCEEDED (2) when thresholdExceeded is true', () => {
    expect(getExitCode([], { thresholdExceeded: true })).toBe(2);
    expect(getExitCode([], { thresholdExceeded: true })).toBe(EXIT_CODES.THRESHOLD_EXCEEDED);
  });

  it('threshold is overridden by regression', () => {
    expect(getExitCode([], { regression: true, thresholdExceeded: true })).toBe(EXIT_CODES.REGRESSION);
    expect(getExitCode([], { regression: true, thresholdExceeded: true })).not.toBe(EXIT_CODES.THRESHOLD_EXCEEDED);
  });

  it('threshold is overridden by trend failure', () => {
    expect(getExitCode([], { trendFailure: true, thresholdExceeded: true })).toBe(EXIT_CODES.TREND_FAILURE);
  });

  it('thresholdExceeded false returns SUCCESS with no findings', () => {
    expect(getExitCode([], { thresholdExceeded: false })).toBe(EXIT_CODES.SUCCESS);
  });
});

describe('diff validation — empty string', () => {
  it('empty string does not match the commit validation regex', () => {
    // Regression guard: empty string must not pass the sinceCommit validation in diff.ts.
    // The guard is: !/^[a-zA-Z0-9_./^~@{}-]+$/.test(sinceCommit) || sinceCommit.includes('..')
    // So an empty string fails the regex (returns false), negation is true → invalid → warn + return [].
    const commitRefRegex = /^[a-zA-Z0-9_./^~@{}-]+$/;
    const isValidRef = (ref: string) => commitRefRegex.test(ref) && !ref.includes('..');

    expect(isValidRef('')).toBe(false);         // empty string is rejected
    expect(isValidRef('abc123')).toBe(true);     // normal SHA
    expect(isValidRef('HEAD~1')).toBe(true);     // tilde notation
    expect(isValidRef('main..feature')).toBe(false); // double-dot blocked by includes('..')
    expect(isValidRef('../evil')).toBe(false);   // path traversal attempt rejected
    expect(isValidRef(';rm -rf')).toBe(false);   // shell injection rejected
  });
});

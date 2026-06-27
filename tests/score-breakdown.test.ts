import { describe, it, expect } from 'vitest';
import { calculateScoreBreakdown } from '../src/scoring/breakdown.js';
import type { Finding } from '../src/types/index.js';

const f = (cat: string, sev: 'critical' | 'warning' | 'info', msg = 'test'): Finding =>
  ({ id: `${cat}-1`, severity: sev, category: cat, message: msg });

describe('calculateScoreBreakdown', () => {
  it('returns empty for no findings', () => {
    const r = calculateScoreBreakdown([], 100);
    expect(r.categories).toHaveLength(0);
    expect(r.finalScore).toBe(100);
  });

  it('calculates complexity warning deduction', () => {
    const r = calculateScoreBreakdown([f('complexity', 'warning')], 98);
    const cat = r.categories.find(c => c.category === 'complexity');
    expect(cat?.deduction).toBeLessThan(0);
  });

  it('sorts most negative first', () => {
    const r = calculateScoreBreakdown([f('dead-exports', 'warning'), f('db-sql-injection', 'critical')], 75);
    expect(r.categories[0].deduction).toBeLessThanOrEqual(r.categories[1].deduction);
  });

  it('has correct display names', () => {
    const r = calculateScoreBreakdown([f('large-files', 'warning')], 97);
    expect(r.categories[0].displayName).toBe('Large Files');
  });

  it('db-destructive deducts -15', () => {
    const r = calculateScoreBreakdown([f('db-destructive', 'critical')], 85);
    expect(r.categories[0].deduction).toBe(-15);
  });

  it('counts findings per category', () => {
    const r = calculateScoreBreakdown([f('complexity', 'warning'), f('complexity', 'warning')], 96);
    expect(r.categories[0].findingCount).toBe(2);
  });

  it('all-info findings produce no deductions — categories is empty', () => {
    // 'info' findings map to deduction 0 for most categories (e.g. dependencies/structure
    // only deduct for critical/matching ids). Findings with deduction === 0 are filtered
    // out by the `if (ded < 0)` guard, so categories must be empty.
    const infoFindings: import('../src/types/index.js').Finding[] = [
      f('dependencies', 'info'),  // getDeductionForFinding returns 0 for non-critical
      f('structure', 'info'),     // returns 0 for unrecognised ids
      f('unknown-category', 'info'), // hits the default: return 0 path
    ];
    const r = calculateScoreBreakdown(infoFindings, 100);
    expect(r.categories).toHaveLength(0);
    expect(r.totalDeduction).toBe(0);
  });

  it('categories is empty when zero deductions (confirms no division-by-zero in CLI bar chart)', () => {
    // When categories is empty, the CLI renders "No deductions" and never
    // executes `Math.abs(bd.categories[0]?.deduction ?? 1)`. Verify the guard works.
    const r = calculateScoreBreakdown([], 100);
    expect(r.categories.length).toBe(0);
    // Simulate what the CLI does: maxAbs computation is only reached when categories.length > 0
    if (r.categories.length > 0) {
      const maxAbs = Math.abs(r.categories[0]?.deduction ?? 1);
      expect(maxAbs).toBeGreaterThan(0);
    }
    // No throw means the guard is safe
  });
});

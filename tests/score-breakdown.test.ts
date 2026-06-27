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
});

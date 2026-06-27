import { describe, it, expect } from 'vitest';
import { deduplicateFindings, countDedupedFindings } from '../src/utils/dedup.js';
import type { Finding } from '../src/types/index.js';

const f = (id: string, cat: string, file: string | undefined, msg: string, sev: 'critical' | 'warning' | 'info' = 'warning'): Finding =>
  ({ id, severity: sev, category: cat, message: msg, file });

describe('deduplicateFindings', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateFindings([])).toHaveLength(0);
  });

  it('keeps single finding unchanged', () => {
    const findings = [f('1', 'complexity', 'src/foo.ts', 'Too complex')];
    expect(deduplicateFindings(findings)).toHaveLength(1);
  });

  it('deduplicates identical findings', () => {
    const findings = [
      f('1', 'complexity', 'src/foo.ts', 'Too complex'),
      f('2', 'complexity', 'src/foo.ts', 'Too complex'),
    ];
    expect(deduplicateFindings(findings)).toHaveLength(1);
  });

  it('keeps findings with different files', () => {
    const findings = [
      f('1', 'complexity', 'src/foo.ts', 'Too complex'),
      f('2', 'complexity', 'src/bar.ts', 'Too complex'),
    ];
    expect(deduplicateFindings(findings)).toHaveLength(2);
  });

  it('keeps findings with different categories', () => {
    const findings = [
      f('1', 'complexity', 'src/foo.ts', 'Issue'),
      f('2', 'type-safety', 'src/foo.ts', 'Issue'),
    ];
    expect(deduplicateFindings(findings)).toHaveLength(2);
  });

  it('keeps findings with different severities', () => {
    const findings = [
      f('1', 'complexity', 'src/foo.ts', 'Issue', 'critical'),
      f('2', 'complexity', 'src/foo.ts', 'Issue', 'warning'),
    ];
    expect(deduplicateFindings(findings)).toHaveLength(2);
  });

  it('keeps first occurrence when deduplicating', () => {
    const findings = [
      f('first', 'complexity', 'src/foo.ts', 'Too complex'),
      f('second', 'complexity', 'src/foo.ts', 'Too complex'),
    ];
    const result = deduplicateFindings(findings);
    expect(result[0].id).toBe('first');
  });

  it('deduplicates global findings (no file)', () => {
    const findings = [
      f('1', 'circular-deps', undefined, 'Circular dependency found'),
      f('2', 'circular-deps', undefined, 'Circular dependency found'),
    ];
    expect(deduplicateFindings(findings)).toHaveLength(1);
  });

  it('keeps findings with slightly different messages past 60 chars', () => {
    const base = 'A'.repeat(60);
    const findings = [
      f('1', 'complexity', 'src/foo.ts', base + ' extra1'),
      f('2', 'complexity', 'src/foo.ts', base + ' extra2'),
    ];
    // First 60 chars are same so they deduplicate
    expect(deduplicateFindings(findings)).toHaveLength(1);
  });
});

describe('countDedupedFindings', () => {
  it('returns 0 when no deduplication', () => {
    const findings = [f('1', 'complexity', 'src/a.ts', 'msg1')];
    const deduped = deduplicateFindings(findings);
    expect(countDedupedFindings(findings, deduped)).toBe(0);
  });

  it('returns correct count when deduped', () => {
    const findings = [
      f('1', 'complexity', 'src/foo.ts', 'Too complex'),
      f('2', 'complexity', 'src/foo.ts', 'Too complex'),
      f('3', 'complexity', 'src/foo.ts', 'Too complex'),
    ];
    const deduped = deduplicateFindings(findings);
    expect(countDedupedFindings(findings, deduped)).toBe(2);
  });
});

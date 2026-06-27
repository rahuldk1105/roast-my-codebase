import { describe, it, expect } from 'vitest';
import path from 'path';

describe('--file path normalization', () => {
  it('normalizes backslashes to forward slashes', () => {
    const rel = 'src\\foo\\bar.ts'.replace(/\\/g, '/');
    expect(rel).toBe('src/foo/bar.ts');
  });

  it('filters findings by exact file match', () => {
    const findings = [
      { id: '1', severity: 'warning' as const, category: 'test', message: 'test', file: 'src/foo.ts' },
      { id: '2', severity: 'info' as const, category: 'test', message: 'test', file: 'src/bar.ts' },
    ];
    const relPath = 'src/foo.ts';
    const filtered = findings.filter(f => f.file && f.file.replace(/\\/g, '/') === relPath);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('1');
  });

  it('returns empty when no findings match', () => {
    const findings = [
      { id: '1', severity: 'warning' as const, category: 'test', message: 'test', file: 'src/other.ts' },
    ];
    const filtered = findings.filter(f => f.file && f.file === 'src/target.ts');
    expect(filtered).toHaveLength(0);
  });

  it('handles findings without file property', () => {
    const findings = [
      { id: '1', severity: 'warning' as const, category: 'test', message: 'test' },
    ];
    const filtered = findings.filter(f => f.file && f.file === 'src/foo.ts');
    expect(filtered).toHaveLength(0);
  });
});

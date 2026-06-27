import { describe, it, expect } from 'vitest';
import { parseDiffOutput, filterFindingsByDiff } from '../src/incremental/diff.js';
import type { Finding } from '../src/types/index.js';

const SAMPLE_DIFF = `diff --git a/src/foo.ts b/src/foo.ts
index abc..def 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -10,3 +10,5 @@
 existing
+new line 1
+new line 2
diff --git a/src/bar.ts b/src/bar.ts
index 111..222 100644
--- a/src/bar.ts
+++ b/src/bar.ts
@@ -5,0 +5,3 @@
+added line 1
+added line 2
+added line 3`;

const f = (file: string | undefined): Finding => ({
  id: 'test', severity: 'warning', category: 'test', message: 'test', file,
});

describe('parseDiffOutput', () => {
  it('extracts changed files', () => {
    const ranges = parseDiffOutput(SAMPLE_DIFF);
    const files = new Set(ranges.map(r => r.file));
    expect(files.has('src/foo.ts')).toBe(true);
    expect(files.has('src/bar.ts')).toBe(true);
  });

  it('extracts line ranges', () => {
    const ranges = parseDiffOutput(SAMPLE_DIFF);
    const fooRange = ranges.find(r => r.file === 'src/foo.ts');
    expect(fooRange).toBeDefined();
    expect(fooRange!.startLine).toBe(10);
  });

  it('skips deletion-only hunks (lineCount=0)', () => {
    const deletionDiff = `+++ b/src/del.ts\n@@ -5,3 +5,0 @@\n-removed`;
    const ranges = parseDiffOutput(deletionDiff);
    expect(ranges).toHaveLength(0);
  });

  it('returns empty for empty diff', () => {
    expect(parseDiffOutput('')).toHaveLength(0);
  });
});

describe('filterFindingsByDiff', () => {
  it('keeps global findings (no file)', () => {
    const ranges = [{ file: 'src/foo.ts', startLine: 1, endLine: 10 }];
    const findings = [f(undefined)];
    const result = filterFindingsByDiff(findings, ranges);
    expect(result).toHaveLength(1);
  });

  it('keeps findings for changed files', () => {
    const ranges = [{ file: 'src/foo.ts', startLine: 1, endLine: 10 }];
    const findings = [f('src/foo.ts'), f('src/bar.ts')];
    const result = filterFindingsByDiff(findings, ranges);
    expect(result).toHaveLength(1);
    expect(result[0].file).toBe('src/foo.ts');
  });

  it('returns all findings for empty ranges', () => {
    const findings = [f('src/foo.ts'), f('src/bar.ts')];
    expect(filterFindingsByDiff(findings, [])).toHaveLength(2);
  });

  it('normalizes backslashes', () => {
    const ranges = [{ file: 'src/foo.ts', startLine: 1, endLine: 10 }];
    const findings = [f('src\\foo.ts')];
    const result = filterFindingsByDiff(findings, ranges);
    expect(result).toHaveLength(1);
  });
});

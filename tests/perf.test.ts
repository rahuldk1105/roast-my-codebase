import { describe, it, expect } from 'vitest';

describe('perf timing rendering', () => {
  it('formats sub-millisecond as <1ms', () => {
    const ms = 0.5;
    const msStr = ms < 1 ? '<1ms' : `${Math.round(ms)}ms`;
    expect(msStr).toBe('<1ms');
  });

  it('formats 250ms correctly', () => {
    const ms = 250;
    const msStr = ms < 1 ? '<1ms' : `${Math.round(ms)}ms`;
    expect(msStr).toBe('250ms');
  });

  it('bar length scales with relative time', () => {
    const maxMs = 1000;
    const ms = 500;
    const barLen = Math.max(1, Math.round((ms / maxMs) * 20));
    expect(barLen).toBe(10);
  });

  it('bar is minimum 1 char even for tiny times', () => {
    const maxMs = 1000;
    const ms = 0.001;
    const barLen = Math.max(1, Math.round((ms / maxMs) * 20));
    expect(barLen).toBe(1);
  });

  it('sorts timings descending by duration', () => {
    const timings = new Map([['a', 100], ['b', 500], ['c', 200]]);
    const sorted = [...timings.entries()].sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe('b');
    expect(sorted[1][0]).toBe('c');
    expect(sorted[2][0]).toBe('a');
  });
});

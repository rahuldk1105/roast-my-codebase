import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { BundleSizeScanner, formatBytes } from '../../src/scanners/bundle.js';

describe('formatBytes', () => {
  it('formats bytes under 1024 as B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats bytes 1024+ as KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats bytes 1MB+ as MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.50 MB');
  });
});

describe('BundleSizeScanner', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns skipped when no dist/build/out directory exists', async () => {
    const scanner = new BundleSizeScanner();
    const result = await scanner.scan(tmpDir);
    expect(result.findings).toEqual([]);
    const stats = result.stats as Record<string, unknown>;
    expect(stats.skipped).toBe(true);
    expect(stats.reason).toMatch(/No build output found/);
  });

  it('finds dist/ before build/', async () => {
    // Create both dist and build
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'build'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'dist', 'index.js'), 'console.log("dist");');
    fs.writeFileSync(path.join(tmpDir, 'build', 'index.js'), 'console.log("build");');

    const scanner = new BundleSizeScanner();
    const result = await scanner.scan(tmpDir);

    const stats = result.stats as Record<string, unknown>;
    expect(String(stats.outputDir)).toContain('dist');
  });

  it('creates a cache file after first scan', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'dist', 'main.js'), 'x'.repeat(1000));

    const cachePath = path.join(tmpDir, '.roast-bundle-sizes.json');
    expect(fs.existsSync(cachePath)).toBe(false);

    const scanner = new BundleSizeScanner();
    await scanner.scan(tmpDir);

    expect(fs.existsSync(cachePath)).toBe(true);
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    expect(cache.sizes['main.js']).toBe(1000);
    expect(typeof cache.timestamp).toBe('number');
  });

  it('produces no regression findings on first run with small bundle', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'dist', 'app.js'), 'x'.repeat(500 * 1024)); // 500 KB

    const scanner = new BundleSizeScanner();
    const result = await scanner.scan(tmpDir);

    // No baseline — no regression findings (only size threshold findings possible)
    const regressions = result.findings.filter(f => f.message.includes('grew'));
    expect(regressions).toHaveLength(0);

    const stats = result.stats as Record<string, unknown>;
    expect(stats.hasBaseline).toBe(false);
  });

  it('warns when total bundle > 1MB with no baseline', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
    // Write 1.5 MB total
    fs.writeFileSync(path.join(tmpDir, 'dist', 'main.js'), 'x'.repeat(1.5 * 1024 * 1024));

    const scanner = new BundleSizeScanner();
    const result = await scanner.scan(tmpDir);

    const warnings = result.findings.filter(f => f.severity === 'warning' || f.severity === 'critical');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('detects a file that grew > 10% and > 10KB as warning', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });

    const originalSize = 100 * 1024; // 100 KB
    const newSize = 120 * 1024;      // 120 KB — 20% growth, 20 KB absolute

    // Write baseline cache manually
    const cache = {
      timestamp: Date.now() - 60000,
      sizes: { 'app.js': originalSize },
    };
    fs.writeFileSync(path.join(tmpDir, '.roast-bundle-sizes.json'), JSON.stringify(cache));

    // Write current file with new (larger) size
    fs.writeFileSync(path.join(tmpDir, 'dist', 'app.js'), 'x'.repeat(newSize));

    const scanner = new BundleSizeScanner();
    const result = await scanner.scan(tmpDir);

    const warningFindings = result.findings.filter(f => f.severity === 'warning' && f.message.includes('app.js'));
    expect(warningFindings.length).toBe(1);
    expect(warningFindings[0].message).toMatch(/app\.js grew \d+%/);
    expect(warningFindings[0].message).toContain('100.0 KB');
    expect(warningFindings[0].message).toContain('120.0 KB');
  });

  it('detects a file that grew > 50% and > 50KB as critical', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });

    const originalSize = 100 * 1024; // 100 KB
    const newSize = 200 * 1024;      // 200 KB — 100% growth, 100 KB absolute

    const cache = {
      timestamp: Date.now() - 60000,
      sizes: { 'bundle.js': originalSize },
    };
    fs.writeFileSync(path.join(tmpDir, '.roast-bundle-sizes.json'), JSON.stringify(cache));
    fs.writeFileSync(path.join(tmpDir, 'dist', 'bundle.js'), 'x'.repeat(newSize));

    const scanner = new BundleSizeScanner();
    const result = await scanner.scan(tmpDir);

    const criticalFindings = result.findings.filter(f => f.severity === 'critical' && f.message.includes('bundle.js'));
    expect(criticalFindings.length).toBe(1);
    expect(criticalFindings[0].message).toMatch(/bundle\.js grew 100%/);
  });

  it('does not flag a file that grew < 10%', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });

    const originalSize = 100 * 1024; // 100 KB
    const newSize = 105 * 1024;      // 105 KB — 5% growth

    const cache = {
      timestamp: Date.now() - 60000,
      sizes: { 'app.js': originalSize },
    };
    fs.writeFileSync(path.join(tmpDir, '.roast-bundle-sizes.json'), JSON.stringify(cache));
    fs.writeFileSync(path.join(tmpDir, 'dist', 'app.js'), 'x'.repeat(newSize));

    const scanner = new BundleSizeScanner();
    const result = await scanner.scan(tmpDir);

    const regressions = result.findings.filter(f => f.message.includes('grew') && f.message.includes('app.js'));
    expect(regressions).toHaveLength(0);
  });

  it('flags removed files as info findings', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });

    const cache = {
      timestamp: Date.now() - 60000,
      sizes: { 'old-chunk.js': 50 * 1024, 'app.js': 100 * 1024 },
    };
    fs.writeFileSync(path.join(tmpDir, '.roast-bundle-sizes.json'), JSON.stringify(cache));
    // Only write app.js, not old-chunk.js
    fs.writeFileSync(path.join(tmpDir, 'dist', 'app.js'), 'x'.repeat(100 * 1024));

    const scanner = new BundleSizeScanner();
    const result = await scanner.scan(tmpDir);

    const removed = result.findings.filter(f => f.severity === 'info' && f.message.includes('removed from bundle'));
    expect(removed.length).toBe(1);
    expect(removed[0].message).toContain('old-chunk.js');
  });

  it('flags new large files (> 100KB) as info findings', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });

    const cache = {
      timestamp: Date.now() - 60000,
      sizes: { 'app.js': 100 * 1024 },
    };
    fs.writeFileSync(path.join(tmpDir, '.roast-bundle-sizes.json'), JSON.stringify(cache));
    // Keep existing app.js and add a new large file
    fs.writeFileSync(path.join(tmpDir, 'dist', 'app.js'), 'x'.repeat(100 * 1024));
    fs.writeFileSync(path.join(tmpDir, 'dist', 'vendor.js'), 'x'.repeat(200 * 1024));

    const scanner = new BundleSizeScanner();
    const result = await scanner.scan(tmpDir);

    const newFileFindings = result.findings.filter(f => f.severity === 'info' && f.message.includes('New bundle file'));
    expect(newFileFindings.length).toBe(1);
    expect(newFileFindings[0].message).toContain('vendor.js');
  });

  it('returns correct stats', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'dist', 'a.js'), 'x'.repeat(1024));
    fs.writeFileSync(path.join(tmpDir, 'dist', 'b.css'), 'y'.repeat(512));

    const scanner = new BundleSizeScanner();
    const result = await scanner.scan(tmpDir);

    const stats = result.stats as Record<string, unknown>;
    expect(stats.fileCount).toBe(2);
    expect(stats.totalBytes).toBe(1536);
    expect(stats.totalFormatted).toBe('1.5 KB');
    expect(stats.hasBaseline).toBe(false);
  });

  it('ignores .map files', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'dist', 'app.js'), 'x'.repeat(1024));
    fs.writeFileSync(path.join(tmpDir, 'dist', 'app.js.map'), 'sourcemap'.repeat(100));

    const scanner = new BundleSizeScanner();
    const result = await scanner.scan(tmpDir);

    const stats = result.stats as Record<string, unknown>;
    expect(stats.fileCount).toBe(1); // map file excluded
  });
});

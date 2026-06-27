import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { LicenseScanner, normalizeLicense } from '../../src/scanners/license.js';

describe('LicenseScanner', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createPackageJson(deps: Record<string, string> = {}) {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', dependencies: deps }),
    );
  }

  function createDepPkg(depName: string, license: unknown) {
    const depDir = path.join(tmpDir, 'node_modules', depName);
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(
      path.join(depDir, 'package.json'),
      JSON.stringify({ name: depName, version: '1.0.0', license }),
    );
  }

  describe('prerequisites', () => {
    it('returns empty findings when package.json is missing', async () => {
      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);
      expect(result.findings).toEqual([]);
      expect(result.stats).toBeUndefined();
    });

    it('returns skipped stats when node_modules is missing', async () => {
      createPackageJson({ 'some-pkg': '^1.0.0' });
      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);
      expect(result.findings).toEqual([]);
      const stats = result.stats as { skipped: boolean; reason: string };
      expect(stats.skipped).toBe(true);
      expect(stats.reason).toMatch(/node_modules not found/);
    });

    it('returns empty findings when package.json is malformed', async () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{ not valid json');
      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);
      expect(result.findings).toEqual([]);
    });
  });

  describe('restrictive licenses (critical)', () => {
    beforeEach(() => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
    });

    it('detects GPL-3.0 as critical', async () => {
      createPackageJson({ 'gpl-lib': '^1.0.0' });
      createDepPkg('gpl-lib', 'GPL-3.0');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find(f => f.id === 'license-restrictive-gpl-lib');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('critical');
      expect(finding!.category).toBe('license-compliance');
      expect(finding!.message).toContain('gpl-lib');
      expect(finding!.message).toContain('GPL-3.0');
    });

    it('detects GPL-2.0 as critical', async () => {
      createPackageJson({ 'gpl2-lib': '^1.0.0' });
      createDepPkg('gpl2-lib', 'GPL-2.0');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find(f => f.id === 'license-restrictive-gpl2-lib');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('critical');
    });

    it('detects AGPL-3.0 as critical', async () => {
      createPackageJson({ 'agpl-lib': '^1.0.0' });
      createDepPkg('agpl-lib', 'AGPL-3.0');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find(f => f.id === 'license-restrictive-agpl-lib');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('critical');
    });

    it('includes detail field for restrictive findings', async () => {
      createPackageJson({ 'gpl-lib': '^1.0.0' });
      createDepPkg('gpl-lib', 'GPL-3.0');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find(f => f.id === 'license-restrictive-gpl-lib');
      expect(finding!.detail).toBeDefined();
      expect(finding!.detail).toContain('GPL-3.0');
    });
  });

  describe('weak copyleft licenses (warning)', () => {
    beforeEach(() => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
    });

    it('detects LGPL-2.1 as warning', async () => {
      createPackageJson({ 'lgpl-lib': '^1.0.0' });
      createDepPkg('lgpl-lib', 'LGPL-2.1');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find(f => f.id === 'license-weak-copyleft-lgpl-lib');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('warning');
      expect(finding!.category).toBe('license-compliance');
      expect(finding!.message).toContain('lgpl-lib');
      expect(finding!.message).toContain('LGPL-2.1');
    });

    it('detects MPL-2.0 as warning', async () => {
      createPackageJson({ 'mpl-lib': '^1.0.0' });
      createDepPkg('mpl-lib', 'MPL-2.0');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find(f => f.id === 'license-weak-copyleft-mpl-lib');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('warning');
    });

    it('detects EPL-2.0 as warning', async () => {
      createPackageJson({ 'epl-lib': '^1.0.0' });
      createDepPkg('epl-lib', 'EPL-2.0');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find(f => f.id === 'license-weak-copyleft-epl-lib');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('warning');
    });
  });

  describe('unknown / missing licenses (info)', () => {
    beforeEach(() => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
    });

    it('detects UNLICENSED as info', async () => {
      createPackageJson({ 'unlicensed-pkg': '^1.0.0' });
      createDepPkg('unlicensed-pkg', 'UNLICENSED');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find(f => f.id === 'license-unknown-unlicensed-pkg');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('info');
      expect(finding!.category).toBe('license-compliance');
    });

    it('detects missing license field as info', async () => {
      createPackageJson({ 'no-license-pkg': '^1.0.0' });
      const depDir = path.join(tmpDir, 'node_modules', 'no-license-pkg');
      fs.mkdirSync(depDir, { recursive: true });
      fs.writeFileSync(
        path.join(depDir, 'package.json'),
        JSON.stringify({ name: 'no-license-pkg', version: '1.0.0' }),
      );

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      const finding = result.findings.find(f => f.id === 'license-unknown-no-license-pkg');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('info');
    });
  });

  describe('permissive licenses produce no findings', () => {
    beforeEach(() => {
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
    });

    it('MIT license produces no finding', async () => {
      createPackageJson({ 'mit-pkg': '^1.0.0' });
      createDepPkg('mit-pkg', 'MIT');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      expect(result.findings).toHaveLength(0);
    });

    it('Apache-2.0 license produces no finding', async () => {
      createPackageJson({ 'apache-pkg': '^1.0.0' });
      createDepPkg('apache-pkg', 'Apache-2.0');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      expect(result.findings).toHaveLength(0);
    });

    it('ISC license produces no finding', async () => {
      createPackageJson({ 'isc-pkg': '^1.0.0' });
      createDepPkg('isc-pkg', 'ISC');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      expect(result.findings).toHaveLength(0);
    });

    it('BSD-3-Clause license produces no finding', async () => {
      createPackageJson({ 'bsd-pkg': '^1.0.0' });
      createDepPkg('bsd-pkg', 'BSD-3-Clause');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      expect(result.findings).toHaveLength(0);
    });
  });

  describe('20-finding cap', () => {
    it('caps findings at 20 and appends overflow entry', async () => {
      const deps: Record<string, string> = {};
      for (let i = 0; i < 25; i++) {
        deps[`gpl-pkg-${i}`] = '^1.0.0';
      }
      createPackageJson(deps);
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
      for (let i = 0; i < 25; i++) {
        createDepPkg(`gpl-pkg-${i}`, 'GPL-3.0');
      }

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      // 20 capped + 1 overflow entry
      expect(result.findings).toHaveLength(21);
      const overflow = result.findings.find(f => f.id === 'license-overflow');
      expect(overflow).toBeDefined();
      expect(overflow!.message).toContain('5 more license issues');
    });

    it('does not add overflow entry when findings are exactly 20', async () => {
      const deps: Record<string, string> = {};
      for (let i = 0; i < 20; i++) {
        deps[`gpl-pkg-${i}`] = '^1.0.0';
      }
      createPackageJson(deps);
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
      for (let i = 0; i < 20; i++) {
        createDepPkg(`gpl-pkg-${i}`, 'GPL-3.0');
      }

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      expect(result.findings).toHaveLength(20);
      const overflow = result.findings.find(f => f.id === 'license-overflow');
      expect(overflow).toBeUndefined();
    });
  });

  describe('stats', () => {
    it('returns scanned count and severity buckets', async () => {
      createPackageJson({
        'gpl-lib': '^1.0.0',
        'lgpl-lib': '^1.0.0',
        'mit-lib': '^1.0.0',
        'unlicensed-lib': '^1.0.0',
      });
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
      createDepPkg('gpl-lib', 'GPL-3.0');
      createDepPkg('lgpl-lib', 'LGPL-2.1');
      createDepPkg('mit-lib', 'MIT');
      createDepPkg('unlicensed-lib', 'UNLICENSED');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);
      const stats = result.stats as { scanned: number; restrictive: number; weakCopyleft: number; unknown: number };

      expect(stats.scanned).toBe(4);
      expect(stats.restrictive).toBe(1);
      expect(stats.weakCopyleft).toBe(1);
      expect(stats.unknown).toBe(1);
    });
  });

  describe('graceful handling of bad dep package.json', () => {
    it('skips deps with malformed package.json in node_modules', async () => {
      createPackageJson({ 'bad-pkg': '^1.0.0' });
      const depDir = path.join(tmpDir, 'node_modules', 'bad-pkg');
      fs.mkdirSync(depDir, { recursive: true });
      fs.writeFileSync(path.join(depDir, 'package.json'), '{ not json at all');

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      expect(result.findings).toHaveLength(0);
    });

    it('skips deps whose package.json does not exist in node_modules', async () => {
      createPackageJson({ 'ghost-pkg': '^1.0.0' });
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
      // no ghost-pkg directory

      const scanner = new LicenseScanner();
      const result = await scanner.scan(tmpDir);

      expect(result.findings).toHaveLength(0);
    });
  });
});

describe('LicenseScanner — edge cases', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'license-edge-test-'));
    fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createPackageJson(deps: Record<string, string> = {}) {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', dependencies: deps }),
    );
  }

  function createDepPkg(depName: string, license: unknown) {
    // Support scoped packages like @org/pkg
    const depDir = path.join(tmpDir, 'node_modules', depName);
    fs.mkdirSync(depDir, { recursive: true });
    fs.writeFileSync(
      path.join(depDir, 'package.json'),
      JSON.stringify({ name: depName, version: '1.0.0', license }),
    );
  }

  it('treats license: null in package.json as UNKNOWN (info finding)', async () => {
    createPackageJson({ 'null-license': '^1.0.0' });
    createDepPkg('null-license', null);

    const scanner = new LicenseScanner();
    const result = await scanner.scan(tmpDir);

    const finding = result.findings.find((f) => f.id === 'license-unknown-null-license');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('info');
  });

  it('detects GPL component in "GPL-2.0-OR-LATER OR MIT" SPDX expression', async () => {
    createPackageJson({ 'dual-pkg': '^1.0.0' });
    createDepPkg('dual-pkg', 'GPL-2.0-OR-LATER OR MIT');

    const scanner = new LicenseScanner();
    const result = await scanner.scan(tmpDir);

    const finding = result.findings.find((f) => f.id === 'license-restrictive-dual-pkg');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('handles scoped packages (@org/pkg) path construction correctly', async () => {
    createPackageJson({ '@org/gpl-pkg': '^1.0.0' });
    // createDepPkg handles @org/pkg because path.join handles the slash
    createDepPkg('@org/gpl-pkg', 'GPL-3.0');

    const scanner = new LicenseScanner();
    const result = await scanner.scan(tmpDir);

    const finding = result.findings.find((f) => f.id === 'license-restrictive-@org/gpl-pkg');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('critical');
  });

  it('detects UNLICENSED (all caps) as unknown info finding', async () => {
    createPackageJson({ 'unlicensed-caps': '^1.0.0' });
    createDepPkg('unlicensed-caps', 'UNLICENSED');

    const scanner = new LicenseScanner();
    const result = await scanner.scan(tmpDir);

    const finding = result.findings.find((f) => f.id === 'license-unknown-unlicensed-caps');
    expect(finding).toBeDefined();
    expect(finding!.severity).toBe('info');
  });

  it('overflow message shows correct remaining count when 25 restrictive licenses exist', async () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 25; i++) {
      deps[`gpl-edge-${i}`] = '^1.0.0';
    }
    createPackageJson(deps);
    for (let i = 0; i < 25; i++) {
      createDepPkg(`gpl-edge-${i}`, 'GPL-3.0');
    }

    const scanner = new LicenseScanner();
    const result = await scanner.scan(tmpDir);

    expect(result.findings).toHaveLength(21); // 20 capped + 1 overflow
    const overflow = result.findings.find((f) => f.id === 'license-overflow');
    expect(overflow).toBeDefined();
    expect(overflow!.message).toContain('5 more license issues');
  });
});

describe('normalizeLicense', () => {
  it('handles a plain string', () => {
    expect(normalizeLicense('MIT')).toBe('MIT');
    expect(normalizeLicense('gpl-3.0')).toBe('GPL-3.0');
    expect(normalizeLicense(' Apache-2.0 ')).toBe('APACHE-2.0');
  });

  it('handles object with type field', () => {
    expect(normalizeLicense({ type: 'MIT' })).toBe('MIT');
  });

  it('handles object with name field', () => {
    expect(normalizeLicense({ name: 'ISC' })).toBe('ISC');
  });

  it('handles array of license objects', () => {
    const result = normalizeLicense([{ type: 'MIT' }, { type: 'Apache-2.0' }]);
    expect(result).toBe('MIT OR APACHE-2.0');
  });

  it('handles null/undefined as UNKNOWN', () => {
    expect(normalizeLicense(null)).toBe('UNKNOWN');
    expect(normalizeLicense(undefined)).toBe('UNKNOWN');
    expect(normalizeLicense('')).toBe('UNKNOWN');
  });

  it('handles empty object as UNKNOWN', () => {
    expect(normalizeLicense({})).toBe('UNKNOWN');
  });

  it('collapses whitespace in license strings', () => {
    expect(normalizeLicense('MIT  License')).toBe('MIT-LICENSE');
  });
});

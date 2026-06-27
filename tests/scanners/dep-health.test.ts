import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { DepHealthScanner } from '../../src/scanners/dep-health.js';

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from 'child_process';
const mockSpawnSync = vi.mocked(spawnSync);

describe('DepHealthScanner', () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-health-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('prerequisites', () => {
    it('returns empty findings when package.json is missing', async () => {
      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);
      expect(result.findings).toEqual([]);
      expect(result.stats).toBeUndefined();
    });

    it('returns skipped stats when node_modules is missing', async () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);
      expect(result.findings).toEqual([]);
      const stats = result.stats as { skipped: boolean; reason: string };
      expect(stats.skipped).toBe(true);
      expect(stats.reason).toMatch(/node_modules not found/);
    });
  });

  describe('npm audit parsing', () => {
    beforeEach(() => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
    });

    it('maps critical vulnerability to critical finding', async () => {
      const auditOutput = JSON.stringify({
        vulnerabilities: {
          'evil-package': {
            name: 'evil-package',
            severity: 'critical',
            via: [],
            fixAvailable: true,
          },
        },
        metadata: { vulnerabilities: { critical: 1, high: 0, moderate: 0, low: 0, total: 1 } },
      });

      mockSpawnSync
        .mockReturnValueOnce({ stdout: auditOutput, stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const auditFindings = result.findings.filter(f => f.category === 'npm-audit');
      expect(auditFindings).toHaveLength(1);
      expect(auditFindings[0].severity).toBe('critical');
      expect(auditFindings[0].id).toBe('audit-evil-package');
      expect(auditFindings[0].message).toContain('critical');
      expect(auditFindings[0].message).toContain('fix available');
    });

    it('maps high vulnerability to critical finding', async () => {
      const auditOutput = JSON.stringify({
        vulnerabilities: {
          'risky-lib': {
            name: 'risky-lib',
            severity: 'high',
            via: [],
            fixAvailable: false,
          },
        },
        metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0, total: 1 } },
      });

      mockSpawnSync
        .mockReturnValueOnce({ stdout: auditOutput, stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const auditFindings = result.findings.filter(f => f.category === 'npm-audit');
      expect(auditFindings[0].severity).toBe('critical');
      expect(auditFindings[0].message).toContain('no fix yet');
    });

    it('maps moderate vulnerability to warning finding', async () => {
      const auditOutput = JSON.stringify({
        vulnerabilities: {
          'moderate-pkg': {
            name: 'moderate-pkg',
            severity: 'moderate',
            via: [],
            fixAvailable: { name: 'moderate-pkg', version: '2.0.0' },
          },
        },
        metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 1, low: 0, total: 1 } },
      });

      mockSpawnSync
        .mockReturnValueOnce({ stdout: auditOutput, stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const auditFindings = result.findings.filter(f => f.category === 'npm-audit');
      expect(auditFindings[0].severity).toBe('warning');
    });

    it('maps low/info vulnerability to info finding', async () => {
      const auditOutput = JSON.stringify({
        vulnerabilities: {
          'low-risk': {
            name: 'low-risk',
            severity: 'low',
            via: [],
            fixAvailable: false,
          },
        },
        metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 1, total: 1 } },
      });

      mockSpawnSync
        .mockReturnValueOnce({ stdout: auditOutput, stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const auditFindings = result.findings.filter(f => f.category === 'npm-audit');
      expect(auditFindings[0].severity).toBe('info');
    });

    it('caps audit findings at 20', async () => {
      const vulns: Record<string, unknown> = {};
      for (let i = 0; i < 25; i++) {
        vulns[`pkg-${i}`] = { name: `pkg-${i}`, severity: 'high', via: [], fixAvailable: false };
      }
      const auditOutput = JSON.stringify({
        vulnerabilities: vulns,
        metadata: { vulnerabilities: { critical: 0, high: 25, moderate: 0, low: 0, total: 25 } },
      });

      mockSpawnSync
        .mockReturnValueOnce({ stdout: auditOutput, stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const auditFindings = result.findings.filter(f => f.category === 'npm-audit');
      expect(auditFindings.length).toBe(20);
    });

    it('handles malformed audit JSON gracefully with info finding', async () => {
      mockSpawnSync
        .mockReturnValueOnce({ stdout: 'not valid json {{', stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const auditFindings = result.findings.filter(f => f.category === 'npm-audit');
      expect(auditFindings).toHaveLength(1);
      expect(auditFindings[0].severity).toBe('info');
      expect(auditFindings[0].message).toMatch(/npm audit failed/);
    });

    it('handles empty audit output gracefully with info finding', async () => {
      mockSpawnSync
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const auditFindings = result.findings.filter(f => f.category === 'npm-audit');
      expect(auditFindings).toHaveLength(1);
      expect(auditFindings[0].message).toMatch(/npm audit failed/);
    });

    it('returns zero audit findings when no vulnerabilities', async () => {
      const auditOutput = JSON.stringify({
        vulnerabilities: {},
        metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 } },
      });

      mockSpawnSync
        .mockReturnValueOnce({ stdout: auditOutput, stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const auditFindings = result.findings.filter(f => f.category === 'npm-audit');
      expect(auditFindings).toHaveLength(0);
    });
  });

  describe('npm outdated parsing', () => {
    beforeEach(() => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
    });

    it('flags package with major version behind as warning', async () => {
      const outdatedOutput = JSON.stringify({
        'old-package': {
          current: '1.5.0',
          wanted: '1.9.0',
          latest: '3.0.0',
          location: 'node_modules/old-package',
        },
      });

      mockSpawnSync
        .mockReturnValueOnce({ stdout: JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } }), stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: outdatedOutput, stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const outdatedFindings = result.findings.filter(f => f.category === 'dep-outdated');
      expect(outdatedFindings).toHaveLength(1);
      expect(outdatedFindings[0].severity).toBe('warning');
      expect(outdatedFindings[0].id).toBe('outdated-old-package');
      expect(outdatedFindings[0].message).toContain('breaking changes likely');
    });

    it('flags package with minor/patch behind as info', async () => {
      const outdatedOutput = JSON.stringify({
        'minor-pkg': {
          current: '2.1.0',
          wanted: '2.1.5',
          latest: '2.3.0',
          location: 'node_modules/minor-pkg',
        },
      });

      mockSpawnSync
        .mockReturnValueOnce({ stdout: JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } }), stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: outdatedOutput, stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const outdatedFindings = result.findings.filter(f => f.category === 'dep-outdated');
      expect(outdatedFindings).toHaveLength(1);
      expect(outdatedFindings[0].severity).toBe('info');
      expect(outdatedFindings[0].message).toContain('2.1.0');
      expect(outdatedFindings[0].message).toContain('2.3.0');
    });

    it('caps outdated findings at 15 and adds overflow summary', async () => {
      const pkgs: Record<string, unknown> = {};
      for (let i = 0; i < 18; i++) {
        pkgs[`pkg-${i}`] = {
          current: `1.0.${i}`,
          wanted: `1.0.${i}`,
          latest: `2.0.0`,
          location: `node_modules/pkg-${i}`,
        };
      }

      mockSpawnSync
        .mockReturnValueOnce({ stdout: JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } }), stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: JSON.stringify(pkgs), stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const outdatedFindings = result.findings.filter(f => f.category === 'dep-outdated');
      // 15 individual + 1 overflow summary
      expect(outdatedFindings).toHaveLength(16);
      const overflow = outdatedFindings.find(f => f.id === 'outdated-overflow');
      expect(overflow).toBeDefined();
      expect(overflow?.message).toContain('3 more outdated packages');
    });

    it('produces no outdated findings when output is empty string', async () => {
      mockSpawnSync
        .mockReturnValueOnce({ stdout: JSON.stringify({ vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } }), stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: '', stderr: '', status: 0, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);

      const outdatedFindings = result.findings.filter(f => f.category === 'dep-outdated');
      expect(outdatedFindings).toHaveLength(0);
    });
  });

  describe('stats', () => {
    it('returns auditVulnerabilities and outdatedPackages in stats', async () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
      fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });

      const auditOutput = JSON.stringify({
        vulnerabilities: {
          'pkg-a': { name: 'pkg-a', severity: 'high', via: [], fixAvailable: false },
          'pkg-b': { name: 'pkg-b', severity: 'moderate', via: [], fixAvailable: true },
        },
        metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 1, low: 0, total: 2 } },
      });
      const outdatedOutput = JSON.stringify({
        'outdated-a': { current: '1.0.0', wanted: '1.0.0', latest: '2.0.0', location: '' },
      });

      mockSpawnSync
        .mockReturnValueOnce({ stdout: auditOutput, stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>)
        .mockReturnValueOnce({ stdout: outdatedOutput, stderr: '', status: 1, pid: 1, output: [], signal: null, error: undefined } as ReturnType<typeof spawnSync>);

      const scanner = new DepHealthScanner();
      const result = await scanner.scan(tmpDir);
      const stats = result.stats as { auditVulnerabilities: number; outdatedPackages: number };

      expect(stats.auditVulnerabilities).toBe(2);
      expect(stats.outdatedPackages).toBe(1);
    });
  });
});

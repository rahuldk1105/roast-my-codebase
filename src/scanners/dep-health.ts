import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Scanner, ScanResult, Finding } from '../types/index.js';

interface AuditVulnerability {
  name: string;
  severity: string;
  via: unknown[];
  fixAvailable: boolean | { name: string; version: string };
}

interface AuditOutput {
  vulnerabilities?: Record<string, AuditVulnerability>;
  metadata?: {
    vulnerabilities?: {
      critical?: number;
      high?: number;
      moderate?: number;
      low?: number;
      total?: number;
    };
  };
}

interface OutdatedEntry {
  current: string;
  wanted: string;
  latest: string;
  location?: string;
}

function getMajorVersion(version: string): number {
  const match = version.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

export class DepHealthScanner implements Scanner {
  name = 'dep-health';

  async scan(rootDir: string): Promise<ScanResult> {
    // Step 0: Check prerequisites
    if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
      return { findings: [] };
    }

    if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
      return {
        findings: [],
        stats: {
          skipped: true,
          reason: 'node_modules not found — run npm install first',
        },
      };
    }

    const auditFindings: Finding[] = [];
    const outdatedFindings: Finding[] = [];

    // Step 1: npm audit
    try {
      const auditResult = spawnSync('npm', ['audit', '--json'], {
        cwd: rootDir,
        encoding: 'utf-8',
        timeout: 30000,
      });

      const auditOutput = auditResult.stdout || '';

      if (auditOutput) {
        let auditData: AuditOutput;
        try {
          auditData = JSON.parse(auditOutput) as AuditOutput;
        } catch {
          auditFindings.push({
            id: 'audit-parse-error',
            severity: 'info',
            category: 'npm-audit',
            message: 'npm audit failed — run manually to check vulnerabilities',
          });
          auditData = {};
        }

        if (auditData.vulnerabilities) {
          const entries = Object.entries(auditData.vulnerabilities);
          const capped = entries.slice(0, 20);

          for (const [packageName, vuln] of capped) {
            const rawSeverity = vuln.severity?.toLowerCase() ?? 'info';
            let severity: Finding['severity'];
            if (rawSeverity === 'critical' || rawSeverity === 'high') {
              severity = 'critical';
            } else if (rawSeverity === 'moderate') {
              severity = 'warning';
            } else {
              severity = 'info';
            }

            const fixAvailable = vuln.fixAvailable !== false && vuln.fixAvailable !== undefined;
            auditFindings.push({
              id: `audit-${packageName}`,
              severity,
              category: 'npm-audit',
              message: `${packageName} has a ${rawSeverity} vulnerability${fixAvailable ? ' (fix available)' : ' (no fix yet)'}`,
            });
          }
        }
      } else {
        // Command produced no output at all — complete failure
        auditFindings.push({
          id: 'audit-failed',
          severity: 'info',
          category: 'npm-audit',
          message: 'npm audit failed — run manually to check vulnerabilities',
        });
      }
    } catch {
      auditFindings.push({
        id: 'audit-failed',
        severity: 'info',
        category: 'npm-audit',
        message: 'npm audit failed — run manually to check vulnerabilities',
      });
    }

    // Step 2: npm outdated
    try {
      const outdatedResult = spawnSync('npm', ['outdated', '--json'], {
        cwd: rootDir,
        encoding: 'utf-8',
        timeout: 30000,
      });

      // npm outdated exits 1 when there ARE outdated packages — that is normal
      const outdatedOutput = outdatedResult.stdout || '';

      if (outdatedOutput && outdatedOutput.trim() !== '') {
        let outdatedData: Record<string, OutdatedEntry>;
        try {
          outdatedData = JSON.parse(outdatedOutput) as Record<string, OutdatedEntry>;
        } catch {
          // Malformed JSON — skip silently
          outdatedData = {};
        }

        const entries = Object.entries(outdatedData);
        const total = entries.length;
        const capped = entries.slice(0, 15);

        for (const [name, info] of capped) {
          const currentMajor = getMajorVersion(info.current);
          const latestMajor = getMajorVersion(info.latest);

          if (currentMajor < latestMajor) {
            outdatedFindings.push({
              id: `outdated-${name}`,
              severity: 'warning',
              category: 'dep-outdated',
              message: `${name} is ${info.current} — major version ${info.latest} available (breaking changes likely)`,
            });
          } else {
            outdatedFindings.push({
              id: `outdated-${name}`,
              severity: 'info',
              category: 'dep-outdated',
              message: `${name} is ${info.current} — ${info.latest} available`,
            });
          }
        }

        if (total > 15) {
          outdatedFindings.push({
            id: 'outdated-overflow',
            severity: 'info',
            category: 'dep-outdated',
            message: `...and ${total - 15} more outdated packages`,
          });
        }
      }
    } catch {
      // npm outdated failure is non-fatal — skip silently
    }

    // Step 3: return
    const findings = [...auditFindings, ...outdatedFindings];
    return {
      findings,
      stats: {
        auditVulnerabilities: auditFindings.length,
        outdatedPackages: outdatedFindings.length,
      },
    };
  }
}

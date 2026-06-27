import fs from 'fs';
import path from 'path';
import { Scanner, ScanResult, Finding } from '../types/index.js';

const RESTRICTIVE_LICENSES = new Set([
  'GPL-2.0', 'GPL-2.0-ONLY', 'GPL-2.0-OR-LATER', 'GPL-2.0+',
  'GPL-3.0', 'GPL-3.0-ONLY', 'GPL-3.0-OR-LATER', 'GPL-3.0+',
  'AGPL-1.0', 'AGPL-3.0', 'AGPL-3.0-ONLY', 'AGPL-3.0-OR-LATER',
  'EUPL-1.1', 'EUPL-1.2',
  'CDDL-1.0', 'CDDL-1.1',
  'OSL-3.0',
  'SSPL-1.0',
]);

const WEAK_COPYLEFT_LICENSES = new Set([
  'LGPL-2.0', 'LGPL-2.0-ONLY', 'LGPL-2.0-OR-LATER',
  'LGPL-2.1', 'LGPL-2.1-ONLY', 'LGPL-2.1-OR-LATER',
  'LGPL-3.0', 'LGPL-3.0-ONLY', 'LGPL-3.0-OR-LATER',
  'MPL-1.1', 'MPL-2.0',
  'EPL-1.0', 'EPL-2.0',
  'CPOL-1.02',
]);

const UNKNOWN_LICENSE_KEYWORDS = ['UNLICENSED', 'SEE LICENSE IN', 'CUSTOM'];

export class LicenseScanner implements Scanner {
  name = 'license';

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];
    const pkgPath = path.join(rootDir, 'package.json');

    if (!fs.existsSync(pkgPath)) return { findings };

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    } catch { return { findings }; }

    const deps = {
      ...((pkg.dependencies as Record<string, string>) || {}),
      ...((pkg.devDependencies as Record<string, string>) || {}),
    };

    const nodeModulesPath = path.join(rootDir, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      return { findings, stats: { skipped: true, reason: 'node_modules not found' } };
    }

    const results: Array<{ name: string; license: string; source: 'local' }> = [];

    // Read license from local node_modules/pkg/package.json
    for (const depName of Object.keys(deps)) {
      const depPkgPath = path.join(nodeModulesPath, depName, 'package.json');
      if (!fs.existsSync(depPkgPath)) continue;

      try {
        const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf-8'));
        const license = normalizeLicense(depPkg.license || depPkg.licenses);
        results.push({ name: depName, license, source: 'local' });
      } catch { continue; }
    }

    // Analyze findings
    for (const { name, license } of results) {
      if (isRestrictive(license)) {
        findings.push({
          id: `license-restrictive-${name}`,
          severity: 'critical',
          category: 'license-compliance',
          message: `${name} uses ${license} — copyleft license may require open-sourcing your code`,
          detail: `License: ${license}. Consult legal before using in commercial projects.`,
        });
      } else if (isWeakCopyleft(license)) {
        findings.push({
          id: `license-weak-copyleft-${name}`,
          severity: 'warning',
          category: 'license-compliance',
          message: `${name} uses ${license} — weak copyleft, verify compatibility`,
          detail: `License: ${license}. Usually safe for commercial use with attribution.`,
        });
      } else if (isUnknown(license)) {
        findings.push({
          id: `license-unknown-${name}`,
          severity: 'info',
          category: 'license-compliance',
          message: `${name} has no clear license (${license || 'none'}) — verify before use`,
        });
      }
    }

    // Cap at 20 findings total
    const cappedFindings = findings.slice(0, 20);
    if (findings.length > 20) {
      cappedFindings.push({
        id: 'license-overflow',
        severity: 'info',
        category: 'license-compliance',
        message: `...and ${findings.length - 20} more license issues`,
      });
    }

    return {
      findings: cappedFindings,
      stats: {
        scanned: results.length,
        restrictive: findings.filter(f => f.severity === 'critical').length,
        weakCopyleft: findings.filter(f => f.severity === 'warning').length,
        unknown: findings.filter(f => f.severity === 'info').length,
      },
    };
  }
}

export function normalizeLicense(raw: unknown): string {
  if (!raw) return 'UNKNOWN';
  if (typeof raw === 'string') {
    // Split on SPDX OR/AND operators first, normalize each identifier token
    // (uppercase + collapse spaces to dashes), then rejoin with the operator.
    // E.g. "GPL-2.0-or-later OR MIT" → "GPL-2.0-OR-LATER OR MIT"
    // so that isRestrictive() can split on the preserved OR keyword.
    const upper = raw.trim().toUpperCase();
    // Split captures the operator keywords (OR/AND) as alternating elements
    const parts = upper.split(/\s+(OR|AND)\s+/);
    // parts = ['GPL-2.0-OR-LATER', 'OR', 'MIT'] for the example above
    return parts
      .map((part, idx) => {
        if (idx % 2 === 1) {
          // This is an operator captured by the split regex — keep as-is
          return part;
        }
        // Identifier token — collapse remaining spaces to dashes
        return part.replace(/\s+/g, '-');
      })
      .join(' ');
  }
  // Handle { type: 'MIT' } or array [{ type: 'MIT' }]
  if (Array.isArray(raw)) return raw.map(l => normalizeLicense(l)).join(' OR ');
  if (typeof raw === 'object' && raw !== null) {
    const r = raw as Record<string, unknown>;
    return normalizeLicense(r.type || r.name || 'UNKNOWN');
  }
  return 'UNKNOWN';
}

function isRestrictive(license: string): boolean {
  // Check each part of SPDX expressions like "GPL-2.0 OR MIT"
  const parts = license.split(/\s+(?:OR|AND)\s+/i);
  return parts.some(p => RESTRICTIVE_LICENSES.has(p.trim().replace(/[()]/g, '')));
}

function isWeakCopyleft(license: string): boolean {
  const parts = license.split(/\s+(?:OR|AND)\s+/i);
  return !isRestrictive(license) &&
    parts.some(p => WEAK_COPYLEFT_LICENSES.has(p.trim().replace(/[()]/g, '')));
}

function isUnknown(license: string): boolean {
  return !license || license === 'UNKNOWN' ||
    UNKNOWN_LICENSE_KEYWORDS.some(k => license.includes(k));
}

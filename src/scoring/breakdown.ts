import { Finding } from '../types/index.js';
import { HEALTH_DEDUCTIONS } from '../utils/constants.js';

export interface CategoryScore {
  category: string;
  deduction: number;
  findingCount: number;
  displayName: string;
}

export interface ScoreBreakdown {
  categories: CategoryScore[];
  totalDeduction: number;
  baseScore: number;
  finalScore: number;
}

const DISPLAY_NAMES: Record<string, string> = {
  'large-files': 'Large Files', 'complexity': 'Complexity',
  'circular-deps': 'Circular Deps', 'unused-deps': 'Unused Deps',
  'dependencies': 'Dependencies', 'structure': 'Structure',
  'duplicates': 'Duplicates', 'dead-exports': 'Dead Exports',
  'type-safety': 'Type Safety', 'todos': 'TODOs',
  'test-coverage': 'Test Coverage', 'test-quality': 'Test Quality',
  'security': 'Security', 'secrets': 'Secrets',
  'env-in-git': 'Env In Git', 'eval-usage': 'Eval Usage',
  'git-churn': 'Git Churn', 'pr-size': 'PR Size',
  'npm-audit': 'Vulnerabilities', 'dep-outdated': 'Outdated Deps',
  'license-compliance': 'License', 'config-audit': 'Config',
  'bundle-size': 'Bundle Size', 'db-n-plus-one': 'DB N+1',
  'db-sql-injection': 'DB Security', 'db-over-fetch': 'DB Queries',
  'db-destructive': 'DB Danger', 'nextjs-metadata': 'Next.js',
  'nextjs-client-server': 'Next.js', 'react-error-boundary': 'React',
  'vue-issues': 'Vue', 'angular-issues': 'Angular',
  'express-issues': 'Express', 'ruby-style': 'Ruby',
  'php-smell': 'PHP', 'kotlin-coroutine': 'Kotlin',
  'swift-async': 'Swift', 'custom-rule': 'Custom Rules',
};

function getDeductionForFinding(finding: Finding): number {
  switch (finding.category) {
    case 'large-files':
      return finding.severity === 'critical' ? HEALTH_DEDUCTIONS.extremeFile : HEALTH_DEDUCTIONS.largeFile;
    case 'todos': {
      const match = finding.message.match(/Found (\d+)/);
      return HEALTH_DEDUCTIONS.todo * (match ? parseInt(match[1], 10) : 1);
    }
    case 'circular-deps': return HEALTH_DEDUCTIONS.circularDependency;
    case 'unused-deps': return HEALTH_DEDUCTIONS.unusedDependency;
    case 'dependencies': return finding.severity === 'critical' ? HEALTH_DEDUCTIONS.excessiveDeps : 0;
    case 'structure':
      if (finding.id === 'deep-nesting') return HEALTH_DEDUCTIONS.deepNesting;
      if (finding.id === 'util-explosion') return HEALTH_DEDUCTIONS.utilExplosion;
      return 0;
    case 'complexity':
      return finding.severity === 'critical' ? HEALTH_DEDUCTIONS.veryComplexFunction : HEALTH_DEDUCTIONS.complexFunction;
    case 'duplicates': return HEALTH_DEDUCTIONS.duplicateCode;
    case 'dead-exports': return HEALTH_DEDUCTIONS.deadExport;
    case 'type-safety':
      return finding.severity === 'critical' ? HEALTH_DEDUCTIONS.criticalTypeSafety : HEALTH_DEDUCTIONS.typeSafetyIssue;
    case 'git-churn': return HEALTH_DEDUCTIONS.gitChurn;
    case 'pr-size': return HEALTH_DEDUCTIONS.largePRSize;
    case 'secrets': case 'env-in-git': return HEALTH_DEDUCTIONS.secret;
    case 'eval-usage': return HEALTH_DEDUCTIONS.evalUsage;
    case 'test-coverage': return HEALTH_DEDUCTIONS.missingTest;
    case 'npm-audit':
      return finding.severity === 'critical' ? -8 : finding.severity === 'warning' ? -3 : -1;
    case 'dep-outdated': return finding.severity === 'warning' ? -2 : -0.5;
    case 'license-compliance':
      return finding.severity === 'critical' ? -8 : finding.severity === 'warning' ? -3 : -0.5;
    case 'test-quality':
      return finding.severity === 'critical' ? -5 : finding.severity === 'warning' ? -2 : -0.5;
    case 'config-audit': return finding.severity === 'warning' ? -3 : -1;
    case 'bundle-size': return finding.severity === 'critical' ? -5 : -3;
    case 'db-n-plus-one': return finding.severity === 'warning' ? -4 : -1;
    case 'db-sql-injection': return finding.severity === 'critical' ? -10 : -5;
    case 'db-over-fetch': return -1;
    case 'db-destructive': return -15;
    case 'db-missing-transaction': case 'db-typeorm-pattern': case 'db-missing-index':
    case 'db-mongo-pattern': case 'db-schema-quality': return -2;
    case 'nextjs-metadata': case 'nextjs-client-server': case 'react-error-boundary':
    case 'vue-issues': case 'angular-issues': case 'svelte-issues': case 'express-issues':
    case 'fastapi-issues': case 'ruby-style': case 'php-smell': case 'swift-async':
    case 'kotlin-coroutine': return HEALTH_DEDUCTIONS.frameworkViolation;
    default:
      if (finding.id.startsWith('custom-')) {
        return finding.severity === 'critical' ? -10 : finding.severity === 'warning' ? -2 : -0.5;
      }
      return 0;
  }
}

export function calculateScoreBreakdown(findings: Finding[], finalScore: number): ScoreBreakdown {
  const deductions = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const finding of findings) {
    const d = getDeductionForFinding(finding);
    deductions.set(finding.category, (deductions.get(finding.category) || 0) + d);
    counts.set(finding.category, (counts.get(finding.category) || 0) + 1);
  }

  const categories: CategoryScore[] = [];
  for (const [cat, ded] of deductions.entries()) {
    if (ded < 0) {
      categories.push({
        category: cat,
        deduction: Math.round(ded * 10) / 10,
        findingCount: counts.get(cat) || 0,
        displayName: DISPLAY_NAMES[cat] || cat,
      });
    }
  }
  categories.sort((a, b) => a.deduction - b.deduction);

  const totalDeduction = Math.round(categories.reduce((s, c) => s + c.deduction, 0) * 10) / 10;

  return { categories, totalDeduction, baseScore: 100, finalScore };
}

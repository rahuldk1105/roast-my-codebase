import { Finding } from '../types/index.js';

/**
 * Deduplicates findings by merging near-identical ones.
 *
 * Two findings are considered duplicates if they share:
 * - Same category
 * - Same file (or both have no file)
 * - Same severity
 * - Similar message (first 60 chars match)
 *
 * When duplicates are found, keep the first one and discard the rest.
 * Exception: findings with different IDs and clearly different messages are kept separate.
 */
export function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();
  const result: Finding[] = [];

  for (const finding of findings) {
    const key = buildDedupeKey(finding);

    if (!seen.has(key)) {
      seen.set(key, finding);
      result.push(finding);
    }
    // If duplicate key exists, skip this finding (it's a near-duplicate)
  }

  return result;
}

/**
 * Build a deduplication key for a finding.
 * Two findings with the same key are considered near-duplicates.
 */
function buildDedupeKey(finding: Finding): string {
  const file = finding.file || '__global__';
  const msgPrefix = finding.message.slice(0, 60).toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${finding.category}::${file}::${finding.severity}::${msgPrefix}`;
}

/**
 * Count how many findings were deduped
 */
export function countDedupedFindings(original: Finding[], deduped: Finding[]): number {
  return original.length - deduped.length;
}

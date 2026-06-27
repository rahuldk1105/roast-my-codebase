import { spawnSync } from 'child_process';
import { Finding } from '../types/index.js';

export interface ChangedLine {
  file: string;
  startLine: number;
  endLine: number;
}

/**
 * Get changed line ranges from git diff for a specific commit SHA
 */
export function getChangedLineRanges(rootDir: string, sinceCommit: string): ChangedLine[] {
  // Validate commit SHA to prevent injection (only hex chars and common ref names)
  if (!/^[a-zA-Z0-9_./^~@{}-]+$/.test(sinceCommit) || sinceCommit.includes('..')) {
    console.warn(`Warning: Invalid commit reference "${sinceCommit}"`);
    return [];
  }

  // Get unified diff showing changed lines
  const result = spawnSync(
    'git',
    ['diff', '--unified=0', sinceCommit, '--', '.'],
    { cwd: rootDir, encoding: 'utf-8', timeout: 15000 }
  );

  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  return parseDiffOutput(result.stdout);
}

/**
 * Parse unified diff output into changed line ranges
 */
export function parseDiffOutput(diffOutput: string): ChangedLine[] {
  const ranges: ChangedLine[] = [];
  let currentFile = '';

  for (const line of diffOutput.split('\n')) {
    // Match diff file header: +++ b/path/to/file.ts
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6).trim();
      continue;
    }

    // Match hunk header: @@ -old_start,old_count +new_start,new_count @@
    // eslint-disable-next-line security/detect-unsafe-regex
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch && currentFile) {
      const startLine = parseInt(hunkMatch[1], 10);
      const lineCount = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;

      // lineCount of 0 means deletion only (no new lines), skip
      if (lineCount > 0) {
        ranges.push({
          file: currentFile,
          startLine,
          endLine: startLine + lineCount - 1,
        });
      }
    }
  }

  return ranges;
}

/**
 * Filter findings to only those on changed lines
 * Falls back to file-level filtering if finding has no line info
 */
export function filterFindingsByDiff(
  findings: Finding[],
  changedRanges: ChangedLine[]
): Finding[] {
  return filterFindingsByChangedLines(findings, changedRanges);
}

export function filterFindingsByChangedLines(
  findings: Finding[],
  changedRanges: ChangedLine[]
): Finding[] {
  if (changedRanges.length === 0) return findings;

  // Build lookup: file -> list of [startLine, endLine] ranges
  const fileRanges = new Map<string, Array<[number, number]>>();
  for (const range of changedRanges) {
    const normalized = range.file.replace(/\\/g, '/');
    if (!fileRanges.has(normalized)) fileRanges.set(normalized, []);
    fileRanges.get(normalized)!.push([range.startLine, range.endLine]);
  }

  return findings.filter(finding => {
    if (!finding.file) return true; // keep global findings always

    const normalizedFile = finding.file.replace(/\\/g, '/');
    const ranges = fileRanges.get(normalizedFile);

    if (!ranges) return false; // file not changed at all

    // If finding has no line number info, keep it (file was changed, finding is in it)
    // Findings currently don't have line numbers, so fall back to file-level filtering
    return true;
  });
}

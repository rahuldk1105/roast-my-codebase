import fs from 'fs';
import path from 'path';
import { RoastReport } from '../types/index.js';
import { renderJsonReport } from './json.js';
import { renderMarkdownReport } from './markdown.js';
import { renderHtmlReport } from './html.js';
import { renderSarifReport } from './sarif.js';
import { renderJUnitReport } from './junit.js';

export interface OutputDirResult {
  dir: string;
  files: string[];
  errors: string[];
}

export async function saveAllReports(
  report: RoastReport,
  outputDir: string,
  rootDir: string
): Promise<OutputDirResult> {
  const result: OutputDirResult = { dir: outputDir, files: [], errors: [] };

  // Create directory if it doesn't exist
  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (e) {
    result.errors.push(`Failed to create directory: ${e instanceof Error ? e.message : String(e)}`);
    return result;
  }

  // Save each report format
  const reports: Array<{ name: string; content: string; ext: string }> = [
    { name: 'roast-report', content: renderJsonReport(report), ext: '.json' },
    { name: 'roast-report', content: renderMarkdownReport(report), ext: '.md' },
    { name: 'roast-report', content: renderHtmlReport(report), ext: '.html' },
    { name: 'roast-results', content: renderSarifReport(report, rootDir), ext: '.sarif' },
    { name: 'roast-results', content: renderJUnitReport(report, rootDir), ext: '.xml' },
  ];

  for (const { name, content, ext } of reports) {
    const filePath = path.join(outputDir, name + ext);
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      result.files.push(filePath);
    } catch (e) {
      result.errors.push(`Failed to write ${name + ext}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}

import fs from "fs";
import chalk from "chalk";
import { HealthScore } from "../types/index.js";
import { escapeXml, validateOutputPath } from "../utils/security.js";

export function generateBadgeSvg(health: HealthScore): string {
  const color = getBadgeColor(health.score);
  const score = escapeXml(health.score);

  const svg = `<svg width="150" height="20" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="60" height="20" fill="#555" rx="3"/>
  <rect x="60" y="0" width="90" height="20" fill="${color}" rx="3"/>
  <text x="30" y="14" fill="#fff" font-family="Verdana" font-size="11" text-anchor="middle">Health</text>
  <text x="105" y="14" fill="#fff" font-family="Verdana" font-size="11" text-anchor="middle">${score}/100</text>
</svg>`;
  return svg;
}

function getBadgeColor(score: number): string {
  if (score >= 90) return '#44cc11';
  if (score >= 80) return '#97ca00';
  if (score >= 70) return '#dfb317';
  if (score >= 60) return '#fe7d37';
  return '#e05d44';
}

export function saveBadge(svgContent: string, rootDir: string): void {
  try {
    const badgePath = validateOutputPath(rootDir, '.roast-badge.svg');
    fs.writeFileSync(badgePath, svgContent, 'utf-8');
    console.log(chalk.green('✓') + ' Badge saved to .roast-badge.svg');
  } catch (error) {
    console.error(chalk.red('Error saving badge:'), error instanceof Error ? error.message : String(error));
    throw error;
  }
}

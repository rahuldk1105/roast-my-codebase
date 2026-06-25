import chalk from "chalk";
import { HealthScore } from "../types/index.js";

const ASCII_GRADES: Record<string, string> = {
  A: `   █████╗
  ██╔══██╗
  ███████║
  ██╔══██║
  ██║  ██║
  ╚═╝  ╚═╝`,

  B: `  ██████╗
  ██╔══██╗
  ██████╔╝
  ██╔══██║
  ██████╔╝
  ╚═════╝`,

  C: `   ██████╗
  ██╔════╝
  ██║
  ██║
  ╚██████╗
   ╚═════╝`,

  D: `  ██████╗
  ██╔══██╗
  ██║  ██║
  ██║  ██║
  ██████╔╝
  ╚═════╝`,

  F: `  ███████╗
  ██╔════╝
  █████╗
  ██╔══╝
  ██║
  ╚═╝`
};

export function getAsciiGrade(grade: string): string {
  return ASCII_GRADES[grade] || ASCII_GRADES.F;
}

export function renderAsciiGrade(health: HealthScore): string {
  const art = getAsciiGrade(health.grade);
  const color = getScoreColor(health.score);
  return color(art);
}

function getScoreColor(score: number) {
  if (score >= 90) return chalk.green;
  if (score >= 80) return chalk.greenBright;
  if (score >= 70) return chalk.yellow;
  if (score >= 60) return chalk.rgb(255, 165, 0);
  return chalk.red;
}

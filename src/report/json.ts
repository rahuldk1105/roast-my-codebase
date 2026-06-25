import { RoastReport } from "../types/index.js";

/**
 * Renders a roast report as JSON
 * @param report The roast report to render
 * @returns JSON string representation of the report
 */
export function renderJsonReport(report: RoastReport): string {
  return JSON.stringify(report, null, 2);
}

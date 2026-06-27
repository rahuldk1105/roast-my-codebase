import fs from "fs";
import path from "path";
import { RoastReport, Finding } from "../types/index.js";
import { validateOutputPath } from "../utils/security.js";

const HEALTH_SCORE_THRESHOLD = 60;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen);
}

interface TestSuiteData {
  category: string;
  findings: Finding[];
}

function buildTestSuites(findings: Finding[]): TestSuiteData[] {
  const byCategory = new Map<string, Finding[]>();

  for (const finding of findings) {
    const existing = byCategory.get(finding.category);
    if (existing) {
      existing.push(finding);
    } else {
      byCategory.set(finding.category, [finding]);
    }
  }

  return Array.from(byCategory.entries()).map(([category, cats]) => ({
    category,
    findings: cats,
  }));
}

function renderTestCase(finding: Finding): string {
  const name = escapeXml(truncate(finding.message, 100));
  const classname = escapeXml(finding.file ?? finding.category);

  const isFailure = finding.severity === "critical" || finding.severity === "warning";

  if (!isFailure) {
    return `    <testcase name="${name}" classname="${classname}" time="0"/>\n`;
  }

  const failureType = finding.severity === "critical" ? "error" : "warning";
  const message = escapeXml(finding.message);

  const bodyLines: string[] = [];
  bodyLines.push(finding.message);
  if (finding.file) bodyLines.push(`File: ${finding.file}`);
  if (finding.detail) bodyLines.push(`Detail: ${finding.detail}`);
  bodyLines.push(`Severity: ${finding.severity}`);
  bodyLines.push(`Category: ${finding.category}`);
  const body = escapeXml(bodyLines.join("\n"));

  return (
    `    <testcase name="${name}" classname="${classname}" time="0">\n` +
    `      <failure message="${message}" type="${failureType}">${body}</failure>\n` +
    `    </testcase>\n`
  );
}

function renderTestSuite(suite: TestSuiteData): { xml: string; tests: number; failures: number; errors: number } {
  const tests = suite.findings.length;
  const errors = suite.findings.filter((f) => f.severity === "critical").length;
  const failures = suite.findings.filter((f) => f.severity === "warning").length;

  let xml =
    `  <testsuite name="${escapeXml(suite.category)}" tests="${tests}" failures="${failures}" errors="${errors}" time="0" package="roast-my-codebase">\n`;

  for (const finding of suite.findings) {
    xml += renderTestCase(finding);
  }

  xml += `  </testsuite>\n`;

  return { xml, tests, failures, errors };
}

function renderHealthSuite(score: number): { xml: string; tests: number; failures: number; errors: number } {
  const passed = score >= HEALTH_SCORE_THRESHOLD;

  let xml = `  <testsuite name="health-score" tests="1" failures="${passed ? 0 : 1}" errors="0" time="0" package="roast-my-codebase">\n`;

  if (passed) {
    xml += `    <testcase name="Health score: ${score}/100" classname="health-score" time="0"/>\n`;
  } else {
    const name = escapeXml(`Health score: ${score}/100`);
    const message = escapeXml(
      `Health score ${score}/100 is below the threshold of ${HEALTH_SCORE_THRESHOLD}/100`
    );
    const body = escapeXml(
      `Health score ${score}/100 is below the threshold of ${HEALTH_SCORE_THRESHOLD}/100`
    );
    xml +=
      `    <testcase name="${name}" classname="health-score" time="0">\n` +
      `      <failure message="${message}" type="warning">${body}</failure>\n` +
      `    </testcase>\n`;
  }

  xml += `  </testsuite>\n`;

  return {
    xml,
    tests: 1,
    failures: passed ? 0 : 1,
    errors: 0,
  };
}

export function renderJUnitReport(report: RoastReport, _rootDir: string): string {
  const suites = buildTestSuites(report.findings);

  let totalTests = 0;
  let totalFailures = 0;
  let totalErrors = 0;
  const suiteXmlParts: string[] = [];

  for (const suite of suites) {
    const rendered = renderTestSuite(suite);
    suiteXmlParts.push(rendered.xml);
    totalTests += rendered.tests;
    totalFailures += rendered.failures;
    totalErrors += rendered.errors;
  }

  // Health score suite
  const healthSuite = renderHealthSuite(report.health.score);
  suiteXmlParts.push(healthSuite.xml);
  totalTests += healthSuite.tests;
  totalFailures += healthSuite.failures;
  totalErrors += healthSuite.errors;

  const header = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  const testSuitesOpen =
    `<testsuites name="roast-my-codebase" tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" time="0">\n`;
  const testSuitesClose = `</testsuites>\n`;

  return header + testSuitesOpen + suiteXmlParts.join("") + testSuitesClose;
}

export function saveJUnitReport(xml: string, rootDir: string): void {
  const outputPath = validateOutputPath(rootDir, ".roast-junit.xml");
  fs.writeFileSync(outputPath, xml, "utf-8");
}

import fs from "fs";
import path from "path";
import { RoastReport, Finding } from "../types/index.js";
import { validateOutputPath } from "../utils/security.js";

const TOOL_NAME = "roast-my-codebase";
const TOOL_VERSION = "1.1.2";
const INFORMATION_URI = "https://github.com/rahuldk1105/roast-my-codebase";
const SARIF_SCHEMA =
  "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json";

function toSarifLevel(severity: string): "error" | "warning" | "note" {
  switch (severity) {
    case "critical":
      return "error";
    case "warning":
      return "warning";
    case "info":
    default:
      return "note";
  }
}

function categoryToPascalCase(category: string): string {
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

function categoryToHumanReadable(category: string): string {
  return category
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildRules(findings: Finding[]) {
  const seen = new Set<string>();
  const rules: object[] = [];

  for (const finding of findings) {
    if (seen.has(finding.category)) continue;
    seen.add(finding.category);

    rules.push({
      id: finding.category,
      name: categoryToPascalCase(finding.category),
      shortDescription: {
        text: categoryToHumanReadable(finding.category),
      },
      helpUri: INFORMATION_URI,
      properties: {
        tags: ["code-quality"],
      },
    });
  }

  return rules;
}

function toSarifUri(filePath: string): string {
  // SARIF URIs must use forward slashes (POSIX path separators)
  return filePath.replace(/\\/g, '/');
}

function buildResults(findings: Finding[]) {
  return findings.map((finding) => {
    const result: Record<string, unknown> = {
      ruleId: finding.category,
      message: { text: finding.message },
      level: toSarifLevel(finding.severity),
    };

    if (finding.file) {
      result.locations = [
        {
          physicalLocation: {
            artifactLocation: {
              uri: toSarifUri(finding.file),
              uriBaseId: "%SRCROOT%",
            },
            region: {
              startLine: 1,
            },
          },
        },
      ];
    } else {
      result.locations = [
        {
          physicalLocation: {
            artifactLocation: {
              uri: ".",
            },
          },
        },
      ];
    }

    return result;
  });
}

function buildArtifacts(findings: Finding[]) {
  const seen = new Set<string>();
  const artifacts: object[] = [];

  for (const finding of findings) {
    if (!finding.file) continue;
    if (seen.has(finding.file)) continue;
    seen.add(finding.file);

    artifacts.push({
      location: {
        uri: toSarifUri(finding.file),
        uriBaseId: "%SRCROOT%",
      },
    });
  }

  return artifacts;
}

export function renderSarifReport(report: RoastReport, _rootDir: string): string {
  const sarifDoc = {
    $schema: SARIF_SCHEMA,
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: TOOL_VERSION,
            informationUri: INFORMATION_URI,
            rules: buildRules(report.findings),
          },
        },
        results: buildResults(report.findings),
        artifacts: buildArtifacts(report.findings),
      },
    ],
  };

  return JSON.stringify(sarifDoc, null, 2);
}

export function saveSarifReport(sarif: string, rootDir: string): void {
  const outputPath = validateOutputPath(rootDir, ".roast-results.sarif");
  fs.writeFileSync(outputPath, sarif, "utf-8");
}

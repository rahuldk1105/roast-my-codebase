import { Finding } from "../types/index.js";

export interface FixSuggestion {
  findingId: string;
  finding: Finding;
  suggestion: string;
  autoFixable: boolean;
  command?: string;
}

export function generateFixSuggestions(findings: Finding[]): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];

  for (const finding of findings) {
    let suggestion = "";
    let autoFixable = false;
    let command: string | undefined;

    switch (finding.category) {
      case "large-files":
        if (finding.severity === "critical") {
          suggestion = `Split ${finding.file} into smaller modules by extracting logical components`;
        } else {
          suggestion = `Consider refactoring ${finding.file} to reduce complexity`;
        }
        autoFixable = false;
        break;

      case "complexity":
        suggestion = `Refactor function by extracting nested logic into helper functions`;
        autoFixable = false;
        break;

      case "duplicates":
        suggestion = `Extract duplicated code into a shared utility function or module`;
        autoFixable = false;
        break;

      case "dead-exports":
        suggestion = `Remove unused export to clean up the API surface`;
        autoFixable = true;
        break;

      case "circular-deps":
        suggestion = `Break the cycle by introducing a shared interface/type file or inverting one dependency`;
        autoFixable = false;
        break;

      case "unused-dependencies":
        const packageName = finding.detail || finding.message.match(/`([^`]+)`/)?.[1];
        suggestion = `Remove unused dependency: ${packageName}`;
        command = `npm uninstall ${packageName}`;
        autoFixable = true;
        break;

      case "type-safety":
        if (finding.message.includes("any")) {
          suggestion = `Replace 'any' with specific types or use 'unknown' for safer type narrowing`;
        } else if (finding.message.includes("@ts-ignore")) {
          suggestion = `Address the underlying type error instead of suppressing it`;
        }
        autoFixable = false;
        break;

      case "todos":
        suggestion = `Add issue tracker references to TODO comments`;
        autoFixable = true;
        break;

      case "structure":
        if (finding.id === "deep-nesting") {
          suggestion = `Flatten directory structure by grouping related files at higher levels`;
        } else if (finding.id === "util-explosion") {
          suggestion = `Consolidate utility files by grouping related functions`;
        }
        autoFixable = false;
        break;
    }

    if (suggestion) {
      suggestions.push({
        findingId: finding.id,
        finding,
        suggestion,
        autoFixable,
        command,
      });
    }
  }

  return suggestions;
}

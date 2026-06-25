import { Finding } from "../types/index.js";

export interface FixSuggestion {
  finding: Finding;
  suggestion: string;
}

export function generateFixSuggestions(findings: Finding[]): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];

  for (const finding of findings) {
    let suggestion = "";

    switch (finding.category) {
      case "large-files":
        if (finding.severity === "critical") {
          suggestion = `Split ${finding.file} into smaller modules by extracting logical components`;
        } else {
          suggestion = `Consider refactoring ${finding.file} to reduce complexity`;
        }
        break;
      case "complexity":
        suggestion = `Refactor function by extracting nested logic into helper functions`;
        break;
      case "duplicates":
        suggestion = `Extract duplicated code into a shared utility function or module`;
        break;
      case "dead-exports":
        suggestion = `Remove unused export to clean up the API surface`;
        break;
      case "circular-deps":
        suggestion = `Break the cycle by introducing a shared interface/type file or inverting one dependency`;
        break;
      case "unused-deps":
        suggestion = `Run: npm uninstall ${finding.detail}`;
        break;
      case "type-safety":
        if (finding.message.includes("any")) {
          suggestion = `Replace 'any' with specific types or use 'unknown' for safer type narrowing`;
        } else if (finding.message.includes("@ts-ignore")) {
          suggestion = `Address the underlying type error instead of suppressing it`;
        }
        break;
      case "todos":
        suggestion = `Review and address TODO comments, or convert to tracked issues`;
        break;
      case "structure":
        if (finding.id === "deep-nesting") {
          suggestion = `Flatten directory structure by grouping related files at higher levels`;
        } else if (finding.id === "util-explosion") {
          suggestion = `Consolidate utility files by grouping related functions`;
        }
        break;
    }

    if (suggestion) {
      suggestions.push({ finding, suggestion });
    }
  }

  return suggestions;
}

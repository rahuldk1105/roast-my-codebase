import { Finding, HealthScore } from "../types/index.js";
import { HEALTH_DEDUCTIONS } from "../utils/constants.js";

export function calculateHealth(findings: Finding[]): HealthScore {
  let score = 100;

  for (const finding of findings) {
    switch (finding.category) {
      case "large-files":
        if (finding.severity === "critical") {
          score += HEALTH_DEDUCTIONS.extremeFile;
        } else {
          score += HEALTH_DEDUCTIONS.largeFile;
        }
        break;
      case "todos":
        score += HEALTH_DEDUCTIONS.todo * getTodoCount(finding);
        break;
      case "circular-deps":
        score += HEALTH_DEDUCTIONS.circularDependency;
        break;
      case "unused-deps":
        score += HEALTH_DEDUCTIONS.unusedDependency;
        break;
      case "dependencies":
        if (finding.severity === "critical") {
          score += HEALTH_DEDUCTIONS.excessiveDeps;
        }
        break;
      case "structure":
        if (finding.id === "deep-nesting") {
          score += HEALTH_DEDUCTIONS.deepNesting;
        }
        if (finding.id === "util-explosion") {
          score += HEALTH_DEDUCTIONS.utilExplosion;
        }
        break;
      case "complexity":
        if (finding.severity === "critical") {
          score += HEALTH_DEDUCTIONS.veryComplexFunction;
        } else if (finding.severity === "warning") {
          score += HEALTH_DEDUCTIONS.complexFunction;
        }
        break;
      case "duplicates":
        score += HEALTH_DEDUCTIONS.duplicateCode;
        break;
      case "dead-exports":
        score += HEALTH_DEDUCTIONS.deadExport;
        break;
      case "type-safety":
        if (finding.severity === "critical") {
          score += HEALTH_DEDUCTIONS.criticalTypeSafety;
        } else if (finding.severity === "warning") {
          score += HEALTH_DEDUCTIONS.typeSafetyIssue;
        }
        break;
      case "git-churn":
        score += HEALTH_DEDUCTIONS.gitChurn;
        break;
      case "pr-size":
        score += HEALTH_DEDUCTIONS.largePRSize;
        break;
      case "secrets":
      case "env-in-git":
        score += HEALTH_DEDUCTIONS.secret;
        break;
      case "eval-usage":
        score += HEALTH_DEDUCTIONS.evalUsage;
        break;
      case "test-coverage":
        score += HEALTH_DEDUCTIONS.missingTest;
        break;
      case "nextjs-metadata":
      case "nextjs-client-server":
      case "react-error-boundary":
      case "vue-issues":
      case "angular-issues":
      case "svelte-issues":
      case "express-issues":
      case "fastapi-issues":
        score += HEALTH_DEDUCTIONS.frameworkViolation;
        break;
      case "npm-audit":
        if (finding.severity === "critical") score += -8;
        else if (finding.severity === "warning") score += -3;
        else score += -1;
        break;
      case "dep-outdated":
        if (finding.severity === "warning") score += -2;
        else score += -0.5;
        break;
      case "test-quality":
        if (finding.severity === "critical") score += -5;
        else if (finding.severity === "warning") score += -2;
        else score += -0.5;
        break;
      case "ruby-style":
      case "php-smell":
      case "swift-async":
      case "kotlin-coroutine":
        score += HEALTH_DEDUCTIONS.frameworkViolation;
        break;
      default:
        // Custom rules and unknown categories — score by ID prefix
        if (finding.id.startsWith("custom-")) {
          if (finding.severity === "critical") score += -10;
          else if (finding.severity === "warning") score += -2;
          else score += -0.5;
        }
        break;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    grade: getGrade(score),
    label: getLabel(score),
  };
}

function getTodoCount(finding: Finding): number {
  const match = finding.message.match(/Found (\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

function getGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function getLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 70) return "Fair";
  if (score >= 60) return "Risky";
  return "Chaotic";
}

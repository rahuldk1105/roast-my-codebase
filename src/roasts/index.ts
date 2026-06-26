import { Finding, Roast, HealthScore } from "../types/index.js";
import { generateAIRoastsBatch, AIRoastConfig } from "../ai/index.js";

const largeFileRoasts = [
  "This file has achieved sentience.",
  "At this size, this module should have its own roadmap.",
  "This file contains several geological layers.",
  "Future archaeologists will study this file.",
  "This file predates some of your dependencies.",
  "Scrolling through this file counts as cardio.",
  "This file has more lines than some microservices have total.",
  "This is less a file and more of a lifestyle.",
];

const todoRoasts = [
  "Future You has requested fewer TODOs and more DO-NOs.",
  "Your codebase has more promises than a politician in election season.",
  "These TODOs have aged like fine wine — ignored and dusty.",
  "Every TODO is a tiny apology to your future self.",
  "These TODOs are now historical artifacts.",
  "Someone left breadcrumbs. Nobody followed them back.",
];

const dependencyRoasts = [
  "This package.json reads like a phone book.",
  "Your node_modules folder needs its own zip code.",
  "This dependency appears to be paying rent for no reason.",
  "Your left-pad insurance policy is extensive.",
  "There are more dependencies here than features.",
  "npm install probably takes a lunch break.",
];

const circularRoasts = [
  "These files are in a codependent relationship.",
  "This import cycle is an infinite loop of regret.",
  "These modules reference each other like they're in couples therapy.",
  "A dependency circle — the software equivalent of a dog chasing its tail.",
  "These files import each other like two mirrors facing each other.",
];

const structureRoasts = [
  "This folder structure would make a spelunker nervous.",
  "Your project nesting goes deeper than the Mariana Trench.",
  "The junk drawer has evolved into a junk warehouse.",
  "Your utils folder has more career potential than a senior engineer.",
  "Someone really committed to the folder-per-thought architecture.",
];

const complexityRoasts = [
  "This function has more branches than a forest.",
  "Cyclomatic complexity called — it wants its title back.",
  "This function does everything except make you coffee.",
  "Reading this function requires a trail guide and emergency supplies.",
  "This function's decision tree looks like a family tree from Game of Thrones.",
];

const duplicateRoasts = [
  "Copy-paste is not a design pattern.",
  "This code has more twins than a soap opera.",
  "Someone discovered Ctrl+C but not abstraction.",
  "DRY principles died here.",
  "This code clones itself like a biological virus.",
];

const deadExportRoasts = [
  "These exports are shouting into the void.",
  "This function is export-only, like a concept car that never ships.",
  "Nobody imports this. Nobody.",
  "This export is as useful as a chocolate teapot.",
  "These dead exports are the software equivalent of ghost towns.",
];

const typeSafetyRoasts = [
  "TypeScript is just JavaScript with extra steps at this rate.",
  "The 'any' escape hatch has become the front door.",
  "Your type safety is more like type suggestions.",
  "@ts-ignore: because types are hard.",
  "This codebase treats TypeScript like a linter, not a language.",
];

const gitChurnRoasts = [
  "This file changes more often than JavaScript frameworks.",
  "Version control or version chaos? You decide.",
  "This file has more revisions than a novel.",
  "At this rate of change, git log is your documentation.",
];

const securityRoasts = [
  "Secrets in git. Because what could go wrong?",
  "Your API keys are public. Consider them compromised.",
  "eval() — when you want attackers to write your code for you.",
  "Hardcoded secrets: the gift that keeps on giving (to hackers).",
];

const testCoverageRoasts = [
  "Tests are optional, right? Right?",
  "This code is production-ready. Trust me.",
  "Writing tests is for people who make mistakes.",
  "YOLO-driven development at its finest.",
];

const frameworkRoasts = [
  "Next.js best practices are more like Next.js suggestions, apparently.",
  "Missing metadata — search engines love mystery pages.",
  "Error boundaries are for people who expect errors.",
  "Client hooks in server components: bold strategy.",
];

const verdicts = {
  excellent: [
    "Your codebase is suspiciously clean. Are you hiding something?",
    "Impressive. This codebase is either well-maintained or brand new.",
    "Nearly flawless. Your team might actually read each other's PRs.",
  ],
  good: [
    "Solid work. A few rough edges, but nothing that keeps you up at night.",
    "This codebase has good bones. The renovations can wait.",
    "Above average. Your tech debt is manageable, not existential.",
  ],
  fair: [
    "Your codebase is at that stage where 'refactor sprint' keeps getting postponed.",
    "Not terrible, not great. Like most software, it exists in a state of managed chaos.",
    "Some files are applying for monolithic status. Intervention recommended.",
  ],
  risky: [
    "Your codebase is one bad merge away from a support group.",
    "This repository has seen things. And done things. Questionable things.",
    "The technical debt here could qualify for its own line of credit.",
  ],
  chaotic: [
    "This codebase is held together by hope and string literals.",
    "Abandon all hope, ye who git clone here.",
    "This isn't a codebase. It's an archaeological dig site.",
  ],
};

const pythonTypeHintsRoasts = [
  "Type hints are optional in Python. So are brakes on a car, technically.",
  "Dynamic typing is great until your production server discovers the wrong type at 3 AM.",
  "Type hints: because debugging at runtime is what keeps us young.",
];

const pythonImportRoasts = [
  "Wildcard imports: because you like playing 'guess which namespace that came from.'",
  "Deep relative imports: your codebase is spaghetti that imports other spaghetti.",
  "from module import * — the programming equivalent of 'throw everything in and hope.'",
];

const pythonComplexityRoasts = [
  "This Python function has more branches than a bank.",
  "Cyclomatic complexity this high should come with a map.",
  "This function is so complex it filed for its own ZIP code.",
];

const goErrorHandlingRoasts = [
  "Ignoring errors in Go is like ignoring check engine lights.",
  "_ = dangerousOperation() — the Go equivalent of 'it's fine.'",
  "Your error handling strategy appears to be 'hope.'",
  "panic() in production: because graceful degradation is overrated.",
];

const goLintRoasts = [
  "Unexported symbols don't need docs. Exported ones do. Guess which you forgot.",
  "Multiple init() functions: because one confusing startup sequence wasn't enough.",
  "Go proverbs say 'a little copying is better than a little dependency.' You took that personally.",
];

const rustUnsafeRoasts = [
  "unsafe {} — Rust's way of saying 'I know what I'm doing.' Do you, though?",
  "This much unsafe code defeats the purpose of choosing Rust.",
  "The borrow checker can't save you if you keep bypassing it.",
];

const rustClippyRoasts = [
  ".unwrap() everywhere: living dangerously, one None at a time.",
  "This much .clone() suggests a fundamental misunderstanding of ownership.",
  "todo!() in production: the Rust equivalent of 'I'll fix it later.'",
];

const javaSmellRoasts = [
  "This class has more methods than a phone book has entries.",
  "System.out.println in production — logging frameworks exist, you know.",
  "Empty catch blocks: because exceptions are just suggestions.",
  "God classes: when Single Responsibility Principle is just a suggestion.",
];

const javaNamingRoasts = [
  "AbstractSingletonProxyFactoryBean called. It wants its naming convention back.",
  "Java naming conventions aren't optional. Even Java thinks so.",
  "Your constant naming is more chaotic than your class hierarchy.",
];

const csharpSmellRoasts = [
  "#region is not architecture. It's a rug to sweep complexity under.",
  "Console.WriteLine in production? ILogger is right there.",
  "This class is so large it needs its own table of contents.",
];

const csharpAsyncRoasts = [
  "async void: the fire-and-forget-and-pray pattern.",
  ".Result and .Wait() — deadlocks as a service.",
  "Sync-over-async: because who needs scalability anyway.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get roast message - AI if available, otherwise predefined
 */
function getRoastMessage(
  finding: Finding,
  aiRoasts: Map<string, string>,
  fallbackArray: string[]
): string {
  return aiRoasts.get(finding.id) || pick(fallbackArray);
}

export async function generateRoasts(
  findings: Finding[],
  aiConfig?: AIRoastConfig,
  rootDir?: string
): Promise<Roast[]> {
  const roasts: Roast[] = [];
  // const _seen = new Set<string>(); // Track categories we've roasted (TODO: use for deduplication)

  // Generate AI roasts if enabled
  let aiRoasts = new Map<string, string>();
  if (aiConfig?.enabled && rootDir) {
    try {
      // Select interesting findings for AI roasting (max 10 to control cost)
      const interestingFindings = [
        ...findings.filter((f) => f.severity === "critical").slice(0, 3),
        ...findings.filter((f) => f.severity === "warning").slice(0, 4),
        ...findings.filter((f) => f.severity === "info").slice(0, 3),
      ].slice(0, 10);

      aiRoasts = await generateAIRoastsBatch(
        interestingFindings,
        aiConfig,
        rootDir
      );
    } catch (error) {
      console.warn("Warning: AI roast generation failed, using predefined roasts");
    }
  }

  const largeFiles = findings.filter((f) => f.category === "large-files" && f.severity !== "info");
  for (const finding of largeFiles.slice(0, 3)) {
    if (!finding.file) continue;
    const aiRoast = aiRoasts.get(finding.id);
    roasts.push({
      target: finding.file,
      message: aiRoast || pick(largeFileRoasts),
      category: "large-files",
    });
  }

  const todos = findings.filter((f) => f.category === "todos");
  if (todos.length > 0) {
    roasts.push({
      target: "TODOs",
      message: pick(todoRoasts),
      category: "todos",
    });
  }

  const depFindings = findings.filter(
    (f) => f.category === "dependencies" || f.category === "unused-deps"
  );
  if (depFindings.length > 0) {
    const unusedDeps = findings.filter((f) => f.category === "unused-deps");
    if (unusedDeps.length > 0) {
      roasts.push({
        target: unusedDeps[0].detail || "dependencies",
        message: pick(dependencyRoasts),
        category: "dependencies",
      });
    }
    if (findings.some((f) => f.id === "excessive-deps" || f.id === "many-deps")) {
      roasts.push({
        target: "package.json",
        message: pick(dependencyRoasts),
        category: "dependencies",
      });
    }
  }

  const circular = findings.filter((f) => f.category === "circular-deps");
  if (circular.length > 0) {
    roasts.push({
      target: circular[0].file || "modules",
      message: pick(circularRoasts),
      category: "circular-deps",
    });
  }

  const structure = findings.filter((f) => f.category === "structure" && f.severity === "warning");
  if (structure.length > 0) {
    roasts.push({
      target: structure[0].file || "project structure",
      message: pick(structureRoasts),
      category: "structure",
    });
  }

  const complexity = findings.filter((f) => f.category === "complexity" && f.severity !== "info");
  if (complexity.length > 0) {
    roasts.push({
      target: complexity[0].file || "functions",
      message: pick(complexityRoasts),
      category: "complexity",
    });
  }

  const duplicates = findings.filter((f) => f.category === "duplicates");
  if (duplicates.length > 0) {
    roasts.push({
      target: duplicates[0].file || "code",
      message: pick(duplicateRoasts),
      category: "duplicates",
    });
  }

  const deadExports = findings.filter((f) => f.category === "dead-exports");
  if (deadExports.length > 0) {
    roasts.push({
      target: deadExports[0].file || "exports",
      message: pick(deadExportRoasts),
      category: "dead-exports",
    });
  }

  const typeSafety = findings.filter((f) => f.category === "type-safety" && f.severity !== "info");
  if (typeSafety.length > 0) {
    roasts.push({
      target: typeSafety[0].file || "TypeScript",
      message: pick(typeSafetyRoasts),
      category: "type-safety",
    });
  }

  const gitChurn = findings.filter((f) => f.category === "git-churn");
  if (gitChurn.length > 0) {
    roasts.push({
      target: gitChurn[0].file || "repository",
      message: pick(gitChurnRoasts),
      category: "git-churn",
    });
  }

  const security = findings.filter((f) => f.category === "secrets" || f.category === "env-in-git" || f.category === "eval-usage");
  if (security.length > 0) {
    roasts.push({
      target: security[0].file || "security",
      message: pick(securityRoasts),
      category: "security",
    });
  }

  const testCoverage = findings.filter((f) => f.category === "test-coverage");
  if (testCoverage.length > 0) {
    roasts.push({
      target: "test coverage",
      message: pick(testCoverageRoasts),
      category: "test-coverage",
    });
  }

  const framework = findings.filter((f) => f.category === "nextjs-metadata" || f.category === "nextjs-client-server" || f.category === "react-error-boundary");
  if (framework.length > 0) {
    roasts.push({
      target: framework[0].file || "framework",
      message: pick(frameworkRoasts),
      category: "framework",
    });
  }

  // Python-specific roasts
  const pythonTypeHints = findings.filter((f) => f.category === "type-safety" && f.message.includes("Python"));
  if (pythonTypeHints.length > 0) {
    roasts.push({
      target: "Python code",
      message: pick(pythonTypeHintsRoasts),
      category: "type-safety",
    });
  }

  const pythonImports = findings.filter((f) => f.category === "python-imports");
  if (pythonImports.length > 0) {
    roasts.push({
      target: pythonImports[0].file || "Python imports",
      message: pick(pythonImportRoasts),
      category: "python-imports",
    });
  }

  // Go-specific roasts
  const goErrors = findings.filter((f) => f.category === "go-error-handling");
  if (goErrors.length > 0) {
    roasts.push({
      target: goErrors[0].file || "Go code",
      message: pick(goErrorHandlingRoasts),
      category: "go-error-handling",
    });
  }

  const goLint = findings.filter((f) => f.category === "go-lint");
  if (goLint.length > 0) {
    roasts.push({
      target: "Go conventions",
      message: pick(goLintRoasts),
      category: "go-lint",
    });
  }

  // Rust-specific roasts
  const rustUnsafe = findings.filter((f) => f.category === "rust-unsafe");
  if (rustUnsafe.length > 0) {
    roasts.push({
      target: rustUnsafe[0].file || "Rust code",
      message: pick(rustUnsafeRoasts),
      category: "rust-unsafe",
    });
  }

  const rustClippy = findings.filter((f) => f.category === "rust-clippy");
  if (rustClippy.length > 0) {
    roasts.push({
      target: rustClippy[0].file || "Rust code",
      message: pick(rustClippyRoasts),
      category: "rust-clippy",
    });
  }

  // Java-specific roasts
  const javaSmells = findings.filter((f) => f.category === "java-smells");
  if (javaSmells.length > 0) {
    roasts.push({
      target: javaSmells[0].file || "Java code",
      message: pick(javaSmellRoasts),
      category: "java-smells",
    });
  }

  const javaNaming = findings.filter((f) => f.category === "java-naming");
  if (javaNaming.length > 0) {
    roasts.push({
      target: javaNaming[0].file || "Java code",
      message: pick(javaNamingRoasts),
      category: "java-naming",
    });
  }

  // C#-specific roasts
  const csharpSmells = findings.filter((f) => f.category === "csharp-smells");
  if (csharpSmells.length > 0) {
    roasts.push({
      target: csharpSmells[0].file || "C# code",
      message: pick(csharpSmellRoasts),
      category: "csharp-smells",
    });
  }

  const csharpAsync = findings.filter((f) => f.category === "csharp-async");
  if (csharpAsync.length > 0) {
    roasts.push({
      target: csharpAsync[0].file || "C# code",
      message: pick(csharpAsyncRoasts),
      category: "csharp-async",
    });
  }

  return roasts;
}

export function generateVerdict(health: HealthScore): string {
  if (health.score >= 90) return pick(verdicts.excellent);
  if (health.score >= 80) return pick(verdicts.good);
  if (health.score >= 70) return pick(verdicts.fair);
  if (health.score >= 60) return pick(verdicts.risky);
  return pick(verdicts.chaotic);
}

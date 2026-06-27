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
  "This file is so large it has its own timezone.",
  "Lines of code don't equal quality, but they do equal this.",
  "This file is the software equivalent of a junk drawer that achieved consciousness.",
  "At this point, split it or give it a corner office.",
  "This file has seen three framework migrations and remembers all of them.",
];

const extremeFileRoasts = [
  "This file has more lines than a congressional hearing transcript.",
  "2000+ lines: the file that time forgot to split.",
  "At this scale, 'file' is an understatement. This is a document.",
  "This file is so large that reading it is considered cardio.",
  "2000 lines. One file. Zero mercy.",
  "This file has geological strata. The bottom layers date to a different framework.",
  "Splitting this file would be an act of mercy.",
];

const largeFileWarningRoasts = [
  "This file is testing the definition of 'single responsibility'.",
  "Getting close to that file-splits-itself threshold.",
  "Someone is definitely going to add 'just one more method' to this file.",
  "This file is on the watchlist.",
  "It's not big yet. It's 'about to become a problem' big.",
];

const todoRoasts = [
  "Future You has requested fewer TODOs and more DO-NOs.",
  "Your codebase has more promises than a politician in election season.",
  "These TODOs have aged like fine wine — ignored and dusty.",
  "Every TODO is a tiny apology to your future self.",
  "These TODOs are now historical artifacts.",
  "Someone left breadcrumbs. Nobody followed them back.",
  "The TODO count is accelerating faster than the feature count.",
  "Some of these TODOs predate the people who wrote them.",
  "TODO: write fewer TODOs. That one's also unfinished.",
  "A codebase full of TODOs is just a backlog with delusions of adequacy.",
  "Every TODO is a decision your past self kindly delegated to your future self.",
  "FIXME: this whole situation.",
];

const dependencyRoasts = [
  "This package.json reads like a phone book.",
  "Your node_modules folder needs its own zip code.",
  "This dependency appears to be paying rent for no reason.",
  "Your left-pad insurance policy is extensive.",
  "There are more dependencies here than features.",
  "npm install probably takes a lunch break.",
  "Your package.json is a monument to optimistic npm install.",
  "Half these packages were installed once for a Stackoverflow answer and never uninstalled.",
  "This project has more indirect dependencies than direct features.",
  "node_modules: the folder that makes SSD manufacturers nervous.",
  "Some of these packages haven't had a commit since the Obama administration.",
];

const circularRoasts = [
  "These files are in a codependent relationship.",
  "This import cycle is an infinite loop of regret.",
  "These modules reference each other like they're in couples therapy.",
  "A dependency circle — the software equivalent of a dog chasing its tail.",
  "These files import each other like two mirrors facing each other.",
  "Circular dependencies: the architectural equivalent of a Möbius strip.",
  "A imports B imports A. Nobody wins. Everyone waits.",
  "Congratulations, you've invented the software ouroboros.",
  "This import graph would make a graph theorist cry.",
  "The modules called. They're confused about who's in charge.",
];

const structureRoasts = [
  "This folder structure would make a spelunker nervous.",
  "Your project nesting goes deeper than the Mariana Trench.",
  "The junk drawer has evolved into a junk warehouse.",
  "Your utils folder has more career potential than a senior engineer.",
  "Someone really committed to the folder-per-thought architecture.",
  "This directory structure was planned by someone very optimistic about the future.",
  "There are folders here that haven't been opened since the initial commit.",
  "Your utils/ folder is applying for department status.",
  "src/helpers/utils/common/shared — a path that describes nothing and contains everything.",
  "The folder nesting suggests someone was paid by the directory.",
  "This isn't a project structure. It's a treasure map with no X.",
];

const complexityRoasts = [
  "This function has more branches than a forest.",
  "Cyclomatic complexity called — it wants its title back.",
  "This function does everything except make you coffee.",
  "Reading this function requires a trail guide and emergency supplies.",
  "This function's decision tree looks like a family tree from Game of Thrones.",
  "This function has more escape routes than a movie villain's lair.",
  "Cyclomatic complexity this high is a résumé, not code.",
  "The cognitive load of this function is a workplace hazard.",
  "Reading this function cold is a hazing ritual.",
  "This function branches so much it's practically a hedge maze.",
  "I've seen smaller decision trees at the DMV.",
];

const duplicateRoasts = [
  "Copy-paste is not a design pattern.",
  "This code has more twins than a soap opera.",
  "Someone discovered Ctrl+C but not abstraction.",
  "DRY principles died here.",
  "This code clones itself like a biological virus.",
  "Found the same logic in three places. The first two were the originals.",
  "Abstraction is just ctrl+C ctrl+V with self-respect.",
  "These code twins haven't been told about each other yet.",
  "Three copies of this logic exist. None of them agree on the edge cases.",
  "Copy-paste driven development: fast to write, slow to debug, impossible to change.",
];

const deadExportRoasts = [
  "These exports are shouting into the void.",
  "This function is export-only, like a concept car that never ships.",
  "Nobody imports this. Nobody.",
  "This export is as useful as a chocolate teapot.",
  "These dead exports are the software equivalent of ghost towns.",
  "This function has been exported and never imported. A career in limbo.",
  "Dead exports: code that went public but got no engagement.",
  "These are the functions that showed up to the party but no one invited them.",
  "Exported but never imported — like a résumé sent to a spam folder.",
  "This export is the developer equivalent of a door that opens to a wall.",
];

const typeSafetyRoasts = [
  "TypeScript is just JavaScript with extra steps at this rate.",
  "The 'any' escape hatch has become the front door.",
  "Your type safety is more like type suggestions.",
  "@ts-ignore: because types are hard.",
  "This codebase treats TypeScript like a linter, not a language.",
  "Every `any` is a small promise broken to your future self.",
  "TypeScript's whole pitch is that runtime errors become compile errors. You found a workaround.",
  "`as unknown as WhatIWant` — type surgery performed without a license.",
  "This `@ts-ignore` comment is load-bearing. Remove it and discover what it was hiding.",
  "Your `any`s outnumber your actual types. TypeScript is just decoration at this point.",
  "// @ts-expect-error — at least this one is honest about the crime.",
];

const gitChurnRoasts = [
  "This file changes more often than JavaScript frameworks.",
  "Version control or version chaos? You decide.",
  "This file has more revisions than a novel.",
  "At this rate of change, git log is your documentation.",
  "This file is touched every sprint. Consider whether it's doing too much.",
  "High churn means either the requirements keep changing or the implementation keeps being wrong.",
  "This file has been changed so many times git blame is a scroll of shame.",
  "Some files change because the domain evolves. This one changes because nobody got it right the first time.",
  "Churn this high usually means the file is load-bearing and terrifying.",
];

const securityRoasts = [
  "Secrets in git. Because what could go wrong?",
  "Your API keys are public. Consider them compromised.",
  "eval() — when you want attackers to write your code for you.",
  "Hardcoded secrets: the gift that keeps on giving (to hackers).",
  "That secret in your git history? It's permanent. The secret is also permanent now.",
  "eval() with user input: outsourcing code execution to strangers.",
  "Your .env is committed. Rotate the keys. All of them. Now.",
  "Hardcoded credentials survive long after the systems that generated them.",
  "Security through 'nobody will look at this repo' is not a security model.",
];

const testCoverageRoasts = [
  "Tests are optional, right? Right?",
  "This code is production-ready. Trust me.",
  "Writing tests is for people who make mistakes.",
  "YOLO-driven development at its finest.",
  "Untested code is just a hypothesis about what might work.",
  "These files ship pure vibes. No assertions included.",
  "The test suite is remarkably quiet for a project with this many edge cases.",
  "Writing code without tests is like building a bridge and refusing to drive on it first.",
  "Future you will spend 4 hours debugging something a 10-line test would have caught.",
  "The code is confident. The tests are not there to challenge it.",
];

const frameworkRoasts = [
  "Next.js best practices are more like Next.js suggestions, apparently.",
  "Missing metadata — search engines love mystery pages.",
  "Error boundaries are for people who expect errors.",
  "Client hooks in server components: bold strategy.",
  "Next.js: the framework that has opinions. You chose to ignore them.",
  "A missing error boundary is a gift to your users — of a white screen.",
  "Server components with client hooks: the temporal paradox of React.",
  "SEO is hard. Missing metadata makes it harder for no reason.",
  "React has conventions. They're not enforced. That's the trap.",
];

const verdicts = {
  excellent: [
    "Your codebase is suspiciously clean. Are you hiding something?",
    "Impressive. This codebase is either well-maintained or brand new.",
    "Nearly flawless. Your team might actually read each other's PRs.",
    "Either your team is exceptional or this repo is very young. Either way, don't ship anything new today.",
    "This is what happens when someone actually enforces code review.",
    "Suspiciously healthy. Did you hide the bad files somewhere?",
    "The linter is satisfied. The linter is never satisfied. This is a good sign.",
    "Clean enough to show your colleagues. Rare.",
  ],
  good: [
    "Solid work. A few rough edges, but nothing that keeps you up at night.",
    "This codebase has good bones. The renovations can wait.",
    "Above average. Your tech debt is manageable, not existential.",
    "Mostly clean. The rough patches are documented, at least in TODOs.",
    "You've got 80% of the good habits. The other 20% is where complexity lives.",
    "Better than average, which is a low bar that you cleared with room to spare.",
    "A codebase that a new hire could navigate without a guide. That's saying something.",
    "Good bones. Some questionable wallpaper. Still livable.",
  ],
  fair: [
    "Your codebase is at that stage where 'refactor sprint' keeps getting postponed.",
    "Not terrible, not great. Like most software, it exists in a state of managed chaos.",
    "Some files are applying for monolithic status. Intervention recommended.",
    "The codebase works. Whether it should is a separate question.",
    "Tech debt is present but not yet sentient.",
    "There's a refactor conversation waiting to happen. Probably in Q3.",
    "This codebase is fine in the way that a car with 180k miles is fine.",
    "Holding together. Possibly through social cohesion and mutual agreement not to look too closely.",
    "The code ships. The code also shivers slightly when you touch the old parts.",
  ],
  risky: [
    "Your codebase is one bad merge away from a support group.",
    "This repository has seen things. And done things. Questionable things.",
    "The technical debt here could qualify for its own line of credit.",
    "This codebase has the structural integrity of a Jenga tower at move 47.",
    "Someone once had a plan for this. The plan has not survived contact with reality.",
    "The tech debt has compounded interest. It now has opinions about your architecture.",
    "Not broken. Just... haunted.",
    "Production is stable. For now. Don't ask what 'for now' means.",
    "You're one refactor away from discovering why nobody refactored it before.",
  ],
  chaotic: [
    "This codebase is held together by hope and string literals.",
    "Abandon all hope, ye who git clone here.",
    "This isn't a codebase. It's an archaeological dig site.",
    "This codebase is a cautionary tale that hasn't finished being written.",
    "The original author left no documentation. They left no forwarding address either.",
    "git log tells a story of hope, compromise, and eventual acceptance.",
    "Code this complex doesn't have bugs. It has 'undocumented features' and 'emergent behavior'.",
    "Every function is load-bearing. You know this because removing one proved it.",
    "This code has achieved something rare: it is simultaneously legacy and unsupported.",
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

const pythonDocstringRoasts = [
  "Docstrings are optional. So is understanding your code in 6 months.",
  "Your functions are mysteries wrapped in enigmas. Add a docstring.",
  "Self-documenting code is a myth. Your future self will thank you for docstrings.",
];

const pythonSmellRoasts = [
  "Bare except: catching everything including your dignity.",
  "Mutable default arguments: the gift that keeps on mutating.",
  "This much global state makes singletons look elegant.",
  "Your functions are nested deeper than your tech debt.",
];

const pythonSecurityRoasts = [
  "eval() in Python: because you want hackers to feel welcome.",
  "pickle.load() from untrusted data is just exec() with extra steps.",
  "shell=True with user input: RCE as a feature, not a bug.",
  "SQL string formatting: Little Bobby Tables approves.",
  "Hardcoded secrets in Python: because .env files are too mainstream.",
];

const pythonDesignRoasts = [
  "This class has more methods than a Swiss Army knife has tools.",
  "A class with no methods is just a dict wearing a trench coat. Use @dataclass.",
  "4+ parent classes: your MRO looks like a family tree from the Habsburgs.",
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

const vueIssuesRoasts = [
  "Options API in Vue 3: writing Vue 2 code in a Vue 3 world.",
  "v-for without :key — Vue is now doing the hokey pokey trying to track your list.",
  "Deep watcher? Congratulations, you've opted into re-running everything for no reason.",
  "This component watches everything deeply. Your CPU feels watched.",
];

const angularIssuesRoasts = [
  "No OnPush? Angular checks this component like a paranoid security guard — constantly.",
  "Direct DOM manipulation in Angular: ElementRef and prayers.",
  "(event: any) — typed strictly, except when it matters.",
  "Without OnPush, change detection runs so often it should get overtime pay.",
];

const svelteIssuesRoasts = [
  "Reactive side effects: your $: block is doing more work than your actual functions.",
  "A button without aria-label is just a mystery rectangle to screen readers.",
  "Svelte is supposed to simplify things. This fetch() in $: disagrees.",
  "Your reactive statements have more side effects than a clearance-sale medication.",
];

const expressIssuesRoasts = [
  "No error handler in Express — every unhandled error is a coin flip with production.",
  "No rate limiting: your API is accepting all requests, including the ones from bots.",
  "Synchronous file I/O in a route handler: welcome to the event loop queue.",
  "One bad request handler away from taking down the whole server.",
];

const fastapiIssuesRoasts = [
  "Missing response_model: FastAPI's docs page is just vibes now.",
  "Sync endpoint in FastAPI — you picked the async framework and blocked the event loop anyway.",
  "POST without status_code: the client has to guess if it worked. Good luck.",
  "No response_model means no validation, no docs, and no regrets — until there are regrets.",
];

const depAuditRoasts = [
  "Your dependencies have vulnerabilities. Security is just a vibe anyway.",
  "npm audit called — it's not happy about your life choices.",
  "CVEs in production: turning 'works on my machine' into 'hacked on your machine'.",
  "Supply chain attack? More like supply chain welcome mat.",
];

const depOutdatedRoasts = [
  "These packages haven't been updated since the last ice age.",
  "npm outdated: a love letter from the past.",
  "Your dependencies are aging like milk, not wine.",
  "These major version upgrades won't do themselves. (They will not, in fact, do themselves.)",
];

const rubyRoasts = [
  "Ruby: where every class is a God class waiting to happen.",
  "This method is so complex it needs its own retrospective.",
  "eval() in Ruby: because you miss the XSS vulnerabilities from your PHP days.",
  "No frozen_string_literal? Your strings are living their best mutable life.",
];

const phpRoasts = [
  "PHP: where SQL injection goes to be born.",
  "This code predates prepared statements. And dignity.",
  "MD5 for passwords in 2026. Bold choice.",
  "var_dump() in production: the poor man's observability platform.",
];

const swiftRoasts = [
  "Force unwrapping: Swift's way of saying 'I believe in you... mostly'.",
  "This SwiftUI view has more @State than a government agency.",
  "print() for debugging in production. Classic.",
  "Callback pyramid: the Great Pyramid of Giza, but for closures.",
];

const kotlinRoasts = [
  "!! in Kotlin: because NullPointerExceptions were getting lonely.",
  "GlobalScope: structured concurrency's nemesis.",
  "runBlocking in a coroutine. Thread blocked. Dreams crushed.",
  "println() for logging: Kotlin 101, lesson 0.",
];

const testQualityRoasts = [
  "Tests that always pass are basically just green noise.",
  "expect(true).toBe(true): peak TDD.",
  "Skipped tests: the software equivalent of 'we'll fix it in post'.",
  ".only in CI: one test to rule them all, one test to find them, one test to bring the pipeline down.",
  "No assertions? You're not testing, you're just running code for fun.",
];

const databaseRoasts = [
  "N+1 queries: the ORM's way of testing your database's patience.",
  "findAll() without limit. I hope your table is small. Spoiler: it won't be.",
  "Raw SQL in an ORM project. Why have an ORM at all?",
  "sync({ force: true }) in production. Bold strategy. Let's see how it pays off.",
  "No indexes. Your database is doing a full table scan and judging you.",
  "Hardcoded database credentials. Committing to the problem, one git push at a time.",
];

const configAuditRoasts = [
  "strict: false in tsconfig. Living life on the edge.",
  "No ESLint config. The lint-free lifestyle has consequences.",
  "TypeScript without strict mode is just JavaScript with extra keystrokes.",
  "skipLibCheck: true — because type errors in your dependencies are someone else's problem.",
  "No Prettier config. Every file has its own formatting style. Delightful.",
];

const bundleSizeRoasts = [
  "Your bundle grew 50%. Hope your users enjoy buffering.",
  "This bundle is so big it needs its own loading screen.",
  "Bundle size regression detected. Time to blame that one npm install.",
  "Your JavaScript bundle is now larger than some operating systems.",
];

const licenseRoasts = [
  "GPL in your dependency tree: open source whether you like it or not.",
  "AGPL: the license that says 'if you use this, you owe the world your code'.",
  "Unknown license: Schrödinger's compliance — you don't know until a lawyer opens the box.",
  "LGPL: the polite version of 'we're watching you'.",
  "Mixing GPL with proprietary code. Legal's going to love this conversation.",
];

const comboRoasts = [
  "Multiple critical systems are asking for attention simultaneously. Triage recommended.",
  "The findings have formed a coalition.",
  "This scan returned enough issues to fill a sprint retrospective and a therapy session.",
  "At this point the codebase is less 'software' and more 'accumulated decisions'.",
  "The issues aren't isolated. They know each other.",
  "This isn't a list of findings. This is a roadmap.",
  "Everything is technically working. That's the most optimistic reading available.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateOpeningLine(score: number, totalFindings: number): string | null {
  // Only fire for clear cases — don't be snarky at good scores
  if (score >= 85) return null;

  const critical = score < 40;
  const bad = score < 60;
  const manyIssues = totalFindings >= 30;
  const lotsOfIssues = totalFindings >= 60;

  if (critical && lotsOfIssues) {
    return pick([
      "Let's have an honest conversation.",
      "Buckle up.",
      "This is going to take a minute.",
      "I've seen things. Now you will too.",
      "No need to panic. Actually, maybe a little.",
    ]);
  }

  if (critical) {
    return pick([
      "Some findings require immediate attention.",
      "There are a few things we need to talk about.",
      "The health score would like a word.",
      "This scan found some highlights. 'Highlights' is a generous word.",
    ]);
  }

  if (bad && lotsOfIssues) {
    return pick([
      "A lot to cover. Let's start with the major items.",
      "Several areas need attention.",
      "This is a lot of findings for a project this size.",
      "The scanner worked hard on this one.",
    ]);
  }

  if (bad) {
    return pick([
      "Room for improvement. Quite a bit of room, actually.",
      "Not bad. Not good. Somewhere in the middle, leaning toward work-to-do.",
      "The score tells a partial story. The findings tell the rest.",
    ]);
  }

  if (manyIssues && score >= 60) {
    return pick([
      "Decent score, but a lot of individual findings worth reviewing.",
      "The structure is sound. Some details need attention.",
    ]);
  }

  return null;
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

  // Combo roast: fires when 4+ distinct serious categories have findings
  const seriousCategories = new Set(
    findings
      .filter(f => f.severity === "critical" || f.severity === "warning")
      .map(f => f.category)
  );
  if (seriousCategories.size >= 4) {
    roasts.push({
      target: "codebase",
      message: pick(comboRoasts),
      category: "combo",
    });
  }

  const largeFiles = findings.filter((f) => f.category === "large-files" && f.severity !== "info");
  for (const finding of largeFiles.slice(0, 3)) {
    if (!finding.file) continue;
    const aiRoast = aiRoasts.get(finding.id);
    const pool = finding.severity === "critical" ? extremeFileRoasts : largeFileWarningRoasts.concat(largeFileRoasts);
    roasts.push({
      target: finding.file,
      message: aiRoast || pick(pool),
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

  // Python docstrings
  const pythonDocstrings = findings.filter((f) => f.category === "python-docstrings");
  if (pythonDocstrings.length > 0) {
    roasts.push({
      target: "Python documentation",
      message: pick(pythonDocstringRoasts),
      category: "python-docstrings",
    });
  }

  // Python code smells
  const pythonSmells = findings.filter((f) => f.category === "python-smells");
  if (pythonSmells.length > 0) {
    roasts.push({
      target: pythonSmells[0].file || "Python code",
      message: pick(pythonSmellRoasts),
      category: "python-smells",
    });
  }

  // Python security
  const pythonSecurity = findings.filter((f) => f.category === "python-security");
  if (pythonSecurity.length > 0) {
    roasts.push({
      target: pythonSecurity[0].file || "Python security",
      message: pick(pythonSecurityRoasts),
      category: "python-security",
    });
  }

  // Python class design
  const pythonDesign = findings.filter((f) => f.category === "python-design");
  if (pythonDesign.length > 0) {
    roasts.push({
      target: pythonDesign[0].file || "Python classes",
      message: pick(pythonDesignRoasts),
      category: "python-design",
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

  const vueIssues = findings.filter((f) => f.category === "vue-issues");
  if (vueIssues.length > 0) {
    roasts.push({
      target: vueIssues[0].file || "Vue code",
      message: pick(vueIssuesRoasts),
      category: "vue-issues",
    });
  }

  const angularIssues = findings.filter((f) => f.category === "angular-issues");
  if (angularIssues.length > 0) {
    roasts.push({
      target: angularIssues[0].file || "Angular code",
      message: pick(angularIssuesRoasts),
      category: "angular-issues",
    });
  }

  const svelteIssues = findings.filter((f) => f.category === "svelte-issues");
  if (svelteIssues.length > 0) {
    roasts.push({
      target: svelteIssues[0].file || "Svelte code",
      message: pick(svelteIssuesRoasts),
      category: "svelte-issues",
    });
  }

  const expressIssues = findings.filter((f) => f.category === "express-issues");
  if (expressIssues.length > 0) {
    roasts.push({
      target: expressIssues[0].file || "Express code",
      message: pick(expressIssuesRoasts),
      category: "express-issues",
    });
  }

  const fastapiIssues = findings.filter((f) => f.category === "fastapi-issues");
  if (fastapiIssues.length > 0) {
    roasts.push({
      target: fastapiIssues[0].file || "FastAPI code",
      message: pick(fastapiIssuesRoasts),
      category: "fastapi-issues",
    });
  }

  const auditFindings = findings.filter(f => f.category === 'npm-audit' && f.severity !== 'info');
  if (auditFindings.length > 0) {
    roasts.push({ target: 'dependencies', message: pick(depAuditRoasts), category: 'npm-audit' });
  }

  const outdatedFindings = findings.filter(f => f.category === 'dep-outdated' && f.severity === 'warning');
  if (outdatedFindings.length > 0) {
    roasts.push({ target: 'dependencies', message: pick(depOutdatedRoasts), category: 'dep-outdated' });
  }

  const rubyIssues = findings.filter((f) => f.category === "ruby-issues" || f.category === "ruby-style");
  if (rubyIssues.length > 0) {
    roasts.push({ target: rubyIssues[0].file || "Ruby code", message: pick(rubyRoasts), category: "ruby-issues" });
  }

  const phpIssues = findings.filter((f) => f.category === "php-smell" || f.category === "php-issues");
  if (phpIssues.length > 0) {
    roasts.push({ target: phpIssues[0].file || "PHP code", message: pick(phpRoasts), category: "php-issues" });
  }

  const swiftIssues = findings.filter((f) => f.category === "swift-issues" || f.category === "swift-async");
  if (swiftIssues.length > 0) {
    roasts.push({ target: swiftIssues[0].file || "Swift code", message: pick(swiftRoasts), category: "swift-issues" });
  }

  const kotlinIssues = findings.filter((f) => f.category === "kotlin-issues" || f.category === "kotlin-coroutine");
  if (kotlinIssues.length > 0) {
    roasts.push({ target: kotlinIssues[0].file || "Kotlin code", message: pick(kotlinRoasts), category: "kotlin-issues" });
  }

  const testQuality = findings.filter(f => f.category === "test-quality");
  if (testQuality.length > 0) {
    roasts.push({
      target: testQuality[0].file || "test suite",
      message: pick(testQualityRoasts),
      category: "test-quality",
    });
  }

  const licenseIssues = findings.filter(f => f.category === 'license-compliance' && f.severity !== 'info');
  if (licenseIssues.length > 0) {
    roasts.push({
      target: 'dependencies',
      message: pick(licenseRoasts),
      category: 'license-compliance',
    });
  }

  const configIssues = findings.filter(f => f.category === 'config-audit');
  if (configIssues.length > 0) {
    roasts.push({
      target: configIssues[0].file || 'config',
      message: pick(configAuditRoasts),
      category: 'config-audit',
    });
  }

  const dbIssues = findings.filter(f => ['db-n-plus-one', 'db-sql-injection', 'db-over-fetch', 'db-destructive'].includes(f.category));
  if (dbIssues.length > 0) {
    roasts.push({ target: 'database', message: pick(databaseRoasts), category: 'database' });
  }

  const bundleIssues = findings.filter(f => f.category === 'bundle-size' && f.severity !== 'info');
  if (bundleIssues.length > 0) {
    roasts.push({ target: 'bundle', message: pick(bundleSizeRoasts), category: 'bundle-size' });
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

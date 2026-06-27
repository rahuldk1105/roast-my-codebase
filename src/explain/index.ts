import chalk from 'chalk';

export interface CategoryExplanation {
  category: string;
  title: string;
  summary: string;
  whyItMatters: string;
  howToFix: string[];
  example?: {
    bad: string;
    good: string;
    language: string;
  };
  severity: 'critical' | 'warning' | 'info';
  learnMore?: string;
}

const EXPLANATIONS: Record<string, CategoryExplanation> = {
  'large-files': {
    category: 'large-files',
    title: 'Large Files',
    summary: 'Source files that have grown too large to be easily understood or maintained.',
    whyItMatters: 'Large files are harder to review, test, and modify safely. They often violate the Single Responsibility Principle, making changes riskier and merge conflicts more common. Files over 500 lines are a signal that responsibilities should be separated.',
    howToFix: [
      'Identify the distinct responsibilities in the file',
      'Extract related functions/classes into separate modules',
      'Create clear boundaries: one file = one concept',
      'Aim for files under 300 lines for most use cases',
      'Use barrel exports (index.ts) to re-export if needed',
    ],
    example: {
      bad: '// auth.service.ts — 2000 lines\n// handles: login, register, password reset,\n// email verification, 2FA, session management',
      good: '// auth/login.service.ts\n// auth/register.service.ts\n// auth/password-reset.service.ts\n// auth/index.ts — re-exports all',
      language: 'typescript',
    },
    severity: 'warning',
  },

  'complexity': {
    category: 'complexity',
    title: 'High Cyclomatic Complexity',
    summary: 'Functions with too many branches (if/else, loops, switch cases) are hard to test and maintain.',
    whyItMatters: 'Cyclomatic complexity measures the number of independent paths through a function. High complexity means more test cases needed, higher bug probability, and harder code reviews. Functions above 10 are hard to test; above 15 are hard to reason about.',
    howToFix: [
      'Extract nested conditions into well-named helper functions',
      'Use early returns to reduce nesting depth',
      'Replace switch statements with lookup maps where possible',
      'Break large functions into smaller, single-purpose functions',
      'Use polymorphism instead of type-checking conditionals',
    ],
    example: {
      bad: 'function process(type, data) {\n  if (type === "a") {\n    if (data.x) {\n      if (data.y) { /* ... */ }\n    }\n  } else if (type === "b") { /* ... */ }\n}',
      good: 'function process(type, data) {\n  const handler = handlers[type];\n  return handler?.(data) ?? handleUnknown(data);\n}',
      language: 'typescript',
    },
    severity: 'warning',
  },

  'circular-deps': {
    category: 'circular-deps',
    title: 'Circular Dependencies',
    summary: 'Module A imports from Module B which imports from Module A, creating a dependency cycle.',
    whyItMatters: 'Circular dependencies cause initialization order issues, make tree-shaking impossible, and create tight coupling between modules. They are a sign of architectural problems and make refactoring much harder.',
    howToFix: [
      'Identify which direction the dependency should flow',
      'Extract shared types/interfaces into a separate module',
      'Use dependency injection instead of direct imports',
      'Create a third module that both can import from',
      'Use lazy imports or dynamic import() as a temporary workaround',
    ],
    example: {
      bad: '// a.ts imports b.ts\n// b.ts imports a.ts\n// Result: undefined at runtime',
      good: '// shared.ts — types and interfaces\n// a.ts imports from shared.ts\n// b.ts imports from shared.ts',
      language: 'typescript',
    },
    severity: 'critical',
  },

  'type-safety': {
    category: 'type-safety',
    title: 'Type Safety Issues',
    summary: "Use of `any`, `@ts-ignore`, or unsafe type casts that bypass TypeScript's type checking.",
    whyItMatters: "TypeScript's value comes from catching type errors at compile time. Every `any` and `@ts-ignore` creates a hole in that safety net. Runtime type errors are more expensive to debug than compile-time errors.",
    howToFix: [
      'Replace `any` with specific types or `unknown` for truly unknown types',
      'Use type guards to narrow `unknown` types safely',
      'Replace `@ts-ignore` with `@ts-expect-error` and a comment explaining why',
      'Use generics to maintain type information across function boundaries',
      'Install `@types/` packages for untyped dependencies',
    ],
    example: {
      bad: 'function processData(data: any) {\n  return data.value.toString(); // runtime error if wrong\n}',
      good: 'function processData(data: { value: unknown }) {\n  if (typeof data.value !== "string") throw new Error("...");\n  return data.value;\n}',
      language: 'typescript',
    },
    severity: 'warning',
  },

  'dead-exports': {
    category: 'dead-exports',
    title: 'Dead Exports',
    summary: 'Exported symbols that are never imported anywhere in the codebase.',
    whyItMatters: 'Dead exports increase the public API surface unnecessarily, confuse developers about what is actually used, prevent tree-shaking from working optimally, and add maintenance burden.',
    howToFix: [
      'Remove the export keyword if the symbol is only used internally',
      'Delete the symbol entirely if it is truly unused',
      'Check if it is used by external consumers before removing (if this is a library)',
      'Use a barrel file (index.ts) to control what is truly public',
    ],
    example: {
      bad: 'export function helperFunction() { /* never imported */ }',
      good: 'function helperFunction() { /* internal use only */ }',
      language: 'typescript',
    },
    severity: 'info',
  },

  'duplicates': {
    category: 'duplicates',
    title: 'Duplicate Code',
    summary: 'Similar or identical code blocks that appear in multiple places.',
    whyItMatters: 'Duplicate code means bug fixes and changes must be applied in multiple places. When copies diverge slightly, it creates subtle inconsistencies. It also inflates codebase size and makes refactoring harder.',
    howToFix: [
      'Extract the common logic into a shared function or module',
      'Use inheritance or composition to share behavior',
      'Create utility functions for repeated operations',
      'Consider if the similarity is coincidental or structural',
    ],
    severity: 'warning',
  },

  'todos': {
    category: 'todos',
    title: 'TODO/FIXME Comments',
    summary: 'Code comments marking unfinished work, known bugs, or technical debt.',
    whyItMatters: 'TODO comments without issue tracking references are easily forgotten. They accumulate over time, representing untracked technical debt. FIXME markers indicate known bugs that ship to production.',
    howToFix: [
      'Create issue tracker tickets for each TODO/FIXME',
      'Add the ticket reference: // TODO(#123): description',
      'Address high-priority FIXMEs before release',
      'Schedule a regular TODO review in team meetings',
      'Use linting rules to require ticket numbers on TODOs',
    ],
    severity: 'info',
  },

  'test-coverage': {
    category: 'test-coverage',
    title: 'Missing Test Files',
    summary: 'Source files that have no corresponding test file.',
    whyItMatters: 'Untested code is a liability. Without tests, regressions go undetected, refactoring is risky, and debugging takes longer. Test coverage is a leading indicator of code quality and team confidence.',
    howToFix: [
      'Create test files alongside source files (file.test.ts next to file.ts)',
      'Start with the most critical or complex functions',
      'Use test-driven development (TDD) for new features',
      'Aim for tests on all public functions and edge cases',
      'Use coverage tools (c8, istanbul) to identify gaps',
    ],
    severity: 'info',
  },

  'test-quality': {
    category: 'test-quality',
    title: 'Test Quality Issues',
    summary: 'Tests that exist but do not actually verify behavior — empty tests, always-true assertions, or focused tests.',
    whyItMatters: 'Low-quality tests give false confidence. `expect(true).toBe(true)` passes but proves nothing. `.only` tests silently skip the rest of the suite in CI. Empty tests inflate coverage metrics while providing no protection.',
    howToFix: [
      'Replace always-true assertions with assertions on actual code behavior',
      'Remove or implement skipped tests — do not let them accumulate',
      'Remove .only from tests before committing',
      'Every test should have at least one assertion on the code under test',
      'Use test coverage to find tests that pass with broken implementations',
    ],
    example: {
      bad: 'it("works", () => {\n  expect(true).toBe(true); // always passes\n});',
      good: 'it("returns user by id", async () => {\n  const user = await getUser(1);\n  expect(user.id).toBe(1);\n  expect(user.name).toBeTruthy();\n});',
      language: 'typescript',
    },
    severity: 'critical',
  },

  'security': {
    category: 'security',
    title: 'Security Vulnerabilities',
    summary: "Code patterns that introduce security vulnerabilities: hardcoded secrets, eval(), or environment files in git.",
    whyItMatters: 'Security vulnerabilities in source code are often permanent once committed — git history preserves them even after removal. eval() with user input is a remote code execution vector. Secrets in git must be rotated immediately.',
    howToFix: [
      'Never commit secrets — use environment variables',
      'Add .env files to .gitignore before the first commit',
      'Rotate any secrets that have been committed immediately',
      'Replace eval() with safer alternatives (JSON.parse, Function constructors with validation)',
      'Use a secrets scanner in CI (e.g., truffleHog, gitleaks)',
    ],
    severity: 'critical',
  },

  'npm-audit': {
    category: 'npm-audit',
    title: 'Dependency Vulnerabilities (npm audit)',
    summary: 'Dependencies with known security vulnerabilities (CVEs) detected by npm audit.',
    whyItMatters: 'Vulnerable dependencies are one of the most common attack vectors. Critical and high CVEs can lead to data breaches, RCE, or denial of service. Supply chain attacks increasingly target npm packages.',
    howToFix: [
      'Run `npm audit fix` to apply automatic fixes',
      'Manually update packages with breaking changes: `npm install pkg@latest`',
      'Review audit reports with `npm audit` for context on each CVE',
      'Add `npm audit --audit-level=high` to CI to fail on high/critical CVEs',
      'Consider `overrides` in package.json to force patched versions of transitive deps',
    ],
    severity: 'critical',
  },

  'license-compliance': {
    category: 'license-compliance',
    title: 'License Compliance Issues',
    summary: 'Dependencies with licenses that may be incompatible with commercial use (GPL, AGPL, LGPL).',
    whyItMatters: 'GPL and AGPL licenses require derivative works to also be open source. Using GPL-licensed packages in proprietary software without compliance creates legal exposure. LGPL is weaker but still has requirements around dynamic linking.',
    howToFix: [
      'Replace GPL/AGPL packages with MIT/Apache-2.0 licensed alternatives',
      'Consult legal counsel before shipping GPL dependencies in proprietary products',
      'For LGPL: ensure dynamic linking (not static) and provide relinking instructions',
      'Document all dependency licenses in a LICENSE-THIRD-PARTY file',
      'Use tools like `license-checker` to audit all licenses automatically',
    ],
    severity: 'critical',
  },

  'config-audit': {
    category: 'config-audit',
    title: 'Configuration Issues',
    summary: 'Missing or weak settings in TypeScript, ESLint, or Prettier configuration.',
    whyItMatters: 'TypeScript without `strict` mode misses entire classes of bugs. ESLint without TypeScript rules leaves type-related issues undetected. Inconsistent Prettier configuration causes formatting conflicts.',
    howToFix: [
      'Enable `strict: true` in tsconfig.json — it activates 8 checks at once',
      'Add `@typescript-eslint` to ESLint for TypeScript-specific rules',
      'Commit a `.prettierrc` to standardize formatting across the team',
      'Enable `noUncheckedIndexedAccess` for safer array/object access',
      'Consider `exactOptionalPropertyTypes` for more precise optional handling',
    ],
    severity: 'warning',
  },

  'db-n-plus-one': {
    category: 'db-n-plus-one',
    title: 'N+1 Query Pattern',
    summary: 'A database query inside a loop causes N queries for N items instead of 1.',
    whyItMatters: "N+1 queries are one of the most common performance problems in applications using ORMs. Fetching 100 users and querying each user's posts separately makes 101 queries instead of 2. At scale, this causes serious latency and database load.",
    howToFix: [
      'Use eager loading: Prisma `include`, TypeORM `relations`, Sequelize `include`',
      'Use a single query with JOIN instead of multiple queries',
      'Use DataLoader pattern for batching related queries',
      'Profile your database queries in development to catch N+1 early',
    ],
    example: {
      bad: '// N+1: queries once per user\nconst users = await prisma.user.findMany();\nfor (const user of users) {\n  user.posts = await prisma.post.findMany({ where: { userId: user.id } });\n}',
      good: '// 1 query with include\nconst users = await prisma.user.findMany({\n  include: { posts: true }\n});',
      language: 'typescript',
    },
    severity: 'warning',
  },

  'db-sql-injection': {
    category: 'db-sql-injection',
    title: 'SQL Injection Risk',
    summary: 'User input is directly interpolated into SQL queries without parameterization.',
    whyItMatters: 'SQL injection is consistently in the OWASP Top 10. It allows attackers to read, modify, or delete any data in the database, and in some configurations execute OS commands.',
    howToFix: [
      'Use parameterized queries / prepared statements',
      'Use ORM query methods that handle escaping automatically',
      'For Prisma: use tagged template literals with $queryRaw`...`',
      'Validate and whitelist user input that must appear in queries',
      'Never concatenate user input directly into query strings',
    ],
    example: {
      bad: 'const users = await db.query("SELECT * FROM users WHERE name = \'" + name + "\'");',
      good: 'const users = await db.query("SELECT * FROM users WHERE name = $1", [name]);',
      language: 'typescript',
    },
    severity: 'critical',
  },

  'bundle-size': {
    category: 'bundle-size',
    title: 'Bundle Size Regression',
    summary: 'The compiled bundle has grown significantly compared to the previous build.',
    whyItMatters: 'Bundle size directly impacts load time, especially on mobile and slow connections. A 50% bundle size increase can mean a 50% longer time-to-interactive. Users abandon sites that take more than 3 seconds to load.',
    howToFix: [
      'Use `import()` dynamic imports to code-split large features',
      'Check for accidentally bundled development dependencies',
      'Use bundle analyzers (webpack-bundle-analyzer, vite bundle visualizer)',
      'Replace heavy libraries with lighter alternatives',
      'Enable tree-shaking and ensure your exports are side-effect free',
    ],
    severity: 'warning',
  },

  'git-churn': {
    category: 'git-churn',
    title: 'High File Churn',
    summary: 'Files that are modified very frequently, indicating instability or unclear ownership.',
    whyItMatters: 'High churn files are risky to modify — they are likely to have merge conflicts, unclear responsibilities, or frequently changing requirements. They often indicate the abstraction is wrong or the file is doing too much.',
    howToFix: [
      'Analyze why the file keeps changing — requirements, bugs, or poor abstractions?',
      'Consider splitting the file if it owns multiple responsibilities',
      'Add tests to reduce risky modifications',
      'Document the intended scope to prevent scope creep',
    ],
    severity: 'warning',
  },

  'ruby-style': {
    category: 'ruby-style',
    title: 'Ruby Style Issues',
    summary: 'Missing frozen_string_literal, long methods, or debug output in Ruby code.',
    whyItMatters: 'frozen_string_literal reduces memory allocation and prevents accidental string mutation. Long methods are harder to test and understand. Debug output (puts) left in production code pollutes logs.',
    howToFix: [
      'Add `# frozen_string_literal: true` to the top of every Ruby file',
      'Extract long methods into smaller, focused methods',
      'Replace puts with a proper logger (Rails.logger, Logger)',
      'Use Rubocop to enforce consistent style automatically',
    ],
    severity: 'info',
  },

  'php-smell': {
    category: 'php-smell',
    title: 'PHP Code Quality Issues',
    summary: 'Missing strict_types, god classes, or unsafe patterns in PHP code.',
    whyItMatters: 'PHP without strict_types silently coerces types, hiding bugs. God classes violate SRP and are hard to test. Missing security practices make PHP especially vulnerable.',
    howToFix: [
      'Add `declare(strict_types=1)` to every PHP file',
      'Split large classes into focused services',
      'Use prepared statements for all database queries',
      'Use password_hash() and password_verify() instead of md5/sha1',
    ],
    severity: 'warning',
  },

  'kotlin-coroutine': {
    category: 'kotlin-coroutine',
    title: 'Kotlin Coroutine Misuse',
    summary: 'Use of GlobalScope or runBlocking that undermines structured concurrency.',
    whyItMatters: 'GlobalScope launches coroutines that live for the entire application lifetime, causing memory leaks and hard-to-cancel work. runBlocking blocks the calling thread, defeating the purpose of coroutines.',
    howToFix: [
      'Use a CoroutineScope tied to the component lifecycle instead of GlobalScope',
      'In Android: use viewModelScope, lifecycleScope, or rememberCoroutineScope',
      'Replace runBlocking with proper coroutine scope in tests: runTest',
      'Use supervisorScope for independent child coroutines',
    ],
    severity: 'warning',
  },

  'swift-async': {
    category: 'swift-async',
    title: 'Swift Async/Concurrency Issues',
    summary: 'Callback pyramids or mixed concurrency models in Swift code.',
    whyItMatters: 'Callback pyramids (closure hell) are hard to read and error-prone. Mixing async/await with completion handlers creates confusing control flow. Missing @MainActor annotations cause UI updates from background threads.',
    howToFix: [
      'Migrate completion handlers to async/await (Swift 5.5+)',
      'Use withCheckedContinuation to bridge callback APIs to async',
      'Mark UI-updating functions with @MainActor',
      'Use structured concurrency with async let for parallel work',
    ],
    severity: 'info',
  },

  'unused-deps': {
    category: 'unused-deps',
    title: 'Unused Dependencies',
    summary: 'Packages listed in package.json that are never imported anywhere in the codebase.',
    whyItMatters: 'Unused dependencies bloat node_modules, slow down installs, increase security exposure from unneeded packages, and confuse developers about what the project actually needs. Each unused package is a potential CVE you are carrying for no benefit.',
    howToFix: [
      'Run `npx depcheck` to find unused dependencies automatically',
      'Remove unused packages with `npm uninstall <pkg>`',
      'Review peer dependencies — some are required at runtime without direct imports',
      'Check if packages are used in scripts or config files before removing',
    ],
    severity: 'info',
  },

  'dependencies': {
    category: 'dependencies',
    title: 'Dependency Health Issues',
    summary: 'General dependency problems including outdated packages, missing peer dependencies, or an excessive number of direct dependencies.',
    whyItMatters: 'Outdated dependencies accumulate security vulnerabilities and make future upgrades harder. Missing peer dependencies cause silent runtime failures. Too many direct dependencies signal a lack of abstraction and increase maintenance burden.',
    howToFix: [
      'Run `npm outdated` to see which packages have newer versions available',
      'Update incrementally: patch and minor versions first, then majors',
      'Review peer dependency warnings during `npm install` and address them',
      'Evaluate whether each dependency could be replaced with a native solution',
    ],
    severity: 'warning',
  },

  'structure': {
    category: 'structure',
    title: 'Project Structure Issues',
    summary: 'Missing standard directories (src/, tests/), absent configuration files, or deeply nested folder hierarchies that make navigation difficult.',
    whyItMatters: 'A clear project structure reduces onboarding time and cognitive load. Missing conventions mean every developer navigates differently. Deeply nested folders make imports fragile and refactoring harder.',
    howToFix: [
      'Adopt a standard layout: src/ for source, tests/ for tests, config files at root',
      'Keep nesting shallow — more than 4 levels is usually a sign of over-organization',
      'Co-locate test files with source files or use a mirrored tests/ directory',
      'Add an index.ts barrel file in each major directory for clean imports',
    ],
    severity: 'info',
  },

  'pr-size': {
    category: 'pr-size',
    title: 'Oversized Pull Requests',
    summary: 'Pull requests that are too large to review effectively — typically more than 400 lines changed.',
    whyItMatters: 'Large PRs receive superficial reviews because reviewers lose focus after ~400 lines. They are harder to revert, more likely to have conflicts, and take much longer to land. Research shows review quality drops sharply above 200-400 lines.',
    howToFix: [
      'Break large features into smaller, independently mergeable PRs',
      'Use feature flags to merge incomplete work safely',
      'Separate refactoring commits from feature commits',
      'Aim for PRs that can be reviewed in under 30 minutes',
    ],
    severity: 'warning',
  },

  'env-in-git': {
    category: 'env-in-git',
    title: 'Environment Files in Git',
    summary: '.env files or other secret configuration files committed to the repository.',
    whyItMatters: 'Once a secret is committed to git, it lives in history forever — even after deletion. Anyone with repo access (or who ever had access) can retrieve it. Exposed secrets must be rotated immediately.',
    howToFix: [
      'Add .env, .env.local, .env.*.local to .gitignore immediately',
      'Use `git rm --cached .env` to untrack files without deleting them',
      'Rotate all secrets that were ever committed',
      'Use a .env.example file with placeholder values for documentation',
      'Consider git-secrets or truffleHog as pre-commit checks',
    ],
    severity: 'critical',
  },

  'eval-usage': {
    category: 'eval-usage',
    title: 'eval() / Dynamic Function Usage',
    summary: 'Use of eval() or the Function() constructor with dynamic strings to execute arbitrary code.',
    whyItMatters: 'eval() with user-controlled input is a remote code execution vulnerability. Even with trusted input, eval() disables JavaScript engine optimizations, making code significantly slower. The Function() constructor carries the same risks.',
    howToFix: [
      'Replace eval() for JSON parsing with JSON.parse()',
      'Use lookup tables or switch statements instead of eval() for dynamic dispatch',
      'If you must evaluate expressions, use a sandboxed interpreter library',
      'Replace new Function(str) with explicit function definitions',
    ],
    severity: 'critical',
  },

  'python-security': {
    category: 'python-security',
    title: 'Python Security Issues',
    summary: 'Security vulnerabilities in Python code including pickle deserialization, shell injection, or hardcoded secrets.',
    whyItMatters: 'pickle.loads() with untrusted data allows arbitrary code execution — it is equivalent to eval(). subprocess calls with shell=True and user input enable shell injection. Hardcoded secrets in Python files are just as dangerous as in any other language.',
    howToFix: [
      'Replace pickle with json or safer serialization formats for untrusted data',
      'Use subprocess with a list of arguments instead of shell=True',
      'Move secrets to environment variables and use python-dotenv or similar',
      'Run bandit (pip install bandit) to automatically detect security issues',
    ],
    severity: 'critical',
  },

  'python-smells': {
    category: 'python-smells',
    title: 'Python Code Smells',
    summary: 'Code quality issues in Python including bare except clauses, mutable default arguments, or overly broad exception handling.',
    whyItMatters: 'Bare `except:` catches SystemExit and KeyboardInterrupt, making programs impossible to terminate. Mutable default arguments (like `def f(x=[])`) share state across calls, causing hard-to-find bugs. These patterns indicate misunderstanding of Python semantics.',
    howToFix: [
      'Replace bare `except:` with `except Exception:` or specific exception types',
      'Replace mutable default arguments with `None` and initialize inside the function',
      'Use `logging` instead of print() for diagnostic output',
      'Run pylint or flake8 to catch common smells automatically',
    ],
    severity: 'warning',
  },

  'python-imports': {
    category: 'python-imports',
    title: 'Python Import Issues',
    summary: 'Wildcard imports (`from module import *`) or import organization issues that reduce code clarity.',
    whyItMatters: 'Wildcard imports pollute the namespace and make it impossible to know where a name comes from without checking the module. They also break static analysis tools and make refactoring much harder. Circular imports cause ImportError at runtime.',
    howToFix: [
      'Replace `from module import *` with explicit named imports',
      'Organize imports: stdlib first, third-party second, local last (use isort)',
      'Resolve circular imports by extracting shared code into a separate module',
      'Use `__all__` in modules to control what wildcard imports would expose',
    ],
    severity: 'warning',
  },

  'go-error-handling': {
    category: 'go-error-handling',
    title: 'Go Error Handling Issues',
    summary: 'Ignored errors (assigning to `_`) or poor error wrapping that loses context in Go code.',
    whyItMatters: 'Ignored errors in Go are silent failures — the program continues in an invalid state. Without error wrapping, stack traces are lost and debugging becomes guesswork. Go\'s explicit error handling is a feature; working around it defeats the purpose.',
    howToFix: [
      'Never assign errors to `_` unless you have documented why it is safe',
      'Wrap errors with context: `fmt.Errorf("operation failed: %w", err)`',
      'Use errors.Is() and errors.As() to check wrapped error types',
      'Consider the github.com/pkg/errors package for stack traces',
    ],
    severity: 'warning',
  },

  'rust-unsafe': {
    category: 'rust-unsafe',
    title: 'Rust Unsafe Blocks',
    summary: 'Use of `unsafe` blocks that bypass Rust\'s memory safety guarantees.',
    whyItMatters: "Rust's safety guarantees are its primary value proposition. Every `unsafe` block is a contract that the developer guarantees safety manually — without compiler verification. Incorrect unsafe code causes undefined behavior, memory corruption, and security vulnerabilities.",
    howToFix: [
      'Minimize the scope of unsafe blocks to the minimum necessary code',
      'Document every unsafe block with a comment explaining why it is safe',
      'Prefer safe abstractions from the standard library over raw pointers',
      'Use the `cargo geiger` tool to audit unsafe usage in your project',
    ],
    severity: 'warning',
  },

  'java-smells': {
    category: 'java-smells',
    title: 'Java Code Quality Issues',
    summary: 'Java anti-patterns including returning null instead of Optional, using raw generic types, or abusing checked exceptions.',
    whyItMatters: 'Returning null forces callers to do null checks everywhere, and missed checks cause NullPointerExceptions. Raw types lose type safety and generate unchecked warnings. Overusing checked exceptions forces callers to handle errors they cannot meaningfully recover from.',
    howToFix: [
      'Return Optional<T> instead of null for values that may be absent',
      'Always specify type parameters for generic types (List<String> not List)',
      'Reserve checked exceptions for recoverable conditions the caller can handle',
      'Use Objects.requireNonNull() at the start of methods for fail-fast behavior',
    ],
    severity: 'warning',
  },

  'csharp-async': {
    category: 'csharp-async',
    title: 'C# Async/Await Misuse',
    summary: 'Use of async void, .Result, or .Wait() that causes deadlocks or swallows exceptions in C# code.',
    whyItMatters: 'async void methods cannot be awaited, so exceptions are unhandled and crash the process. Calling .Result or .Wait() on a Task in a synchronization context causes deadlocks. These patterns are common mistakes that cause production incidents.',
    howToFix: [
      'Replace async void with async Task (except for event handlers)',
      'Replace .Result and .Wait() with await — propagate async up the call stack',
      'Use ConfigureAwait(false) in library code to avoid context capture',
      'Use CancellationToken parameters to support cancellation',
    ],
    severity: 'critical',
  },

  'vue-issues': {
    category: 'vue-issues',
    title: 'Vue Component Quality Issues',
    summary: 'Vue anti-patterns including missing :key in v-for loops, direct Vuex state mutation, or other component issues.',
    whyItMatters: 'Missing :key in v-for causes Vue to reuse DOM nodes incorrectly, leading to subtle rendering bugs. Mutating Vuex state directly bypasses reactivity tracking, causing components to not update. These patterns cause hard-to-debug UI inconsistencies.',
    howToFix: [
      'Always add :key with a stable unique identifier to v-for loops',
      'Never mutate Vuex state directly — always use mutations or actions',
      'Use Vue DevTools to inspect component state and event flow',
      'Enable Vue strict mode in development to catch direct mutations',
    ],
    severity: 'warning',
  },

  'angular-issues': {
    category: 'angular-issues',
    title: 'Angular Anti-Patterns',
    summary: 'Angular issues including nested subscriptions, missing OnPush change detection, or unsubscribed Observables.',
    whyItMatters: 'Nested subscriptions create callback hell and make error handling complex. Without OnPush, Angular checks every component on every change detection cycle, causing performance problems at scale. Unsubscribed Observables cause memory leaks.',
    howToFix: [
      'Use switchMap, mergeMap, or concatMap instead of nested subscriptions',
      'Add ChangeDetectionStrategy.OnPush to performance-sensitive components',
      'Use the async pipe in templates to auto-unsubscribe from Observables',
      'Use takeUntilDestroyed() or the ngOnDestroy pattern to clean up subscriptions',
    ],
    severity: 'warning',
  },

  'express-issues': {
    category: 'express-issues',
    title: 'Express.js Issues',
    summary: 'Express security and error-handling problems including missing error middleware, no rate limiting, or absent input validation.',
    whyItMatters: 'Express apps without error middleware expose stack traces to users and crash on unhandled errors. Without rate limiting, endpoints are vulnerable to brute force and DoS attacks. Unvalidated input reaches business logic and databases.',
    howToFix: [
      'Add a global error handler: `app.use((err, req, res, next) => {...})`',
      'Use express-rate-limit on authentication and public endpoints',
      'Validate all request bodies with zod, joi, or express-validator',
      'Add helmet middleware for security headers: `app.use(helmet())`',
    ],
    severity: 'warning',
  },

  'nextjs-metadata': {
    category: 'nextjs-metadata',
    title: 'Next.js Metadata & Component Issues',
    summary: 'Missing metadata exports, improper next/image usage, or absent error boundaries in Next.js pages.',
    whyItMatters: 'Missing metadata (title, description) hurts SEO and social sharing. Using <img> instead of next/image misses automatic optimization, lazy loading, and CLS prevention. Missing error.tsx boundaries cause the entire app to crash on unhandled errors.',
    howToFix: [
      'Export a `metadata` object or `generateMetadata` function from every page',
      'Replace <img> tags with next/image for automatic optimization',
      'Add error.tsx and loading.tsx files to each route segment',
      'Use not-found.tsx to handle 404s gracefully in the App Router',
    ],
    severity: 'warning',
  },
};

export function getExplanation(category: string): CategoryExplanation | null {
  // Try exact match first, then lowercase, then lowercase with spaces replaced by hyphens
  return EXPLANATIONS[category]
    ?? EXPLANATIONS[category.toLowerCase()]
    ?? EXPLANATIONS[category.toLowerCase().replace(/\s+/g, '-')]
    ?? null;
}

export function listCategories(): string[] {
  return Object.keys(EXPLANATIONS).sort();
}

function wordWrap(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

export function renderExplanation(exp: CategoryExplanation): string {
  const lines: string[] = [];
  const BOX_WIDTH = 61;

  // Severity badge color
  const severityColor =
    exp.severity === 'critical' ? chalk.red :
    exp.severity === 'warning' ? chalk.yellow :
    chalk.blue;

  // Box header
  lines.push('');
  lines.push(chalk.dim('  ┌' + '─'.repeat(BOX_WIDTH) + '┐'));
  const categoryTag = `[${exp.category}]`;
  const titlePadded = exp.title.padEnd(BOX_WIDTH - categoryTag.length - 2);
  lines.push(
    chalk.dim('  │  ') +
    chalk.bold.white(titlePadded) +
    chalk.dim(categoryTag + '  │')
  );
  lines.push(chalk.dim('  └' + '─'.repeat(BOX_WIDTH) + '┘'));
  lines.push('');

  // Summary (word-wrapped at ~60 chars)
  const summaryLines = wordWrap(exp.summary, 60);
  for (const line of summaryLines) {
    lines.push('  ' + chalk.white(line));
  }
  lines.push('');

  // WHY IT MATTERS
  lines.push('  ' + chalk.bold.yellow('WHY IT MATTERS'));
  lines.push('  ' + chalk.dim('──────────────'));
  const whyLines = wordWrap(exp.whyItMatters, 60);
  for (const line of whyLines) {
    lines.push('  ' + line);
  }
  lines.push('');

  // HOW TO FIX
  lines.push('  ' + chalk.bold.yellow('HOW TO FIX'));
  lines.push('  ' + chalk.dim('──────────'));
  for (const fix of exp.howToFix) {
    lines.push('  ' + chalk.dim('●') + ' ' + chalk.white(fix));
  }
  lines.push('');

  // EXAMPLE (optional)
  if (exp.example) {
    lines.push('  ' + chalk.bold.yellow('EXAMPLE'));
    lines.push('  ' + chalk.dim('───────'));
    lines.push('  ' + chalk.red('✗ Bad:') + '                        ' + chalk.green('✓ Good:'));

    const badLines = exp.example.bad.split('\n');
    const goodLines = exp.example.good.split('\n');
    const maxRows = Math.max(badLines.length, goodLines.length);

    for (let i = 0; i < maxRows; i++) {
      const badLine = (badLines[i] ?? '').padEnd(30);
      const goodLine = goodLines[i] ?? '';
      lines.push('  ' + chalk.dim(badLine) + '  ' + chalk.dim(goodLine));
    }
    lines.push('');
  }

  // Severity badge
  lines.push('  ' + severityColor(`Severity: ${exp.severity.toUpperCase()}`));
  lines.push('');

  return lines.join('\n');
}

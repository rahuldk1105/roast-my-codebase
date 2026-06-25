# Advanced Scanner Suite

## Overview

Four new scanners providing deep codebase insights: git patterns, security surface, test coverage, and framework best practices.

## Scanner 1: Git Insights (`git-insights.ts`)

**Purpose**: Analyze repository health through git history patterns.

### Features

1. **File Churn Detection**
   - Tracks files changed frequently in last 6 months
   - Warning: 50+ changes
   - Critical: 100+ changes
   - Indicates unstable/volatile code

2. **PR Size Analysis**
   - Calculates average files per merge commit
   - Warning: > 20 files
   - Critical: > 40 files
   - Large PRs are harder to review

3. **Stale Branches**
   - Finds branches not updated in 90+ days
   - Info severity (cleanup candidates)
   - Excludes main/master/HEAD

### Usage
```bash
# Requires git repository
roast-my-codebase /path/to/git/repo
```

### Git Commands Used
```bash
git rev-parse --git-dir                              # Check if git repo
git log --name-only --format="" --since="6 months ago"  # File churn
git log --format=%H --merges --since="6 months ago"    # PR commits
git diff-tree --no-commit-id --name-only -r <hash>   # Files in PR
git branch -a --format="%(refname:short) %(committerdate:unix)"  # Branches
```

## Scanner 2: Security Surface (`security.ts`)

**Purpose**: Detect security anti-patterns and vulnerabilities.

### Features

1. **Hardcoded Secrets**
   - AWS Access Keys: `AKIA[0-9A-Z]{16}` (critical)
   - Private Keys: `-----BEGIN ... PRIVATE KEY-----` (critical)
   - Generic API Keys: `api_key = "..."` (warning)
   - JWT Tokens: `eyJ...` (warning)
   - Excludes test files

2. **`.env` Files in Git**
   - Checks if `.env`, `.env.local`, `.env.production` tracked
   - Critical severity
   - Uses `git ls-files`

3. **`eval()` Usage**
   - Detects dangerous `eval(` patterns
   - Warning severity
   - Code injection risk

### Exclusions
- `**/test/**`, `**/tests/**`, `**/__tests__/**`
- `**/*.test.*`, `**/*.spec.*`
- `**/examples/**`, `**/demo/**`

### Usage
```bash
# Scans all .ts, .tsx, .js, .jsx files
roast-my-codebase .
```

## Scanner 3: Test Coverage Gap (`test-coverage.ts`)

**Purpose**: Find source files without corresponding test files.

### Features

1. **Missing Test Detection**
   - Checks for `.test` or `.spec` files
   - Supports multiple patterns:
     - `file.ts` → `file.test.ts`
     - `file.ts` → `file.spec.ts`
     - `file.ts` → `__tests__/file.test.ts`
   - Reports up to 10 files individually
   - Summarizes additional files

2. **Coverage Calculation**
   - Returns percentage in stats
   - Format: `(tested / total) * 100`

### Exclusions
- Test files themselves
- Config files (`*.config.*`)
- Index files (`index.ts`, `index.js`)
- Type definitions (`*.d.ts`)
- Build artifacts (node_modules, dist, etc.)

### Usage
```bash
roast-my-codebase .
```

### Stats Returned
```typescript
{
  sourceFiles: 150,
  missingTests: 45,
  coveragePercent: "70.0"
}
```

## Scanner 4: Framework Checks (`framework.ts`)

**Purpose**: Enforce Next.js and React best practices.

### Features

1. **Next.js Metadata (App Router)**
   - Scans `app/**/page.{ts,tsx,js,jsx}`
   - Checks for `export const metadata` or `generateMetadata()`
   - Warning severity (SEO impact)

2. **Server/Client Component Mismatch**
   - Detects `useState`, `useEffect` without `'use client'`
   - Checks for event handlers (`onClick`, etc.)
   - Warning severity

3. **React Error Boundaries**
   - Checks root components:
     - `app/layout.tsx`
     - `app/error.tsx`
     - `pages/_app.tsx`
     - `src/App.tsx`
   - Looks for ErrorBoundary patterns
   - Info severity (nice-to-have)

### Framework Detection
Reads `package.json` dependencies:
- Next.js: `dependencies.next` or `devDependencies.next`
- React: `dependencies.react` or `devDependencies.react`

### Usage
```bash
# Automatically detects framework from package.json
roast-my-codebase /path/to/nextjs/app
```

## Integration

### Scanners in System

**Total scanners: 13**

Original 9:
1. Files
2. TODOs
3. Dependencies
4. Circular Dependencies
5. Structure
6. Complexity
7. Duplicates
8. Dead Exports
9. Type Safety

New 4:
10. Test Coverage
11. Git Insights
12. Security
13. Framework

### Health Score Impact

| Category | Deduction |
|----------|-----------|
| Git Churn | -3 per file |
| Large PR Size | -2 |
| Hardcoded Secret | -10 |
| .env in Git | -10 |
| eval() Usage | -3 |
| Missing Test | -0.5 per file |
| Framework Violation | -2 |

### Roast Categories

**Git Churn:**
- "This file changes more often than JavaScript frameworks."
- "Version control or version chaos? You decide."
- "This file has more revisions than a novel."

**Security:**
- "Secrets in git. Because what could go wrong?"
- "Your API keys are public. Consider them compromised."
- "eval() — when you want attackers to write your code for you."

**Test Coverage:**
- "Tests are optional, right? Right?"
- "This code is production-ready. Trust me."
- "Writing tests is for people who make mistakes."

**Framework:**
- "Next.js best practices are more like Next.js suggestions, apparently."
- "Missing metadata — search engines love mystery pages."
- "Client hooks in server components: bold strategy."

## Examples

### Git Insights Output
```
⚠ src/api/auth.ts changed 87 times in 6 months
⚠ Average PR changes 23 files — PRs are getting large
ℹ️ 12 branches haven't been updated in 90+ days
```

### Security Output
```
✗ Potential AWS Access Key found in src/config/aws.ts
✗ .env.production is tracked in git — secrets may be exposed
⚠ src/utils/eval-helper.ts uses eval() — potential code injection risk
```

### Test Coverage Output
```
ℹ️ src/api/users.ts has no corresponding test file
ℹ️ src/api/posts.ts has no corresponding test file
ℹ️ src/api/comments.ts has no corresponding test file
...and 42 more files without tests

Stats: 45 of 150 files missing tests (70.0% coverage)
```

### Framework Output
```
⚠ app/dashboard/page.tsx missing metadata export — SEO impact
⚠ app/profile/page.tsx uses client hooks without 'use client' directive
ℹ️ app/layout.tsx could benefit from an error boundary
```

## Performance

All scanners are optimized for speed:

- **Git Insights**: ~100-500ms (git operations)
- **Security**: ~200-800ms (file scanning + regex)
- **Test Coverage**: ~100-300ms (file matching)
- **Framework**: ~50-200ms (pattern matching)

**Total overhead**: ~500ms - 2s depending on repo size

## Testing

Comprehensive test coverage:
- **Git Insights**: 11 tests
- **Security**: 8 tests
- **Test Coverage**: 13 tests
- **Framework**: 33 tests

**Total new tests**: 65 (160 total tests in suite)

## CLI Integration

All scanners run automatically:

```bash
# Regular scan
roast-my-codebase .

# Watch mode (includes new scanners)
roast-my-codebase --watch

# Compare mode (includes new scanners)
roast-my-codebase --compare main

# With all features
roast-my-codebase --ascii --badge --fix
```

## Edge Cases Handled

### Git Insights
- ✅ Non-git repository (returns empty findings)
- ✅ No commits in last 6 months
- ✅ No merge commits
- ✅ Shallow clone

### Security
- ✅ Test files excluded from secret detection
- ✅ Non-git repo (skips .env check)
- ✅ Binary/unreadable files
- ✅ False positives in examples/demos

### Test Coverage
- ✅ 100% coverage (no findings)
- ✅ No source files
- ✅ Config/index/.d.ts exclusions
- ✅ Different test patterns

### Framework
- ✅ Not Next.js/React project
- ✅ Pages Router (skips App Router checks)
- ✅ No root components
- ✅ Client components (skips server checks)

## Dependencies

**Zero new dependencies!**

Uses existing:
- `child_process.spawnSync` (git commands)
- `fast-glob` (file scanning)
- `fs` (file reading)
- `path` (path manipulation)

## Future Enhancements

Potential additions:
- GitHub-specific patterns (Actions secrets)
- Database credentials detection
- Code coverage integration (nyc, istanbul)
- Component test matching (Cypress, Playwright)
- Vue/Svelte framework checks
- Webpack/Vite config analysis

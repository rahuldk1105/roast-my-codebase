# Features Summary

## Core Analysis Scanners (9 total)

### Original Scanners
1. **File Scanner** - File statistics, large file detection (500+, 1000+, 2000+ lines)
2. **TODO Scanner** - Detects TODO, FIXME, HACK, XXX comments
3. **Dependency Scanner** - Unused dependencies, excessive dependency counts
4. **Circular Dependency Scanner** - Import cycles between modules
5. **Structure Scanner** - Deep nesting, bloated folders, utility file explosion

### New Advanced Scanners
6. **Complexity Scanner** - Cyclomatic complexity analysis (flags 15+, critical at 25+)
7. **Duplicate Code Scanner** - Token-based duplicate detection with 6-line sliding window
8. **Dead Export Scanner** - Finds exports never imported anywhere
9. **Type Safety Scanner** - Counts `any` usage, `@ts-ignore`, `@ts-nocheck`

## Developer Experience Features

### 1. JSON Output (`--json`)
```bash
roast-my-codebase --json
```
- Outputs structured JSON instead of terminal formatting
- Perfect for CI/CD integration
- All report fields included: projectName, stats, health, findings, roasts, verdict, fixes

**CI Integration with Threshold:**
```bash
roast-my-codebase --json --threshold 80
```
- Exits with code 1 if health score < threshold
- Exits with code 0 if score >= threshold
- Use in CI to fail builds on quality regressions

### 2. Fix Suggestions (`--fix`)
```bash
roast-my-codebase --fix
```
- Shows actionable one-liner fixes for each finding
- Specific commands (e.g., `npm uninstall unused-package`)
- Refactoring guidance (e.g., "Extract nested logic into helper functions")
- Beautiful terminal rendering with 📝 icons

**Example suggestions:**
- Large files → "Split into smaller modules by extracting logical components"
- Complexity → "Refactor by extracting nested logic into helper functions"
- Duplicates → "Extract into a shared utility function or module"
- Unused deps → "Run: npm uninstall <package>"
- Circular deps → "Break cycle by introducing shared interface/type file"

### 3. Watch Mode (`--watch`)
```bash
roast-my-codebase --watch
```
- Monitors source files for changes using `chokidar`
- First run: shows full detailed report
- Subsequent runs: compact summary with score delta
- Color-coded deltas: green for improvements, red for regressions
- Shows which file triggered the re-scan
- Press Ctrl+C to stop

**Watch output format:**
```
📝 Changed: src/utils/helpers.ts

  Health: 85/100 +7 B Good
  ⚠ 12 warnings
  ● 8 info
```

### 4. Comparison Mode (`--compare <branch>`)
```bash
roast-my-codebase --compare main
```
- Compares current working directory against a git branch
- Uses temporary git worktrees (automatic cleanup)
- Shows score delta between current and branch
- Lists new findings introduced in current branch
- Lists resolved findings from the branch
- Shows unchanged issue count

**Comparison output format:**
```
Comparison Results
────────────────────────────────────────
Current:   72/100
main:      85/100
Delta:     -13

✗ 8 new issues:
  + Large file: auth.service.ts (1,200 lines)
  + Circular dependency: auth → user → auth
  ...

✓ 3 issues resolved:
  - Dead export: oldHelper in utils.ts
  - Unused dependency: moment
  ...

15 unchanged issues
```

## Combined Usage

All flags can be combined:

```bash
# Watch with fix suggestions
roast-my-codebase --watch --fix

# JSON output with fix suggestions
roast-my-codebase --json --fix

# Compare with main and show fixes
roast-my-codebase --compare main --fix

# CI pipeline with quality gate
roast-my-codebase --json --threshold 75 || exit 1
```

## Health Scoring System

**Starting score:** 100

**Deductions:**
- Large file (1000+ lines): -3
- Extreme file (2000+ lines): -5
- TODO/FIXME: -0.25 each
- Circular dependency: -5
- Unused dependency: -2
- Complex function (15+ complexity): -2
- Very complex function (25+ complexity): -4
- Duplicate code block: -3
- Dead export: -1
- Type safety issue: -2
- Critical type safety (20+ `any`): -5

**Grades:**
- 90-100: A (Excellent)
- 80-89: B (Good)
- 70-79: C (Fair)
- 60-69: D (Risky)
- 0-59: F (Chaotic)

## Test Coverage

- **63/63 tests passing** ✅
- 11 test files
- Coverage for all 9 scanners
- Edge case handling (empty projects, missing package.json, etc.)

## Performance

- Build time: ~13ms
- Scan time: <1s for 43 files, 3,800+ lines
- Completely offline operation
- Zero external API calls
- No telemetry or data collection

## Installation

```bash
# Run directly (no install)
npx roast-my-codebase

# Install globally
npm install -g roast-my-codebase

# With options
roast-my-codebase . --json --fix --threshold 80
```

## Requirements

- Node.js 18+
- Git (only for `--compare` mode)
- Works on any JavaScript/TypeScript project

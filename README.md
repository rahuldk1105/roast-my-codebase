# roast-my-codebase 🔥

> Get roasted. Get better. Ship faster.

A zero-config CLI that analyzes your codebase and delivers brutally honest (but funny) feedback. Every roast is backed by a real finding — no random nonsense.

```
npx roast-my-codebase
```

## What it does

Scans your project in seconds and produces:

- **Health Score** (0–100) based on real code quality signals
- **Project Statistics** — files, lines, dependencies
- **Actionable Findings** — large files, circular deps, unused packages, TODOs
- **Roasts** — humorous commentary tied to actual issues
- **Verdict** — a one-liner summary of your codebase's state

## Screenshot

```
╔═════════════════════════════╗
║    Roast My Codebase    🔥  ║
╚═════════════════════════════╝

  Project Health: 72/100  C  Fair

  [██████████████████████░░░░░░░░]

  Files Scanned      438
  Lines of Code      64,112
  Dependencies       87

  ⚠ 14 TODOs
  ⚠ 7 Large Files (500+ lines)
  ⚠ 2 Circular Dependencies

  🔥 Roast

  auth.service.ts (1,847 lines)
  This file contains several geological layers.

  Verdict:
  Your codebase is at that stage where 'refactor sprint'
  keeps getting postponed.
```

## Installation

```bash
# Run directly (no install needed)
npx roast-my-codebase

# Or install globally
npm install -g roast-my-codebase
roast-my-codebase
```

## Usage

```bash
# Basic scan
npx roast-my-codebase

# Scan specific path
npx roast-my-codebase ./path/to/project

# Get actionable fix suggestions
npx roast-my-codebase --fix

# AI-powered contextual roasts
npx roast-my-codebase --ai-roasts

# Interactive mode - walk through fixing issues
npx roast-my-codebase --interactive

# Preview fixes without applying them
npx roast-my-codebase --interactive --dry-run

# Watch mode (re-run on file changes)
npx roast-my-codebase --watch

# JSON output for CI/CD
npx roast-my-codebase --json --threshold 80

# Compare against a git branch
npx roast-my-codebase --compare main

# Viral features for sharing
npx roast-my-codebase --ascii          # Big ASCII art grade
npx roast-my-codebase --badge          # Generate SVG badge
npx roast-my-codebase --markdown       # Markdown for PRs
npx roast-my-codebase --markdown-file  # Save to .roast-report.md
```

## What gets analyzed

| Check | What it finds |
|-------|--------------|
| **File Size** | Files over 500/1000/2000 lines |
| **TODOs** | TODO, FIXME, HACK, XXX comments |
| **Dependencies** | Excessive or unused packages |
| **Circular Deps** | Import cycles between modules |
| **Structure** | Deep nesting, bloated folders, utils explosion |
| **Complexity** | Functions with high cyclomatic complexity (15+) |
| **Duplicates** | Copy-pasted code blocks across files |
| **Dead Exports** | Exports that are never imported |
| **Type Safety** | `any` usage, `@ts-ignore`, type bypasses |

## Supported Languages

### Fully Supported
- **JavaScript** (.js, .jsx, .mjs, .cjs)
- **TypeScript** (.ts, .tsx)
- **Python** (.py) - NEW! ✨
  - Complexity analysis
  - Type hints detection
  - Import pattern analysis

### Universal Features (All Languages)
- File size analysis
- TODO/FIXME detection
- Git insights
- Security scans

### Coming Soon
- Go (.go)
- Rust (.rs)
- Java (.java)
- C# (.cs)

Language detection is automatic! The tool detects your project's languages and runs appropriate scanners.

## Design principles

1. **Real value** — Humor is the presentation layer. Analysis is the product.
2. **Completely offline** — No APIs, no cloud, no telemetry, no data collection.
3. **Fast** — Under 3 seconds for repos with < 1000 files.
4. **Beautiful output** — Designed to be screenshot-worthy.

## Health Score

Starts at 100. Deductions for:

| Issue | Deduction |
|-------|-----------|
| Large file (1000+ lines) | -3 |
| Extreme file (2000+ lines) | -5 |
| Circular dependency | -5 |
| Unused dependency | -2 |
| TODO/FIXME (per occurrence) | -0.25 |
| Excessive total dependencies | -5 |
| Deep nesting | -2 |

Grades:
- **90–100** Excellent
- **80–89** Good
- **70–79** Fair
- **60–69** Risky
- **0–59** Chaotic

## Viral / Shareable Features

### ASCII Art Grade
```bash
roast-my-codebase --ascii
```
- Big, colorful letter grade at the top (A/B/C/D/F)
- Perfect for screenshots and social media
- Color-coded based on health score

### SVG Badge Generation
```bash
roast-my-codebase --badge
```
- Generates `.roast-badge.svg` for your README
- Shields.io-style badge showing "Health: 82/100"
- Color-coded: green (90+), yellow-green (80+), yellow (70+), orange (60+), red (<60)
- Embed in your README:
  ```markdown
  ![Codebase Health](.roast-badge.svg)
  ```

### Markdown Output
```bash
roast-my-codebase --markdown           # Output to stdout
roast-my-codebase --markdown-file      # Save to .roast-report.md
```
- Beautiful markdown with collapsible sections
- Perfect for GitHub PRs, Notion, and documentation
- Includes emoji severity indicators (🔴/⚠️/ℹ️)
- Tables for stats, blockquotes for roasts

## Developer Experience Features

### JSON Output for CI/CD
```bash
roast-my-codebase --json --threshold 80
```
- Machine-readable output
- Exit code 1 if score < threshold
- Perfect for CI pipelines

### Fix Suggestions
```bash
roast-my-codebase --fix
```
- Actionable one-liner fixes for each issue
- Specific commands (e.g., `npm uninstall unused-package`)
- Refactoring guidance

### AI-Powered Roasts
```bash
roast-my-codebase --ai-roasts
```
- 🤖 Context-aware roasts generated by Claude AI
- 🎯 Specific to your actual code issues
- 😄 More witty and relevant than generic roasts
- 💾 Cached for 7 days to minimize API costs
- 🔒 Requires ANTHROPIC_API_KEY environment variable

**Example comparison:**

Generic roast:
> "This file contains several geological layers."

AI-powered roast:
> "This 1,847-line auth service is doing authentication, authorization, password reset, email verification, 2FA, and probably making coffee. Pick a lane."

**Setup:**
```bash
# Set API key
export ANTHROPIC_API_KEY=your_key_here

# Or configure in .roastrc.json
{
  "ai": {
    "enabled": true,
    "apiKey": "your_key_here",
    "model": "claude-3-5-sonnet-20241022",
    "cacheEnabled": true
  }
}
```

**Cost control:**
- Only roasts top 10 most interesting findings
- Caches roasts for 7 days
- Cache stored in `.roast-ai-cache.json`
- Typical cost: $0.01-0.05 per scan

### Interactive Mode
```bash
roast-my-codebase --interactive
```
- 🎯 Walk through issues one by one
- 💡 See detailed explanations and fix suggestions
- ✨ Apply automatic fixes where possible
- ⚡ Preview changes with `--dry-run` flag
- 🎨 Beautiful interactive UI

**What can be auto-fixed:**
- ✅ Remove unused dependencies (`npm uninstall`)
- ✅ Add issue references to TODO comments
- ✅ Remove dead exports
- 🔜 More fixes coming soon!

**Example session:**
```
🔧 Interactive Fix Mode

Found 12 fixable issues.

Issue 1/12 - 🔴 Critical
─────────────────────────────────────────
Unused dependency `lodash` is installed but never imported

💡 Fix suggestion:
  Remove unused dependency: lodash

✓ This can be fixed automatically!

? What would you like to do?
❯ Apply fix automatically
  Show details
  Skip
  Exit interactive mode
```

### Watch Mode
```bash
roast-my-codebase --watch
```
- Re-runs on file changes
- Shows score delta
- Compact summaries for quick feedback

### Compare Branches
```bash
roast-my-codebase --compare main
```
- Diff current code vs. a git branch
- Shows new issues introduced
- Shows resolved issues
- Score delta comparison

### Historical Health Tracking
```bash
roast-my-codebase --track
```
- 📊 Track health score over time
- 📈 See trends (improving/declining/stable)
- 📉 Visual ASCII charts
- 💾 Stores in `.roast-history.json` (gitignored)
- ⏱️ Per-commit snapshots with git info

**View history:**
```bash
roast-my-codebase --history        # Last 30 days
roast-my-codebase --history 7      # Last 7 days
roast-my-codebase --history 90     # Last 90 days
```

**What's tracked:**
- Health score over time
- Finding counts by severity
- Category-level trends
- Git commit information
- Score improvement rate

**Example output:**
```
📊 Health History Report

Project: my-app
Total snapshots: 45

Current Health
  Score: 85/100 (B)
  Findings: 12
  ● 2 critical  ● 6 warnings  ● 4 info

Trend Analysis (Last 30 days)
  ↗ IMPROVING (+12 points)

  Statistics:
    Average score: 78.5/100
    Best score: 85/100
    Worst score: 68/100
    Improvement rate: +0.4 points/day

  Score Trend
  100 ┤
   90 ┤      ●●
   80 ┤    ●●  ●
   70 ┤  ●●
   60 ┼──────────────→
       Jan 1    Jan 30

  Category Changes
  ↓ Improving:
    ✓ unused-dependencies: -5 issues
    ✓ todos: -8 issues
  ↑ Declining:
    ✗ complexity: +2 issues
```

**Use in CI:**
```bash
# Track on every commit
roast-my-codebase --track

# Fail if declining trend
roast-my-codebase --history 7 | grep -q "DECLINING" && exit 1
```

## Customization

### Config File (`.roastrc.json`)

Create a `.roastrc.json` in your project root to customize behavior:

```json
{
  "thresholds": {
    "largeFile": 1000,
    "extremeFile": 3000
  },
  "scanners": {
    "disabled": ["test-coverage", "framework"]
  },
  "ignore": [
    "**/vendor/**",
    "**/generated/**"
  ],
  "deductions": {
    "secret": -20,
    "missingTest": -1
  },
  "plugins": [
    "roast-plugin-graphql"
  ]
}
```

**See [CUSTOMIZATION.md](CUSTOMIZATION.md) for full documentation.**

### Plugin Development

Create custom scanners as npm packages:

```javascript
// roast-plugin-example/index.js
export default {
  name: "roast-plugin-example",
  version: "1.0.0",
  scanner: {
    name: "example",
    async scan(rootDir) {
      const findings = [];
      // Your scanner logic
      return { findings };
    }
  }
};
```

**See [CUSTOMIZATION.md](CUSTOMIZATION.md) for plugin development guide.**

## Contributing

PRs welcome. The architecture is modular — each scanner is independent and easy to add to.

```
src/
├── cli/          # Command setup
├── scanners/     # Modular analysis passes
├── scoring/      # Health score calculation
├── roasts/       # Roast generation
├── report/       # Terminal rendering
├── types/        # Shared interfaces
└── utils/        # Shared helpers
```

## License

MIT

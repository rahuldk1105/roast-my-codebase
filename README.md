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
# Scan current directory
npx roast-my-codebase

# Scan a specific path
npx roast-my-codebase ./path/to/project
```

## What gets analyzed

| Check | What it finds |
|-------|--------------|
| **File Size** | Files over 500/1000/2000 lines |
| **TODOs** | TODO, FIXME, HACK, XXX comments |
| **Dependencies** | Excessive or unused packages |
| **Circular Deps** | Import cycles between modules |
| **Structure** | Deep nesting, bloated folders |
| **Utility Explosion** | Too many utils/helpers/common files |

## Supported projects

Works on any JavaScript/TypeScript project:

- React, Next.js, Vue, Svelte
- Express, NestJS, Fastify
- Node.js, Vite, Webpack
- No configuration required

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

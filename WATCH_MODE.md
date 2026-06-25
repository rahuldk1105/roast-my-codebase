# Watch Mode Implementation

## Overview

Watch mode has been successfully implemented for the `roast-my-codebase` CLI tool. It allows continuous monitoring of your codebase with automatic re-analysis on file changes.

## Usage

```bash
# Watch current directory
roast-my-codebase --watch

# Watch specific directory
roast-my-codebase ./src --watch

# Combine with other flags
roast-my-codebase --watch --fix
```

## Features

### Initial Scan
- Shows the full report with health score, findings, roasts, and verdict
- Same detailed output as a regular scan

### Subsequent Scans
- **Compact Summary**: Shows only the essential information
- **Score Delta**: Displays how much the health score changed (e.g., `+5`, `-3`, `±0`)
  - Green `+X` for improvements
  - Red `-X` for regressions
  - Dim `±0` for no change
- **Finding Counts**: Shows critical, warning, and info counts
- **Change Detection**: Displays which file triggered the re-scan

### File Watching
- Monitors: `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.jsx`
- Ignores: `node_modules`, `dist`, `build`, `.next`
- Persistent: Runs until manually stopped (Ctrl+C)

## Implementation Details

### New Files
- `src/watch/index.ts`: Core watch mode implementation
  - `startWatchMode()`: Sets up file watching and scan orchestration
  - `renderWatchSummary()`: Renders compact summary for subsequent scans

### Modified Files
- `src/cli/index.ts`: Added `--watch` flag and watch mode logic

### Dependencies
- `chokidar@^5.0.0`: File watching library
- `@types/chokidar@^1.7.5`: TypeScript definitions

## Example Output

### First Run
```
╔═════════════════════════════╗
║    Roast My Codebase    🔥  ║
╚═════════════════════════════╝

  Project: my-project

  Health Score: 48/100  F  Chaotic
  ... [full report]

👀 Watching for changes... (Press Ctrl+C to stop)
```

### After File Change
```
📝 Changed: src/utils/helper.ts

  Health: 52/100 +4 F Chaotic
  ✗ 1 critical
  ⚠ 15 warnings
  ● 10 info
```

## Technical Notes

1. **Scanner Reuse**: Creates scanner instances once and reuses them for all scans
2. **Stats Caching**: Captures ProjectStats from FileScanner on first run
3. **Delta Calculation**: Tracks last score and compares with current score
4. **Graceful Shutdown**: Handles Ctrl+C (SIGINT) to close watcher properly
5. **No Spinner**: Watch mode doesn't show the spinner to keep output clean

## Testing

```bash
# Build the project
npm run build

# Run watch mode on sample project
node dist/index.js tests/fixtures/sample-project --watch

# In another terminal, edit a file in the sample project
# Watch the automatic re-scan trigger
```

## Future Enhancements

Potential improvements:
- Debouncing: Add delay to avoid rapid re-scans during batch file saves
- File filtering: Allow custom glob patterns via CLI option
- Watch statistics: Track number of scans, average score over time
- Change highlighting: Show which specific findings changed between runs

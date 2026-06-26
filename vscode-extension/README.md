# Roast My Codebase - VS Code Extension

> Get roasted. Get better. Ship faster. Right in your editor.

A VS Code extension that brings `roast-my-codebase` analysis directly into your development workflow.

## Features

### 🔥 Real-Time Analysis
- **Inline Diagnostics** - See code quality issues as you write
- **Status Bar Widget** - Live health score display
- **Tree Views** - Browse findings by category and view statistics

### 📊 Rich Reporting
- **Interactive Reports** - Beautiful HTML reports in VS Code
- **Click-to-Navigate** - Jump directly to issues from the findings panel
- **Badge Generation** - Create health badges for your README

### ⚙️ Fully Configurable
- Reads `.roastrc.json` from your project
- Toggle scanners on/off
- Customize thresholds
- Scan on save (optional)

## Installation

1. Install the extension from the VS Code Marketplace
2. Install the CLI globally (if not already):
   ```bash
   npm install -g roast-my-codebase
   ```

## Usage

### Commands

- **Roast: Scan Workspace** - Run full analysis on your workspace
- **Roast: Scan Current File** - Focus on the current file
- **Roast: Show Report** - View detailed HTML report
- **Roast: Generate Badge** - Create health badge SVG
- **Roast: Clear Cache** - Reset cached results

Access commands via:
- Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
- Status bar click
- Right-click context menu

### Views

**Findings Panel** - Browse issues by category:
- Large Files
- TODOs
- Dependencies
- Circular Dependencies
- Complexity
- Type Safety
- Security
- And more...

**Statistics Panel** - View project metrics:
- Health Score
- Files Scanned
- Lines of Code
- Total Findings
- Findings by Severity

### Status Bar

The status bar shows your current health score:
- **Green** (90+) - Excellent
- **Light Green** (80-89) - Good
- **Yellow** (70-79) - Fair
- **Orange** (60-69) - Risky
- **Red** (<60) - Chaotic

Click the status bar to view the full report.

## Configuration

Configure via VS Code settings (`File > Preferences > Settings` or `Ctrl+,`):

```json
{
  "roast.enabled": true,
  "roast.scanOnSave": false,
  "roast.scanOnOpen": true,
  "roast.showInlineWarnings": true,
  "roast.statusBar": true,
  "roast.threshold": 70,
  "roast.cliPath": "",
  "roast.disabledScanners": []
}
```

### Settings

- `roast.enabled` - Enable/disable the extension
- `roast.scanOnSave` - Auto-scan when files are saved
- `roast.scanOnOpen` - Auto-scan when workspace opens
- `roast.showInlineWarnings` - Show findings as inline diagnostics
- `roast.statusBar` - Show health score in status bar
- `roast.threshold` - Minimum acceptable health score
- `roast.cliPath` - Custom path to CLI (leave empty for global)
- `roast.disabledScanners` - List of scanners to disable

## Requirements

- VS Code 1.85.0 or higher
- Node.js 18+ (for CLI)
- `roast-my-codebase` CLI installed globally or via npx

## Known Issues

- Single file scanning requires full workspace scan (CLI limitation)
- Scanner-specific configuration requires `.roastrc.json` (not yet settable via extension settings)

## Release Notes

### 0.1.0

Initial release:
- Workspace scanning
- Inline diagnostics
- Status bar widget
- Tree view panels
- HTML report viewer
- Badge generation

## Contributing

Found a bug or have a feature request? [Open an issue](https://github.com/your-username/roast-my-codebase/issues) on GitHub.

## License

MIT - See LICENSE file for details

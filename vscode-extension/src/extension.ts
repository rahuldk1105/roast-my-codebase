import * as vscode from 'vscode';
import { RoastService } from './roastService';
import { StatusBarManager } from './statusBar';
import { FindingsProvider } from './findingsProvider';
import { StatsProvider } from './statsProvider';
import { DiagnosticsManager } from './diagnostics';

let roastService: RoastService;
let statusBarManager: StatusBarManager;
let diagnosticsManager: DiagnosticsManager;

export function activate(context: vscode.ExtensionContext) {
  console.log('Roast My Codebase extension is now active');

  // Initialize services
  roastService = new RoastService(context);
  statusBarManager = new StatusBarManager();
  diagnosticsManager = new DiagnosticsManager();

  // Initialize tree view providers
  const findingsProvider = new FindingsProvider(roastService);
  const statsProvider = new StatsProvider(roastService);

  // Register tree views
  vscode.window.registerTreeDataProvider('roast.findingsView', findingsProvider);
  vscode.window.registerTreeDataProvider('roast.statsView', statsProvider);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('roast.scanWorkspace', async () => {
      await scanWorkspace();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('roast.scanFile', async () => {
      await scanCurrentFile();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('roast.showReport', async () => {
      await showReport();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('roast.generateBadge', async () => {
      await generateBadge();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('roast.clearCache', async () => {
      roastService.clearCache();
      vscode.window.showInformationMessage('Roast cache cleared');
    })
  );

  // Register status bar
  context.subscriptions.push(statusBarManager);

  // Scan on startup if enabled
  const config = vscode.workspace.getConfiguration('roast');
  if (config.get('scanOnOpen')) {
    scanWorkspace();
  }

  // Watch for file saves
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (config.get('scanOnSave')) {
        scanWorkspace();
      }
    })
  );

  // Listen for roast results
  roastService.onDidChangeResults((results) => {
    // Update status bar
    statusBarManager.update(results.health);

    // Update diagnostics
    diagnosticsManager.update(results);

    // Refresh tree views
    findingsProvider.refresh();
    statsProvider.refresh();
  });
}

async function scanWorkspace() {
  const config = vscode.workspace.getConfiguration('roast');
  if (!config.get('enabled')) {
    vscode.window.showWarningMessage('Roast My Codebase is disabled');
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Roasting your codebase...',
      cancellable: false,
    },
    async () => {
      try {
        await roastService.scanWorkspace(workspaceFolders[0].uri.fsPath);
        vscode.window.showInformationMessage('Workspace scan complete');
      } catch (error) {
        vscode.window.showErrorMessage(
          `Scan failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}

async function scanCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const filePath = editor.document.uri.fsPath;
  vscode.window.showInformationMessage(`Scanning ${filePath}...`);

  // For single file scan, we still need to scan the workspace
  // but can highlight findings for this file
  await scanWorkspace();
}

async function showReport() {
  const results = roastService.getResults();
  if (!results) {
    vscode.window.showWarningMessage('No scan results available. Run a scan first.');
    return;
  }

  // Create and show webview panel with report
  const panel = vscode.window.createWebviewPanel(
    'roastReport',
    'Roast Report',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
    }
  );

  panel.webview.html = getReportHtml(results);
}

async function generateBadge() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  try {
    await roastService.generateBadge(workspaceFolders[0].uri.fsPath);
    vscode.window.showInformationMessage('Badge generated: .roast-badge.svg');
  } catch (error) {
    vscode.window.showErrorMessage(
      `Badge generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function getReportHtml(results: any): string {
  const health = results.health;
  const grade = getGrade(health.score);
  const gradeColor = getGradeColor(grade);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Roast Report</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .grade {
          font-size: 72px;
          font-weight: bold;
          color: ${gradeColor};
          margin: 20px 0;
        }
        .score {
          font-size: 24px;
          margin: 10px 0;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin: 30px 0;
        }
        .stat-card {
          background: var(--vscode-editor-inactiveSelectionBackground);
          padding: 15px;
          border-radius: 8px;
          border-left: 3px solid var(--vscode-textLink-foreground);
        }
        .stat-label {
          font-size: 12px;
          opacity: 0.7;
          text-transform: uppercase;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          margin-top: 5px;
        }
        .findings {
          margin-top: 30px;
        }
        .finding {
          padding: 10px;
          margin: 10px 0;
          border-left: 3px solid;
          background: var(--vscode-editor-inactiveSelectionBackground);
        }
        .finding.critical {
          border-left-color: #f44336;
        }
        .finding.warning {
          border-left-color: #ff9800;
        }
        .finding.info {
          border-left-color: #2196f3;
        }
        .roasts {
          margin-top: 30px;
          padding: 20px;
          background: var(--vscode-editor-inactiveSelectionBackground);
          border-radius: 8px;
        }
        .roast {
          margin: 15px 0;
          padding: 15px;
          background: var(--vscode-editor-background);
          border-radius: 4px;
          font-style: italic;
        }
        .verdict {
          margin-top: 30px;
          padding: 20px;
          background: var(--vscode-textBlockQuote-background);
          border-left: 4px solid var(--vscode-textLink-foreground);
          font-size: 18px;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔥 Roast My Codebase</h1>
        <div class="grade">${grade}</div>
        <div class="score">${health.score}/100 - ${health.grade}</div>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">Files Scanned</div>
          <div class="stat-value">${results.stats.totalFiles}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Lines of Code</div>
          <div class="stat-value">${results.stats.totalLines.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Dependencies</div>
          <div class="stat-value">${results.stats.dependencies || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Findings</div>
          <div class="stat-value">${results.findings.length}</div>
        </div>
      </div>

      ${results.roasts && results.roasts.length > 0 ? `
        <div class="roasts">
          <h2>🔥 Roasts</h2>
          ${results.roasts.map((r: any) => `
            <div class="roast">
              <strong>${r.target}</strong><br>
              ${r.message}
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${results.verdict ? `
        <div class="verdict">
          <strong>Verdict:</strong> ${results.verdict}
        </div>
      ` : ''}

      <div class="findings">
        <h2>Findings</h2>
        ${results.findings.slice(0, 20).map((f: any) => `
          <div class="finding ${f.severity}">
            <strong>${f.severity.toUpperCase()}</strong> - ${f.message}
            ${f.file ? `<br><small>${f.file}</small>` : ''}
          </div>
        `).join('')}
        ${results.findings.length > 20 ? `<p><em>...and ${results.findings.length - 20} more findings</em></p>` : ''}
      </div>
    </body>
    </html>
  `;
}

function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#4caf50';
    case 'B': return '#8bc34a';
    case 'C': return '#ffc107';
    case 'D': return '#ff9800';
    case 'F': return '#f44336';
    default: return '#999';
  }
}

export function deactivate() {
  if (statusBarManager) {
    statusBarManager.dispose();
  }
  if (diagnosticsManager) {
    diagnosticsManager.dispose();
  }
}

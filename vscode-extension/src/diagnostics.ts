import * as vscode from 'vscode';
import * as path from 'path';
import { RoastResults } from './roastService';

export class DiagnosticsManager {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('roast');
  }

  public update(results: RoastResults) {
    const config = vscode.workspace.getConfiguration('roast');
    if (!config.get('showInlineWarnings')) {
      this.diagnosticCollection.clear();
      return;
    }

    // Clear existing diagnostics
    this.diagnosticCollection.clear();

    // Group findings by file
    const diagnosticsByFile = new Map<string, vscode.Diagnostic[]>();

    for (const finding of results.findings) {
      if (!finding.file) continue;

      // Get workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) continue;

      const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, finding.file));

      // Create diagnostic
      const range = this.createRange(finding.line);
      const diagnostic = new vscode.Diagnostic(
        range,
        finding.message,
        this.getSeverity(finding.severity)
      );

      diagnostic.source = 'roast-my-codebase';
      diagnostic.code = finding.id;

      // Add related information if available
      if (finding.detail) {
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(fileUri, range),
            finding.detail
          ),
        ];
      }

      // Add to map
      const filePath = fileUri.toString();
      if (!diagnosticsByFile.has(filePath)) {
        diagnosticsByFile.set(filePath, []);
      }
      diagnosticsByFile.get(filePath)!.push(diagnostic);
    }

    // Set diagnostics for each file
    for (const [filePath, diagnostics] of diagnosticsByFile.entries()) {
      this.diagnosticCollection.set(vscode.Uri.parse(filePath), diagnostics);
    }
  }

  private createRange(line?: number): vscode.Range {
    if (line !== undefined && line > 0) {
      // Show diagnostic on specific line
      return new vscode.Range(line - 1, 0, line - 1, 100);
    }
    // Default to first line if no line number
    return new vscode.Range(0, 0, 0, 100);
  }

  private getSeverity(severity: 'critical' | 'warning' | 'info'): vscode.DiagnosticSeverity {
    switch (severity) {
      case 'critical':
        return vscode.DiagnosticSeverity.Error;
      case 'warning':
        return vscode.DiagnosticSeverity.Warning;
      case 'info':
        return vscode.DiagnosticSeverity.Information;
    }
  }

  public dispose() {
    this.diagnosticCollection.dispose();
  }
}

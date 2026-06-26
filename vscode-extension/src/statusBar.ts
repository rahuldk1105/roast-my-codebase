import * as vscode from 'vscode';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'roast.showReport';
    this.statusBarItem.show();
    this.showDefault();
  }

  private showDefault() {
    this.statusBarItem.text = '$(flame) Roast';
    this.statusBarItem.tooltip = 'Click to scan codebase';
    this.statusBarItem.backgroundColor = undefined;
  }

  public update(health: { score: number; grade: string }) {
    const config = vscode.workspace.getConfiguration('roast');
    const threshold = config.get<number>('threshold') || 70;

    // Set text and color based on score
    const icon = this.getIcon(health.score);
    this.statusBarItem.text = `$(${icon}) ${health.score}/100 ${health.grade}`;
    this.statusBarItem.tooltip = `Codebase Health: ${health.score}/100 (${health.grade})\nClick to view report`;

    // Set background color if below threshold
    if (health.score < threshold) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground'
      );
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }
  }

  private getIcon(score: number): string {
    if (score >= 90) return 'check-all';
    if (score >= 80) return 'check';
    if (score >= 70) return 'warning';
    if (score >= 60) return 'alert';
    return 'flame';
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}

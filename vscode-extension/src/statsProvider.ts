import * as vscode from 'vscode';
import { RoastService } from './roastService';

export class StatsProvider implements vscode.TreeDataProvider<StatItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<StatItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private roastService: RoastService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StatItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: StatItem): Thenable<StatItem[]> {
    const results = this.roastService.getResults();
    if (!results) {
      return Promise.resolve([]);
    }

    const items: StatItem[] = [
      new StatItem('Health Score', `${results.health.score}/100 (${results.health.grade})`),
      new StatItem('Files Scanned', results.stats.totalFiles.toString()),
      new StatItem('Lines of Code', results.stats.totalLines.toLocaleString()),
    ];

    if (results.stats.dependencies !== undefined) {
      items.push(new StatItem('Dependencies', results.stats.dependencies.toString()));
    }

    items.push(new StatItem('Total Findings', results.findings.length.toString()));

    // Count by severity
    const critical = results.findings.filter((f) => f.severity === 'critical').length;
    const warning = results.findings.filter((f) => f.severity === 'warning').length;
    const info = results.findings.filter((f) => f.severity === 'info').length;

    items.push(new StatItem('Critical Issues', critical.toString(), 'error'));
    items.push(new StatItem('Warnings', warning.toString(), 'warning'));
    items.push(new StatItem('Info', info.toString(), 'info'));

    return Promise.resolve(items);
  }
}

class StatItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly value: string,
    public readonly severityIcon?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = value;

    if (severityIcon) {
      switch (severityIcon) {
        case 'error':
          this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
          break;
        case 'warning':
          this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('warningForeground'));
          break;
        case 'info':
          this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('foreground'));
          break;
      }
    } else {
      this.iconPath = new vscode.ThemeIcon('circle-outline');
    }
  }
}

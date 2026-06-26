import * as vscode from 'vscode';
import { RoastService, RoastResults } from './roastService';

export class FindingsProvider implements vscode.TreeDataProvider<FindingItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<FindingItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private roastService: RoastService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FindingItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: FindingItem): Thenable<FindingItem[]> {
    const results = this.roastService.getResults();
    if (!results) {
      return Promise.resolve([]);
    }

    if (!element) {
      // Root level - group by category
      const categories = this.groupByCategory(results);
      return Promise.resolve(
        Array.from(categories.entries()).map(
          ([category, findings]) =>
            new FindingItem(
              category,
              vscode.TreeItemCollapsibleState.Collapsed,
              undefined,
              findings
            )
        )
      );
    } else {
      // Child level - show findings in category
      return Promise.resolve(
        (element.findings || []).map(
          (finding) =>
            new FindingItem(
              finding.message,
              vscode.TreeItemCollapsibleState.None,
              finding
            )
        )
      );
    }
  }

  private groupByCategory(results: RoastResults): Map<string, any[]> {
    const map = new Map<string, any[]>();

    for (const finding of results.findings) {
      const category = this.formatCategory(finding.category);
      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)!.push(finding);
    }

    return map;
  }

  private formatCategory(category: string): string {
    // Convert kebab-case to Title Case
    return category
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

class FindingItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly finding?: any,
    public readonly findings?: any[]
  ) {
    super(label, collapsibleState);

    if (finding) {
      // Individual finding
      this.tooltip = finding.detail || finding.message;
      this.description = finding.file;
      this.iconPath = this.getIcon(finding.severity);

      // Make clickable if has file location
      if (finding.file) {
        this.command = {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [
            vscode.Uri.file(finding.file),
            {
              selection: finding.line
                ? new vscode.Range(finding.line - 1, 0, finding.line - 1, 0)
                : undefined,
            },
          ],
        };
      }
    } else if (findings) {
      // Category group
      this.description = `${findings.length} issue${findings.length !== 1 ? 's' : ''}`;

      // Determine icon based on worst severity in category
      const hasCritical = findings.some((f) => f.severity === 'critical');
      const hasWarning = findings.some((f) => f.severity === 'warning');
      this.iconPath = hasCritical
        ? new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'))
        : hasWarning
        ? new vscode.ThemeIcon('warning', new vscode.ThemeColor('warningForeground'))
        : new vscode.ThemeIcon('info', new vscode.ThemeColor('foreground'));
    }
  }

  private getIcon(severity: string): vscode.ThemeIcon {
    switch (severity) {
      case 'critical':
        return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
      case 'warning':
        return new vscode.ThemeIcon('warning', new vscode.ThemeColor('warningForeground'));
      case 'info':
        return new vscode.ThemeIcon('info', new vscode.ThemeColor('foreground'));
      default:
        return new vscode.ThemeIcon('circle-outline');
    }
  }
}

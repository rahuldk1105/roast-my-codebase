import * as vscode from 'vscode';
import { execaCommand } from 'execa';
import * as path from 'path';
import * as fs from 'fs';

export interface RoastResults {
  projectName: string;
  stats: {
    totalFiles: number;
    totalLines: number;
    dependencies?: number;
  };
  health: {
    score: number;
    grade: string;
    breakdown: Record<string, number>;
  };
  findings: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
    file?: string;
    line?: number;
    detail?: string;
  }>;
  roasts: Array<{
    target: string;
    message: string;
    category: string;
  }>;
  verdict: string;
}

export class RoastService {
  private results: RoastResults | null = null;
  private cacheFile: string;
  private readonly onDidChangeResultsEmitter = new vscode.EventEmitter<RoastResults>();
  public readonly onDidChangeResults = this.onDidChangeResultsEmitter.event;

  constructor(private context: vscode.ExtensionContext) {
    this.cacheFile = path.join(context.globalStorageUri.fsPath, 'roast-cache.json');
    this.ensureCacheDir();
    this.loadCache();
  }

  private ensureCacheDir() {
    const dir = path.dirname(this.cacheFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8');
        this.results = JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
    }
  }

  private saveCache() {
    try {
      if (this.results) {
        fs.writeFileSync(this.cacheFile, JSON.stringify(this.results, null, 2), 'utf-8');
      }
    } catch (error) {
      console.error('Failed to save cache:', error);
    }
  }

  public clearCache() {
    this.results = null;
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  public getResults(): RoastResults | null {
    return this.results;
  }

  public async scanWorkspace(workspaceRoot: string): Promise<RoastResults> {
    const config = vscode.workspace.getConfiguration('roast');
    const cliPath = this.getCliPath(config.get('cliPath'));

    // Build command
    let command = `${cliPath} "${workspaceRoot}" --json`;

    // Add disabled scanners if configured
    const disabledScanners = config.get<string[]>('disabledScanners');
    if (disabledScanners && disabledScanners.length > 0) {
      // Note: CLI would need to support --disable-scanner flag
      // For now, we'll handle this post-processing
    }

    try {
      const { stdout } = await execaCommand(command, {
        shell: true,
        timeout: 60000, // 60 second timeout
      });

      this.results = JSON.parse(stdout);
      this.saveCache();
      if (this.results) {
        this.onDidChangeResultsEmitter.fire(this.results);
      }

      return this.results!;
    } catch (error: any) {
      // Try to parse error output in case CLI returned JSON with error
      if (error.stdout) {
        try {
          const errorResults = JSON.parse(error.stdout);
          if (errorResults.findings) {
            this.results = errorResults;
            this.saveCache();
            if (this.results) {
              this.onDidChangeResultsEmitter.fire(this.results);
            }
            return this.results!;
          }
        } catch {
          // Not JSON, fall through to error throw
        }
      }

      throw new Error(
        `CLI execution failed: ${error.message}\n${error.stderr || error.stdout || ''}`
      );
    }
  }

  public async generateBadge(workspaceRoot: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('roast');
    const cliPath = this.getCliPath(config.get('cliPath'));

    const command = `${cliPath} "${workspaceRoot}" --badge`;

    try {
      await execaCommand(command, {
        shell: true,
        timeout: 30000,
      });
    } catch (error: any) {
      throw new Error(`Badge generation failed: ${error.message}`);
    }
  }

  private getCliPath(customPath?: string): string {
    if (customPath && customPath.trim()) {
      return customPath;
    }

    // Check if roast-my-codebase is installed globally
    // Default to npx if not found
    return 'npx roast-my-codebase';
  }

  public dispose() {
    this.onDidChangeResultsEmitter.dispose();
  }
}

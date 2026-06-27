import fs from "fs";
import path from "path";

export interface CIConfig {
  threshold: number;
  prComment: boolean;
  sarif: boolean;
  nodeVersion: string;
  packageManager: "npm" | "yarn" | "pnpm";
}

export function detectPackageManager(
  rootDir: string
): "npm" | "yarn" | "pnpm" {
  if (fs.existsSync(path.join(rootDir, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  return "npm";
}

export function generateCIWorkflow(config: CIConfig): string {
  const { threshold, prComment, sarif, nodeVersion, packageManager } = config;

  const installCmd =
    packageManager === "yarn"
      ? "yarn install --frozen-lockfile"
      : packageManager === "pnpm"
        ? "pnpm install --frozen-lockfile"
        : "npm ci";

  const scanCmd = [
    "npx roast-my-codebase --json",
    `--threshold ${threshold}`,
    prComment ? "--pr-comment" : "",
    sarif ? "--sarif-file" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Build permissions block
  const permissionsLines: string[] = ["      contents: read"];
  if (prComment) permissionsLines.push("      pull-requests: write");
  if (sarif) permissionsLines.push("      security-events: write");
  const permissionsBlock = permissionsLines.join("\n");

  // Build optional SARIF upload step
  const sarifStep = sarif
    ? `
      - name: Upload SARIF to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: .roast-results.sarif`
    : "";

  return `name: Roast My Codebase

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  roast:
    name: Roast Codebase
    runs-on: ubuntu-latest
    permissions:
${permissionsBlock}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: '${packageManager}'

      - name: Install dependencies
        run: ${installCmd}

      - name: Roast the codebase
        run: ${scanCmd}
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}${sarifStep}
`;
}

export function writeCIWorkflow(
  rootDir: string,
  config: CIConfig
): { path: string; alreadyExists: boolean } {
  const workflowsDir = path.join(rootDir, ".github", "workflows");
  const filePath = path.join(workflowsDir, "roast.yml");

  // Normalise to forward slashes for display consistency
  const displayPath = filePath.split(path.sep).join("/");

  if (fs.existsSync(filePath)) {
    return { path: displayPath, alreadyExists: true };
  }

  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }

  const yaml = generateCIWorkflow(config);
  fs.writeFileSync(filePath, yaml, "utf-8");

  return { path: displayPath, alreadyExists: false };
}

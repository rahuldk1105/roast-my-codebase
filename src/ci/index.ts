import fs from "fs";
import path from "path";

export interface CIConfig {
  threshold?: number;
  aiRoasts?: boolean;
}

export function detectPackageManager(
  rootDir: string
): "npm" | "yarn" | "pnpm" {
  if (fs.existsSync(path.join(rootDir, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
  return "npm";
}

export function generateCIWorkflow(config: CIConfig = {}): string {
  const { threshold, aiRoasts } = config;

  const failBelow = threshold !== undefined
    ? `\n          fail-below: "${threshold}"`
    : "";

  const aiBlock = aiRoasts
    ? `\n          ai-roasts: "true"\n          anthropic-api-key: \${{ secrets.ANTHROPIC_API_KEY }}`
    : "";

  return `name: Roast My Codebase

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  pull-requests: write

jobs:
  roast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: rahuldk1105/roast-my-codebase@v1
        with:
          github-token: \${{ secrets.GITHUB_TOKEN }}${failBelow}${aiBlock}
`;
}

export function writeCIWorkflow(
  rootDir: string,
  config: CIConfig = {}
): { path: string; alreadyExists: boolean } {
  const workflowsDir = path.join(rootDir, ".github", "workflows");
  const filePath = path.join(workflowsDir, "roast.yml");

  const displayPath = filePath.split(path.sep).join("/");

  if (fs.existsSync(filePath)) {
    return { path: displayPath, alreadyExists: true };
  }

  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }

  fs.writeFileSync(filePath, generateCIWorkflow(config), "utf-8");

  return { path: displayPath, alreadyExists: false };
}

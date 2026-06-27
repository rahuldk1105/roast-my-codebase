import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  detectPackageManager,
  generateCIWorkflow,
  writeCIWorkflow,
  CIConfig,
} from "../src/ci/index.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "roast-ci-test-"));
}

function removeDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const baseConfig: CIConfig = {
  threshold: 60,
  prComment: false,
  sarif: false,
  nodeVersion: "20.x",
  packageManager: "npm",
};

describe("detectPackageManager", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    removeDir(tmpDir);
  });

  it("returns 'npm' when no lock files are present", () => {
    expect(detectPackageManager(tmpDir)).toBe("npm");
  });

  it("returns 'yarn' when yarn.lock exists", () => {
    fs.writeFileSync(path.join(tmpDir, "yarn.lock"), "");
    expect(detectPackageManager(tmpDir)).toBe("yarn");
  });

  it("returns 'pnpm' when pnpm-lock.yaml exists", () => {
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(tmpDir)).toBe("pnpm");
  });
});

describe("generateCIWorkflow", () => {
  it("contains actions/checkout@v4", () => {
    const yaml = generateCIWorkflow(baseConfig);
    expect(yaml).toContain("actions/checkout@v4");
  });

  it("includes --threshold 60 when threshold is 60", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, threshold: 60 });
    expect(yaml).toContain("--threshold 60");
  });

  it("includes --pr-comment when prComment is true", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, prComment: true });
    expect(yaml).toContain("--pr-comment");
  });

  it("does not include --pr-comment when prComment is false", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, prComment: false });
    expect(yaml).not.toContain("--pr-comment");
  });

  it("includes --sarif-file when sarif is true", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, sarif: true });
    expect(yaml).toContain("--sarif-file");
  });

  it("does not include --sarif-file when sarif is false", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, sarif: false });
    expect(yaml).not.toContain("--sarif-file");
  });

  it("includes upload-sarif step when sarif is true", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, sarif: true });
    expect(yaml).toContain("upload-sarif");
    expect(yaml).toContain("github/codeql-action/upload-sarif@v3");
  });

  it("does not include upload-sarif step when sarif is false", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, sarif: false });
    expect(yaml).not.toContain("upload-sarif");
  });

  it("includes pull-requests: write permission when prComment is true", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, prComment: true });
    expect(yaml).toContain("pull-requests: write");
  });

  it("does not include pull-requests: write when prComment is false", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, prComment: false });
    expect(yaml).not.toContain("pull-requests: write");
  });

  it("uses npm ci for npm package manager", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, packageManager: "npm" });
    expect(yaml).toContain("npm ci");
  });

  it("uses yarn install --frozen-lockfile for yarn", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, packageManager: "yarn" });
    expect(yaml).toContain("yarn install --frozen-lockfile");
  });

  it("uses pnpm install --frozen-lockfile for pnpm", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, packageManager: "pnpm" });
    expect(yaml).toContain("pnpm install --frozen-lockfile");
  });

  it("includes GITHUB_TOKEN env var", () => {
    const yaml = generateCIWorkflow(baseConfig);
    expect(yaml).toContain("GITHUB_TOKEN");
  });

  it("includes security-events: write when sarif is true", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, sarif: true });
    expect(yaml).toContain("security-events: write");
  });

  it("uses the configured node version", () => {
    const yaml = generateCIWorkflow({ ...baseConfig, nodeVersion: "18.x" });
    expect(yaml).toContain("node-version: '18.x'");
  });
});

describe("writeCIWorkflow", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    removeDir(tmpDir);
  });

  it("creates the workflow file in .github/workflows/roast.yml", () => {
    const result = writeCIWorkflow(tmpDir, baseConfig);
    const expectedSuffix = ".github/workflows/roast.yml";
    expect(result.path.endsWith(expectedSuffix)).toBe(true);
    expect(result.alreadyExists).toBe(false);
  });

  it("creates intermediate directories if they do not exist", () => {
    writeCIWorkflow(tmpDir, baseConfig);
    const workflowsDir = path.join(tmpDir, ".github", "workflows");
    expect(fs.existsSync(workflowsDir)).toBe(true);
  });

  it("writes valid YAML content to the file", () => {
    writeCIWorkflow(tmpDir, baseConfig);
    const filePath = path.join(tmpDir, ".github", "workflows", "roast.yml");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("name: Roast My Codebase");
    expect(content).toContain("actions/checkout@v4");
  });

  it("returns alreadyExists: true and does NOT overwrite when file exists", () => {
    const workflowsDir = path.join(tmpDir, ".github", "workflows");
    fs.mkdirSync(workflowsDir, { recursive: true });
    const filePath = path.join(workflowsDir, "roast.yml");
    const originalContent = "# existing workflow";
    fs.writeFileSync(filePath, originalContent, "utf-8");

    const result = writeCIWorkflow(tmpDir, baseConfig);
    expect(result.alreadyExists).toBe(true);

    // File must NOT be overwritten
    const contentAfter = fs.readFileSync(filePath, "utf-8");
    expect(contentAfter).toBe(originalContent);
  });
});

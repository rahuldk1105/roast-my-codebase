import { describe, it, expect } from "vitest";
import { buildFolderTree, renderHotmap } from "../src/report/hotmap.js";
import { Finding } from "../src/types/index.js";

const ROOT_DIR = "/home/user/my-project";

describe("buildFolderTree", () => {
  it("returns root node with 0 counts when there are no findings", () => {
    const root = buildFolderTree([], ROOT_DIR);
    expect(root.name).toBe("my-project");
    expect(root.path).toBe("");
    expect(root.criticalCount).toBe(0);
    expect(root.warningCount).toBe(0);
    expect(root.infoCount).toBe(0);
    expect(root.totalCount).toBe(0);
    expect(root.score).toBe(100);
    expect(root.children).toHaveLength(0);
    expect(root.fileCount).toBe(0);
  });

  it("places findings in src folder when file is src/foo.ts", () => {
    const findings: Finding[] = [
      {
        id: "1",
        severity: "warning",
        category: "Complexity",
        message: "Too complex",
        file: `${ROOT_DIR}/src/foo.ts`,
      },
    ];

    const root = buildFolderTree(findings, ROOT_DIR);
    expect(root.totalCount).toBe(1);
    expect(root.children).toHaveLength(1);

    const srcNode = root.children[0];
    expect(srcNode.name).toBe("src");
    expect(srcNode.warningCount).toBe(1);
    expect(srcNode.totalCount).toBe(1);
    expect(srcNode.fileCount).toBe(1);
  });

  it("creates proper tree structure for nested path src/cli/index.ts", () => {
    const findings: Finding[] = [
      {
        id: "1",
        severity: "info",
        category: "TODOs",
        message: "TODO here",
        file: `${ROOT_DIR}/src/cli/index.ts`,
      },
    ];

    const root = buildFolderTree(findings, ROOT_DIR);
    expect(root.children).toHaveLength(1);

    const srcNode = root.children[0];
    expect(srcNode.name).toBe("src");
    expect(srcNode.children).toHaveLength(1);

    const cliNode = srcNode.children[0];
    expect(cliNode.name).toBe("cli");
    expect(cliNode.infoCount).toBe(1);
    expect(cliNode.totalCount).toBe(1);
  });

  it("aggregates critical counts from children to parent", () => {
    const findings: Finding[] = [
      {
        id: "1",
        severity: "critical",
        category: "Security",
        message: "SQL injection",
        file: `${ROOT_DIR}/src/api/query.ts`,
      },
      {
        id: "2",
        severity: "critical",
        category: "Security",
        message: "XSS vulnerability",
        file: `${ROOT_DIR}/src/views/page.ts`,
      },
      {
        id: "3",
        severity: "warning",
        category: "Complexity",
        message: "High complexity",
        file: `${ROOT_DIR}/src/utils/helper.ts`,
      },
    ];

    const root = buildFolderTree(findings, ROOT_DIR);
    expect(root.criticalCount).toBe(2);
    expect(root.warningCount).toBe(1);
    expect(root.totalCount).toBe(3);

    const srcNode = root.children.find((c) => c.name === "src");
    expect(srcNode).toBeDefined();
    expect(srcNode!.criticalCount).toBe(2);
    expect(srcNode!.warningCount).toBe(1);
    expect(srcNode!.totalCount).toBe(3);
  });

  it("has score of 100 for 0 findings", () => {
    const root = buildFolderTree([], ROOT_DIR);
    expect(root.score).toBe(100);
  });

  it("decreases score with more findings", () => {
    const manyFindings: Finding[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      severity: "critical" as const,
      category: "Test",
      message: `Issue ${i}`,
      file: `${ROOT_DIR}/src/file${i}.ts`,
    }));

    const root = buildFolderTree(manyFindings, ROOT_DIR);
    expect(root.score).toBeLessThan(100);
  });

  it("clamps score to 0 when there are very many critical findings", () => {
    const manyFindings: Finding[] = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      severity: "critical" as const,
      category: "Test",
      message: `Critical issue ${i}`,
      file: `${ROOT_DIR}/src/file${i}.ts`,
    }));

    // 25 criticals × 5 = 125 penalty → score clamped to 0
    const root = buildFolderTree(manyFindings, ROOT_DIR);
    expect(root.score).toBe(0);
  });

  it("skips findings with no file", () => {
    const findings: Finding[] = [
      {
        id: "1",
        severity: "critical",
        category: "Global",
        message: "No file finding",
        // no file property
      },
      {
        id: "2",
        severity: "warning",
        category: "Global",
        message: "Empty file",
        file: "",
      },
    ];

    const root = buildFolderTree(findings, ROOT_DIR);
    expect(root.totalCount).toBe(0);
    expect(root.children).toHaveLength(0);
  });

  it("handles Windows-style backslash paths", () => {
    const findings: Finding[] = [
      {
        id: "1",
        severity: "warning",
        category: "Complexity",
        message: "Too complex",
        file: `${ROOT_DIR}/src/foo.ts`.replace(/\//g, "\\"),
      },
    ];

    const root = buildFolderTree(findings, ROOT_DIR.replace(/\//g, "\\"));
    expect(root.totalCount).toBe(1);
    expect(root.children.length).toBeGreaterThan(0);
  });
});

describe("renderHotmap", () => {
  it("returns a non-empty string", () => {
    const root = buildFolderTree([], ROOT_DIR);
    const output = renderHotmap(root);
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("contains the root folder name", () => {
    const root = buildFolderTree([], ROOT_DIR);
    const output = renderHotmap(root);
    expect(output).toContain("my-project");
  });

  it("contains 🔴 when there are critical findings", () => {
    const findings: Finding[] = [
      {
        id: "1",
        severity: "critical",
        category: "Security",
        message: "Critical issue",
        file: `${ROOT_DIR}/src/auth.ts`,
      },
    ];

    const root = buildFolderTree(findings, ROOT_DIR);
    const output = renderHotmap(root);
    expect(output).toContain("🔴");
  });

  it("respects maxDepth — depth 1 shows only top-level folders", () => {
    const findings: Finding[] = [
      {
        id: "1",
        severity: "warning",
        category: "Complexity",
        message: "Deep warning",
        file: `${ROOT_DIR}/src/cli/commands/run.ts`,
      },
    ];

    const root = buildFolderTree(findings, ROOT_DIR);
    const outputDepth1 = renderHotmap(root, 1);
    const outputDepth4 = renderHotmap(root, 4);

    // Strip ANSI codes for clean text comparison
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

    // Extract tree lines only (after the blank line following the header)
    const plainDepth1 = stripAnsi(outputDepth1);
    const treeLines1 = plainDepth1.split("\n").filter(l => l.includes("──"));

    // At depth 1, we should see src/ but NOT cli/ as a tree node
    expect(treeLines1.some(l => l.includes("src/"))).toBe(true);
    expect(treeLines1.some(l => l.includes("cli/"))).toBe(false);

    // At depth 4, cli/ should appear as a tree node
    const plainDepth4 = stripAnsi(outputDepth4);
    const treeLines4 = plainDepth4.split("\n").filter(l => l.includes("──"));
    expect(treeLines4.some(l => l.includes("cli/"))).toBe(true);
  });

  it("contains the summary line with total issues", () => {
    const findings: Finding[] = [
      {
        id: "1",
        severity: "warning",
        category: "Complexity",
        message: "Warning",
        file: `${ROOT_DIR}/src/foo.ts`,
      },
      {
        id: "2",
        severity: "critical",
        category: "Security",
        message: "Critical",
        file: `${ROOT_DIR}/src/bar.ts`,
      },
    ];

    const root = buildFolderTree(findings, ROOT_DIR);
    const output = renderHotmap(root);
    expect(output).toContain("2 total issues");
  });

  it("contains the legend at the bottom", () => {
    const root = buildFolderTree([], ROOT_DIR);
    const output = renderHotmap(root);
    expect(output).toContain("health bar");
  });

  it("contains health bar characters", () => {
    const root = buildFolderTree([], ROOT_DIR);
    const output = renderHotmap(root);
    // Health bar uses block chars
    expect(output).toMatch(/[█░]/);
  });
});

import path from "path";
import chalk from "chalk";
import { Finding } from "../types/index.js";

export interface FolderNode {
  name: string;
  path: string;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  totalCount: number;
  score: number; // 0-100: lower = more issues
  children: FolderNode[];
  fileCount: number;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function emptyNode(name: string, nodePath: string): FolderNode {
  return {
    name,
    path: nodePath,
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
    totalCount: 0,
    score: 100,
    children: [],
    fileCount: 0,
  };
}

function calculateScore(criticalCount: number, warningCount: number, infoCount: number): number {
  const raw = 100 - (criticalCount * 5 + warningCount * 2 + infoCount * 0.5);
  return Math.max(0, Math.min(100, raw));
}

export function buildFolderTree(findings: Finding[], rootDir: string): FolderNode {
  const rootName = path.basename(rootDir);
  const root = emptyNode(rootName, "");

  // Only process findings that have a file
  const fileFindings = findings.filter((f) => f.file !== undefined && f.file !== "");

  // Map from normalized folder path → node (relative to rootDir)
  const nodeMap = new Map<string, FolderNode>();
  nodeMap.set("", root);

  // Collect unique files per node path for fileCount
  const filesPerNode = new Map<string, Set<string>>();
  filesPerNode.set("", new Set());

  for (const finding of fileFindings) {
    const rawFile = finding.file!;
    // Normalize: make relative to rootDir if absolute, then normalize separators
    let relFile = normalizePath(rawFile);
    const normalizedRoot = normalizePath(rootDir);
    if (relFile.startsWith(normalizedRoot + "/")) {
      relFile = relFile.slice(normalizedRoot.length + 1);
    }

    // Get the directory of the file (relative)
    const dirPart = relFile.includes("/") ? relFile.substring(0, relFile.lastIndexOf("/")) : "";

    // Split directory into segments and ensure all ancestor nodes exist
    const segments = dirPart === "" ? [] : dirPart.split("/");

    let currentPath = "";
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const parentPath = currentPath;
      currentPath = currentPath === "" ? seg : `${currentPath}/${seg}`;

      if (!nodeMap.has(currentPath)) {
        const newNode = emptyNode(seg, currentPath);
        nodeMap.set(currentPath, newNode);
        filesPerNode.set(currentPath, new Set());

        // Add to parent's children
        const parent = nodeMap.get(parentPath)!;
        parent.children.push(newNode);
      }
    }

    // Add the finding counts to the leaf folder node
    const leafNode = nodeMap.get(currentPath)!;
    if (finding.severity === "critical") leafNode.criticalCount++;
    else if (finding.severity === "warning") leafNode.warningCount++;
    else if (finding.severity === "info") leafNode.infoCount++;
    leafNode.totalCount++;

    // Track the file in the leaf and all ancestors (for fileCount)
    let trackPath = currentPath;
    while (true) {
      const set = filesPerNode.get(trackPath);
      if (set) set.add(relFile);
      if (trackPath === "") break;
      trackPath = trackPath.includes("/") ? trackPath.substring(0, trackPath.lastIndexOf("/")) : "";
    }
  }

  // Aggregate counts bottom-up (post-order traversal)
  function aggregate(node: FolderNode): void {
    for (const child of node.children) {
      aggregate(child);
      node.criticalCount += child.criticalCount;
      node.warningCount += child.warningCount;
      node.infoCount += child.infoCount;
      node.totalCount += child.totalCount;
    }
    node.score = calculateScore(node.criticalCount, node.warningCount, node.infoCount);
    node.fileCount = filesPerNode.get(node.path)?.size ?? 0;
  }

  // First aggregate counts — but we accumulated leaf-only counts above,
  // so we need to reset root and re-aggregate from leaves
  // Actually the leaf counts are already set; we just need to aggregate upward.
  // But we also added finding counts to leaf nodes, not intermediate nodes.
  // Let's reset counts on non-leaf segments (those that were created as parents)
  // and then aggregate. Since we only added counts to the direct folder, this is correct.
  aggregate(root);

  return root;
}

function renderHealthBar(score: number): string {
  const width = 10;
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}

function colorScore(score: number): string {
  const bar = renderHealthBar(score);
  const scoreStr = String(Math.round(score));
  if (score >= 80) {
    return chalk.green(bar) + " " + chalk.green(scoreStr);
  } else if (score >= 60) {
    return chalk.yellow(bar) + " " + chalk.yellow(scoreStr);
  } else {
    return chalk.red(bar) + " " + chalk.red(scoreStr);
  }
}

function folderIcon(node: FolderNode): string {
  if (node.criticalCount > 0) return "🔴";
  if (node.warningCount > 0) return "⚠️ ";
  return "✓ ";
}

function renderFolderSuffix(node: FolderNode): string {
  if (node.totalCount === 0) {
    return chalk.dim("✓  0 issues");
  }
  const icon = folderIcon(node);
  const countStr = ` ${node.totalCount} issue${node.totalCount !== 1 ? "s" : ""}`;
  const bar = " " + colorScore(node.score);

  let issuesPart: string;
  if (node.criticalCount > 0) {
    issuesPart = chalk.red(icon) + chalk.red(countStr);
  } else if (node.warningCount > 0) {
    issuesPart = chalk.yellow(icon) + chalk.yellow(countStr);
  } else {
    issuesPart = chalk.dim(icon) + chalk.dim(countStr);
  }

  return issuesPart + bar;
}

function _renderFileSuffix(findings: Finding[]): string {
  const criticals = findings.filter((f) => f.severity === "critical").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  const infos = findings.filter((f) => f.severity === "info").length;

  const parts: string[] = [];
  if (criticals > 0) parts.push(chalk.red(`🔴 ${criticals} critical`));
  if (warnings > 0) parts.push(chalk.yellow(`⚠️  ${warnings} warning${warnings !== 1 ? "s" : ""}`));
  if (infos > 0) parts.push(chalk.dim(`ℹ  ${infos} info`));
  return parts.join("  ");
}

export function renderHotmap(root: FolderNode, maxDepth: number = 4): string {
  const lines: string[] = [];

  // Summary line
  const totalIssues = root.totalCount;
  const folderCount = countFoldersWithIssues(root);
  lines.push(
    chalk.bold("  Complexity Hotmap") +
      chalk.dim(` — ${totalIssues} total issue${totalIssues !== 1 ? "s" : ""} across ${folderCount} folder${folderCount !== 1 ? "s" : ""}`)
  );

  // Hottest folders
  const hotFolders = getHottestFolders(root, 3);
  if (hotFolders.length > 0) {
    const hottestStr = hotFolders.map((n) => chalk.yellow(`${n.path || root.name} (${n.totalCount} issues)`)).join(", ");
    lines.push(chalk.dim("  Hottest folders: ") + hottestStr);
  }

  lines.push("");

  // Tree
  lines.push(chalk.bold(root.name + "/") + "  " + renderFolderSuffix(root));

  function renderChildren(node: FolderNode, prefix: string, depth: number): void {
    if (depth > maxDepth) return;

    // Filter children: show children that have findings, unless all children have 0 findings
    const visibleChildren = node.children.filter((c) => c.totalCount > 0);
    const childrenToRender = visibleChildren.length > 0 ? visibleChildren : node.children;

    for (let i = 0; i < childrenToRender.length; i++) {
      const child = childrenToRender[i];
      const isLast = i === childrenToRender.length - 1;
      const connector = isLast ? "└──" : "├──";
      const childPrefix = prefix + (isLast ? "    " : "│   ");

      lines.push(
        prefix +
          connector +
          " " +
          chalk.bold(child.name + "/") +
          "  " +
          renderFolderSuffix(child)
      );

      if (depth < maxDepth) {
        renderChildren(child, childPrefix, depth + 1);
      }
    }
  }

  renderChildren(root, "", 1);

  lines.push("");

  // Legend
  lines.push(
    chalk.dim("  🔴 critical  ⚠️  warning  ✓ clean   ") +
      chalk.green("[██████████]") +
      chalk.dim(" health bar")
  );

  return lines.join("\n");
}

function countFoldersWithIssues(root: FolderNode): number {
  let count = 0;
  function walk(node: FolderNode): void {
    if (node.totalCount > 0) count++;
    for (const child of node.children) walk(child);
  }
  walk(root);
  return count;
}

function getHottestFolders(root: FolderNode, topN: number): FolderNode[] {
  const all: FolderNode[] = [];
  function collect(node: FolderNode): void {
    if (node.path !== "" && node.totalCount > 0) all.push(node);
    for (const child of node.children) collect(child);
  }
  collect(root);
  return all.sort((a, b) => b.totalCount - a.totalCount).slice(0, topN);
}

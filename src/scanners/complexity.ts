import fs from "fs";
import fg from "fast-glob";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { SOURCE_EXTENSIONS, IGNORE_PATTERNS,
  SAFE_GLOB_OPTIONS,
} from "../utils/constants.js";
import { relativePath } from "../utils/files.js";

interface FunctionInfo {
  name: string;
  startLine: number;
  body: string;
}

interface ComplexityStats {
  totalFunctions: number;
  averageComplexity: number;
  maxComplexity: number;
  complexFunctions: number;
}

const WARNING_THRESHOLD = 15;
const CRITICAL_THRESHOLD = 25;

export class ComplexityScanner implements Scanner {
  name = "complexity";

  async scan(rootDir: string): Promise<ScanResult & { stats: ComplexityStats }> {
    const findings: Finding[] = [];

    const extGlob = SOURCE_EXTENSIONS.map((e) => `**/*${e}`);
    const allFiles = await fg(extGlob, {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      ...SAFE_GLOB_OPTIONS,
      absolute: true,
    });

    let totalComplexity = 0;
    let totalFunctions = 0;
    let maxComplexity = 0;
    let complexFunctions = 0;

    for (const file of allFiles) {
      let content: string;
      try {
        content = fs.readFileSync(file, "utf-8");
      } catch {
        continue;
      }

      const functions = extractFunctions(content);
      const rel = relativePath(rootDir, file);

      for (const fn of functions) {
        const complexity = calculateComplexity(fn.body);
        totalComplexity += complexity;
        totalFunctions++;

        if (complexity > maxComplexity) {
          maxComplexity = complexity;
        }

        if (complexity >= CRITICAL_THRESHOLD) {
          complexFunctions++;
          findings.push({
            id: `complexity-critical-${rel}-${fn.name}`,
            severity: "critical",
            category: "complexity",
            message: `${fn.name} in ${rel} has cyclomatic complexity of ${complexity} — this function needs its own zip code`,
            file: rel,
            detail: `complexity: ${complexity}`,
          });
        } else if (complexity >= WARNING_THRESHOLD) {
          complexFunctions++;
          findings.push({
            id: `complexity-warning-${rel}-${fn.name}`,
            severity: "warning",
            category: "complexity",
            message: `${fn.name} in ${rel} has cyclomatic complexity of ${complexity}`,
            file: rel,
            detail: `complexity: ${complexity}`,
          });
        }
      }
    }

    const stats: ComplexityStats = {
      totalFunctions,
      averageComplexity:
        totalFunctions > 0
          ? Math.round((totalComplexity / totalFunctions) * 100) / 100
          : 0,
      maxComplexity,
      complexFunctions,
    };

    return { findings, stats };
  }
}

function extractFunctions(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = content.split("\n");

  // Patterns to detect function declarations
  const patterns = [
    // function declarations: function name(, async function name(
    // eslint-disable-next-line security/detect-unsafe-regex -- Bounded by file content, not user input
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
    // arrow functions assigned to variables: const name = (, let name = (, var name = (
    // eslint-disable-next-line security/detect-unsafe-regex -- Bounded by file content, not user input
    /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/,
    // arrow functions assigned with arrow after params: const name = async (
    // eslint-disable-next-line security/detect-unsafe-regex -- Bounded by file content, not user input
    /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>/,
    // class methods: name(, async name(, public name(, private name(, protected name(
    // eslint-disable-next-line security/detect-unsafe-regex -- Bounded by file content, not user input
    /^\s+(?:public|private|protected|static|async|\s)*\s*(\w+)\s*\([^)]*\)\s*(?::\s*\w[^{]*)?\s*\{/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let fnName: string | null = null;

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        // Skip common non-function matches
        if (
          ["if", "else", "for", "while", "switch", "catch", "import", "from", "return", "class", "interface", "type", "constructor"].includes(match[1])
        ) {
          continue;
        }
        fnName = match[1];
        break;
      }
    }

    // Special case for constructor
    if (!fnName && /^\s+constructor\s*\(/.test(line)) {
      fnName = "constructor";
    }

    if (fnName) {
      const body = extractFunctionBody(lines, i);
      if (body) {
        functions.push({ name: fnName, startLine: i + 1, body });
      }
    }
  }

  return functions;
}

function extractFunctionBody(lines: string[], startLine: number): string | null {
  let braceCount = 0;
  let started = false;
  const bodyLines: string[] = [];

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];

    for (const ch of line) {
      if (ch === "{") {
        braceCount++;
        started = true;
      } else if (ch === "}") {
        braceCount--;
      }
    }

    bodyLines.push(line);

    if (started && braceCount === 0) {
      return bodyLines.join("\n");
    }
  }

  // Handle arrow functions without braces (single expression)
  if (!started && bodyLines.length > 0) {
    return bodyLines.slice(0, 5).join("\n");
  }

  return null;
}

function calculateComplexity(body: string): number {
  let complexity = 1;

  // Remove string literals and comments to avoid false positives
  const cleaned = body
    .replace(/\/\/.*$/gm, "") // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "") // multi-line comments
    .replace(/"(?:[^"\\]|\\.)*"/g, '""') // double-quoted strings
    .replace(/'(?:[^'\\]|\\.)*'/g, "''") // single-quoted strings
    .replace(/`(?:[^`\\]|\\.)*`/g, "``"); // template literals

  // Count decision points
  const decisionPatterns: [RegExp, number][] = [
    [/\bif\s*\(/g, 1],
    [/\belse\s+if\s*\(/g, 1],
    [/\bcase\s+/g, 1],
    [/\bwhile\s*\(/g, 1],
    [/\bfor\s*\(/g, 1],
    [/&&/g, 1],
    [/\|\|/g, 1],
    [/\?\./g, 1],
    [/\?\?/g, 1],
    [/\bcatch\s*\(/g, 1],
    // Ternary: ? not followed by . or ? (to avoid ?. and ??)
    [/\?(?![.?])/g, 1],
  ];

  for (const [pattern, weight] of decisionPatterns) {
    const matches = cleaned.match(pattern);
    if (matches) {
      complexity += matches.length * weight;
    }
  }

  // The "else if" was already counted by "if" pattern, subtract duplicates
  const elseIfMatches = cleaned.match(/\belse\s+if\s*\(/g);
  if (elseIfMatches) {
    complexity -= elseIfMatches.length;
  }

  return complexity;
}

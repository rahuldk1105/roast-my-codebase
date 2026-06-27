import fg from "fast-glob";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { SOURCE_EXTENSIONS, IGNORE_PATTERNS,
  SAFE_GLOB_OPTIONS,
} from "../utils/constants.js";
import { readFileLines, relativePath } from "../utils/files.js";

const _TODO_PATTERNS = [/\bTODO\b/, /\bFIXME\b/, /\bHACK\b/, /\bXXX\b/];

export class TodoScanner implements Scanner {
  name = "todos";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    const extGlob = SOURCE_EXTENSIONS.map((e) => `**/*${e}`);
    const files = await fg(extGlob, {
      cwd: rootDir,
      ignore: IGNORE_PATTERNS,
      ...SAFE_GLOB_OPTIONS,
      absolute: true,
    });

    let totalTodos = 0;
    let totalFixmes = 0;
    let totalHacks = 0;

    for (const file of files) {
      const lines = readFileLines(file);
      const _rel = relativePath(rootDir, file);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/\bTODO\b/.test(line)) totalTodos++;
        if (/\bFIXME\b/.test(line)) totalFixmes++;
        if (/\bHACK\b/.test(line) || /\bXXX\b/.test(line)) totalHacks++;
      }
    }

    const total = totalTodos + totalFixmes + totalHacks;

    if (total > 0) {
      findings.push({
        id: "todo-count",
        severity: total > 50 ? "warning" : "info",
        category: "todos",
        message: `Found ${total} comment markers (${totalTodos} TODO, ${totalFixmes} FIXME, ${totalHacks} HACK/XXX)`,
      });
    }

    if (totalHacks > 5) {
      findings.push({
        id: "hack-count",
        severity: "warning",
        category: "todos",
        message: `${totalHacks} HACK/XXX comments — someone was in survival mode`,
      });
    }

    return {
      findings,
      stats: { totalTodos, totalFixmes, totalHacks, total },
    };
  }
}

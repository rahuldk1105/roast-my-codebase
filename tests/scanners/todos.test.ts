import { describe, it, expect } from "vitest";
import path from "path";
import { TodoScanner } from "../../src/scanners/todos.js";

const FIXTURES = path.resolve(__dirname, "../fixtures");

describe("TodoScanner", () => {
  const scanner = new TodoScanner();

  it("detects TODO, FIXME, HACK, XXX markers", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));
    const stats = result.stats as {
      totalTodos: number;
      totalFixmes: number;
      totalHacks: number;
      total: number;
    };

    expect(stats.totalTodos).toBeGreaterThan(0);
    expect(stats.totalFixmes).toBeGreaterThan(0);
    expect(stats.totalHacks).toBeGreaterThan(0);
    expect(stats.total).toBe(
      stats.totalTodos + stats.totalFixmes + stats.totalHacks
    );
  });

  it("generates finding with correct counts", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "sample-project"));

    expect(result.findings.length).toBeGreaterThan(0);
    const main = result.findings.find((f) => f.id === "todo-count");
    expect(main).toBeDefined();
    expect(main!.category).toBe("todos");
    expect(main!.message).toContain("TODO");
  });

  it("returns empty for project with no markers", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "empty-project"));
    const stats = result.stats as { total: number };

    expect(stats.total).toBe(0);
    expect(result.findings).toEqual([]);
  });

  it("returns empty for non-existent path (no source files)", async () => {
    const result = await scanner.scan(path.join(FIXTURES, "no-package"));
    const stats = result.stats as { total: number };

    expect(stats.total).toBe(0);
    expect(result.findings).toEqual([]);
  });
});

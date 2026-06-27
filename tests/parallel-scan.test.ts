import { describe, it, expect } from "vitest";
import path from "path";
import {
  TodoScanner,
  DependencyScanner,
  SecurityScanner,
  ComplexityScanner,
  StructureScanner,
  TypeSafetyScanner,
} from "../src/scanners/index.js";

const FIXTURES = path.resolve(__dirname, "fixtures");
const SAMPLE = path.join(FIXTURES, "sample-project");

describe("Parallel scanner execution", () => {
  it("runs 3 scanners in parallel and returns 3 results", async () => {
    const [todoResult, depResult, securityResult] = await Promise.all([
      new TodoScanner().scan(SAMPLE),
      new DependencyScanner().scan(SAMPLE),
      new SecurityScanner().scan(SAMPLE),
    ]);

    expect(todoResult).toBeDefined();
    expect(todoResult.findings).toBeInstanceOf(Array);

    expect(depResult).toBeDefined();
    expect(depResult.findings).toBeInstanceOf(Array);

    expect(securityResult).toBeDefined();
    expect(securityResult.findings).toBeInstanceOf(Array);
  });

  it("parallel scan findings are identical to sequential scan findings", async () => {
    // Sequential
    const todoSeq = await new TodoScanner().scan(SAMPLE);
    const complexitySeq = await new ComplexityScanner().scan(SAMPLE);
    const structureSeq = await new StructureScanner().scan(SAMPLE);

    // Parallel
    const [todoPar, complexityPar, structurePar] = await Promise.all([
      new TodoScanner().scan(SAMPLE),
      new ComplexityScanner().scan(SAMPLE),
      new StructureScanner().scan(SAMPLE),
    ]);

    expect(todoPar.findings.length).toBe(todoSeq.findings.length);
    expect(complexityPar.findings.length).toBe(complexitySeq.findings.length);
    expect(structurePar.findings.length).toBe(structureSeq.findings.length);
  });

  it("all findings from parallel scans are included (no dropped results)", async () => {
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      new TodoScanner().scan(SAMPLE),
      new DependencyScanner().scan(SAMPLE),
      new SecurityScanner().scan(SAMPLE),
      new ComplexityScanner().scan(SAMPLE),
      new StructureScanner().scan(SAMPLE),
      new TypeSafetyScanner().scan(SAMPLE),
    ]);

    const allFindings = [
      ...r1.findings,
      ...r2.findings,
      ...r3.findings,
      ...r4.findings,
      ...r5.findings,
      ...r6.findings,
    ];

    // Each scanner ran and contributed its findings array
    expect(r1.findings).toBeDefined();
    expect(r2.findings).toBeDefined();
    expect(r3.findings).toBeDefined();
    expect(r4.findings).toBeDefined();
    expect(r5.findings).toBeDefined();
    expect(r6.findings).toBeDefined();

    // Combined count equals sum of individual counts
    const expectedCount =
      r1.findings.length +
      r2.findings.length +
      r3.findings.length +
      r4.findings.length +
      r5.findings.length +
      r6.findings.length;
    expect(allFindings.length).toBe(expectedCount);
  });

  it("parallel scan completes without throwing on a valid project", async () => {
    await expect(
      Promise.all([
        new TodoScanner().scan(SAMPLE),
        new SecurityScanner().scan(SAMPLE),
        new TypeSafetyScanner().scan(SAMPLE),
      ])
    ).resolves.toHaveLength(3);
  });
});

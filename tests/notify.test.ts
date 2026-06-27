import { describe, it, expect } from "vitest";
import {
  detectPlatform,
  formatSlackPayload,
  formatTeamsPayload,
  formatDiscordPayload,
  formatGenericPayload,
  sendNotification,
} from "../src/notify/index.js";
import { RoastReport } from "../src/types/index.js";

function makeReport(overrides: Partial<RoastReport> = {}): RoastReport {
  return {
    projectName: "test-project",
    stats: {
      totalFiles: 50,
      sourceFiles: 40,
      totalLines: 12500,
      largestFiles: [],
      dependencies: 12,
      devDependencies: 8,
    },
    health: {
      score: 72,
      grade: "C",
      label: "Fair",
    },
    findings: [
      {
        id: "f1",
        severity: "critical",
        category: "complexity",
        message: "auth.service.ts is too complex",
        file: "auth.service.ts",
      },
      {
        id: "f2",
        severity: "critical",
        category: "security",
        message: "Hardcoded secret found",
        file: "config.ts",
      },
      {
        id: "f3",
        severity: "critical",
        category: "complexity",
        message: "Another critical issue",
      },
      {
        id: "f4",
        severity: "warning",
        category: "dead-code",
        message: "Unused export formatDate",
        file: "utils/helpers.ts",
      },
      {
        id: "f5",
        severity: "warning",
        category: "style",
        message: "Missing type annotations in function",
      },
      {
        id: "f6",
        severity: "warning",
        category: "style",
        message: "A sixth finding that should not appear in top 5",
      },
      {
        id: "f7",
        severity: "info",
        category: "style",
        message: "Consider adding JSDoc comments",
      },
    ],
    roasts: [
      {
        target: "auth.service.ts",
        message: "This file has achieved sentience.",
        category: "complexity",
      },
    ],
    verdict: "Your codebase needs some love.",
    fixes: [],
    ...overrides,
  };
}

describe("detectPlatform", () => {
  it("identifies Slack webhook URLs", () => {
    expect(detectPlatform("https://hooks.slack.com/services/T00/B00/abc")).toBe("slack");
  });

  it("identifies Teams webhook URLs via webhook.office.com", () => {
    expect(detectPlatform("https://myorg.webhook.office.com/webhookb2/abc")).toBe("teams");
  });

  it("identifies Teams webhook URLs via outlook.office.com", () => {
    expect(detectPlatform("https://outlook.office.com/webhook/abc")).toBe("teams");
  });

  it("identifies Discord webhook URLs", () => {
    expect(detectPlatform("https://discord.com/api/webhooks/123/abc")).toBe("discord");
  });

  it("returns generic for unknown URLs", () => {
    expect(detectPlatform("https://example.com/webhook")).toBe("generic");
  });

  it("returns generic for localhost URLs", () => {
    expect(detectPlatform("http://localhost:3000/hook")).toBe("generic");
  });
});

describe("formatSlackPayload", () => {
  it("returns an object with a blocks array", () => {
    const payload = formatSlackPayload(makeReport()) as Record<string, unknown>;
    expect(Array.isArray(payload.blocks)).toBe(true);
  });

  it("includes a text fallback field", () => {
    const payload = formatSlackPayload(makeReport()) as Record<string, unknown>;
    expect(typeof payload.text).toBe("string");
    expect(payload.text as string).toContain("72/100");
  });

  it("includes header block with project name", () => {
    const payload = formatSlackPayload(makeReport()) as { blocks: Array<Record<string, unknown>> };
    const header = payload.blocks.find((b) => b.type === "header");
    expect(header).toBeDefined();
    const headerText = header?.text as Record<string, unknown>;
    expect(headerText?.text as string).toContain("test-project");
  });

  it("includes health score in section fields", () => {
    const payload = formatSlackPayload(makeReport()) as { blocks: Array<Record<string, unknown>> };
    const section = payload.blocks.find(
      (b) => b.type === "section" && Array.isArray(b.fields)
    );
    const fields = section?.fields as Array<Record<string, unknown>>;
    const healthField = fields?.find(
      (f) => typeof f.text === "string" && (f.text as string).includes("72/100")
    );
    expect(healthField).toBeDefined();
  });

  it("includes a context block with the verdict", () => {
    const payload = formatSlackPayload(makeReport()) as { blocks: Array<Record<string, unknown>> };
    const context = payload.blocks.find((b) => b.type === "context");
    expect(context).toBeDefined();
    const elements = context?.elements as Array<Record<string, unknown>>;
    expect(elements?.[0]?.text as string).toContain("Your codebase needs some love.");
  });

  it("limits top issues to at most 5 findings", () => {
    const report = makeReport();
    const payload = formatSlackPayload(report) as { blocks: Array<Record<string, unknown>> };
    const topIssueSection = payload.blocks.find(
      (b) =>
        b.type === "section" &&
        typeof (b.text as Record<string, unknown>)?.text === "string" &&
        ((b.text as Record<string, unknown>).text as string).includes("Top Issues")
    );
    if (topIssueSection) {
      const text = (topIssueSection.text as Record<string, unknown>).text as string;
      const bulletCount = (text.match(/^•/gm) || []).length;
      expect(bulletCount).toBeLessThanOrEqual(5);
    }
  });

  it("truncates long messages to 80 chars", () => {
    const longMessage = "A".repeat(200);
    const report = makeReport({
      findings: [{ id: "long", severity: "critical", category: "test", message: longMessage }],
    });
    const payload = formatSlackPayload(report) as { blocks: Array<Record<string, unknown>> };
    const topIssueSection = payload.blocks.find(
      (b) =>
        b.type === "section" &&
        typeof (b.text as Record<string, unknown>)?.text === "string" &&
        ((b.text as Record<string, unknown>).text as string).includes("Top Issues")
    );
    expect(topIssueSection).toBeDefined();
    const text = (topIssueSection!.text as Record<string, unknown>).text as string;
    // Each line after "Top Issues\n" should be short
    const lines = text.split("\n").slice(1);
    for (const line of lines) {
      // Account for bullet and icon prefix, the actual message part should be <= 80 chars
      expect(line.length).toBeLessThan(120); // emoji + "• " prefix + 80 char message
    }
  });
});

describe("formatTeamsPayload", () => {
  it("returns an object with an attachments array", () => {
    const payload = formatTeamsPayload(makeReport()) as Record<string, unknown>;
    expect(Array.isArray(payload.attachments)).toBe(true);
  });

  it("uses AdaptiveCard content type", () => {
    const payload = formatTeamsPayload(makeReport()) as {
      attachments: Array<Record<string, unknown>>;
    };
    expect(payload.attachments[0]?.contentType).toBe(
      "application/vnd.microsoft.card.adaptive"
    );
  });

  it("includes health score in FactSet", () => {
    const payload = formatTeamsPayload(makeReport()) as {
      attachments: Array<Record<string, unknown>>;
    };
    const content = payload.attachments[0]?.content as Record<string, unknown>;
    const body = content?.body as Array<Record<string, unknown>>;
    const factSet = body?.find((b) => b.type === "FactSet");
    expect(factSet).toBeDefined();
    const facts = factSet?.facts as Array<Record<string, string>>;
    const healthFact = facts?.find((f) => f.title === "Health Score");
    expect(healthFact?.value).toContain("72/100");
  });

  it("includes project name in title block", () => {
    const payload = formatTeamsPayload(makeReport()) as {
      attachments: Array<Record<string, unknown>>;
    };
    const content = payload.attachments[0]?.content as Record<string, unknown>;
    const body = content?.body as Array<Record<string, unknown>>;
    const titleBlock = body?.find((b) => b.type === "TextBlock" && b.size === "Large");
    expect(titleBlock?.text as string).toContain("test-project");
  });
});

describe("formatDiscordPayload", () => {
  it("returns an object with an embeds array", () => {
    const payload = formatDiscordPayload(makeReport()) as Record<string, unknown>;
    expect(Array.isArray(payload.embeds)).toBe(true);
  });

  it("has username set to Roast My Codebase", () => {
    const payload = formatDiscordPayload(makeReport()) as Record<string, unknown>;
    expect(payload.username).toBe("Roast My Codebase");
  });

  it("includes health score in embed title", () => {
    const payload = formatDiscordPayload(makeReport()) as {
      embeds: Array<Record<string, unknown>>;
    };
    expect(payload.embeds[0]?.title as string).toContain("72/100");
  });

  it("includes verdict in embed footer", () => {
    const payload = formatDiscordPayload(makeReport()) as {
      embeds: Array<Record<string, unknown>>;
    };
    const footer = payload.embeds[0]?.footer as Record<string, string>;
    expect(footer?.text).toBe("Your codebase needs some love.");
  });

  it("uses red color when score < 60", () => {
    const report = makeReport({ health: { score: 45, grade: "F", label: "Critical" } });
    const payload = formatDiscordPayload(report) as {
      embeds: Array<Record<string, unknown>>;
    };
    expect(payload.embeds[0]?.color).toBe(0xff0000);
  });

  it("uses orange color when score < 80", () => {
    const report = makeReport({ health: { score: 72, grade: "C", label: "Fair" } });
    const payload = formatDiscordPayload(report) as {
      embeds: Array<Record<string, unknown>>;
    };
    expect(payload.embeds[0]?.color).toBe(0xff8800);
  });

  it("uses green color when score >= 80", () => {
    const report = makeReport({ health: { score: 85, grade: "B", label: "Good" } });
    const payload = formatDiscordPayload(report) as {
      embeds: Array<Record<string, unknown>>;
    };
    expect(payload.embeds[0]?.color).toBe(0x00cc44);
  });

  it("limits Top Issues field to at most 5 findings", () => {
    const report = makeReport();
    const payload = formatDiscordPayload(report) as {
      embeds: Array<Record<string, unknown>>;
    };
    const fields = payload.embeds[0]?.fields as Array<Record<string, unknown>>;
    const topIssuesField = fields?.find((f) => f.name === "Top Issues");
    expect(topIssuesField).toBeDefined();
    const value = topIssuesField?.value as string;
    const bulletCount = (value.match(/^•/gm) || []).length;
    expect(bulletCount).toBeLessThanOrEqual(5);
  });

  it("truncates long messages at 80 chars", () => {
    const longMessage = "B".repeat(200);
    const report = makeReport({
      findings: [{ id: "long", severity: "critical", category: "test", message: longMessage }],
    });
    const payload = formatDiscordPayload(report) as {
      embeds: Array<Record<string, unknown>>;
    };
    const fields = payload.embeds[0]?.fields as Array<Record<string, unknown>>;
    const topIssuesField = fields?.find((f) => f.name === "Top Issues");
    const value = topIssuesField?.value as string;
    // The bullet line should be short (80 chars message + "• " prefix)
    const lines = value.split("\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(85); // "• " (2) + 80 chars + "…" (1)
    }
  });
});

describe("formatGenericPayload", () => {
  it("returns an object with a score field", () => {
    const payload = formatGenericPayload(makeReport()) as Record<string, unknown>;
    expect(payload.score).toBe(72);
  });

  it("includes grade and label", () => {
    const payload = formatGenericPayload(makeReport()) as Record<string, unknown>;
    expect(payload.grade).toBe("C");
    expect(payload.label).toBe("Fair");
  });

  it("includes findings counts", () => {
    const payload = formatGenericPayload(makeReport()) as {
      findings: { critical: number; warning: number; info: number };
    };
    expect(payload.findings.critical).toBe(3);
    expect(payload.findings.warning).toBe(3);
    expect(payload.findings.info).toBe(1);
  });

  it("includes top findings array", () => {
    const payload = formatGenericPayload(makeReport()) as {
      topFindings: Array<unknown>;
    };
    expect(Array.isArray(payload.topFindings)).toBe(true);
  });

  it("limits topFindings to at most 5 entries", () => {
    const payload = formatGenericPayload(makeReport()) as {
      topFindings: Array<unknown>;
    };
    expect(payload.topFindings.length).toBeLessThanOrEqual(5);
  });

  it("includes verdict", () => {
    const payload = formatGenericPayload(makeReport()) as Record<string, unknown>;
    expect(payload.verdict).toBe("Your codebase needs some love.");
  });

  it("includes project name", () => {
    const payload = formatGenericPayload(makeReport()) as Record<string, unknown>;
    expect(payload.projectName).toBe("test-project");
  });
});

describe("sendNotification", () => {
  it("skips sending when score >= threshold", async () => {
    const report = makeReport({ health: { score: 80, grade: "B", label: "Good" } });
    // Should resolve without error (and without actually hitting a URL)
    await expect(
      sendNotification(report, { url: "https://hooks.slack.com/services/test", threshold: 80 })
    ).resolves.toBeUndefined();
  });

  it("skips sending when score is well above threshold", async () => {
    const report = makeReport({ health: { score: 95, grade: "A", label: "Excellent" } });
    await expect(
      sendNotification(report, {
        url: "https://hooks.slack.com/services/test",
        threshold: 60,
      })
    ).resolves.toBeUndefined();
  });

  it("rejects with a useful error for invalid URLs", async () => {
    const report = makeReport();
    await expect(
      sendNotification(report, { url: "not-a-valid-url" })
    ).rejects.toThrow(/Invalid webhook URL/);
  });

  it("rejects with a useful error for empty string URL", async () => {
    const report = makeReport();
    await expect(
      sendNotification(report, { url: "" })
    ).rejects.toThrow(/Invalid webhook URL/);
  });
});

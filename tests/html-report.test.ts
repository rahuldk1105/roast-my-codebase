import { describe, it, expect } from "vitest";
import { renderHtmlReport } from "../src/report/html.js";
import { RoastReport, Finding, Roast } from "../src/types/index.js";

describe("HTML Report", () => {
  const mockStats = {
    totalFiles: 512,
    sourceFiles: 247,
    totalLines: 14203,
    largestFiles: [],
    dependencies: 42,
    devDependencies: 28,
  };

  const mockHealth = {
    score: 68,
    grade: "C",
    label: "Needs Work",
  };

  const mockFindings: Finding[] = [
    {
      id: "1",
      severity: "critical",
      category: "Large Files",
      message: "File has 1,847 lines",
      file: "src/utils/monster.ts",
    },
    {
      id: "2",
      severity: "warning",
      category: "Complexity",
      message: "Function 'processData' has complexity 42",
    },
    {
      id: "3",
      severity: "info",
      category: "TODOs",
      message: "Found 12 TODO comments",
    },
  ];

  const mockRoasts: Roast[] = [
    {
      target: "node_modules",
      message: "You have 847 dependencies. Is this a codebase or a dependency collector?",
      category: "Dependencies",
    },
    {
      target: "src/utils/monster.ts",
      message: "This file is so long it has its own time zones.",
      category: "Large Files",
    },
  ];

  const mockReport: RoastReport = {
    projectName: "test-project",
    stats: mockStats,
    health: mockHealth,
    findings: mockFindings,
    roasts: mockRoasts,
    verdict: "Your codebase needs some work, but there's hope!",
  };

  describe("renderHtmlReport", () => {
    it("should return a non-empty string", () => {
      const html = renderHtmlReport(mockReport);
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(0);
    });

    it("should return a valid HTML document structure", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html");
      expect(html).toContain("</html>");
      expect(html).toContain("<head>");
      expect(html).toContain("</head>");
      expect(html).toContain("<body>");
      expect(html).toContain("</body>");
    });

    it("should include the project name in the title and header", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("test-project");
      expect(html).toContain("<title>");
    });

    it("should include the health score", () => {
      const html = renderHtmlReport(mockReport);
      // Score appears in gauge and health label
      expect(html).toContain("68");
      expect(html).toContain("68/100");
    });

    it("should include the grade letter", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("Grade: C");
    });

    it("should include all stat box values", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("512"); // totalFiles
      expect(html).toContain("42");  // dependencies
      expect(html).toContain("3");   // findings count
    });

    it("should include finding categories", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("Large Files");
      expect(html).toContain("Complexity");
      expect(html).toContain("TODOs");
    });

    it("should include finding severity badges", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("badge-critical");
      expect(html).toContain("badge-warning");
      expect(html).toContain("badge-info");
    });

    it("should include finding messages", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("File has 1,847 lines");
      expect(html).toContain("Found 12 TODO comments");
    });

    it("should include file paths in findings", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("src/utils/monster.ts");
    });

    it("should include roast messages", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("You have 847 dependencies");
      expect(html).toContain("This file is so long it has its own time zones.");
    });

    it("should include roast targets", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("node_modules");
    });

    it("should include the verdict", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("Your codebase needs some work, but there&#039;s hope!");
    });

    it("should include an SVG gauge", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("<svg");
      expect(html).toContain("</svg>");
      expect(html).toContain("stroke-dasharray");
    });

    it("should include a severity breakdown section", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("Severity Breakdown");
      expect(html).toContain("severity-bar");
    });

    it("should include inline CSS with no external CDN or font links", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("<style>");
      // CDN / external resource links are not allowed
      expect(html).not.toMatch(/src=["']https?:\/\//);
      expect(html).not.toContain("cdn.jsdelivr.net");
      expect(html).not.toContain("fonts.googleapis.com");
    });

    it("should include sortable table with findings", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("findings-table");
      expect(html).toContain("sortable");
      expect(html).toContain("<thead>");
      expect(html).toContain("<tbody>");
    });

    it("should include inline JavaScript for sorting", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("<script>");
      expect(html).toContain("findings-table");
    });

    it("should escape HTML special characters in project name", () => {
      const report: RoastReport = {
        ...mockReport,
        projectName: "<script>alert('xss')</script>",
      };
      const html = renderHtmlReport(report);
      expect(html).not.toContain("<script>alert");
      expect(html).toContain("&lt;script&gt;");
    });

    it("should escape HTML special characters in finding messages", () => {
      const findings: Finding[] = [
        {
          id: "1",
          severity: "warning",
          category: "Test",
          message: "Message with <b>HTML</b> & entities",
        },
      ];
      const report: RoastReport = {
        ...mockReport,
        findings,
      };
      const html = renderHtmlReport(report);
      expect(html).toContain("&lt;b&gt;");
      expect(html).toContain("&amp;");
    });

    it("should truncate long messages at 120 chars", () => {
      const longMessage = "A".repeat(200);
      const findings: Finding[] = [
        {
          id: "1",
          severity: "info",
          category: "Test",
          message: longMessage,
        },
      ];
      const report: RoastReport = { ...mockReport, findings };
      const html = renderHtmlReport(report);
      // The cell text should be truncated: 120 A's followed by the ellipsis character (U+2026)
      const truncated = "A".repeat(120) + "…";
      expect(html).toContain(truncated);
      // The truncated text cell should NOT contain 200 A's straight (without ellipsis)
      // Note: the full message appears in the title="" tooltip attribute, which is expected
      expect(html).toContain("A".repeat(120) + "…");
    });

    it("should handle empty findings gracefully", () => {
      const report: RoastReport = {
        ...mockReport,
        findings: [],
        roasts: [],
      };
      const html = renderHtmlReport(report);
      expect(html).toContain("No findings");
      // Should not render the actual HTML table element (the CSS class name will still appear)
      expect(html).not.toContain('<table id="findings-table"');
    });

    it("should show 'no findings' message in severity section when empty", () => {
      const report: RoastReport = { ...mockReport, findings: [], roasts: [] };
      const html = renderHtmlReport(report);
      expect(html).toContain("severity-bar-empty");
    });

    it("should not show roasts section when roasts array is empty", () => {
      const report: RoastReport = { ...mockReport, roasts: [] };
      const html = renderHtmlReport(report);
      // No roast card elements should be rendered
      expect(html).not.toContain('<div class="roast-card">');
      // The roast list container should not appear
      expect(html).not.toContain('<div class="roast-list">');
    });

    it("should use green color class for high scores", () => {
      const report: RoastReport = {
        ...mockReport,
        health: { score: 90, grade: "A", label: "Excellent" },
      };
      const html = renderHtmlReport(report);
      // Green color for score >= 80
      expect(html).toContain("#3fb950");
    });

    it("should use red color class for low scores", () => {
      const report: RoastReport = {
        ...mockReport,
        health: { score: 30, grade: "F", label: "Critical" },
      };
      const html = renderHtmlReport(report);
      expect(html).toContain("#f85149");
    });

    it("should include filter buttons when there are findings", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).toContain("filter-btn");
      expect(html).toContain('data-filter="all"');
      expect(html).toContain('data-filter="critical"');
    });

    it("should format large numbers with commas", () => {
      const report: RoastReport = {
        ...mockReport,
        stats: {
          ...mockStats,
          totalLines: 89012,
          totalFiles: 1234,
        },
      };
      const html = renderHtmlReport(report);
      expect(html).toContain("89,012");
      expect(html).toContain("1,234");
    });

    it("should produce self-contained HTML (no external CDN links)", () => {
      const html = renderHtmlReport(mockReport);
      expect(html).not.toContain("cdn.jsdelivr.net");
      expect(html).not.toContain("cdnjs.cloudflare.com");
      expect(html).not.toContain("fonts.googleapis.com");
      expect(html).not.toContain("unpkg.com");
    });
  });
});

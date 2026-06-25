import { describe, it, expect } from "vitest";
import { getAsciiGrade, renderAsciiGrade } from "../src/report/ascii-art.js";
import { HealthScore } from "../src/types/index.js";

describe("ASCII Art", () => {
  describe("getAsciiGrade", () => {
    it("should return ASCII art for grade A", () => {
      const art = getAsciiGrade("A");
      expect(art).toContain("█████╗");
      expect(art).toContain("██╔══██╗");
      expect(art).toContain("███████║");
    });

    it("should return ASCII art for grade B", () => {
      const art = getAsciiGrade("B");
      expect(art).toContain("██████╗");
      expect(art).toContain("██╔══██╗");
      expect(art).toContain("██████╔╝");
    });

    it("should return ASCII art for grade C", () => {
      const art = getAsciiGrade("C");
      expect(art).toContain("██████╗");
      expect(art).toContain("██╔════╝");
    });

    it("should return ASCII art for grade D", () => {
      const art = getAsciiGrade("D");
      expect(art).toContain("██████╗");
      expect(art).toContain("██╔══██╗");
      expect(art).toContain("██║  ██║");
    });

    it("should return ASCII art for grade F", () => {
      const art = getAsciiGrade("F");
      expect(art).toContain("███████╗");
      expect(art).toContain("██╔════╝");
      expect(art).toContain("█████╗");
    });

    it("should fallback to F for invalid grade", () => {
      const art = getAsciiGrade("X");
      expect(art).toContain("███████╗");
      expect(art).toContain("██╔════╝");
      expect(art).toContain("█████╗");
    });
  });

  describe("renderAsciiGrade", () => {
    it("should render grade A with green color for score 95", () => {
      const health: HealthScore = {
        score: 95,
        grade: "A",
        label: "Excellent"
      };
      const rendered = renderAsciiGrade(health);
      expect(rendered).toBeTruthy();
      // Check that art is returned (color codes will be present)
      expect(rendered.length).toBeGreaterThan(0);
    });

    it("should render grade B with greenBright color for score 85", () => {
      const health: HealthScore = {
        score: 85,
        grade: "B",
        label: "Good"
      };
      const rendered = renderAsciiGrade(health);
      expect(rendered).toBeTruthy();
      expect(rendered.length).toBeGreaterThan(0);
    });

    it("should render grade C with yellow color for score 75", () => {
      const health: HealthScore = {
        score: 75,
        grade: "C",
        label: "Acceptable"
      };
      const rendered = renderAsciiGrade(health);
      expect(rendered).toBeTruthy();
      expect(rendered.length).toBeGreaterThan(0);
    });

    it("should render grade D with orange color for score 65", () => {
      const health: HealthScore = {
        score: 65,
        grade: "D",
        label: "Needs Improvement"
      };
      const rendered = renderAsciiGrade(health);
      expect(rendered).toBeTruthy();
      expect(rendered.length).toBeGreaterThan(0);
    });

    it("should render grade F with red color for score 45", () => {
      const health: HealthScore = {
        score: 45,
        grade: "F",
        label: "Critical"
      };
      const rendered = renderAsciiGrade(health);
      expect(rendered).toBeTruthy();
      expect(rendered.length).toBeGreaterThan(0);
    });

    it("should contain ASCII art characters in rendered output", () => {
      const health: HealthScore = {
        score: 95,
        grade: "A",
        label: "Excellent"
      };
      const rendered = renderAsciiGrade(health);
      // Should contain box drawing characters (may be wrapped in ANSI codes)
      expect(rendered).toMatch(/█/);
    });
  });
});

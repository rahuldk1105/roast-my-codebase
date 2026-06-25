import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { generateBadgeSvg, saveBadge } from "../src/report/badge.js";
import { HealthScore } from "../src/types/index.js";

describe("Badge Generator", () => {
  describe("generateBadgeSvg", () => {
    it("should generate green badge for score >= 90", () => {
      const health: HealthScore = { score: 95, grade: "A+", label: "Excellent" };
      const svg = generateBadgeSvg(health);

      expect(svg).toContain('fill="#44cc11"');
      expect(svg).toContain('95/100');
      expect(svg).toContain('Health');
    });

    it("should generate yellow-green badge for score >= 80", () => {
      const health: HealthScore = { score: 85, grade: "A", label: "Great" };
      const svg = generateBadgeSvg(health);

      expect(svg).toContain('fill="#97ca00"');
      expect(svg).toContain('85/100');
    });

    it("should generate yellow badge for score >= 70", () => {
      const health: HealthScore = { score: 75, grade: "B", label: "Good" };
      const svg = generateBadgeSvg(health);

      expect(svg).toContain('fill="#dfb317"');
      expect(svg).toContain('75/100');
    });

    it("should generate orange badge for score >= 60", () => {
      const health: HealthScore = { score: 65, grade: "C", label: "Fair" };
      const svg = generateBadgeSvg(health);

      expect(svg).toContain('fill="#fe7d37"');
      expect(svg).toContain('65/100');
    });

    it("should generate red badge for score < 60", () => {
      const health: HealthScore = { score: 45, grade: "D", label: "Poor" };
      const svg = generateBadgeSvg(health);

      expect(svg).toContain('fill="#e05d44"');
      expect(svg).toContain('45/100');
    });

    it("should have correct SVG structure", () => {
      const health: HealthScore = { score: 82, grade: "A", label: "Great" };
      const svg = generateBadgeSvg(health);

      // Check dimensions
      expect(svg).toContain('width="150"');
      expect(svg).toContain('height="20"');

      // Check gray background for "Health" label
      expect(svg).toContain('fill="#555"');

      // Check rounded corners
      expect(svg).toContain('rx="3"');

      // Check text elements
      expect(svg).toContain('font-family="Verdana"');
      expect(svg).toContain('font-size="11"');
      expect(svg).toContain('text-anchor="middle"');
      expect(svg).toContain('fill="#fff"');

      // Check two rectangles
      expect(svg.match(/<rect/g)?.length).toBe(2);

      // Check two text elements
      expect(svg.match(/<text/g)?.length).toBe(2);
    });

    it("should center text in rectangles", () => {
      const health: HealthScore = { score: 82, grade: "A", label: "Great" };
      const svg = generateBadgeSvg(health);

      // Left text (Health) centered at x=30 (60/2)
      expect(svg).toContain('x="30"');

      // Right text (score) centered at x=105 (60 + 90/2)
      expect(svg).toContain('x="105"');
    });
  });

  describe("saveBadge", () => {
    const testDir = path.join(process.cwd(), "tests", "fixtures", "badge-test");
    const badgePath = path.join(testDir, ".roast-badge.svg");

    beforeEach(() => {
      // Create test directory
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    afterEach(() => {
      // Clean up
      if (fs.existsSync(badgePath)) {
        fs.unlinkSync(badgePath);
      }
      if (fs.existsSync(testDir)) {
        fs.rmdirSync(testDir);
      }
    });

    it("should save SVG to .roast-badge.svg", () => {
      const health: HealthScore = { score: 82, grade: "A", label: "Great" };
      const svg = generateBadgeSvg(health);

      saveBadge(svg, testDir);

      expect(fs.existsSync(badgePath)).toBe(true);
      const content = fs.readFileSync(badgePath, "utf-8");
      expect(content).toBe(svg);
    });

    it("should overwrite existing badge", () => {
      const health1: HealthScore = { score: 82, grade: "A", label: "Great" };
      const svg1 = generateBadgeSvg(health1);
      saveBadge(svg1, testDir);

      const health2: HealthScore = { score: 95, grade: "A+", label: "Excellent" };
      const svg2 = generateBadgeSvg(health2);
      saveBadge(svg2, testDir);

      const content = fs.readFileSync(badgePath, "utf-8");
      expect(content).toBe(svg2);
      expect(content).toContain('95/100');
    });

    it("should throw error on invalid directory", () => {
      const health: HealthScore = { score: 82, grade: "A", label: "Great" };
      const svg = generateBadgeSvg(health);

      expect(() => {
        saveBadge(svg, "/invalid/nonexistent/path");
      }).toThrow();
    });
  });
});

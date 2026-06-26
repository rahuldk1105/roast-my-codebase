import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import {
  createSnapshot,
  addSnapshot,
  loadHistory,
  saveHistory,
  analyzeTrend,
  getSnapshotsByPeriod,
  generateTrendChart,
  getCategoryTrends,
} from "../src/history/index.js";
import { HealthScore, Finding } from "../src/types/index.js";

describe("Historical Health Tracking", () => {
  describe("Snapshot Creation", () => {
    it("should create a health snapshot", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));

      const health: HealthScore = {
        score: 85,
        grade: "B",
        label: "Good",
      };

      const findings: Finding[] = [
        {
          id: "finding-1",
          severity: "critical",
          category: "security",
          message: "Security issue",
        },
        {
          id: "finding-2",
          severity: "warning",
          category: "complexity",
          message: "Complex function",
        },
        {
          id: "finding-3",
          severity: "info",
          category: "todos",
          message: "TODO comment",
        },
      ];

      const snapshot = createSnapshot(health, findings, tempDir);

      expect(snapshot.score).toBe(85);
      expect(snapshot.grade).toBe("B");
      expect(snapshot.totalFindings).toBe(3);
      expect(snapshot.criticalCount).toBe(1);
      expect(snapshot.warningCount).toBe(1);
      expect(snapshot.infoCount).toBe(1);
      expect(snapshot.categoryCounts).toEqual({
        security: 1,
        complexity: 1,
        todos: 1,
      });
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.date).toBeDefined();

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe("History Storage", () => {
    it("should save and load history", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));

      const history = {
        projectName: "test-project",
        snapshots: [
          {
            timestamp: Date.now(),
            date: new Date().toISOString(),
            score: 85,
            grade: "B",
            totalFindings: 10,
            criticalCount: 2,
            warningCount: 5,
            infoCount: 3,
            categoryCounts: { security: 2, complexity: 5, todos: 3 },
          },
        ],
      };

      saveHistory(tempDir, history);

      const loaded = loadHistory(tempDir);

      expect(loaded).toBeDefined();
      expect(loaded?.projectName).toBe("test-project");
      expect(loaded?.snapshots.length).toBe(1);
      expect(loaded?.snapshots[0].score).toBe(85);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should return null for non-existent history", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));

      const loaded = loadHistory(tempDir);

      expect(loaded).toBeNull();

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should add snapshot to history", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));

      const snapshot = {
        timestamp: Date.now(),
        date: new Date().toISOString(),
        score: 90,
        grade: "A",
        totalFindings: 5,
        criticalCount: 0,
        warningCount: 3,
        infoCount: 2,
        categoryCounts: { complexity: 3, todos: 2 },
      };

      const history = addSnapshot(tempDir, "test-project", snapshot);

      expect(history.projectName).toBe("test-project");
      expect(history.snapshots.length).toBe(1);
      expect(history.snapshots[0].score).toBe(90);

      // Add another snapshot
      const snapshot2 = {
        ...snapshot,
        timestamp: Date.now() + 1000,
        score: 92,
      };

      const history2 = addSnapshot(tempDir, "test-project", snapshot2);

      expect(history2.snapshots.length).toBe(2);
      expect(history2.snapshots[1].score).toBe(92);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should limit snapshots to 100", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));

      // Create 105 snapshots
      let history = {
        projectName: "test-project",
        snapshots: Array.from({ length: 105 }, (_, i) => ({
          timestamp: Date.now() + i * 1000,
          date: new Date().toISOString(),
          score: 80 + i,
          grade: "B",
          totalFindings: 10,
          criticalCount: 2,
          warningCount: 5,
          infoCount: 3,
          categoryCounts: {},
        })),
      };

      saveHistory(tempDir, history);

      const newSnapshot = {
        timestamp: Date.now() + 106000,
        date: new Date().toISOString(),
        score: 95,
        grade: "A",
        totalFindings: 5,
        criticalCount: 0,
        warningCount: 3,
        infoCount: 2,
        categoryCounts: {},
      };

      const updated = addSnapshot(tempDir, "test-project", newSnapshot);

      expect(updated.snapshots.length).toBe(100);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe("Trend Analysis", () => {
    it("should analyze improving trend", () => {
      const now = Date.now();
      const history = {
        projectName: "test",
        snapshots: [
          {
            timestamp: now - 29 * 24 * 60 * 60 * 1000,
            date: "",
            score: 70,
            grade: "C",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {},
          },
          {
            timestamp: now,
            date: "",
            score: 85,
            grade: "B",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {},
          },
        ],
      };

      const trend = analyzeTrend(history, 30);

      expect(trend).toBeDefined();
      expect(trend?.trend).toBe("improving");
      expect(trend?.scoreChange).toBe(15);
      expect(trend?.improvementRate).toBeGreaterThan(0);
    });

    it("should analyze declining trend", () => {
      const now = Date.now();
      const history = {
        projectName: "test",
        snapshots: [
          {
            timestamp: now - 29 * 24 * 60 * 60 * 1000,
            date: "",
            score: 85,
            grade: "B",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {},
          },
          {
            timestamp: now,
            date: "",
            score: 70,
            grade: "C",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {},
          },
        ],
      };

      const trend = analyzeTrend(history, 30);

      expect(trend).toBeDefined();
      expect(trend?.trend).toBe("declining");
      expect(trend?.scoreChange).toBe(-15);
      expect(trend?.improvementRate).toBeLessThan(0);
    });

    it("should analyze stable trend", () => {
      const now = Date.now();
      const history = {
        projectName: "test",
        snapshots: [
          {
            timestamp: now - 30 * 24 * 60 * 60 * 1000,
            date: "",
            score: 80,
            grade: "B",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {},
          },
          {
            timestamp: now,
            date: "",
            score: 82,
            grade: "B",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {},
          },
        ],
      };

      const trend = analyzeTrend(history, 30);

      expect(trend).toBeDefined();
      expect(trend?.trend).toBe("stable");
      expect(trend?.scoreChange).toBe(2);
    });

    it("should return null for insufficient data", () => {
      const history = {
        projectName: "test",
        snapshots: [
          {
            timestamp: Date.now(),
            date: "",
            score: 80,
            grade: "B",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {},
          },
        ],
      };

      const trend = analyzeTrend(history, 30);

      expect(trend).toBeNull();
    });
  });

  describe("Snapshot Filtering", () => {
    it("should filter snapshots by period", () => {
      const now = Date.now();
      const history = {
        projectName: "test",
        snapshots: [
          {
            timestamp: now - 60 * 24 * 60 * 60 * 1000,
            date: "",
            score: 70,
            grade: "C",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {},
          },
          {
            timestamp: now - 20 * 24 * 60 * 60 * 1000,
            date: "",
            score: 80,
            grade: "B",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {},
          },
          {
            timestamp: now,
            date: "",
            score: 85,
            grade: "B",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {},
          },
        ],
      };

      const recent = getSnapshotsByPeriod(history, 30);

      expect(recent.length).toBe(2);
      expect(recent[0].score).toBe(80);
      expect(recent[1].score).toBe(85);
    });
  });

  describe("Chart Generation", () => {
    it("should generate trend chart", () => {
      const snapshots = [
        {
          timestamp: Date.now(),
          date: "",
          score: 70,
          grade: "C",
          totalFindings: 0,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
          categoryCounts: {},
        },
        {
          timestamp: Date.now() + 1000,
          date: "",
          score: 80,
          grade: "B",
          totalFindings: 0,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
          categoryCounts: {},
        },
        {
          timestamp: Date.now() + 2000,
          date: "",
          score: 90,
          grade: "A",
          totalFindings: 0,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
          categoryCounts: {},
        },
      ];

      const chart = generateTrendChart(snapshots, 40, 8);

      expect(chart).toBeDefined();
      expect(chart).toContain("●"); // Contains data points
      expect(chart).toContain("┤"); // Contains chart borders
      expect(chart).toContain("→"); // Contains axis
    });

    it("should handle insufficient data", () => {
      const snapshots = [
        {
          timestamp: Date.now(),
          date: "",
          score: 80,
          grade: "B",
          totalFindings: 0,
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
          categoryCounts: {},
        },
      ];

      const chart = generateTrendChart(snapshots);

      expect(chart).toBe("Not enough data for chart");
    });
  });

  describe("Category Trends", () => {
    it("should calculate category trends", () => {
      const now = Date.now();
      const history = {
        projectName: "test",
        snapshots: [
          {
            timestamp: now - 30 * 24 * 60 * 60 * 1000,
            date: "",
            score: 70,
            grade: "C",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {
              security: 5,
              complexity: 10,
              todos: 8,
            },
          },
          {
            timestamp: now,
            date: "",
            score: 85,
            grade: "B",
            totalFindings: 0,
            criticalCount: 0,
            warningCount: 0,
            infoCount: 0,
            categoryCounts: {
              security: 2,
              complexity: 12,
              todos: 3,
            },
          },
        ],
      };

      const trends = getCategoryTrends(history, 30);

      expect(trends.security).toBe(-3); // Improved
      expect(trends.complexity).toBe(2); // Declined
      expect(trends.todos).toBe(-5); // Improved
    });
  });
});

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { readFileSafely, debounce } from "../../src/utils/security.js";

describe("DoS Protection", () => {
  describe("File Size Limits", () => {
    it("should read small files successfully", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const filePath = path.join(tempDir, "small.txt");
      const content = "Hello, world!";

      fs.writeFileSync(filePath, content);
      const result = readFileSafely(filePath);

      expect(result).toBe(content);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should reject files exceeding size limit", () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
      const filePath = path.join(tempDir, "large.txt");

      // Create a 1KB file
      const largeContent = "a".repeat(1024);
      fs.writeFileSync(filePath, largeContent);

      // Try to read with 512 byte limit
      const result = readFileSafely(filePath, 512);
      expect(result).toBeNull();

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should handle non-existent files gracefully", () => {
      const result = readFileSafely("/non/existent/file.txt");
      expect(result).toBeNull();
    });

    it("should handle unreadable files gracefully", () => {
      if (os.platform() !== "win32") {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
        const filePath = path.join(tempDir, "unreadable.txt");

        fs.writeFileSync(filePath, "content");
        fs.chmodSync(filePath, 0o000); // Make unreadable

        const result = readFileSafely(filePath);
        expect(result).toBeNull();

        // Cleanup
        fs.chmodSync(filePath, 0o644);
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("Debounce Rate Limiting", () => {
    it("should debounce rapid function calls", async () => {
      let callCount = 0;
      const fn = () => {
        callCount++;
      };

      const debounced = debounce(fn, 100);

      // Call 10 times rapidly
      for (let i = 0; i < 10; i++) {
        debounced();
      }

      // Should not have executed yet
      expect(callCount).toBe(0);

      // Wait for debounce delay
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should have executed only once
      expect(callCount).toBe(1);
    });

    it("should execute after final call in rapid succession", async () => {
      let lastValue = 0;
      const fn = (value: number) => {
        lastValue = value;
      };

      const debounced = debounce(fn, 50);

      // Call multiple times
      debounced(1);
      debounced(2);
      debounced(3);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have the last value
      expect(lastValue).toBe(3);
    });

    it("should reset timer on each call", async () => {
      let callCount = 0;
      const fn = () => {
        callCount++;
      };

      const debounced = debounce(fn, 100);

      debounced();
      await new Promise((resolve) => setTimeout(resolve, 50));
      debounced(); // Reset timer
      await new Promise((resolve) => setTimeout(resolve, 50));
      debounced(); // Reset timer again

      // Should not have executed yet (timer keeps resetting)
      expect(callCount).toBe(0);

      // Wait for final execution
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(callCount).toBe(1);
    });

    it("should preserve function context", async () => {
      const obj = {
        value: 0,
        increment: debounce(function (this: any) {
          this.value++;
        }, 50),
      };

      obj.increment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(obj.value).toBe(1);
    });
  });
});

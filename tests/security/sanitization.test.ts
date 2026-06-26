import { describe, it, expect } from "vitest";
import { sanitizeError, escapeXml } from "../../src/utils/security.js";

describe("Sanitization", () => {
  describe("Error Message Sanitization", () => {
    it("should sanitize Windows file paths", () => {
      const error = new Error("File not found: C:\\Users\\admin\\secrets\\key.txt");
      const sanitized = sanitizeError(error);

      expect(sanitized).not.toContain("C:\\Users");
      expect(sanitized).not.toContain("admin");
      expect(sanitized).not.toContain("secrets");
      expect(sanitized).toContain("<path>");
    });

    it("should sanitize Unix file paths", () => {
      const error = new Error("Cannot read /home/user/.ssh/id_rsa");
      const sanitized = sanitizeError(error);

      expect(sanitized).not.toContain("/home/user");
      expect(sanitized).not.toContain(".ssh");
      expect(sanitized).not.toContain("id_rsa");
      expect(sanitized).toContain("<path>");
    });

    it("should redact passwords", () => {
      const error = new Error("Auth failed: password=secret123");
      const sanitized = sanitizeError(error);

      expect(sanitized).not.toContain("secret123");
      expect(sanitized).toContain("password=<redacted>");
    });

    it("should redact API tokens", () => {
      const error = new Error("Invalid token: sk_live_abcd1234");
      const sanitized = sanitizeError(error);

      expect(sanitized).not.toContain("sk_live_abcd1234");
      expect(sanitized).toContain("token=<redacted>");
    });

    it("should redact API keys", () => {
      const error = new Error("API request failed: api_key=xyz789");
      const sanitized = sanitizeError(error);

      expect(sanitized).not.toContain("xyz789");
      expect(sanitized).toContain("apikey=<redacted>");
    });

    it("should handle non-Error objects", () => {
      const sanitized = sanitizeError("Some string error");
      expect(sanitized).toBe("An unexpected error occurred");
    });

    it("should handle null/undefined", () => {
      expect(sanitizeError(null)).toBe("An unexpected error occurred");
      expect(sanitizeError(undefined)).toBe("An unexpected error occurred");
    });

    it("should preserve non-sensitive information", () => {
      const error = new Error("Connection timeout after 5000ms");
      const sanitized = sanitizeError(error);

      expect(sanitized).toContain("Connection timeout");
      expect(sanitized).toContain("5000ms");
    });
  });

  describe("XML/SVG Escaping", () => {
    it("should escape basic XML entities", () => {
      expect(escapeXml("Hello & World")).toBe("Hello &amp; World");
      expect(escapeXml("5 < 10")).toBe("5 &lt; 10");
      expect(escapeXml("10 > 5")).toBe("10 &gt; 5");
    });

    it("should escape quotes", () => {
      expect(escapeXml('Say "hello"')).toBe("Say &quot;hello&quot;");
      expect(escapeXml("Say 'hello'")).toBe("Say &apos;hello&apos;");
    });

    it("should handle numbers", () => {
      expect(escapeXml(123)).toBe("123");
      expect(escapeXml(0)).toBe("0");
      expect(escapeXml(-42)).toBe("-42");
    });

    it("should prevent XSS in SVG context", () => {
      const malicious = '<script>alert("XSS")</script>';
      const escaped = escapeXml(malicious);

      expect(escaped).not.toContain("<script>");
      expect(escaped).toBe("&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;");
    });

    it("should handle multiple entities in one string", () => {
      const input = '<tag attr="value">content & more</tag>';
      const escaped = escapeXml(input);

      expect(escaped).toBe(
        "&lt;tag attr=&quot;value&quot;&gt;content &amp; more&lt;/tag&gt;"
      );
    });

    it("should handle empty strings", () => {
      expect(escapeXml("")).toBe("");
    });

    it("should preserve safe characters", () => {
      const safe = "ABCabc123 -_./";
      expect(escapeXml(safe)).toBe(safe);
    });
  });
});

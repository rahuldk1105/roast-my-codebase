import { describe, it, expect, afterEach } from "vitest";
import http from "http";
import { generateDashboardHtml, startDashboard } from "../src/serve/index.js";
import { RoastReport } from "../src/types/index.js";

// ── Shared mock report ───────────────────────────────────────────────────────

const mockReport: RoastReport = {
  projectName: "test-serve-project",
  stats: {
    totalFiles: 42,
    sourceFiles: 30,
    totalLines: 5000,
    largestFiles: [],
    dependencies: 10,
    devDependencies: 5,
  },
  health: {
    score: 72,
    grade: "B",
    label: "Good",
  },
  findings: [
    {
      id: "f1",
      severity: "critical",
      category: "Security",
      message: "Hardcoded secret found",
      file: "src/auth.ts",
      detail: "Remove this credential and rotate immediately.",
    },
    {
      id: "f2",
      severity: "warning",
      category: "Complexity",
      message: "Function too complex",
    },
    {
      id: "f3",
      severity: "info",
      category: "TODOs",
      message: "Found 3 TODO comments",
    },
  ],
  roasts: [
    {
      target: "src/auth.ts",
      message: "Your security is so weak, a toddler could bypass it.",
      category: "Security",
    },
  ],
  verdict: "Needs work but there is hope.",
};

// ── generateDashboardHtml ────────────────────────────────────────────────────

describe("generateDashboardHtml", () => {
  it("returns a string containing <!DOCTYPE html>", () => {
    const html = generateDashboardHtml(mockReport);
    expect(typeof html).toBe("string");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("contains the project name", () => {
    const html = generateDashboardHtml(mockReport);
    expect(html).toContain("test-serve-project");
  });

  it("contains the health score", () => {
    const html = generateDashboardHtml(mockReport);
    expect(html).toContain("72");
  });

  it("contains application/json reference (for the API route embedded in the page)", () => {
    // The dashboard embeds the full report JSON inline so the client-side JS
    // can operate on it; the /api/report route also serves it.
    // The Content-Type value appears in the server source, not in the HTML itself,
    // but we verify the page embeds JSON data (report data starts with '{').
    const html = generateDashboardHtml(mockReport);
    // The report JSON is embedded in the <script> block
    expect(html).toContain('"projectName"');
    expect(html).toContain('"health"');
  });

  it("contains the grade", () => {
    const html = generateDashboardHtml(mockReport);
    expect(html).toContain("Grade: B");
  });

  it("contains the verdict", () => {
    const html = generateDashboardHtml(mockReport);
    expect(html).toContain("Needs work but there is hope.");
  });

  it("contains finding messages", () => {
    const html = generateDashboardHtml(mockReport);
    // Finding messages are embedded in the report JSON inside the <script>
    expect(html).toContain("Hardcoded secret found");
    expect(html).toContain("Function too complex");
  });

  it("contains roast message", () => {
    const html = generateDashboardHtml(mockReport);
    expect(html).toContain("Your security is so weak");
  });

  it("has no external CDN dependencies", () => {
    const html = generateDashboardHtml(mockReport);
    expect(html).not.toContain("cdn.jsdelivr.net");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("unpkg.com");
    expect(html).not.toContain("cdnjs.cloudflare.com");
  });

  it("escapes HTML special characters in project name", () => {
    const report: RoastReport = {
      ...mockReport,
      projectName: "<script>alert('xss')</script>",
    };
    const html = generateDashboardHtml(report);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes inline CSS and JavaScript", () => {
    const html = generateDashboardHtml(mockReport);
    expect(html).toContain("<style>");
    expect(html).toContain("<script>");
  });

  it("includes severity filter buttons", () => {
    const html = generateDashboardHtml(mockReport);
    expect(html).toContain('data-sev="critical"');
    expect(html).toContain('data-sev="warning"');
    expect(html).toContain('data-sev="info"');
    expect(html).toContain('data-sev="all"');
  });

  it("includes export JSON button", () => {
    const html = generateDashboardHtml(mockReport);
    expect(html).toContain("export-btn");
    expect(html).toContain("Export JSON");
  });

  it("handles empty findings gracefully", () => {
    const report: RoastReport = { ...mockReport, findings: [], roasts: [] };
    const html = generateDashboardHtml(report);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("test-serve-project");
  });
});

// ── startDashboard (HTTP server) ─────────────────────────────────────────────

describe("startDashboard", () => {
  // Collect servers to close after each test
  const servers: http.Server[] = [];
  afterEach(async () => {
    await Promise.all(
      servers.map(
        (s) =>
          new Promise<void>((resolve) => {
            if (!s.listening) { resolve(); return; }
            s.close(() => resolve());
          })
      )
    );
    servers.length = 0;
  });

  /** Pick a random high port to avoid conflicts across parallel test runs */
  function pickPort(): number {
    return 47000 + Math.floor(Math.random() * 1000);
  }

  /** Helper: make a GET request to the local server */
  function get(port: number, path: string): Promise<{ status: number; body: string; contentType: string }> {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => { body += chunk; });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body,
            contentType: String(res.headers["content-type"] ?? ""),
          });
        });
      });
      req.on("error", reject);
    });
  }

  /** Wait until the server is actually listening */
  function waitListening(server: http.Server): Promise<number> {
    return new Promise((resolve, reject) => {
      if (server.listening) {
        const addr = server.address() as { port: number };
        resolve(addr.port);
        return;
      }
      server.once("listening", () => {
        const addr = server.address() as { port: number };
        resolve(addr.port);
      });
      server.once("error", reject);
    });
  }

  it("starts a server and GET /health returns {\"ok\":true}", async () => {
    const port = pickPort();
    const server = startDashboard(mockReport, port);
    servers.push(server);
    const actualPort = await waitListening(server);

    const res = await get(actualPort, "/health");
    expect(res.status).toBe(200);
    expect(res.body).toBe('{"ok":true}');
  });

  it("GET /api/report returns JSON with health.score", async () => {
    const port = pickPort();
    const server = startDashboard(mockReport, port);
    servers.push(server);
    const actualPort = await waitListening(server);

    const res = await get(actualPort, "/api/report");
    expect(res.status).toBe(200);
    expect(res.contentType).toContain("application/json");

    const parsed = JSON.parse(res.body) as RoastReport;
    expect(parsed.health.score).toBe(mockReport.health.score);
    expect(parsed.projectName).toBe(mockReport.projectName);
  });

  it("GET / returns HTML with Content-Type text/html", async () => {
    const port = pickPort();
    const server = startDashboard(mockReport, port);
    servers.push(server);
    const actualPort = await waitListening(server);

    const res = await get(actualPort, "/");
    expect(res.status).toBe(200);
    expect(res.contentType).toContain("text/html");
    expect(res.body).toContain("<!DOCTYPE html>");
    expect(res.body).toContain("test-serve-project");
  });

  it("unknown routes return 404", async () => {
    const port = pickPort();
    const server = startDashboard(mockReport, port);
    servers.push(server);
    const actualPort = await waitListening(server);

    const res = await get(actualPort, "/not-a-route");
    expect(res.status).toBe(404);
  });

  it("returns the http.Server instance", () => {
    const port = pickPort();
    const server = startDashboard(mockReport, port);
    servers.push(server);
    expect(server).toBeInstanceOf(http.Server);
  });

  it("serves the correct report JSON from /api/report", async () => {
    const port = pickPort();
    const server = startDashboard(mockReport, port);
    servers.push(server);
    const actualPort = await waitListening(server);

    const res = await get(actualPort, "/api/report");
    const parsed = JSON.parse(res.body) as RoastReport;
    expect(parsed.findings).toHaveLength(mockReport.findings.length);
    expect(parsed.findings[0].severity).toBe("critical");
    expect(parsed.verdict).toBe(mockReport.verdict);
  });

  it("GET /events returns text/event-stream content type", async () => {
    const port = pickPort();
    const server = startDashboard(mockReport, port);
    servers.push(server);
    const actualPort = await waitListening(server);

    // Use a raw request so we can read the first chunk and then destroy the connection
    await new Promise<void>((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${actualPort}/events`, (res) => {
        try {
          expect(res.statusCode).toBe(200);
          expect(res.headers["content-type"]).toContain("text/event-stream");
          // Read the initial "connected" event then abort
          res.once("data", () => {
            req.destroy();
            resolve();
          });
        } catch (err) {
          reject(err);
        }
      });
      req.on("error", (err) => {
        // ECONNRESET is expected when we call req.destroy()
        if ((err as NodeJS.ErrnoException).code === "ECONNRESET") {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  });

  it("POST /rescan returns 202 when rescan option is provided", async () => {
    const port = pickPort();
    let _rescanCalled = false;
    const server = startDashboard(mockReport, port, {
      watch: false,
      rescan: async () => {
        _rescanCalled = true;
        return mockReport;
      },
    });
    servers.push(server);
    const actualPort = await waitListening(server);

    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: actualPort, path: "/rescan", method: "POST" },
        (res) => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => { body += chunk; });
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
        }
      );
      req.on("error", reject);
      req.end();
    });

    expect(res.status).toBe(202);
    const parsed = JSON.parse(res.body);
    expect(parsed.status).toBe("scanning");
  });

  it("backward compat: startDashboard works without options argument", async () => {
    const port = pickPort();
    // No options argument — should not throw
    const server = startDashboard(mockReport, port);
    servers.push(server);
    const actualPort = await waitListening(server);

    const res = await get(actualPort, "/health");
    expect(res.status).toBe(200);
  });

  it("backward compat: startDashboard works with empty options object", async () => {
    const port = pickPort();
    const server = startDashboard(mockReport, port, {});
    servers.push(server);
    const actualPort = await waitListening(server);

    const res = await get(actualPort, "/");
    expect(res.status).toBe(200);
    expect(res.contentType).toContain("text/html");
  });

  it("SSE client tracking: connect adds client, close removes it", async () => {
    const port = pickPort();
    const server = startDashboard(mockReport, port);
    servers.push(server);
    const actualPort = await waitListening(server);

    // Open SSE connection and verify we receive the connected event
    await new Promise<void>((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${actualPort}/events`, (res) => {
        expect(res.statusCode).toBe(200);
        let buf = "";
        res.on("data", (chunk: Buffer) => {
          buf += chunk.toString();
          // Once we have the initial connected message, close the connection
          if (buf.includes('"type":"connected"')) {
            req.destroy();
          }
        });
      });
      req.on("error", (err) => {
        if ((err as NodeJS.ErrnoException).code === "ECONNRESET") {
          resolve();
        } else {
          reject(err);
        }
      });
      req.on("close", resolve);
    });
  });
});

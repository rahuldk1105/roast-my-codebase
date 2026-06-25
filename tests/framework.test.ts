import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FrameworkScanner } from "../src/scanners/framework.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("FrameworkScanner", () => {
  let tempDir: string;
  let scanner: FrameworkScanner;

  beforeEach(() => {
    scanner = new FrameworkScanner();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "framework-test-"));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Framework Detection", () => {
    it("returns empty findings when no package.json exists", async () => {
      const result = await scanner.scan(tempDir);

      expect(result.findings).toEqual([]);
      expect(result.stats).toEqual({ isNextJS: false, isReact: false });
    });

    it("returns empty findings when not a Next.js or React project", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: {
            express: "^4.0.0",
          },
        })
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toEqual([]);
      expect(result.stats).toEqual({ isNextJS: false, isReact: false });
    });

    it("detects Next.js from dependencies", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: {
            next: "^14.0.0",
            react: "^18.0.0",
          },
        })
      );

      const result = await scanner.scan(tempDir);

      expect(result.stats).toEqual({ isNextJS: true, isReact: true });
    });

    it("detects Next.js from devDependencies", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          devDependencies: {
            next: "^14.0.0",
          },
          dependencies: {
            react: "^18.0.0",
          },
        })
      );

      const result = await scanner.scan(tempDir);

      expect(result.stats).toEqual({ isNextJS: true, isReact: true });
    });

    it("detects React without Next.js", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: {
            react: "^18.0.0",
          },
        })
      );

      const result = await scanner.scan(tempDir);

      expect(result.stats).toEqual({ isNextJS: false, isReact: true });
    });

    it("handles invalid package.json gracefully", async () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), "invalid json{");

      const result = await scanner.scan(tempDir);

      expect(result.findings).toEqual([]);
      expect(result.stats).toEqual({ isNextJS: false, isReact: false });
    });
  });

  describe("Next.js Metadata Checks", () => {
    beforeEach(() => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: {
            next: "^14.0.0",
            react: "^18.0.0",
          },
        })
      );
    });

    it("flags page without metadata export", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        `export default function HomePage() {
          return <div>Home</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        severity: "warning",
        category: "nextjs-metadata",
        message: expect.stringContaining("missing metadata export"),
        file: "app/page.tsx",
      });
    });

    it("accepts page with const metadata", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        `export const metadata = {
          title: "Home",
        };

        export default function HomePage() {
          return <div>Home</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      const metadataFindings = result.findings.filter(
        (f) => f.category === "nextjs-metadata"
      );
      expect(metadataFindings).toHaveLength(0);
    });

    it("accepts page with generateMetadata function", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        `export function generateMetadata() {
          return { title: "Home" };
        }

        export default function HomePage() {
          return <div>Home</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      const metadataFindings = result.findings.filter(
        (f) => f.category === "nextjs-metadata"
      );
      expect(metadataFindings).toHaveLength(0);
    });

    it("accepts page with async generateMetadata function", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        `export async function generateMetadata() {
          return { title: "Home" };
        }

        export default function HomePage() {
          return <div>Home</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      const metadataFindings = result.findings.filter(
        (f) => f.category === "nextjs-metadata"
      );
      expect(metadataFindings).toHaveLength(0);
    });

    it("checks nested pages", async () => {
      const appDir = path.join(tempDir, "app");
      const aboutDir = path.join(appDir, "about");
      fs.mkdirSync(aboutDir, { recursive: true });
      fs.writeFileSync(
        path.join(aboutDir, "page.tsx"),
        `export default function AboutPage() {
          return <div>About</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        severity: "warning",
        category: "nextjs-metadata",
        file: "app/about/page.tsx",
      });
    });

    it("handles multiple pages without metadata", async () => {
      const appDir = path.join(tempDir, "app");
      const aboutDir = path.join(appDir, "about");
      const contactDir = path.join(appDir, "contact");

      fs.mkdirSync(aboutDir, { recursive: true });
      fs.mkdirSync(contactDir, { recursive: true });

      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        `export default function HomePage() { return <div>Home</div>; }`
      );
      fs.writeFileSync(
        path.join(aboutDir, "page.tsx"),
        `export default function AboutPage() { return <div>About</div>; }`
      );
      fs.writeFileSync(
        path.join(contactDir, "page.tsx"),
        `export default function ContactPage() { return <div>Contact</div>; }`
      );

      const result = await scanner.scan(tempDir);

      const metadataFindings = result.findings.filter(
        (f) => f.category === "nextjs-metadata"
      );
      expect(metadataFindings).toHaveLength(3);
    });

    it("works with .js files", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "page.js"),
        `export default function HomePage() {
          return <div>Home</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        category: "nextjs-metadata",
        file: "app/page.js",
      });
    });
  });

  describe("Next.js Server/Client Component Checks", () => {
    beforeEach(() => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: {
            next: "^14.0.0",
            react: "^18.0.0",
          },
        })
      );
    });

    it("flags server component using useState", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "counter.tsx"),
        `import { useState } from 'react';

        export function Counter() {
          const [count, setCount] = useState(0);
          return <button onClick={() => setCount(count + 1)}>{count}</button>;
        }`
      );

      const result = await scanner.scan(tempDir);

      const clientServerFindings = result.findings.filter(
        (f) => f.category === "nextjs-client-server"
      );
      expect(clientServerFindings).toHaveLength(1);
      expect(clientServerFindings[0]).toMatchObject({
        severity: "warning",
        message: expect.stringContaining("uses client hooks without 'use client'"),
        file: "app/counter.tsx",
      });
    });

    it("flags server component using useEffect", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "tracker.tsx"),
        `import { useEffect } from 'react';

        export function Tracker() {
          useEffect(() => {
            console.log('mounted');
          }, []);
          return <div>Tracking</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      const clientServerFindings = result.findings.filter(
        (f) => f.category === "nextjs-client-server"
      );
      expect(clientServerFindings).toHaveLength(1);
    });

    it("flags server component using useLayoutEffect", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "layout-comp.tsx"),
        `import { useLayoutEffect } from 'react';

        export function LayoutComp() {
          useLayoutEffect(() => {}, []);
          return <div>Layout</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      const clientServerFindings = result.findings.filter(
        (f) => f.category === "nextjs-client-server"
      );
      expect(clientServerFindings).toHaveLength(1);
    });

    it("flags server component using useReducer", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "reducer.tsx"),
        `import { useReducer } from 'react';

        export function ReducerComp() {
          const [state, dispatch] = useReducer(reducer, initialState);
          return <div>{state}</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      const clientServerFindings = result.findings.filter(
        (f) => f.category === "nextjs-client-server"
      );
      expect(clientServerFindings).toHaveLength(1);
    });

    it("accepts client component with 'use client' directive", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "counter.tsx"),
        `'use client';

        import { useState } from 'react';

        export function Counter() {
          const [count, setCount] = useState(0);
          return <button onClick={() => setCount(count + 1)}>{count}</button>;
        }`
      );

      const result = await scanner.scan(tempDir);

      const clientServerFindings = result.findings.filter(
        (f) => f.category === "nextjs-client-server"
      );
      expect(clientServerFindings).toHaveLength(0);
    });

    it("accepts client component with double quotes", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "counter.tsx"),
        `"use client";

        import { useState } from 'react';

        export function Counter() {
          const [count, setCount] = useState(0);
          return <button>{count}</button>;
        }`
      );

      const result = await scanner.scan(tempDir);

      const clientServerFindings = result.findings.filter(
        (f) => f.category === "nextjs-client-server"
      );
      expect(clientServerFindings).toHaveLength(0);
    });

    it("accepts server component without client hooks", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "server-comp.tsx"),
        `export async function ServerComp() {
          const data = await fetchData();
          return <div>{data}</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      const clientServerFindings = result.findings.filter(
        (f) => f.category === "nextjs-client-server"
      );
      expect(clientServerFindings).toHaveLength(0);
    });
  });

  describe("React Error Boundary Checks", () => {
    beforeEach(() => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: {
            react: "^18.0.0",
          },
        })
      );
    });

    it("flags app/layout.tsx without error boundary", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "layout.tsx"),
        `export default function RootLayout({ children }) {
          return <html><body>{children}</body></html>;
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        severity: "info",
        category: "react-error-boundary",
        message: expect.stringContaining("could benefit from an error boundary"),
        file: "app/layout.tsx",
      });
    });

    it("accepts app/layout.tsx with ErrorBoundary component", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "layout.tsx"),
        `import { ErrorBoundary } from './ErrorBoundary';

        export default function RootLayout({ children }) {
          return (
            <html>
              <body>
                <ErrorBoundary>{children}</ErrorBoundary>
              </body>
            </html>
          );
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(0);
    });

    it("accepts component with componentDidCatch", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "layout.tsx"),
        `class ErrorBoundary extends React.Component {
          componentDidCatch(error, info) {
            console.error(error);
          }

          render() {
            return this.props.children;
          }
        }

        export default function RootLayout({ children }) {
          return <ErrorBoundary>{children}</ErrorBoundary>;
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(0);
    });

    it("accepts component with getDerivedStateFromError", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "layout.tsx"),
        `class ErrorBoundary extends React.Component {
          static getDerivedStateFromError(error) {
            return { hasError: true };
          }

          render() {
            return this.props.children;
          }
        }

        export default function RootLayout({ children }) {
          return <ErrorBoundary>{children}</ErrorBoundary>;
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(0);
    });

    it("checks pages/_app.tsx for error boundary", async () => {
      const pagesDir = path.join(tempDir, "pages");
      fs.mkdirSync(pagesDir);
      fs.writeFileSync(
        path.join(pagesDir, "_app.tsx"),
        `export default function App({ Component, pageProps }) {
          return <Component {...pageProps} />;
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        category: "react-error-boundary",
        file: "pages/_app.tsx",
      });
    });

    it("checks src/App.tsx for error boundary", async () => {
      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, "App.tsx"),
        `export default function App() {
          return <div>App</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        category: "react-error-boundary",
        file: "src/App.tsx",
      });
    });

    it("checks app/error.tsx for error boundary", async () => {
      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);
      fs.writeFileSync(
        path.join(appDir, "error.tsx"),
        `export default function Error({ error }) {
          return <div>Error: {error.message}</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        category: "react-error-boundary",
        file: "app/error.tsx",
      });
    });

    it("does not flag when no root components found", async () => {
      // No root components, should return no findings
      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(0);
    });

    it("works with .js files", async () => {
      const srcDir = path.join(tempDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, "App.js"),
        `export default function App() {
          return <div>App</div>;
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]).toMatchObject({
        category: "react-error-boundary",
        file: "src/App.js",
      });
    });
  });

  describe("Combined Framework Checks", () => {
    it("runs both Next.js and React checks together", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: {
            next: "^14.0.0",
            react: "^18.0.0",
          },
        })
      );

      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);

      // Page without metadata
      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        `export default function HomePage() { return <div>Home</div>; }`
      );

      // Layout without error boundary
      fs.writeFileSync(
        path.join(appDir, "layout.tsx"),
        `export default function RootLayout({ children }) {
          return <html><body>{children}</body></html>;
        }`
      );

      // Server component using client hooks
      fs.writeFileSync(
        path.join(appDir, "counter.tsx"),
        `import { useState } from 'react';
        export function Counter() {
          const [count, setCount] = useState(0);
          return <button>{count}</button>;
        }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings).toHaveLength(3);
      expect(result.findings.map((f) => f.category)).toEqual(
        expect.arrayContaining([
          "nextjs-metadata",
          "nextjs-client-server",
          "react-error-boundary",
        ])
      );
    });
  });

  describe("Edge Cases", () => {
    it("handles binary files gracefully", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: {
            next: "^14.0.0",
            react: "^18.0.0",
          },
        })
      );

      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);

      // Create a valid page file alongside a binary file
      fs.writeFileSync(
        path.join(appDir, "page.tsx"),
        `export const metadata = { title: "Home" };
        export default function HomePage() { return <div>Home</div>; }`
      );

      // Create a binary file (this won't match the page pattern anyway)
      const binaryPath = path.join(appDir, "image.png");
      fs.writeFileSync(binaryPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const result = await scanner.scan(tempDir);

      // Should process the valid page without errors
      const metadataFindings = result.findings.filter(
        (f) => f.category === "nextjs-metadata"
      );
      expect(metadataFindings).toHaveLength(0);
    });

    it("handles empty app directory", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: {
            next: "^14.0.0",
            react: "^18.0.0",
          },
        })
      );

      const appDir = path.join(tempDir, "app");
      fs.mkdirSync(appDir);

      const result = await scanner.scan(tempDir);

      expect(result.findings).toEqual([]);
    });

    it("normalizes Windows paths to forward slashes", async () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({
          dependencies: {
            next: "^14.0.0",
          },
        })
      );

      const appDir = path.join(tempDir, "app");
      const nestedDir = path.join(appDir, "deeply", "nested");
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(
        path.join(nestedDir, "page.tsx"),
        `export default function Page() { return <div>Page</div>; }`
      );

      const result = await scanner.scan(tempDir);

      expect(result.findings[0].file).toMatch(/app\/deeply\/nested\/page\.tsx/);
    });
  });
});

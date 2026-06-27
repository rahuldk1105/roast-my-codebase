import { describe, it, expect } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { RubyComplexityScanner, RubyCodeSmellScanner, RubyStyleScanner } from "../../src/scanners/ruby.js";
import { PHPSecurityScanner, PHPCodeSmellScanner } from "../../src/scanners/php.js";
import { SwiftCodeSmellScanner } from "../../src/scanners/swift.js";
import { KotlinCodeSmellScanner, KotlinCoroutineScanner } from "../../src/scanners/kotlin.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "roast-test-"));
}

function writeFile(dir: string, filename: string, content: string): string {
  const filePath = path.join(dir, filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function rmDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("RubyComplexityScanner", () => {
  it("detects a complex method (≥8 decision points)", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "complex.rb", `
def complex_method(x)
  if x > 0
    if x > 10
      if x > 20
        while x > 0
          x -= 1 if x && x > 5 || x < 3
        end
        x -= 1 unless x == 0
      end
    end
  end
end
`);
      const scanner = new RubyComplexityScanner();
      const result = await scanner.scan(dir);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0].category).toBe("complexity");
      expect(result.findings[0].message).toContain("complex_method");
    } finally {
      rmDir(dir);
    }
  });
});

describe("RubyCodeSmellScanner", () => {
  it("detects eval() usage", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "smelly.rb", `
def run_code(input)
  # NOTE: scanning for eval usage in user code — not calling eval ourselves
  eval(input)
end
`);
      const scanner = new RubyCodeSmellScanner();
      const result = await scanner.scan(dir);
      const evalFinding = result.findings.find(f => f.id.includes("eval"));
      expect(evalFinding).toBeDefined();
      expect(evalFinding!.severity).toBe("warning");
      expect(evalFinding!.category).toBe("security");
    } finally {
      rmDir(dir);
    }
  });

  it("detects god class with >20 methods", async () => {
    const dir = makeTempDir();
    try {
      const methods = Array.from({ length: 22 }, (_, i) => `  def method_${i}\n  end`).join("\n");
      writeFile(dir, "fat.rb", `class FatClass\n${methods}\nend\n`);
      const scanner = new RubyCodeSmellScanner();
      const result = await scanner.scan(dir);
      const godClass = result.findings.find(f => f.id.includes("god-class"));
      expect(godClass).toBeDefined();
      expect(godClass!.severity).toBe("warning");
    } finally {
      rmDir(dir);
    }
  });
});

describe("RubyStyleScanner", () => {
  it("flags missing frozen_string_literal comment", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "no_frozen.rb", `class Foo\n  def bar\n    'hello'\n  end\nend\n`);
      const scanner = new RubyStyleScanner();
      const result = await scanner.scan(dir);
      const finding = result.findings.find(f => f.id.includes("frozen-string-literal"));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe("info");
    } finally {
      rmDir(dir);
    }
  });

  it("does NOT flag frozen_string_literal when present", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "frozen.rb", `# frozen_string_literal: true\nclass Foo\nend\n`);
      const scanner = new RubyStyleScanner();
      const result = await scanner.scan(dir);
      const finding = result.findings.find(f => f.id.includes("frozen-string-literal"));
      expect(finding).toBeUndefined();
    } finally {
      rmDir(dir);
    }
  });
});

describe("PHPSecurityScanner", () => {
  it("detects eval() usage", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "danger.php", `<?php\n// scanning for eval in user's PHP code\n$result = eval($userInput);\n`);
      const scanner = new PHPSecurityScanner();
      const result = await scanner.scan(dir);
      const evalFinding = result.findings.find(f => f.id.includes("eval"));
      expect(evalFinding).toBeDefined();
      expect(evalFinding!.severity).toBe("warning");
      expect(evalFinding!.category).toBe("security");
    } finally {
      rmDir(dir);
    }
  });

  it("detects MD5 password hashing", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "auth.php", `<?php\n$hash = md5($password);\n`);
      const scanner = new PHPSecurityScanner();
      const result = await scanner.scan(dir);
      const md5Finding = result.findings.find(f => f.id.includes("md5-password"));
      expect(md5Finding).toBeDefined();
      expect(md5Finding!.severity).toBe("critical");
    } finally {
      rmDir(dir);
    }
  });
});

describe("PHPCodeSmellScanner", () => {
  it("flags missing strict_types declaration", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "loose.php", `<?php\nclass Foo {\n  public function bar() {}\n}\n`);
      const scanner = new PHPCodeSmellScanner();
      const result = await scanner.scan(dir);
      const finding = result.findings.find(f => f.id.includes("strict-types"));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe("info");
    } finally {
      rmDir(dir);
    }
  });

  it("does NOT flag strict_types when present", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "strict.php", `<?php\ndeclare(strict_types=1);\nclass Foo {}\n`);
      const scanner = new PHPCodeSmellScanner();
      const result = await scanner.scan(dir);
      const finding = result.findings.find(f => f.id.includes("strict-types"));
      expect(finding).toBeUndefined();
    } finally {
      rmDir(dir);
    }
  });
});

describe("SwiftCodeSmellScanner", () => {
  it("detects force unwraps when >5 found", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "unsafe.swift", `
import Foundation
let a = foo!.bar
let b = baz!.qux
let c = obj!.prop
let d = val!.name
let e = x!, y = z!
let f = w!.something
`);
      const scanner = new SwiftCodeSmellScanner();
      const result = await scanner.scan(dir);
      const finding = result.findings.find(f => f.id.includes("force-unwrap"));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe("warning");
    } finally {
      rmDir(dir);
    }
  });
});

describe("KotlinCodeSmellScanner", () => {
  it("detects !! operators when >3 found", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "unsafe.kt", `
fun process(a: String?, b: String?, c: String?, d: String?) {
    val x = a!!.length
    val y = b!!.trim()
    val z = c!!.uppercase()
    val w = d!!.lowercase()
}
`);
      const scanner = new KotlinCodeSmellScanner();
      const result = await scanner.scan(dir);
      const finding = result.findings.find(f => f.id.includes("force-not-null"));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe("warning");
      expect(finding!.message).toContain("!!");
    } finally {
      rmDir(dir);
    }
  });

  it("returns no findings for safe Kotlin code", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "safe.kt", `
fun process(a: String?) {
    val x = a?.length ?: 0
    println(x)
}
`);
      const scanner = new KotlinCodeSmellScanner();
      const result = await scanner.scan(dir);
      const forceNull = result.findings.filter(f => f.id.includes("force-not-null"));
      expect(forceNull.length).toBe(0);
    } finally {
      rmDir(dir);
    }
  });
});

describe("KotlinCoroutineScanner", () => {
  it("detects GlobalScope usage", async () => {
    const dir = makeTempDir();
    try {
      writeFile(dir, "leak.kt", `
import kotlinx.coroutines.*

fun startWork() {
    GlobalScope.launch {
        delay(1000)
        println("done")
    }
}
`);
      const scanner = new KotlinCoroutineScanner();
      const result = await scanner.scan(dir);
      const finding = result.findings.find(f => f.id.includes("global-scope"));
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe("warning");
    } finally {
      rmDir(dir);
    }
  });
});

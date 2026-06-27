import fg from "fast-glob";
import fs from "fs";
import path from "path";
import { Scanner, ScanResult, Finding } from "../types/index.js";
import { IGNORE_PATTERNS, SAFE_GLOB_OPTIONS } from "../utils/constants.js";
import { relativePath } from "../utils/files.js";
import { readFileSafely } from "../utils/security.js";

export class DatabaseScanner implements Scanner {
  name = "database";

  async scan(rootDir: string): Promise<ScanResult> {
    const findings: Finding[] = [];

    // Detect ORM from package.json
    const pkgPath = path.join(rootDir, "package.json");
    if (!fs.existsSync(pkgPath)) return { findings };

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    } catch {
      return { findings };
    }

    const allDeps = {
      ...((pkg.dependencies as object) || {}),
      ...((pkg.devDependencies as object) || {}),
    };

    const hasPrisma = "@prisma/client" in allDeps || "prisma" in allDeps;
    const hasTypeORM = "typeorm" in allDeps;
    const hasSequelize = "sequelize" in allDeps;
    const hasMongoose = "mongoose" in allDeps;

    if (!hasPrisma && !hasTypeORM && !hasSequelize && !hasMongoose) {
      return { findings, stats: { noOrmDetected: true } };
    }

    // Scan JS/TS source files
    const files = await fg(["**/*.{ts,tsx,js,jsx}"], {
      cwd: rootDir,
      ignore: [...IGNORE_PATTERNS, "**/migrations/**", "**/seeds/**"],
      ...SAFE_GLOB_OPTIONS,
      absolute: true,
    });

    for (const file of files) {
      const content = readFileSafely(file);
      if (!content) continue;
      const rel = relativePath(rootDir, file);

      if (hasPrisma) findings.push(...this.checkPrisma(content, rel));
      if (hasTypeORM) findings.push(...this.checkTypeORM(content, rel));
      if (hasSequelize) findings.push(...this.checkSequelize(content, rel));
      if (hasMongoose) findings.push(...this.checkMongoose(content, rel));
      findings.push(...this.checkCredentials(content, rel));
    }

    return { findings, stats: { hasPrisma, hasTypeORM, hasSequelize, hasMongoose } };
  }

  private checkPrisma(content: string, rel: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split("\n");

    // 1. N+1 pattern — findMany/findFirst inside a loop
    const loopKeywords = /\b(for|forEach|map|while|reduce|filter)\b/;
    // eslint-disable-next-line security/detect-unsafe-regex
    const prismaQueryMethod = /\.(findMany|findFirst)\s*\(/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!prismaQueryMethod.test(line)) continue;

      // Check indentation — 8+ spaces suggests nesting
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      if (indent < 8) continue;

      // Look for a loop keyword within the 5 lines above
      const lookbackStart = Math.max(0, i - 5);
      const context = lines.slice(lookbackStart, i).join("\n");
      if (loopKeywords.test(context)) {
        findings.push({
          id: `db-n-plus-one-${rel}-${i}`,
          severity: "warning",
          category: "db-n-plus-one",
          message: `Potential N+1 query in ${rel} — consider using include/select to batch relations`,
          file: rel,
        });
        break; // One finding per file for N+1
      }
    }

    // 2. Missing select (over-fetching) — findMany/findFirst without select/include
    let overFetchCount = 0;
    for (let i = 0; i < lines.length && overFetchCount < 3; i++) {
      const line = lines[i];
      if (!/\.(findMany|findFirst)\s*\(\s*\{/.test(line)) continue;

      // Check next 5 lines for select: or include:
      const lookAhead = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
      if (!/\b(select|include)\s*:/.test(lookAhead)) {
        overFetchCount++;
        findings.push({
          id: `db-over-fetch-${rel}-${i}`,
          severity: "info",
          category: "db-over-fetch",
          message: `${rel}: Prisma query without select/include — fetching all fields may over-fetch`,
          file: rel,
        });
      }
    }

    // 3. Raw SQL in Prisma — $queryRaw with string argument (not tagged template)
    // eslint-disable-next-line security/detect-unsafe-regex
    if (/\$queryRaw\s*\((?!`)|\$executeRaw\s*\((?!`)/.test(content)) {
      findings.push({
        id: `db-sql-injection-${rel}`,
        severity: "warning",
        category: "db-sql-injection",
        message: `${rel}: Prisma.$queryRaw with string argument — use tagged template literal to prevent SQL injection`,
        file: rel,
      });
    }

    // 4. Missing transaction for multiple writes
    const writeOps = (content.match(/prisma\.\w+\.(create|update|delete)\s*\(/g) || []).length;
    if (writeOps >= 3 && !content.includes("$transaction")) {
      findings.push({
        id: `db-missing-transaction-${rel}`,
        severity: "info",
        category: "db-missing-transaction",
        message: `${rel}: Multiple Prisma write operations without $transaction — data may be inconsistent on failure`,
        file: rel,
      });
    }

    return findings;
  }

  private checkTypeORM(content: string, rel: string): Finding[] {
    const findings: Finding[] = [];

    // 1. getRepository outside a service/constructor
    if (/getRepository\s*\(/.test(content) && !/@Injectable/.test(content)) {
      findings.push({
        id: `db-typeorm-pattern-${rel}`,
        severity: "info",
        category: "db-typeorm-pattern",
        message: `${rel}: getRepository() called outside service — prefer injected repositories`,
        file: rel,
      });
    }

    // 2. Raw queries with string concatenation
    // eslint-disable-next-line security/detect-unsafe-regex
    if (/\.query\s*\(\s*[`'"][^`'"]*\$\{/.test(content) || /\.query\s*\([^)]*\+/.test(content)) {
      findings.push({
        id: `db-sql-injection-typeorm-${rel}`,
        severity: "warning",
        category: "db-sql-injection",
        message: `${rel}: Potential SQL injection in TypeORM raw query`,
        file: rel,
      });
    }

    // 3. Missing @Index — entities with @Column but no @Index
    const columnCount = (content.match(/@Column\s*\(/g) || []).length;
    if (columnCount >= 3 && !/@Index\s*\(/.test(content) && /@Entity/.test(content)) {
      findings.push({
        id: `db-missing-index-${rel}`,
        severity: "info",
        category: "db-missing-index",
        message: `${rel}: No @Index decorators — consider adding indexes for frequently queried columns`,
        file: rel,
      });
    }

    return findings;
  }

  private checkSequelize(content: string, rel: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split("\n");

    // 1. findAll without limit
    let findAllCount = 0;
    for (let i = 0; i < lines.length && findAllCount < 3; i++) {
      if (!/\.findAll\s*\(\s*\{/.test(lines[i])) continue;

      const lookAhead = lines.slice(i, Math.min(lines.length, i + 11)).join("\n");
      if (!/\blimit\s*:/.test(lookAhead)) {
        findAllCount++;
        findings.push({
          id: `db-over-fetch-seq-${rel}-${i}`,
          severity: "warning",
          category: "db-over-fetch",
          message: `${rel}: Sequelize findAll without limit — could fetch entire table`,
          file: rel,
        });
      }
    }

    // 2. Raw queries with string concatenation
    // eslint-disable-next-line security/detect-unsafe-regex
    if (/sequelize\.query\s*\([^)]*\$\{/.test(content) || /sequelize\.query\s*\([^)]*\+/.test(content)) {
      findings.push({
        id: `db-sql-injection-seq-${rel}`,
        severity: "warning",
        category: "db-sql-injection",
        message: `${rel}: Potential SQL injection in Sequelize raw query`,
        file: rel,
      });
    }

    // 3. sync({ force: true })
    // eslint-disable-next-line security/detect-unsafe-regex
    if (/sync\s*\(\s*\{[^}]*force\s*:\s*true/.test(content)) {
      findings.push({
        id: `db-destructive-${rel}`,
        severity: "critical",
        category: "db-destructive",
        message: `${rel}: sequelize.sync({ force: true }) — DELETES ALL DATA on startup`,
        file: rel,
      });
    }

    return findings;
  }

  private checkMongoose(content: string, rel: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split("\n");

    // 1. Missing lean() — .find( without .lean() within 3 lines
    let missingLeanCount = 0;
    for (let i = 0; i < lines.length && missingLeanCount < 3; i++) {
      if (!/\.find\s*\(/.test(lines[i])) continue;
      // Skip lines that are clearly part of a condition, not a query
      if (/if\s*\(/.test(lines[i])) continue;

      const lookAhead = lines.slice(i, Math.min(lines.length, i + 4)).join("\n");
      if (!/.lean\s*\(/.test(lookAhead)) {
        missingLeanCount++;
        findings.push({
          id: `db-over-fetch-mongoose-${rel}-${i}`,
          severity: "info",
          category: "db-over-fetch",
          message: `${rel}: Mongoose .find() without .lean() — returns full Mongoose documents, consider .lean() for read-only queries`,
          file: rel,
        });
      }
    }

    // 2. $where operator
    if (/\$where\s*:/.test(content)) {
      findings.push({
        id: `db-mongo-pattern-${rel}`,
        severity: "warning",
        category: "db-mongo-pattern",
        message: `${rel}: MongoDB $where operator — consider using $expr instead`,
        file: rel,
      });
    }

    // 3. Schema without validation
    const stringTypeCount = (content.match(/type\s*:\s*String/g) || []).length;
    if (
      stringTypeCount > 3 &&
      !/validate\s*:/.test(content) &&
      !/required\s*:/.test(content) &&
      /new Schema\s*\(|Schema\s*\(/.test(content)
    ) {
      findings.push({
        id: `db-schema-quality-${rel}`,
        severity: "info",
        category: "db-schema-quality",
        message: `${rel}: Mongoose schema may be missing field validation`,
        file: rel,
      });
    }

    return findings;
  }

  private checkCredentials(content: string, rel: string): Finding[] {
    const findings: Finding[] = [];

    // Match hardcoded credentials in connection strings — but not env vars
    // eslint-disable-next-line security/detect-unsafe-regex
    const credentialPattern = /(mongodb|postgresql|postgres|mysql|redis):\/\/[^$'"\s]{1,30}:[^$'"\s@]{1,100}@/;

    if (credentialPattern.test(content)) {
      // Skip if the line contains process.env
      const lines = content.split("\n");
      const hasHardcoded = lines.some((line) => {
        if (!credentialPattern.test(line)) return false;
        return !line.includes("process.env") && !line.includes("${") && !line.includes("env(");
      });

      if (hasHardcoded) {
        findings.push({
          id: `db-hardcoded-creds-${rel}`,
          severity: "critical",
          category: "security",
          message: `${rel}: Hardcoded database credentials in connection string`,
          file: rel,
        });
      }
    }

    return findings;
  }
}

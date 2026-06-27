import { describe, it, expect, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { DatabaseScanner } from "../../src/scanners/database.js";

let tempDir: string | null = null;

function makeTempDir(): string {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "db-scanner-test-"));
  return tempDir;
}

function cleanup() {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
}

afterEach(() => {
  cleanup();
});

describe("DatabaseScanner", () => {
  const scanner = new DatabaseScanner();

  it("returns empty findings when no package.json exists", async () => {
    const dir = makeTempDir();
    const result = await scanner.scan(dir);
    expect(result.findings).toEqual([]);
    expect(result.stats).toBeUndefined();
  });

  it("returns noOrmDetected stat when no ORM in dependencies", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { express: "^4.0.0" } })
    );
    const result = await scanner.scan(dir);
    expect(result.findings).toEqual([]);
    const stats = result.stats as { noOrmDetected?: boolean };
    expect(stats?.noOrmDetected).toBe(true);
  });

  it("detects sequelize.sync({ force: true }) as critical", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { sequelize: "^6.0.0" } })
    );
    fs.writeFileSync(
      path.join(dir, "app.ts"),
      `
import { Sequelize } from 'sequelize';
const sequelize = new Sequelize('sqlite::memory:');
sequelize.sync({ force: true });
`
    );
    const result = await scanner.scan(dir);
    const critical = result.findings.filter(
      (f) => f.category === "db-destructive" && f.severity === "critical"
    );
    expect(critical.length).toBeGreaterThan(0);
    expect(critical[0].message).toContain("DELETES ALL DATA");
  });

  it("detects Prisma findMany without select as info", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "@prisma/client": "^5.0.0" } })
    );
    fs.writeFileSync(
      path.join(dir, "users.ts"),
      `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function getUsers() {
  const users = await prisma.user.findMany({
    where: { active: true },
  });
  return users;
}
`
    );
    const result = await scanner.scan(dir);
    const overFetch = result.findings.filter(
      (f) => f.category === "db-over-fetch" && f.severity === "info"
    );
    expect(overFetch.length).toBeGreaterThan(0);
    expect(overFetch[0].message).toContain("select/include");
  });

  it("does not flag Prisma findMany that has select", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "@prisma/client": "^5.0.0" } })
    );
    fs.writeFileSync(
      path.join(dir, "users.ts"),
      `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function getUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true },
    where: { active: true },
  });
  return users;
}
`
    );
    const result = await scanner.scan(dir);
    const overFetch = result.findings.filter((f) => f.category === "db-over-fetch");
    expect(overFetch.length).toBe(0);
  });

  it("detects hardcoded database credentials as critical", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "@prisma/client": "^5.0.0" } })
    );
    fs.writeFileSync(
      path.join(dir, "db.ts"),
      `
const connectionString = 'postgresql://admin:supersecret@localhost:5432/mydb';
`
    );
    const result = await scanner.scan(dir);
    const credFindings = result.findings.filter(
      (f) => f.category === "security" && f.severity === "critical"
    );
    expect(credFindings.length).toBeGreaterThan(0);
    expect(credFindings[0].message).toContain("Hardcoded database credentials");
  });

  it("does not flag env-var based connection strings as hardcoded credentials", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "@prisma/client": "^5.0.0" } })
    );
    fs.writeFileSync(
      path.join(dir, "db.ts"),
      `
const connectionString = process.env.DATABASE_URL;
`
    );
    const result = await scanner.scan(dir);
    const credFindings = result.findings.filter(
      (f) => f.category === "security" && f.severity === "critical"
    );
    expect(credFindings.length).toBe(0);
  });

  it("returns empty findings for clean Prisma code", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "@prisma/client": "^5.0.0" } })
    );
    fs.writeFileSync(
      path.join(dir, "clean.ts"),
      `
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function getUser(id: string) {
  return prisma.user.findFirst({
    select: { id: true, name: true, email: true },
    where: { id },
  });
}
`
    );
    const result = await scanner.scan(dir);
    expect(result.findings).toEqual([]);
  });

  it("detects Sequelize findAll without limit as warning", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { sequelize: "^6.0.0" } })
    );
    fs.writeFileSync(
      path.join(dir, "repo.ts"),
      `
async function getAllUsers() {
  return User.findAll({
    where: { active: true },
  });
}
`
    );
    const result = await scanner.scan(dir);
    const overFetch = result.findings.filter(
      (f) => f.category === "db-over-fetch" && f.severity === "warning"
    );
    expect(overFetch.length).toBeGreaterThan(0);
  });

  it("does not flag Sequelize findAll that has limit", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { sequelize: "^6.0.0" } })
    );
    fs.writeFileSync(
      path.join(dir, "repo.ts"),
      `
async function getPagedUsers() {
  return User.findAll({
    where: { active: true },
    limit: 20,
    offset: 0,
  });
}
`
    );
    const result = await scanner.scan(dir);
    const overFetch = result.findings.filter((f) => f.category === "db-over-fetch");
    expect(overFetch.length).toBe(0);
  });

  it("detects Mongoose missing lean() as info", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { mongoose: "^7.0.0" } })
    );
    fs.writeFileSync(
      path.join(dir, "model.ts"),
      `
async function getUsers() {
  return User.find({ active: true });
}
`
    );
    const result = await scanner.scan(dir);
    const leanFindings = result.findings.filter(
      (f) => f.category === "db-over-fetch" && f.severity === "info"
    );
    expect(leanFindings.length).toBeGreaterThan(0);
    expect(leanFindings[0].message).toContain("lean()");
  });

  it("detects TypeORM missing @Index on entity as info", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { typeorm: "^0.3.0" } })
    );
    fs.writeFileSync(
      path.join(dir, "user.entity.ts"),
      `
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  status: string;
}
`
    );
    const result = await scanner.scan(dir);
    const indexFindings = result.findings.filter((f) => f.category === "db-missing-index");
    expect(indexFindings.length).toBeGreaterThan(0);
  });

  it("detects Prisma $queryRaw with string argument as warning", async () => {
    const dir = makeTempDir();
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { "@prisma/client": "^5.0.0" } })
    );
    fs.writeFileSync(
      path.join(dir, "raw.ts"),
      `
const userId = req.params.id;
const result = await prisma.$queryRaw('SELECT * FROM users WHERE id = ' + userId);
`
    );
    const result = await scanner.scan(dir);
    const sqlInjection = result.findings.filter(
      (f) => f.category === "db-sql-injection" && f.severity === "warning"
    );
    expect(sqlInjection.length).toBeGreaterThan(0);
  });
});

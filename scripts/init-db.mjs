import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { delimiter, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const databaseUrl = process.env.DATABASE_URL ?? readEnvValue("DATABASE_URL") ?? "postgres://postgres:long123@localhost:5432/genealogy";

function readEnvValue(key) {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return null;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    if (trimmed.slice(0, index).trim() === key) {
      return trimmed.slice(index + 1).trim();
    }
  }
  return null;
}

function findPsql() {
  const pathDirs = (process.env.PATH ?? "").split(delimiter);
  const installedRoots = [
    "C:\\Program Files\\PostgreSQL",
    "D:\\PostgreSQL"
  ];
  const installedCandidates = installedRoots.flatMap((rootDir) => {
    if (!existsSync(rootDir)) return [];
    return ["18", "17", "16", "15", "14"].map((version) => join(rootDir, version, "bin", "psql.exe"));
  });
  const candidates = [
    ...pathDirs.map((dir) => join(dir, process.platform === "win32" ? "psql.exe" : "psql")),
    ...installedCandidates,
    "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe"
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function run(command, args, label) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function capture(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: false,
    env: process.env
  });
}

const psql = findPsql();
if (!psql) {
  console.error("psql was not found. Install PostgreSQL command line tools or add PostgreSQL bin to PATH.");
  process.exit(1);
}

const appUrl = new URL(databaseUrl);
const dbName = appUrl.pathname.replace(/^\//, "") || "genealogy";
const adminUrl = new URL(databaseUrl);
adminUrl.pathname = "/postgres";

console.log("\n> Check database");
const checkResult = capture(psql, [adminUrl.toString(), "-tAc", `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`]);
if (checkResult.status !== 0) {
  process.stderr.write(checkResult.stderr ?? "");
  process.exit(checkResult.status ?? 1);
}

if (checkResult.stdout.trim() !== "1") {
  run(psql, [adminUrl.toString(), "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE ${dbName}`], "Create database");
} else {
  console.log(`Database ${dbName} already exists.`);
}

run(psql, [appUrl.toString(), "-v", "ON_ERROR_STOP=1", "-f", join(root, "database", "migrations", "001_init.sql")], "Apply schema");

if (!existsSync(join(root, "database", "seed", "members.csv"))) {
  run(nodePath(), [join(root, "scripts", "generate-seed-data.mjs")], "Generate seed CSV");
}

run(psql, [appUrl.toString(), "-v", "ON_ERROR_STOP=1", "-f", join(root, "database", "load_csv.sql")], "Load seed CSV");

console.log("\nDatabase is ready.");

function nodePath() {
  return process.execPath;
}

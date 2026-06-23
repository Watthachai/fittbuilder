// One-off DB introspection: runs the SQL passed as argv[2] via psql using
// DIRECT_URL/DATABASE_URL from .env.local. Usage: node scripts/db-query.mjs "<sql>"
import { execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function envValue(key) {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const m = readFileSync(file, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const url = envValue("DIRECT_URL") || envValue("DATABASE_URL");
if (!url) {
  console.error("✖ DIRECT_URL / DATABASE_URL not found");
  process.exit(1);
}
const sql = process.argv[2];
if (!sql) {
  console.error("✖ pass SQL as the first argument");
  process.exit(1);
}
// Write to a temp file and run with -f so EVERY statement's output prints
// (psql -c only shows the last statement's result).
const tmp = join(tmpdir(), `dbq-${process.pid}.sql`);
writeFileSync(tmp, sql);
execSync(`psql "$MIGRATE_DB_URL" -f "${tmp}"`, {
  stdio: "inherit",
  env: { ...process.env, MIGRATE_DB_URL: url },
});

// Apply every supabase/migrations/*.sql (in filename order) to the database.
// Migrations are idempotent, so re-running is safe. Uses psql + DIRECT_URL (or
// DATABASE_URL) read from .env.local. Run with: npm run db:migrate
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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
  console.error("✖ DIRECT_URL / DATABASE_URL not found in .env.local");
  process.exit(1);
}

const dir = resolve("supabase/migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
if (files.length === 0) {
  console.log("no migrations found");
  process.exit(0);
}

for (const file of files) {
  console.log(`\n▶ applying ${file}`);
  execSync(`psql "$MIGRATE_DB_URL" -v ON_ERROR_STOP=1 -f "${resolve(dir, file)}"`, {
    stdio: "inherit",
    env: { ...process.env, MIGRATE_DB_URL: url },
  });
}
console.log("\n✓ all migrations applied");

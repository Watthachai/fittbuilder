// Issue, list or revoke the service credential Code Runner's deploy side (Cloud
// Build in GCP) uses (migration 0059). One credential reads EVERY project's
// delivery choice and first administrator's email, and writes deploy events and
// one-time passwords for any project. It is printed once and only its SHA-256 is
// stored — paste it into the prompt of CRN's deploy/gcp/setup.sh (it goes to
// Secret Manager as crn-deploy-fb-token), never into a document, a chat or a
// repository, and revoke it the moment it may have leaked.
//
//   node scripts/deploy-binding.mjs create "<label>"
//   node scripts/deploy-binding.mjs list
//   node scripts/deploy-binding.mjs revoke <binding-id>
//
// Targets NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the
// environment first, then .env.local / .env. It names the host it writes to.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function envValue(key) {
  if (process.env[key]) return process.env[key];
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const m = readFileSync(file, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !key) {
  console.error("✖ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
console.log(`→ ${new URL(url).host}`);

const PRODUCER = "CODE_RUNNER";
const [command, arg] = process.argv.slice(2);

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

if (command === "create" && arg) {
  const token = `fbd_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const { data, error } = await db
    .from("fittbuilder_integration_bindings")
    .insert({ org_id: null, producer: PRODUCER, token_hash: tokenHash, label: arg })
    .select("id")
    .single();
  if (error) fail(error.message);
  console.log(`✓ binding ${data.id} "${arg}" → reads every project's delivery choice and writes its deploy events`);
  console.log(`\n  ${token}\n`);
  console.log("This is the only time the credential is shown. Paste it into deploy/gcp/setup.sh's prompt.");
} else if (command === "list") {
  const { data, error } = await db
    .from("fittbuilder_integration_bindings")
    .select("id, label, created_at, last_used_at, revoked_at")
    .eq("producer", PRODUCER)
    .order("created_at");
  if (error) fail(error.message);
  for (const b of data) console.log(`${b.id}  ${b.revoked_at ? "revoked" : "live   "}  ${b.created_at}  ${b.label}`);
  if (data.length === 0) console.log("(no Code Runner credentials)");
} else if (command === "revoke" && arg) {
  const { data, error } = await db
    .from("fittbuilder_integration_bindings")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", arg)
    .eq("producer", PRODUCER)
    .is("revoked_at", null)
    .select("id");
  if (error) fail(error.message);
  console.log(data.length ? `✓ revoked ${arg}` : `nothing to revoke (${arg} not found or already revoked)`);
} else {
  console.log('usage: node scripts/deploy-binding.mjs create "<label>" | list | revoke <binding-id>');
  process.exit(1);
}

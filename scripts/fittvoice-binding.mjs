// Issue, list or revoke the service credential FITT Voice uses to deliver into a
// workspace (migration 0045). The credential is printed once and only its
// SHA-256 is stored — hand it over through the agreed secret channel, never in a
// document, a chat or a repository.
//
//   node scripts/fittvoice-binding.mjs create <workspace-id> "<label>"
//   node scripts/fittvoice-binding.mjs list   <workspace-id>
//   node scripts/fittvoice-binding.mjs revoke <binding-id>
//
// Targets NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the
// environment first, then .env.local / .env — so pointing it at the Sandbox is a
// matter of exporting the Sandbox's two values. It names the host it writes to.
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

const [command, arg, label = ""] = process.argv.slice(2);

if (command === "create" && arg) {
  const { data: org, error: orgError } = await db.from("fittbuilder_orgs").select("id, name").eq("id", arg).maybeSingle();
  if (orgError) {
    console.error(`✖ ${orgError.message}`);
    process.exit(1);
  }
  if (!org) {
    console.error(`✖ workspace ${arg} not found`);
    process.exit(1);
  }
  const token = `fvb_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const { data, error } = await db
    .from("fittbuilder_integration_bindings")
    .insert({ org_id: org.id, producer: "FITT_VOICE", token_hash: tokenHash, label })
    .select("id")
    .single();
  if (error) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ binding ${data.id} → workspace "${org.name}" (${org.id})`);
  console.log(`\n  ${token}\n`);
  console.log("This is the only time the credential is shown. Send it through the secret channel.");
} else if (command === "list" && arg) {
  const { data, error } = await db
    .from("fittbuilder_integration_bindings")
    .select("id, label, created_at, revoked_at")
    .eq("org_id", arg)
    .order("created_at");
  if (error) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
  for (const b of data) console.log(`${b.id}  ${b.revoked_at ? "revoked " + b.revoked_at : "active"}  ${b.label}`);
} else if (command === "revoke" && arg) {
  const { error } = await db.from("fittbuilder_integration_bindings").update({ revoked_at: new Date().toISOString() }).eq("id", arg);
  if (error) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ binding ${arg} revoked — deliveries with it now answer 401`);
} else {
  console.error('usage: create <workspace-id> "<label>" | list <workspace-id> | revoke <binding-id>');
  process.exit(1);
}

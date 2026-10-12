// Issue, list or revoke the service credential FITT Voice uses to deliver into a
// workspace (migration 0045), and register the client its users connect through
// (0053). The credential is printed once and only its SHA-256 is stored — hand
// it over through the agreed secret channel, never in a document, a chat or a
// repository.
//
//   node scripts/fittvoice-binding.mjs create <workspace-id> "<label>"
//   node scripts/fittvoice-binding.mjs list   <workspace-id>
//   node scripts/fittvoice-binding.mjs revoke <binding-id>
//
// Account connections (migration 0053) need the client FITT Voice connects as —
// its id, the name on the consent page, and every redirect URI it may use,
// character for character:
//
//   node scripts/fittvoice-binding.mjs client <client-id> "<name>" <redirect-uri> [<redirect-uri>…]
//   node scripts/fittvoice-binding.mjs client-disable <client-id>
//
// Running `client` again for the same id replaces its name and redirect URIs.
// Disabling stops new connections and revokes every live one.
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
} else if (command === "client" && arg && label && process.argv.length > 5) {
  const redirectUris = process.argv.slice(5);
  for (const uri of redirectUris) {
    const u = new URL(uri);
    if (u.protocol !== "https:" || u.hash) {
      console.error(`✖ ${uri}: a redirect URI must be https and carry no #fragment`);
      process.exit(1);
    }
  }
  const { error } = await db
    .from("fittbuilder_integration_clients")
    .upsert({ id: arg, producer: "FITT_VOICE", name: label, redirect_uris: redirectUris, disabled_at: null });
  if (error) {
    console.error(`✖ ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ client ${arg} "${label}"`);
  for (const uri of redirectUris) console.log(`  redirect_uri ${uri}`);
} else if (command === "client-disable" && arg) {
  const now = new Date().toISOString();
  const { error } = await db.from("fittbuilder_integration_clients").update({ disabled_at: now }).eq("id", arg);
  const { data, error: revokeError } = await db
    .from("fittbuilder_integration_bindings")
    .update({ revoked_at: now })
    .eq("client_id", arg)
    .is("revoked_at", null)
    .select("id");
  if (error || revokeError) {
    console.error(`✖ ${(error ?? revokeError).message}`);
    process.exit(1);
  }
  console.log(`✓ client ${arg} disabled, ${data.length} connection(s) revoked`);
} else {
  console.error(
    'usage: create <workspace-id> "<label>" | list <workspace-id> | revoke <binding-id>\n' +
      '       client <client-id> "<name>" <redirect-uri>… | client-disable <client-id>'
  );
  process.exit(1);
}

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  AUTHORIZE_FIELDS,
  CODE_TTL_MS,
  checkAuthorizeRequest,
  newSecret,
  redirectWith,
  sha256hex,
  type AuthorizeRequest,
} from "@/lib/fittvoice/connect";
import { getClient, roleOf, saveCode } from "@/lib/fittvoice/connection-store";

/**
 * The consent page's two answers. Each re-checks the whole request from the
 * form — the page that rendered it proves nothing by the time it is posted —
 * and the person comes from the server session, never from the form.
 */

/** The request again, or the message for the page. Redirects for an OAuth error. */
async function recheck(formData: FormData): Promise<AuthorizeRequest | string> {
  const params = new URLSearchParams();
  for (const k of AUTHORIZE_FIELDS) {
    const v = formData.get(k);
    if (typeof v === "string") params.set(k, v);
  }
  const check = checkAuthorizeRequest(params, await getClient(params.get("client_id") ?? ""));
  if (check.ok) return check.request;
  if (check.redirect !== null) redirect(check.redirect);
  return check.message;
}

export async function approveConnection(_prev: string | null, formData: FormData): Promise<string | null> {
  const request = await recheck(formData);
  if (typeof request === "string") return request;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "หมดเวลาเข้าสู่ระบบ เปิดลิงก์จาก FITT Voice ใหม่อีกครั้ง";

  const orgId = String(formData.get("org_id") ?? "");
  if (!orgId) return "เลือก workspace ที่จะให้ FITT Voice ส่งงานเข้ามาก่อน";
  if (!(await roleOf(orgId, user.id))) return "คุณไม่ได้อยู่ใน workspace นี้แล้ว เลือก workspace อื่น";

  const code = newSecret("fvcode_");
  await saveCode({
    code_hash: sha256hex(code),
    client_id: request.clientId,
    user_id: user.id,
    org_id: orgId,
    redirect_uri: request.redirectUri,
    code_challenge: request.codeChallenge,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  redirect(redirectWith(request.redirectUri, { code, state: request.state }));
}

export async function denyConnection(formData: FormData): Promise<void> {
  const request = await recheck(formData);
  if (typeof request === "string") return;
  redirect(
    redirectWith(request.redirectUri, {
      error: "access_denied",
      error_description: "the user declined to connect",
      state: request.state,
    })
  );
}

/**
 * A first workspace, made from the consent page. A new Builder account has
 * none (there is no default), and a FITT Voice user who signed up on the way
 * here would otherwise stop at "no workspace". Created as the person, through
 * RLS — they own it — exactly as the workspace page would.
 */
export async function createWorkspace(
  _prev: { error: string } | { workspace: { id: string; name: string } } | null,
  formData: FormData
): Promise<{ error: string } | { workspace: { id: string; name: string } }> {
  const name = String(formData.get("workspace_name") ?? "").trim();
  if (!name) return { error: "ตั้งชื่อ workspace ก่อน" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "หมดเวลาเข้าสู่ระบบ เปิดลิงก์จาก FITT Voice ใหม่อีกครั้ง" };
  const { data, error } = await supabase
    .from("fittbuilder_orgs")
    .insert({ name: name.slice(0, 80) })
    .select("id, name")
    .single();
  if (error || !data) return { error: "สร้าง workspace ไม่สำเร็จ ลองอีกครั้ง" };
  return { workspace: data };
}

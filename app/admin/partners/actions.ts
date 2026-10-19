"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin-server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Putting an email on the partner list and taking it off (migration 0060). The
 * list is the grant: the email's workspaces, now and later, follow it. Who is
 * asking comes from the server session — the form only names the email, and the
 * page that rendered the button proves nothing by the time it is posted.
 */
const emailSchema = z.string().trim().toLowerCase().email().max(160);

async function setPartner(formData: FormData, partner: boolean): Promise<string | null> {
  const user = await getAdminUser();
  if (!user) return "เฉพาะผู้ดูแลระบบเท่านั้น";
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return "อีเมลไม่ถูกต้อง";

  const db = createAdminClient();
  const { error } = await db.rpc("fittbuilder_set_partner_email", {
    p_email: email.data,
    p_partner: partner,
    p_by: user.email ?? "",
  });
  if (error) return `บันทึกไม่สำเร็จ: ${error.message}`;

  // Granted from a request's row: that request is now settled.
  const leadId = formData.get("lead_id");
  if (partner && typeof leadId === "string" && leadId) {
    const { error: leadError } = await db.from("fittbuilder_partner_leads").update({ status: "won" }).eq("id", leadId);
    if (leadError) return `ให้สิทธิ์แล้ว แต่เปลี่ยนสถานะคำขอไม่สำเร็จ: ${leadError.message}`;
  }

  refresh();
  return null;
}

export async function addPartnerEmail(_prev: string | null, formData: FormData): Promise<string | null> {
  return setPartner(formData, true);
}

export async function removePartnerEmail(_prev: string | null, formData: FormData): Promise<string | null> {
  return setPartner(formData, false);
}

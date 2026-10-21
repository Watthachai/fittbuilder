"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getAdminUser } from "@/lib/admin-server";
import { sendPartnerWelcomeEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Putting an email on the partner list and taking it off (migration 0060). The
 * list is the grant: the email's workspaces, now and later, follow it. Who is
 * asking comes from the server session — the form only names the email, and the
 * page that rendered the button proves nothing by the time it is posted.
 *
 * Adding one also mails the partner a sign-in link, so nobody has to send each
 * of them the link by hand. The mail is told apart from the grant in the notice:
 * a grant that stands with its mail unsent is a different outcome from either.
 */
const emailSchema = z.string().trim().toLowerCase().email().max(160);

type Notice = { tone: "ok" | "error"; text: string };
export type PartnerNotice = Notice | null;

const fail = (text: string): Notice => ({ tone: "error", text });

/** Mail the welcome and say what happened to it. Signed by the team, not by
 *  whichever admin pressed the button: the partner's contact is the company. */
async function welcome(email: string): Promise<Notice> {
  // A server action's request always carries the page's Origin (Next.js checks
  // it against the host), which is the address the partner should come back to.
  const origin = (await headers()).get("origin");
  if (!origin) throw new Error("server action without an Origin header");
  try {
    const { sent } = await sendPartnerWelcomeEmail({
      to: email,
      loginLink: `${origin}/login`,
      senderName: "ทีม FITT Builder",
    });
    return sent
      ? { tone: "ok", text: `ส่งอีเมลพร้อมลิงก์เข้าสู่ระบบไปที่ ${email} แล้ว` }
      : fail("ยังไม่ได้ส่งอีเมล: ระบบนี้ยังไม่ได้ตั้งค่าบริการส่งอีเมล (DMAIL_API_KEY)");
  } catch (e) {
    return fail(`ส่งอีเมลไม่สำเร็จ: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function setPartner(formData: FormData, partner: boolean): Promise<PartnerNotice> {
  const user = await getAdminUser();
  if (!user) return fail("เฉพาะผู้ดูแลระบบเท่านั้น");
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return fail("อีเมลไม่ถูกต้อง");

  const db = createAdminClient();
  const { error } = await db.rpc("fittbuilder_set_partner_email", {
    p_email: email.data,
    p_partner: partner,
    p_by: user.email ?? "",
  });
  if (error) return fail(`บันทึกไม่สำเร็จ: ${error.message}`);

  // Granted from a request's row: that request is now settled.
  const leadId = formData.get("lead_id");
  if (partner && typeof leadId === "string" && leadId) {
    const { error: leadError } = await db.from("fittbuilder_partner_leads").update({ status: "won" }).eq("id", leadId);
    if (leadError) return fail(`ให้สิทธิ์แล้ว แต่เปลี่ยนสถานะคำขอไม่สำเร็จ: ${leadError.message}`);
  }

  refresh();
  if (!partner) return null;
  const mail = await welcome(email.data);
  return mail.tone === "ok" ? mail : fail(`ให้สิทธิ์แล้ว แต่${mail.text}`);
}

export async function addPartnerEmail(_prev: PartnerNotice, formData: FormData): Promise<PartnerNotice> {
  return setPartner(formData, true);
}

export async function removePartnerEmail(_prev: PartnerNotice, formData: FormData): Promise<PartnerNotice> {
  return setPartner(formData, false);
}

/** Mail the welcome again — only to an email that is on the list. */
export async function resendPartnerEmail(_prev: PartnerNotice, formData: FormData): Promise<PartnerNotice> {
  const user = await getAdminUser();
  if (!user) return fail("เฉพาะผู้ดูแลระบบเท่านั้น");
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return fail("อีเมลไม่ถูกต้อง");

  const { data: list, error } = await createAdminClient().rpc("fittbuilder_partner_email_list");
  if (error) return fail(`อ่านรายชื่อ Partner ไม่สำเร็จ: ${error.message}`);
  if (!list.some((row) => row.email === email.data)) return fail("อีเมลนี้ไม่ได้อยู่ในรายชื่อ Partner");

  return welcome(email.data);
}

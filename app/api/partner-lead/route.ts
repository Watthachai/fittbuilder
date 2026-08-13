import { after } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPartnerLeadEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/origin";

/**
 * "I want to become a partner."
 *
 * Public and unauthenticated by design — the whole point is to hear from people
 * who do not have an account yet. Two consequences shape this file:
 *
 * 1. The table has RLS on and no policies (migration 0030), so the browser
 *    cannot write it directly. This route holds the service role and is the only
 *    way in, which is why the schema below is strict rather than forgiving.
 * 2. Saving the lead and telling us about it are separate steps in that order.
 *    The row is committed first and the notification runs after the response —
 *    a mail outage must never cost us an enquiry, and the enquirer should not
 *    wait on our SMTP either.
 */
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).default(""),
  note: z.string().trim().max(2_000).default(""),
});

/** Where the "you have a new partner lead" mail goes. */
const NOTIFY_TO = process.env.PARTNER_LEAD_NOTIFY_EMAIL ?? "";

export async function POST(request: Request) {
  // A form on a public page is a spam target; 5 per IP per 10 minutes is far
  // above any real applicant's rate and far below a script's.
  const limit = await rateLimit(`partner-lead:${clientIp(request)}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: "ส่งถี่เกินไป ลองใหม่อีกครั้งในอีกสักครู่" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return Response.json({ error: "กรอกข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("fittbuilder_partner_leads").insert({
    name: body.name,
    company: body.company,
    email: body.email,
    phone: body.phone,
    note: body.note,
    source: "partner-page",
  });
  if (error) {
    console.error("[partner-lead] insert failed:", error);
    return Response.json({ error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }

  const adminLink = `${requestOrigin(request)}/admin/partners`;
  if (NOTIFY_TO) {
    after(async () => {
      try {
        await sendPartnerLeadEmail({ to: NOTIFY_TO, ...body, adminLink });
      } catch (e) {
        // The lead is already saved and visible in /admin/partners; a failed
        // notification is worth a log line, not a failed request.
        console.error("[partner-lead] notification failed:", e);
      }
    });
  }

  return Response.json({ ok: true });
}

import { redirect } from "next/navigation";
import SettingsShell from "@/components/settings/SettingsShell";
import { getAdminUser } from "@/lib/admin-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Admin · คำขอเป็น Partner" };
export const dynamic = "force-dynamic";

/**
 * The partner-lead inbox.
 *
 * This page is the reason /api/partner-lead can drop its email notification
 * without losing anything: the row is always here. Read through the service
 * role because the table has RLS on and no policies — not even an admin's own
 * session can select from it.
 */
const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "ใหม่", cls: "border-shine/50 bg-shine/10 text-shine" },
  contacted: { label: "ติดต่อแล้ว", cls: "border-chalk/20 bg-chalk/5 text-chalk-dim" },
  won: { label: "เป็น Partner", cls: "border-go/50 bg-go/10 text-go" },
  lost: { label: "ไม่ไปต่อ", cls: "border-halt/40 bg-halt/10 text-halt" },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });

export default async function AdminPartnersPage() {
  const user = await getAdminUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("fittbuilder_partner_leads")
    .select("id, name, company, email, phone, note, source, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const leads = data ?? [];
  const fresh = leads.filter((l) => l.status === "new").length;

  return (
    <SettingsShell>
      <div className="stitch w-full px-8 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold">คำขอเป็น Partner</h1>
          <p className="mt-1 text-sm text-chalk-dim">
            {leads.length} รายการ · ใหม่ {fresh} รายการ — มาจากฟอร์มที่หน้า{" "}
            <a href="/partner" className="text-shine hover:underline">
              /partner
            </a>
          </p>
        </div>

        {error && (
          <p className="mb-6 rounded-lg border border-halt/40 bg-halt/10 px-4 py-3 text-sm text-halt">
            โหลดรายการไม่สำเร็จ: {error.message}
          </p>
        )}

        {leads.length === 0 && !error ? (
          <p className="rounded-xl border border-night-edge px-4 py-10 text-center text-sm text-chalk-dim">
            ยังไม่มีคำขอ
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-night-edge">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-night-edge bg-night/60 text-left text-chalk-dim">
                  <th className="px-3 py-2.5 font-display font-medium">บริษัท / ผู้ติดต่อ</th>
                  <th className="px-3 py-2.5 font-display font-medium">ติดต่อ</th>
                  <th className="px-3 py-2.5 font-display font-medium">รายละเอียด</th>
                  <th className="w-32 px-3 py-2.5 font-display font-medium">สถานะ</th>
                  <th className="w-40 px-3 py-2.5 font-display font-medium">ส่งเมื่อ</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const s = STATUS[l.status] ?? STATUS.new;
                  return (
                    <tr key={l.id} className="border-b border-night-edge/60 last:border-0">
                      <td className="px-3 py-2.5 align-top">
                        <p className="font-medium text-chalk">{l.company}</p>
                        <p className="text-chalk-dim">{l.name}</p>
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono text-[12px]">
                        <a href={`mailto:${l.email}`} className="text-shine hover:underline">
                          {l.email}
                        </a>
                        {l.phone && <p className="text-chalk-dim">{l.phone}</p>}
                      </td>
                      <td className="max-w-md px-3 py-2.5 align-top text-[13px] leading-relaxed whitespace-pre-line text-chalk-dim">
                        {l.note || "—"}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[11px] ${s.cls}`}
                        >
                          {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-top font-mono text-[12px] text-chalk-dim">
                        {when(l.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Granting partner status is a service-role write (migration 0029 pins
            the column against the Data API), so it is still a SQL statement
            rather than a button. Written down here so it is not folklore. */}
        <p className="mt-4 rounded-lg border border-night-edge px-4 py-3 font-mono text-[12px] leading-relaxed text-chalk-dim">
          ให้สิทธิ์ Partner:{" "}
          <code className="text-chalk">
            update fittbuilder_orgs set is_partner = true where id = &apos;&lt;org_id&gt;&apos;;
          </code>{" "}
          — ต้องรันด้วย service_role หรือ psql (แก้ผ่านแอปไม่ได้ตามที่ตั้งใจไว้)
        </p>
      </div>
    </SettingsShell>
  );
}

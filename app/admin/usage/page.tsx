import { redirect } from "next/navigation";
import SettingsShell from "@/components/settings/SettingsShell";
import { getAdminUser } from "@/lib/admin-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/ai-usage";
import { GEMINI_MODEL } from "@/lib/gemini";

export const metadata = { title: "Admin · รายงานการใช้ AI" };

interface Totals {
  calls: number;
  prompt_tokens: number;
  output_tokens: number;
  total_tokens: number;
}
interface ProjectRow {
  project_id: string | null;
  project_name: string | null;
  owner_email: string | null;
  calls: number;
  prompt_tokens: number;
  output_tokens: number;
  total_tokens: number;
  last_used: string | null;
}
interface KindRow {
  kind: string;
  calls: number;
  total_tokens: number;
}
interface UserRow {
  user_id: string | null;
  email: string | null;
  calls: number;
  prompt_tokens: number;
  output_tokens: number;
  total_tokens: number;
}
interface Report {
  totals: Totals;
  by_project: ProjectRow[];
  by_kind: KindRow[];
  by_user: UserRow[];
}

const KIND_LABELS: Record<string, string> = {
  generate: "สร้าง/แก้โค้ด (Build)",
  agent: "เอเจนต์เฟส (Define/Plan/…)",
  detect_skill: "ตรวจ Skill",
  design_options: "ออกแบบดีไซน์",
  detect_preset: "ตรวจ Preset",
  extract_answers: "ดึงคำตอบจากเอกสาร",
  code_suggestion: "เติมโค้ดอัตโนมัติ",
  generate_skill: "สร้าง Skill Template (AI)",
  org_dna: "ร่าง Org DNA (AI)",
};

const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-US");
const usd = (n: number) => `$${n.toFixed(4)}`;

export default async function AdminUsagePage() {
  const user = await getAdminUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fittbuilder_ai_usage_report");
  const report = (data as unknown as Report | null) ?? {
    totals: { calls: 0, prompt_tokens: 0, output_tokens: 0, total_tokens: 0 },
    by_project: [],
    by_kind: [],
    by_user: [],
  };
  const t = report.totals;
  const totalCost = estimateCostUsd(Number(t.prompt_tokens), Number(t.output_tokens));

  return (
    <SettingsShell>
      <div className="w-full px-8 py-8 stitch">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold">รายงานการใช้งาน AI</h1>
          <p className="mt-1 text-sm text-chalk-dim">
            โมเดล {GEMINI_MODEL} · ค่าใช้จ่ายเป็น “ประมาณการ” จาก pricing ที่ตั้งไว้
          </p>
        </div>

        {error && (
          <p className="mb-6 rounded-lg border border-halt/40 bg-halt/10 px-4 py-3 text-sm text-halt">
            โหลดรายงานไม่สำเร็จ: {error.message}
          </p>
        )}

        {/* Totals */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="การเรียกทั้งหมด" value={num(t.calls)} />
          <Stat label="Tokens รวม" value={num(t.total_tokens)} />
          <Stat label="Input / Output" value={`${num(t.prompt_tokens)} / ${num(t.output_tokens)}`} />
          <Stat label="ค่าใช้จ่าย (ประมาณ)" value={usd(totalCost)} accent />
        </div>

        <Section title="ต่อ Chat (โปรเจกต์)">
          <Table head={["Chat", "เจ้าของ", "เรียก", "Input", "Output", "รวม tokens", "ประมาณค่าใช้จ่าย", "ล่าสุด"]}>
            {report.by_project.length === 0 && <Empty cols={8} />}
            {report.by_project.map((r, i) => (
              <tr key={r.project_id ?? `none-${i}`} className="border-t border-night-edge">
                <Td>{r.project_name ?? <span className="text-chalk-dim">— ไม่ผูกกับ chat —</span>}</Td>
                <Td className="text-chalk-dim">{r.owner_email ?? "—"}</Td>
                <Td>{num(r.calls)}</Td>
                <Td>{num(r.prompt_tokens)}</Td>
                <Td>{num(r.output_tokens)}</Td>
                <Td className="font-semibold">{num(r.total_tokens)}</Td>
                <Td className="text-shine">{usd(estimateCostUsd(Number(r.prompt_tokens), Number(r.output_tokens)))}</Td>
                <Td className="text-chalk-dim">{r.last_used ? new Date(r.last_used).toLocaleString("th-TH") : "—"}</Td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section title="ตามชนิดการเรียก">
          <Table head={["ชนิด", "เรียก", "รวม tokens"]}>
            {report.by_kind.length === 0 && <Empty cols={3} />}
            {report.by_kind.map((r) => (
              <tr key={r.kind} className="border-t border-night-edge">
                <Td>{KIND_LABELS[r.kind] ?? r.kind}</Td>
                <Td>{num(r.calls)}</Td>
                <Td className="font-semibold">{num(r.total_tokens)}</Td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section title="ต่อผู้ใช้">
          <Table head={["ผู้ใช้", "เรียก", "Input", "Output", "รวม tokens", "ประมาณค่าใช้จ่าย"]}>
            {report.by_user.length === 0 && <Empty cols={6} />}
            {report.by_user.map((r, i) => (
              <tr key={r.user_id ?? `none-${i}`} className="border-t border-night-edge">
                <Td>{r.email ?? <span className="text-chalk-dim">— ไม่ระบุ —</span>}</Td>
                <Td>{num(r.calls)}</Td>
                <Td>{num(r.prompt_tokens)}</Td>
                <Td>{num(r.output_tokens)}</Td>
                <Td className="font-semibold">{num(r.total_tokens)}</Td>
                <Td className="text-shine">{usd(estimateCostUsd(Number(r.prompt_tokens), Number(r.output_tokens)))}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>
    </SettingsShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass rounded-xl px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-chalk-dim">{label}</p>
      <p className={`mt-1 font-display text-xl font-semibold ${accent ? "text-shine" : "text-chalk"}`}>
        {value}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 font-display text-sm font-semibold text-chalk-dim">{title}</h2>
      <div className="glass scroll-thin overflow-x-auto rounded-xl">{children}</div>
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-left text-[13px]">
      <thead>
        <tr className="text-[11px] uppercase tracking-wider text-chalk-dim">
          {head.map((h) => (
            <th key={h} className="px-3 py-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function Empty({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-6 text-center text-sm text-chalk-dim">
        ยังไม่มีข้อมูลการใช้งาน
      </td>
    </tr>
  );
}

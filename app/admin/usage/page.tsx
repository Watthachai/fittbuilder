import Link from "next/link";
import { redirect } from "next/navigation";
import SettingsShell from "@/components/settings/SettingsShell";
import { getAdminUser } from "@/lib/admin-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/ai-usage";
import { GEMINI_MODEL } from "@/lib/gemini";
import { pageOf, type Page } from "@/lib/paging";
import { GENERATE_OUTCOME_LABEL, GENERATE_OUTCOMES, type GenerateOutcome } from "@/lib/generate-outcome";

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
/** fittbuilder_turn_report: how build turns ended (migration 0052). */
interface TurnReport {
  counts: Partial<Record<GenerateOutcome, number>>;
  p50_ms: number | null;
  p90_ms: number | null;
  unfinished: {
    created_at: string;
    outcome: GenerateOutcome;
    duration_ms: number;
    error: string | null;
    project_id: string | null;
    project_name: string | null;
    email: string | null;
  }[];
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
  split_tasks: "แตกคำสั่งเป็นข้อ",
};

const OUTCOME_TONE: Record<GenerateOutcome, string> = {
  done: "bg-go",
  cut_time: "bg-amber-400",
  cut_tokens: "bg-amber-600",
  cut_error: "bg-halt/70",
  failed: "bg-halt",
};

const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-US");
const secs = (ms: number | null) => (ms === null ? "—" : `${Math.round(ms / 1000)} วิ`);
const usd = (n: number) => `$${n.toFixed(4)}`;
const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`;

export default async function AdminUsagePage(props: PageProps<"/admin/usage">) {
  const user = await getAdminUser();
  if (!user) redirect("/");
  // Each long table pages on its own (?chats= · ?users=), so moving through one
  // keeps the other where it was.
  const query = await props.searchParams;

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

  // Profiles (avatar + name) for the user ranking — joined separately since the
  // report RPC only returns emails.
  const userIds = report.by_user.map((u) => u.user_id).filter((id): id is string => Boolean(id));
  const profileById = new Map<string, { name: string | null; avatar: string | null }>();
  if (userIds.length > 0) {
    const { data: profs } = await admin
      .from("fittbuilder_profiles")
      .select("id, name, avatar_url")
      .in("id", userIds);
    for (const p of profs ?? []) profileById.set(p.id, { name: p.name, avatar: p.avatar_url });
  }

  // Daily token series (last 14 days), bucketed in UTC from raw usage rows.
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 13);
  const { data: usageRows } = await admin
    .from("fittbuilder_ai_usage")
    .select("created_at, total_tokens")
    .gte("created_at", since.toISOString());
  const byDay = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since.getTime() + i * 86_400_000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of usageRows ?? []) {
    const key = new Date(r.created_at as string).toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, byDay.get(key)! + Number(r.total_tokens ?? 0));
  }
  const daily = [...byDay.entries()].map(([key, tokens]) => ({ key, tokens, label: key.slice(5) }));

  // How build turns ended over the same 14 days — recorded from 0.103.0 on.
  const { data: turnData } = await admin.rpc("fittbuilder_turn_report", { since: since.toISOString() });
  const turns = (turnData as unknown as TurnReport | null) ?? { counts: {}, p50_ms: null, p90_ms: null, unfinished: [] };
  const turnTotal = GENERATE_OUTCOMES.reduce((sum, o) => sum + Number(turns.counts[o] ?? 0), 0);
  const maxDaily = Math.max(1, ...daily.map((d) => d.tokens));

  const chats = pageOf(report.by_project, query.chats);
  const people = pageOf(report.by_user, query.users);

  const topUsers = [...report.by_user]
    .sort((a, b) => Number(b.total_tokens) - Number(a.total_tokens))
    .slice(0, 8);
  const maxUser = Math.max(1, ...topUsers.map((u) => Number(u.total_tokens)));
  const maxKind = Math.max(1, ...report.by_kind.map((k) => Number(k.total_tokens)));

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
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="การเรียกทั้งหมด" value={num(t.calls)} />
          <Stat label="Tokens รวม" value={num(t.total_tokens)} />
          <Stat label="Input / Output" value={`${num(t.prompt_tokens)} / ${num(t.output_tokens)}`} />
          <Stat label="ค่าใช้จ่าย (ประมาณ)" value={usd(totalCost)} accent />
        </div>

        {/* Charts row */}
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Tokens รายวัน (14 วันล่าสุด)" className="lg:col-span-2">
            <div className="flex h-44 items-stretch gap-1.5">
              {daily.map((d) => (
                <div
                  key={d.key}
                  className="group flex h-full flex-1 flex-col justify-end"
                  title={`${d.key}: ${num(d.tokens)} tokens`}
                >
                  <div
                    className="w-full rounded-t bg-shine/60 transition-colors group-hover:bg-shine"
                    style={{ height: `${Math.max(2, (d.tokens / maxDaily) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              {daily.map((d, i) => (
                <span key={d.key} className="flex-1 text-center font-mono text-[9px] text-chalk-dim">
                  {i % 2 === 0 ? d.label : ""}
                </span>
              ))}
            </div>
          </Card>

          <Card title="ตามชนิดการเรียก">
            <div className="space-y-2.5">
              {report.by_kind.length === 0 && (
                <p className="text-sm text-chalk-dim">ยังไม่มีข้อมูล</p>
              )}
              {report.by_kind.map((k) => (
                <div key={k.kind}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="truncate text-chalk/85">{KIND_LABELS[k.kind] ?? k.kind}</span>
                    <span className="shrink-0 font-mono text-chalk-dim">{compact(Number(k.total_tokens))}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-chalk/10">
                    <div
                      className="h-full rounded-full bg-shine/70"
                      style={{ width: `${(Number(k.total_tokens) / maxKind) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="รอบสร้าง/แก้โค้ด 14 วันล่าสุด — จบเองหรือถูกตัด" className="mb-8">
          {turnTotal === 0 ? (
            <p className="text-sm text-chalk-dim">ยังไม่มีข้อมูล เริ่มบันทึกผลของแต่ละรอบตั้งแต่เวอร์ชัน 0.103.0</p>
          ) : (
            <>
              <p className="mb-3 text-[12px] text-chalk-dim">
                {num(turnTotal)} รอบ · ครึ่งหนึ่งจบภายใน {secs(turns.p50_ms)} · 90% จบภายใน {secs(turns.p90_ms)}
              </p>
              <div className="space-y-2.5">
                {GENERATE_OUTCOMES.map((o) => {
                  const n = Number(turns.counts[o] ?? 0);
                  return (
                    <div key={o}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-chalk/85">{GENERATE_OUTCOME_LABEL[o]}</span>
                        <span className="font-mono text-chalk-dim">
                          {num(n)} · {((n / turnTotal) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-chalk/10">
                        <div className={`h-full rounded-full ${OUTCOME_TONE[o]}`} style={{ width: `${(n / turnTotal) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {turns.unfinished.length > 0 && (
                <div className="scroll-thin mt-5 overflow-x-auto">
                  <p className="mb-1 text-[12px] font-semibold text-chalk-dim">รอบที่ไม่จบเอง ล่าสุด {turns.unfinished.length} รอบ</p>
                  <Table head={["เวลา", "Chat", "ผู้ใช้", "ผล", "ใช้เวลา", "error"]}>
                    {turns.unfinished.map((r) => (
                      <tr key={`${r.created_at}-${r.project_id}`} className="border-t border-night-edge">
                        <Td className="whitespace-nowrap text-chalk-dim">{new Date(r.created_at).toLocaleString("th-TH")}</Td>
                        <Td>
                          {r.project_id ? (
                            <Link href={`/project/${r.project_id}`} className="hover:text-shine">
                              {r.project_name ?? r.project_id.slice(0, 8)}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td className="text-chalk-dim">{r.email ?? "—"}</Td>
                        <Td>{GENERATE_OUTCOME_LABEL[r.outcome]}</Td>
                        <Td className="font-mono">{secs(r.duration_ms)}</Td>
                        <Td className="max-w-xs truncate text-chalk-dim" title={r.error ?? undefined}>
                          {r.error ?? "—"}
                        </Td>
                      </tr>
                    ))}
                  </Table>
                </div>
              )}
            </>
          )}
        </Card>

        {/* User ranking */}
        <Card title="อันดับผู้ใช้ (ตาม tokens)" className="mb-8">
          <div className="space-y-3">
            {topUsers.length === 0 && <p className="text-sm text-chalk-dim">ยังไม่มีข้อมูล</p>}
            {topUsers.map((u, i) => {
              const prof = u.user_id ? profileById.get(u.user_id) : undefined;
              const name = prof?.name ?? u.email ?? "ไม่ระบุ";
              const total = Number(u.total_tokens);
              const cost = estimateCostUsd(Number(u.prompt_tokens), Number(u.output_tokens));
              return (
                <div key={u.user_id ?? `none-${i}`} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-center font-mono text-xs text-chalk-dim">
                    {i + 1}
                  </span>
                  {prof?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={prof.avatar}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-chalk/10 text-xs font-semibold text-chalk/80">
                      {name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm text-chalk">{name}</span>
                      <span className="shrink-0 font-mono text-[11px] text-chalk-dim">
                        {num(total)} · <span className="text-shine">{usd(cost)}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-chalk/10">
                      <div
                        className="h-full rounded-full bg-shine"
                        style={{ width: `${(total / maxUser) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Section title="ต่อ Chat (โปรเจกต์)">
          <Table head={["Chat", "เจ้าของ", "เรียก", "Input", "Output", "รวม tokens", "ประมาณค่าใช้จ่าย", "ล่าสุด"]}>
            {chats.total === 0 && <Empty cols={8} />}
            {chats.items.map((r, i) => (
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
          <Pager page={chats} href={(n) => `?chats=${n}&users=${people.page}`} />
        </Section>

        <Section title="ต่อผู้ใช้">
          <Table head={["ผู้ใช้", "เรียก", "Input", "Output", "รวม tokens", "ประมาณค่าใช้จ่าย"]}>
            {people.total === 0 && <Empty cols={6} />}
            {people.items.map((r, i) => (
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
          <Pager page={people} href={(n) => `?chats=${chats.page}&users=${n}`} />
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

function Card({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`glass rounded-xl p-4 ${className}`}>
      <h2 className="mb-3 font-display text-sm font-semibold text-chalk-dim">{title}</h2>
      {children}
    </section>
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

/** Where a long table is, and the way to the rest of it. Hidden while one page holds everything. */
function Pager<T>({ page, href }: { page: Page<T>; href: (n: number) => string }) {
  if (page.pages <= 1) return null;
  // First, last, and two either side of the current page — enough to jump without a wall of numbers.
  const shown = Array.from({ length: page.pages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === page.pages || Math.abs(n - page.page) <= 2
  );
  const link = "grid h-7 min-w-7 place-items-center rounded-md px-2 font-mono text-[12px] transition";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-night-edge px-3 py-2.5">
      <span className="text-[12px] text-chalk-dim">
        แสดง {page.from}–{page.to} จาก {page.total} · หน้า {page.page}/{page.pages}
      </span>
      <nav className="flex items-center gap-1" aria-label="เปลี่ยนหน้า">
        {page.page > 1 && (
          <Link href={href(page.page - 1)} scroll={false} className={`${link} text-chalk-dim hover:bg-chalk/5 hover:text-chalk`}>
            ก่อนหน้า
          </Link>
        )}
        {shown.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - shown[i - 1] > 1 && <span className="px-1 text-chalk-dim">…</span>}
            <Link
              href={href(n)}
              scroll={false}
              aria-current={n === page.page ? "page" : undefined}
              className={`${link} ${n === page.page ? "bg-shine font-semibold text-night" : "text-chalk-dim hover:bg-chalk/5 hover:text-chalk"}`}
            >
              {n}
            </Link>
          </span>
        ))}
        {page.page < page.pages && (
          <Link href={href(page.page + 1)} scroll={false} className={`${link} text-chalk-dim hover:bg-chalk/5 hover:text-chalk`}>
            ถัดไป
          </Link>
        )}
      </nav>
    </div>
  );
}

function Td({ children, className = "", title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <td className={`px-3 py-2 ${className}`} title={title}>
      {children}
    </td>
  );
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

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  Loader2,
  Minus,
  Paperclip,
  Radar,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";
import { listOrgs } from "@/lib/orgs";
import { listOrgMembers } from "@/lib/org-members";
import { openCreateWorkspace } from "@/lib/workspace-modal";
import { WorkspaceIcon } from "@/lib/workspace-style";
import {
  deleteAdvisorReport,
  listAdvisorReports,
  reportScore,
  type AdvisorReport,
  type AdvisorReportKind,
} from "@/lib/advisor-reports";
import { ATTACHMENT_ACCEPT, fileToAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { useFileDrop } from "@/lib/useFileDrop";
import DropOverlay from "@/components/ui/DropOverlay";
import { confirm } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import PainPointResult from "@/components/org/PainPointResult";
import HealthCheckResult from "@/components/consult/HealthCheckResult";
import SourceViewer from "@/components/org/SourceViewer";
import type { AdvisorResult } from "@/lib/org-advisor";
import type { HealthResult } from "@/lib/advisor-health";
import type { ChatAttachmentInput, OrgRecord } from "@/lib/types";

const KIND_META: Record<
  AdvisorReportKind,
  { label: string; icon: typeof Radar; desc: string }
> = {
  pain_point: {
    label: "Pain Point Radar",
    icon: Radar,
    desc: "เสียงลูกค้า/พนักงาน รีวิว คำบ่น → จัดกลุ่มประเด็น ขุดต้นตอ พร้อมที่มาทุกข้อ",
  },
  health_check: {
    label: "ตรวจสุขภาพธุรกิจ",
    icon: Stethoscope,
    desc: "งบ ตัวเลขขาย หนี้ ลูกหนี้ → คะแนน 5 ด้าน: เงินสด · กำไร · ยอดขาย · หนี้ · คน",
  },
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * FITT Consult — the standalone advisory module (/consult). One "desk" where
 * the team drops real business data, two analysis lenses (Pain Point Radar ·
 * Business Health Check), and the workspace's shared report history so runs
 * can be compared over time. Engine lives in lib/org-advisor + lib/advisor-*.
 */
export default function ConsultShell() {
  const search = useSearchParams();
  const [orgs, setOrgs] = useState<OrgRecord[] | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgOpen, setOrgOpen] = useState(false);
  const [reports, setReports] = useState<AdvisorReport[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [files, setFiles] = useState<ChatAttachmentInput[]>([]);
  const [busy, setBusy] = useState<AdvisorReportKind | null>(null);
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  const [viewer, setViewer] = useState<{ sources: string; highlight?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Workspaces once; preselect ?org= when valid, else the first workspace.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await listOrgs();
        if (cancelled) return;
        setOrgs(list);
        const wanted = search.get("org");
        setOrgId(wanted && list.some((o) => o.id === wanted) ? wanted : (list[0]?.id ?? null));
      } catch {
        if (!cancelled) setOrgs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // The ?org= param only matters on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-workspace: report history + member names (for "โดยใคร").
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [list, members] = await Promise.all([
          listAdvisorReports(orgId),
          listOrgMembers(orgId).catch(() => []),
        ]);
        if (cancelled) return;
        setReports(list);
        setSelectedId(list[0]?.id ?? null);
        setApproved({});
        setNames(new Map(members.map((m) => [m.userId, m.name?.trim() || m.email])));
      } catch (e) {
        if (!cancelled) {
          setReports([]);
          toast.error("โหลดประวัติไม่สำเร็จ", {
            description: e instanceof Error ? e.message : undefined,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const org = orgs?.find((o) => o.id === orgId) ?? null;
  const selected = reports.find((r) => r.id === selectedId) ?? reports[0] ?? null;
  const hasInput = paste.trim().length > 0 || files.length > 0;

  /** Score delta vs the previous report of the SAME kind (reports are newest-first). */
  const deltaOf = useMemo(() => {
    return (report: AdvisorReport): number | null => {
      const cur = reportScore(report);
      if (cur === null) return null;
      const idx = reports.findIndex((r) => r.id === report.id);
      const prev = reports.slice(idx + 1).find((r) => r.kind === report.kind);
      const prevScore = prev ? reportScore(prev) : null;
      return prevScore === null ? null : cur - prevScore;
    };
  }, [reports]);

  const onPickFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    for (const f of Array.from(list)) {
      if (files.length >= 5) break;
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.warning(`ไฟล์ใหญ่เกิน 4MB: ${f.name}`);
        continue;
      }
      try {
        const att = await fileToAttachment(f);
        setFiles((prev) => (prev.length >= 5 ? prev : [...prev, att]));
      } catch (e) {
        toast.warning(e instanceof Error ? e.message : `แนบ "${f.name}" ไม่สำเร็จ`);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const { dragging, dropHandlers } = useFileDrop((list) => void onPickFiles(list));

  const run = async (kind: AdvisorReportKind) => {
    if (!orgId || busy || !hasInput) return;
    setBusy(kind);
    try {
      const res = await fetch(kind === "pain_point" ? "/api/org-advisor" : "/api/advisor-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          [kind === "pain_point" ? "feedback" : "data"]: paste.trim() || undefined,
          attachments: files.length ? files : undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "วิเคราะห์ไม่สำเร็จ");
      // Re-read the history so this run appears with its real row id.
      const list = await listAdvisorReports(orgId);
      setReports(list);
      setSelectedId(list[0]?.id ?? null);
      setApproved({});
      toast.success("วิเคราะห์เสร็จแล้ว", { description: "บันทึกเข้าประวัติของทีมให้แล้ว" });
    } catch (e) {
      toast.error("วิเคราะห์ไม่สำเร็จ", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const removeReport = async (report: AdvisorReport) => {
    const ok = await confirm({
      title: "ลบรายงานนี้?",
      message: "ลบออกจากประวัติของทีมถาวร",
      confirmLabel: "ลบ",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAdvisorReport(report.id);
      setReports((prev) => prev.filter((r) => r.id !== report.id));
      if (selectedId === report.id) setSelectedId(null);
    } catch (e) {
      toast.error("ลบไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    }
  };

  const createWorkspace = async () => {
    const o = await openCreateWorkspace();
    if (o) {
      setOrgs((prev) => [...(prev ?? []), o]);
      setOrgId(o.id);
    }
  };

  return (
    <main className="min-h-screen bg-night">
      {/* Slim product bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-night-edge bg-night/90 px-4 backdrop-blur sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-chalk-dim transition hover:text-chalk"
        >
          <ArrowLeft size={14} /> FITT Builder
        </Link>
        <span className="text-night-edge">|</span>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-7 w-7 rounded-lg" />
          <span className="font-display text-[15px] font-bold tracking-tight text-chalk">
            FITT <span className="text-shine">Consult</span>
          </span>
          <span className="rounded-full bg-shine/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-shine">
            alpha
          </span>
        </div>

        {org && (
          <div className="relative ml-auto">
            <button
              onClick={() => setOrgOpen((v) => !v)}
              className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-night-edge bg-night-panel px-3 py-1.5 text-[13px] text-chalk/85 transition hover:border-shine/50"
            >
              <WorkspaceIcon icon={org.icon} size={13} style={{ color: org.color }} />
              <span className="truncate">{org.name}</span>
              <ChevronDown
                size={13}
                className={`transition-transform ${orgOpen ? "rotate-180" : ""}`}
              />
            </button>
            {orgOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOrgOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-night-edge bg-night-panel p-1.5 shadow-2xl">
                  {(orgs ?? []).map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        setOrgId(o.id);
                        setOrgOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition hover:bg-chalk/5 ${
                        o.id === orgId ? "text-chalk" : "text-chalk/70"
                      }`}
                    >
                      <WorkspaceIcon icon={o.icon} size={13} style={{ color: o.color }} />
                      <span className="min-w-0 flex-1 truncate">{o.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </header>

      {orgs === null ? (
        <p className="flex items-center gap-2 px-6 py-12 text-sm text-chalk-dim">
          <Loader2 size={14} className="animate-spin" /> กำลังโหลด…
        </p>
      ) : orgs.length === 0 ? (
        <div className="mx-auto mt-20 max-w-md rounded-2xl border border-night-edge bg-night-panel px-8 py-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-shine">
            FITT Consult
          </p>
          <h1 className="mt-2 font-display text-lg font-semibold text-chalk">
            ที่ปรึกษาทำงานกับ workspace
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-chalk-dim">
            สร้าง workspace ขององค์กรก่อน แล้ว Consult จะวิเคราะห์เสียงลูกค้าและสุขภาพธุรกิจ
            จากข้อมูลจริงของทีมคุณ — ทุกรายงานเก็บเป็นประวัติให้ทั้งทีม
          </p>
          <button
            onClick={() => void createWorkspace()}
            className="mt-6 rounded-lg bg-shine px-5 py-2.5 font-display text-sm font-semibold text-night transition hover:brightness-110"
          >
            สร้าง workspace
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
          {/* Page identity */}
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-shine">
              ที่ปรึกษาธุรกิจ · จากข้อมูลจริง ไม่ใช่ความรู้สึก
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold leading-snug text-chalk sm:text-[28px]">
              วางข้อมูลของ {org?.name ?? "องค์กร"} แล้วให้ AI อ่านให้ขาด
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-chalk-dim">
              ทุกข้อสรุปอ้างอิงกลับไปยังข้อความต้นฉบับได้ · ทุกรายงานเก็บเป็นประวัติของทีม
              เทียบรอบก่อนได้ว่าดีขึ้นหรือแย่ลง · AI เสนอ — คุณเป็นคนตัดสินใจ
            </p>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            {/* Left: the desk */}
            <div className="min-w-0">
              {/* Input desk */}
              <div
                {...dropHandlers}
                className="relative rounded-2xl border border-night-edge bg-night-panel transition focus-within:border-shine/60"
              >
                {dragging && <DropOverlay />}
                <textarea
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  rows={6}
                  placeholder={
                    "วางข้อมูลจริงที่นี่ — รีวิว/คำบ่นลูกค้า · ฟีดแบ็กพนักงาน · สรุปยอดขาย-ค่าใช้จ่าย · รายการหนี้/ลูกหนี้\nหรือลากไฟล์มาวางได้เลย (Excel / PDF / รูป / ข้อความ สูงสุด 5 ไฟล์)"
                  }
                  className="scroll-thin block w-full resize-y bg-transparent px-5 pb-2 pt-5 text-[14px] leading-relaxed text-chalk outline-none placeholder:text-chalk-dim/45"
                />
                <div className="flex flex-wrap items-center gap-2 px-4 pb-3.5">
                  <input
                    ref={fileRef}
                    type="file"
                    hidden
                    multiple
                    accept={ATTACHMENT_ACCEPT}
                    onChange={(e) => void onPickFiles(e.target.files)}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={busy !== null}
                    title="แนบไฟล์ (Excel/PDF/รูป/เอกสาร)"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-night-edge text-chalk-dim transition hover:border-shine/50 hover:text-shine disabled:opacity-40"
                  >
                    <Paperclip size={14} />
                  </button>
                  {files.map((a, i) => (
                    <span
                      key={`${a.name}-${i}`}
                      className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-night-edge bg-night py-1 pl-2.5 pr-1 text-[12px] text-chalk/75"
                    >
                      <Paperclip size={11} className="shrink-0 text-shine" />
                      <span className="truncate">{a.name}</span>
                      <button
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={`ลบ ${a.name}`}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full transition hover:bg-chalk/10 hover:text-chalk"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  {files.length === 0 && (
                    <span className="text-[11.5px] text-chalk-dim/70">
                      ยิ่งข้อมูลจริงมาก ผลยิ่งแม่น — Excel จะถูกแปลงเป็นตารางให้ AI อ่านอัตโนมัติ
                    </span>
                  )}
                </div>
              </div>

              {/* Lens cards */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(Object.keys(KIND_META) as AdvisorReportKind[]).map((kind) => {
                  const meta = KIND_META[kind];
                  const running = busy === kind;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={kind}
                      onClick={() => void run(kind)}
                      disabled={busy !== null || !hasInput}
                      className="group rounded-2xl border border-night-edge bg-night-panel p-4 text-left transition hover:-translate-y-0.5 hover:border-shine/50 disabled:pointer-events-none disabled:opacity-45"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-shine/10 text-shine">
                          {running ? <Loader2 size={17} className="animate-spin" /> : <Icon size={17} />}
                        </span>
                        <span className="font-display text-[14.5px] font-semibold text-chalk">
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-chalk-dim">{meta.desc}</p>
                      <p className="mt-2.5 font-mono text-[10.5px] uppercase tracking-wider text-shine opacity-0 transition group-hover:opacity-100">
                        {running ? "กำลังวิเคราะห์…" : "วิเคราะห์ →"}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Analyzing state */}
              {busy && (
                <div className="mt-5 animate-pulse rounded-2xl border border-shine/25 bg-shine/[0.04] px-5 py-6 text-center">
                  <p className="font-display text-[14px] text-chalk">
                    {KIND_META[busy].label} กำลังอ่านข้อมูลของคุณ…
                  </p>
                  <p className="mt-1 text-[12px] text-chalk-dim">
                    จัดกลุ่ม ตรวจตัวเลข และหาที่มาอ้างอิง — ใช้เวลาราว 1-2 นาที
                  </p>
                </div>
              )}

              {/* Selected report */}
              {!busy && selected && (
                <div className="mt-5 rounded-2xl border border-night-edge bg-night-panel p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 font-display text-[15px] font-semibold text-chalk">
                      {(() => {
                        const Icon = KIND_META[selected.kind].icon;
                        return <Icon size={15} className="text-shine" />;
                      })()}
                      {KIND_META[selected.kind].label}
                    </span>
                    <span className="font-mono text-[11px] text-chalk-dim">
                      {dateLabel(selected.createdAt)}
                      {selected.createdBy && names.get(selected.createdBy)
                        ? ` · โดย ${names.get(selected.createdBy)}`
                        : ""}
                    </span>
                  </div>
                  {selected.kind === "pain_point" ? (
                    <PainPointResult
                      result={selected.result as AdvisorResult}
                      approved={approved}
                      onToggleApprove={(i) => setApproved((p) => ({ ...p, [i]: !p[i] }))}
                      onCite={(cite) =>
                        setViewer({
                          sources: (selected.result as AdvisorResult).sourceText,
                          highlight: cite,
                        })
                      }
                    />
                  ) : (
                    <HealthCheckResult
                      result={selected.result as HealthResult}
                      onCite={(cite) =>
                        setViewer({
                          sources: (selected.result as HealthResult).sourceText,
                          highlight: cite,
                        })
                      }
                    />
                  )}
                </div>
              )}
              {!busy && !selected && (
                <div className="mt-5 rounded-2xl border border-dashed border-night-edge px-6 py-10 text-center text-[13px] leading-relaxed text-chalk-dim">
                  ยังไม่มีรายงานใน workspace นี้
                  <br />
                  วางข้อมูลด้านบนแล้วเลือกเลนส์ — รายงานแรกของทีมจะมาอยู่ตรงนี้
                </div>
              )}
            </div>

            {/* Right: team history */}
            <aside className="min-w-0">
              <p className="px-1 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
                ประวัติของทีม ({reports.length})
              </p>
              <div className="mt-2 space-y-1.5">
                {reports.map((r) => {
                  const score = reportScore(r);
                  const delta = deltaOf(r);
                  const Icon = KIND_META[r.kind].icon;
                  return (
                    <div
                      key={r.id}
                      className={`group flex items-center gap-1 rounded-xl border pr-1 transition ${
                        selected?.id === r.id
                          ? "border-shine/50 bg-shine/5"
                          : "border-night-edge bg-night-panel hover:border-shine/30"
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedId(r.id);
                          setApproved({});
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 text-left"
                      >
                        <Icon size={14} className="shrink-0 text-shine/80" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-chalk">
                            {KIND_META[r.kind].label}
                          </span>
                          <span className="block font-mono text-[10px] text-chalk-dim">
                            {dateLabel(r.createdAt)}
                          </span>
                        </span>
                        {score !== null && (
                          <span className="shrink-0 font-mono text-[11px] font-semibold text-chalk/80">
                            {score}
                          </span>
                        )}
                        {delta !== null && delta !== 0 && (
                          <span
                            title={`เทียบรอบก่อน ${delta > 0 ? "+" : ""}${delta}`}
                            className={`shrink-0 ${delta > 0 ? "text-go" : "text-halt"}`}
                          >
                            {delta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          </span>
                        )}
                        {delta === 0 && <Minus size={11} className="shrink-0 text-chalk-dim/50" />}
                      </button>
                      <button
                        onClick={() => void removeReport(r)}
                        title="ลบรายงาน"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-chalk-dim opacity-0 transition hover:bg-halt/10 hover:text-halt group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
                {reports.length === 0 && (
                  <p className="px-1 py-2 text-[12px] text-chalk-dim">
                    ยังไม่มีประวัติ — รายงานทุกฉบับของทีมจะเรียงอยู่ตรงนี้
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}

      {viewer && viewer.sources && (
        <SourceViewer
          sources={viewer.sources}
          highlight={viewer.highlight}
          onClose={() => setViewer(null)}
        />
      )}
    </main>
  );
}

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
import { confirm } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import PainPointResult from "@/components/org/PainPointResult";
import HealthCheckResult from "@/components/advisor/HealthCheckResult";
import SourceViewer from "@/components/org/SourceViewer";
import type { AdvisorResult } from "@/lib/org-advisor";
import type { HealthResult } from "@/lib/advisor-health";
import type { ChatAttachmentInput, OrgRecord } from "@/lib/types";

const KIND_META: Record<AdvisorReportKind, { label: string; icon: typeof Radar }> = {
  pain_point: { label: "Pain Point", icon: Radar },
  health_check: { label: "สุขภาพธุรกิจ", icon: Stethoscope },
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
 * FITT Advisor — the standalone module surface (/advisor). One input hub
 * (paste + files) feeding two analysis lenses (Pain Point Radar · Business
 * Health Check), with the workspace's shared report history alongside so the
 * team can track whether things improve run over run.
 */
export default function AdvisorShell() {
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
        setOrgId(
          wanted && list.some((o) => o.id === wanted) ? wanted : (list[0]?.id ?? null)
        );
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

  const run = async (kind: AdvisorReportKind) => {
    if (!orgId || busy || (!paste.trim() && files.length === 0)) return;
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
      {/* Header */}
      <header className="flex h-14 items-center gap-3 border-b border-night-edge bg-night-panel px-4 sm:px-6">
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
            FITT <span className="text-shine">Advisor</span>
          </span>
        </div>

        {org && (
          <div className="relative ml-auto">
            <button
              onClick={() => setOrgOpen((v) => !v)}
              className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-night-edge bg-night px-3 py-1.5 text-[13px] text-chalk/85 transition hover:border-shine/50"
            >
              <WorkspaceIcon icon={org.icon} size={13} style={{ color: org.color }} />
              <span className="truncate">{org.name}</span>
              <ChevronDown size={13} className={`transition-transform ${orgOpen ? "rotate-180" : ""}`} />
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
        <p className="flex items-center gap-2 px-6 py-10 text-sm text-chalk-dim">
          <Loader2 size={14} className="animate-spin" /> กำลังโหลด…
        </p>
      ) : orgs.length === 0 ? (
        <div className="mx-auto mt-16 max-w-md rounded-2xl border border-night-edge bg-night-panel px-8 py-9 text-center">
          <h1 className="font-display text-lg font-semibold text-chalk">
            FITT Advisor ทำงานกับ workspace
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-chalk-dim">
            สร้าง workspace ขององค์กรก่อน แล้ว Advisor จะวิเคราะห์เสียงลูกค้าและสุขภาพธุรกิจ
            จากข้อมูลจริงของทีมคุณ — ผลทุกครั้งเก็บเป็นประวัติให้ทั้งทีมเห็น
          </p>
          <button
            onClick={() => void createWorkspace()}
            className="mt-5 rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:brightness-110"
          >
            สร้าง workspace
          </button>
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          {/* Left: input hub + selected report */}
          <div className="min-w-0">
            <div className="rounded-xl border border-night-edge bg-night-panel p-4">
              <h2 className="font-display text-[15px] font-semibold text-chalk">
                วางข้อมูลจริงขององค์กร แล้วให้ AI วิเคราะห์
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-chalk-dim">
                เสียงลูกค้า/พนักงาน รีวิว ตัวเลขยอดขาย งบกำไรขาดทุน รายการหนี้ — วางข้อความหรือแนบไฟล์
                (รองรับ Excel/PDF/รูป สูงสุด 5 ไฟล์) ยิ่งข้อมูลจริงมาก ผลยิ่งแม่น
              </p>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={5}
                placeholder={"เช่น วางรีวิวลูกค้าเดือนนี้ / ตัวเลขสรุปยอดขาย-ค่าใช้จ่าย / รายการลูกหนี้ค้างจ่าย…"}
                className="scroll-thin mt-3 block w-full resize-y rounded-lg border border-night-edge bg-night px-3 py-2.5 text-[13px] leading-relaxed text-chalk outline-none placeholder:text-chalk-dim/50 focus:border-shine"
              />
              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
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
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
                  className="grid h-9 w-9 place-items-center rounded-full border border-night-edge text-chalk-dim transition hover:border-shine/50 hover:text-shine disabled:opacity-40"
                >
                  <Paperclip size={15} />
                </button>
                <button
                  onClick={() => void run("pain_point")}
                  disabled={busy !== null || (!paste.trim() && files.length === 0)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-shine/50 px-3.5 py-2 font-display text-[13px] font-semibold text-shine transition hover:bg-shine/10 disabled:opacity-40"
                >
                  {busy === "pain_point" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Radar size={13} />
                  )}
                  หา Pain Point
                </button>
                <button
                  onClick={() => void run("health_check")}
                  disabled={busy !== null || (!paste.trim() && files.length === 0)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-shine px-3.5 py-2 font-display text-[13px] font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
                >
                  {busy === "health_check" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Stethoscope size={13} />
                  )}
                  ตรวจสุขภาพธุรกิจ 5 ด้าน
                </button>
                {busy && (
                  <span className="text-[12px] text-chalk-dim">
                    กำลังวิเคราะห์… (อาจใช้เวลาถึง 1-2 นาที)
                  </span>
                )}
              </div>
            </div>

            {/* Selected report */}
            {selected ? (
              <div className="mt-5 rounded-xl border border-night-edge bg-night-panel p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 font-display text-[14px] font-semibold text-chalk">
                    {(() => {
                      const Icon = KIND_META[selected.kind].icon;
                      return <Icon size={14} className="text-shine" />;
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
                      setViewer({ sources: (selected.result as AdvisorResult).sourceText, highlight: cite })
                    }
                  />
                ) : (
                  <HealthCheckResult
                    result={selected.result as HealthResult}
                    onCite={(cite) =>
                      setViewer({ sources: (selected.result as HealthResult).sourceText, highlight: cite })
                    }
                  />
                )}
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-night-edge px-6 py-8 text-center text-[13px] leading-relaxed text-chalk-dim">
                ยังไม่มีรายงานใน workspace นี้ — วางข้อมูลด้านบนแล้วเลือกเลนส์วิเคราะห์
                ผลทุกครั้งจะเก็บเป็นประวัติให้ทั้งทีมกลับมาดูและเทียบรอบได้
              </div>
            )}
          </div>

          {/* Right: report history */}
          <aside className="min-w-0">
            <h3 className="px-1 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
              ประวัติของทีม ({reports.length})
            </h3>
            <div className="mt-2 space-y-1.5">
              {reports.map((r) => {
                const score = reportScore(r);
                const delta = deltaOf(r);
                const Icon = KIND_META[r.kind].icon;
                return (
                  <div
                    key={r.id}
                    className={`group flex items-center gap-1 rounded-lg border pr-1 transition ${
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
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left"
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
                <p className="px-1 py-2 text-[12px] text-chalk-dim">ยังไม่มีประวัติ</p>
              )}
            </div>
          </aside>
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

"use client";

import { useEffect, useState } from "react";
import { Dna, ExternalLink, Plus, Quote, Sparkles, Unlink, X } from "lucide-react";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";
import SourceViewer from "@/components/org/SourceViewer";
import { dnaCompleteness, listOrgs } from "@/lib/orgs";
import { archetypeMeta, DNA_BLOCKS } from "@/lib/org-dna";
import { openCreateWorkspace } from "@/lib/workspace-modal";
import { WorkspaceIcon } from "@/lib/workspace-style";
import type { OrgRecord } from "@/lib/types";

/**
 * In-studio view of the project's workspace Org DNA — what the AI references when
 * it designs the spec/demo, plus where each piece came from (NotebookLM-style
 * citations into the raw source). Owners can attach/switch the workspace right
 * here, so a "ส่วนตัว" demo can start using Org DNA without leaving the studio.
 */
export default function OrgDnaPanel({
  org,
  canAttach,
  onAttach,
  onClose,
}: {
  /** Current workspace (with its DNA), or null when the project is ส่วนตัว. */
  org: OrgRecord | null;
  /** Owner-only: may attach/switch/detach the workspace. */
  canAttach: boolean;
  onAttach: (orgId: string | null) => void;
  onClose: () => void;
}) {
  const [viewer, setViewer] = useState<{ highlight?: string } | null>(null);
  const [picking, setPicking] = useState(!org); // open the picker straight away when unlinked
  const [orgs, setOrgs] = useState<OrgRecord[] | null>(null);

  useEffect(() => {
    if (!picking || !canAttach) return;
    let cancelled = false;
    void listOrgs()
      .then((l) => {
        if (!cancelled) setOrgs(l);
      })
      .catch(() => {
        if (!cancelled) setOrgs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [picking, canAttach]);

  const dna = org?.dna ?? null;
  const pct = dna ? Math.round(dnaCompleteness(dna) * 100) : 0;
  const arch = archetypeMeta(dna?.archetype);
  const hasAny = Boolean(
    dna &&
      (dna.decisionRights?.trim() ||
        dna.information?.trim() ||
        dna.motivators?.trim() ||
        dna.structure?.trim() ||
        dna.archetype ||
        dna.notes?.trim())
  );

  const select = (orgId: string) => {
    onAttach(orgId);
    setPicking(false);
  };
  const create = async () => {
    const o = await openCreateWorkspace();
    if (o) select(o.id);
  };

  return (
    <Overlay open onClose={onClose} placement="center" blur>
      <GlassSurface
        strong
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-night-edge px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Dna size={16} className="shrink-0 text-shine" />
            <h2 className="font-display text-[15px] font-semibold text-chalk">
              Org DNA ของ workspace
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-sm border border-night-edge p-1.5 text-chalk-dim transition hover:text-chalk"
          >
            <X size={14} />
          </button>
        </div>

        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
          {picking ? (
            /* ── Attach / switch a workspace ───────────────────────────── */
            <div className="flex flex-col gap-3">
              <p className="text-[13px] leading-relaxed text-chalk-dim">
                {org
                  ? "เลือก workspace อื่นให้เดโมนี้ — AI จะอ้างอิง Org DNA ของ workspace ที่เลือก"
                  : "เดโมนี้ยังไม่ได้ผูกกับ workspace ไหน — ผูกเพื่อให้ AI ออกแบบ spec/demo ตาม Org DNA ขององค์กรคุณ"}
              </p>
              {!canAttach ? (
                <p className="rounded-lg border border-night-edge bg-night px-3 py-2.5 text-[13px] text-chalk-dim">
                  เฉพาะเจ้าของโปรเจกต์เท่านั้นที่ผูก workspace ได้
                </p>
              ) : orgs === null ? (
                <p className="text-[13px] text-chalk-dim">กำลังโหลด workspace…</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {orgs.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => select(o.id)}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition hover:border-shine/60 ${
                        o.id === org?.id ? "border-shine bg-shine/10" : "border-night-edge bg-night"
                      }`}
                    >
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
                        style={{ background: `${o.color}22`, color: o.color }}
                      >
                        <WorkspaceIcon icon={o.icon} size={15} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-chalk">{o.name}</span>
                      <span className="shrink-0 font-mono text-[10px] text-chalk-dim">
                        {Math.round(dnaCompleteness(o.dna) * 100)}% DNA
                      </span>
                    </button>
                  ))}
                  {orgs.length === 0 && (
                    <p className="text-[13px] text-chalk-dim">ยังไม่มี workspace — สร้างอันแรกได้เลย</p>
                  )}
                  <button
                    onClick={() => void create()}
                    className="mt-1 inline-flex items-center gap-2 rounded-lg border border-night-edge px-3 py-2 text-[13px] text-chalk-dim transition hover:border-shine hover:text-chalk"
                  >
                    <Plus size={14} /> สร้าง workspace ใหม่
                  </button>
                </div>
              )}
              {org && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPicking(false)}
                    className="rounded-lg border border-night-edge px-3 py-1.5 text-[12px] text-chalk-dim transition hover:text-chalk"
                  >
                    ← กลับไปดู DNA
                  </button>
                  {canAttach && (
                    <button
                      onClick={() => {
                        onAttach(null);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-3 py-1.5 text-[12px] text-chalk-dim transition hover:border-halt hover:text-halt"
                    >
                      <Unlink size={12} /> เอาออกจาก workspace
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : org ? (
            /* ── View the workspace DNA ────────────────────────────────── */
            <>
              {/* Identity + actions */}
              <div className="flex items-center gap-3">
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{ background: `${org.color}22`, color: org.color }}
                >
                  <WorkspaceIcon icon={org.icon} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[15px] font-semibold text-chalk">{org.name}</p>
                  <p className="font-mono text-[11px] text-chalk-dim">Org DNA · {pct}% ครบ</p>
                </div>
                {canAttach && (
                  <button
                    onClick={() => setPicking(true)}
                    className="shrink-0 rounded-lg border border-night-edge px-2.5 py-1.5 text-[12px] text-chalk-dim transition hover:border-shine hover:text-chalk"
                  >
                    เปลี่ยน
                  </button>
                )}
                <a
                  href={`/org/${org.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title="แก้ไข Org DNA ในหน้า workspace (แท็บใหม่)"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1.5 text-[12px] text-chalk-dim transition hover:border-shine hover:text-chalk"
                >
                  แก้ไข <ExternalLink size={12} />
                </a>
              </div>

              {/* Completeness */}
              <div className="h-2 overflow-hidden rounded-full bg-chalk/10">
                <div className="h-full rounded-full bg-shine transition-all" style={{ width: `${pct}%` }} />
              </div>

              <p className="flex items-start gap-1.5 rounded-lg border border-night-edge bg-shine/[0.05] px-3 py-2 text-[12px] leading-relaxed text-chalk-dim">
                <Sparkles size={13} className="mt-0.5 shrink-0 text-shine" />
                AI ใช้ข้อมูลนี้เป็นบริบทตอนสัมภาษณ์และสร้าง spec/demo — เมื่อใช้ฐานรากไหน จะมีชิป “อ้างอิง Org DNA” ใต้คำตอบในแชท คลิกดูข้อความต้นฉบับได้
              </p>

              {!hasAny ? (
                <div className="rounded-lg border border-dashed border-night-edge px-4 py-6 text-center">
                  <p className="text-[13px] text-chalk-dim">
                    workspace นี้ยังไม่มีข้อมูล Org DNA
                  </p>
                  <a
                    href={`/org/${org.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-shine transition hover:underline"
                  >
                    ไปเพิ่ม Org DNA <ExternalLink size={13} />
                  </a>
                </div>
              ) : (
                <>
                  {/* Archetype */}
                  {arch && (
                    <div className="rounded-lg border border-night-edge bg-night px-3 py-2.5">
                      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
                        รูปแบบองค์กร (Archetype)
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${arch.healthy ? "bg-go" : "bg-halt"}`} />
                        <span className="font-display text-[13px] font-semibold text-chalk">{arch.th}</span>
                        <span className="font-mono text-[10px] text-chalk-dim">{arch.en}</span>
                      </div>
                      <p className="mt-0.5 text-[12px] leading-snug text-chalk-dim">{arch.desc}</p>
                    </div>
                  )}

                  {/* 4 building blocks */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {DNA_BLOCKS.map((b) => {
                      const val = dna?.[b.key]?.trim();
                      const cite = dna?.cites?.[b.key]?.trim();
                      return (
                        <div key={b.key} className="rounded-lg border border-night-edge bg-night px-3 py-2.5">
                          <p className="font-display text-[13px] font-semibold text-chalk">
                            {b.th.split(" (")[0]}
                          </p>
                          <p className="mt-1 text-[13px] leading-relaxed text-chalk/85">
                            {val || <span className="text-chalk-dim">— ยังไม่ได้ระบุ —</span>}
                          </p>
                          {cite && dna?.sources && (
                            <button
                              onClick={() => setViewer({ highlight: cite })}
                              title="คลิกดูที่มาในข้อมูลของคุณ"
                              className="mt-2 flex w-full items-start gap-1.5 rounded-md border border-night-edge bg-night-panel px-2 py-1.5 text-left text-[11px] text-chalk-dim transition hover:border-shine/50 hover:text-chalk"
                            >
                              <Quote size={11} className="mt-0.5 shrink-0 text-shine" />
                              <span className="line-clamp-2 italic">“{cite}”</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {dna?.notes?.trim() && (
                    <div className="rounded-lg border border-night-edge bg-night px-3 py-2.5">
                      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-chalk-dim">
                        หมายเหตุ
                      </p>
                      <p className="text-[13px] leading-relaxed text-chalk/85">{dna.notes.trim()}</p>
                    </div>
                  )}

                  {dna?.sources?.trim() && (
                    <button
                      onClick={() => setViewer({})}
                      className="inline-flex items-center gap-1.5 self-start text-[12px] text-chalk-dim transition hover:text-shine"
                    >
                      <Quote size={13} /> ดูแหล่งข้อมูลทั้งหมดที่ AI ใช้
                    </button>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>
      </GlassSurface>

      {viewer && org?.dna?.sources && (
        <SourceViewer
          sources={org.dna.sources}
          highlight={viewer.highlight}
          onClose={() => setViewer(null)}
        />
      )}
    </Overlay>
  );
}

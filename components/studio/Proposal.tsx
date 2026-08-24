"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Loader2, Plus, Printer, Sparkles, Trash2 } from "lucide-react";
import {
  DEFAULT_CLOSING,
  emptyPoint,
  hasJourney,
  newProposal,
  proposalSteps,
  proposalTimeline,
  stepJourney,
  type ProposalDoc,
  type ProposalPoint,
} from "@/lib/proposal";
import { loadProposal, saveProposal } from "@/lib/proposal-store";
import { loadQuote } from "@/lib/quote-store";
import { brandFromOrg, type QuoteDoc } from "@/lib/quote";
import { getOrg } from "@/lib/orgs";
import { listShots, type Shot } from "@/lib/shots";
import type { ProjectFiles } from "@/lib/types";
import { toast } from "@/lib/toast";
import { printSheet } from "@/lib/print-sheet";
import ProposalPrint from "./ProposalPrint";
import QuoteBrandBar from "./QuoteBrandBar";
import { Field, inputCls, SectionToggle } from "./QuoteFields";

/**
 * The proposal panel: the argument that goes in front of the quotation.
 *
 * The quotation is loaded READ-ONLY beside the document. It supplies what this
 * sheet is forbidden to own — the schedule, the per-screen descriptions, and
 * the number the price paragraph points at — so the panel shows those as facts,
 * not as fields. Everything editable here is argument: context, points,
 * exclusions, closing.
 */

const label = "font-display text-[11.5px] uppercase tracking-widest text-chalk-dim";

export default function Proposal({
  projectId,
  projectName,
  orgId,
  shots,
  files,
  readOnly,
}: {
  projectId: string;
  projectName: string;
  orgId: string | null;
  shots: Shot[];
  /** Present for parity with Quotation; the AI pass reads docs server-side. */
  files: ProjectFiles | null;
  readOnly: boolean;
}) {
  void files;
  const [doc, setDoc] = useState<ProposalDoc | null>(null);
  const [quote, setQuote] = useState<QuoteDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<Shot[] | null>(null);
  const [printing, setPrinting] = useState(false);
  const [writing, setWriting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    let alive = true;
    const seed = async () => {
      // The quotation is context either way; the proposal only needs seeding
      // when none is stored yet.
      const [savedQuote, savedDoc] = await Promise.all([
        loadQuote(projectId, today).catch(() => null),
        loadProposal(projectId, today).catch(() => null),
      ]);
      if (savedDoc) return { doc: savedDoc, quote: savedQuote };
      const fresh = newProposal(projectName, today);
      // Same customer, same sender, same letterhead as the quotation — typed
      // once there, carried here. The org brand fills whatever the quote lacks.
      if (savedQuote) {
        fresh.customerAttn = savedQuote.customerAttn;
        fresh.customerName = savedQuote.customerName;
        fresh.customerAddress = savedQuote.customerAddress;
        fresh.customerPhone = savedQuote.customerPhone;
        fresh.presentedBy = savedQuote.presentedBy;
        fresh.brand = savedQuote.brand;
        fresh.quoteNo = savedQuote.quoteNo;
      } else if (orgId) {
        const org = await getOrg(orgId).catch(() => null);
        if (org) fresh.brand = brandFromOrg(org.brand, org.isPartner);
      }
      return { doc: fresh, quote: savedQuote };
    };
    void seed().then((r) => {
      if (!alive) return;
      setDoc(r.doc);
      setQuote(r.quote);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // Seeded once per project, matching Quotation — re-seeding would discard edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  /** Debounced autosave — a form, not a document with a Save button. */
  const edit = useCallback(
    (patch: (d: ProposalDoc) => ProposalDoc) => {
      if (readOnly) return;
      setDoc((prev) => {
        if (!prev) return prev;
        const next = patch(prev);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          void saveProposal(projectId, next).catch((e) =>
            toast.error("บันทึกข้อเสนอไม่สำเร็จ", {
              description: e instanceof Error ? e.message : undefined,
            })
          );
        }, 600);
        return next;
      });
    },
    [projectId, readOnly]
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  const steps = useMemo(() => proposalSteps(shots, quote), [shots, quote]);
  const time = proposalTimeline(quote);

  /**
   * Ask the model to draft the argument.
   *
   * Fills only what is empty — context, points, exclusions each on their own —
   * because a sentence someone wrote outranks a generated one, the same rule
   * the quotation's describe() follows. Nothing empty left to fill is a
   * message, not a silent no-op.
   */
  const draft = async () => {
    if (!doc || readOnly) return;
    const wantContext = !doc.context.trim();
    const wantPoints = doc.points.every((p) => !p.problem.trim() && !p.feature.trim());
    const wantExcluded = doc.excluded.every((x) => !x.trim());
    if (!wantContext && !wantPoints && !wantExcluded) {
      toast.info("ทุกส่วนมีข้อความอยู่แล้ว", {
        description: "ลบข้อความในส่วนที่อยากให้เขียนใหม่ก่อน แล้วกดอีกครั้ง",
      });
      return;
    }
    setWriting(true);
    try {
      const res = await fetch("/api/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          screens: steps.map((s) => ({ name: s.name, note: s.note })),
          journey: steps.map(stepJourney).filter((j): j is string => j !== null),
        }),
      });
      const data = (await res.json()) as {
        draft?: { context: string; points: ProposalPoint[]; excluded: string[] };
        error?: string;
      };
      if (!res.ok || !data.draft) {
        toast.error("เขียนข้อเสนอไม่สำเร็จ", { description: data.error });
        return;
      }
      const d = data.draft;
      edit((prev) => ({
        ...prev,
        context: wantContext && d.context ? d.context : prev.context,
        points: wantPoints && d.points.length ? d.points : prev.points,
        excluded: wantExcluded && d.excluded.length ? d.excluded : prev.excluded,
      }));
      toast.success("ร่างข้อเสนอให้แล้ว", {
        description: "อ่านทวนทุกข้อก่อนส่ง — ลบหรือแก้ได้ทั้งหมด นี่คือเอกสารของคุณ ไม่ใช่ของ AI",
      });
    } catch (e) {
      toast.error("เขียนข้อเสนอไม่สำเร็จ", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setWriting(false);
    }
  };

  const print = async () => {
    if (printing || !doc) return;
    setPrinting(true);
    try {
      // Re-sign the shot URLs first — same 8-hour-expiry problem the quotation
      // prints around, same fix (lib/print-sheet.ts).
      const fresh = await listShots(projectId).catch(() => [] as Shot[]);
      const printable = fresh.length > 0 ? fresh : shots;
      await printSheet(
        () => setSheet(printable),
        () => setSheet(null)
      );
    } finally {
      setPrinting(false);
    }
  };

  if (loading || !doc) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-chalk-dim">
        <Loader2 size={14} className="animate-spin text-shine" /> กำลังเปิดข้อเสนอโครงการ…
      </div>
    );
  }

  const setPoint = (id: string, patch: Partial<ProposalPoint>) =>
    edit((d) => ({
      ...d,
      points: d.points.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  return (
    <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {/* What this sheet is, and what it deliberately is not. */}
        <div className="flex items-start gap-2.5 rounded-xl border border-night-edge p-3.5">
          <FileText size={14} className="mt-0.5 shrink-0 text-shine" />
          <p className="text-[12.5px] leading-relaxed text-chalk-dim">
            เอกสารเล่าเรื่อง — ปัญหาของลูกค้า สิ่งที่ระบบทำให้ และผลที่ได้ พร้อมภาพจากการเดินระบบจริง
            <span className="text-chalk"> ไม่มีตัวเลขเงินในใบนี้</span> ราคาอ้างไปที่ใบเสนอราคาแนบ
            สองใบจึงขัดกันไม่ได้
          </p>
        </div>

        <QuoteBrandBar
          brand={doc.brand}
          orgId={orgId}
          readOnly={readOnly}
          onChange={(patch) => edit((d) => ({ ...d, brand: { ...d.brand, ...patch } }))}
        />

        {/* Header */}
        <div className="rounded-xl border border-night-edge p-3.5">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="เรื่อง">
              <input
                value={doc.subject}
                onChange={(e) => edit((d) => ({ ...d, subject: e.target.value }))}
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
            <Field label="เลขที่เอกสาร">
              <input
                value={doc.proposalNo}
                onChange={(e) => edit((d) => ({ ...d, proposalNo: e.target.value }))}
                placeholder={`P-${today.replace(/-/g, "")}`}
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
            <Field label="เรียน (ตำแหน่ง/ฝ่าย)">
              <input
                value={doc.customerAttn}
                onChange={(e) => edit((d) => ({ ...d, customerAttn: e.target.value }))}
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
            <Field label="ชื่อลูกค้า / บริษัท">
              <input
                value={doc.customerName}
                onChange={(e) => edit((d) => ({ ...d, customerName: e.target.value }))}
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
            <Field label="ที่อยู่">
              <textarea
                value={doc.customerAddress}
                onChange={(e) => edit((d) => ({ ...d, customerAddress: e.target.value }))}
                rows={2}
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
            <div className="grid content-start gap-2.5">
              <Field label="โทร.">
                <input
                  value={doc.customerPhone}
                  onChange={(e) => edit((d) => ({ ...d, customerPhone: e.target.value }))}
                  className={inputCls}
                  disabled={readOnly}
                />
              </Field>
              <Field label="ผู้นำเสนอ">
                <input
                  value={doc.presentedBy}
                  onChange={(e) => edit((d) => ({ ...d, presentedBy: e.target.value }))}
                  className={inputCls}
                  disabled={readOnly}
                />
              </Field>
            </div>
          </div>
        </div>

        {/* The argument */}
        <div className="rounded-xl border border-night-edge p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-[14px] text-chalk">เนื้อหาข้อเสนอ</h3>
            {!readOnly && (
              <button
                onClick={() => void draft()}
                disabled={writing}
                title="อ่าน BRD/PRD หน้าจอจริง และเส้นทางที่เดินไว้ แล้วร่างให้ — เติมเฉพาะส่วนที่ยังว่าง"
                className="inline-flex items-center gap-1.5 rounded-lg border border-shine/50 px-2.5 py-1 font-display text-[12.5px] text-shine transition hover:bg-shine/10 disabled:opacity-40"
              >
                {writing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                ร่างด้วย AI จากระบบจริง
              </button>
            )}
          </div>

          <div className="mt-3">
            <Field label="สภาพการทำงานในปัจจุบัน (ก่อนมีระบบนี้)">
              <textarea
                value={doc.context}
                onChange={(e) => edit((d) => ({ ...d, context: e.target.value }))}
                rows={3}
                placeholder="เช่น ทุกวันนี้ทีมขายจดออเดอร์ลงกระดาษ แล้วมาคีย์ซ้ำตอนเย็น ตัวเลขสต๊อกไม่ตรงกันระหว่างหน้าร้านกับคลัง…"
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
          </div>

          {/* Points: the three-column argument. */}
          <p className={`mt-4 ${label}`}>ปัญหา → สิ่งที่ระบบทำให้ → ผลที่ได้</p>
          <div className="mt-2 flex flex-col gap-2.5">
            {doc.points.map((p, i) => (
              <div key={p.id} className="rounded-lg border border-night-edge p-2.5">
                <div className="flex items-start gap-2">
                  <span className="mt-1 shrink-0 font-mono text-[11.5px] text-chalk-dim">
                    {i + 1}.
                  </span>
                  <div className="grid flex-1 gap-2 sm:grid-cols-3">
                    <textarea
                      value={p.problem}
                      onChange={(e) => setPoint(p.id, { problem: e.target.value })}
                      rows={2}
                      placeholder="ปัญหาที่พบวันนี้"
                      className={inputCls}
                      disabled={readOnly}
                    />
                    <textarea
                      value={p.feature}
                      onChange={(e) => setPoint(p.id, { feature: e.target.value })}
                      rows={2}
                      placeholder="สิ่งที่ระบบทำให้"
                      className={inputCls}
                      disabled={readOnly}
                    />
                    <textarea
                      value={p.outcome}
                      onChange={(e) => setPoint(p.id, { outcome: e.target.value })}
                      rows={2}
                      placeholder="ผลที่ได้"
                      className={inputCls}
                      disabled={readOnly}
                    />
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() =>
                        edit((d) => ({ ...d, points: d.points.filter((x) => x.id !== p.id) }))
                      }
                      aria-label="ลบข้อนี้"
                      className="mt-1 rounded-md p-1 text-chalk-dim transition hover:text-halt"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!readOnly && (
            <button
              onClick={() =>
                edit((d) => ({ ...d, points: [...d.points, emptyPoint(d.points.length)] }))
              }
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1 font-display text-[12.5px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
            >
              <Plus size={12} /> เพิ่มข้อ
            </button>
          )}

          {/* Exclusions */}
          <p className={`mt-4 ${label}`}>สิ่งที่ไม่รวมในเฟสนี้</p>
          <div className="mt-2 flex flex-col gap-2">
            {doc.excluded.map((x, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={x}
                  onChange={(e) =>
                    edit((d) => ({
                      ...d,
                      excluded: d.excluded.map((v, j) => (j === i ? e.target.value : v)),
                    }))
                  }
                  className={inputCls}
                  disabled={readOnly}
                />
                {!readOnly && (
                  <button
                    onClick={() =>
                      edit((d) => ({ ...d, excluded: d.excluded.filter((_, j) => j !== i) }))
                    }
                    aria-label="ลบรายการนี้"
                    className="rounded-md p-1 text-chalk-dim transition hover:text-halt"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <button
                onClick={() => edit((d) => ({ ...d, excluded: [...d.excluded, ""] }))}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1 font-display text-[12.5px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
              >
                <Plus size={12} /> เพิ่มรายการ
              </button>
            )}
          </div>

          <div className="mt-4">
            <Field label="ประโยคปิดท้าย">
              <textarea
                value={doc.closing}
                onChange={(e) => edit((d) => ({ ...d, closing: e.target.value }))}
                rows={2}
                placeholder={DEFAULT_CLOSING}
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
          </div>
        </div>

        {/* The demonstrated walk — facts read off the inventory, not fields. */}
        <div className="rounded-xl border border-night-edge p-3.5">
          <SectionToggle
            title={`การใช้งานจริงพร้อมภาพ (${steps.length} หน้า)`}
            hint={
              steps.length === 0
                ? "ยังไม่มีภาพ — ไปที่แท็บแกลเลอรีแล้วกดสแกน ระบบจะเก็บภาพและเส้นทางให้"
                : hasJourney(steps)
                  ? "พิมพ์ภาพทุกหน้าพร้อมเส้นทาง “จากหน้าไหน กดปุ่มอะไร ไปหน้าไหน” ที่บันทึกจากการเดินระบบจริง"
                  : "มีภาพแต่ยังไม่มีเส้นทาง — สแกนอัตโนมัติหรืออัดการใช้งานอีกรอบ จะได้บอกได้ว่ากดปุ่มไหนแล้วเกิดอะไร"
            }
            on={doc.showSteps}
            onChange={(on) => edit((d) => ({ ...d, showSteps: on }))}
            disabled={readOnly}
          />
        </div>

        {/* Schedule and price both point at the quotation. */}
        <div className="rounded-xl border border-night-edge p-3.5">
          <h3 className="font-display text-[14px] text-chalk">ตัวเลขที่ดึงจากใบเสนอราคา</h3>
          {time.known ? (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-chalk-dim">
              พัฒนา <span className="font-mono text-chalk">{time.buildDays}</span> วันทำการ ·
              ตรวจรับภายใน <span className="font-mono text-chalk">{time.reviewDays}</span> วัน
              {time.includedMonths > 0 && (
                <>
                  {" "}
                  · ดูแลระบบ <span className="font-mono text-chalk">{time.includedMonths}</span>{" "}
                  เดือนแรกรวมในราคาโครงการ
                </>
              )}{" "}
              — แก้ตัวเลขพวกนี้ที่แท็บใบเสนอราคา ใบนี้จะตามเอง
            </p>
          ) : (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-chalk-dim">
              ยังไม่มีใบเสนอราคา — ส่วนระยะเวลาจะเว้นไว้ ไม่เดาตัวเลขให้ ไปที่แท็บใบเสนอราคาก่อน
            </p>
          )}
          <div className="mt-2.5 max-w-xs">
            <Field label="อ้างถึงใบเสนอราคาเลขที่">
              <input
                value={doc.quoteNo}
                onChange={(e) => edit((d) => ({ ...d, quoteNo: e.target.value }))}
                placeholder={quote?.quoteNo || "Q-…"}
                className={inputCls}
                disabled={readOnly}
              />
            </Field>
          </div>
        </div>

        <button
          onClick={() => void print()}
          disabled={printing}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-shine px-3 py-2 font-display text-[14px] font-semibold text-night transition hover:brightness-110 disabled:opacity-60"
        >
          {printing ? (
            <>
              <Loader2 size={13} className="animate-spin" /> กำลังเตรียมภาพ…
            </>
          ) : (
            <>
              <Printer size={13} /> พิมพ์ / บันทึกเป็น PDF
            </>
          )}
        </button>
        <p className="-mt-2 text-center text-[11.5px] leading-relaxed text-chalk-dim">
          ในหน้าต่างพิมพ์ เลือกปลายทางเป็น “Save as PDF” — ส่งคู่กับใบเสนอราคาเป็นชุดเดียว
        </p>
      </div>

      {sheet &&
        typeof document !== "undefined" &&
        createPortal(<ProposalPrint doc={doc} quote={quote} shots={sheet} />, document.body)}
    </div>
  );
}

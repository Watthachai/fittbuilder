"use client";

import { useState } from "react";
import { Boxes, Loader2, Sparkles, Trash2 } from "lucide-react";
import type { ProposalDoc, ProposalStep } from "@/lib/proposal";
import { unplacedScreens, type ModulePart, type ProposalModule } from "@/lib/proposal-modules";
import { toast } from "@/lib/toast";
import { inputCls } from "./QuoteFields";

/**
 * The project broken into the modules it is sold as (lib/proposal-modules).
 *
 * Drafted by the model from the screen manual above, then the person's: every
 * name and line is editable here. The quotation's "สร้างรายการจากโมดูล" and the
 * workspace page read the result, so it is kept on the proposal — the document
 * that owns what was built.
 */
export default function ProposalModules({
  doc,
  edit,
  steps,
  projectId,
  projectName,
  readOnly,
}: {
  doc: ProposalDoc;
  edit: (patch: (d: ProposalDoc) => ProposalDoc) => void;
  steps: ProposalStep[];
  projectId: string;
  projectName: string;
  readOnly: boolean;
}) {
  const [splitting, setSplitting] = useState(false);

  // One entry per screen name, and the modals that open from each — a modal is
  // not a part of its own, it goes where its screen goes.
  const unique = [...new Map(steps.map((st) => [st.name.trim(), st])).values()];
  const screens = unique
    .filter((st) => !st.parent)
    .map((st) => ({
      name: st.name.trim(),
      does: doc.screenDocs[st.name.trim()]?.does ?? "",
      modals: unique.filter((m) => m.parent?.trim() === st.name.trim()).map((m) => m.name.trim()),
    }));
  const left = doc.modules.length > 0 ? unplacedScreens(doc.modules, screens.map((s) => s.name)) : [];

  const split = async () => {
    if (readOnly) return;
    if (screens.length === 0) {
      toast.info("ยังไม่มีหน้าจอให้แตกเป็นโมดูล", { description: "สแกนหน้าจอในแท็บแกลเลอรีก่อน" });
      return;
    }
    setSplitting(true);
    try {
      const res = await fetch("/api/proposal-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          context: doc.context,
          features: doc.points.map((p) => p.feature.trim()).filter(Boolean),
          screens,
        }),
      });
      const data = (await res.json()) as { modules?: ProposalModule[]; error?: string };
      if (!res.ok || !data.modules) {
        toast.error("แตกเป็นโมดูลไม่สำเร็จ", { description: data.error });
        return;
      }
      const modules = data.modules;
      edit((d) => ({ ...d, modules }));
      toast.success(`แตกได้ ${modules.length} โมดูล`, {
        description: "อ่านทวนแล้วแก้ได้ทุกช่อง จากนั้นไปแท็บใบเสนอราคา กด “สร้างรายการจากโมดูล”",
      });
    } catch (e) {
      toast.error("แตกเป็นโมดูลไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSplitting(false);
    }
  };

  const setModule = (id: string, patch: Partial<ProposalModule>) =>
    edit((d) => ({ ...d, modules: d.modules.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const setPart = (moduleId: string, partId: string, patch: Partial<ModulePart>) =>
    edit((d) => ({
      ...d,
      modules: d.modules.map((m) =>
        m.id !== moduleId ? m : { ...m, parts: m.parts.map((p) => (p.id === partId ? { ...p, ...patch } : p)) }
      ),
    }));

  return (
    <div className="rounded-xl border border-night-edge p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 font-display text-[14px] text-chalk">
          <Boxes size={13} className="text-shine" /> โมดูลของระบบ
        </h3>
        {!readOnly && (
          <button
            onClick={() => void split()}
            disabled={splitting}
            title="อ่านหน้าจอทั้งหมดและคำอธิบายของแต่ละหน้า แล้วจัดเป็นโมดูล ระบบย่อย และข้อสรุป"
            className="inline-flex items-center gap-1.5 rounded-lg border border-shine/50 px-2.5 py-1 font-display text-[12.5px] text-shine transition hover:bg-shine/10 disabled:opacity-40"
          >
            {splitting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {doc.modules.length > 0 ? "แตกใหม่ด้วย AI (แทนของเดิม)" : "แตกเป็นโมดูลด้วย AI"}
          </button>
        )}
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-chalk-dim">
        แบ่งระบบเป็นโมดูลตามฝ่ายที่ใช้ แต่ละโมดูลมีระบบย่อยพร้อมข้อสรุป 3–4 ข้อ ใช้สร้างรายการในใบเสนอราคาแบบสรุปเป็นโมดูล
        {screens.length > 0 && doc.modules.length === 0 && " — กด “ร่างด้วย AI จากระบบจริง” ข้างบนก่อนจะได้ผลดีกว่า เพราะ AI อ่านคำอธิบายของแต่ละหน้าด้วย"}
      </p>

      {doc.modules.map((m, k) => (
        <div key={m.id} data-coedit-row={m.id} className="mt-3 rounded-lg border border-night-edge p-2.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-mono text-[11.5px] text-chalk-dim">{k + 1}</span>
            <input
              value={m.name}
              onChange={(e) => setModule(m.id, { name: e.target.value })}
              aria-label="ชื่อโมดูล"
              className={`${inputCls} font-display`}
              disabled={readOnly}
            />
            {!readOnly && (
              <button
                onClick={() => edit((d) => ({ ...d, modules: d.modules.filter((x) => x.id !== m.id) }))}
                aria-label="ลบโมดูลนี้"
                className="rounded-md p-1 text-chalk-dim transition hover:text-halt"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <div className="ml-5 mt-2 flex flex-col gap-2">
            {m.parts.map((p, j) => (
              <div key={p.id} data-coedit-row={p.id} className="flex items-start gap-2">
                <span className="mt-1.5 shrink-0 font-mono text-[11.5px] text-chalk-dim">
                  {k + 1}.{j + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <input
                    value={p.name}
                    onChange={(e) => setPart(m.id, p.id, { name: e.target.value })}
                    aria-label="ชื่อระบบย่อย"
                    className={inputCls}
                    disabled={readOnly}
                  />
                  <textarea
                    value={p.points.join("\n")}
                    onChange={(e) => setPart(m.id, p.id, { points: e.target.value.split("\n") })}
                    rows={Math.max(3, p.points.length)}
                    aria-label="ข้อสรุป หนึ่งข้อต่อบรรทัด"
                    placeholder="หนึ่งข้อต่อบรรทัด — เครื่องหมาย - ระบบใส่ให้เอง"
                    className={`${inputCls} resize-y text-[12.5px] leading-relaxed`}
                    disabled={readOnly}
                  />
                  {p.screens.length > 0 && (
                    <p className="text-[11.5px] leading-relaxed text-chalk-dim">หน้าจอ: {p.screens.join(" · ")}</p>
                  )}
                </div>
                {!readOnly && (
                  <button
                    onClick={() =>
                      edit((d) => ({
                        ...d,
                        modules: d.modules.map((x) =>
                          x.id !== m.id ? x : { ...x, parts: x.parts.filter((y) => y.id !== p.id) }
                        ),
                      }))
                    }
                    aria-label="ลบระบบย่อยนี้"
                    className="mt-1 rounded-md p-1 text-chalk-dim transition hover:text-halt"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {left.length > 0 && (
        <p className="mt-3 rounded-lg border border-shine/50 bg-shine/10 px-2.5 py-2 text-[12.5px] leading-relaxed text-chalk">
          หน้าจอที่ยังไม่อยู่ในโมดูลไหน ({left.length}): {left.join(" · ")} — ในใบเสนอราคาจะยังเป็นรายการแยกของตัวเอง
        </p>
      )}
    </div>
  );
}

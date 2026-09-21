"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Blocks, Check, TriangleAlert, X } from "lucide-react";
import { composeModules } from "@/lib/modules/compose";
import { MODULES } from "@/lib/modules/registry";
import type { Module } from "@/lib/modules/types";

/**
 * Pick the parts of a system instead of describing one.
 *
 * The gallery is built around the one fact about modules that nothing else in
 * the product shows: they are not independent. Payroll reads the employee record
 * that personnel records owns, and a buyer who does not see that will select
 * payroll alone and get a screen with nothing behind it.
 *
 * So the layout is the dependency, not a grid of equal cards — the owner sits at
 * the top and everything that reads from it hangs off a rail. The rail is the
 * only loud element on the page and it carries state: lit while the data has an
 * owner, amber the moment something is reading from nobody.
 */
export default function ModuleGallery({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (selected: Module[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="group flex h-full w-full items-center gap-2.5 rounded-xl border border-chalk/15 px-3.5 py-2.5 text-left transition hover:border-shine/60 hover:bg-chalk/[0.03] disabled:opacity-40"
      >
        <Blocks size={17} className="shrink-0 text-shine" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[13px] font-semibold text-chalk group-hover:text-shine">
            ประกอบจากโมดูลสำเร็จรูป
          </span>
          <span className="block text-[12px] leading-snug text-chalk/55">
            เลือกส่วนที่ต้องการ แล้วเปิดเดโมได้ทันที
          </span>
        </span>
        <ArrowRight
          size={15}
          className="shrink-0 text-chalk/30 transition group-hover:translate-x-0.5 group-hover:text-shine"
        />
      </button>

      {open && (
        <ModuleModal
          disabled={disabled}
          onClose={() => setOpen(false)}
          onCreate={(selected) => {
            setOpen(false);
            onCreate(selected);
          }}
        />
      )}
    </>
  );
}

function ModuleModal({
  disabled,
  onClose,
  onCreate,
}: {
  disabled: boolean;
  onClose: () => void;
  onCreate: (selected: Module[]) => void;
}) {
  const owners = MODULES.filter((m) => m.needs.length === 0);
  const readers = MODULES.filter((m) => m.needs.length > 0);
  const [chosen, setChosen] = useState<string[]>(MODULES.map((m) => m.id));

  const selected = useMemo(() => MODULES.filter((m) => chosen.includes(m.id)), [chosen]);
  const composed = useMemo(
    () => (selected.length > 0 ? composeModules(selected) : null),
    [selected]
  );
  const missing = composed?.missing ?? [];

  const toggle = (id: string) =>
    setChosen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  /** The module that owns an entity nobody selected — offered as a one-tap fix. */
  const providerOf = (entity: string) => MODULES.find((m) => m.provides.includes(entity));

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="โมดูลมาตรฐาน"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-chalk/15 bg-night shadow-glass"
      >
        <header className="flex items-start gap-2.5 border-b border-chalk/10 px-5 py-4">
          <Blocks size={20} className="mt-0.5 shrink-0 text-shine" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-[16px] font-semibold text-chalk">โมดูลมาตรฐาน</h2>
            <p className="text-[12.5px] leading-snug text-chalk/55">
              เลือกส่วนที่ต้องการ แล้วเปิดเดโมได้ทันที — ไม่ต้องรอ AI เขียน และราคาคิดต่อโมดูล
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="rounded-md p-1 text-chalk/50 transition hover:text-chalk"
          >
            <X size={18} />
          </button>
        </header>

        <div className="scroll-thin grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[1fr_300px]">
          <div>
            {owners.map((owner) => {
              const ownerOn = chosen.includes(owner.id);
              const kids = readers.filter((r) => r.needs.some((e) => owner.provides.includes(e)));
              const anyKidOn = kids.some((k) => chosen.includes(k.id));
              const broken = anyKidOn && !ownerOn;

              return (
                <div key={owner.id}>
                  <ModuleCard module={owner} on={ownerOn} onToggle={() => toggle(owner.id)} />

                  {/* The rail IS the dependency. Lit while the data has an owner;
                      amber the moment something reads from nobody. */}
                  <div
                    className={
                      "ml-6 border-l-2 pl-5 transition-colors " +
                      (broken ? "border-halt/70" : ownerOn ? "border-shine/50" : "border-chalk/12")
                    }
                  >
                    <p
                      className={
                        "py-2 text-[11.5px] transition-colors " +
                        (broken ? "text-halt" : "text-chalk/45")
                      }
                    >
                      {broken
                        ? `ยังไม่ได้เลือก${owner.name} — โมดูลด้านล่างจึงไม่มีข้อมูลให้อ่าน`
                        : `อ่าน ${owner.provides.join(" · ")} จาก${owner.name}`}
                    </p>

                    <div className="space-y-2">
                      {kids.map((m) => (
                        <ModuleCard
                          key={m.id}
                          module={m}
                          on={chosen.includes(m.id)}
                          warn={broken && chosen.includes(m.id)}
                          onToggle={() => toggle(m.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="lg:sticky lg:top-0">
            <div className="rounded-xl border border-chalk/12 bg-night-panel p-4">
              <h3 className="font-display text-[13.5px] font-semibold text-chalk">ขอบเขตที่เลือก</h3>

              {selected.length === 0 ? (
                <p className="mt-3 text-[12.5px] leading-relaxed text-chalk/50">
                  ยังไม่ได้เลือกโมดูล — เลือกอย่างน้อยหนึ่งอย่างเพื่อสร้างเดโม
                </p>
              ) : (
                <>
                  <ul className="mt-3 space-y-1.5">
                    {composed!.quoteLines.map((l) => (
                      <li key={l.moduleId} className="flex justify-between gap-3 text-[12.5px]">
                        <span className="min-w-0 truncate text-chalk/75">{l.name}</span>
                        <span className="shrink-0 tabular-nums text-chalk/55">{l.effortDays} วัน</span>
                      </li>
                    ))}
                  </ul>

                  <dl className="mt-3 space-y-1 border-t border-chalk/10 pt-3 text-[12.5px]">
                    <div className="flex justify-between">
                      <dt className="text-chalk/60">แรงงานรวม</dt>
                      <dd className="tabular-nums font-semibold text-chalk">
                        {composed!.totalEffortDays} วัน
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-chalk/60">ดูแลรายเดือน</dt>
                      <dd className="tabular-nums font-semibold text-chalk">
                        {composed!.totalMaPerMonth.toLocaleString("th-TH")} บาท
                      </dd>
                    </div>
                  </dl>
                </>
              )}

              {missing.length > 0 && (
                <div className="mt-3 rounded-lg border border-halt/40 bg-halt/10 p-3">
                  <p className="flex items-start gap-1.5 text-[12px] leading-snug text-halt">
                    <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                    <span>
                      {missing
                        .map((x) => MODULES.find((m) => m.id === x.moduleId)?.name)
                        .filter(Boolean)
                        .join(" และ ")}{" "}
                      ต้องอ่านข้อมูลจากโมดูลที่ยังไม่ได้เลือก
                    </span>
                  </p>
                  {(() => {
                    const fix = providerOf(missing[0].entity);
                    return fix ? (
                      <button
                        onClick={() => toggle(fix.id)}
                        className="mt-2 w-full rounded-lg border border-halt/50 py-1.5 text-[12px] text-halt transition hover:bg-halt/15"
                      >
                        เพิ่ม{fix.name}
                      </button>
                    ) : null;
                  })()}
                </div>
              )}

              <button
                onClick={() => onCreate(selected)}
                disabled={disabled || selected.length === 0 || missing.length > 0}
                className="mt-4 w-full rounded-lg bg-shine py-2.5 font-display text-[13.5px] font-semibold text-night transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
              >
                สร้างเดโม
              </button>
              <p className="mt-2 text-center text-[11.5px] text-chalk/40">
                เปิดใช้ได้ทันที ไม่ต้องรอ AI
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ModuleCard({
  module: m,
  on,
  warn,
  onToggle,
}: {
  module: Module;
  on: boolean;
  warn?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className={
        "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition " +
        (warn
          ? "border-halt/50 bg-halt/[0.06]"
          : on
            ? // `selected` is a light-mode token — the house pairs it behind `light:`
              // and keeps a shine tint for dark. Using it bare put a pale blue panel
              // under white type and made the card unreadable in the dark theme.
              "border-shine bg-shine/10 text-chalk light:border-selected-edge light:bg-selected light:text-selected-ink"
            : "border-chalk/12 text-chalk hover:border-chalk/30")
      }
    >
      <span
        className={
          "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition " +
          (on ? "border-shine bg-shine text-night" : "border-chalk/30 text-transparent")
        }
      >
        <Check size={12} strokeWidth={3} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="font-display text-[14px] font-semibold">{m.name}</span>
          {m.sapCode && (
            <span className="shrink-0 text-[11px] opacity-45">เทียบเท่า SAP {m.sapCode}</span>
          )}
        </span>
        <span className="mt-1 block text-[12.5px] leading-snug opacity-70">{m.pitch}</span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block tabular-nums text-[13px] font-semibold">
          {m.effortDays} วัน
        </span>
        <span className="mt-0.5 block tabular-nums text-[11.5px] opacity-50">
          ฿{m.maPerMonth.toLocaleString("th-TH")}/ด.
        </span>
      </span>
    </button>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Store } from "lucide-react";
import { FAMILIES, MODULES, modulesOf } from "@/lib/modules/registry";
import type { Module } from "@/lib/modules/types";
import ModuleCard from "./ModuleCard";
import ScopePanel from "./ScopePanel";
import { useScope } from "./scope";

const ALL = "ทั้งหมด";

/**
 * The catalogue as a shop rather than a form.
 *
 * The earlier version was a checklist in a modal: tick things, press build. That
 * asks someone to commit before they have seen anything. Here each module is a
 * listing with a price and a way to open the running system on that exact screen,
 * and the basket is what they have decided so far — not a wizard step.
 */
export default function Storefront() {
  const [family, setFamily] = useState<string>(ALL);
  const [q, setQ] = useState("");
  const [note, setNote] = useState<string>();
  const scope = useScope();

  const pool: Module[] = family === ALL ? MODULES : modulesOf(family as Module["family"]);
  const rows = pool.filter(
    (m) =>
      q.trim() === "" ||
      [m.name, m.sapCode ?? "", m.pitch, ...m.keyFeatures].some((t) =>
        t.toLowerCase().includes(q.trim().toLowerCase())
      )
  );

  const add = (m: Module) => {
    const pulled = scope.add(m);
    setNote(
      pulled.length > 0
        ? `เพิ่ม${m.name} แล้ว — พ่วง${pulled.map((x) => x.name).join(" และ ")}มาด้วยเพราะต้องอ่านข้อมูลจากตรงนั้น`
        : undefined
    );
  };

  /** A system is bought whole far more often than one part of it. */
  const addSystem = (familyId: Module["family"]) => {
    const parts = modulesOf(familyId);
    let pulled: Module[] = [];
    for (const m of parts) pulled = [...pulled, ...scope.add(m)];
    const extra = pulled.filter((x) => !parts.some((p) => p.id === x.id));
    const name = FAMILIES.find((f) => f.id === familyId)?.name ?? "";
    setNote(
      extra.length > 0
        ? `เพิ่มระบบ${name}ทั้งหมดแล้ว — พ่วง${[...new Set(extra.map((x) => x.name))].join(" และ ")}จากระบบอื่นมาด้วยเพราะต้องอ่านข้อมูลจากตรงนั้น`
        : `เพิ่มระบบ${name}ทั้งหมด ${parts.length} ส่วนแล้ว`
    );
  };

  return (
    <div className="min-h-screen bg-night">
      <header className="border-b border-chalk/10">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] text-chalk/50 transition hover:bg-chalk/[0.05] hover:text-chalk"
          >
            <ArrowLeft size={14} />
            FITT Builder
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Store size={17} className="shrink-0 text-shine" />
            <div className="min-w-0">
              <h1 className="font-display text-[15px] font-semibold text-chalk">มาร์เก็ตเพลสโมดูล</h1>
              <p className="truncate text-[12px] text-chalk/50">
                {FAMILIES.length} ระบบ {MODULES.length} ส่วนประกอบ เขียนเสร็จแล้ว ลองใช้ของจริงได้ก่อนเลือก
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {[ALL, ...FAMILIES.map((f) => f.name)].map((label, i) => {
              const id = i === 0 ? ALL : FAMILIES[i - 1].id;
              const on = family === id;
              return (
                <button
                  key={label}
                  onClick={() => setFamily(id)}
                  className={
                    "rounded-lg px-3 py-1.5 text-[12.5px] transition " +
                    (on
                      ? "bg-shine/15 font-medium text-shine"
                      : "text-chalk/55 hover:bg-chalk/[0.05] hover:text-chalk")
                  }
                >
                  {label}
                  <span className="ml-1.5 tabular-nums opacity-50">
                    {id === ALL ? MODULES.length : modulesOf(id as Module["family"]).length}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-chalk/30" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อโมดูล รหัส SAP หรือความสามารถ"
              className="w-72 rounded-lg border border-chalk/15 bg-night-panel py-2 pl-8 pr-3 text-[12.5px] text-chalk outline-none placeholder:text-chalk/35 focus:border-shine/60"
            />
          </div>
        </div>

        {family !== ALL && (
          <p className="mb-4 text-[12.5px] text-chalk/45">
            {FAMILIES.find((f) => f.id === family)?.blurb}
          </p>
        )}

        {note && (
          <p className="mb-4 rounded-lg border border-shine/30 bg-shine/[0.07] px-3 py-2 text-[12.5px] text-shine">
            {note}
          </p>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_290px]">
          <div className="space-y-6">
            {FAMILIES.filter((f) => rows.some((m) => m.family === f.id)).map((f) => {
              const parts = modulesOf(f.id);
              const allIn = parts.every((m) => scope.has(m.id));
              return (
                <section key={f.id}>
                  <div className="mb-2.5 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-[14px] font-semibold text-chalk">ระบบ{f.name}</h2>
                      <p className="text-[12px] text-chalk/50">
                        {parts.length} ส่วนประกอบ · {f.blurb}
                      </p>
                    </div>
                    <button
                      onClick={() => addSystem(f.id)}
                      disabled={allIn}
                      className="shrink-0 rounded-lg border border-chalk/15 px-2.5 py-1.5 text-[12px] text-chalk/70 transition hover:border-shine/60 hover:text-shine disabled:cursor-default disabled:opacity-40"
                    >
                      {allIn ? "อยู่ในขอบเขตทั้งระบบแล้ว" : "เพิ่มทั้งระบบ"}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {rows
                      .filter((m) => m.family === f.id)
                      .map((m) => (
                        <ModuleCard key={m.id} module={m} inScope={scope.has(m.id)} onAdd={() => add(m)} />
                      ))}
                  </div>
                </section>
              );
            })}
            {rows.length === 0 && (
              <p className="py-10 text-center text-[13px] text-chalk/40">ไม่มีส่วนประกอบที่ตรงกับ “{q}”</p>
            )}
          </div>

          {scope.ready && (
            <ScopePanel
              chosen={scope.chosen}
              onRemove={(m) => {
                scope.remove(m);
                setNote(undefined);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

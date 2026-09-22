"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Store } from "lucide-react";
import { FAMILIES, MODULES, modulesOf } from "@/lib/modules/registry";
import type { ModuleFamily } from "@/lib/modules/types";
import SystemCard from "./SystemCard";
import ScopePanel from "./ScopePanel";
import { useScope } from "./scope";

/**
 * The catalogue as a shop of systems.
 *
 * It was a shop of modules first — four cards for one HR system — and a buyer
 * read that as four products, tried one, and got a menu with one thing in it.
 * The unit people buy, try and log into is the system; the parts are what the
 * price is made of and what a permission is cut along, and both show inside
 * the card rather than as cards of their own.
 */
export default function Storefront() {
  const [q, setQ] = useState("");
  const [note, setNote] = useState<string>();
  const scope = useScope();

  const needle = q.trim().toLowerCase();
  const systems = FAMILIES.filter(
    (f) =>
      needle === "" ||
      ("ระบบ" + f.name).toLowerCase().includes(needle) ||
      modulesOf(f.id).some((m) =>
        [m.name, m.sapCode ?? "", ...m.keyFeatures].some((t) => t.toLowerCase().includes(needle))
      )
  );

  const add = (family: ModuleFamily) => {
    const pulled = scope.addSystem(family);
    const name = FAMILIES.find((f) => f.id === family)!.name;
    setNote(
      pulled.length > 0
        ? `เพิ่มระบบ${name}แล้ว — พ่วงระบบ${pulled
            .map((f) => FAMILIES.find((x) => x.id === f)!.name)
            .join(" และ ")}มาด้วย เพราะต้องอ่านข้อมูลจากตรงนั้น`
        : `เพิ่มระบบ${name}แล้ว`
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
              <h1 className="font-display text-[15px] font-semibold text-chalk">มาร์เก็ตเพลสระบบ</h1>
              <p className="truncate text-[12px] text-chalk/50">
                {FAMILIES.length} ระบบสำเร็จรูป {MODULES.length} ส่วนประกอบ เขียนเสร็จแล้ว ลองใช้ของจริงได้ก่อนเลือก
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] text-chalk/45">
            ซื้อและทดลองเป็นระบบ — ใครในบริษัทเห็นส่วนไหนของระบบ ตั้งเป็นสิทธิ์ทีหลังในระบบเอง
          </p>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-chalk/30" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาระบบ ส่วนประกอบ รหัส SAP หรือความสามารถ"
              className="w-80 rounded-lg border border-chalk/15 bg-night-panel py-2 pl-8 pr-3 text-[12.5px] text-chalk outline-none placeholder:text-chalk/35 focus:border-shine/60"
            />
          </div>
        </div>

        {note && (
          <p className="mb-4 rounded-lg border border-shine/30 bg-shine/[0.07] px-3 py-2 text-[12.5px] text-shine">{note}</p>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_290px]">
          <div className="space-y-4">
            {systems.map((f) => (
              <SystemCard key={f.id} family={f.id} inScope={scope.hasSystem(f.id)} onAdd={() => add(f.id)} />
            ))}
            {systems.length === 0 && (
              <p className="py-10 text-center text-[13px] text-chalk/40">ไม่มีระบบที่ตรงกับ “{q}”</p>
            )}
          </div>

          {scope.ready && (
            <ScopePanel
              chosen={scope.chosen}
              onRemoveSystem={(f) => {
                scope.removeSystem(f);
                setNote(undefined);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

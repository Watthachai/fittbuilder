"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getModule } from "@/lib/modules/registry";
import { SCREENS } from "../screens";
import { readSession } from "../session";
import type { Role } from "../session";

/**
 * The gate is here rather than in the sidebar alone: hiding a link is presentation,
 * and a buyer evaluating an ERP will type the URL to check whether it is more than
 * that. The role that opens the module is the same one the sidebar was built from.
 */
export default function ModuleView({ id, sectionIndex }: { id: string; sectionIndex?: number }) {
  const [role, setRole] = useState<Role | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setRole(readSession());
    setReady(true);
  }, []);

  const module = getModule(id);
  const Screen = SCREENS[id];
  if (!module || !Screen) return <NotFound id={id} />;
  if (!ready) return null;
  if (!role?.families.includes(module.family)) return <NoAccess name={module.name} />;

  return <Screen section={sectionIndex === undefined ? undefined : module.keyFeatures[sectionIndex]} />;
}

function Panel({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center">
      <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{body}</p>
      {children}
    </div>
  );
}

function NoAccess({ name }: { name: string }) {
  return (
    <Panel
      title="สิทธิ์ของคุณไม่ครอบคลุมโมดูลนี้"
      body={`บัญชีที่เข้าใช้งานอยู่เปิด${name}ไม่ได้ ออกจากระบบแล้วเข้าใหม่ด้วยฝ่ายที่มีสิทธิ์เพื่อดูหน้านี้`}
    >
      <Link
        href="/erp"
        className="mt-4 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
      >
        กลับไปหน้าภาพรวม
      </Link>
    </Panel>
  );
}

function NotFound({ id }: { id: string }) {
  return <Panel title="ไม่มีโมดูลนี้" body={`ไม่พบโมดูลรหัส ${id} ในระบบ`} />;
}

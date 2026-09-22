import { Suspense } from "react";
import type { Metadata } from "next";
import ErpShell from "./ErpShell";

export const metadata: Metadata = {
  title: "ระบบบริหารทรัพยากรองค์กร (ตัวอย่าง)",
  description: "ระบบตัวอย่างที่ประกอบจากโมดูลมาตรฐานของ FITT Builder",
};

export default function ErpLayout({ children }: LayoutProps<"/erp">) {
  // The shell reads ?only= to narrow itself to one module, and useSearchParams
  // opts its tree into client rendering — the prerender needs a fallback.
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 dark:bg-slate-950" />}>
      <ErpShell>{children}</ErpShell>
    </Suspense>
  );
}

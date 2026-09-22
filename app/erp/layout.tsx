import type { Metadata } from "next";
import ErpShell from "./ErpShell";

export const metadata: Metadata = {
  title: "ระบบบริหารทรัพยากรองค์กร — ตัวอย่าง",
  description: "ระบบตัวอย่างที่ประกอบจากโมดูลมาตรฐานของ FITT Builder",
};

export default function ErpLayout({ children }: LayoutProps<"/erp">) {
  return <ErpShell>{children}</ErpShell>;
}

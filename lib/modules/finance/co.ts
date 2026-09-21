import type { Module } from "../types";
import { CO_SCREEN, CO_DATA } from "./co-src";

/**
 * Management accounting. Everything here is a different cut of numbers that
 * already exist: cost centres are the ledger's expense accounts split by a
 * declared share, product cost is the material master plus an overhead rate, and
 * gross margin is a real sales order minus that cost. Nothing is retyped, which
 * is why a cost centre can show its own workings when you open it.
 */
export const CO: Module = {
  id: "co",
  name: "บัญชีบริหารและต้นทุน",
  sapCode: "CO",
  family: "finance",
  tier: "premium",
  pitch:
    "รู้ว่ากำไรมาจากช่องทางไหนและหายไปที่ศูนย์ต้นทุนไหน ทุกตัวเลขเปิดดูที่มาได้ว่ารับส่วนแบ่งมาจากบัญชีอะไรกี่เปอร์เซ็นต์ — ไม่ใช่ตัวเลขที่ฝ่ายบัญชีทำมือส่งมาเดือนละครั้ง",
  keyFeatures: [
    "ศูนย์ต้นทุน",
    "คำสั่งงานภายใน",
    "ต้นทุนผลิตภัณฑ์",
    "วิเคราะห์กำไรขั้นต้น",
    "ศูนย์กำไร",
  ],
  provides: ["costCenter"],
  needs: ["glEntry", "material", "salesOrder"],
  effortDays: 12,
  maPerMonth: 5500,
  build:
    "หน้าบัญชีบริหารและต้นทุน ห้าแท็บ — ศูนย์ต้นทุน (งบเทียบยอดใช้จริงที่กระจายมาจากบัญชีค่าใช้จ่ายในสมุดรายวันตามสัดส่วนที่ประกาศไว้ เปิดดูได้ว่าศูนย์นี้รับส่วนแบ่งมาจากบัญชีไหนกี่เปอร์เซ็นต์) · คำสั่งงานภายใน (งานชั่วคราวที่เก็บค่าใช้จ่ายแยกจากงบประจำ งบเทียบใช้ไป ใช้เกินขึ้นแดง) · ต้นทุนผลิตภัณฑ์ (แผ่นคำนวณต้นทุนทางตรงจากราคามาตรฐานในแฟ้มวัสดุ บวกค่าใช้จ่ายโรงงานและบริหารตามอัตรา และตารางเทียบทุกสินค้า) · วิเคราะห์กำไรขั้นต้น (รายได้จริงจากใบสั่งขายลบต้นทุนผลิตภัณฑ์จริง แยกตามช่องทางขายและรายใบ พร้อมชี้ใบที่อัตรากำไรต่ำที่สุด) · ศูนย์กำไร (รายได้และกำไรขั้นต้นที่แต่ละช่องทางนำมาให้ ลบค่าใช้จ่ายทางอ้อมของศูนย์ต้นทุนที่สังกัดอยู่ เทียบกับกำไรสุทธิทั้งบริษัทจากงบการเงิน)",
  files: {
    "src/modules/co/screen.tsx": CO_SCREEN,
    "src/modules/co/data.ts": CO_DATA,
  },
};

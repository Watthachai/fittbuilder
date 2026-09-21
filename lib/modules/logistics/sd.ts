import type { Module } from "../types";
import { SD_SCREEN, SD_DATA } from "./sd-src";

/**
 * Sales and distribution. It owns `customer` and `salesOrder`, and reads
 * `material` — the sellable goods are a kind of material, not a second catalogue,
 * which is also why the margin column can compare the selling price against the
 * standard cost without either side being retyped.
 */
export const SD: Module = {
  id: "sd",
  name: "ขายและกระจายสินค้า",
  sapCode: "SD",
  family: "logistics",
  tier: "base",
  pitch:
    "ราคาขาย ส่วนลด ภาษี และวงเงินเครดิต คิดจากเงื่อนไขที่ประกาศไว้ทุกใบ — พนักงานขายไม่ต้องเปิดตารางส่วนลดเอง และไม่มีใบไหนหลุดไปให้ลูกค้าที่ค้างเกินวงเงิน",
  keyFeatures: [
    "ข้อมูลหลักลูกค้า",
    "ราคาและส่วนลด",
    "ใบสั่งขาย",
    "จัดส่งสินค้า",
    "วางบิลและใบแจ้งหนี้",
    "วงเงินเครดิตลูกค้า",
  ],
  provides: ["customer", "salesOrder"],
  needs: ["material"],
  effortDays: 14,
  maPerMonth: 6000,
  build:
    "หน้าขายและกระจายสินค้า หกแท็บ — ข้อมูลหลักลูกค้า (แฟ้มลูกค้าพร้อมช่องทางขาย เงื่อนไขชำระ เลขผู้เสียภาษี กรองตามช่องทางได้) · ราคาและส่วนลด (ราคาตั้งเทียบต้นทุนมาตรฐานจากแฟ้มวัสดุพร้อมกำไรขั้นต้น ตารางส่วนลดตามช่องทาง และขั้นบันไดส่วนลดตามจำนวน) · ใบสั่งขาย (ทุกใบพร้อมยอดก่อนภาษีและรวมภาษี เปิดดูการคิดราคาทีละบรรทัดว่าลดจากอะไรบ้าง) · จัดส่งสินค้า (ใบส่งของ เส้นทาง ผู้ขนส่ง สถานะ และรายการใบสั่งขายที่ยังไม่ได้เปิดใบส่งของ) · วางบิลและใบแจ้งหนี้ (ใบแจ้งหนี้แยกก่อนภาษี–ภาษี–รวม สถานะเก็บเงิน และเตือนใบที่ส่งของแล้วแต่ยังไม่วางบิล) · วงเงินเครดิตลูกค้า (วงเงินเทียบยอดค้างจริงที่คำนวณจากใบที่ยังไม่เก็บเงิน เกินวงเงินขึ้นแดงว่าห้ามขายต่อ)",
  files: {
    "src/modules/sd/screen.tsx": SD_SCREEN,
    "src/modules/sd/data.ts": SD_DATA,
  },
};

import type { Module } from "../types";
import { filesFor } from "../sources";

/**
 * Materials management — the module every other logistics module reads from.
 *
 * It owns `material` and `vendor`. Production reads materials to explode a BOM,
 * sales reads them to price an order line, the warehouse reads them to fill a bin.
 * None of them may keep a copy, for the same reason payroll may not keep a second
 * staff list: two material masters is not a bug anyone reports.
 */
export const MM: Module = {
  id: "mm",
  name: "จัดซื้อและคลังวัสดุ",
  sapCode: "MM",
  family: "logistics",
  tier: "base",
  pitch:
    "ขอซื้อ สั่งซื้อ รับของ และวางบิล อยู่ในเส้นเดียวกัน ระบบเทียบให้เองว่าสั่งเท่าไร รับจริงเท่าไร ผู้ขายวางบิลเท่าไร และแจ้งก่อนอนุมัติจ่ายเมื่อสามยอดไม่ตรงกัน",
  keyFeatures: [
    "ข้อมูลหลักวัสดุและผู้ขาย",
    "ใบขอซื้อและใบสั่งซื้อ",
    "รับของและตรวจสอบใบแจ้งหนี้",
    "บริหารสต็อกวัสดุ",
    "ประเมินผู้ขาย",
  ],
  hasOverview: true,
  provides: ["material", "vendor", "purchaseOrder"],
  needs: [],
  effortDays: 12,
  maPerMonth: 5000,
  build:
    "หน้าจัดซื้อและคลังวัสดุ เปิดมาเจอภาพรวมที่บอกมูลค่าสต็อกแยกตามกลุ่ม ยอดสั่งซื้อรายเดือน ผู้ขายตามมูลค่าที่สั่ง วัสดุที่ต่ำกว่าจุดสั่งซื้อ และรายการที่ต้องจัดการ จากนั้นเข้าดูได้ห้าส่วน · ข้อมูลหลักวัสดุและผู้ขาย (แฟ้มวัสดุค้นหาและกรองตามกลุ่ม แฟ้มผู้ขายพร้อมเงื่อนไขชำระและเลขผู้เสียภาษี และตารางราคาที่ผู้ขายแต่ละรายเคยเสนอโดยไฮไลต์รายที่ถูกที่สุด) · ใบขอซื้อและใบสั่งซื้อ (ใบขอซื้อกดอนุมัติได้จริง ใบสั่งซื้อพร้อมมูลค่าและสถานะรับของ เปิดดูรายบรรทัดได้) · รับของและตรวจสอบใบแจ้งหนี้ (ใบรับของ และการตรวจสามทางที่เทียบยอดสั่ง–รับจริง–วางบิล แล้วบอกว่าใบไหนจ่ายได้ ใบไหนห้ามจ่ายเพราะของขาด) · บริหารสต็อกวัสดุ (มูลค่าสต็อกรวม ระดับคงเหลือเทียบจุดสั่งซื้อพร้อมแถบเตือน และรายการเคลื่อนไหวรับเข้า–จ่ายออก) · ประเมินผู้ขาย (จำนวนใบสั่งซื้อ มูลค่ารวม และอัตราส่งของครบคำนวณจากใบที่ปิดแล้ว)",
  files: filesFor("mm", ["screen.tsx", "data.ts"]),
};

import type { Module } from "../types";
import { PY_SCREEN, PY_DATA } from "./py-src";

/**
 * Payroll — the module that proves the ownership contract is real.
 *
 * It reads `employee` and never keeps its own copy. That is the whole point of
 * shipping HR first: if the composer's `provides`/`needs` rule were decorative,
 * this is where it would show, because a payroll screen with its own private list
 * of staff looks completely fine until someone is hired.
 */
export const PY: Module = {
  id: "py",
  name: "เงินเดือน",
  sapCode: "PY",
  family: "hr",
  tier: "premium",
  pitch:
    "กดเลือกงวดแล้วเห็นสลิปทุกใบพร้อมที่มาของทุกตัวเลข — ภาษี ประกันสังคม กองทุนสำรองฯ และยอดหักจากวันขาดคำนวณสดจากฐานเงินเดือน ไม่ใช่ตัวเลขที่พิมพ์ทิ้งไว้",
  keyFeatures: [
    "คำนวณเงินเดือน",
    "สวัสดิการ",
    "ขาดลามาสาย",
    "ภาษีและประกันสังคม",
    "การจ่ายเงิน",
  ],
  provides: ["payslip"],
  needs: ["employee"],
  effortDays: 11,
  maPerMonth: 5000,
  build:
    "หน้าเงินเดือน ห้าแท็บ เลือกงวดได้ — คำนวณเงินเดือน (ตารางรายได้/หัก/สุทธิรายคน เปิดสลิปเต็มใบที่แจกแจงทุกบรรทัด) · สวัสดิการ (ผังสวัสดิการที่ประกาศใช้ แยกรายการที่นำไปคำนวณภาษีกับที่ยกเว้น และยอดรายคน) · ขาดลามาสาย (วันขาด ลาไม่รับค่าจ้าง นาทีสาย แปลงเป็นยอดหักตามฐานเงินเดือนต่อวัน/ต่อชั่วโมง) · ภาษีและประกันสังคม (ประกันสังคม 5% เพดาน 750 บาท สมทบนายจ้าง กองทุนสำรองเลี้ยงชีพ และภาษีหัก ณ ที่จ่ายจากขั้นภาษีจริงพร้อมตารางขั้น) · การจ่ายเงิน (รายการโอนเข้าบัญชีรายคน แยกตามวิธีจ่าย พร้อมยอดรวมทั้งงวดและสถานะงวด)",
  files: {
    "src/modules/py/screen.tsx": PY_SCREEN,
    "src/modules/py/data.ts": PY_DATA,
  },
};

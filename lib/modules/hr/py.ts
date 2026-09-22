import type { Module } from "../types";
import { filesFor } from "../sources";

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
    "เลือกงวดแล้วเห็นสลิปทุกใบพร้อมที่มาของทุกตัวเลข ภาษี ประกันสังคม กองทุนสำรองเลี้ยงชีพ และยอดหักจากวันขาด คำนวณสดจากฐานเงินเดือนในทะเบียนพนักงาน",
  keyFeatures: [
    "คำนวณเงินเดือน",
    "สวัสดิการ",
    "ขาดลามาสาย",
    "ภาษีและประกันสังคม",
    "การจ่ายเงิน",
  ],
  hasOverview: true,
  provides: ["payslip"],
  needs: ["employee"],
  effortDays: 11,
  maPerMonth: 5000,
  build:
    "หน้าเงินเดือน เปิดมาเจอภาพรวมที่บอกยอดจ่ายทั้งงวด โครงสร้างรายได้ ต้นทุนแรงงานย้อนหลัง สถานะงวด และรายการที่ต้องดูก่อนอนุมัติ เลือกงวดได้ทุกหน้า จากนั้นเข้าดูได้ห้าส่วน · คำนวณเงินเดือน (ตารางรายได้/หัก/สุทธิรายคน เปิดสลิปเต็มใบที่แจกแจงทุกบรรทัด) · สวัสดิการ (ผังสวัสดิการที่ประกาศใช้ แยกรายการที่นำไปคำนวณภาษีกับที่ยกเว้น และยอดรายคน) · ขาดลามาสาย (วันขาด ลาไม่รับค่าจ้าง นาทีสาย แปลงเป็นยอดหักตามฐานเงินเดือนต่อวัน/ต่อชั่วโมง) · ภาษีและประกันสังคม (ประกันสังคม 5% เพดาน 750 บาท สมทบนายจ้าง กองทุนสำรองเลี้ยงชีพ และภาษีหัก ณ ที่จ่ายจากขั้นภาษีจริงพร้อมตารางขั้น) · การจ่ายเงิน (รายการโอนเข้าบัญชีรายคน แยกตามวิธีจ่าย พร้อมยอดรวมทั้งงวดและสถานะงวด)",
  files: filesFor("py", ["screen.tsx", "data.ts"]),
};

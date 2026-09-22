import type { Module } from "../types";
import { filesFor } from "../sources";

/**
 * Personnel records — the module every other HR module reads from.
 *
 * It owns `employee`. Payroll, time and the org chart all read it and none of them
 * may keep their own copy, which is the whole reason the composer tracks ownership:
 * two employee tables in one system is not a bug anyone reports, it is a system
 * that quietly disagrees with itself.
 */
export const PA: Module = {
  id: "pa",
  name: "ทะเบียนพนักงาน",
  sapCode: "PA",
  family: "hr",
  tier: "base",
  pitch:
    "แฟ้มประวัติพนักงานครบใบเดียว ตั้งแต่ข้อมูลส่วนตัวจนถึงเหตุการณ์ย้ายแผนกเลื่อนตำแหน่ง — ไม่ต้องไล่เปิด Excel หลายใบที่ไม่ตรงกัน",
  keyFeatures: [
    "ข้อมูลส่วนตัว",
    "ข้อมูลสัญญาจ้าง",
    "ข้อมูลทางปกครอง",
    "เหตุการณ์ทางบุคคล",
    "ค่าตอบแทนและสวัสดิการ",
  ],
  provides: ["employee"],
  needs: [],
  effortDays: 9,
  maPerMonth: 3500,
  build:
    "หน้าทะเบียนพนักงาน: ตารางค้นหาตามชื่อ ชื่อเล่น รหัส และกรองตามแผนก · คลิกแถวเปิดแฟ้มประวัติที่มีห้าแท็บ — ข้อมูลส่วนตัว (วันเกิด บัตรประชาชน ที่อยู่) · ข้อมูลสัญญาจ้าง (ประเภทจ้าง วันสิ้นสุด ทดลองงาน เงินเดือนฐาน พร้อมเตือนสัญญาใกล้หมด) · ข้อมูลทางปกครอง (ประกันสังคม ผู้เสียภาษี บัญชีธนาคาร กองทุนสำรองเลี้ยงชีพ) · เหตุการณ์ทางบุคคล (ไทม์ไลน์รับเข้า ย้ายแผนก เลื่อนตำแหน่ง ปรับเงินเดือน ลาออก และบันทึกเหตุการณ์ใหม่ได้) · ค่าตอบแทนและสวัสดิการ (เงินเดือนปัจจุบันและรายการสวัสดิการ)",
  files: filesFor("pa", ["screen.tsx", "data.ts"]),
};

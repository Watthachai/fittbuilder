import type { Module } from "../types";
import { filesFor } from "../sources";

/**
 * Time and leave — the module a manager opens on a Monday.
 *
 * It owns `timeEntry` and `leaveRequest` and reads `employee`. It deliberately does
 * NOT require payroll: plenty of companies track leave long before they move payroll
 * off a spreadsheet, and inventing that dependency would force a bundle the buyer
 * never asked for.
 */
export const TM: Module = {
  id: "tm",
  name: "เวลาทำงานและการลา",
  sapCode: "PT",
  family: "hr",
  tier: "premium",
  pitch:
    "ตารางกะ การตอกบัตร และใบลาอยู่หน้าเดียวกัน หัวหน้ากดอนุมัติแล้วสิทธิ์ลาคงเหลือขยับทันที และเวลาที่บันทึกไว้ส่งต่อให้เงินเดือนโดยตรง",
  keyFeatures: [
    "แผนกะการทำงาน",
    "บันทึกเวลาทำงาน",
    "การลาและการขาดงาน",
    "ติดตามการเข้างาน",
  ],
  hasOverview: true,
  provides: ["timeEntry", "leaveRequest"],
  needs: ["employee"],
  effortDays: 8,
  maPerMonth: 3500,
  build:
    "หน้าเวลาทำงานและการลา เปิดมาเจอภาพรวมที่บอกอัตราการเข้างานทั้งงวด สัดส่วนกะที่ใช้ ปฏิทินการลาและวันหยุด ตารางการมาสายรายคน และใบลาที่รออนุมัติ จากนั้นเข้าดูได้สี่ส่วน · แผนกะการทำงาน (นิยามกะเช้า/บ่าย/ดึก/วันหยุด ตารางกะรายสัปดาห์ต่อคน และวันหยุดประจำปีที่กระทบตาราง) · บันทึกเวลาทำงาน (เวลาเข้า-ออกจริงรายวัน คำนวณชั่วโมงทำงานหักพัก ล่วงเวลา และตัดสินสาย/ขาดจากกะที่ผูกไว้) · การลาและการขาดงาน (ใบลาพร้อมหน้าต่างพิจารณาอนุมัติ/ไม่อนุมัติที่ขยับสิทธิ์ลาคงเหลือทันที ห้าประเภทลาพร้อมโควตา) · ติดตามการเข้างาน (สรุปมาสาย ขาดงาน วันลา ล่วงเวลา และอัตราเข้างานรายคน)",
  files: filesFor("tm", ["screen.tsx", "data.ts"]),
};

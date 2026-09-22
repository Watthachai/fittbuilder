import type { Module } from "../types";
import { filesFor } from "../sources";

/**
 * Financial accounting. It owns `glEntry` and reads `vendor` and `customer`.
 *
 * The declared needs are what make the ledger worth having: accounts payable is
 * the purchasing module's vendors seen from the money side, and receivables are
 * the sales module's customers. A ledger with its own partner lists is a second
 * set of books, which is the thing bookkeeping exists to prevent.
 */
export const FI: Module = {
  id: "fi",
  name: "บัญชีการเงิน",
  sapCode: "FI",
  family: "finance",
  tier: "base",
  pitch:
    "ทุกบรรทัดในงบมาจากเอกสารที่ออกจริง ไม่ใช่ตัวเลขที่คีย์ซ้ำเข้ามาอีกรอบ — เปิดดูได้ถึงใบสั่งขายหรือใบแจ้งหนี้ที่เป็นต้นเรื่อง และระบบบอกเองว่างบดุลลงตัวหรือไม่",
  keyFeatures: [
    "ผังบัญชีและสมุดรายวัน",
    "เจ้าหนี้การค้า",
    "ลูกหนี้การค้า",
    "สินทรัพย์ถาวร",
    "งบการเงิน",
  ],
  provides: ["glEntry"],
  needs: ["vendor", "customer"],
  effortDays: 15,
  maPerMonth: 6500,
  build:
    "หน้าบัญชีการเงิน ห้าแท็บ — ผังบัญชีและสมุดรายวัน (ผังบัญชีพร้อมยอดคงเหลือแยกเดบิต–เครดิตและยอดรวมที่ต้องเท่ากัน สมุดรายวันที่ทุกใบมีป้ายว่าลงตัวหรือไม่ เปิดดูได้ถึงรายบรรทัดพร้อมเลขเอกสารต้นทาง) · เจ้าหนี้การค้า (ใบแจ้งหนี้ที่ยังไม่จ่าย ผู้ขายอ่านจากแฟ้มจัดซื้อ วันครบกำหนดคำนวณจากเงื่อนไขชำระจริง พร้อมตารางอายุหนี้) · ลูกหนี้การค้า (ยอดที่ลูกค้ายังไม่ชำระ ลูกค้าอ่านจากแฟ้มขาย เตือนใบที่ส่งของแล้วแต่ยังไม่ออกใบแจ้งหนี้ พร้อมตารางอายุหนี้) · สินทรัพย์ถาวร (ทะเบียนสินทรัพย์ ค่าเสื่อมราคาวิธีเส้นตรงต่อเดือนและสะสม มูลค่าคงเหลือตามบัญชี และแถบอายุการใช้งานที่ผ่านไป) · งบการเงิน (งบกำไรขาดทุนและงบแสดงฐานะการเงินคำนวณจากสมุดรายวันทั้งหมด พร้อมคำยืนยันว่าสินทรัพย์เท่ากับหนี้สินบวกส่วนของเจ้าของบวกกำไรงวดนี้)",
  files: filesFor("fi", ["screen.tsx", "data.ts"]),
};

import type { Module } from "../types";
import { filesFor } from "../sources";

/**
 * Warehouse management. It owns `storageBin` and reads `material`: a bin holds a
 * material, it does not define one. The count variance is priced from the material
 * master for the same reason — the value of what is missing has to be the value
 * purchasing paid for it.
 */
export const WM: Module = {
  id: "wm",
  name: "บริหารคลังสินค้า",
  sapCode: "WM",
  family: "logistics",
  tier: "premium",
  pitch:
    "รู้ว่าของอยู่ช่องไหน ช่องไหนใกล้เต็ม และคนหยิบของเดินทางเดียวจบ — ตรวจนับแล้วผลต่างขึ้นเป็นเงินทันที ไม่ใช่รอปิดงบถึงรู้ว่าของหาย",
  keyFeatures: [
    "ผังคลังและช่องเก็บ",
    "รับเข้าและจัดเก็บ",
    "หยิบสินค้าและจ่ายออก",
    "ย้ายสินค้าภายในคลัง",
    "ตรวจนับสต็อก",
  ],
  provides: ["storageBin"],
  needs: ["material"],
  effortDays: 11,
  maPerMonth: 4500,
  build:
    "หน้าบริหารคลังสินค้า ห้าแท็บ — ผังคลังและช่องเก็บ (เลขคลัง → พื้นที่รับของ/เก็บกอง/หยิบของ/จ่ายออก → ช่องเก็บเป็นตาราง แต่ละช่องมีแถบน้ำหนักเทียบเพดานของตัวเอง คลิกเปิดดูรายละเอียดช่อง) · รับเข้าและจัดเก็บ (ใบสั่งจัดเก็บจากท่ารับ ระบบเสนอช่องจากพื้นที่ที่ยังรับน้ำหนักไหวพร้อมช่องสำรอง กดยืนยันได้จริง) · หยิบสินค้าและจ่ายออก (ใบสั่งหยิบเรียงตามลำดับช่องให้เดินทางเดียวจบ อ้างถึงใบส่งของหรือใบสั่งผลิตที่เป็นต้นเรื่อง) · ย้ายสินค้าภายในคลัง (ใบย้ายของพร้อมเหตุผล เช่น เติมของเข้าช่องหยิบ หรือย้ายลงพื้นที่เก็บกองเพราะช่องหยิบเต็ม) · ตรวจนับสต็อก (นับจริงเทียบกับที่ระบบบอก ผลต่างตีเป็นเงินด้วยราคาจากแฟ้มวัสดุ)",
  files: filesFor("wm", ["screen.tsx", "data.ts"]),
};

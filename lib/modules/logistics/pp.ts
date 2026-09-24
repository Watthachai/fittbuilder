import type { Module } from "../types";
import { filesFor } from "../sources";

/**
 * Production planning. It reads `material` from จัดซื้อและคลังวัสดุ rather than
 * holding its own: the whole point of MRP is that the shortage it reports is the
 * shortage purchasing will buy against. A second stock figure here would make the
 * plan and the purchase order disagree on the one number both exist to get right.
 */
export const PP: Module = {
  id: "pp",
  name: "วางแผนการผลิต",
  icon: "Factory",
  sapCode: "PP",
  family: "logistics",
  tier: "premium",
  pitch:
    "ใส่ยอดที่ต้องส่ง ระบบกางสูตรการผลิตหักสต็อกให้เอง แล้วบอกว่าต้องซื้อวัสดุอะไรเพิ่มเท่าไร และศูนย์งานไหนจะรับไม่ไหวก่อนที่งานจะเลท",
  keyFeatures: [
    "ข้อมูลหลักการผลิต",
    "วางแผนความต้องการวัสดุ",
    "วางแผนกำลังการผลิต",
    "ใบสั่งผลิต",
    "รายงานผลการผลิต",
  ],
  hasOverview: true,
  provides: ["productionOrder"],
  needs: ["material"],
  effortDays: 13,
  maPerMonth: 5500,
  build:
    "หน้าวางแผนการผลิต เปิดมาเจอภาพรวมที่บอกผลิตได้เทียบแผน ภาระงานต่อศูนย์งาน วัสดุที่ต้องซื้อเพิ่ม ต้นทุนต่อหน่วยรายสินค้า และความต้องการที่ต้องส่ง จากนั้นเข้าดูได้ห้าส่วน · ข้อมูลหลักการผลิต (เลือกสินค้าแล้วเห็นสูตรการผลิตรายบรรทัดพร้อมราคาวัสดุจริง ขั้นตอนผ่านศูนย์งานพร้อมชั่วโมงและค่าแรง และต้นทุนต่อหน่วยที่คิดจากสองอย่างนี้) · วางแผนความต้องการวัสดุ (กางสูตรจากยอดที่ต้องส่ง หักสต็อกที่มีจริงในคลังวัสดุ แล้วสรุปว่าต้องซื้อเพิ่มรายการไหนกี่หน่วยเป็นเงินเท่าไร) · วางแผนกำลังการผลิต (ชั่วโมงที่ใบสั่งผลิตจองไว้เทียบกำลังของแต่ละศูนย์งาน เกิน 100% ขึ้นแดงว่าเกินกำลัง) · ใบสั่งผลิต (เลขที่ กำหนดเริ่ม–เสร็จ แถบความคืบหน้า และเปิดดูวัสดุที่ต้องเบิกทั้งใบกับชั่วโมงงานที่เหลือ) · รายงานผลการผลิต (ทำได้ตามแผนกี่เปอร์เซ็นต์ ผลผลิตและมูลค่ารายสินค้า และภาระงานสะสมต่อศูนย์งาน)",
  files: filesFor("pp", ["screen.tsx", "data.ts"]),
};

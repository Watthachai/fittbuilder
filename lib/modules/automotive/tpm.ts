import type { Module } from "../types";
import { filesFor } from "../sources";

/**
 * Total productive maintenance as IATF 8.5.1.5 asks for it. Machines sit on the
 * production planner's work centres, so OEE comes from real confirmations and the
 * downtime on work requests; spare parts are issued from the materials store and a
 * critical spare below its minimum raises a purchase requisition. A die is serviced
 * by shot count, not by the calendar.
 */
export const TPM: Module = {
  id: "tpm",
  name: "บำรุงรักษาเครื่องจักร",
  icon: "Wrench",
  sapCode: "PM",
  family: "automotive",
  tier: "premium",
  pitch:
    "เครื่องจักรไม่หยุดโดยไม่รู้ตัว แผน PM ตามวันหรือตามครั้งปั๊ม แจ้งซ่อมแล้วเบิกอะไหล่จากคลังจริง OEE คิดจากการผลิตจริง อะไหล่วิกฤตต่ำกว่าขั้นต่ำเปิดใบขอซื้อได้ทันที",
  keyFeatures: ["ทะเบียนเครื่องจักร", "แผนบำรุงรักษาเชิงป้องกัน", "แจ้งซ่อม", "ประสิทธิผลเครื่องจักร (OEE)", "อะไหล่วิกฤต"],
  hasOverview: true,
  provides: ["machine"],
  needs: ["controlledDocument", "competence", "material", "purchaseOrder", "productionOrder"],
  effortDays: 12,
  maPerMonth: 4500,
  build:
    "หน้าบำรุงรักษาเครื่องจักรตาม IATF 16949 ข้อ 8.5.1.5 เปิดมาเจอภาพรวม OEE เฉลี่ย 14 วัน เครื่องที่หยุดอยู่ PM เลยกำหนด อะไหล่ต่ำกว่าขั้นต่ำ รายการที่ต้องจัดการ และ OEE ตามศูนย์งาน จากนั้นเข้าดูได้ห้าส่วน · ทะเบียนเครื่องจักร (เครื่องจักร แม่พิมพ์ และระบบสนับสนุน ผูกกับศูนย์งานของระบบวางแผนการผลิต เครื่องหลักที่หยุดแล้วกระทบลูกค้า MTBF MTTR จากใบแจ้งซ่อม 90 วัน มิเตอร์ครั้งปั๊มของแม่พิมพ์) · แผนบำรุงรักษาเชิงป้องกัน (PM ช่างซ่อมบำรุงทำตามรอบวันหรือรอบครั้งปั๊ม AM ผู้ควบคุมเครื่องทำเองทุกกะ บันทึกผลตามรายการตรวจแล้วเริ่มรอบใหม่ ข้อไม่ผ่านต้องบอกสิ่งที่พบ) · แจ้งซ่อม (แจ้งแล้วเครื่องเป็นรอซ่อม เริ่มซ่อม ปิดงานพร้อมสาเหตุ สิ่งที่ทำ เวลาเครื่องหยุด และอะไหล่ที่เบิกจากคลังวัสดุจริง) · ประสิทธิผลเครื่องจักร (OEE) (ความพร้อม ประสิทธิภาพ คุณภาพ ต่อศูนย์งาน คำนวณจากการยืนยันงานของฝ่ายผลิตและเวลาหยุดจากใบแจ้งซ่อม) · อะไหล่วิกฤต (คงเหลืออ่านจากคลังวัสดุ ขั้นต่ำรวมทุกเครื่องที่ใช้ ต่ำกว่าขั้นต่ำเปิดใบขอซื้อในระบบจัดซื้อ) · ทุกหน้ามีปุ่มทำงานจริงและพิมพ์ใบตรวจเช็ค PM และใบแจ้งซ่อม ทุกใบมีเลขแบบฟอร์มจากบัญชีรายชื่อเอกสาร และส่งออก Excel ทุกทะเบียน",
  files: filesFor("tpm", ["screen.tsx", "data.ts", "forms.tsx", "documents.tsx"]),
};

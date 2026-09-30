import type { Module } from "../types";
import { filesFor } from "../sources";

/**
 * The five automotive core tools plus the control plan, as one module because they
 * are one chain: the PFMEA names the special characteristics, the control plan must
 * carry every one of them, SPC and MSA prove the plan works, and PPAP is the file
 * the customer approves. Every link is judged from data here — the PPAP element for
 * capability is complete when Ppk clears the target, not when someone ticks it.
 */
export const CT: Module = {
  id: "ct",
  name: "เครื่องมือหลักยานยนต์",
  icon: "Car",
  sapCode: "QM-APQP",
  family: "automotive",
  tier: "base",
  pitch:
    "เปิดตัวชิ้นส่วนยานยนต์ใหม่โดยไม่ต้องทำไฟล์ Excel หกชุด PFMEA แผนควบคุม SPC และ MSA ผูกกันเอง PPAP บอกได้ทันทีว่าขาดอะไร ส่งลูกค้าได้เมื่อข้อมูลจริงผ่านเกณฑ์",
  keyFeatures: [
    "วางแผนคุณภาพผลิตภัณฑ์ (APQP)",
    "อนุมัติชิ้นส่วนการผลิต (PPAP)",
    "วิเคราะห์ความล้มเหลว (FMEA)",
    "แผนควบคุม",
    "ควบคุมกระบวนการเชิงสถิติ (SPC)",
    "วิเคราะห์ระบบการวัด (MSA)",
  ],
  hasOverview: true,
  provides: ["controlPlan", "ppap"],
  needs: ["controlledDocument", "correctiveAction", "competence", "material", "productionOrder", "customer", "gauge"],
  effortDays: 18,
  maPerMonth: 7000,
  build:
    "หน้าเครื่องมือหลักยานยนต์ตาม IATF 16949 และคู่มือ AIAG-VDA เปิดมาเจอภาพรวมการเปิดตัวชิ้นส่วนใหม่ของลูกค้า Tier-1 พร้อมเฟส APQP วันเริ่มผลิตจริง สถานะ PPAP รายการส่งมอบที่เลยกำหนด FMEA ที่ AP สูงค้าง ความสามารถกระบวนการที่ต่ำกว่าเกณฑ์ และรายการที่ต้องจัดการก่อนเริ่มผลิต จากนั้นเข้าดูได้หกส่วน · วางแผนคุณภาพผลิตภัณฑ์ (APQP) (ห้าเฟสพร้อมรายการส่งมอบ ผู้รับผิดชอบ กำหนดเสร็จ รายการที่ผูกกับ PFMEA แผนควบคุม MSA SPC และ PPAP ระบบตัดสินจากข้อมูลจริง ประตูผ่านเฟสอนุมัติโดยผู้แทนฝ่ายบริหาร ผ่านแบบมีเงื่อนไขต้องบอกสิ่งที่ค้าง) · อนุมัติชิ้นส่วนการผลิต (PPAP) (18 องค์ประกอบตามระดับการส่ง องค์ประกอบ PFMEA แผนควบคุม ผล MSA และผลการศึกษากระบวนการเบื้องต้นตัดสินจากข้อมูลจริง ส่งลูกค้าได้เมื่อครบ บันทึกผลอนุมัติ อนุมัติชั่วคราวพร้อมวันหมดอายุ หรือไม่อนุมัติ พิมพ์ใบรับรองการส่งชิ้นส่วน PSW) · วิเคราะห์ความล้มเหลว (FMEA) (PFMEA และ DFMEA จัดลำดับด้วย Action Priority ตาม AIAG-VDA แทน RPN ขั้นตอนอ่านจากระบบวางแผนการผลิต ประกาศคุณลักษณะพิเศษ CC และ SC มาตรการและประเมินซ้ำ PFMEA ลดความรุนแรงไม่ได้) · แผนควบคุม (สามระยะ ต้นแบบ ก่อนผลิต ผลิตจริง คุณลักษณะพิเศษจาก PFMEA ต้องอยู่ครบ CC ต้องควบคุมด้วย SPC Poka-Yoke หรือตรวจ 100% แก้แล้วต้องอนุมัติใหม่ ยกเป็นแผนผลิตจริงได้เมื่อ PPAP อนุมัติ) · ควบคุมกระบวนการเชิงสถิติ (SPC) (แผนภูมิ X̄ พร้อมเส้นควบคุม Cp Cpk Pp Ppk เทียบเป้า CC 1.67 SC 1.33 ต้องมีอย่างน้อย 25 กลุ่มย่อย เพิ่มทีละกลุ่มหรือนำเข้าหลายกลุ่ม เริ่มการศึกษาใหม่หลังเปลี่ยนกระบวนการโดยเก็บของเดิมเป็นประวัติ) · วิเคราะห์ระบบการวัด (MSA) (Gage R&R วิธีค่าเฉลี่ยและพิสัย 10 ชิ้น 3 ผู้วัด 3 ครั้ง คำนวณ EV AV PV %GRR และ ndc ใช้เครื่องมือวัดจากทะเบียนของระบบคุณภาพและอุปกรณ์ช่วยตรวจเฉพาะชิ้นส่วน ผลล่าสุดของแต่ละคุณลักษณะคือผลที่ใช้) · ทุกหน้ามีปุ่มทำงานจริงและพิมพ์ PSW FMEA แผนควบคุม รายงานความสามารถกระบวนการ รายงาน Gage R&R และรายงานสถานะ APQP ทุกใบมีเลขแบบฟอร์มจากบัญชีรายชื่อเอกสาร และส่งออก Excel ทุกทะเบียน",
  files: filesFor("ct", ["screen.tsx", "data.ts", "forms.tsx", "documents.tsx"]),
};

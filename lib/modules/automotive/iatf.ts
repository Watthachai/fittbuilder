import type { Module } from "../types";
import { filesFor } from "../sources";

/**
 * What IATF 16949 asks for on top of ISO 9001, judged from the other modules'
 * records rather than ticked off: a customer requirement counts as implemented only
 * when it points at a live controlled document, a safety part is cleared only when
 * its CC is in an approved control plan and the customer has approved its PPAP, and
 * a supplier auditor is admitted only with VDA 6.3 and core-tools training on file.
 */
export const IATF: Module = {
  id: "iatf",
  name: "ข้อกำหนด IATF 16949",
  icon: "BadgeCheck",
  sapCode: "QM-IATF",
  family: "automotive",
  tier: "premium",
  pitch:
    "ข้อกำหนดที่ลูกค้ารถยนต์ตรวจเพิ่มจาก ISO 9001 อยู่ในที่เดียว ข้อกำหนดเฉพาะลูกค้า ความปลอดภัยผลิตภัณฑ์ แผนฉุกเฉิน ตรวจผู้ส่งมอบ scorecard และ Poka-Yoke ตัดสินจากข้อมูลจริงของระบบอื่นทั้งหมด",
  keyFeatures: [
    "ข้อกำหนดเฉพาะลูกค้า",
    "ความปลอดภัยผลิตภัณฑ์",
    "แผนฉุกเฉินทางธุรกิจ",
    "ตรวจประเมินผู้ส่งมอบ",
    "ผลงานต่อลูกค้า (Scorecard)",
    "ป้องกันความผิดพลาด (Poka-Yoke)",
  ],
  hasOverview: true,
  provides: [],
  needs: ["controlledDocument", "correctiveAction", "competence", "vendor", "customer", "salesOrder", "nonconformance", "controlPlan", "ppap"],
  effortDays: 14,
  maPerMonth: 5500,
  build:
    "หน้าข้อกำหนด IATF 16949 ที่ ISO 9001 ไม่มี เปิดมาเจอภาพรวมข้อกำหนดเฉพาะลูกค้าที่นำไปใช้แล้ว ข้อความปลอดภัยผลิตภัณฑ์ที่ยังไม่ผ่าน แผนฉุกเฉินที่ต้องทดสอบ scorecard ล่าสุดจากลูกค้า รายการที่ต้องจัดการ และใบรับรองกับเกรดของผู้ส่งมอบ จากนั้นเข้าดูได้หกส่วน · ข้อกำหนดเฉพาะลูกค้า (ตารางข้อกำหนดจากคู่มือผู้ส่งมอบของลูกค้าเทียบข้อ IATF นับว่านำไปใช้เมื่อผูกกับเอกสารควบคุมที่ใช้งานอยู่ในทะเบียนกลางเท่านั้น เพิ่มข้อกำหนด เริ่มทำ นำไปใช้) · ความปลอดภัยผลิตภัณฑ์ (รายการตรวจของชิ้นส่วนความปลอดภัยอ่านจาก PFMEA แผนควบคุม PPAP และทะเบียนความสามารถของผู้แทนความปลอดภัยผลิตภัณฑ์ ทดสอบการสอบกลับจากชิ้นงานถึงล็อตวัตถุดิบภายในเวลาที่ลูกค้ากำหนด) · แผนฉุกเฉินทางธุรกิจ (สถานการณ์ที่ทำให้ส่งมอบไม่ได้ สิ่งที่ต้องทำ ผู้รับผิดชอบ ต้องทดสอบและผ่านอย่างน้อยปีละครั้ง) · ตรวจประเมินผู้ส่งมอบ (ใบรับรองระบบของผู้ส่งมอบ วางแผนตรวจกระบวนการตาม VDA 6.3 ผู้ตรวจต้องผ่านหลักสูตร VDA 6.3 และ Core Tools เกรด C เปิด 8D ให้ผู้ส่งมอบพัฒนา) · ผลงานต่อลูกค้า (Scorecard) (PPM ส่งตรงเวลา ขนส่งด่วน และการกระทบสายการผลิตที่ลูกค้ารายงาน วางคู่กับ PPM ที่ระบบคุณภาพนับเอง ระดับแดงเปิด 8D ทันที) · ป้องกันความผิดพลาด (Poka-Yoke) (ทะเบียนอุปกรณ์ ทวนสอบด้วยชิ้นต้นแบบเสียทุกกะ ไม่จับคือหยุดใช้และเปิด CAR นำกลับมาใช้ได้เมื่อปิด CAR แล้ว) · ทุกหน้ามีปุ่มทำงานจริงและพิมพ์ตารางข้อกำหนดเฉพาะลูกค้า แผนฉุกเฉิน รายงานตรวจผู้ส่งมอบ และใบทวนสอบ Poka-Yoke ทุกใบมีเลขแบบฟอร์มจากบัญชีรายชื่อเอกสาร",
  files: filesFor("iatf", ["screen.tsx", "data.ts", "forms.tsx", "documents.tsx"]),
};

import { EMPLOYEES } from "../pa/data";

export const ORG_UNITS = [
  { id: 1, name: "ฝ่ายขาย", head: "หัวหน้าฝ่ายขาย", plannedHeadcount: 4 },
  { id: 2, name: "ฝ่ายบัญชี", head: "นักบัญชีอาวุโส", plannedHeadcount: 3 },
  { id: 3, name: "ฝ่ายคลัง", head: "ผู้จัดการคลัง", plannedHeadcount: 5 },
  { id: 4, name: "ฝ่ายบุคคล", head: "เจ้าหน้าที่บุคคล", plannedHeadcount: 2 },
  { id: 5, name: "ฝ่ายผลิต", head: "หัวหน้าสายการผลิต", plannedHeadcount: 6 },
  { id: 6, name: "ฝ่ายจัดซื้อ", head: "เจ้าหน้าที่จัดซื้อ", plannedHeadcount: 2 },
];

export const POSITIONS = [
  { id: 1, unitId: 1, title: "หัวหน้าฝ่ายขาย", level: "หัวหน้างาน", reportsTo: null, qualifications: ["ประสบการณ์ขาย 5 ปี", "บริหารทีม", "เจรจาต่อรอง"] },
  { id: 2, unitId: 1, title: "พนักงานขาย", level: "ปฏิบัติการ", reportsTo: "หัวหน้าฝ่ายขาย", qualifications: ["สื่อสารดี", "ใช้ CRM ได้"] },
  { id: 3, unitId: 2, title: "นักบัญชีอาวุโส", level: "อาวุโส", reportsTo: null, qualifications: ["บัญชีบัณฑิต", "ปิดงบได้", "ภาษีนิติบุคคล"] },
  { id: 4, unitId: 3, title: "ผู้จัดการคลัง", level: "ผู้จัดการ", reportsTo: null, qualifications: ["บริหารคลัง 5 ปี", "ระบบ WMS"] },
  { id: 5, unitId: 3, title: "พนักงานคลังสินค้า", level: "ปฏิบัติการ", reportsTo: "ผู้จัดการคลัง", qualifications: ["ขับโฟล์คลิฟท์", "นับสต็อก"] },
  { id: 6, unitId: 4, title: "เจ้าหน้าที่บุคคล", level: "ปฏิบัติการ", reportsTo: null, qualifications: ["กฎหมายแรงงาน", "สรรหา"] },
  { id: 7, unitId: 5, title: "ช่างเทคนิค", level: "ปฏิบัติการ", reportsTo: "หัวหน้าสายการผลิต", qualifications: ["ซ่อมบำรุงเครื่องจักร", "ความปลอดภัย"] },
  { id: 8, unitId: 5, title: "หัวหน้าสายการผลิต", level: "หัวหน้างาน", reportsTo: null, qualifications: ["วางแผนผลิต", "บริหารทีม", "ควบคุมคุณภาพ"] },
  { id: 9, unitId: 6, title: "เจ้าหน้าที่จัดซื้อ", level: "ปฏิบัติการ", reportsTo: null, qualifications: ["เจรจาต่อรอง", "ประเมินผู้ขาย"] },
];

/** Skills each person actually holds — compared against what the seat requires. */
export const EMPLOYEE_SKILLS: Record<number, string[]> = {
  1: ["ประสบการณ์ขาย 5 ปี", "บริหารทีม", "เจรจาต่อรอง"],
  2: ["บัญชีบัณฑิต", "ปิดงบได้"],
  3: ["นับสต็อก"],
  4: ["กฎหมายแรงงาน", "สรรหา"],
  5: ["ซ่อมบำรุงเครื่องจักร"],
  6: ["สื่อสารดี", "ใช้ CRM ได้"],
  7: ["บริหารคลัง 5 ปี", "ระบบ WMS"],
};

export const holderOf = (title: string) => EMPLOYEES.find((e) => e.position === title && e.status !== "ลาออก");

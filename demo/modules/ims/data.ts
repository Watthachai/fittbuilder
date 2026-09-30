import { commit } from "../kit";
import { COMPANY, TODAY } from "../company";

export { COMPANY, TODAY };

/**
 * ระบบบริหารบูรณาการ (IMS) — ส่วนที่ ISO 9001, ISO 14001 และ IATF 16949 ใช้ร่วมกัน
 *
 * บริษัทที่ถือหลายมาตรฐานไม่ควรมีทะเบียนเอกสารสามชุด ผู้ตรวจติดตามสามทีม หรือ CAR
 * สามแบบ ระบบนี้จึงถือของกลางไว้ที่เดียว: บริบทองค์กร ความเสี่ยง นโยบายและวัตถุประสงค์
 * เอกสารควบคุม ความสามารถของบุคลากร การตรวจติดตาม การแก้ไข และการทบทวนโดยฝ่ายบริหาร
 * ระบบเฉพาะมาตรฐาน (คุณภาพ สิ่งแวดล้อม ยานยนต์) อ่านและเขียนผ่านฟังก์ชันของที่นี่
 * และส่งข้อมูลเข้าวาระทบทวนโดยฝ่ายบริหารผ่าน contributeReviewInput — ระบบนี้จึงไม่ต้อง
 * รู้ว่าลูกค้าซื้อระบบไหนไปบ้าง
 */

export const YEAR = Number(TODAY.slice(0, 4)) + 543;

export type Errors = Record<string, string>;

export function assertValid(e: Errors) {
  const first = Object.values(e)[0];
  if (first) throw new Error(first);
}

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

export function addMonths(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1 + n, d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** เลขถัดไปของชุดเอกสาร — ต่อจากเลขที่สูงสุดที่มีอยู่ ไม่ใช่จากจำนวนใบ */
export function nextNo(existing: string[], prefix: string, width: number) {
  const max = existing
    .filter((n) => n.startsWith(prefix))
    .map((n) => Number(n.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return prefix + String(max + 1).padStart(width, "0");
}

export const rate = (hit: number, of: number) => (of === 0 ? 100 : Math.round((hit / of) * 1000) / 10);

/* ============================================================= standards */

export const STANDARDS = ["ISO 9001", "ISO 14001", "IATF 16949"] as const;
export type Standard = (typeof STANDARDS)[number];

const SHORT: Record<Standard, string> = { "ISO 9001": "9001", "ISO 14001": "14001", "IATF 16949": "IATF" };

export type Clause = { id: string; std: Standard; code: string; name: string };

const clause = (std: Standard, code: string, name: string): Clause => ({ id: `${SHORT[std]}:${code}`, std, code, name });

/** ข้อกำหนดที่ระบบอ้างถึง — IATF 16949 อ่านคู่กับ ISO 9001 จึงมีเฉพาะข้อที่เพิ่มขึ้นมา */
export const CLAUSES: Clause[] = [
  clause("ISO 9001", "4.1", "บริบทขององค์กร"),
  clause("ISO 9001", "4.2", "ความต้องการของผู้มีส่วนได้ส่วนเสีย"),
  clause("ISO 9001", "4.3", "ขอบเขตระบบบริหารคุณภาพ"),
  clause("ISO 9001", "4.4", "ระบบบริหารคุณภาพและกระบวนการ"),
  clause("ISO 9001", "5.1", "ความเป็นผู้นำ"),
  clause("ISO 9001", "5.2", "นโยบายคุณภาพ"),
  clause("ISO 9001", "6.1", "การดำเนินการกับความเสี่ยงและโอกาส"),
  clause("ISO 9001", "6.2", "วัตถุประสงค์คุณภาพ"),
  clause("ISO 9001", "7.1.5", "ทรัพยากรสำหรับการเฝ้าติดตามและการวัด"),
  clause("ISO 9001", "7.2", "ความสามารถ"),
  clause("ISO 9001", "7.3", "การตระหนักรู้"),
  clause("ISO 9001", "7.5", "เอกสารสารสนเทศ"),
  clause("ISO 9001", "8.2", "ข้อกำหนดสำหรับผลิตภัณฑ์และบริการ"),
  clause("ISO 9001", "8.3", "การออกแบบและการพัฒนา"),
  clause("ISO 9001", "8.4", "การควบคุมผู้ให้บริการภายนอก"),
  clause("ISO 9001", "8.5", "การผลิตและการให้บริการ"),
  clause("ISO 9001", "8.6", "การตรวจปล่อยผลิตภัณฑ์"),
  clause("ISO 9001", "8.7", "การควบคุมผลลัพธ์ที่ไม่เป็นไปตามข้อกำหนด"),
  clause("ISO 9001", "9.1.2", "ความพึงพอใจของลูกค้า"),
  clause("ISO 9001", "9.1.3", "การวิเคราะห์และการประเมินผล"),
  clause("ISO 9001", "9.2", "การตรวจติดตามภายใน"),
  clause("ISO 9001", "9.3", "การทบทวนโดยฝ่ายบริหาร"),
  clause("ISO 9001", "10.2", "สิ่งที่ไม่เป็นไปตามข้อกำหนดและการแก้ไข"),
  clause("ISO 9001", "10.3", "การปรับปรุงอย่างต่อเนื่อง"),
  clause("ISO 14001", "4.1", "บริบทขององค์กร"),
  clause("ISO 14001", "4.3", "ขอบเขตระบบการจัดการสิ่งแวดล้อม"),
  clause("ISO 14001", "5.2", "นโยบายสิ่งแวดล้อม"),
  clause("ISO 14001", "6.1.2", "ประเด็นปัญหาด้านสิ่งแวดล้อม"),
  clause("ISO 14001", "6.1.3", "พันธะความสอดคล้อง"),
  clause("ISO 14001", "6.2", "วัตถุประสงค์ด้านสิ่งแวดล้อม"),
  clause("ISO 14001", "7.2", "ความสามารถ"),
  clause("ISO 14001", "7.4", "การสื่อสาร"),
  clause("ISO 14001", "7.5", "เอกสารสารสนเทศ"),
  clause("ISO 14001", "8.1", "การวางแผนและการควบคุมการปฏิบัติงาน"),
  clause("ISO 14001", "8.2", "การเตรียมพร้อมและการตอบสนองต่อสภาวะฉุกเฉิน"),
  clause("ISO 14001", "9.1.1", "การเฝ้าติดตามและการวัด"),
  clause("ISO 14001", "9.1.2", "การประเมินความสอดคล้อง"),
  clause("ISO 14001", "9.2", "การตรวจติดตามภายใน"),
  clause("ISO 14001", "9.3", "การทบทวนโดยฝ่ายบริหาร"),
  clause("ISO 14001", "10.2", "อุบัติการณ์และการแก้ไข"),
  clause("IATF 16949", "4.3.2", "ข้อกำหนดเฉพาะของลูกค้า"),
  clause("IATF 16949", "4.4.1.2", "ความปลอดภัยของผลิตภัณฑ์"),
  clause("IATF 16949", "5.1.1.1", "ความรับผิดชอบขององค์กร"),
  clause("IATF 16949", "6.1.2.3", "แผนฉุกเฉิน"),
  clause("IATF 16949", "7.1.5.1.1", "การวิเคราะห์ระบบการวัด"),
  clause("IATF 16949", "7.2.3", "ความสามารถของผู้ตรวจติดตามภายใน"),
  clause("IATF 16949", "7.2.4", "ความสามารถของผู้ตรวจติดตามผู้ส่งมอบ"),
  clause("IATF 16949", "8.3.2.1", "การวางแผนการออกแบบและพัฒนา (APQP)"),
  clause("IATF 16949", "8.3.4.4", "กระบวนการอนุมัติผลิตภัณฑ์ (PPAP)"),
  clause("IATF 16949", "8.4.2.4.1", "การตรวจติดตามผู้ส่งมอบแบบ second-party"),
  clause("IATF 16949", "8.5.1.1", "แผนควบคุม"),
  clause("IATF 16949", "8.5.1.5", "การบำรุงรักษาเชิงป้องกันแบบทั่วถึง (TPM)"),
  clause("IATF 16949", "9.1.1.1", "การเฝ้าติดตามกระบวนการผลิต (SPC)"),
  clause("IATF 16949", "9.1.2.1", "ความพึงพอใจของลูกค้า — scorecard"),
  clause("IATF 16949", "9.2.2.2", "การตรวจติดตามระบบ"),
  clause("IATF 16949", "9.2.2.3", "การตรวจติดตามกระบวนการผลิต"),
  clause("IATF 16949", "9.2.2.4", "การตรวจติดตามผลิตภัณฑ์"),
  clause("IATF 16949", "10.2.3", "การแก้ปัญหา (8D)"),
  clause("IATF 16949", "10.2.4", "การป้องกันความผิดพลาด (Poka-Yoke)"),
];

export const clauseById = (id: string) => CLAUSES.find((c) => c.id === id);
export const clauseName = (id: string) => clauseById(id)?.name ?? "";
/** "9001 ข้อ 8.5" — สั้นพอสำหรับตาราง ยังบอกว่ามาตรฐานไหน */
export const clauseLabel = (id: string) => {
  const c = clauseById(id);
  return c ? `${SHORT[c.std]} ข้อ ${c.code}` : id;
};
export const clausesOf = (std: Standard) => CLAUSES.filter((c) => c.std === std);

/* ================================================================ people */

export const DEPARTMENTS = [
  "ฝ่ายบริหาร", "ฝ่ายประกันคุณภาพ", "ฝ่ายวิศวกรรม", "ฝ่ายผลิต", "ฝ่ายซ่อมบำรุง",
  "ฝ่ายจัดซื้อ", "ฝ่ายคลังสินค้า", "ฝ่ายขาย", "ฝ่ายความปลอดภัยและสิ่งแวดล้อม",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

/** หลักสูตรที่ระบบใช้ตัดสินความสามารถ — มีอายุเมื่อใบรับรองหมดอายุจริง */
export const COURSES = [
  { code: "TR-01", name: "ความเข้าใจข้อกำหนด ISO 9001:2015" },
  { code: "TR-02", name: "ผู้ตรวจติดตามภายใน ISO 9001:2015" },
  { code: "TR-03", name: "ผู้ตรวจติดตามภายใน ISO 14001:2015" },
  { code: "TR-04", name: "ผู้ตรวจกระบวนการ VDA 6.3" },
  { code: "TR-05", name: "Core Tools: APQP PPAP FMEA SPC MSA" },
  { code: "TR-06", name: "ข้อกำหนดเฉพาะลูกค้ายานยนต์ (CSR)" },
  { code: "TR-07", name: "การจัดการสารเคมีและของเสียอันตราย" },
  { code: "TR-08", name: "ทดสอบฝีมือช่างเชื่อมตาม WPS", validYears: 2 },
  { code: "TR-09", name: "การใช้และอ่านค่าเครื่องมือวัด" },
  { code: "TR-10", name: "การตอบสนองเหตุฉุกเฉินและดับเพลิงขั้นต้น", validYears: 1 },
  { code: "TR-11", name: "TPM และการบำรุงรักษาด้วยตนเอง" },
  { code: "TR-12", name: "จรรยาบรรณและการต่อต้านการให้สินบน" },
] as const;
export type CourseCode = (typeof COURSES)[number]["code"];

export const courseName = (code: string) => COURSES.find((c) => c.code === code)?.name ?? code;
const validYears = (code: string) => (COURSES.find((c) => c.code === code) as { validYears?: number } | undefined)?.validYears;

export type Person = { name: string; role: string; dept: Department; requires: CourseCode[] };

/** ทุกคนต้องรู้ข้อกำหนดและจรรยาบรรณ คนหน้างานต้องซ้อมรับเหตุฉุกเฉิน (IATF 5.1.1.1, ISO 14001 7.2) */
const BASIC: CourseCode[] = ["TR-01", "TR-12"];
const FLOOR: CourseCode[] = [...BASIC, "TR-10"];

/**
 * บุคลากรที่ทำงานซึ่งมีผลต่อคุณภาพและสิ่งแวดล้อม — ทะเบียนของระบบนี้เอง ไม่อ่านจาก
 * ระบบบุคคล เพื่อให้ซื้อระบบมาตรฐานได้โดยไม่ต้องซื้อระบบเงินเดือน
 */
export const STAFF: Person[] = [
  { name: "วีระ ตั้งมั่น", role: "กรรมการผู้จัดการ", dept: "ฝ่ายบริหาร", requires: BASIC },
  { name: "นพดล ศรีวงศ์", role: "ผู้จัดการฝ่ายประกันคุณภาพ (QMR)", dept: "ฝ่ายประกันคุณภาพ", requires: [...BASIC, "TR-02", "TR-04", "TR-05", "TR-06"] },
  { name: "สุภาพร แก้วมณี", role: "หัวหน้าตรวจสอบคุณภาพ (QC)", dept: "ฝ่ายประกันคุณภาพ", requires: [...BASIC, "TR-02", "TR-09"] },
  { name: "ธนพล เจริญผล", role: "วิศวกรคุณภาพลูกค้ายานยนต์ (CQE)", dept: "ฝ่ายประกันคุณภาพ", requires: [...BASIC, "TR-02", "TR-04", "TR-05", "TR-06"] },
  { name: "ศักดิ์ชัย วงศ์ไทย", role: "วิศวกรกระบวนการ", dept: "ฝ่ายวิศวกรรม", requires: [...BASIC, "TR-05"] },
  { name: "อนุชา ทองดี", role: "หัวหน้าฝ่ายผลิต", dept: "ฝ่ายผลิต", requires: [...FLOOR, "TR-02"] },
  { name: "สมปอง ใจกล้า", role: "ช่างเชื่อม", dept: "ฝ่ายผลิต", requires: [...FLOOR, "TR-08"] },
  { name: "มานพ รุ่งเรือง", role: "ช่างพ่นสี", dept: "ฝ่ายผลิต", requires: [...FLOOR, "TR-07"] },
  { name: "ประสิทธิ์ ขยันยิ่ง", role: "หัวหน้าซ่อมบำรุง", dept: "ฝ่ายซ่อมบำรุง", requires: [...FLOOR, "TR-11"] },
  { name: "ปิยะนุช ใจดี", role: "หัวหน้าฝ่ายจัดซื้อ", dept: "ฝ่ายจัดซื้อ", requires: [...BASIC, "TR-02"] },
  { name: "วรวุฒิ พึ่งบุญ", role: "หัวหน้าคลังสินค้า", dept: "ฝ่ายคลังสินค้า", requires: [...FLOOR, "TR-07"] },
  { name: "ชลธิชา มั่นคง", role: "หัวหน้าฝ่ายขาย", dept: "ฝ่ายขาย", requires: [...BASIC, "TR-02"] },
  { name: "กาญจนา บุญมา", role: "เจ้าหน้าที่สิ่งแวดล้อม (EMR)", dept: "ฝ่ายความปลอดภัยและสิ่งแวดล้อม", requires: [...FLOOR, "TR-03", "TR-07"] },
];

export const TOP = "วีระ ตั้งมั่น";
export const QMR = "นพดล ศรีวงศ์";
export const EMR = "กาญจนา บุญมา";
export const PEOPLE = STAFF.map((p) => p.name);
export const personOf = (name: string) => STAFF.find((p) => p.name === name);
export const deptOf = (name: string) => personOf(name)?.dept ?? "";
export const roleOf = (name: string) => personOf(name)?.role ?? "";

/* =============================================================== context */

export const SWOT = ["จุดแข็ง", "จุดอ่อน", "โอกาส", "อุปสรรค"] as const;
export type SwotKind = (typeof SWOT)[number];
/** มุมมองของประเด็นภายนอก (PESTEL) — ประเด็นภายในไม่ต้องมี */
export const PESTEL = ["การเมือง", "เศรษฐกิจ", "สังคม", "เทคโนโลยี", "สิ่งแวดล้อม", "กฎหมาย"] as const;
export type Lens = (typeof PESTEL)[number];

export type Issue = { id: number; kind: SwotKind; lens?: Lens; text: string; standards: Standard[] };

export const ISSUES: Issue[] = [
  { id: 1, kind: "จุดแข็ง", text: "ขึ้นรูปและเชื่อมเหล็กได้ครบในโรงงานเดียว ส่งงานเร็วกว่าคู่แข่งที่จ้างช่วง", standards: ["ISO 9001"] },
  { id: 2, kind: "จุดแข็ง", text: "ทีมคุณภาพมีผู้ผ่านอบรม Core Tools และ VDA 6.3 แล้ว", standards: ["IATF 16949"] },
  { id: 3, kind: "จุดอ่อน", text: "เครื่องปั๊มหลักมีเครื่องเดียว หยุดแล้วไม่มีเครื่องสำรอง", standards: ["ISO 9001", "IATF 16949"] },
  { id: 4, kind: "จุดอ่อน", text: "ช่างพ่นสีหมุนเวียนบ่อย ความรู้เรื่องสารเคมียังไม่ทั่วถึง", standards: ["ISO 9001", "ISO 14001"] },
  { id: 5, kind: "โอกาส", lens: "เศรษฐกิจ", text: "ผู้ผลิตรถยนต์ย้ายฐานการผลิตรถไฟฟ้ามาไทย ต้องการผู้ส่งมอบชิ้นส่วนปั๊มขึ้นรูปในประเทศ", standards: ["IATF 16949"] },
  { id: 6, kind: "โอกาส", lens: "เทคโนโลยี", text: "สีฝุ่นสูตรอบอุณหภูมิต่ำลดพลังงานเตาอบได้ราว 20%", standards: ["ISO 14001"] },
  { id: 7, kind: "อุปสรรค", lens: "กฎหมาย", text: "กรมโรงงานฯ เข้มงวดการรายงานของเสียอันตรายผ่านระบบออนไลน์ (สก.2)", standards: ["ISO 14001"] },
  { id: 8, kind: "อุปสรรค", lens: "เศรษฐกิจ", text: "ราคาเหล็กแผ่นผันผวนตามตลาดโลก กระทบต้นทุนสัญญาราคาคงที่", standards: ["ISO 9001"] },
  { id: 9, kind: "อุปสรรค", lens: "สังคม", text: "ชุมชนหลังโรงงานเคยร้องเรียนกลิ่นสีช่วงอบกลางคืน", standards: ["ISO 14001"] },
];

export type Party = { id: number; name: string; needs: string; how: string; standards: Standard[] };

export const PARTIES: Party[] = [
  { id: 1, name: "ลูกค้าทั่วไป (ร้านค้าและตัวแทนจำหน่าย)", needs: "สินค้าตรงสเปก ส่งตรงเวลา รับเรื่องร้องเรียนเร็ว", how: "ตรวจก่อนส่งทุกล็อต สำรวจความพึงพอใจทุกครึ่งปี", standards: ["ISO 9001"] },
  { id: 2, name: "ลูกค้ายานยนต์ Tier-1", needs: "PPAP ระดับ 3 ข้อกำหนดเฉพาะลูกค้า ของเสียไม่เกิน 50 PPM", how: "APQP ทุกชิ้นส่วนใหม่ ติดตาม scorecard รายเดือน", standards: ["IATF 16949"] },
  { id: 3, name: "พนักงาน", needs: "สภาพงานปลอดภัย อบรมตามหน้าที่", how: "แผนฝึกอบรมประจำปี คณะกรรมการความปลอดภัย", standards: ["ISO 9001", "ISO 14001"] },
  { id: 4, name: "ชุมชนรอบโรงงาน", needs: "ไม่มีกลิ่น เสียง และน้ำทิ้งรบกวน", how: "ตรวจวัดตามกฎหมาย ช่องทางรับเรื่องร้องเรียนชุมชน", standards: ["ISO 14001"] },
  { id: 5, name: "กรมโรงงานอุตสาหกรรม", needs: "รายงานของเสีย ผลตรวจวัดน้ำทิ้งและอากาศตามรอบ", how: "ทะเบียนกฎหมาย ประเมินความสอดคล้องปีละครั้ง", standards: ["ISO 14001"] },
  { id: 6, name: "ผู้ขายวัตถุดิบ", needs: "คำสั่งซื้อชัดเจน ชำระเงินตรงเวลา", how: "ประเมินผู้ส่งมอบประจำปี", standards: ["ISO 9001", "IATF 16949"] },
  { id: 7, name: "หน่วยรับรองระบบ", needs: "หลักฐานว่าระบบทำงานจริงตามข้อกำหนด", how: "ตรวจติดตามภายในครบทุกข้อกำหนดทุกปี", standards: ["ISO 9001", "ISO 14001", "IATF 16949"] },
];

export type Scope = {
  std: Standard;
  text: string;
  sites: string;
  exclusions: { clause: string; reason: string }[];
  status: "ได้รับการรับรอง" | "กำลังขอรับรอง";
  certifiedBy: string;
  certNo?: string;
  validUntil?: string;
  nextAudit: string;
};

export const SCOPES: Scope[] = [
  {
    std: "ISO 9001", status: "ได้รับการรับรอง", certifiedBy: "บจก. ไทยเซอร์ติฟิเคชั่น", certNo: "TH-QMS-24-0187", validUntil: "2027-11-14", nextAudit: "2026-11-10",
    text: "ออกแบบ ผลิต และจำหน่ายเฟอร์นิเจอร์เหล็กสำนักงาน ชั้นวาง และรถเข็นอุตสาหกรรม", sites: "โรงงานและสำนักงานใหญ่", exclusions: [],
  },
  {
    std: "ISO 14001", status: "ได้รับการรับรอง", certifiedBy: "บจก. ไทยเซอร์ติฟิเคชั่น", certNo: "TH-EMS-25-0042", validUntil: "2028-03-02", nextAudit: "2027-02-22",
    text: "กิจกรรมการผลิตเหล็กขึ้นรูป เชื่อม พ่นสีฝุ่น และคลังสินค้า ภายในพื้นที่โรงงาน", sites: "โรงงาน", exclusions: [],
  },
  {
    std: "IATF 16949", status: "กำลังขอรับรอง", certifiedBy: "บจก. ไทยเซอร์ติฟิเคชั่น", nextAudit: "2026-12-07",
    text: "ผลิตชิ้นส่วนเหล็กปั๊มขึ้นรูปสำหรับยานยนต์ตามแบบของลูกค้า", sites: "โรงงาน · สำนักงานขายกรุงเทพฯ (support site)",
    exclusions: [{ clause: "9001:8.3", reason: "ลูกค้าเป็นผู้ออกแบบผลิตภัณฑ์ ยกเว้นเฉพาะการออกแบบผลิตภัณฑ์ ยังออกแบบกระบวนการผลิตเอง" }],
  },
];

export const CONTEXT = { reviewedOn: "2026-01-20", reviewedBy: TOP };

export function issueErrors(input: Omit<Issue, "id">): Errors {
  const e: Errors = {};
  if (!SWOT.includes(input.kind)) e.kind = "เลือกประเภท";
  if ((input.kind === "โอกาส" || input.kind === "อุปสรรค") && !input.lens) e.lens = "ประเด็นภายนอกต้องบอกมุมมอง (PESTEL)";
  if (input.text.trim().length < 10) e.text = "อธิบายประเด็นให้คนอ่านเข้าใจ";
  if (input.standards.length === 0) e.standards = "เลือกมาตรฐานที่เกี่ยวข้อง";
  return e;
}

export function addIssue(input: Omit<Issue, "id">) {
  assertValid(issueErrors(input));
  return commit(() => {
    const i: Issue = { ...input, id: Math.max(0, ...ISSUES.map((x) => x.id)) + 1, text: input.text.trim(), lens: input.kind === "จุดแข็ง" || input.kind === "จุดอ่อน" ? undefined : input.lens };
    ISSUES.push(i);
    return i;
  });
}

export function partyErrors(input: Omit<Party, "id">): Errors {
  const e: Errors = {};
  if (input.name.trim().length < 3) e.name = "ใส่ชื่อผู้มีส่วนได้ส่วนเสีย";
  else if (PARTIES.some((p) => p.name === input.name.trim())) e.name = "มีในทะเบียนแล้ว";
  if (input.needs.trim().length < 5) e.needs = "เขาต้องการอะไรจากเรา";
  if (input.how.trim().length < 5) e.how = "เราตอบสนองและติดตามอย่างไร";
  if (input.standards.length === 0) e.standards = "เลือกมาตรฐานที่เกี่ยวข้อง";
  return e;
}

export function addParty(input: Omit<Party, "id">) {
  assertValid(partyErrors(input));
  return commit(() => {
    const p: Party = { ...input, id: Math.max(0, ...PARTIES.map((x) => x.id)) + 1, name: input.name.trim(), needs: input.needs.trim(), how: input.how.trim() };
    PARTIES.push(p);
    return p;
  });
}

/** ทบทวนบริบททั้งชุด — ฝ่ายบริหารสูงสุดเป็นผู้ยืนยัน (ข้อ 4.1 และ 5.1) */
export function confirmContext(by: string, date = TODAY) {
  if (by !== TOP) throw new Error(`การทบทวนบริบทองค์กรต้องยืนยันโดย ${TOP} (ผู้บริหารสูงสุด)`);
  return commit(() => {
    CONTEXT.reviewedOn = date;
    CONTEXT.reviewedBy = by;
    return CONTEXT;
  });
}

/* ================================================================== risk */

export type RiskKind = "ความเสี่ยง" | "โอกาส";
export const TREATMENTS = ["ลดความเสี่ยง", "ยอมรับ", "หลีกเลี่ยง", "ถ่ายโอน", "ใช้โอกาส"] as const;
export type Treatment = (typeof TREATMENTS)[number];

export type Task = { what: string; owner: string; due: string; doneOn?: string };

export type Risk = {
  no: string;
  kind: RiskKind;
  standards: Standard[];
  process: string;
  description: string;
  likelihood: number;
  impact: number;
  treatment: Treatment;
  owner: string;
  tasks: Task[];
  reviewedOn: string;
  /** ผลประเมินซ้ำหลังทำมาตรการครบ — ค่าที่ยังเหลืออยู่ */
  residual?: { likelihood: number; impact: number; date: string };
};

export const score = (r: { likelihood: number; impact: number }) => r.likelihood * r.impact;
export type Level = "สูง" | "กลาง" | "ต่ำ";
export const levelOf = (s: number): Level => (s >= 15 ? "สูง" : s >= 8 ? "กลาง" : "ต่ำ");
/** ค่าที่ใช้ตัดสินตอนนี้ — หลังประเมินซ้ำใช้ค่าคงเหลือ */
export const currentScore = (r: Risk) => score(r.residual ?? r);

export const RISKS: Risk[] = [
  {
    no: "RSK-001", kind: "ความเสี่ยง", standards: ["ISO 9001", "IATF 16949"], process: "การผลิต", owner: "ประสิทธิ์ ขยันยิ่ง",
    description: "เครื่องปั๊ม 200 ตันเสียนาน ส่งชิ้นส่วนยานยนต์ไม่ทันตามกำหนดของลูกค้า", likelihood: 3, impact: 5, treatment: "ลดความเสี่ยง", reviewedOn: "2026-06-15",
    tasks: [
      { what: "ทำสัญญาจ้างปั๊มสำรองกับโรงงานพันธมิตรที่ผ่านการประเมินแล้ว", owner: "ปิยะนุช ใจดี", due: "2026-08-31", doneOn: "2026-08-25" },
      { what: "สำรองอะไหล่วิกฤตของเครื่องปั๊มไว้ในคลัง", owner: "ประสิทธิ์ ขยันยิ่ง", due: "2026-10-15" },
    ],
  },
  {
    no: "RSK-002", kind: "ความเสี่ยง", standards: ["ISO 9001"], process: "การจัดซื้อ", owner: "ปิยะนุช ใจดี",
    description: "ผู้ขายเหล็กเส้นส่งของไม่ได้ขนาด ทำให้สายเชื่อมหยุดรอ", likelihood: 3, impact: 3, treatment: "ลดความเสี่ยง", reviewedOn: "2026-09-20",
    tasks: [{ what: "เพิ่มผู้ขายเหล็กเส้นรายที่สองในทะเบียนผู้ส่งมอบที่อนุมัติ", owner: "ปิยะนุช ใจดี", due: "2026-11-30" }],
  },
  {
    no: "RSK-003", kind: "ความเสี่ยง", standards: ["ISO 14001"], process: "พ่นสี", owner: "กาญจนา บุญมา",
    description: "ทินเนอร์หกรั่วไหลลงท่อระบายน้ำฝนระหว่างถ่ายถัง", likelihood: 2, impact: 4, treatment: "ลดความเสี่ยง", reviewedOn: "2026-05-10",
    tasks: [
      { what: "ติดตั้งถาดรองและชุดดูดซับสารเคมีที่จุดถ่ายถัง", owner: "กาญจนา บุญมา", due: "2026-06-30", doneOn: "2026-06-22" },
      { what: "ซ้อมแผนสารเคมีรั่วไหลกับทีมพ่นสี", owner: "กาญจนา บุญมา", due: "2026-07-31", doneOn: "2026-07-29" },
    ],
    residual: { likelihood: 1, impact: 4, date: "2026-08-05" },
  },
  {
    no: "RSK-004", kind: "โอกาส", standards: ["IATF 16949"], process: "การขาย", owner: "ชลธิชา มั่นคง",
    description: "รับงานชิ้นส่วนปั๊มขึ้นรูปให้ผู้ผลิตรถไฟฟ้าที่ย้ายฐานมาไทย", likelihood: 4, impact: 4, treatment: "ใช้โอกาส", reviewedOn: "2026-07-01",
    tasks: [
      { what: "ขอการรับรอง IATF 16949 ให้ทันรอบประมูลงานปีหน้า", owner: "นพดล ศรีวงศ์", due: "2026-12-31" },
      { what: "อบรม Core Tools ให้วิศวกรกระบวนการ", owner: "ธนพล เจริญผล", due: "2026-08-31", doneOn: "2026-08-14" },
    ],
  },
  {
    no: "RSK-005", kind: "ความเสี่ยง", standards: ["ISO 9001"], process: "การขาย", owner: "ชลธิชา มั่นคง",
    description: "ราคาเหล็กขึ้นระหว่างสัญญาราคาคงที่ กำไรขั้นต้นติดลบ", likelihood: 3, impact: 3, treatment: "ถ่ายโอน", reviewedOn: "2026-04-18",
    tasks: [{ what: "ใส่เงื่อนไขปรับราคาตามดัชนีเหล็กในสัญญาใหม่ทุกฉบับ", owner: "ชลธิชา มั่นคง", due: "2026-05-31", doneOn: "2026-05-20" }],
    residual: { likelihood: 2, impact: 2, date: "2026-06-10" },
  },
  {
    no: "RSK-006", kind: "โอกาส", standards: ["ISO 14001"], process: "พ่นสี", owner: "อนุชา ทองดี",
    description: "เปลี่ยนเป็นสีฝุ่นอบอุณหภูมิต่ำ ลดพลังงานเตาอบและกลิ่นรบกวนชุมชน", likelihood: 3, impact: 3, treatment: "ใช้โอกาส", reviewedOn: "2026-09-01",
    tasks: [],
  },
];

export const riskByNo = (no: string) => {
  const r = RISKS.find((x) => x.no === no);
  if (!r) throw new Error(`ไม่พบ ${no}`);
  return r;
};

export const nextRiskNo = () => nextNo(RISKS.map((r) => r.no), "RSK-", 3);
export const overdueTasks = (tasks: Task[]) => tasks.filter((t) => !t.doneOn && t.due < TODAY);

/** ความเสี่ยงสูงที่ยังไม่มีมาตรการค้างอยู่ — ผู้ตรวจประเมินถามข้อนี้ก่อนข้ออื่น */
export const unmanaged = () =>
  RISKS.filter((r) => r.kind === "ความเสี่ยง" && levelOf(currentScore(r)) === "สูง" && !r.tasks.some((t) => !t.doneOn));

export type RiskInput = Omit<Risk, "no" | "tasks" | "reviewedOn" | "residual">;

const in1to5 = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;

export function riskErrors(input: RiskInput): Errors {
  const e: Errors = {};
  if (input.standards.length === 0) e.standards = "เลือกมาตรฐานที่เกี่ยวข้อง";
  if (input.process.trim().length < 2) e.process = "ใส่กระบวนการ";
  if (input.description.trim().length < 10) e.description = "อธิบายว่าเกิดอะไรและกระทบอะไร";
  if (!in1to5(input.likelihood)) e.likelihood = "โอกาสเกิด 1–5";
  if (!in1to5(input.impact)) e.impact = "ผลกระทบ 1–5";
  if (!PEOPLE.includes(input.owner)) e.owner = "เลือกเจ้าของความเสี่ยง";
  if (input.kind === "โอกาส" && input.treatment !== "ใช้โอกาส") e.treatment = "โอกาสใช้การตอบสนองแบบใช้โอกาส";
  if (input.kind === "ความเสี่ยง" && input.treatment === "ใช้โอกาส") e.treatment = "เลือกวิธีจัดการความเสี่ยง";
  if (input.kind === "ความเสี่ยง" && input.treatment === "ยอมรับ" && levelOf(score(input)) === "สูง") e.treatment = "ความเสี่ยงระดับสูงยอมรับไม่ได้ ต้องลด หลีกเลี่ยง หรือถ่ายโอน";
  return e;
}

export function addRisk(input: RiskInput): Risk {
  assertValid(riskErrors(input));
  return commit(() => {
    const r: Risk = { ...input, no: nextRiskNo(), process: input.process.trim(), description: input.description.trim(), tasks: [], reviewedOn: TODAY };
    RISKS.push(r);
    return r;
  });
}

export function taskErrors(input: Task): Errors {
  const e: Errors = {};
  if (input.what.trim().length < 5) e.what = "บอกสิ่งที่ต้องทำ";
  if (!PEOPLE.includes(input.owner)) e.owner = "เลือกผู้รับผิดชอบ";
  if (!isDate(input.due)) e.due = "ใส่กำหนดเสร็จ";
  else if (input.due < TODAY) e.due = "กำหนดเสร็จต้องไม่ย้อนหลัง";
  return e;
}

export function addRiskTask(no: string, input: Task) {
  const r = riskByNo(no);
  assertValid(taskErrors(input));
  return commit(() => {
    r.tasks.push({ what: input.what.trim(), owner: input.owner, due: input.due });
    r.residual = undefined;
    return r;
  });
}

export function completeRiskTask(no: string, index: number, date = TODAY) {
  const r = riskByNo(no);
  const t = r.tasks[index];
  if (!t) throw new Error("ไม่พบมาตรการนี้");
  if (t.doneOn) throw new Error("มาตรการนี้ทำเสร็จแล้ว");
  return commit(() => {
    t.doneOn = date;
    return r;
  });
}

/** ประเมินซ้ำ (ข้อ 6.1.2) — ทำได้เมื่อมาตรการเสร็จครบ ค่าคงเหลือต้องไม่แย่กว่าเดิม */
export function reassessErrors(no: string, input: { likelihood: number; impact: number }): Errors {
  const r = riskByNo(no);
  const e: Errors = {};
  if (r.tasks.length === 0 || r.tasks.some((t) => !t.doneOn)) e.likelihood = "ทำมาตรการให้เสร็จครบก่อนประเมินซ้ำ";
  if (!in1to5(input.likelihood)) e.likelihood = "โอกาสเกิด 1–5";
  if (!in1to5(input.impact)) e.impact = "ผลกระทบ 1–5";
  return e;
}

export function reassessRisk(no: string, input: { likelihood: number; impact: number }, date = TODAY) {
  assertValid(reassessErrors(no, input));
  const r = riskByNo(no);
  return commit(() => {
    r.residual = { likelihood: input.likelihood, impact: input.impact, date };
    r.reviewedOn = date;
    return r;
  });
}

/* ================================================ policies and objectives */

export type Policy = {
  code: string;
  title: string;
  standards: Standard[];
  text: string[];
  rev: number;
  approvedOn: string;
  /** ผู้ที่รับทราบฉบับปัจจุบันแล้ว — ฉบับใหม่เริ่มนับใหม่ (ข้อ 7.3) */
  acknowledged: string[];
};

export const POLICIES: Policy[] = [
  {
    code: "POL-Q", title: "นโยบายคุณภาพ", standards: ["ISO 9001", "IATF 16949"], rev: 1, approvedOn: "2026-01-20",
    text: ["ส่งมอบสินค้าที่ตรงตามข้อกำหนดของลูกค้าและกฎหมาย ตรงเวลาทุกครั้ง", "ป้องกันของเสียที่ต้นเหตุด้วยข้อมูล ไม่ใช่ตรวจคัดที่ปลายทาง", "พัฒนาความสามารถของพนักงานและปรับปรุงระบบอย่างต่อเนื่อง"],
    acknowledged: ["วีระ ตั้งมั่น", "นพดล ศรีวงศ์", "สุภาพร แก้วมณี", "ธนพล เจริญผล", "ศักดิ์ชัย วงศ์ไทย", "อนุชา ทองดี", "ปิยะนุช ใจดี", "ชลธิชา มั่นคง", "วรวุฒิ พึ่งบุญ", "กาญจนา บุญมา"],
  },
  {
    code: "POL-E", title: "นโยบายสิ่งแวดล้อม", standards: ["ISO 14001"], rev: 0, approvedOn: "2025-03-02",
    text: ["ป้องกันมลพิษจากการพ่นสี เชื่อม และของเสียอันตรายทุกประเภท", "ปฏิบัติตามกฎหมายสิ่งแวดล้อมและพันธะที่รับไว้กับชุมชน", "ลดการใช้พลังงานและของเสียต่อหน่วยผลิตทุกปี"],
    acknowledged: ["วีระ ตั้งมั่น", "นพดล ศรีวงศ์", "อนุชา ทองดี", "มานพ รุ่งเรือง", "วรวุฒิ พึ่งบุญ", "กาญจนา บุญมา", "ประสิทธิ์ ขยันยิ่ง"],
  },
  {
    code: "POL-C", title: "นโยบายความรับผิดชอบองค์กรและต่อต้านการให้สินบน", standards: ["IATF 16949"], rev: 0, approvedOn: "2026-07-01",
    text: ["ไม่ให้ ไม่รับ และไม่เรียกสินบนหรือประโยชน์ใด ๆ เพื่อแลกกับการตัดสินใจทางธุรกิจ", "พนักงานแจ้งเบาะแสได้โดยไม่ถูกลงโทษ ผ่านช่องทางที่ไม่ต้องผ่านหัวหน้าโดยตรง", "ผู้บริหารทุกระดับเป็นแบบอย่างตามจรรยาบรรณของบริษัท"],
    acknowledged: ["วีระ ตั้งมั่น", "นพดล ศรีวงศ์", "ธนพล เจริญผล", "ปิยะนุช ใจดี", "ชลธิชา มั่นคง"],
  },
];

export const policyByCode = (code: string) => {
  const p = POLICIES.find((x) => x.code === code);
  if (!p) throw new Error(`ไม่พบนโยบาย ${code}`);
  return p;
};

/** ทุกคนในทะเบียนต้องรับทราบนโยบายของมาตรฐานที่ตัวเองเกี่ยวข้อง — ในเดโมคือทุกคน */
export const awareness = (p: Policy) => rate(p.acknowledged.length, STAFF.length);

export function acknowledgePolicy(code: string, name: string) {
  const p = policyByCode(code);
  if (!PEOPLE.includes(name)) throw new Error("เลือกผู้รับทราบ");
  if (p.acknowledged.includes(name)) throw new Error(`${name} รับทราบ ${p.title} ฉบับนี้แล้ว`);
  return commit(() => {
    p.acknowledged.push(name);
    return p;
  });
}

/** ออกนโยบายฉบับใหม่ — อนุมัติได้เฉพาะผู้บริหารสูงสุด และทุกคนต้องรับทราบใหม่ */
export function revisePolicy(code: string, text: string[], by: string, date = TODAY) {
  const p = policyByCode(code);
  if (by !== TOP) throw new Error(`นโยบายต้องอนุมัติโดย ${TOP} (ผู้บริหารสูงสุด)`);
  const lines = text.map((t) => t.trim()).filter((t) => t.length > 0);
  if (lines.length < 2) throw new Error("นโยบายต้องมีอย่างน้อยสองข้อ");
  return commit(() => {
    p.text = lines;
    p.rev += 1;
    p.approvedOn = date;
    p.acknowledged = [by];
    return p;
  });
}

export type ObjectiveResult = { month: string; value: number };

export type Objective = {
  id: number;
  std: Standard;
  dept: Department;
  name: string;
  target: number;
  unit: string;
  better: "higher" | "lower";
  /** แผนบรรลุ (ข้อ 6.2.2) — ทำอะไร ใช้อะไร ใครรับผิดชอบ */
  plan: string;
  owner: string;
  results: ObjectiveResult[];
};

const months = (values: number[]) => values.map((value, i) => ({ month: addMonths("2026-04-01", i).slice(0, 7), value }));

export const OBJECTIVES: Objective[] = [
  { id: 1, std: "ISO 9001", dept: "ฝ่ายผลิต", name: "ของเสียในกระบวนการผลิต", target: 1.5, unit: "%", better: "lower", owner: "อนุชา ทองดี", plan: "ตรวจงานชิ้นแรกทุกกะ และทบทวน NCR ระหว่างผลิตทุกสัปดาห์", results: months([2.1, 1.9, 1.7, 1.6, 1.4]) },
  { id: 2, std: "ISO 9001", dept: "ฝ่ายขาย", name: "ส่งมอบตรงเวลา", target: 95, unit: "%", better: "higher", owner: "ชลธิชา มั่นคง", plan: "ยืนยันวันส่งจากแผนผลิตก่อนรับคำสั่งซื้อ", results: months([93, 94, 96, 95, 97]) },
  { id: 3, std: "ISO 9001", dept: "ฝ่ายจัดซื้อ", name: "ล็อตวัตถุดิบผ่านการตรวจรับ", target: 95, unit: "%", better: "higher", owner: "ปิยะนุช ใจดี", plan: "ประเมินผู้ส่งมอบรายไตรมาสและแจ้งผลให้ผู้ขาย", results: months([96, 97, 94, 92, 90]) },
  { id: 4, std: "ISO 14001", dept: "ฝ่ายผลิต", name: "ไฟฟ้าต่อชิ้นงานพ่นสี", target: 1.8, unit: "kWh/ชิ้น", better: "lower", owner: "มานพ รุ่งเรือง", plan: "ปิดเตาอบช่วงพัก ตั้งอุณหภูมิตาม WI-03", results: months([2.2, 2.1, 2.0, 1.9, 1.9]) },
  { id: 5, std: "ISO 14001", dept: "ฝ่ายความปลอดภัยและสิ่งแวดล้อม", name: "ของเสียอันตรายต่อเดือน", target: 450, unit: "กก.", better: "lower", owner: "กาญจนา บุญมา", plan: "กรองทินเนอร์ใช้ซ้ำ แยกกากสีก่อนส่งกำจัด", results: months([520, 505, 470, 455, 430]) },
  { id: 6, std: "IATF 16949", dept: "ฝ่ายประกันคุณภาพ", name: "ของเสียที่ลูกค้ายานยนต์พบ", target: 50, unit: "PPM", better: "lower", owner: "ธนพล เจริญผล", plan: "ตรวจ 100% ช่วงเปิดตัวสินค้าใหม่จนกว่า Cpk ≥ 1.67", results: [] },
  { id: 7, std: "IATF 16949", dept: "ฝ่ายซ่อมบำรุง", name: "ประสิทธิผลโดยรวมของเครื่องจักรหลัก (OEE)", target: 75, unit: "%", better: "higher", owner: "ประสิทธิ์ ขยันยิ่ง", plan: "PM ตามแผนและบำรุงรักษาด้วยตนเองทุกกะ", results: months([68, 70, 71, 73, 74]) },
];

export const objectiveById = (id: number) => {
  const o = OBJECTIVES.find((x) => x.id === id);
  if (!o) throw new Error("ไม่พบวัตถุประสงค์นี้");
  return o;
};

export const latestOf = (o: Objective) => o.results[o.results.length - 1];
export const metNow = (o: Objective) => {
  const l = latestOf(o);
  if (!l) return undefined;
  return o.better === "higher" ? l.value >= o.target : l.value <= o.target;
};

export function resultErrors(id: number, input: ObjectiveResult): Errors {
  const o = objectiveById(id);
  const e: Errors = {};
  if (!/^\d{4}-\d{2}$/.test(input.month)) e.month = "เลือกเดือน";
  else if (input.month > TODAY.slice(0, 7)) e.month = "บันทึกผลล่วงหน้าไม่ได้";
  else if (o.results.some((r) => r.month === input.month)) e.month = "เดือนนี้บันทึกผลแล้ว";
  if (!Number.isFinite(input.value) || input.value < 0) e.value = "ใส่ผลที่วัดได้";
  return e;
}

export function recordObjectiveResult(id: number, input: ObjectiveResult) {
  assertValid(resultErrors(id, input));
  const o = objectiveById(id);
  return commit(() => {
    o.results.push({ month: input.month, value: input.value });
    o.results.sort((a, b) => a.month.localeCompare(b.month));
    return o;
  });
}

export type ObjectiveInput = Omit<Objective, "id" | "results">;

export function objectiveErrors(input: ObjectiveInput): Errors {
  const e: Errors = {};
  if (input.name.trim().length < 5) e.name = "ใส่สิ่งที่วัด";
  if (!Number.isFinite(input.target) || input.target <= 0) e.target = "ใส่เป้าหมายที่วัดได้";
  if (input.unit.trim().length < 1) e.unit = "ใส่หน่วย";
  if (input.plan.trim().length < 10) e.plan = "บอกว่าจะทำอะไรเพื่อให้ถึงเป้า (ข้อ 6.2.2)";
  if (!PEOPLE.includes(input.owner)) e.owner = "เลือกผู้รับผิดชอบ";
  return e;
}

export function addObjective(input: ObjectiveInput) {
  assertValid(objectiveErrors(input));
  return commit(() => {
    const o: Objective = { ...input, id: Math.max(0, ...OBJECTIVES.map((x) => x.id)) + 1, name: input.name.trim(), plan: input.plan.trim(), unit: input.unit.trim(), results: [] };
    OBJECTIVES.push(o);
    return o;
  });
}

/* ============================================================= documents */

/** โครงสร้างเอกสารสี่ระดับของระบบบูรณาการ — ระเบียบกลางใช้ร่วมกันทุกมาตรฐาน */
export const DOC_LEVELS = ["คู่มือระบบ", "ระเบียบปฏิบัติ", "วิธีการทำงาน", "แบบฟอร์ม"] as const;
export type DocLevel = (typeof DOC_LEVELS)[number];

const DOC_PREFIX: Record<DocLevel, string> = {
  "คู่มือระบบ": "IM-",
  "ระเบียบปฏิบัติ": "SP-",
  "วิธีการทำงาน": "WI-",
  "แบบฟอร์ม": "FM-",
};

export const levelNo = (l: DocLevel) => DOC_LEVELS.indexOf(l) + 1;

export type DocStatus = "ร่าง" | "รออนุมัติ" | "ใช้งาน" | "ยกเลิก";
export type DocRevision = { rev: number; date: string; change: string; by: string; approvedBy: string };
/** ฉบับที่กำลังเขียนหรือรออนุมัติ — ฉบับที่ใช้อยู่ยังใช้ต่อจนกว่าฉบับนี้จะอนุมัติ */
export type DocDraft = { rev: number; change: string; by: string; date: string; submitted: boolean };

export type ControlledDoc = {
  code: string;
  title: string;
  level: DocLevel;
  standards: Standard[];
  owner: Department;
  /** ฉบับที่ใช้อยู่ — -1 คือยังไม่เคยอนุมัติฉบับไหน */
  rev: number;
  status: DocStatus;
  effective?: string;
  /** ทบทวนความเหมาะสมทุกปี (ข้อ 7.5.2) */
  reviewDue?: string;
  draft?: DocDraft;
  history: DocRevision[];
  obsoleteReason?: string;
};

/** ทุกฉบับถูกทบทวนในการประชุมทบทวนโดยฝ่ายบริหารเมื่อ 2026-01-20 ยกเว้นที่ออกฉบับใหม่หลังจากนั้น */
const LAST_REVIEW = "2026-01-20";

const AUTHOR: Record<string, string> = {
  "ฝ่ายผลิต": "อนุชา ทองดี",
  "ฝ่ายวิศวกรรม": "ศักดิ์ชัย วงศ์ไทย",
  "ฝ่ายซ่อมบำรุง": "ประสิทธิ์ ขยันยิ่ง",
  "ฝ่ายความปลอดภัยและสิ่งแวดล้อม": "กาญจนา บุญมา",
  "ฝ่ายจัดซื้อ": "ปิยะนุช ใจดี",
  "ฝ่ายคลังสินค้า": "วรวุฒิ พึ่งบุญ",
  "ฝ่ายขาย": "ชลธิชา มั่นคง",
};

const issued = (
  code: string, title: string, level: DocLevel, standards: Standard[], owner: Department, revs: [string, string][], reviewed = LAST_REVIEW,
): ControlledDoc => {
  const by = AUTHOR[owner] ?? "สุภาพร แก้วมณี";
  // เอกสารระดับหนึ่งและนโยบายอนุมัติโดยผู้บริหารสูงสุด ที่เหลืออนุมัติโดยผู้แทนฝ่ายบริหาร
  const approver = level === "คู่มือระบบ" ? TOP : standards.length === 1 && standards[0] === "ISO 14001" ? EMR : QMR;
  const history = revs.map(([date, change], i) => ({ rev: i, date, change, by, approvedBy: approver }));
  const last = history[history.length - 1];
  const since = last.date > reviewed ? last.date : reviewed;
  return { code, title, level, standards, owner, rev: last.rev, status: "ใช้งาน", effective: last.date, reviewDue: addMonths(since, 12), history };
};

const ALL: Standard[] = ["ISO 9001", "ISO 14001", "IATF 16949"];
const QA: Standard[] = ["ISO 9001", "IATF 16949"];
const ENV: Standard[] = ["ISO 14001"];
const AUTO: Standard[] = ["IATF 16949"];
const FIRST = "ออกใช้ครั้งแรก";

export const DOCUMENTS: ControlledDoc[] = [
  issued("IM-01", "คู่มือระบบบริหารบูรณาการ", "คู่มือระบบ", ALL, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST], ["2025-11-03", "รวมระบบสิ่งแวดล้อมเข้าคู่มือเดียว"], ["2026-07-01", "เพิ่มขอบเขต IATF 16949 และ support site"]]),
  issued("SP-01", "การควบคุมเอกสารสารสนเทศ", "ระเบียบปฏิบัติ", ALL, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST]]),
  issued("SP-02", "การประเมินความเสี่ยงและโอกาส", "ระเบียบปฏิบัติ", ALL, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST]]),
  issued("SP-03", "การตรวจติดตามภายใน", "ระเบียบปฏิบัติ", ALL, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST], ["2026-02-10", "เพิ่มการตรวจกระบวนการและผลิตภัณฑ์ตาม IATF"]]),
  issued("SP-04", "การแก้ไขและการแก้ปัญหา (CAR และ 8D)", "ระเบียบปฏิบัติ", ALL, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST], ["2026-07-01", "เพิ่มรูปแบบ 8D สำหรับลูกค้ายานยนต์"]]),
  issued("SP-05", "การทบทวนโดยฝ่ายบริหาร", "ระเบียบปฏิบัติ", ALL, "ฝ่ายบริหาร", [["2025-01-15", FIRST]]),
  issued("SP-06", "การฝึกอบรมและความสามารถ", "ระเบียบปฏิบัติ", ALL, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST], ["2026-02-10", "เพิ่มเกณฑ์ผู้ตรวจติดตามตาม IATF 7.2.3"]]),
  issued("SP-07", "การจัดซื้อและการประเมินผู้ส่งมอบ", "ระเบียบปฏิบัติ", QA, "ฝ่ายจัดซื้อ", [["2025-01-15", FIRST], ["2026-08-12", "ต้องประเมินผู้ขายใหม่ก่อนสั่งซื้อครั้งแรก"]]),
  issued("SP-08", "การควบคุมผลลัพธ์ที่ไม่เป็นไปตามข้อกำหนด", "ระเบียบปฏิบัติ", QA, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST]]),
  issued("SP-09", "การตรวจรับและตรวจปล่อยผลิตภัณฑ์", "ระเบียบปฏิบัติ", QA, "ฝ่ายประกันคุณภาพ", [["2025-02-01", FIRST], ["2025-10-07", "เพิ่มแผนสุ่มตัวอย่างตามขนาดล็อต"]], "2025-10-07"),
  issued("SP-10", "การสอบเทียบและการวิเคราะห์ระบบการวัด", "ระเบียบปฏิบัติ", QA, "ฝ่ายประกันคุณภาพ", [["2025-02-01", FIRST]]),
  issued("SP-11", "การทบทวนข้อกำหนดและความพึงพอใจของลูกค้า", "ระเบียบปฏิบัติ", QA, "ฝ่ายขาย", [["2025-02-01", FIRST]]),
  issued("SP-12", "การออกแบบและพัฒนาผลิตภัณฑ์", "ระเบียบปฏิบัติ", ["ISO 9001"], "ฝ่ายวิศวกรรม", [["2025-02-01", FIRST]]),
  issued("SP-13", "การประเมินประเด็นสิ่งแวดล้อม", "ระเบียบปฏิบัติ", ENV, "ฝ่ายความปลอดภัยและสิ่งแวดล้อม", [["2025-03-02", FIRST]]),
  issued("SP-14", "การติดตามและประเมินความสอดคล้องกับกฎหมาย", "ระเบียบปฏิบัติ", ENV, "ฝ่ายความปลอดภัยและสิ่งแวดล้อม", [["2025-03-02", FIRST]]),
  issued("SP-15", "การจัดการของเสียและสารเคมี", "ระเบียบปฏิบัติ", ENV, "ฝ่ายความปลอดภัยและสิ่งแวดล้อม", [["2025-03-02", FIRST]]),
  issued("SP-16", "การเตรียมพร้อมและตอบสนองเหตุฉุกเฉิน", "ระเบียบปฏิบัติ", ["ISO 14001", "IATF 16949"], "ฝ่ายความปลอดภัยและสิ่งแวดล้อม", [["2025-03-02", FIRST], ["2026-07-01", "รวมแผนฉุกเฉินทางธุรกิจตาม IATF 6.1.2.3"]]),
  issued("SP-17", "การวางแผนคุณภาพผลิตภัณฑ์ (APQP) และ PPAP", "ระเบียบปฏิบัติ", AUTO, "ฝ่ายวิศวกรรม", [["2026-07-01", FIRST]]),
  issued("SP-18", "FMEA และแผนควบคุม", "ระเบียบปฏิบัติ", AUTO, "ฝ่ายวิศวกรรม", [["2026-07-01", FIRST]]),
  issued("SP-19", "การควบคุมกระบวนการเชิงสถิติ (SPC)", "ระเบียบปฏิบัติ", AUTO, "ฝ่ายประกันคุณภาพ", [["2026-07-01", FIRST]]),
  issued("SP-20", "การบำรุงรักษาเชิงป้องกันแบบทั่วถึง (TPM)", "ระเบียบปฏิบัติ", AUTO, "ฝ่ายซ่อมบำรุง", [["2026-07-01", FIRST]]),
  issued("SP-21", "ความปลอดภัยของผลิตภัณฑ์และข้อกำหนดเฉพาะลูกค้า", "ระเบียบปฏิบัติ", AUTO, "ฝ่ายประกันคุณภาพ", [["2026-07-01", FIRST]]),
  issued("WI-01", "วิธีการเชื่อมโครงชั้นวาง", "วิธีการทำงาน", ["ISO 9001"], "ฝ่ายผลิต", [["2025-03-12", FIRST], ["2026-06-20", "เปลี่ยนลวดเชื่อมเป็น ER70S-6"]]),
  issued("WI-02", "การวัดความหนาเหล็กแผ่นและเหล็กเส้น", "วิธีการทำงาน", QA, "ฝ่ายประกันคุณภาพ", [["2025-03-12", FIRST]]),
  issued("WI-04", "การถ่ายและจัดเก็บทินเนอร์และกากสี", "วิธีการทำงาน", ENV, "ฝ่ายความปลอดภัยและสิ่งแวดล้อม", [["2025-03-02", FIRST], ["2026-06-22", "เพิ่มถาดรองและชุดดูดซับที่จุดถ่ายถัง"]]),
  // แบบฟอร์มที่ระบบพิมพ์ออกมา — เลขที่มุมกระดาษอ่านฉบับจากบัญชีนี้ แก้ฟอร์มแล้วใบที่พิมพ์เปลี่ยนตาม
  issued("FM-01", "บัญชีรายชื่อเอกสารควบคุม", "แบบฟอร์ม", ALL, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST]]),
  issued("FM-02", "ใบรายงานผลการตรวจสอบ", "แบบฟอร์ม", QA, "ฝ่ายประกันคุณภาพ", [["2025-02-01", FIRST], ["2025-10-07", "เพิ่มช่องจำนวนตัวอย่างตามขนาดล็อต"]], "2025-10-07"),
  issued("FM-03", "ใบรับรองคุณภาพสินค้า", "แบบฟอร์ม", QA, "ฝ่ายประกันคุณภาพ", [["2025-02-01", FIRST]], "2025-10-07"),
  issued("FM-04", "ใบรายงานสิ่งที่ไม่เป็นไปตามข้อกำหนด", "แบบฟอร์ม", QA, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST]]),
  issued("FM-05", "ใบขอให้ดำเนินการแก้ไขและป้องกัน", "แบบฟอร์ม", ALL, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST]]),
  issued("FM-06", "รายงานการตรวจติดตามภายใน", "แบบฟอร์ม", ALL, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST], ["2026-02-10", "เพิ่มช่องระดับของสิ่งที่พบ"]]),
  issued("FM-07", "บันทึกประวัติการสอบเทียบเครื่องมือวัด", "แบบฟอร์ม", QA, "ฝ่ายประกันคุณภาพ", [["2025-02-01", FIRST]]),
  issued("FM-08", "ทะเบียนความเสี่ยงและโอกาส", "แบบฟอร์ม", ALL, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST]]),
  issued("FM-09", "บันทึกประวัติการฝึกอบรมรายบุคคล", "แบบฟอร์ม", ALL, "ฝ่ายประกันคุณภาพ", [["2025-01-15", FIRST]]),
  issued("FM-10", "รายงานการประชุมทบทวนโดยฝ่ายบริหาร", "แบบฟอร์ม", ALL, "ฝ่ายบริหาร", [["2025-01-15", FIRST]]),
  issued("FM-11", "รายงานการแก้ปัญหา 8D", "แบบฟอร์ม", AUTO, "ฝ่ายประกันคุณภาพ", [["2026-07-01", FIRST]]),
  issued("FM-12", "ใบทบทวนข้อกำหนดลูกค้า", "แบบฟอร์ม", QA, "ฝ่ายขาย", [["2025-02-01", FIRST]]),
  issued("FM-13", "บันทึกการออกแบบและพัฒนา", "แบบฟอร์ม", ["ISO 9001"], "ฝ่ายวิศวกรรม", [["2025-02-01", FIRST]]),
  issued("FM-14", "ใบประเมินผู้ส่งมอบประจำปี", "แบบฟอร์ม", QA, "ฝ่ายจัดซื้อ", [["2025-01-15", FIRST]]),
  issued("FM-15", "สรุปผลสำรวจความพึงพอใจลูกค้า", "แบบฟอร์ม", QA, "ฝ่ายขาย", [["2025-01-15", FIRST]]),
  {
    code: "WI-03", title: "วิธีการพ่นสีฝุ่นและอบ", level: "วิธีการทำงาน", standards: ["ISO 9001", "ISO 14001"], owner: "ฝ่ายผลิต",
    rev: -1, status: "รออนุมัติ", history: [],
    draft: { rev: 0, change: "ออกใช้ครั้งแรก — กำหนดอุณหภูมิอบ 200°C 15 นาที", by: "อนุชา ทองดี", date: "2026-09-18", submitted: true },
  },
];

export const docByCode = (code: string) => {
  const d = DOCUMENTS.find((x) => x.code === code);
  if (!d) throw new Error(`ไม่พบเอกสาร ${code}`);
  return d;
};

export const revLabel = (rev: number) => (rev < 0 ? "—" : `Rev.${String(rev).padStart(2, "0")}`);

/** เลขแบบฟอร์มที่มุมกระดาษ อ่านฉบับจากบัญชีรายชื่อเอกสาร จึงตรงกับที่ผู้ตรวจประเมินเทียบเสมอ */
export const formNo = (code: string) => `${code} ${revLabel(docByCode(code).rev)}`;

/** เอกสารที่ถึงรอบทบทวนภายใน 30 วัน หรือเลยรอบมาแล้ว */
export const reviewDue = () => DOCUMENTS.filter((d) => d.status === "ใช้งาน" && d.reviewDue && d.reviewDue <= addDays(TODAY, 30));
export const awaitingApproval = () => DOCUMENTS.filter((d) => d.draft?.submitted);

export type DocInput = { level: DocLevel; title: string; standards: Standard[]; owner: Department; by: string; change: string };

export function docErrors(input: DocInput): Errors {
  const e: Errors = {};
  if (input.title.trim().length < 4) e.title = "ใส่ชื่อเอกสาร";
  else if (DOCUMENTS.some((d) => d.status !== "ยกเลิก" && d.title === input.title.trim())) e.title = "มีเอกสารชื่อนี้ใช้อยู่แล้ว";
  if (input.standards.length === 0) e.standards = "เลือกมาตรฐานที่เอกสารนี้รองรับ";
  if (!DEPARTMENTS.includes(input.owner)) e.owner = "เลือกฝ่ายเจ้าของเอกสาร";
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้จัดทำ";
  return e;
}

export const nextDocCode = (level: DocLevel) => {
  const prefix = DOC_PREFIX[level];
  const nums = DOCUMENTS.filter((d) => d.code.startsWith(prefix)).map((d) => Number(d.code.slice(prefix.length)));
  return `${prefix}${String(Math.max(0, ...nums) + 1).padStart(2, "0")}`;
};

export function createDocument(input: DocInput): ControlledDoc {
  assertValid(docErrors(input));
  return commit(() => {
    const d: ControlledDoc = {
      code: nextDocCode(input.level), title: input.title.trim(), level: input.level, standards: [...input.standards], owner: input.owner,
      rev: -1, status: "ร่าง", history: [],
      draft: { rev: 0, change: input.change.trim() || FIRST, by: input.by, date: TODAY, submitted: false },
    };
    DOCUMENTS.push(d);
    return d;
  });
}

export function submitDocument(code: string) {
  const d = docByCode(code);
  if (!d.draft || d.draft.submitted) throw new Error(`${code} ไม่มีฉบับร่างที่รอส่ง`);
  return commit(() => {
    d.draft!.submitted = true;
    if (d.rev < 0) d.status = "รออนุมัติ";
    return d;
  });
}

/** อนุมัติก่อนออกใช้ (ข้อ 7.5.2) — ผู้อนุมัติต้องไม่ใช่คนเขียน คู่มือระดับหนึ่งอนุมัติโดยผู้บริหารสูงสุด */
export function approveDocument(code: string, approver: string, date = TODAY) {
  const d = docByCode(code);
  if (!d.draft?.submitted) throw new Error(`${code} ไม่มีฉบับที่รออนุมัติ`);
  if (approver === d.draft.by) throw new Error("ผู้อนุมัติต้องไม่ใช่ผู้จัดทำเอกสาร");
  if (!PEOPLE.includes(approver)) throw new Error("เลือกผู้อนุมัติ");
  if (d.level === "คู่มือระบบ" && approver !== TOP) throw new Error(`คู่มือระบบต้องอนุมัติโดย ${TOP}`);
  const draft = d.draft;
  return commit(() => {
    d.history.push({ rev: draft.rev, date, change: draft.change, by: draft.by, approvedBy: approver });
    d.rev = draft.rev;
    d.status = "ใช้งาน";
    d.effective = date;
    d.reviewDue = addMonths(date, 12);
    d.draft = undefined;
    return d;
  });
}

/** ส่งฉบับกลับไปแก้ — ฉบับที่ใช้อยู่ไม่เปลี่ยน */
export function returnDocument(code: string) {
  const d = docByCode(code);
  if (!d.draft?.submitted) throw new Error(`${code} ไม่มีฉบับที่รออนุมัติ`);
  return commit(() => {
    d.draft!.submitted = false;
    if (d.rev < 0) d.status = "ร่าง";
    return d;
  });
}

export function reviseDocument(code: string, change: string, by: string) {
  const d = docByCode(code);
  if (d.status !== "ใช้งาน") throw new Error(`${code} ${d.status} แก้ไขฉบับใหม่ไม่ได้`);
  if (d.draft) throw new Error(`${code} มีฉบับแก้ไข ${revLabel(d.draft.rev)} ค้างอยู่แล้ว`);
  if (change.trim().length < 5) throw new Error("บอกว่าแก้อะไร อย่างน้อยหนึ่งประโยค");
  if (!PEOPLE.includes(by)) throw new Error("เลือกผู้จัดทำ");
  return commit(() => {
    d.draft = { rev: d.rev + 1, change: change.trim(), by, date: TODAY, submitted: false };
    return d;
  });
}

/** ทบทวนแล้วยังเหมาะสม — ต่อรอบทบทวนอีกหนึ่งปี ไม่ออกฉบับใหม่ */
export function confirmReview(code: string, date = TODAY) {
  const d = docByCode(code);
  if (d.status !== "ใช้งาน") throw new Error(`${code} ไม่ได้ใช้งานอยู่`);
  return commit(() => {
    d.reviewDue = addMonths(date, 12);
    return d;
  });
}

export function obsoleteDocument(code: string, reason: string) {
  const d = docByCode(code);
  if (d.status === "ยกเลิก") throw new Error(`${code} ยกเลิกไปแล้ว`);
  if (reason.trim().length < 5) throw new Error("ใส่เหตุผลที่ยกเลิก");
  return commit(() => {
    d.status = "ยกเลิก";
    d.obsoleteReason = reason.trim();
    d.draft = undefined;
    return d;
  });
}

/* ============================================================== training */

export type Attendee = { name: string; result?: "ผ่าน" | "ไม่ผ่าน" };

export type Training = {
  no: string;
  course: CourseCode;
  date: string;
  hours: number;
  trainer: string;
  attendees: Attendee[];
  status: "ตามแผน" | "บันทึกผลแล้ว";
  /** ประเมินประสิทธิผล (ข้อ 7.2 ค) — โดยหัวหน้างาน ไม่ใช่วิทยากร */
  evaluation?: { date: string; effective: boolean; note: string; by: string };
};

const done = (names: string[], failed: string[] = []): Attendee[] => [
  ...names.map((name) => ({ name, result: "ผ่าน" as const })),
  ...failed.map((name) => ({ name, result: "ไม่ผ่าน" as const })),
];

export const TRAININGS: Training[] = [
  { no: "TRN-2568-004", course: "TR-01", date: "2025-02-11", hours: 6, trainer: "สถาบันพัฒนาคุณภาพ", status: "บันทึกผลแล้ว", attendees: done(["วีระ ตั้งมั่น", "นพดล ศรีวงศ์", "สุภาพร แก้วมณี", "อนุชา ทองดี", "ปิยะนุช ใจดี", "วรวุฒิ พึ่งบุญ", "ชลธิชา มั่นคง", "สมปอง ใจกล้า", "มานพ รุ่งเรือง", "ประสิทธิ์ ขยันยิ่ง"]), evaluation: { date: "2025-05-12", effective: true, note: "สุ่มถามพนักงานเรื่องนโยบายและวัตถุประสงค์ ตอบได้ 9 ใน 10", by: QMR } },
  { no: "TRN-2568-005", course: "TR-02", date: "2025-03-04", hours: 12, trainer: "สถาบันพัฒนาคุณภาพ", status: "บันทึกผลแล้ว", attendees: done(["นพดล ศรีวงศ์", "สุภาพร แก้วมณี", "อนุชา ทองดี", "ปิยะนุช ใจดี", "ชลธิชา มั่นคง"]), evaluation: { date: "2025-07-10", effective: true, note: "ผู้ผ่านอบรมตรวจติดตามรอบแรกได้ครบตามแผน รายงานเขียนตามข้อกำหนด", by: QMR } },
  { no: "TRN-2568-009", course: "TR-03", date: "2025-04-22", hours: 12, trainer: "สมาคมสิ่งแวดล้อมอุตสาหกรรม", status: "บันทึกผลแล้ว", attendees: done(["กาญจนา บุญมา", "นพดล ศรีวงศ์"]) },
  { no: "TRN-2568-012", course: "TR-07", date: "2025-06-17", hours: 3, trainer: "กาญจนา บุญมา", status: "บันทึกผลแล้ว", attendees: done(["วรวุฒิ พึ่งบุญ", "กาญจนา บุญมา"], ["มานพ รุ่งเรือง"]) },
  { no: "TRN-2568-015", course: "TR-10", date: "2025-08-20", hours: 3, trainer: "สถานีดับเพลิงในพื้นที่", status: "บันทึกผลแล้ว", attendees: done(["อนุชา ทองดี", "สมปอง ใจกล้า", "มานพ รุ่งเรือง", "ประสิทธิ์ ขยันยิ่ง", "วรวุฒิ พึ่งบุญ", "กาญจนา บุญมา"]) },
  { no: "TRN-2568-018", course: "TR-08", date: "2024-10-30", hours: 8, trainer: "สถาบันเชื่อมแห่งประเทศไทย", status: "บันทึกผลแล้ว", attendees: done(["สมปอง ใจกล้า"]) },
  { no: "TRN-2568-021", course: "TR-01", date: "2025-11-20", hours: 6, trainer: "นพดล ศรีวงศ์", status: "บันทึกผลแล้ว", attendees: done(["ศักดิ์ชัย วงศ์ไทย", "กาญจนา บุญมา", "ธนพล เจริญผล"]) },
  { no: "TRN-2569-001", course: "TR-10", date: "2026-02-18", hours: 3, trainer: "สถานีดับเพลิงในพื้นที่", status: "บันทึกผลแล้ว", attendees: done(["อนุชา ทองดี", "สมปอง ใจกล้า", "ประสิทธิ์ ขยันยิ่ง", "วรวุฒิ พึ่งบุญ", "กาญจนา บุญมา"]) },
  { no: "TRN-2569-002", course: "TR-12", date: "2026-07-08", hours: 2, trainer: "วีระ ตั้งมั่น", status: "บันทึกผลแล้ว", attendees: done(["วีระ ตั้งมั่น", "นพดล ศรีวงศ์", "สุภาพร แก้วมณี", "ธนพล เจริญผล", "ศักดิ์ชัย วงศ์ไทย", "อนุชา ทองดี", "ปิยะนุช ใจดี", "ชลธิชา มั่นคง", "กาญจนา บุญมา"]) },
  { no: "TRN-2569-003", course: "TR-05", date: "2026-08-14", hours: 18, trainer: "สถาบันยานยนต์", status: "บันทึกผลแล้ว", attendees: done(["ธนพล เจริญผล", "ศักดิ์ชัย วงศ์ไทย", "นพดล ศรีวงศ์"]), evaluation: { date: "2026-09-15", effective: true, note: "จัดทำ PFMEA และแผนควบคุมชิ้นส่วนแรกได้เองโดยไม่ต้องจ้างที่ปรึกษา", by: QMR } },
  { no: "TRN-2569-004", course: "TR-04", date: "2026-08-26", hours: 16, trainer: "สถาบันยานยนต์", status: "บันทึกผลแล้ว", attendees: done(["ธนพล เจริญผล"]) },
  { no: "TRN-2569-005", course: "TR-06", date: "2026-09-02", hours: 4, trainer: "ธนพล เจริญผล", status: "บันทึกผลแล้ว", attendees: done(["ธนพล เจริญผล", "นพดล ศรีวงศ์"]) },
  { no: "TRN-2569-006", course: "TR-02", date: "2026-09-09", hours: 12, trainer: "สถาบันพัฒนาคุณภาพ", status: "บันทึกผลแล้ว", attendees: done(["ธนพล เจริญผล"]) },
  { no: "TRN-2569-007", course: "TR-09", date: "2026-03-18", hours: 4, trainer: "สุภาพร แก้วมณี", status: "บันทึกผลแล้ว", attendees: done(["สุภาพร แก้วมณี"]) },
  { no: "TRN-2569-008", course: "TR-11", date: "2026-10-14", hours: 6, trainer: "ที่ปรึกษา TPM", status: "ตามแผน", attendees: [{ name: "ประสิทธิ์ ขยันยิ่ง" }, { name: "อนุชา ทองดี" }] },
  { no: "TRN-2569-009", course: "TR-07", date: "2026-09-22", hours: 3, trainer: "กาญจนา บุญมา", status: "ตามแผน", attendees: [{ name: "มานพ รุ่งเรือง" }] },
];

export const trainingByNo = (no: string) => {
  const t = TRAININGS.find((x) => x.no === no);
  if (!t) throw new Error(`ไม่พบ ${no}`);
  return t;
};

/** วันหมดอายุของความสามารถที่ได้จากการอบรมครั้งนั้น — ไม่มีคือไม่หมดอายุ */
const expiryOf = (t: Training) => {
  const years = validYears(t.course);
  return years ? addMonths(t.date, years * 12) : undefined;
};

export type Qualification = { course: CourseCode; since: string; until?: string; training: string };

/** ความสามารถที่ยังใช้ได้ของคนหนึ่งคน — จากผลอบรมที่ผ่าน และยังไม่หมดอายุ */
export function qualificationsOf(name: string, on = TODAY): Qualification[] {
  const best = new Map<CourseCode, Qualification>();
  for (const t of TRAININGS) {
    if (t.status !== "บันทึกผลแล้ว" || t.date > on) continue;
    if (!t.attendees.some((a) => a.name === name && a.result === "ผ่าน")) continue;
    const until = expiryOf(t);
    if (until && until < on) continue;
    const prev = best.get(t.course);
    if (!prev || prev.since < t.date) best.set(t.course, { course: t.course, since: t.date, until, training: t.no });
  }
  return [...best.values()];
}

export const isQualified = (name: string, course: CourseCode, on = TODAY) => qualificationsOf(name, on).some((q) => q.course === course);

/** หลักสูตรที่ตำแหน่งต้องมีแต่ยังไม่มี หรือหมดอายุแล้ว — ความต้องการฝึกอบรม */
export const gapsOf = (name: string) => (personOf(name)?.requires ?? []).filter((c) => !isQualified(name, c));

/** ใบรับรองที่จะหมดอายุใน 60 วัน — ต้องจัดอบรมซ้ำก่อนคนนั้นทำงานไม่ได้ */
export function expiringSoon(): { name: string; course: CourseCode; until: string }[] {
  const limit = addDays(TODAY, 60);
  return STAFF.flatMap((p) =>
    qualificationsOf(p.name)
      .filter((q) => q.until && q.until <= limit)
      .map((q) => ({ name: p.name, course: q.course, until: q.until! })),
  );
}

export const trainingNeeds = () =>
  COURSES.map((c) => ({ course: c.code, people: STAFF.filter((p) => gapsOf(p.name).includes(c.code)).map((p) => p.name) })).filter((x) => x.people.length > 0);

export const nextTrainingNo = () => nextNo(TRAININGS.map((t) => t.no), `TRN-${YEAR}-`, 3);

export type TrainingInput = { course: CourseCode; date: string; hours: number; trainer: string; attendees: string[] };

export function trainingErrors(input: TrainingInput): Errors {
  const e: Errors = {};
  if (!COURSES.some((c) => c.code === input.course)) e.course = "เลือกหลักสูตร";
  if (!isDate(input.date)) e.date = "ใส่วันที่อบรม";
  if (!(input.hours > 0) || input.hours > 40) e.hours = "ชั่วโมงอบรม 1–40";
  if (input.trainer.trim().length < 3) e.trainer = "ใส่วิทยากรหรือสถาบัน";
  if (input.attendees.length === 0) e.attendees = "เลือกผู้เข้าอบรมอย่างน้อยหนึ่งคน";
  else if (input.attendees.some((a) => !PEOPLE.includes(a))) e.attendees = "ผู้เข้าอบรมต้องอยู่ในทะเบียนบุคลากร";
  return e;
}

export function planTraining(input: TrainingInput): Training {
  assertValid(trainingErrors(input));
  return commit(() => {
    const t: Training = { no: nextTrainingNo(), course: input.course, date: input.date, hours: input.hours, trainer: input.trainer.trim(), attendees: input.attendees.map((name) => ({ name })), status: "ตามแผน" };
    TRAININGS.push(t);
    return t;
  });
}

export function recordTrainingErrors(no: string, results: Record<string, "ผ่าน" | "ไม่ผ่าน" | undefined>): Errors {
  const t = trainingByNo(no);
  const e: Errors = {};
  if (t.status !== "ตามแผน") e.results = `${no} บันทึกผลไปแล้ว`;
  else if (t.date > TODAY) e.results = `ยังไม่ถึงวันอบรม (${t.date})`;
  else if (t.attendees.some((a) => !results[a.name])) e.results = "ใส่ผลให้ผู้เข้าอบรมทุกคน";
  return e;
}

export function recordTraining(no: string, results: Record<string, "ผ่าน" | "ไม่ผ่าน" | undefined>) {
  assertValid(recordTrainingErrors(no, results));
  const t = trainingByNo(no);
  return commit(() => {
    for (const a of t.attendees) a.result = results[a.name];
    t.status = "บันทึกผลแล้ว";
    return t;
  });
}

export function evaluateTraining(no: string, input: { effective: boolean; note: string; by: string }, date = TODAY) {
  const t = trainingByNo(no);
  if (t.status !== "บันทึกผลแล้ว") throw new Error("บันทึกผลอบรมก่อนประเมินประสิทธิผล");
  if (t.evaluation) throw new Error(`${no} ประเมินประสิทธิผลแล้ว`);
  if (!PEOPLE.includes(input.by)) throw new Error("เลือกผู้ประเมิน");
  if (input.by === t.trainer) throw new Error("ผู้ประเมินต้องไม่ใช่วิทยากร — ให้หัวหน้างานดูผลจากงานจริง");
  if (input.note.trim().length < 10) throw new Error("บอกหลักฐานจากงานจริงที่ใช้ประเมิน");
  return commit(() => {
    t.evaluation = { date, effective: input.effective, note: input.note.trim(), by: input.by };
    return t;
  });
}

/* ================================================================= audit */

export const AUDIT_TYPES = ["ตรวจระบบ", "ตรวจกระบวนการ", "ตรวจผลิตภัณฑ์"] as const;
export type AuditType = (typeof AUDIT_TYPES)[number];

/**
 * ผู้ตรวจต้องมีหลักสูตรตามชนิดการตรวจ (ISO 9001 7.2, IATF 7.2.3) — ระบบตัดสินจากผลอบรม
 * ไม่ใช่จากช่องติ๊กว่าเป็นผู้ตรวจ ใครอบรมผ่านแล้วตรวจได้ทันที ใบรับรองหมดอายุแล้วตรวจไม่ได้
 */
export function auditorNeeds(type: AuditType, std: Standard): CourseCode[] {
  if (type === "ตรวจกระบวนการ") return ["TR-04", "TR-05"];
  if (type === "ตรวจผลิตภัณฑ์") return ["TR-09", "TR-06"];
  if (std === "ISO 14001") return ["TR-03"];
  if (std === "IATF 16949") return ["TR-02", "TR-05", "TR-06"];
  return ["TR-02"];
}

export const FINDING_TYPES = ["ข้อบกพร่องหลัก", "ข้อบกพร่องย่อย", "ข้อสังเกต"] as const;
export type FindingType = (typeof FINDING_TYPES)[number];
export type Finding = { id: number; clause: string; type: FindingType; detail: string };

export type Audit = {
  no: string;
  type: AuditType;
  std: Standard;
  /** ฝ่ายที่ถูกตรวจ */
  area: Department;
  /** กระบวนการหรือชิ้นส่วนที่ตรวจ สำหรับการตรวจกระบวนการและผลิตภัณฑ์ */
  subject?: string;
  clauses: string[];
  auditor: string;
  planned: string;
  status: "ตามแผน" | "กำลังตรวจ" | "ปิดแล้ว";
  findings: Finding[];
  performedOn?: string;
  closedOn?: string;
  /** คะแนนการตรวจกระบวนการแบบ VDA 6.3 (ร้อยละ) */
  score?: number;
};

export const AUDITS: Audit[] = [
  { no: "IA-2569-01", type: "ตรวจระบบ", std: "ISO 9001", area: "ฝ่ายผลิต", clauses: ["9001:8.5", "9001:7.1.5"], auditor: "ปิยะนุช ใจดี", planned: "2026-03-18", status: "ปิดแล้ว", performedOn: "2026-03-18", closedOn: "2026-04-02", findings: [{ id: 1, clause: "9001:8.5", type: "ข้อสังเกต", detail: "ป้ายชี้บ่งสถานะงานระหว่างผลิตบางจุดซีดจางอ่านยาก" }] },
  { no: "IA-2569-02", type: "ตรวจระบบ", std: "ISO 9001", area: "ฝ่ายจัดซื้อ", clauses: ["9001:8.4"], auditor: "อนุชา ทองดี", planned: "2026-07-24", status: "ปิดแล้ว", performedOn: "2026-07-24", closedOn: "2026-09-15", findings: [{ id: 1, clause: "9001:8.4", type: "ข้อบกพร่องย่อย", detail: "ไม่มีหลักฐานการประเมินผู้ขายรายใหม่ก่อนสั่งซื้อครั้งแรก" }] },
  { no: "IA-2569-03", type: "ตรวจระบบ", std: "ISO 14001", area: "ฝ่ายผลิต", clauses: ["14001:8.1", "14001:6.1.2"], auditor: "กาญจนา บุญมา", planned: "2026-06-10", status: "ปิดแล้ว", performedOn: "2026-06-10", closedOn: "2026-06-24", findings: [{ id: 1, clause: "14001:8.1", type: "ข้อสังเกต", detail: "ถังทินเนอร์ใช้แล้วบางถังไม่มีป้ายระบุ" }] },
  { no: "IA-2569-04", type: "ตรวจระบบ", std: "ISO 9001", area: "ฝ่ายคลังสินค้า", clauses: ["9001:8.5", "9001:7.5"], auditor: "สุภาพร แก้วมณี", planned: "2026-10-08", status: "ตามแผน", findings: [] },
  { no: "IA-2569-05", type: "ตรวจกระบวนการ", std: "IATF 16949", area: "ฝ่ายผลิต", subject: "ปั๊มขึ้นรูปขายึดแบตเตอรี่", clauses: ["IATF:9.2.2.3", "IATF:8.5.1.1"], auditor: "ธนพล เจริญผล", planned: "2026-10-21", status: "ตามแผน", findings: [] },
  { no: "IA-2569-06", type: "ตรวจระบบ", std: "ISO 9001", area: "ฝ่ายประกันคุณภาพ", clauses: ["9001:7.5", "9001:9.1.2", "9001:10.2"], auditor: "ชลธิชา มั่นคง", planned: "2026-11-12", status: "ตามแผน", findings: [] },
];

export const auditByNo = (no: string) => {
  const a = AUDITS.find((x) => x.no === no);
  if (!a) throw new Error(`ไม่พบ ${no}`);
  return a;
};

export const nextAuditNo = () => nextNo(AUDITS.map((a) => a.no), `IA-${YEAR}-`, 2);
export const findingRef = (a: Audit, f: Finding) => `${a.no} #${f.id}`;

export type AuditInput = { type: AuditType; std: Standard; area: Department; subject: string; clauses: string[]; auditor: string; planned: string };

/** ผู้ตรวจต้องผ่านหลักสูตรตามชนิดการตรวจ และไม่ตรวจฝ่ายของตัวเอง (ข้อ 9.2.2 ค) */
export function auditErrors(input: AuditInput): Errors {
  const e: Errors = {};
  if (!DEPARTMENTS.includes(input.area)) e.area = "เลือกฝ่ายที่จะตรวจ";
  if (input.clauses.length === 0) e.clauses = "เลือกข้อกำหนดที่จะตรวจอย่างน้อยหนึ่งข้อ";
  else if (input.clauses.some((c) => clauseById(c)?.std !== input.std && !(input.std === "IATF 16949" && clauseById(c)?.std === "ISO 9001")))
    e.clauses = `เลือกข้อกำหนดของ ${input.std}`;
  if (input.type !== "ตรวจระบบ" && input.subject.trim().length < 3) e.subject = input.type === "ตรวจกระบวนการ" ? "ระบุกระบวนการที่ตรวจ" : "ระบุชิ้นส่วนที่ตรวจ";
  if (input.type !== "ตรวจระบบ" && input.std !== "IATF 16949") e.type = "การตรวจกระบวนการและผลิตภัณฑ์เป็นข้อกำหนดของ IATF 16949";
  const who = personOf(input.auditor);
  if (!who) e.auditor = "เลือกผู้ตรวจ";
  else {
    const missing = auditorNeeds(input.type, input.std).filter((c) => !isQualified(who.name, c, input.planned || TODAY));
    if (missing.length) e.auditor = `${who.name} ยังขาดหลักสูตร ${missing.map(courseName).join(", ")}`;
    else if (who.dept === input.area) e.auditor = "ผู้ตรวจต้องไม่ตรวจฝ่ายของตัวเอง";
  }
  if (!isDate(input.planned)) e.planned = "ใส่วันที่ตรวจ";
  else if (input.planned < TODAY) e.planned = "วันที่ตรวจต้องไม่ย้อนหลัง";
  return e;
}

export function planAudit(input: AuditInput): Audit {
  assertValid(auditErrors(input));
  return commit(() => {
    const a: Audit = {
      no: nextAuditNo(), type: input.type, std: input.std, area: input.area, subject: input.subject.trim() || undefined,
      clauses: [...input.clauses], auditor: input.auditor, planned: input.planned, status: "ตามแผน", findings: [],
    };
    AUDITS.push(a);
    return a;
  });
}

export function startAudit(no: string, date = TODAY) {
  const a = auditByNo(no);
  if (a.status !== "ตามแผน") throw new Error(`${no} ${a.status}`);
  return commit(() => {
    a.status = "กำลังตรวจ";
    a.performedOn = date;
    return a;
  });
}

export function findingErrors(no: string, input: { clause: string; type: FindingType; detail: string }): Errors {
  const a = auditByNo(no);
  const e: Errors = {};
  if (a.status !== "กำลังตรวจ") e.detail = "เริ่มการตรวจก่อนบันทึกสิ่งที่พบ";
  if (!clauseById(input.clause)) e.clause = "เลือกข้อกำหนด";
  if (input.detail.trim().length < 10) e.detail = "เขียนสิ่งที่พบพร้อมหลักฐาน";
  return e;
}

export function addFinding(no: string, input: { clause: string; type: FindingType; detail: string }) {
  assertValid(findingErrors(no, input));
  const a = auditByNo(no);
  return commit(() => {
    const f: Finding = { id: a.findings.length + 1, clause: input.clause, type: input.type, detail: input.detail.trim() };
    a.findings.push(f);
    return f;
  });
}

/** ข้อบกพร่องต้องมี CAR ก่อนปิดการตรวจ ข้อสังเกตไม่ต้อง — CAR ผูกกับข้อที่พบด้วยเลขอ้างอิง */
export const carOf = (ref: string) => CAPAS.find((c) => c.ref === ref);
export const findingsWithoutCar = (a: Audit) => a.findings.filter((f) => f.type !== "ข้อสังเกต" && !carOf(findingRef(a, f)));

export const rating = (score: number) => (score >= 90 ? "A" : score >= 80 ? "B" : "C");

export function closeAuditErrors(no: string, score?: number): Errors {
  const a = auditByNo(no);
  const e: Errors = {};
  if (a.status !== "กำลังตรวจ") e.close = `${no} ${a.status} ปิดไม่ได้`;
  else if (findingsWithoutCar(a).length > 0) e.close = `เปิด CAR ให้ข้อบกพร่องอีก ${findingsWithoutCar(a).length} ข้อก่อนปิดการตรวจ`;
  if (a.type === "ตรวจกระบวนการ" && (score === undefined || !(score >= 0 && score <= 100))) e.score = "การตรวจกระบวนการต้องบันทึกคะแนน VDA 6.3 (0–100%)";
  return e;
}

export function closeAudit(no: string, score?: number, date = TODAY) {
  assertValid(closeAuditErrors(no, score));
  const a = auditByNo(no);
  return commit(() => {
    a.status = "ปิดแล้ว";
    a.closedOn = date;
    if (a.type === "ตรวจกระบวนการ") a.score = score;
    return a;
  });
}

/* ================================================================== capa */

export const CAUSE_CATEGORIES = ["คน", "เครื่องจักร", "วัสดุ", "วิธีการ", "การวัด", "สภาพแวดล้อม"] as const;
export type CauseCategory = (typeof CAUSE_CATEGORIES)[number];
export const ACTION_TYPES = ["แก้ไข", "ป้องกันการเกิดซ้ำ", "ป้องกันความผิดพลาด (Poka-Yoke)"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export const METHODS = ["5 Why", "8D"] as const;
export type Method = (typeof METHODS)[number];

export type CapaAction = { what: string; owner: string; due: string; type: ActionType; doneOn?: string };

export type Capa = {
  no: string;
  date: string;
  /** 8D ใช้กับปัญหาจากลูกค้ายานยนต์ (IATF 10.2.3) ที่เหลือใช้ 5 Why */
  method: Method;
  std: Standard;
  /** NCR ผลตรวจติดตาม หรืออุบัติการณ์ที่เป็นต้นเรื่อง */
  ref: string;
  problem: string;
  owner: string;
  /** D1 ทีม — 8D ต้องมีอย่างน้อยสองคน */
  team: string[];
  /** D3 การกักกันชั่วคราว ก่อนรู้สาเหตุ */
  containment?: string;
  /** D4 — whys คือทำไมจึงเกิด escape คือทำไมจึงหลุดไปถึงลูกค้า */
  rootCause?: { category: CauseCategory; whys: string[]; escape?: string };
  actions: CapaAction[];
  /** D7 เอกสารที่แก้เพื่อไม่ให้เกิดซ้ำ เช่น FMEA แผนควบคุม WI */
  prevention?: string;
  status: "วิเคราะห์สาเหตุ" | "ดำเนินการ" | "ติดตามผล" | "ปิดแล้ว";
  verification?: { date: string; effective: boolean; note: string; by: string };
};

export const CAPAS: Capa[] = [
  {
    no: "CAR-2569-007", date: "2026-07-30", method: "5 Why", std: "ISO 9001", ref: "IA-2569-02 #1", owner: "ปิยะนุช ใจดี", team: ["ปิยะนุช ใจดี"],
    problem: "ไม่มีหลักฐานการประเมินผู้ขายรายใหม่ก่อนออกใบสั่งซื้อครั้งแรก",
    rootCause: { category: "วิธีการ", whys: ["ออกใบสั่งซื้อให้ผู้ขายใหม่ก่อนประเมิน", "ขั้นตอนไม่ได้กำหนดว่าต้องประเมินก่อนสั่งครั้งแรก", "SP-07 เขียนเฉพาะการสั่งซื้อ ไม่ครอบคลุมการคัดเลือกผู้ขาย"] },
    actions: [
      { what: "เพิ่มขั้นตอนประเมินผู้ขายใหม่ใน SP-07", owner: "ปิยะนุช ใจดี", due: "2026-08-15", type: "ป้องกันการเกิดซ้ำ", doneOn: "2026-08-12" },
      { what: "ประเมินผู้ขายที่ใช้อยู่ย้อนหลังให้ครบ", owner: "ปิยะนุช ใจดี", due: "2026-08-31", type: "แก้ไข", doneOn: "2026-08-29" },
    ],
    status: "ปิดแล้ว",
    verification: { date: "2026-09-15", effective: true, note: "สุ่มใบสั่งซื้อผู้ขายใหม่ 3 ใบ มีผลประเมินก่อนสั่งครบ", by: QMR },
  },
  {
    no: "CAR-2569-008", date: "2026-09-11", method: "5 Why", std: "ISO 9001", ref: "NCR-2569-013", owner: "วรวุฒิ พึ่งบุญ", team: ["วรวุฒิ พึ่งบุญ"],
    problem: "สินค้าสีถลอกระหว่างขนส่งถึงลูกค้า",
    rootCause: { category: "วิธีการ", whys: ["มุมชั้นวางเสียดสีกันในรถ", "บรรจุโดยไม่มีมุมกันกระแทก", "ไม่มีวิธีการทำงานเรื่องการบรรจุสินค้าสำเร็จรูป"] },
    actions: [
      { what: "จัดทำ WI การบรรจุสินค้าสำเร็จรูปพร้อมมุมกันกระแทก", owner: "วรวุฒิ พึ่งบุญ", due: "2026-09-20", type: "ป้องกันการเกิดซ้ำ" },
      { what: "อบรมพนักงานคลังเรื่องการบรรจุ", owner: "วรวุฒิ พึ่งบุญ", due: "2026-09-30", type: "แก้ไข" },
    ],
    status: "ดำเนินการ",
  },
];

export const capaByNo = (no: string) => {
  const c = CAPAS.find((x) => x.no === no);
  if (!c) throw new Error(`ไม่พบ ${no}`);
  return c;
};

export const nextCapaNo = () => nextNo(CAPAS.map((c) => c.no), `CAR-${YEAR}-`, 3);
export const overdueActions = (c: Capa) => c.actions.filter((a) => !a.doneOn && a.due < TODAY);
export const openCapas = () => CAPAS.filter((c) => c.status !== "ปิดแล้ว");

/** ขั้น D1–D8 ของ 8D จากข้อมูลที่บันทึกแล้ว — ใช้วาดขั้นตอนและตัดสินว่าไปขั้นถัดไปได้หรือยัง */
export function eightD(c: Capa): { step: string; name: string; done: boolean }[] {
  return [
    { step: "D1", name: "ตั้งทีม", done: c.team.length >= 2 },
    { step: "D2", name: "อธิบายปัญหา", done: c.problem.length > 0 },
    { step: "D3", name: "กักกันชั่วคราว", done: !!c.containment },
    { step: "D4", name: "สาเหตุรากและจุดที่หลุด", done: !!c.rootCause?.escape },
    { step: "D5", name: "เลือกมาตรการถาวร", done: c.actions.length > 0 },
    { step: "D6", name: "ดำเนินการและยืนยันผล", done: c.actions.length > 0 && c.actions.every((a) => a.doneOn) },
    { step: "D7", name: "ป้องกันการเกิดซ้ำ", done: !!c.prevention },
    { step: "D8", name: "ปิดและขอบคุณทีม", done: c.status === "ปิดแล้ว" },
  ];
}

export type CapaInput = { method: Method; std: Standard; ref: string; problem: string; owner: string; team: string[] };

export function capaErrors(input: CapaInput): Errors {
  const e: Errors = {};
  if (input.ref.trim().length < 3) e.ref = "ใส่ต้นเรื่อง เช่น เลข NCR หรือผลตรวจติดตาม";
  else if (CAPAS.some((c) => c.ref === input.ref.trim())) e.ref = `ต้นเรื่องนี้มี ${CAPAS.find((c) => c.ref === input.ref.trim())!.no} อยู่แล้ว`;
  if (input.problem.trim().length < 10) e.problem = "บอกปัญหาที่ต้องแก้";
  if (!PEOPLE.includes(input.owner)) e.owner = "เลือกผู้รับผิดชอบ";
  if (input.method === "8D" && new Set([input.owner, ...input.team]).size < 2) e.team = "8D ต้องทำเป็นทีม อย่างน้อยสองคนจากต่างหน้าที่";
  return e;
}

/** เปิด CAR — ต้นเรื่องเก็บเป็นเลขอ้างอิง ระบบที่เป็นต้นเรื่องหา CAR ของตัวเองจากเลขนี้ */
export function openCapa(input: CapaInput): Capa {
  assertValid(capaErrors(input));
  return commit(() => {
    const c: Capa = {
      no: nextCapaNo(), date: TODAY, method: input.method, std: input.std, ref: input.ref.trim(), problem: input.problem.trim(),
      owner: input.owner, team: [...new Set([input.owner, ...input.team])], actions: [], status: "วิเคราะห์สาเหตุ",
    };
    CAPAS.push(c);
    return c;
  });
}

export function recordContainment(no: string, text: string) {
  const c = capaByNo(no);
  if (c.status === "ปิดแล้ว") throw new Error(`${no} ปิดไปแล้ว`);
  if (text.trim().length < 10) throw new Error("บอกว่ากักกันของอะไร ที่ไหน กี่ชิ้น");
  return commit(() => {
    c.containment = text.trim();
    return c;
  });
}

export type RootCauseInput = { category: CauseCategory; whys: string[]; escape: string };

/** หาสาเหตุราก (ข้อ 10.2.1 ข) — ถามทำไมอย่างน้อยสามชั้น 8D ต้องบอกจุดที่หลุดด้วย */
export function rootCauseErrors(no: string, input: RootCauseInput): Errors {
  const c = capaByNo(no);
  const e: Errors = {};
  if (!CAUSE_CATEGORIES.includes(input.category)) e.category = "เลือกกลุ่มสาเหตุ";
  if (input.whys.filter((w) => w.trim().length >= 5).length < 3) e.whys = "ถามทำไมให้ได้อย่างน้อยสามชั้น";
  if (c.method === "8D" && input.escape.trim().length < 10) e.escape = "8D ต้องบอกว่าทำไมของเสียจึงหลุดการตรวจของเราไปถึงลูกค้า";
  return e;
}

export function recordRootCause(no: string, input: RootCauseInput) {
  const c = capaByNo(no);
  if (c.status === "ปิดแล้ว") throw new Error(`${no} ปิดไปแล้ว`);
  assertValid(rootCauseErrors(no, input));
  return commit(() => {
    c.rootCause = { category: input.category, whys: input.whys.map((w) => w.trim()).filter(Boolean), escape: input.escape.trim() || undefined };
    if (c.status === "วิเคราะห์สาเหตุ" && c.actions.length > 0) c.status = "ดำเนินการ";
    return c;
  });
}

export function actionErrors(input: CapaAction): Errors {
  const e: Errors = taskErrors(input);
  if (!ACTION_TYPES.includes(input.type)) e.type = "เลือกชนิดมาตรการ";
  return e;
}

export function addCapaAction(no: string, input: CapaAction) {
  const c = capaByNo(no);
  if (c.status === "ปิดแล้ว" || c.status === "ติดตามผล") throw new Error(`${no} ${c.status} เพิ่มมาตรการไม่ได้`);
  assertValid(actionErrors(input));
  return commit(() => {
    c.actions.push({ what: input.what.trim(), owner: input.owner, due: input.due, type: input.type });
    if (c.status === "วิเคราะห์สาเหตุ" && c.rootCause) c.status = "ดำเนินการ";
    return c;
  });
}

export function completeCapaAction(no: string, index: number, date = TODAY) {
  const c = capaByNo(no);
  const a = c.actions[index];
  if (!a) throw new Error("ไม่พบมาตรการนี้");
  if (a.doneOn) throw new Error("มาตรการนี้ทำเสร็จแล้ว");
  if (!c.rootCause) throw new Error("บันทึกสาเหตุรากก่อน");
  if (c.method === "8D" && !c.containment) throw new Error("8D ต้องกักกันชั่วคราว (D3) ก่อนทำมาตรการถาวร");
  return commit(() => {
    a.doneOn = date;
    if (c.actions.every((x) => x.doneOn)) c.status = "ติดตามผล";
    return c;
  });
}

export function recordPrevention(no: string, text: string) {
  const c = capaByNo(no);
  if (c.status === "ปิดแล้ว") throw new Error(`${no} ปิดไปแล้ว`);
  if (text.trim().length < 10) throw new Error("บอกเอกสารที่แก้ เช่น PFMEA แผนควบคุม หรือ WI ฉบับใหม่");
  return commit(() => {
    c.prevention = text.trim();
    return c;
  });
}

/** ติดตามประสิทธิผล (ข้อ 10.2.1 ง) — ไม่ได้ผลคือกลับไปหาสาเหตุใหม่ ไม่ใช่ปิดทิ้ง */
export function verifyCapaErrors(no: string, input: { effective: boolean; note: string; by: string }): Errors {
  const c = capaByNo(no);
  const e: Errors = {};
  if (c.status !== "ติดตามผล") e.note = "ทำมาตรการให้ครบก่อนติดตามผล";
  else if (c.method === "8D" && input.effective && !c.prevention) e.note = "8D ต้องบันทึกการป้องกันการเกิดซ้ำ (D7) ก่อนปิด";
  if (input.note.trim().length < 10) e.note = e.note ?? "บอกหลักฐานที่ใช้ตัดสินว่าได้ผลหรือไม่";
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้ติดตามผล";
  else if (input.by === c.owner) e.by = "ผู้ติดตามผลต้องไม่ใช่ผู้รับผิดชอบ CAR";
  return e;
}

export function verifyCapa(no: string, input: { effective: boolean; note: string; by: string }, date = TODAY) {
  assertValid(verifyCapaErrors(no, input));
  const c = capaByNo(no);
  return commit(() => {
    c.verification = { date, effective: input.effective, note: input.note.trim(), by: input.by };
    c.status = input.effective ? "ปิดแล้ว" : "วิเคราะห์สาเหตุ";
    return c;
  });
}

/* ===================================================== management review */

export type ReviewFact = { label: string; value: string; tone: "ok" | "warn" | "bad" | "idle" };

/**
 * ข้อมูลเข้าวาระทบทวนโดยฝ่ายบริหาร (ISO 9001 9.3.2, ISO 14001 9.3) — แต่ละระบบส่งของตัวเองเข้ามา
 * ตอนโหลด ระบบนี้จึงแสดงเฉพาะระบบที่ลูกค้าซื้อ และตัวเลขเป็นค่าเดียวกับที่หน้าจอนั้นใช้ทำงาน
 */
export type ReviewSource = { key: string; std: Standard[]; input: string; title: string; facts: () => ReviewFact[] };

export const REVIEW_SOURCES: ReviewSource[] = [];

export function contributeReviewInput(source: ReviewSource) {
  const at = REVIEW_SOURCES.findIndex((s) => s.key === source.key);
  if (at >= 0) REVIEW_SOURCES[at] = source;
  else REVIEW_SOURCES.push(source);
}

export type ReviewOutput = { decision: string; kind: "โอกาสปรับปรุง" | "เปลี่ยนแปลงระบบ" | "ทรัพยากร"; owner: string; due: string; doneOn?: string };

export type Review = {
  no: string;
  planned: string;
  status: "ตามแผน" | "ประชุมแล้ว";
  chair: string;
  attendees: string[];
  heldOn?: string;
  /** ข้อมูลเข้าที่ใช้ในวันประชุม — เก็บเป็นภาพ ณ วันนั้น ไม่เปลี่ยนตามข้อมูลภายหลัง */
  inputs: { title: string; facts: ReviewFact[] }[];
  outputs: ReviewOutput[];
};

export const REVIEWS: Review[] = [
  {
    no: "MR-2569-01", planned: "2026-01-20", status: "ประชุมแล้ว", chair: TOP, heldOn: "2026-01-20",
    attendees: [TOP, QMR, EMR, "อนุชา ทองดี", "ปิยะนุช ใจดี", "ชลธิชา มั่นคง", "วรวุฒิ พึ่งบุญ"],
    inputs: [
      { title: "ผลการตรวจติดตามภายในปี 2568", facts: [{ label: "ข้อบกพร่อง", value: "2 ข้อ ปิดครบ", tone: "ok" }, { label: "ข้อสังเกต", value: "5 ข้อ", tone: "idle" }] },
      { title: "วัตถุประสงค์ปี 2568", facts: [{ label: "ถึงเป้า", value: "5 จาก 7", tone: "warn" }] },
      { title: "ความพึงพอใจลูกค้าครึ่งปีหลัง 2568", facts: [{ label: "คะแนนเฉลี่ย", value: "4.2 / 5", tone: "ok" }] },
    ],
    outputs: [
      { decision: "ขอการรับรอง IATF 16949 เพื่อรับงานชิ้นส่วนยานยนต์", kind: "เปลี่ยนแปลงระบบ", owner: QMR, due: "2026-12-31" },
      { decision: "จัดซื้อเครื่องปั๊ม 200 ตันพร้อมแม่พิมพ์ชุดแรก", kind: "ทรัพยากร", owner: "อนุชา ทองดี", due: "2026-06-30", doneOn: "2026-06-18" },
      { decision: "ลดของเสียในกระบวนการผลิตให้ต่ำกว่า 1.5%", kind: "โอกาสปรับปรุง", owner: "อนุชา ทองดี", due: "2026-12-31" },
    ],
  },
  { no: "MR-2569-02", planned: "2026-10-20", status: "ตามแผน", chair: TOP, attendees: [], inputs: [], outputs: [] },
];

export const reviewByNo = (no: string) => {
  const r = REVIEWS.find((x) => x.no === no);
  if (!r) throw new Error(`ไม่พบ ${no}`);
  return r;
};

export const nextReviewNo = () => nextNo(REVIEWS.map((r) => r.no), `MR-${YEAR}-`, 2);

/** วาระที่จะนำเข้าที่ประชุมครั้งถัดไป อ่านสด ณ ตอนนี้จากทุกระบบที่ติดตั้ง */
export const liveAgenda = () => REVIEW_SOURCES.map((s) => ({ key: s.key, std: s.std, input: s.input, title: s.title, facts: s.facts() }));

export function planReview(planned: string) {
  if (!isDate(planned) || planned < TODAY) throw new Error("วันประชุมต้องไม่ย้อนหลัง");
  if (REVIEWS.some((r) => r.status === "ตามแผน")) throw new Error("มีการประชุมที่วางแผนไว้แล้ว บันทึกครั้งนั้นก่อน");
  return commit(() => {
    const r: Review = { no: nextReviewNo(), planned, status: "ตามแผน", chair: TOP, attendees: [], inputs: [], outputs: [] };
    REVIEWS.push(r);
    return r;
  });
}

export type MinutesInput = { attendees: string[]; outputs: Omit<ReviewOutput, "doneOn">[] };

export function minutesErrors(no: string, input: MinutesInput): Errors {
  const r = reviewByNo(no);
  const e: Errors = {};
  if (r.status !== "ตามแผน") e.attendees = `${no} บันทึกการประชุมแล้ว`;
  else if (!input.attendees.includes(TOP)) e.attendees = `ผู้บริหารสูงสุด (${TOP}) ต้องเข้าประชุม — ข้อ 9.3 เป็นหน้าที่ของฝ่ายบริหารสูงสุด`;
  else if (!input.attendees.includes(QMR)) e.attendees = `ผู้แทนฝ่ายบริหาร (${QMR}) ต้องเข้าประชุม`;
  if (input.outputs.length === 0) e.outputs = "การทบทวนต้องมีผลลัพธ์อย่างน้อยหนึ่งข้อ (ข้อ 9.3.3)";
  else if (input.outputs.some((o) => o.decision.trim().length < 5 || !PEOPLE.includes(o.owner) || !isDate(o.due))) e.outputs = "ทุกข้อสั่งการต้องมีเรื่อง ผู้รับผิดชอบ และกำหนดเสร็จ";
  return e;
}

/** บันทึกการประชุม — เก็บข้อมูลเข้า ณ วันนี้ไว้กับรายงาน แล้วตั้งวันประชุมครั้งถัดไปอีกหกเดือน */
export function recordMinutes(no: string, input: MinutesInput, date = TODAY) {
  assertValid(minutesErrors(no, input));
  const r = reviewByNo(no);
  return commit(() => {
    r.status = "ประชุมแล้ว";
    r.heldOn = date;
    r.attendees = [...input.attendees];
    r.inputs = liveAgenda().map((a) => ({ title: a.title, facts: a.facts }));
    r.outputs = input.outputs.map((o) => ({ ...o, decision: o.decision.trim() }));
    return r;
  });
}

export function completeReviewOutput(no: string, index: number, date = TODAY) {
  const r = reviewByNo(no);
  const o = r.outputs[index];
  if (!o) throw new Error("ไม่พบข้อสั่งการนี้");
  if (o.doneOn) throw new Error("ข้อสั่งการนี้เสร็จแล้ว");
  return commit(() => {
    o.doneOn = date;
    return r;
  });
}

export const openReviewOutputs = () => REVIEWS.flatMap((r) => r.outputs.map((o, i) => ({ review: r.no, index: i, ...o }))).filter((o) => !o.doneOn);

/* ================================================ this system's own input */

const tone = (bad: boolean, warn = false): ReviewFact["tone"] => (bad ? "bad" : warn ? "warn" : "ok");

contributeReviewInput({
  key: "ims-audits", std: [...STANDARDS], input: "ก", title: "ผลการตรวจติดตามภายในปีนี้",
  facts: () => {
    const year = AUDITS.filter((a) => a.planned.slice(0, 4) === TODAY.slice(0, 4));
    const closed = year.filter((a) => a.status === "ปิดแล้ว");
    const nc = closed.flatMap((a) => a.findings).filter((f) => f.type !== "ข้อสังเกต").length;
    return [
      { label: "ตรวจแล้ว", value: `${closed.length} จาก ${year.length} ครั้งตามแผน`, tone: tone(false, closed.length < year.length) },
      { label: "ข้อบกพร่องที่พบ", value: `${nc} ข้อ`, tone: tone(false, nc > 0) },
    ];
  },
});

contributeReviewInput({
  key: "ims-capa", std: [...STANDARDS], input: "ข", title: "สถานะการแก้ไขและป้องกัน",
  facts: () => {
    const late = openCapas().flatMap((c) => overdueActions(c));
    return [
      { label: "CAR เปิดอยู่", value: `${openCapas().length} ใบ`, tone: tone(false, openCapas().length > 0) },
      { label: "มาตรการเลยกำหนด", value: `${late.length} ข้อ`, tone: tone(late.length > 0) },
    ];
  },
});

contributeReviewInput({
  key: "ims-objectives", std: [...STANDARDS], input: "ค", title: "ผลการบรรลุวัตถุประสงค์",
  facts: () => {
    const measured = OBJECTIVES.filter((o) => latestOf(o));
    const met = measured.filter((o) => metNow(o)).length;
    return [{ label: "ถึงเป้าเดือนล่าสุด", value: `${met} จาก ${measured.length} ข้อ`, tone: tone(met < measured.length / 2, met < measured.length) }];
  },
});

contributeReviewInput({
  key: "ims-risks", std: [...STANDARDS], input: "ง", title: "ความเสี่ยงและโอกาส",
  facts: () => {
    const high = RISKS.filter((r) => r.kind === "ความเสี่ยง" && levelOf(currentScore(r)) === "สูง");
    return [
      { label: "ความเสี่ยงระดับสูง", value: `${high.length} เรื่อง`, tone: tone(false, high.length > 0) },
      { label: "ระดับสูงที่ไม่มีมาตรการค้าง", value: `${unmanaged().length} เรื่อง`, tone: tone(unmanaged().length > 0) },
    ];
  },
});

contributeReviewInput({
  key: "ims-competence", std: [...STANDARDS], input: "จ", title: "ความสามารถและทรัพยากรบุคคล",
  facts: () => {
    const gaps = STAFF.reduce((n, p) => n + gapsOf(p.name).length, 0);
    return [
      { label: "หลักสูตรที่ยังขาดตามตำแหน่ง", value: `${gaps} รายการ`, tone: tone(false, gaps > 0) },
      { label: "ใบรับรองจะหมดอายุใน 60 วัน", value: `${expiringSoon().length} รายการ`, tone: tone(false, expiringSoon().length > 0) },
    ];
  },
});

contributeReviewInput({
  key: "ims-previous", std: [...STANDARDS], input: "ฉ", title: "สถานะข้อสั่งการจากการทบทวนครั้งก่อน",
  facts: () => [{ label: "ยังไม่เสร็จ", value: `${openReviewOutputs().length} ข้อ`, tone: tone(false, openReviewOutputs().length > 0) }],
});

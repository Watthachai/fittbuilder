import { commit } from "../kit";
import { COMPANY } from "../company";

/**
 * ทะเบียนพนักงาน — แหล่งเดียวที่ทุกโมดูล HR อ่านชื่อ แผนก และเงินเดือน
 *
 * ทุกการเปลี่ยนแปลงผ่านฟังก์ชันในไฟล์นี้ และทุกฟังก์ชันเปลี่ยน array เดิมใน
 * commit() เท่านั้น — พนักงานที่รับเข้าที่นี่จึงไปโผล่ในเวลาทำงาน เงินเดือน และ
 * ผังองค์กรเอง โดยไม่มีใครต้องคัดลอกรายชื่อไปเก็บไว้อีกชุด
 */

export type EmployeeStatus = "ทำงานอยู่" | "ทดลองงาน" | "ลาออก";

export type PersonnelEvent = { date: string; type: string; detail: string };

/** วิธีที่คนหนึ่งพ้นจากบริษัท — แต่ละแบบมีสิทธิ์ตามกฎหมายต่างกัน */
export const SEPARATION_KINDS = ["ลาออก", "เลิกจ้าง", "เลิกจ้างตามมาตรา 119", "สิ้นสุดสัญญาจ้าง"] as const;
export type SeparationKind = (typeof SEPARATION_KINDS)[number];

/** บันทึกการพ้นสภาพ พร้อมเงินที่กฎหมายคุ้มครองแรงงานกำหนดให้จ่าย ณ วันนั้น */
export type Separation = {
  kind: SeparationKind;
  noticeDate: string;
  lastDay: string;
  reason: string;
  /** วันที่ทำงานมา นับวันแรกและวันสุดท้ายด้วย */
  serviceDays: number;
  severanceDays: number;
  severance: number;
  noticePay: number;
};

export type Employee = {
  id: number;
  code: string;
  name: string;
  nickname: string;
  position: string;
  department: string;
  /** "ลาออก" หมายถึงพ้นสภาพแล้วไม่ว่าด้วยเหตุใด — โมดูลอื่นกรองคนออกด้วยค่านี้ */
  status: EmployeeStatus;
  personal: { birthDate: string; nationalId: string; phone: string; email: string; address: string };
  contract: {
    type: string;
    startedAt: string;
    endsAt: string | null;
    probationUntil: string;
    baseSalary: number;
    workDays: string;
  };
  admin: { ssoNumber: string; taxId: string; bankName: string; bankAccount: string; pvdRate: number };
  benefits: string[];
  events: PersonnelEvent[];
  separation?: Separation;
};

export const EMPLOYEES: Employee[] = [
  {
    id: 1, code: "EMP-0001", name: "สมชาย รักดี", nickname: "ชาย",
    position: "หัวหน้าฝ่ายขาย", department: "ฝ่ายขาย", status: "ทำงานอยู่",
    personal: { birthDate: "1985-02-14", nationalId: "1-1023-00456-12-3", phone: "081-234-5678", email: "somchai@example.co.th", address: "88/12 ซ.ลาดพร้าว 41 แขวงจันทรเกษม เขตจตุจักร กรุงเทพฯ 10900" },
    contract: { type: "พนักงานประจำ", startedAt: "2019-03-04", endsAt: null, probationUntil: "2019-06-04", baseSalary: 45000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "1234567890", taxId: "1102300456123", bankName: "กสิกรไทย", bankAccount: "xxx-x-x1234-5", pvdRate: 5 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 5%", "ค่าน้ำมันรถ 3,000/เดือน", "ตรวจสุขภาพประจำปี"],
    events: [
      { date: "2019-03-04", type: "รับเข้าทำงาน", detail: "ตำแหน่ง พนักงานขาย · เงินเดือน 22,000" },
      { date: "2021-01-01", type: "เลื่อนตำแหน่ง", detail: "พนักงานขาย → หัวหน้าฝ่ายขาย" },
      { date: "2021-01-01", type: "ปรับเงินเดือน", detail: "22,000 → 38,000" },
      { date: "2024-04-01", type: "ปรับเงินเดือน", detail: "38,000 → 45,000 (ประเมินประจำปี A)" },
    ],
  },
  {
    id: 2, code: "EMP-0002", name: "วิภาดา ศรีสุข", nickname: "ดา",
    position: "นักบัญชีอาวุโส", department: "ฝ่ายบัญชี", status: "ทำงานอยู่",
    personal: { birthDate: "1990-08-30", nationalId: "3-4011-00912-45-6", phone: "089-876-5432", email: "wipada@example.co.th", address: "45/7 ถ.พระราม 2 แขวงบางมด เขตจอมทอง กรุงเทพฯ 10150" },
    contract: { type: "พนักงานประจำ", startedAt: "2020-07-15", endsAt: null, probationUntil: "2020-10-15", baseSalary: 38000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "2345678901", taxId: "3401100912456", bankName: "ไทยพาณิชย์", bankAccount: "xxx-x-x5678-9", pvdRate: 5 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 5%", "ค่าวิชาชีพบัญชี 2,000/เดือน"],
    events: [
      { date: "2020-07-15", type: "รับเข้าทำงาน", detail: "ตำแหน่ง นักบัญชี · เงินเดือน 28,000" },
      { date: "2023-01-01", type: "เลื่อนตำแหน่ง", detail: "นักบัญชี → นักบัญชีอาวุโส" },
      { date: "2023-01-01", type: "ปรับเงินเดือน", detail: "28,000 → 38,000" },
    ],
  },
  {
    id: 3, code: "EMP-0003", name: "ณัฐพล ทองดี", nickname: "พล",
    position: "พนักงานคลังสินค้า", department: "ฝ่ายคลัง", status: "ทำงานอยู่",
    personal: { birthDate: "1996-11-02", nationalId: "1-5099-00223-88-1", phone: "092-345-6789", email: "nattapon@example.co.th", address: "12 หมู่ 4 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540" },
    contract: { type: "พนักงานประจำ", startedAt: "2021-01-11", endsAt: null, probationUntil: "2021-04-11", baseSalary: 18000, workDays: "จันทร์–เสาร์" },
    admin: { ssoNumber: "3456789012", taxId: "1509900223881", bankName: "กรุงไทย", bankAccount: "xxx-x-x2468-1", pvdRate: 3 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 3%", "เบี้ยขยัน 800/เดือน"],
    events: [
      { date: "2021-01-11", type: "รับเข้าทำงาน", detail: "ตำแหน่ง พนักงานคลังสินค้า · เงินเดือน 15,000" },
      { date: "2023-04-01", type: "ปรับเงินเดือน", detail: "15,000 → 18,000" },
    ],
  },
  {
    id: 4, code: "EMP-0004", name: "ปรียา แก้วใส", nickname: "ยา",
    position: "เจ้าหน้าที่บุคคล", department: "ฝ่ายบุคคล", status: "ทำงานอยู่",
    personal: { birthDate: "1993-05-19", nationalId: "1-1005-00778-33-9", phone: "086-111-2233", email: "preeya@example.co.th", address: "9/99 คอนโดรัชดา ห้อง 1204 แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400" },
    contract: { type: "พนักงานประจำ", startedAt: "2022-05-02", endsAt: null, probationUntil: "2022-08-02", baseSalary: 25000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "4567890123", taxId: "1100500778339", bankName: "กสิกรไทย", bankAccount: "xxx-x-x3579-2", pvdRate: 5 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 5%"],
    events: [
      { date: "2022-05-02", type: "รับเข้าทำงาน", detail: "ตำแหน่ง เจ้าหน้าที่บุคคล · เงินเดือน 22,000" },
      { date: "2024-01-01", type: "ปรับเงินเดือน", detail: "22,000 → 25,000" },
    ],
  },
  {
    id: 5, code: "EMP-0005", name: "อนุชา มั่นคง", nickname: "ชา",
    position: "ช่างเทคนิค", department: "ฝ่ายผลิต", status: "ทดลองงาน",
    personal: { birthDate: "1999-01-25", nationalId: "1-7208-00334-55-7", phone: "094-555-6677", email: "anucha@example.co.th", address: "56 หมู่ 2 ต.หนองปรือ อ.บางละมุง จ.ชลบุรี 20150" },
    contract: { type: "สัญญาจ้าง 1 ปี", startedAt: "2023-09-18", endsAt: "2027-09-17", probationUntil: "2026-12-18", baseSalary: 21000, workDays: "จันทร์–เสาร์" },
    admin: { ssoNumber: "5678901234", taxId: "1720800334557", bankName: "กรุงเทพ", bankAccount: "xxx-x-x8642-0", pvdRate: 0 },
    benefits: ["ประกันสุขภาพกลุ่ม", "ค่ากะกลางคืน 300/กะ"],
    events: [
      { date: "2023-09-18", type: "รับเข้าทำงาน", detail: "ตำแหน่ง ช่างเทคนิค · สัญญา 1 ปี" },
      { date: "2026-09-18", type: "ต่อสัญญา", detail: "ต่ออีก 1 ปี ถึง 17 ก.ย. 2570" },
    ],
  },
  {
    id: 6, code: "EMP-0006", name: "กมลวรรณ ใจงาม", nickname: "กมล",
    position: "พนักงานขาย", department: "ฝ่ายขาย", status: "ทำงานอยู่",
    personal: { birthDate: "1997-07-07", nationalId: "1-1014-00556-77-2", phone: "083-777-8899", email: "kamonwan@example.co.th", address: "23/5 ซ.อ่อนนุช 17 แขวงสวนหลวง เขตสวนหลวง กรุงเทพฯ 10250" },
    contract: { type: "พนักงานประจำ", startedAt: "2024-02-01", endsAt: null, probationUntil: "2024-05-01", baseSalary: 22000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "6789012345", taxId: "1101400556772", bankName: "กสิกรไทย", bankAccount: "xxx-x-x1357-9", pvdRate: 3 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 3%", "คอมมิชชั่นตามยอดขาย"],
    events: [{ date: "2024-02-01", type: "รับเข้าทำงาน", detail: "ตำแหน่ง พนักงานขาย · เงินเดือน 22,000" }],
  },
  {
    id: 7, code: "EMP-0007", name: "ธีรศักดิ์ พูลทรัพย์", nickname: "ศักดิ์",
    position: "ผู้จัดการคลัง", department: "ฝ่ายคลัง", status: "ทำงานอยู่",
    personal: { birthDate: "1982-12-11", nationalId: "3-1009-00112-90-4", phone: "081-999-1122", email: "teerasak@example.co.th", address: "101/23 หมู่บ้านสีวลี ต.บางรักพัฒนา อ.บางบัวทอง จ.นนทบุรี 11110" },
    contract: { type: "พนักงานประจำ", startedAt: "2018-11-26", endsAt: null, probationUntil: "2019-02-26", baseSalary: 42000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "7890123456", taxId: "3100900112904", bankName: "ไทยพาณิชย์", bankAccount: "xxx-x-x2580-3", pvdRate: 5 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 5%", "ค่าน้ำมันรถ 3,000/เดือน", "ประกันชีวิตกลุ่ม"],
    events: [
      { date: "2018-11-26", type: "รับเข้าทำงาน", detail: "ตำแหน่ง หัวหน้าคลัง · เงินเดือน 30,000" },
      { date: "2022-01-01", type: "เลื่อนตำแหน่ง", detail: "หัวหน้าคลัง → ผู้จัดการคลัง" },
      { date: "2022-01-01", type: "ปรับเงินเดือน", detail: "30,000 → 42,000" },
    ],
  },
  {
    id: 8, code: "EMP-0008", name: "สุนิสา เพชรงาม", nickname: "นิ",
    position: "เจ้าหน้าที่จัดซื้อ", department: "ฝ่ายจัดซื้อ", status: "ลาออก",
    personal: { birthDate: "1994-03-08", nationalId: "1-2098-00445-66-8", phone: "087-222-3344", email: "sunisa@example.co.th", address: "78/4 ถ.เพชรเกษม แขวงบางหว้า เขตภาษีเจริญ กรุงเทพฯ 10160" },
    contract: { type: "พนักงานประจำ", startedAt: "2023-04-10", endsAt: "2026-08-31", probationUntil: "2023-07-10", baseSalary: 24000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "8901234567", taxId: "1209800445668", bankName: "กรุงไทย", bankAccount: "xxx-x-x9753-1", pvdRate: 3 },
    benefits: ["ประกันสุขภาพกลุ่ม"],
    events: [
      { date: "2023-04-10", type: "รับเข้าทำงาน", detail: "ตำแหน่ง เจ้าหน้าที่จัดซื้อ · เงินเดือน 24,000" },
      { date: "2026-08-31", type: "ลาออก", detail: "ลาออกตามความสมัครใจ · คืนทรัพย์สินครบ" },
    ],
    separation: {
      kind: "ลาออก", noticeDate: "2026-07-31", lastDay: "2026-08-31", reason: "ลาออกตามความสมัครใจ",
      serviceDays: 1240, severanceDays: 0, severance: 0, noticePay: 0,
    },
  },
];

export const EVENT_TYPES = [
  "รับเข้าทำงาน", "ย้ายแผนก", "เลื่อนตำแหน่ง", "ปรับเงินเดือน", "ต่อสัญญา", "ลาออก",
  "ผ่านทดลองงาน", "เปลี่ยนประเภทการจ้าง", "ตักเตือน", "เลิกจ้าง", "สิ้นสุดสัญญาจ้าง",
];

/** เหตุการณ์ที่ปิดแฟ้ม — วันที่ของมันคือวันทำงานวันสุดท้าย */
export const SEPARATION_EVENTS = ["ลาออก", "เลิกจ้าง", "สิ้นสุดสัญญาจ้าง"];
const isSeparationEvent = (ev: PersonnelEvent) => SEPARATION_EVENTS.includes(ev.type);

/** งวดที่หน้าจอถือว่าเป็น "วันนี้" — ตรึงไว้เพื่อให้เดโมอ่านเหมือนกันทุกครั้ง */
export const TODAY = "2026-09-22";

export const baht = (n: number) => n.toLocaleString("th-TH");

const monthOf = (iso: string) => iso.slice(0, 7);

export const addMonths = (iso: string, n: number) => {
  const d = new Date(iso + "-01");
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 7);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export const allEvents = (): (PersonnelEvent & { employeeId: number; name: string })[] =>
  EMPLOYEES.flatMap((e) => e.events.map((ev) => ({ ...ev, employeeId: e.id, name: e.name })))
    .sort((a, b) => b.date.localeCompare(a.date));

export const isActive = (e: Employee) => e.status !== "ลาออก";

/**
 * จำนวนพนักงาน ณ สิ้นเดือนหนึ่ง นับจากวันที่เริ่มงานลบคนที่ลาออกไปแล้ว
 * ไม่ได้เก็บตัวเลขไว้ล่วงหน้า เพราะถ้าเพิ่มพนักงานหนึ่งคนกราฟต้องขยับเอง
 */
export function headcountAt(month: string) {
  return EMPLOYEES.filter((e) => {
    if (monthOf(e.contract.startedAt) > month) return false;
    const left = e.events.find(isSeparationEvent);
    return !left || monthOf(left.date) > month;
  }).length;
}

/** ย้อนหลัง n เดือนจากงวดปัจจุบัน สำหรับกราฟแท่ง */
export function headcountTrend(months = 12) {
  const now = monthOf(TODAY);
  return Array.from({ length: months }, (_, i) => {
    const m = addMonths(now, i - months + 1);
    return { month: m, label: m.slice(5) + "/" + m.slice(2, 4), value: headcountAt(m) };
  });
}

export const hiredIn = (year: string) =>
  EMPLOYEES.filter((e) => e.contract.startedAt.startsWith(year));

export const leftIn = (year: string) =>
  EMPLOYEES.filter((e) => e.events.some((ev) => isSeparationEvent(ev) && ev.date.startsWith(year)));

export type Upcoming = {
  employeeId: number;
  name: string;
  kind: string;
  date: string;
  inDays: number;
  tone: "warn" | "info" | "bad";
};

/**
 * สิ่งที่ฝ่ายบุคคลต้องทำก่อนมันสาย — สัญญาใกล้หมด ทดลองงานใกล้ครบ
 * และวันครบรอบการทำงานที่ผูกกับการประเมิน
 */
export function upcoming(withinDays = 120): Upcoming[] {
  const out: Upcoming[] = [];
  for (const e of EMPLOYEES) {
    if (!isActive(e)) continue;

    if (e.contract.endsAt) {
      const d = daysBetween(TODAY, e.contract.endsAt);
      if (d >= 0 && d <= withinDays) {
        out.push({ employeeId: e.id, name: e.name, kind: "สัญญาหมดอายุ", date: e.contract.endsAt, inDays: d, tone: "bad" });
      }
    }

    const d = daysBetween(TODAY, e.contract.probationUntil);
    if (d >= 0 && d <= withinDays) {
      out.push({ employeeId: e.id, name: e.name, kind: "ครบกำหนดทดลองงาน", date: e.contract.probationUntil, inDays: d, tone: "warn" });
    }

    const anniversary = TODAY.slice(0, 4) + e.contract.startedAt.slice(4);
    const a = daysBetween(TODAY, anniversary);
    if (a >= 0 && a <= withinDays) {
      out.push({ employeeId: e.id, name: e.name, kind: "ครบรอบการทำงาน", date: anniversary, inDays: a, tone: "info" });
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

/** เพศ — เก็บแยกจากทะเบียนหลักเพราะเป็นข้อมูลแสดงผล ไม่ใช่ข้อมูลทางบุคคล */
export const GENDER: Record<number, "ชาย" | "หญิง"> = {
  1: "ชาย", 2: "หญิง", 3: "ชาย", 4: "หญิง", 5: "ชาย", 6: "หญิง", 7: "ชาย", 8: "หญิง",
};

export const ageOf = (e: Employee) => Math.floor(daysBetween(e.personal.birthDate, TODAY) / 365.25);
export const tenureYears = (e: Employee) =>
  daysBetween(e.contract.startedAt, e.separation?.lastDay ?? TODAY) / 365.25;

/**
 * เอกสารที่ฝ่ายบุคคลต้องมีของแต่ละคน — ใช้ทำแถบความคืบหน้าในข้อมูลทางปกครอง
 * ค่าตั้งต้นคือครบ ยกเว้นคนที่ระบุไว้ เพราะของจริงคนส่วนใหญ่ยื่นครบตอนรับเข้า
 */
export const DOCUMENT_KINDS = [
  "สำเนาบัตรประชาชน",
  "สำเนาทะเบียนบ้าน",
  "วุฒิการศึกษา",
  "หนังสือรับรองการทำงานเดิม",
  "ผลตรวจสุขภาพ",
];

const MISSING_DOCS: Record<number, string[]> = {
  5: ["หนังสือรับรองการทำงานเดิม", "ผลตรวจสุขภาพ"],
  6: ["ผลตรวจสุขภาพ"],
};

export const documentsOf = (e: Employee) =>
  DOCUMENT_KINDS.map((name) => ({ name, done: !(MISSING_DOCS[e.id] ?? []).includes(name) }));

export type ActivityEntry = { date: string; time: string; actor: string; text: string; target?: string };

/** บันทึกการทำงานของฝ่ายบุคคลกับแฟ้มนี้ — ใครทำอะไรเมื่อไร */
export const ACTIVITY: Record<number, ActivityEntry[]> = {
  1: [
    { date: "2026-09-18", time: "14:10", actor: "กมลวรรณ ใจงาม", text: "อัปเดตที่อยู่ตามทะเบียนบ้าน" },
    { date: "2026-09-18", time: "09:42", actor: "กมลวรรณ ใจงาม", text: "แนบเอกสาร", target: "ผลตรวจสุขภาพ 2569.pdf" },
    { date: "2026-04-01", time: "10:05", actor: "วิภาดา ศรีสุข", text: "บันทึกปรับเงินเดือน", target: "38,000 → 45,000" },
  ],
  5: [
    { date: "2026-09-18", time: "16:30", actor: "กมลวรรณ ใจงาม", text: "ส่งเตือนขอเอกสาร", target: "หนังสือรับรองการทำงานเดิม" },
    { date: "2026-09-18", time: "16:28", actor: "กมลวรรณ ใจงาม", text: "บันทึกต่อสัญญา", target: "ต่ออีก 1 ปี ถึง 17 ก.ย. 2570" },
  ],
};

export function byDepartment() {
  const active = EMPLOYEES.filter(isActive);
  return [...new Set(active.map((e) => e.department))]
    .map((d) => ({ department: d, count: active.filter((e) => e.department === d).length }))
    .sort((a, b) => b.count - a.count);
}

/* ================================================================ changes */

export { COMPANY };

/** ทดลองงานไม่เกิน 119 วัน — ทำงานครบ 120 วันแล้วเลิกจ้าง ต้องจ่ายค่าชดเชยตามมาตรา 118 */
export const PROBATION_DAYS = 119;
/** บอกกล่าวล่วงหน้าหนึ่งงวดค่าจ้าง ซึ่งสำหรับพนักงานรายเดือนคือ 30 วัน (มาตรา 17) */
export const NOTICE_DAYS = 30;
export const MIN_SALARY = 10000;
/** ประกันสังคม: ร้อยละ 5 ของค่าจ้าง โดยฐานต่ำสุด 1,650 และสูงสุด 15,000 บาท */
export const SSO_RATE = 0.05;
export const SSO_WAGE_FLOOR = 1650;
export const SSO_WAGE_CAP = 15000;

export const CONTRACT_TYPES = ["พนักงานประจำ", "สัญญาจ้าง 1 ปี", "พนักงานรายวัน", "พนักงานชั่วคราว"];
export const WORK_WEEKS = ["จันทร์–ศุกร์", "จันทร์–เสาร์"];
export const BANKS = ["กสิกรไทย", "ไทยพาณิชย์", "กรุงไทย", "กรุงเทพ", "กรุงศรีอยุธยา"];
export const PVD_RATES = [0, 3, 5, 7, 10];

/** สัญญาที่มีวันสิ้นสุด — ต้องต่อสัญญา และสิ้นสุดได้โดยไม่ต้องบอกกล่าว */
export const isFixedTerm = (type: string) => type === "สัญญาจ้าง 1 ปี" || type === "พนักงานชั่วคราว";

/** สวัสดิการที่ลงทะเบียนให้ได้ กองทุนสำรองเลี้ยงชีพไม่อยู่ในนี้เพราะตามอัตราในข้อมูลทางปกครอง */
export const BENEFIT_CATALOG = [
  "ประกันสุขภาพกลุ่ม",
  "ประกันชีวิตกลุ่ม",
  "ตรวจสุขภาพประจำปี",
  "ค่าน้ำมันรถ 3,000/เดือน",
  "ค่าโทรศัพท์ 500/เดือน",
  "ค่าวิชาชีพบัญชี 2,000/เดือน",
  "เบี้ยขยัน 800/เดือน",
  "ค่ากะกลางคืน 300/กะ",
  "คอมมิชชั่นตามยอดขาย",
  "ชุดฟอร์ม 3 ชุด/ปี",
];

export const pvdBenefit = (rate: number) => `กองทุนสำรองเลี้ยงชีพ ${rate}%`;
export const isPvdBenefit = (b: string) => b.startsWith("กองทุนสำรองเลี้ยงชีพ");

const KNOWN_DEPARTMENTS = ["ฝ่ายขาย", "ฝ่ายบัญชี", "ฝ่ายคลัง", "ฝ่ายบุคคล", "ฝ่ายผลิต", "ฝ่ายจัดซื้อ"];

/** แผนกที่มีในบริษัท ลำดับคงที่ เพื่อให้สีของแต่ละแผนกไม่ขยับเมื่อมีคนเข้าออก */
export const departments = () => [...new Set([...KNOWN_DEPARTMENTS, ...EMPLOYEES.map((e) => e.department)])];

/** ชื่อตำแหน่งที่ใช้อยู่ ไว้เป็นตัวเลือกตอนกรอก เพื่อให้สะกดตรงกับที่ผังองค์กรอ่าน */
export const positionTitles = () => [...new Set(EMPLOYEES.map((e) => e.position))];

/* ----------------------------------------------------------------- dates */

const DAY = 86_400_000;

/** วันที่ถัดไป n วัน อ่านเป็น UTC ทั้งขาไปขากลับ เขตเวลาจึงไม่ทำให้วันเลื่อน */
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);

export const addYears = (iso: string, n: number) => {
  const d = new Date(iso);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return d.toISOString().slice(0, 10);
};

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export const beYear = (iso: string) => Number(iso.slice(0, 4)) + 543;

/** "22 กันยายน 2569" — วันที่แบบที่พิมพ์ในหนังสือราชการและหนังสือรับรอง */
export const thaiDate = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${THAI_MONTHS[Number(iso.slice(5, 7)) - 1]} ${beYear(iso)}`;

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** วันสุดท้ายของการทดลองงาน: วันเริ่มงานคือวันที่หนึ่ง วันนี้คือวันที่ 119 */
export const probationEnd = (startedAt: string) => addDays(startedAt, PROBATION_DAYS - 1);

/** ปีที่ทำงานครบ นับตามปฏิทิน — เริ่ม 4 มี.ค. ทำถึง 3 มี.ค. ปีถัดไปคือครบหนึ่งปี */
export function serviceYears(startedAt: string, lastDay: string): number {
  const dayAfter = addDays(lastDay, 1);
  let years = 0;
  while (addYears(startedAt, years + 1) <= dayAfter) years++;
  return years;
}

/* ----------------------------------------------------------------- money */

const round2 = (n: number) => Math.round(n * 100) / 100;

export const ssoContribution = (salary: number) =>
  Math.round(Math.min(Math.max(salary, SSO_WAGE_FLOOR), SSO_WAGE_CAP) * SSO_RATE);

/** อัตราค่าชดเชยตามมาตรา 118 เรียงจากอายุงานมากไปน้อย */
export const SEVERANCE_TIERS = [
  { years: 20, days: 400 },
  { years: 10, days: 300 },
  { years: 6, days: 240 },
  { years: 3, days: 180 },
  { years: 1, days: 90 },
] as const;

/** วันค่าจ้างที่ต้องจ่ายเป็นค่าชดเชย ตามอายุงานถึงวันทำงานวันสุดท้าย */
export function severanceDaysFor(startedAt: string, lastDay: string): number {
  if (daysBetween(startedAt, lastDay) + 1 < PROBATION_DAYS + 1) return 0;
  const years = serviceYears(startedAt, lastDay);
  return SEVERANCE_TIERS.find((t) => years >= t.years)?.days ?? 30;
}

/**
 * เงินที่กฎหมายกำหนดเมื่อคนหนึ่งพ้นสภาพ
 *
 * ค่าชดเชยจ่ายเมื่อนายจ้างเป็นฝ่ายเลิกจ้าง รวมถึงสัญญาจ้างมีกำหนดที่ครบกำหนด
 * แต่ไม่จ่ายเมื่อลาออกเอง หรือเลิกจ้างด้วยเหตุตามมาตรา 119 ค่าจ้างแทนการบอกกล่าว
 * ล่วงหน้าจ่ายเฉพาะการเลิกจ้างที่แจ้งไม่ถึงหนึ่งงวดค่าจ้าง ค่าจ้างรายวันของพนักงาน
 * รายเดือนคือเงินเดือนหารสามสิบ
 */
export function separationPay(e: Employee, kind: SeparationKind, noticeDate: string, lastDay: string) {
  const daily = e.contract.baseSalary / 30;
  const owed = kind === "เลิกจ้าง" || kind === "สิ้นสุดสัญญาจ้าง";
  const severanceDays = owed ? severanceDaysFor(e.contract.startedAt, lastDay) : 0;
  const shortNotice = kind === "เลิกจ้าง" ? Math.max(0, NOTICE_DAYS - daysBetween(noticeDate, lastDay)) : 0;
  return {
    serviceDays: daysBetween(e.contract.startedAt, lastDay) + 1,
    severanceDays,
    severance: round2(daily * severanceDays),
    noticePay: round2(daily * shortNotice),
  };
}

/* ------------------------------------------------------------- the record */

export const employeeOf = (id: number): Employee => {
  const e = EMPLOYEES.find((x) => x.id === id);
  if (!e) throw new Error(`ไม่พบพนักงาน ${id}`);
  return e;
};

function activeOf(id: number): Employee {
  const e = employeeOf(id);
  if (!isActive(e)) throw new Error(`${e.name} พ้นสภาพแล้ว`);
  return e;
}

/** เลขพนักงานถัดไป ต่อจากเลขสูงสุดในทะเบียน */
export function nextEmployeeCode(): string {
  const top = Math.max(0, ...EMPLOYEES.map((e) => Number(e.code.slice(4))));
  return "EMP-" + String(top + 1).padStart(4, "0");
}

const clock = () => new Date().toTimeString().slice(0, 5);

/** ลงบันทึกกิจกรรมของแฟ้ม ใหม่สุดอยู่บน — เรียกได้เฉพาะภายใน commit() */
function log(employeeId: number, text: string, target?: string) {
  (ACTIVITY[employeeId] ??= []).unshift({ date: TODAY, time: clock(), actor: "คุณ", text, target });
}

/** เพิ่มเหตุการณ์แล้วเรียงตามวันที่ เหตุการณ์ย้อนหลังจึงไปอยู่ในที่ของมัน */
function addEvent(e: Employee, ev: PersonnelEvent) {
  e.events.push(ev);
  e.events.sort((a, b) => a.date.localeCompare(b.date));
}

export function addNote(employeeId: number, kind: string, text: string) {
  employeeOf(employeeId);
  if (!text.trim()) throw new Error("บันทึกว่างเปล่า");
  commit(() => log(employeeId, kind, text.trim()));
}

/* ------------------------------------------------------------- validation */

export type Errors = Record<string, string>;

const hasErrors = (e: Errors) => Object.keys(e).length > 0;
const fail = (what: string, e: Errors) => new Error(`${what}: ${Object.values(e).join(" · ")}`);

export type PersonalInput = {
  name: string;
  nickname: string;
  gender: "ชาย" | "หญิง";
  birthDate: string;
  nationalId: string;
  phone: string;
  email: string;
  address: string;
};

export function personalErrors(p: PersonalInput): Errors {
  const e: Errors = {};
  if (p.name.trim().split(/\s+/).length < 2) e.name = "ใส่ทั้งชื่อและนามสกุล";
  if (!isDate(p.birthDate)) e.birthDate = "ระบุวันเกิด";
  else if (serviceYears(p.birthDate, TODAY) < 15) e.birthDate = "ผู้สมัครต้องอายุไม่ต่ำกว่า 15 ปีตามกฎหมายคุ้มครองแรงงาน";
  if (!/^\d-\d{4}-\d{5}-\d{2}-\d$/.test(p.nationalId)) e.nationalId = "รูปแบบต้องเป็น 1-2345-67890-12-3";
  if (!/^0\d{2}-\d{3}-\d{4}$/.test(p.phone)) e.phone = "รูปแบบต้องเป็น 08X-XXX-XXXX";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) e.email = "อีเมลไม่ถูกต้อง";
  if (p.address.trim().length < 10) e.address = "ใส่ที่อยู่ตามทะเบียนบ้านให้ครบ";
  return e;
}

export type EmploymentInput = {
  position: string;
  department: string;
  type: string;
  startedAt: string;
  endsAt: string | null;
  baseSalary: number;
  workDays: string;
};

export function employmentErrors(i: EmploymentInput): Errors {
  const e: Errors = {};
  if (i.position.trim().length < 2) e.position = "ระบุตำแหน่ง";
  if (!departments().includes(i.department)) e.department = "เลือกแผนก";
  if (!CONTRACT_TYPES.includes(i.type)) e.type = "เลือกประเภทการจ้าง";
  if (!isDate(i.startedAt)) e.startedAt = "ระบุวันเริ่มงาน";
  if (!(i.baseSalary >= MIN_SALARY)) e.baseSalary = `เงินเดือนต้องไม่ต่ำกว่า ${baht(MIN_SALARY)} บาท`;
  if (isFixedTerm(i.type) && !(i.endsAt && isDate(i.endsAt) && i.endsAt > i.startedAt)) {
    e.endsAt = "สัญญามีกำหนดต้องมีวันสิ้นสุดหลังวันเริ่มงาน";
  }
  return e;
}

export type AdminInput = {
  ssoNumber: string;
  taxId: string;
  bankName: string;
  bankAccount: string;
  pvdRate: number;
};

export function adminErrors(a: AdminInput): Errors {
  const e: Errors = {};
  if (!/^\d{10}$/.test(a.ssoNumber)) e.ssoNumber = "เลขประกันสังคมต้องมี 10 หลัก";
  if (!/^\d{13}$/.test(a.taxId)) e.taxId = "เลขผู้เสียภาษีต้องมี 13 หลัก";
  if (!BANKS.includes(a.bankName)) e.bankName = "เลือกธนาคาร";
  if (a.bankAccount.trim().length < 6) e.bankAccount = "ใส่เลขบัญชีให้ครบ";
  if (!PVD_RATES.includes(a.pvdRate)) e.pvdRate = "เลือกอัตราสะสม";
  return e;
}

/* -------------------------------------------------------------- new hire */

export type HireInput = PersonalInput &
  EmploymentInput &
  Omit<AdminInput, "taxId"> & {
    /** เอกสารที่ยื่นแล้วตอนรับเข้า ที่เหลือขึ้นเป็นรอเอกสาร */
    documents: string[];
  };

const digitsOf = (s: string) => s.replace(/\D/g, "");

export const hireErrors = (i: HireInput): Errors => ({
  ...personalErrors(i),
  ...employmentErrors(i),
  ...adminErrors({ ...i, taxId: digitsOf(i.nationalId) }),
});

/**
 * รับพนักงานใหม่เข้าทะเบียน
 *
 * ได้เลขพนักงานถัดไป เริ่มที่สถานะทดลองงาน 119 วัน เลขผู้เสียภาษีคือเลขบัตร
 * ประชาชน และเอกสารที่ยังไม่ได้ยื่นขึ้นเป็นรอเอกสาร ทุกโมดูลที่อ่านทะเบียน
 * เห็นคนนี้ทันทีที่บันทึก
 */
export function hireEmployee(i: HireInput): Employee {
  const errors = hireErrors(i);
  if (hasErrors(errors)) throw fail("รับพนักงานไม่ได้", errors);
  const id = Math.max(0, ...EMPLOYEES.map((e) => e.id)) + 1;
  const name = i.name.trim().replace(/\s+/g, " ");
  const employee: Employee = {
    id,
    code: nextEmployeeCode(),
    name,
    nickname: i.nickname.trim() || name.split(" ")[0],
    position: i.position.trim(),
    department: i.department,
    status: "ทดลองงาน",
    personal: {
      birthDate: i.birthDate, nationalId: i.nationalId, phone: i.phone, email: i.email.trim(), address: i.address.trim(),
    },
    contract: {
      type: i.type,
      startedAt: i.startedAt,
      endsAt: isFixedTerm(i.type) ? i.endsAt : null,
      probationUntil: probationEnd(i.startedAt),
      baseSalary: i.baseSalary,
      workDays: i.workDays,
    },
    admin: {
      ssoNumber: i.ssoNumber, taxId: digitsOf(i.nationalId), bankName: i.bankName, bankAccount: i.bankAccount.trim(), pvdRate: i.pvdRate,
    },
    benefits: ["ประกันสุขภาพกลุ่ม", ...(i.pvdRate > 0 ? [pvdBenefit(i.pvdRate)] : [])],
    events: [
      { date: i.startedAt, type: "รับเข้าทำงาน", detail: `ตำแหน่ง ${i.position.trim()} · เงินเดือน ${baht(i.baseSalary)}` },
    ],
  };
  return commit(() => {
    EMPLOYEES.push(employee);
    GENDER[id] = i.gender;
    const missing = DOCUMENT_KINDS.filter((d) => !i.documents.includes(d));
    if (missing.length) MISSING_DOCS[id] = missing;
    log(id, "รับเข้าทำงาน", `${employee.code} · ${employee.position}`);
    return employee;
  });
}

/* --------------------------------------------------------- personal data */

export const personalOf = (e: Employee): PersonalInput => ({
  name: e.name, nickname: e.nickname, gender: GENDER[e.id] ?? "ชาย", ...e.personal,
});

export function updatePersonal(id: number, p: PersonalInput) {
  const errors = personalErrors(p);
  if (hasErrors(errors)) throw fail("แก้ไขข้อมูลส่วนตัวไม่ได้", errors);
  const e = employeeOf(id);
  commit(() => {
    // บุคคลธรรมดาใช้เลขบัตรประชาชนเป็นเลขผู้เสียภาษี เปลี่ยนเลขบัตรจึงต้องเปลี่ยนตาม
    if (e.admin.taxId === digitsOf(e.personal.nationalId)) e.admin.taxId = digitsOf(p.nationalId);
    e.name = p.name.trim().replace(/\s+/g, " ");
    e.nickname = p.nickname.trim() || e.name.split(" ")[0];
    e.personal = { birthDate: p.birthDate, nationalId: p.nationalId, phone: p.phone, email: p.email.trim(), address: p.address.trim() };
    GENDER[id] = p.gender;
    log(id, "แก้ไขข้อมูลส่วนตัว");
  });
}

/* ------------------------------------------------------- contract & probation */

/** บรรจุเป็นพนักงาน: จบการทดลองงานก่อนครบ 120 วัน */
export function passProbation(id: number) {
  const e = activeOf(id);
  if (e.status !== "ทดลองงาน") throw new Error(`${e.name} ไม่ได้อยู่ระหว่างทดลองงาน`);
  if (TODAY < e.contract.startedAt) throw new Error(`${e.name} ยังไม่เริ่มงาน เริ่ม ${e.contract.startedAt}`);
  commit(() => {
    e.status = "ทำงานอยู่";
    e.contract.probationUntil = TODAY;
    addEvent(e, { date: TODAY, type: "ผ่านทดลองงาน", detail: `บรรจุเป็น${e.contract.type} ตำแหน่ง ${e.position}` });
    log(id, "บันทึกผ่านทดลองงาน", e.position);
  });
}

export function renewErrors(e: Employee, endsAt: string): Errors {
  if (!e.contract.endsAt) return { endsAt: "สัญญานี้ไม่มีกำหนดสิ้นสุด" };
  if (!isDate(endsAt) || endsAt <= e.contract.endsAt) return { endsAt: `วันสิ้นสุดใหม่ต้องหลัง ${e.contract.endsAt}` };
  return {};
}

export function renewContract(id: number, endsAt: string) {
  const e = activeOf(id);
  const errors = renewErrors(e, endsAt);
  if (hasErrors(errors)) throw fail("ต่อสัญญาไม่ได้", errors);
  commit(() => {
    e.contract.endsAt = endsAt;
    addEvent(e, { date: TODAY, type: "ต่อสัญญา", detail: `ต่อสัญญาถึง ${thaiDate(endsAt)}` });
    log(id, "บันทึกต่อสัญญา", `ถึง ${thaiDate(endsAt)}`);
  });
}

export type ContractInput = { type: string; endsAt: string | null; workDays: string };

export function contractErrors(e: Employee, c: ContractInput): Errors {
  const out: Errors = {};
  if (!CONTRACT_TYPES.includes(c.type)) out.type = "เลือกประเภทการจ้าง";
  if (isFixedTerm(c.type) && !(c.endsAt && isDate(c.endsAt) && c.endsAt > e.contract.startedAt)) {
    out.endsAt = "สัญญามีกำหนดต้องมีวันสิ้นสุดหลังวันเริ่มงาน";
  }
  if (!WORK_WEEKS.includes(c.workDays)) out.workDays = "เลือกวันทำงาน";
  return out;
}

/** แก้เงื่อนไขการจ้าง การเปลี่ยนประเภทการจ้างขึ้นเป็นเหตุการณ์ในประวัติ */
export function changeContract(id: number, c: ContractInput) {
  const e = activeOf(id);
  const errors = contractErrors(e, c);
  if (hasErrors(errors)) throw fail("แก้ไขสัญญาไม่ได้", errors);
  commit(() => {
    const was = e.contract.type;
    e.contract.type = c.type;
    e.contract.endsAt = isFixedTerm(c.type) ? c.endsAt : null;
    e.contract.workDays = c.workDays;
    if (was !== c.type) addEvent(e, { date: TODAY, type: "เปลี่ยนประเภทการจ้าง", detail: `${was} → ${c.type}` });
    log(id, "แก้ไขเงื่อนไขการจ้าง", c.type + (e.contract.endsAt ? ` ถึง ${e.contract.endsAt}` : ""));
  });
}

/* ----------------------------------------------------------- admin data */

export function updateAdmin(id: number, a: AdminInput) {
  const errors = adminErrors(a);
  if (hasErrors(errors)) throw fail("แก้ไขข้อมูลทางปกครองไม่ได้", errors);
  const e = employeeOf(id);
  commit(() => {
    e.admin = { ssoNumber: a.ssoNumber, taxId: a.taxId, bankName: a.bankName, bankAccount: a.bankAccount.trim(), pvdRate: a.pvdRate };
    // กองทุนสำรองฯ แสดงในรายการสวัสดิการด้วย จึงต้องตามอัตราที่เพิ่งแก้
    const at = e.benefits.findIndex(isPvdBenefit);
    if (a.pvdRate > 0 && at >= 0) e.benefits[at] = pvdBenefit(a.pvdRate);
    else if (a.pvdRate > 0) e.benefits.push(pvdBenefit(a.pvdRate));
    else if (at >= 0) e.benefits.splice(at, 1);
    log(id, "แก้ไขข้อมูลทางปกครอง", `${a.bankName} · กองทุนสำรองฯ ${a.pvdRate}%`);
  });
}

export function setDocumentReceived(id: number, name: string, received: boolean) {
  employeeOf(id);
  if (!DOCUMENT_KINDS.includes(name)) throw new Error(`ไม่รู้จักเอกสาร ${name}`);
  commit(() => {
    const missing = new Set(MISSING_DOCS[id] ?? []);
    if (received) missing.delete(name);
    else missing.add(name);
    MISSING_DOCS[id] = DOCUMENT_KINDS.filter((d) => missing.has(d));
    log(id, received ? "รับเอกสาร" : "ยกเลิกการรับเอกสาร", name);
  });
}

/** ส่งเตือนคนที่เอกสารยังไม่ครบ คืนจำนวนคนที่ได้รับการเตือน */
export function remindDocuments(ids: number[]): number {
  const short = ids.map(employeeOf).filter((e) => isActive(e) && documentsOf(e).some((d) => !d.done));
  if (short.length === 0) return 0;
  commit(() => {
    for (const e of short) {
      log(e.id, "ส่งเตือนขอเอกสาร", documentsOf(e).filter((d) => !d.done).map((d) => d.name).join(", "));
    }
  });
  return short.length;
}

/* ------------------------------------------------------------- benefits */

/** เลือกสวัสดิการใหม่ทั้งชุด กองทุนสำรองฯ คงไว้ตามอัตราที่ตั้ง */
export function setBenefits(id: number, chosen: string[]) {
  const e = activeOf(id);
  const unknown = chosen.filter((b) => !BENEFIT_CATALOG.includes(b) && !e.benefits.includes(b));
  if (unknown.length) throw new Error(`ไม่มีสวัสดิการ ${unknown.join(", ")}`);
  const current = e.benefits.filter((b) => !isPvdBenefit(b));
  const added = chosen.filter((b) => !current.includes(b));
  const removed = current.filter((b) => !chosen.includes(b));
  commit(() => {
    e.benefits = [...chosen, ...e.benefits.filter(isPvdBenefit)];
    if (added.length) log(id, "ลงทะเบียนสวัสดิการ", added.join(", "));
    if (removed.length) log(id, "ยกเลิกสวัสดิการ", removed.join(", "));
  });
  return { added, removed };
}

/* ------------------------------------------------------ personnel actions */

export const ACTION_KINDS = ["ย้ายแผนก", "เลื่อนตำแหน่ง", "ปรับเงินเดือน", "ตักเตือน"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];
export type ActionStatus = "รออนุมัติ" | "อนุมัติแล้ว" | "ไม่อนุมัติ";
export type ActionValues = { department: string; position: string; salary: number };

/**
 * คำขอเปลี่ยนแปลงทางบุคคล — โยกย้าย เลื่อนตำแหน่ง ปรับเงินเดือน ตักเตือน
 *
 * ยังไม่แตะแฟ้มจนกว่าจะอนุมัติ เก็บค่าก่อนและหลังไว้ทั้งสองฝั่ง เพราะคำสั่งที่พิมพ์
 * ออกไปต้องบอกได้ว่าเปลี่ยนจากอะไรเป็นอะไร การตักเตือนไม่เปลี่ยนค่าใด สองฝั่งจึงเท่ากัน
 */
export type PersonnelAction = {
  id: string;
  employeeId: number;
  kind: ActionKind;
  effectiveDate: string;
  from: ActionValues;
  to: ActionValues;
  reason: string;
  requestedAt: string;
  requestedBy: string;
  status: ActionStatus;
  decidedAt?: string;
  decisionNote?: string;
};

export const PERSONNEL_ACTIONS: PersonnelAction[] = [
  {
    id: "HR-2567-0021", employeeId: 1, kind: "ปรับเงินเดือน", effectiveDate: "2024-04-01",
    from: { department: "ฝ่ายขาย", position: "หัวหน้าฝ่ายขาย", salary: 38000 },
    to: { department: "ฝ่ายขาย", position: "หัวหน้าฝ่ายขาย", salary: 45000 },
    reason: "ประเมินประจำปี A", requestedAt: "2024-03-18", requestedBy: "วิภาดา ศรีสุข",
    status: "อนุมัติแล้ว", decidedAt: "2024-03-25", decisionNote: "อนุมัติตามผลประเมิน",
  },
  {
    id: "HR-2569-0014", employeeId: 3, kind: "ปรับเงินเดือน", effectiveDate: "2026-10-01",
    from: { department: "ฝ่ายคลัง", position: "พนักงานคลังสินค้า", salary: 18000 },
    to: { department: "ฝ่ายคลัง", position: "พนักงานคลังสินค้า", salary: 19500 },
    reason: "ผลประเมินกลางปีระดับ B+ และรับผิดชอบรอบตรวจนับเพิ่ม", requestedAt: "2026-09-19", requestedBy: "ธีรศักดิ์ พูลทรัพย์",
    status: "รออนุมัติ",
  },
  {
    id: "HR-2569-0015", employeeId: 6, kind: "เลื่อนตำแหน่ง", effectiveDate: "2026-10-01",
    from: { department: "ฝ่ายขาย", position: "พนักงานขาย", salary: 22000 },
    to: { department: "ฝ่ายขาย", position: "พนักงานขายอาวุโส", salary: 25000 },
    reason: "ยอดขายเกินเป้าสามไตรมาสติดต่อกัน", requestedAt: "2026-09-21", requestedBy: "สมชาย รักดี",
    status: "รออนุมัติ",
  },
];

export const actionOf = (id: string): PersonnelAction => {
  const a = PERSONNEL_ACTIONS.find((x) => x.id === id);
  if (!a) throw new Error(`ไม่พบคำขอ ${id}`);
  return a;
};

export const actionsOf = (employeeId: number) => PERSONNEL_ACTIONS.filter((a) => a.employeeId === employeeId);
export const pendingActions = () => PERSONNEL_ACTIONS.filter((a) => a.status === "รออนุมัติ");

/** เลขคำขอถัดไปของปีนี้ ต่อจากเลขสูงสุดที่ออกไปแล้ว */
export function nextActionId(): string {
  const prefix = `HR-${beYear(TODAY)}-`;
  const top = Math.max(0, ...PERSONNEL_ACTIONS.filter((a) => a.id.startsWith(prefix)).map((a) => Number(a.id.slice(prefix.length))));
  return prefix + String(top + 1).padStart(4, "0");
}

export const valuesOf = (e: Employee): ActionValues => ({ department: e.department, position: e.position, salary: e.contract.baseSalary });

export type ActionInput = { employeeId: number; kind: ActionKind; effectiveDate: string; to: ActionValues; reason: string };

export function actionErrors(i: ActionInput): Errors {
  const out: Errors = {};
  const e = EMPLOYEES.find((x) => x.id === i.employeeId);
  if (!e || !isActive(e)) return { employeeId: "เลือกพนักงานที่ยังทำงานอยู่" };
  const from = valuesOf(e);
  if (PERSONNEL_ACTIONS.some((a) => a.employeeId === e.id && a.kind === i.kind && a.status === "รออนุมัติ")) {
    out.kind = `มีคำขอ${i.kind}ของ ${e.name} รออนุมัติอยู่แล้ว`;
  }
  if (!isDate(i.effectiveDate)) out.effectiveDate = "ระบุวันที่มีผล";
  if (i.kind === "ย้ายแผนก") {
    if (i.to.department === from.department) out.department = "เลือกแผนกใหม่ที่ต่างจากเดิม";
    if (i.to.position.trim().length < 2) out.position = "ระบุตำแหน่งในแผนกใหม่";
  }
  if (i.kind === "เลื่อนตำแหน่ง") {
    if (i.to.position.trim().length < 2 || i.to.position.trim() === from.position) out.position = "ระบุตำแหน่งใหม่ที่ต่างจากเดิม";
    if (i.to.salary < from.salary) out.salary = "การเลื่อนตำแหน่งไม่ลดเงินเดือน";
  }
  if (i.kind === "ปรับเงินเดือน" && i.to.salary === from.salary) out.salary = "เงินเดือนใหม่ต้องต่างจากเดิม";
  if (i.kind !== "ตักเตือน" && !(i.to.salary >= MIN_SALARY)) out.salary = `เงินเดือนต้องไม่ต่ำกว่า ${baht(MIN_SALARY)} บาท`;
  if (i.reason.trim().length < (i.kind === "ตักเตือน" ? 10 : 5)) {
    out.reason = i.kind === "ตักเตือน" ? "บรรยายการกระทำผิดอย่างน้อย 10 ตัวอักษร" : "ระบุเหตุผลอย่างน้อย 5 ตัวอักษร";
  }
  return out;
}

/** ยื่นคำขอ รออนุมัติ — แฟ้มยังไม่เปลี่ยนจนกว่าจะอนุมัติ */
export function requestAction(i: ActionInput, requestedBy = "คุณ"): PersonnelAction {
  const errors = actionErrors(i);
  if (hasErrors(errors)) throw fail("ยื่นคำขอไม่ได้", errors);
  const e = employeeOf(i.employeeId);
  const from = valuesOf(e);
  // แต่ละประเภทเปลี่ยนได้เฉพาะค่าของมัน ที่เหลือคงค่าเดิมไว้
  const to: ActionValues =
    i.kind === "ตักเตือน"
      ? from
      : i.kind === "ปรับเงินเดือน"
        ? { ...from, salary: i.to.salary }
        : { department: i.to.department, position: i.to.position.trim(), salary: i.to.salary };
  const action: PersonnelAction = {
    id: nextActionId(), employeeId: e.id, kind: i.kind, effectiveDate: i.effectiveDate,
    from, to, reason: i.reason.trim(), requestedAt: TODAY, requestedBy, status: "รออนุมัติ",
  };
  return commit(() => {
    PERSONNEL_ACTIONS.push(action);
    log(e.id, `ยื่นคำขอ${i.kind}`, action.id);
    return action;
  });
}

/** เงินเดือนใหม่เมื่อปรับเป็นร้อยละ ปัดเป็นหลักสิบบาทแบบที่ฝ่ายบุคคลปัดกัน */
export const raisedSalary = (salary: number, percent: number) => Math.round((salary * (1 + percent / 100)) / 10) * 10;

export function raiseErrors(percent: number, effectiveDate: string, reason: string): Errors {
  const out: Errors = {};
  if (!(percent >= 0.5 && percent <= 50)) out.percent = "ร้อยละที่ปรับต้องอยู่ระหว่าง 0.5 ถึง 50";
  if (!isDate(effectiveDate)) out.effectiveDate = "ระบุวันที่มีผล";
  if (reason.trim().length < 5) out.reason = "ระบุเหตุผลอย่างน้อย 5 ตัวอักษร";
  return out;
}

/** คนที่ปรับเงินเดือนรอบนี้ไม่ได้: พ้นสภาพแล้ว หรือมีคำขอปรับเงินเดือนค้างอยู่ */
export const raiseBlocked = (e: Employee) =>
  !isActive(e) || PERSONNEL_ACTIONS.some((a) => a.employeeId === e.id && a.kind === "ปรับเงินเดือน" && a.status === "รออนุมัติ");

/** ปรับเงินเดือนหลายคนพร้อมกันเป็นร้อยละ คนที่ปรับรอบนี้ไม่ได้ถูกข้าม ไม่ทำให้ทั้งชุดล้ม */
export function requestRaises(ids: number[], percent: number, effectiveDate: string, reason: string): PersonnelAction[] {
  const errors = raiseErrors(percent, effectiveDate, reason);
  if (hasErrors(errors)) throw fail("ปรับเงินเดือนไม่ได้", errors);
  return ids
    .map(employeeOf)
    .filter((e) => !raiseBlocked(e))
    .map((e) =>
      requestAction({
        employeeId: e.id, kind: "ปรับเงินเดือน", effectiveDate, reason,
        to: { ...valuesOf(e), salary: raisedSalary(e.contract.baseSalary, percent) },
      })
    );
}

function eventsFor(a: PersonnelAction): PersonnelEvent[] {
  const { from, to } = a;
  const date = a.effectiveDate;
  if (a.kind === "ตักเตือน") return [{ date, type: "ตักเตือน", detail: a.reason }];
  const moved = from.department !== to.department ? `${from.department} → ${to.department}` : "";
  const retitled = from.position !== to.position ? `${from.position} → ${to.position}` : "";
  const out: PersonnelEvent[] = [];
  if (a.kind === "ย้ายแผนก") {
    out.push({ date, type: "ย้ายแผนก", detail: [moved, retitled && "ตำแหน่ง " + retitled].filter(Boolean).join(" · ") });
  }
  if (a.kind === "เลื่อนตำแหน่ง") {
    out.push({ date, type: "เลื่อนตำแหน่ง", detail: [retitled, moved && "ย้ายไป" + to.department].filter(Boolean).join(" · ") });
  }
  if (from.salary !== to.salary) {
    out.push({
      date, type: "ปรับเงินเดือน",
      detail: `${baht(from.salary)} → ${baht(to.salary)}` + (a.kind === "ปรับเงินเดือน" ? ` (${a.reason})` : ""),
    });
  }
  return out;
}

/**
 * อนุมัติคำขอ: แฟ้มเปลี่ยนตามคำขอและประวัติได้เหตุการณ์ที่ตรงกัน
 *
 * เปลี่ยนเฉพาะค่าที่คำขอตั้งใจเปลี่ยน ถ้าระหว่างรออนุมัติมีคำขออื่นปรับเงินเดือน
 * ไปแล้ว คำขอย้ายแผนกฉบับนี้จะไม่ดึงเงินเดือนกลับไปเป็นค่าเก่า
 */
export function approveAction(id: string, note = ""): PersonnelAction {
  const a = actionOf(id);
  if (a.status !== "รออนุมัติ") throw new Error(`คำขอ ${id} ${a.status}แล้ว`);
  const e = activeOf(a.employeeId);
  return commit(() => {
    if (a.to.department !== a.from.department) e.department = a.to.department;
    if (a.to.position !== a.from.position) e.position = a.to.position;
    if (a.to.salary !== a.from.salary) e.contract.baseSalary = a.to.salary;
    for (const ev of eventsFor(a)) addEvent(e, ev);
    a.status = "อนุมัติแล้ว";
    a.decidedAt = TODAY;
    a.decisionNote = note.trim() || undefined;
    log(e.id, `อนุมัติ${a.kind}`, a.id);
    return a;
  });
}

export function rejectAction(id: string, note: string): PersonnelAction {
  const a = actionOf(id);
  if (a.status !== "รออนุมัติ") throw new Error(`คำขอ ${id} ${a.status}แล้ว`);
  if (note.trim().length < 5) throw new Error("ระบุเหตุผลที่ไม่อนุมัติอย่างน้อย 5 ตัวอักษร");
  return commit(() => {
    a.status = "ไม่อนุมัติ";
    a.decidedAt = TODAY;
    a.decisionNote = note.trim();
    log(a.employeeId, `ไม่อนุมัติ${a.kind}`, `${a.id} · ${note.trim()}`);
    return a;
  });
}

/* -------------------------------------------------------------- leaving */

export type SeparationInput = { kind: SeparationKind; noticeDate: string; lastDay: string; reason: string };

export function separationErrors(e: Employee, i: SeparationInput): Errors {
  const out: Errors = {};
  if (!isActive(e)) return { kind: `${e.name} พ้นสภาพแล้ว` };
  if (i.kind === "สิ้นสุดสัญญาจ้าง" && !isFixedTerm(e.contract.type)) out.kind = "ใช้ได้เฉพาะสัญญาจ้างที่มีกำหนดระยะเวลา";
  if (!isDate(i.noticeDate)) out.noticeDate = "ระบุวันที่แจ้ง";
  if (!isDate(i.lastDay) || i.lastDay < e.contract.startedAt) out.lastDay = "วันทำงานวันสุดท้ายต้องไม่ก่อนวันเริ่มงาน";
  else if (isDate(i.noticeDate) && i.noticeDate > i.lastDay) out.lastDay = "วันทำงานวันสุดท้ายต้องไม่ก่อนวันที่แจ้ง";
  if (i.reason.trim().length < 3) out.reason = "เลือกหรือระบุเหตุผล";
  return out;
}

const SEPARATION_EVENT: Record<SeparationKind, string> = {
  ลาออก: "ลาออก",
  เลิกจ้าง: "เลิกจ้าง",
  "เลิกจ้างตามมาตรา 119": "เลิกจ้าง",
  สิ้นสุดสัญญาจ้าง: "สิ้นสุดสัญญาจ้าง",
};

/**
 * ปิดแฟ้ม: บันทึกวันสุดท้าย เหตุผล และเงินที่ต้องจ่ายตามกฎหมาย
 *
 * สถานะเป็น "ลาออก" ไม่ว่าจะออกด้วยเหตุใด เพราะโมดูลอื่นใช้ค่านี้ตัดคนออกจาก
 * รอบเงินเดือนและตารางกะ ส่วนเหตุจริงอยู่ในบันทึกการพ้นสภาพ คำขอที่ยังค้างของคนนี้
 * ถูกปิดไปพร้อมกัน
 */
export function recordSeparation(id: number, i: SeparationInput, notified = false): Separation {
  const e = employeeOf(id);
  const errors = separationErrors(e, i);
  if (hasErrors(errors)) throw fail("บันทึกการพ้นสภาพไม่ได้", errors);
  const pay = separationPay(e, i.kind, i.noticeDate, i.lastDay);
  const separation: Separation = { kind: i.kind, noticeDate: i.noticeDate, lastDay: i.lastDay, reason: i.reason.trim(), ...pay };
  const detail = [
    separation.reason,
    i.kind === "เลิกจ้างตามมาตรา 119" ? "มาตรา 119 ไม่มีค่าชดเชย" : "",
    pay.severance > 0 ? `ค่าชดเชย ${baht(pay.severance)} บาท (${pay.severanceDays} วัน)` : "",
    pay.noticePay > 0 ? `ค่าจ้างแทนการบอกกล่าว ${baht(pay.noticePay)} บาท` : "",
    notified ? "แจ้งพนักงานแล้ว" : "",
  ].filter(Boolean).join(" · ");
  return commit(() => {
    e.status = "ลาออก";
    e.separation = separation;
    e.contract.endsAt = i.lastDay;
    addEvent(e, { date: i.lastDay, type: SEPARATION_EVENT[i.kind], detail });
    for (const a of PERSONNEL_ACTIONS) {
      if (a.employeeId === id && a.status === "รออนุมัติ") {
        a.status = "ไม่อนุมัติ";
        a.decidedAt = TODAY;
        a.decisionNote = "พนักงานพ้นสภาพก่อนอนุมัติ";
      }
    }
    log(id, `บันทึก${i.kind}`, separation.reason);
    return separation;
  });
}

/* -------------------------------------------------------------- letters */

export const LETTER_KINDS = ["หนังสือรับรองการทำงาน", "หนังสือรับรองเงินเดือน"] as const;
export type LetterKind = (typeof LETTER_KINDS)[number];
export type IssuedLetter = { no: string; employeeId: number; kind: LetterKind; purpose: string; issuedAt: string };

/** ทะเบียนหนังสือที่ฝ่ายบุคคลออก — เลขที่เรียงต่อกันทั้งปี */
export const LETTERS: IssuedLetter[] = [
  { no: "HR 041/2569", employeeId: 2, kind: "หนังสือรับรองเงินเดือน", purpose: "ประกอบการขอสินเชื่อที่อยู่อาศัย", issuedAt: "2026-09-10" },
];

export function nextLetterNo(): string {
  const tail = `/${beYear(TODAY)}`;
  const top = Math.max(0, ...LETTERS.filter((l) => l.no.endsWith(tail)).map((l) => Number(l.no.slice(3, -tail.length))));
  return `HR ${String(top + 1).padStart(3, "0")}${tail}`;
}

export function letterErrors(e: Employee, kind: LetterKind, purpose: string): Errors {
  const out: Errors = {};
  if (kind === "หนังสือรับรองเงินเดือน" && !isActive(e)) out.kind = "รับรองเงินเดือนได้เฉพาะคนที่ยังทำงานอยู่";
  if (purpose.trim().length < 3) out.purpose = "ระบุว่านำไปใช้เพื่ออะไร";
  return out;
}

export function issueLetter(employeeId: number, kind: LetterKind, purpose: string): IssuedLetter {
  const e = employeeOf(employeeId);
  const errors = letterErrors(e, kind, purpose);
  if (hasErrors(errors)) throw fail("ออกหนังสือไม่ได้", errors);
  const letter: IssuedLetter = { no: nextLetterNo(), employeeId, kind, purpose: purpose.trim(), issuedAt: TODAY };
  return commit(() => {
    LETTERS.push(letter);
    log(employeeId, `ออก${kind}`, letter.no);
    return letter;
  });
}

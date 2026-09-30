import { commit } from "../kit";
import { PEOPLE, TODAY, YEAR, addDays, assertValid, contributeReviewInput, isDate, nextNo } from "../ims/data";
import type { Errors } from "../ims/data";
import { MATERIALS, REQUISITIONS, createRequisition, postStockMove } from "../mm/data";
import { CONFIRMATIONS, ORDERS, WORK_CENTERS } from "../pp/data";

export { TODAY };
export type { Errors };

/**
 * การบำรุงรักษาเชิงป้องกันแบบทั่วถึง (TPM) ตาม IATF 16949 ข้อ 8.5.1.5
 *
 * เครื่องจักรผูกกับศูนย์งานของระบบวางแผนการผลิต OEE จึงคำนวณจากการยืนยันงานจริงของฝ่ายผลิต
 * กับเวลาหยุดจากใบแจ้งซ่อม อะไหล่ที่ใช้ซ่อมเบิกจากคลังวัสดุจริง และอะไหล่วิกฤตที่ต่ำกว่าขั้นต่ำ
 * เปิดใบขอซื้อในระบบจัดซื้อให้ แม่พิมพ์นับรอบบำรุงรักษาตามจำนวนครั้งปั๊ม ไม่ใช่ตามวัน
 */

/* =============================================================== machines */

export const KINDS = ["เครื่องจักร", "แม่พิมพ์", "ระบบสนับสนุน"] as const;
export type Kind = (typeof KINDS)[number];
export type MachineStatus = "ใช้งาน" | "รอซ่อม" | "กำลังซ่อม" | "หยุดใช้";

export type Machine = {
  code: string;
  name: string;
  kind: Kind;
  /** ศูนย์งานในระบบวางแผนการผลิต — ระบบสนับสนุนไม่มี */
  wc?: string;
  /** เครื่องจักรหลักที่หยุดแล้วกระทบการส่งมอบลูกค้า (IATF 8.5.1.5) */
  critical: boolean;
  maker: string;
  installed: string;
  status: MachineStatus;
  /** จำนวนครั้งปั๊มสะสมของแม่พิมพ์ */
  shots?: number;
};

export const MACHINES: Machine[] = [
  { code: "M-PR-01", name: "เครื่องปั๊ม 200 ตัน", kind: "เครื่องจักร", wc: "WC-PRESS", critical: true, maker: "Amada TP-200", installed: "2026-06-18", status: "ใช้งาน" },
  { code: "DIE-BK220", name: "แม่พิมพ์ต่อเนื่อง BK-220", kind: "แม่พิมพ์", wc: "WC-PRESS", critical: true, maker: "ทำโดยผู้รับจ้างแม่พิมพ์", installed: "2026-06-20", status: "ใช้งาน", shots: 46200 },
  { code: "M-LS-01", name: "เครื่องตัดเลเซอร์ไฟเบอร์", kind: "เครื่องจักร", wc: "WC-CUT", critical: true, maker: "Bodor i5", installed: "2024-03-11", status: "ใช้งาน" },
  { code: "M-PB-01", name: "เครื่องพับไฮดรอลิก", kind: "เครื่องจักร", wc: "WC-CUT", critical: false, maker: "Durma AD-S", installed: "2023-08-02", status: "ใช้งาน" },
  { code: "M-WD-01", name: "ตู้เชื่อม MIG สาย 1", kind: "เครื่องจักร", wc: "WC-WELD", critical: false, maker: "Panasonic YD-350", installed: "2022-05-16", status: "ใช้งาน" },
  { code: "M-WD-02", name: "ตู้เชื่อม MIG สาย 2", kind: "เครื่องจักร", wc: "WC-WELD2", critical: false, maker: "Panasonic YD-350", installed: "2025-01-20", status: "ใช้งาน" },
  { code: "M-OV-01", name: "เตาอบสีฝุ่น", kind: "เครื่องจักร", wc: "WC-PAINT", critical: true, maker: "ผลิตในประเทศ", installed: "2021-11-01", status: "รอซ่อม" },
  { code: "M-AC-01", name: "ปั๊มลมสกรู 15 kW", kind: "ระบบสนับสนุน", critical: true, maker: "Atlas Copco GA15", installed: "2021-11-01", status: "ใช้งาน" },
  { code: "M-FL-01", name: "รถยก 2.5 ตัน", kind: "ระบบสนับสนุน", critical: false, maker: "Toyota 8FD25", installed: "2023-02-14", status: "ใช้งาน" },
];

export const machineByCode = (code: string) => {
  const m = MACHINES.find((x) => x.code === code);
  if (!m) throw new Error(`ไม่พบเครื่องจักร ${code}`);
  return m;
};

export const wcName = (code?: string) => (code ? WORK_CENTERS.find((w) => w.code === code)?.name ?? code : "ระบบสนับสนุน");

export type MachineInput = Omit<Machine, "status" | "shots">;

export function machineErrors(input: MachineInput): Errors {
  const e: Errors = {};
  if (!/^[A-Z]+-[A-Z0-9]+(-\d+)?$/.test(input.code.trim())) e.code = "รหัสรูปแบบ M-XX-00 หรือ DIE-XXXX";
  else if (MACHINES.some((m) => m.code === input.code.trim())) e.code = "รหัสนี้มีอยู่แล้ว";
  if (input.name.trim().length < 3) e.name = "ใส่ชื่อเครื่อง";
  if (input.kind !== "ระบบสนับสนุน" && !WORK_CENTERS.some((w) => w.code === input.wc)) e.wc = "เลือกศูนย์งานที่เครื่องนี้อยู่";
  if (!isDate(input.installed) || input.installed > TODAY) e.installed = "วันที่ติดตั้งต้องไม่เกินวันนี้";
  return e;
}

export function addMachine(input: MachineInput) {
  assertValid(machineErrors(input));
  return commit(() => {
    const m: Machine = { ...input, code: input.code.trim(), name: input.name.trim(), wc: input.kind === "ระบบสนับสนุน" ? undefined : input.wc, status: "ใช้งาน", shots: input.kind === "แม่พิมพ์" ? 0 : undefined };
    MACHINES.push(m);
    return m;
  });
}

/** อ่านมิเตอร์จำนวนครั้งปั๊มของแม่พิมพ์ — ลดลงไม่ได้ */
export function recordShots(code: string, shots: number) {
  const m = machineByCode(code);
  if (m.kind !== "แม่พิมพ์") throw new Error(`${m.name} ไม่ใช่แม่พิมพ์`);
  if (!Number.isInteger(shots) || shots < (m.shots ?? 0)) throw new Error(`มิเตอร์ต้องไม่น้อยกว่าเดิม ${(m.shots ?? 0).toLocaleString("th-TH")} ครั้ง`);
  return commit(() => {
    m.shots = shots;
    return m;
  });
}

/* ============================================================== pm plans */

export type PmPlan = {
  code: string;
  machine: string;
  task: string;
  /** PM ช่างซ่อมบำรุงทำ · AM ผู้ควบคุมเครื่องทำเองทุกกะ */
  type: "PM" | "AM";
  checklist: string[];
  everyDays?: number;
  everyShots?: number;
  lastDone: string;
  lastShots?: number;
};

export const PLANS: PmPlan[] = [
  { code: "PM-PR-01", machine: "M-PR-01", task: "ตรวจระบบไฮดรอลิกและน้ำมันหล่อลื่น", type: "PM", checklist: ["ระดับและสีน้ำมันไฮดรอลิก", "รอยรั่วที่ข้อต่อ", "แรงดันระบบ 210 บาร์", "จาระบีแกนสไลด์"], everyDays: 30, lastDone: "2026-08-25" },
  { code: "AM-PR-01", machine: "M-PR-01", task: "ทำความสะอาดและตรวจรอบเครื่องประจำกะ", type: "AM", checklist: ["เก็บเศษเหล็กใต้แม่พิมพ์", "ม่านแสงนิรภัยทำงาน", "ปุ่มหยุดฉุกเฉินทำงาน"], everyDays: 1, lastDone: "2026-09-22" },
  { code: "PM-DIE-01", machine: "DIE-BK220", task: "เปลี่ยนไกด์พินและลับพันช์", type: "PM", checklist: ["เปลี่ยนไกด์พิน 4 ตัว", "ลับพันช์เจาะรู", "ตรวจระยะห่างพันช์กับดาย", "ปั๊มทดลองและวัดชิ้นแรก"], everyShots: 50000, lastDone: "2026-06-20", lastShots: 0 },
  { code: "PM-LS-01", machine: "M-LS-01", task: "ทำความสะอาดเลนส์และตรวจหัวตัด", type: "PM", checklist: ["เลนส์ป้องกัน", "หัวฉีดก๊าซ", "ตั้งศูนย์ลำแสง"], everyDays: 14, lastDone: "2026-09-01" },
  { code: "PM-OV-01", machine: "M-OV-01", task: "ตรวจหัวเผาและพัดลมหมุนเวียน", type: "PM", checklist: ["หัวเผาและระบบจุดไฟ", "ลูกปืนพัดลมหมุนเวียน", "เทอร์โมคัปเปิลเทียบค่า"], everyDays: 90, lastDone: "2026-07-10" },
  { code: "PM-AC-01", machine: "M-AC-01", task: "เปลี่ยนไส้กรองและน้ำมันปั๊มลม", type: "PM", checklist: ["ไส้กรองอากาศ", "ไส้กรองน้ำมัน", "น้ำมันคอมเพรสเซอร์", "ถ่ายน้ำถังพัก"], everyDays: 60, lastDone: "2026-08-02" },
  { code: "PM-WD-01", machine: "M-WD-01", task: "ตรวจสายเชื่อมและชุดป้อนลวด", type: "PM", checklist: ["สายเชื่อมและหัวทิพ", "ลูกกลิ้งป้อนลวด", "ระบบระบายความร้อน"], everyDays: 30, lastDone: "2026-09-05" },
  { code: "PM-FL-01", machine: "M-FL-01", task: "ตรวจเช็คประจำเดือน", type: "PM", checklist: ["เบรกและพวงมาลัย", "โซ่และงายก", "แตรและไฟเตือน"], everyDays: 30, lastDone: "2026-09-01" },
];

export const planByCode = (code: string) => {
  const p = PLANS.find((x) => x.code === code);
  if (!p) throw new Error(`ไม่พบแผน ${code}`);
  return p;
};

/** ครบรอบเมื่อไร — แผนตามวันบอกวัน แผนตามครั้งปั๊มบอกสัดส่วนที่ใช้ไป */
export function pmDue(p: PmPlan) {
  if (p.everyShots) {
    const used = (machineByCode(p.machine).shots ?? 0) - (p.lastShots ?? 0);
    const pct = Math.round((used / p.everyShots) * 100);
    return { label: `${used.toLocaleString("th-TH")} จาก ${p.everyShots.toLocaleString("th-TH")} ครั้ง`, late: used >= p.everyShots, soon: pct >= 90, pct };
  }
  const due = addDays(p.lastDone, p.everyDays!);
  return { label: `ครบกำหนด ${due}`, late: due < TODAY, soon: due <= addDays(TODAY, 7), pct: 0, due };
}

export const pmOverdue = () => PLANS.filter((p) => p.type === "PM" && pmDue(p).late);
export const pmSoon = () => PLANS.filter((p) => p.type === "PM" && !pmDue(p).late && pmDue(p).soon);

export type PmRecord = { plan: string; date: string; by: string; checked: boolean[]; findings: string; shots?: number };

export const PM_RECORDS: PmRecord[] = [
  { plan: "PM-PR-01", date: "2026-08-25", by: "ประสิทธิ์ ขยันยิ่ง", checked: [true, true, true, true], findings: "" },
  { plan: "PM-LS-01", date: "2026-09-01", by: "ประสิทธิ์ ขยันยิ่ง", checked: [true, true, true], findings: "" },
  { plan: "PM-AC-01", date: "2026-08-02", by: "ประสิทธิ์ ขยันยิ่ง", checked: [true, true, true, true], findings: "ไส้กรองอากาศสกปรกเร็ว ย้ายช่องรับอากาศออกจากพื้นที่พ่นสี" },
  { plan: "PM-DIE-01", date: "2026-06-20", by: "ประสิทธิ์ ขยันยิ่ง", checked: [true, true, true, true], findings: "ติดตั้งแม่พิมพ์ใหม่", shots: 0 },
];

export type PmInput = { by: string; checked: boolean[]; findings: string; date: string };

export function pmErrors(code: string, input: PmInput): Errors {
  const p = planByCode(code);
  const e: Errors = {};
  if (!PEOPLE.includes(input.by)) e.by = "เลือกผู้ทำ";
  if (input.checked.length !== p.checklist.length) e.checked = "ตรวจให้ครบทุกข้อ";
  else if (input.checked.some((c) => !c) && input.findings.trim().length < 10) e.findings = "ข้อที่ไม่ผ่านต้องบอกสิ่งที่พบและสิ่งที่ทำต่อ";
  if (!isDate(input.date) || input.date > TODAY) e.date = "วันที่ต้องไม่เกินวันนี้";
  if (machineByCode(p.machine).status === "หยุดใช้") e.by = "เครื่องหยุดใช้อยู่";
  return e;
}

/** บันทึกผล PM — เริ่มรอบใหม่ แม่พิมพ์เริ่มนับครั้งปั๊มจากมิเตอร์ปัจจุบัน */
export function recordPm(code: string, input: PmInput) {
  assertValid(pmErrors(code, input));
  const p = planByCode(code);
  const m = machineByCode(p.machine);
  return commit(() => {
    const r: PmRecord = { plan: code, date: input.date, by: input.by, checked: [...input.checked], findings: input.findings.trim(), shots: m.shots };
    PM_RECORDS.push(r);
    p.lastDone = input.date;
    if (p.everyShots) p.lastShots = m.shots ?? 0;
    return r;
  });
}

/* ========================================================== work requests */

export type PartUsed = { material: string; qty: number; doc?: string };

export type WorkRequest = {
  no: string;
  machine: string;
  reportedOn: string;
  reportedBy: string;
  symptom: string;
  status: "รอซ่อม" | "กำลังซ่อม" | "ซ่อมเสร็จ";
  technician?: string;
  startedOn?: string;
  finishedOn?: string;
  downtimeHrs?: number;
  cause?: string;
  fix?: string;
  parts: PartUsed[];
};

export const REQUESTS: WorkRequest[] = [
  { no: "WR-2569-028", machine: "M-LS-01", reportedOn: "2026-09-10", reportedBy: "อนุชา ทองดี", symptom: "หัวตัดชนแผ่นเหล็กที่บิดงอ", status: "ซ่อมเสร็จ", technician: "ประสิทธิ์ ขยันยิ่ง", startedOn: "2026-09-10", finishedOn: "2026-09-10", downtimeHrs: 6, cause: "แผ่นเหล็กบิดจากการวางซ้อนผิดวิธี", fix: "เปลี่ยนหัวฉีดและตั้งศูนย์ใหม่", parts: [] },
  { no: "WR-2569-029", machine: "M-WD-01", reportedOn: "2026-09-12", reportedBy: "สมปอง ใจกล้า", symptom: "ลวดเชื่อมป้อนไม่สม่ำเสมอ", status: "ซ่อมเสร็จ", technician: "ประสิทธิ์ ขยันยิ่ง", startedOn: "2026-09-12", finishedOn: "2026-09-12", downtimeHrs: 3, cause: "ลูกกลิ้งป้อนลวดสึก", fix: "เปลี่ยนลูกกลิ้งป้อนลวด", parts: [] },
  { no: "WR-2569-030", machine: "M-AC-01", reportedOn: "2026-09-16", reportedBy: "อนุชา ทองดี", symptom: "แรงดันลมตก มีเสียงดังที่มอเตอร์", status: "ซ่อมเสร็จ", technician: "ประสิทธิ์ ขยันยิ่ง", startedOn: "2026-09-16", finishedOn: "2026-09-16", downtimeHrs: 4, cause: "ตลับลูกปืนมอเตอร์แตก", fix: "เปลี่ยนตลับลูกปืน 2 ตัว", parts: [{ material: "MAT-2002", qty: 2 }] },
  { no: "WR-2569-031", machine: "M-OV-01", reportedOn: "2026-09-21", reportedBy: "มานพ รุ่งเรือง", symptom: "พัดลมหมุนเวียนเสียงดังผิดปกติ", status: "รอซ่อม", parts: [] },
];

export const requestByNo = (no: string) => {
  const r = REQUESTS.find((x) => x.no === no);
  if (!r) throw new Error(`ไม่พบ ${no}`);
  return r;
};

export const openRequests = () => REQUESTS.filter((r) => r.status !== "ซ่อมเสร็จ");

export type BreakdownInput = { machine: string; symptom: string; reportedBy: string };

export function breakdownErrors(input: BreakdownInput): Errors {
  const e: Errors = {};
  const m = MACHINES.find((x) => x.code === input.machine);
  if (!m) e.machine = "เลือกเครื่องจักร";
  else if (openRequests().some((r) => r.machine === m.code)) e.machine = `${m.name} มีใบแจ้งซ่อมค้างอยู่แล้ว`;
  if (input.symptom.trim().length < 5) e.symptom = "อาการที่พบ";
  if (!PEOPLE.includes(input.reportedBy)) e.reportedBy = "เลือกผู้แจ้ง";
  return e;
}

export function reportBreakdown(input: BreakdownInput) {
  assertValid(breakdownErrors(input));
  const m = machineByCode(input.machine);
  return commit(() => {
    const r: WorkRequest = { no: nextNo(REQUESTS.map((x) => x.no), `WR-${YEAR}-`, 3), machine: m.code, reportedOn: TODAY, reportedBy: input.reportedBy, symptom: input.symptom.trim(), status: "รอซ่อม", parts: [] };
    REQUESTS.push(r);
    m.status = "รอซ่อม";
    return r;
  });
}

export function startRepair(no: string, technician: string) {
  const r = requestByNo(no);
  if (r.status !== "รอซ่อม") throw new Error(`${no} ${r.status}`);
  if (!PEOPLE.includes(technician)) throw new Error("เลือกช่างผู้ซ่อม");
  return commit(() => {
    r.status = "กำลังซ่อม";
    r.technician = technician;
    r.startedOn = TODAY;
    machineByCode(r.machine).status = "กำลังซ่อม";
    return r;
  });
}

export type RepairInput = { cause: string; fix: string; hours: number; parts: { material: string; qty: number }[] };

export function repairErrors(no: string, input: RepairInput): Errors {
  const r = requestByNo(no);
  const e: Errors = {};
  if (r.status !== "กำลังซ่อม") e.cause = "เริ่มซ่อมก่อนปิดงาน";
  if (input.cause.trim().length < 5) e.cause = e.cause ?? "สาเหตุที่พบ";
  if (input.fix.trim().length < 5) e.fix = "สิ่งที่ทำ";
  if (!(input.hours > 0)) e.hours = "เวลาเครื่องหยุด (ชั่วโมง)";
  for (const p of input.parts) {
    const m = MATERIALS.find((x) => x.code === p.material);
    if (!m) e.parts = "เลือกอะไหล่จากคลังวัสดุ";
    else if (!(p.qty > 0)) e.parts = "จำนวนอะไหล่มากกว่าศูนย์";
    else if (p.qty > m.stock) e.parts = `${m.name} ในคลังเหลือ ${m.stock} ${m.unit}`;
  }
  return e;
}

/** ปิดงานซ่อม — อะไหล่ที่ใช้เบิกจากคลังวัสดุจริงใต้เลขใบแจ้งซ่อม เครื่องกลับมาใช้งาน */
export function completeRepair(no: string, input: RepairInput) {
  assertValid(repairErrors(no, input));
  const r = requestByNo(no);
  const m = machineByCode(r.machine);
  return commit(() => {
    r.parts = input.parts.map((p) => {
      const move = postStockMove({ kind: "เบิกใช้", material: p.material, qty: p.qty, department: "ฝ่ายซ่อมบำรุง", reason: `ซ่อม ${m.name} ตาม ${r.no}`, date: TODAY });
      return { material: p.material, qty: p.qty, doc: move.doc };
    });
    r.status = "ซ่อมเสร็จ";
    r.finishedOn = TODAY;
    r.downtimeHrs = input.hours;
    r.cause = input.cause.trim();
    r.fix = input.fix.trim();
    m.status = "ใช้งาน";
    return r;
  });
}

/* ============================================================ reliability */

/** เวลาที่วางแผนให้เครื่องทำงาน สองกะต่อวัน */
export const HOURS_PER_DAY = 16;
export const WINDOW_DAYS = 90;

/** MTBF MTTR ในช่วง 90 วัน — เวลาทำงานเฉลี่ยก่อนเสีย และเวลาซ่อมเฉลี่ย */
export function reliability(code: string) {
  const since = addDays(TODAY, -WINDOW_DAYS);
  const done = REQUESTS.filter((r) => r.machine === code && r.status === "ซ่อมเสร็จ" && r.reportedOn >= since);
  const down = done.reduce((n, r) => n + (r.downtimeHrs ?? 0), 0);
  const scheduled = WINDOW_DAYS * HOURS_PER_DAY;
  return {
    failures: done.length,
    downtime: down,
    mttr: done.length ? Math.round((down / done.length) * 10) / 10 : undefined,
    mtbf: done.length ? Math.round((scheduled - down) / done.length) : undefined,
  };
}

/** OEE ของศูนย์งานใน 14 วัน — ความพร้อม × ประสิทธิภาพ × คุณภาพ จากการยืนยันงานจริงของฝ่ายผลิต */
export function oee(wc: string) {
  const since = addDays(TODAY, -14);
  const center = WORK_CENTERS.find((w) => w.code === wc);
  if (!center) throw new Error(`ไม่พบศูนย์งาน ${wc}`);
  const machines = MACHINES.filter((m) => m.wc === wc).map((m) => m.code);
  const downtime = REQUESTS.filter((r) => machines.includes(r.machine) && r.reportedOn >= since).reduce((n, r) => n + (r.downtimeHrs ?? 0), 0);
  const confs = CONFIRMATIONS.filter((c) => c.wc === wc && c.date >= since);
  const ideal = confs.reduce((n, c) => {
    const op = ORDERS.find((o) => o.no === c.order)?.operations.find((x) => x.op === c.op);
    return n + (op?.hrs ?? 0) * (c.yield + c.scrap);
  }, 0);
  const actual = confs.reduce((n, c) => n + c.hrs, 0);
  const good = confs.reduce((n, c) => n + c.yield, 0);
  const total = confs.reduce((n, c) => n + c.yield + c.scrap, 0);
  const availability = Math.max(0, (center.capacityHrs - downtime) / center.capacityHrs);
  const performance = actual ? Math.min(1, ideal / actual) : undefined;
  const quality = total ? good / total : undefined;
  const value = performance !== undefined && quality !== undefined ? availability * performance * quality : undefined;
  const pct = (x?: number) => (x === undefined ? undefined : Math.round(x * 1000) / 10);
  return { wc, name: center.name, availability: pct(availability)!, performance: pct(performance), quality: pct(quality), oee: pct(value), downtime, runs: confs.length };
}

/** OEE ทุกศูนย์งานที่มีเครื่องจักรในทะเบียน */
export const oeeAll = () => [...new Set(MACHINES.map((m) => m.wc).filter((x): x is string => !!x))].map(oee);

/* ================================================================ spares */

export type Spare = { material: string; machine: string; min: number };

/** อะไหล่วิกฤต — อ่านคงเหลือจากคลังวัสดุ ต่ำกว่าขั้นต่ำคือเสี่ยงเครื่องหยุดนาน */
export const SPARES: Spare[] = [
  { material: "MAT-2002", machine: "M-AC-01", min: 10 },
  { material: "MAT-4001", machine: "M-OV-01", min: 2 },
  { material: "MAT-2001", machine: "M-PR-01", min: 20 },
];

export const spareStock = (s: Spare) => MATERIALS.find((m) => m.code === s.material)?.stock ?? 0;
export const spareName = (s: Spare) => MATERIALS.find((m) => m.code === s.material)?.name ?? s.material;
export const openRequisition = (material: string) => REQUISITIONS.find((r) => r.lines.some((l) => l.material === material) && (r.status === "รออนุมัติ" || r.status === "อนุมัติแล้ว"));

/** ความต้องการต่ออะไหล่ — อะไหล่ชิ้นเดียวอาจวิกฤตกับหลายเครื่อง ขั้นต่ำจึงรวมกันทุกเครื่อง */
export const spareNeeds = () =>
  [...new Set(SPARES.map((s) => s.material))].map((material) => {
    const rows = SPARES.filter((s) => s.material === material);
    return { material, name: spareName(rows[0]), machines: rows.map((r) => r.machine), min: rows.reduce((n, r) => n + r.min, 0), stock: spareStock(rows[0]) };
  });

export const sparesBelow = () => spareNeeds().filter((s) => s.stock < s.min);

export function spareErrors(input: Spare): Errors {
  const e: Errors = {};
  const m = MATERIALS.find((x) => x.code === input.material);
  if (!m) e.material = "เลือกอะไหล่จากคลังวัสดุ";
  else if (SPARES.some((s) => s.material === input.material && s.machine === input.machine)) e.material = "อะไหล่นี้ผูกกับเครื่องนี้แล้ว";
  if (!MACHINES.some((x) => x.code === input.machine)) e.machine = "เลือกเครื่องจักร";
  if (!(Number.isInteger(input.min) && input.min > 0)) e.min = "ขั้นต่ำเป็นจำนวนเต็มมากกว่าศูนย์";
  return e;
}

export function addSpare(input: Spare) {
  assertValid(spareErrors(input));
  return commit(() => {
    SPARES.push({ ...input });
    return input;
  });
}

/** ขอซื้ออะไหล่วิกฤตที่ต่ำกว่าขั้นต่ำ — เปิดใบขอซื้อในระบบจัดซื้อ เติมให้ถึงสองเท่าของขั้นต่ำ */
export function requestSpare(material: string) {
  const need = spareNeeds().find((x) => x.material === material);
  if (!need) throw new Error("ไม่ใช่อะไหล่วิกฤต");
  if (need.stock >= need.min) throw new Error(`${need.name} ยังไม่ต่ำกว่าขั้นต่ำ ${need.min}`);
  const open = openRequisition(material);
  if (open) throw new Error(`มีใบขอซื้อ ${open.no} รออยู่แล้ว`);
  const m = MATERIALS.find((x) => x.code === material)!;
  return createRequisition({
    requester: "ฝ่ายซ่อมบำรุง", needBy: addDays(TODAY, 7), note: `อะไหล่วิกฤตของ ${need.machines.map((c) => machineByCode(c).name).join(", ")} ต่ำกว่าขั้นต่ำ`,
    lines: [{ material, qty: need.min * 2 - need.stock, price: m.price }],
  });
}

/* ======================================================== review inputs */

const toneOf = (bad: boolean, warn = false) => (bad ? "bad" : warn ? "warn" : "ok") as "bad" | "warn" | "ok";

contributeReviewInput({
  key: "tpm-equipment", std: ["IATF 16949"], input: "IATF 9.3.2.1", title: "ประสิทธิผลของการบำรุงรักษา",
  facts: () => {
    const measured = oeeAll().filter((x) => x.oee !== undefined);
    const avg = measured.length ? Math.round((measured.reduce((n, x) => n + x.oee!, 0) / measured.length) * 10) / 10 : undefined;
    return [
      { label: "OEE เฉลี่ย 14 วัน", value: avg === undefined ? "—" : `${avg}%`, tone: avg === undefined ? "idle" : toneOf(avg < 60, avg < 75) },
      { label: "PM เลยกำหนด", value: `${pmOverdue().length} แผน`, tone: toneOf(pmOverdue().length > 0) },
      { label: "อะไหล่วิกฤตต่ำกว่าขั้นต่ำ", value: `${sparesBelow().length} รายการ`, tone: toneOf(sparesBelow().length > 0) },
    ];
  },
});

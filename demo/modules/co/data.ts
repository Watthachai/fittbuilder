import { commit } from "../kit";
import { material, FINISHED_GOODS } from "../mm/data";
import { BILLINGS, CREDIT_NOTES, customer, invoiceLines, isCancelled, salesOrder } from "../sd/data";
import { ACCOUNTS, ASSETS, COMPANY, PERIOD, TODAY, balanceOf, profitAndLoss, trialBalance, baht } from "../fi/data";

export { baht, COMPANY };

export type ProfitCenter = { code: string; name: string };

export const PROFIT_CENTERS: ProfitCenter[] = [
  { code: "PC-MFG", name: "สายการผลิต" },
  { code: "PC-TRD", name: "สายการค้า" },
  { code: "PC-ADM", name: "สำนักงานกลาง" },
];

export type CostCenter = { code: string; name: string; profitCenter: string; budget: number; owner: string };

export const COST_CENTERS: CostCenter[] = [
  { code: "CC-PROD", name: "ฝ่ายผลิต", profitCenter: "PC-MFG", budget: 145000, owner: "หัวหน้าสายการผลิต" },
  { code: "CC-WH", name: "ฝ่ายคลัง", profitCenter: "PC-MFG", budget: 68000, owner: "ผู้จัดการคลัง" },
  { code: "CC-SALE", name: "ฝ่ายขาย", profitCenter: "PC-TRD", budget: 105000, owner: "หัวหน้าฝ่ายขาย" },
  { code: "CC-ADM", name: "ฝ่ายบริหารและบัญชี", profitCenter: "PC-ADM", budget: 120000, owner: "นักบัญชีอาวุโส" },
];

/** ช่องทางขายแต่ละช่องทางนำรายได้เข้าศูนย์กำไรไหน */
export const CHANNEL_PROFIT_CENTER: Record<string, string> = {
  ขายตรง: "PC-MFG",
  ตัวแทนจำหน่าย: "PC-TRD",
  ขายหน้าร้าน: "PC-TRD",
};

/**
 * สัดส่วนที่แต่ละศูนย์ต้นทุนรับค่าใช้จ่าย — รวมกันได้ 1.00 ต่อบัญชี
 * ยอดจริงจึงมาจากสมุดรายวัน ไม่ใช่ตัวเลขที่ตั้งไว้เอง
 *
 * ต้นทุนขายไม่อยู่ในนี้: มันเป็นต้นทุนของผลิตภัณฑ์ที่ไปโผล่ในกำไรขั้นต้น
 * ไม่ใช่ค่าใช้จ่ายที่หัวหน้าหน่วยงานคุมได้ เอามาปนจะทำให้ทุกฝ่ายผลิตเกินงบเสมอ
 */
export const ALLOCATION: Record<string, Record<string, number>> = {
  "5110": { "CC-PROD": 0.45, "CC-WH": 0.15, "CC-SALE": 0.2, "CC-ADM": 0.2 },
  "5210": { "CC-PROD": 0.7, "CC-WH": 0.2, "CC-ADM": 0.1 },
  "5310": { "CC-PROD": 0.1, "CC-WH": 0.1, "CC-SALE": 0.45, "CC-ADM": 0.35 },
};

/**
 * รอบปันส่วน: ศูนย์ส่งปันยอดทั้งหมดที่มีอยู่ตอนรัน ให้ศูนย์รับตามสัดส่วน
 * ศูนย์ส่งจึงเหลือศูนย์ และยอดรวมทั้งบริษัทไม่เปลี่ยน
 */
export type AllocationCycle = { code: string; name: string; sender: string; receivers: Record<string, number> };

export const CYCLES: AllocationCycle[] = [
  { code: "CY-01", name: "ปันส่วนค่าบริหารและบัญชีเข้าหน่วยงานปฏิบัติการ", sender: "CC-ADM", receivers: { "CC-PROD": 0.5, "CC-WH": 0.2, "CC-SALE": 0.3 } },
  { code: "CY-02", name: "ปันส่วนค่าคลังเข้าฝ่ายผลิตและฝ่ายขาย", sender: "CC-WH", receivers: { "CC-PROD": 0.6, "CC-SALE": 0.4 } },
];

export type AllocationPosting = {
  no: string; date: string; cycle: string; sender: string; amount: number;
  lines: { costCenter: string; amount: number }[];
};

export const ALLOCATIONS: AllocationPosting[] = [];

export type BudgetChange = { date: string; object: string; from: number; to: number; reason: string };

export const BUDGET_CHANGES: BudgetChange[] = [];

export type InternalOrder = {
  no: string; name: string; costCenter: string; budget: number; spent: number;
  status: "กำลังดำเนินการ" | "ปิดงานแล้ว"; opened: string; closedOn?: string;
};

export const INTERNAL_ORDERS: InternalOrder[] = [
  { no: "IO-7001", name: "ติดตั้งสายพานลำเลียงใหม่", costCenter: "CC-PROD", budget: 320000, spent: 268400, status: "กำลังดำเนินการ", opened: "2026-07-01" },
  { no: "IO-7002", name: "งานออกบูธงานแสดงสินค้า", costCenter: "CC-SALE", budget: 180000, spent: 194500, status: "กำลังดำเนินการ", opened: "2026-08-15" },
  { no: "IO-7003", name: "ปรับปรุงระบบไฟฟ้าคลังสินค้า", costCenter: "CC-WH", budget: 145000, spent: 145000, status: "ปิดงานแล้ว", opened: "2026-05-02", closedOn: "2026-06-30" },
  { no: "IO-7004", name: "อบรมความปลอดภัยประจำปี", costCenter: "CC-ADM", budget: 60000, spent: 22000, status: "กำลังดำเนินการ", opened: "2026-09-01" },
];

/** ค่าใช้จ่ายแต่ละรายการที่เก็บเข้าคำสั่งงาน — รวมกันคือยอด spent ของคำสั่งงานนั้น */
export type IoCost = { no: string; date: string; order: string; text: string; vendor: string; amount: number };

export const IO_COSTS: IoCost[] = [
  { no: "IC-2569-0101", date: "2026-07-18", order: "IO-7001", text: "สายพานลำเลียงและชุดขับ", vendor: "บจก. ยนต์ภัณฑ์สากล", amount: 214000 },
  { no: "IC-2569-0102", date: "2026-08-20", order: "IO-7001", text: "ค่าติดตั้งและเดินระบบไฟ", vendor: "หจก. ช่างไฟรุ่งเรือง", amount: 48600 },
  { no: "IC-2569-0103", date: "2026-09-12", order: "IO-7001", text: "ค่าทดสอบระบบและปรับตั้ง", vendor: "บจก. ยนต์ภัณฑ์สากล", amount: 5800 },
  { no: "IC-2569-0104", date: "2026-08-20", order: "IO-7002", text: "ค่าเช่าพื้นที่บูธ", vendor: "บจก. อิมแพ็ค เอ็กซิบิชั่น", amount: 96000 },
  { no: "IC-2569-0105", date: "2026-09-05", order: "IO-7002", text: "ค่าออกแบบและตกแต่งบูธ", vendor: "หจก. ครีเอทีฟดีไซน์", amount: 72500 },
  { no: "IC-2569-0106", date: "2026-09-10", order: "IO-7002", text: "ของที่ระลึกและเอกสารแจก", vendor: "ร้านพิมพ์ดีการพิมพ์", amount: 26000 },
  { no: "IC-2569-0107", date: "2026-05-20", order: "IO-7003", text: "สายไฟและตู้ควบคุม", vendor: "หจก. ช่างไฟรุ่งเรือง", amount: 98000 },
  { no: "IC-2569-0108", date: "2026-06-10", order: "IO-7003", text: "ค่าแรงช่างไฟฟ้า", vendor: "หจก. ช่างไฟรุ่งเรือง", amount: 47000 },
  { no: "IC-2569-0109", date: "2026-09-15", order: "IO-7004", text: "ค่าวิทยากรอบรมรุ่นที่ 1", vendor: "สถาบันความปลอดภัยในการทำงาน", amount: 22000 },
];

/** การชำระต้นทุน — ย้ายยอดสะสมของคำสั่งงานไปศูนย์ต้นทุนหรือสินทรัพย์ แล้วคำสั่งงานเหลือศูนย์ */
export type IoSettlement = {
  no: string; date: string; order: string; receiverType: "ศูนย์ต้นทุน" | "สินทรัพย์"; receiver: string; amount: number;
};

export const IO_SETTLEMENTS: IoSettlement[] = [
  { no: "ST-2569-0004", date: "2026-06-30", order: "IO-7003", receiverType: "ศูนย์ต้นทุน", receiver: "CC-WH", amount: 145000 },
];

export type OverheadRate = { code: string; name: string; base: string; rate: number };

/** อัตราค่าใช้จ่ายทางอ้อมที่บวกเข้าต้นทุนผลิตภัณฑ์ */
export const OVERHEAD: OverheadRate[] = [
  { code: "OH-MFG", name: "ค่าใช้จ่ายโรงงาน", base: "ต้นทุนวัสดุและค่าแรง", rate: 0.12 },
  { code: "OH-ADM", name: "ค่าใช้จ่ายบริหาร", base: "ต้นทุนวัสดุและค่าแรง", rate: 0.05 },
];

/**
 * แผ่นคำนวณต้นทุนมาตรฐาน: คำนวณ → กำหนดใช้ → ปล่อยใช้
 * ต้นทุนที่ปล่อยใช้มีผลตั้งแต่ต้นงวดถัดไปเสมอ งวดที่ลงบัญชีไปแล้วจึงไม่เปลี่ยนตัวเลขย้อนหลัง
 */
export type EstimateStatus = "คำนวณแล้ว" | "กำหนดใช้แล้ว" | "ปล่อยใช้แล้ว" | "ถูกแทนที่";

export type CostEstimate = {
  no: string; material: string; date: string; materialCost: number; labourCost: number;
  rates: { code: string; name: string; rate: number }[]; status: EstimateStatus; validFrom?: string; note: string;
};

const SEED_RATES = [
  { code: "OH-MFG", name: "ค่าใช้จ่ายโรงงาน", rate: 0.12 },
  { code: "OH-ADM", name: "ค่าใช้จ่ายบริหาร", rate: 0.05 },
];

export const COST_ESTIMATES: CostEstimate[] = [
  { no: "CE-2569-0031", material: "FG-5001", date: "2026-08-28", materialCost: 6770, labourCost: 1206, rates: SEED_RATES, status: "ปล่อยใช้แล้ว", validFrom: "2026-09-01", note: "ต้นทุนมาตรฐานประจำไตรมาส" },
  { no: "CE-2569-0032", material: "FG-5002", date: "2026-08-28", materialCost: 7862, labourCost: 1519, rates: SEED_RATES, status: "ปล่อยใช้แล้ว", validFrom: "2026-09-01", note: "ต้นทุนมาตรฐานประจำไตรมาส" },
  { no: "CE-2569-0033", material: "FG-5003", date: "2026-08-28", materialCost: 11390, labourCost: 1600, rates: SEED_RATES, status: "ปล่อยใช้แล้ว", validFrom: "2026-09-01", note: "ต้นทุนมาตรฐานประจำไตรมาส" },
];

/* ------------------------------------------------------------- helpers */

const round2 = (n: number) => Math.round(n * 100) / 100;
const inPeriod = (date: string) => date >= PERIOD.from && date <= PERIOD.to;

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** วันแรกของงวดถัดไป — ต้นทุนมาตรฐานที่ปล่อยใช้มีผลตั้งแต่วันนี้ */
export const NEXT_PERIOD = addDays(PERIOD.to, 1);

/** เลขที่เอกสารถัดไป ต่อจากเลขสูงสุดที่ออกไปแล้วในชุดเดียวกัน */
function nextNo(existing: string[], prefix: string, width: number) {
  const top = existing
    .filter((n) => n.startsWith(prefix))
    .reduce((max, n) => Math.max(max, Number(n.slice(prefix.length))), 0);
  return prefix + String(top + 1).padStart(width, "0");
}

const positive = (n: number, what: string) => {
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${what}ต้องมากกว่าศูนย์`);
};

export const costCenter = (code: string) => {
  const c = COST_CENTERS.find((x) => x.code === code);
  if (!c) throw new Error(`ไม่พบศูนย์ต้นทุน ${code}`);
  return c;
};

export const profitCenter = (code: string) => {
  const p = PROFIT_CENTERS.find((x) => x.code === code);
  if (!p) throw new Error(`ไม่พบศูนย์กำไร ${code}`);
  return p;
};

export const internalOrder = (no: string) => {
  const o = INTERNAL_ORDERS.find((x) => x.no === no);
  if (!o) throw new Error(`ไม่พบคำสั่งงาน ${no}`);
  return o;
};

/** ศูนย์กำไรของช่องทางขาย — ช่องทางที่ยังไม่กำหนดคือข้อมูลหลักไม่ครบ */
export function profitCenterOfChannel(channel: string) {
  const pc = CHANNEL_PROFIT_CENTER[channel];
  if (!pc) throw new Error(`ช่องทาง ${channel} ยังไม่ได้กำหนดศูนย์กำไร`);
  return pc;
}

/** บัญชีค่าใช้จ่ายที่กระจายเข้าศูนย์ต้นทุนได้ — ทุกบัญชีค่าใช้จ่ายยกเว้นต้นทุนขาย */
export const expenseAccounts = () => ACCOUNTS.filter((a) => a.type === "ค่าใช้จ่าย" && a.code !== "5010");

/** ยอดคงเหลือทุกบัญชีจากงบทดลองครั้งเดียว — สมุดรายวันทั้งเล่มคำนวณใหม่ทุกครั้งที่อ่าน */
const balances = () => new Map(trialBalance().map((a) => [a.code, a.balance]));

/* -------------------------------------------------------- cost centres */

/** ยอดที่ศูนย์รับตรงจากสมุดรายวัน = ผลรวมของส่วนแบ่งจากทุกบัญชีค่าใช้จ่าย */
export function primaryOf(code: string, book = balances()) {
  return Object.entries(ALLOCATION).reduce((n, [account, shares]) => n + (book.get(account) ?? 0) * (shares[code] ?? 0), 0);
}

export const allocatedIn = (code: string) =>
  ALLOCATIONS.filter((a) => inPeriod(a.date)).reduce(
    (n, a) => n + a.lines.filter((l) => l.costCenter === code).reduce((s, l) => s + l.amount, 0),
    0
  );

export const allocatedOut = (code: string) =>
  ALLOCATIONS.filter((a) => inPeriod(a.date) && a.sender === code).reduce((n, a) => n + a.amount, 0);

/** ต้นทุนจากคำสั่งงานภายในที่ชำระเข้าศูนย์นี้ในงวด */
export const settledInto = (code: string) =>
  IO_SETTLEMENTS.filter((s) => inPeriod(s.date) && s.receiverType === "ศูนย์ต้นทุน" && s.receiver === code).reduce(
    (n, s) => n + s.amount,
    0
  );

/** ยอดจริงของศูนย์ต้นทุน = รับตรงจากบัญชี + รับจากการปันส่วน − ปันออกไป + ชำระจากคำสั่งงาน */
export function actualOf(code: string, book = balances()) {
  return primaryOf(code, book) + allocatedIn(code) - allocatedOut(code) + settledInto(code);
}

export function costCenterRows() {
  const book = balances();
  return COST_CENTERS.map((c) => {
    const primary = primaryOf(c.code, book);
    const allocIn = allocatedIn(c.code);
    const allocOut = allocatedOut(c.code);
    const settled = settledInto(c.code);
    const actual = Math.round(primary + allocIn - allocOut + settled);
    return {
      ...c, actual, primary, allocIn, allocOut, settled,
      variance: c.budget - actual,
      pct: c.budget ? Math.round((actual / c.budget) * 100) : 0,
      over: actual > c.budget,
    };
  });
}

/** รอบปันส่วนจะย้ายยอดเท่าไรไปศูนย์ไหน ถ้ารันตอนนี้ */
export function previewCycle(code: string) {
  const cycle = CYCLES.find((c) => c.code === code);
  if (!cycle) throw new Error(`ไม่พบรอบปันส่วน ${code}`);
  const amount = actualOf(cycle.sender);
  const receivers = Object.entries(cycle.receivers);
  const lines = receivers.map(([costCenter, share], i) => ({
    costCenter,
    amount:
      i < receivers.length - 1
        ? round2(amount * share)
        : amount - receivers.slice(0, -1).reduce((n, [, s]) => n + round2(amount * s), 0),
  }));
  return { cycle, amount, lines };
}

/** รันรอบปันส่วน — ศูนย์ส่งเหลือศูนย์ ยอดไปอยู่ที่ศูนย์รับตามสัดส่วน */
export function runCycle(code: string, date = PERIOD.to) {
  const { cycle, amount, lines } = previewCycle(code);
  if (amount <= 0.005) throw new Error(`${costCenter(cycle.sender).name} ไม่มียอดให้ปันส่วน`);
  return commit(() => {
    const posting: AllocationPosting = {
      no: nextNo(ALLOCATIONS.map((a) => a.no), "AL-2569-", 3), date, cycle: cycle.code, sender: cycle.sender, amount, lines,
    };
    ALLOCATIONS.push(posting);
    return posting;
  });
}

function checkShares(shares: Record<string, number>, what: string) {
  const entries = Object.entries(shares).filter(([, s]) => s !== 0);
  if (entries.length === 0) throw new Error(`${what}ต้องมีศูนย์ต้นทุนอย่างน้อยหนึ่งศูนย์`);
  for (const [code, s] of entries) {
    costCenter(code);
    if (!(s > 0 && s <= 1)) throw new Error(`สัดส่วนของ ${code} ต้องอยู่ระหว่าง 0 ถึง 100%`);
  }
  const total = entries.reduce((n, [, s]) => n + s, 0);
  if (Math.abs(total - 1) > 0.0001) throw new Error(`${what}รวมกันต้องได้ 100% ตอนนี้ได้ ${Math.round(total * 1000) / 10}%`);
  return Object.fromEntries(entries);
}

export function addCycle(input: { name: string; sender: string; receivers: Record<string, number> }) {
  if (input.name.trim().length < 3) throw new Error("ตั้งชื่อรอบปันส่วน");
  costCenter(input.sender);
  if (input.receivers[input.sender]) throw new Error("ศูนย์ส่งเป็นศูนย์รับของตัวเองไม่ได้");
  const receivers = checkShares(input.receivers, "สัดส่วนศูนย์รับ");
  return commit(() => {
    const c: AllocationCycle = { code: nextNo(CYCLES.map((x) => x.code), "CY-", 2), name: input.name.trim(), sender: input.sender, receivers };
    CYCLES.push(c);
    return c;
  });
}

/** ตั้งสัดส่วนที่ศูนย์ต้นทุนรับค่าใช้จ่ายของบัญชีหนึ่ง — ต้องรวมได้ 100% */
export function setDistribution(account: string, shares: Record<string, number>) {
  if (!expenseAccounts().some((a) => a.code === account)) throw new Error(`บัญชี ${account} กระจายเข้าศูนย์ต้นทุนไม่ได้`);
  const clean = checkShares(shares, "สัดส่วนของบัญชี " + account + " ");
  return commit(() => {
    ALLOCATION[account] = clean;
    return clean;
  });
}

export function addCostCenter(input: CostCenter) {
  if (!/^CC-[A-Z0-9]+$/.test(input.code)) throw new Error("รหัสศูนย์ต้นทุนต้องขึ้นต้นด้วย CC- ตามด้วยตัวพิมพ์ใหญ่หรือตัวเลข");
  if (COST_CENTERS.some((c) => c.code === input.code)) throw new Error(`มีศูนย์ต้นทุน ${input.code} แล้ว`);
  if (input.name.trim().length < 2) throw new Error("ตั้งชื่อศูนย์ต้นทุน");
  if (input.owner.trim().length < 2) throw new Error("ระบุผู้รับผิดชอบ");
  profitCenter(input.profitCenter);
  if (!(input.budget >= 0)) throw new Error("งบต้องไม่ติดลบ");
  return commit(() => {
    const c = { ...input, name: input.name.trim(), owner: input.owner.trim() };
    COST_CENTERS.push(c);
    return c;
  });
}

/** ตั้งงบของศูนย์ต้นทุนหรือคำสั่งงาน พร้อมเหตุผล — เก็บประวัติไว้ให้ตรวจย้อน */
export function setBudget(code: string, amount: number, reason: string) {
  const c = costCenter(code);
  if (!(amount >= 0)) throw new Error("งบต้องไม่ติดลบ");
  if (reason.trim().length < 3) throw new Error("ระบุเหตุผลที่ปรับงบ");
  return commit(() => {
    BUDGET_CHANGES.push({ date: TODAY, object: code, from: c.budget, to: amount, reason: reason.trim() });
    c.budget = amount;
    return c;
  });
}

/* ------------------------------------------------------ internal orders */

export const costsOf = (no: string) => IO_COSTS.filter((c) => c.order === no);
export const settlementsOf = (no: string) => IO_SETTLEMENTS.filter((s) => s.order === no);
export const settledOf = (no: string) => settlementsOf(no).reduce((n, s) => n + s.amount, 0);

/** ยอดที่ยังค้างอยู่ในคำสั่งงาน รอชำระไปที่ผู้รับ */
export const ioBalance = (o: InternalOrder) => o.spent - settledOf(o.no);

export function createInternalOrder(input: { name: string; costCenter: string; budget: number; opened: string }) {
  if (input.name.trim().length < 3) throw new Error("ตั้งชื่องาน");
  costCenter(input.costCenter);
  positive(input.budget, "งบที่อนุมัติ");
  return commit(() => {
    const o: InternalOrder = {
      no: nextNo(INTERNAL_ORDERS.map((x) => x.no), "IO-", 4), name: input.name.trim(), costCenter: input.costCenter,
      budget: input.budget, spent: 0, status: "กำลังดำเนินการ", opened: input.opened,
    };
    INTERNAL_ORDERS.push(o);
    return o;
  });
}

/** บันทึกค่าใช้จ่ายเข้าคำสั่งงาน — เกินงบที่อนุมัติไม่ได้ ต้องอนุมัติงบเพิ่มก่อน */
export function postIoCost(no: string, input: { date: string; text: string; vendor: string; amount: number }) {
  const o = internalOrder(no);
  if (o.status !== "กำลังดำเนินการ") throw new Error(`${no} ปิดงานแล้ว บันทึกค่าใช้จ่ายไม่ได้`);
  positive(input.amount, "จำนวนเงิน");
  if (input.text.trim().length < 3) throw new Error("ระบุรายการค่าใช้จ่าย");
  if (o.spent + input.amount > o.budget) {
    throw new Error(`เกินงบ ${baht(o.spent + input.amount - o.budget)} ต้องอนุมัติงบเพิ่มก่อน`);
  }
  return commit(() => {
    const cost: IoCost = {
      no: nextNo(IO_COSTS.map((c) => c.no), "IC-2569-", 4), date: input.date, order: no,
      text: input.text.trim(), vendor: input.vendor.trim(), amount: input.amount,
    };
    IO_COSTS.push(cost);
    o.spent += input.amount;
    return cost;
  });
}

export function raiseIoBudget(no: string, budget: number, reason: string) {
  const o = internalOrder(no);
  if (o.status !== "กำลังดำเนินการ") throw new Error(`${no} ปิดงานแล้ว`);
  if (!(budget > o.budget)) throw new Error(`งบใหม่ต้องมากกว่างบเดิม ${baht(o.budget)}`);
  if (reason.trim().length < 3) throw new Error("ระบุเหตุผลที่ขอเพิ่มงบ");
  return commit(() => {
    BUDGET_CHANGES.push({ date: TODAY, object: no, from: o.budget, to: budget, reason: reason.trim() });
    o.budget = budget;
    return o;
  });
}

/** ชำระต้นทุน — ย้ายยอดค้างทั้งหมดไปผู้รับ คำสั่งงานเหลือศูนย์ */
export function settleInternalOrder(
  no: string,
  input: { receiverType: IoSettlement["receiverType"]; receiver: string; date?: string }
) {
  const o = internalOrder(no);
  const balance = ioBalance(o);
  if (balance <= 0) throw new Error(`${no} ไม่มียอดค้างให้ชำระ`);
  if (input.receiverType === "ศูนย์ต้นทุน") costCenter(input.receiver);
  else if (!ASSETS.some((a) => a.code === input.receiver)) throw new Error(`ไม่พบสินทรัพย์ ${input.receiver}`);
  return commit(() => {
    const s: IoSettlement = {
      no: nextNo(IO_SETTLEMENTS.map((x) => x.no), "ST-2569-", 4), date: input.date ?? PERIOD.to, order: no,
      receiverType: input.receiverType, receiver: input.receiver, amount: balance,
    };
    IO_SETTLEMENTS.push(s);
    return s;
  });
}

/** ปิดคำสั่งงาน — ต้องชำระยอดค้างจนเหลือศูนย์ก่อน */
export function closeInternalOrder(no: string) {
  const o = internalOrder(no);
  if (o.status !== "กำลังดำเนินการ") throw new Error(`${no} ปิดงานไปแล้ว`);
  if (ioBalance(o) !== 0) throw new Error(`${no} ยังมียอดค้าง ${baht(ioBalance(o))} ชำระต้นทุนก่อนปิดงาน`);
  return commit(() => {
    o.status = "ปิดงานแล้ว";
    o.closedOn = TODAY;
    return o;
  });
}

/* ------------------------------------------------------- product costs */

/** ต้นทุนผลิตภัณฑ์ = ราคามาตรฐานจากแฟ้มวัสดุ + ค่าใช้จ่ายทางอ้อมตามอัตรา */
export function productCost(code: string) {
  const m = material(code);
  const direct = m.price;
  const lines = OVERHEAD.map((o) => ({ ...o, amount: Math.round(direct * o.rate) }));
  const overhead = lines.reduce((n, l) => n + l.amount, 0);
  return { name: m.name, unit: m.unit, direct, lines, overhead, total: direct + overhead };
}

export function setOverheadRate(code: string, rate: number) {
  const o = OVERHEAD.find((x) => x.code === code);
  if (!o) throw new Error(`ไม่พบอัตรา ${code}`);
  if (!(rate >= 0 && rate < 1)) throw new Error("อัตราต้องอยู่ระหว่าง 0 ถึงน้อยกว่า 100%");
  return commit(() => {
    o.rate = rate;
    return o;
  });
}

export function estimateTotals(e: CostEstimate) {
  const direct = e.materialCost + e.labourCost;
  const lines = e.rates.map((r) => ({ ...r, amount: Math.round(direct * r.rate) }));
  const overhead = lines.reduce((n, l) => n + l.amount, 0);
  return { direct, lines, overhead, total: direct + overhead };
}

/** ต้นทุนมาตรฐานที่ใช้อยู่ในงวดนี้ */
export const currentEstimate = (code: string) =>
  COST_ESTIMATES.filter((e) => e.material === code && e.status === "ปล่อยใช้แล้ว" && (e.validFrom ?? "") <= PERIOD.to).at(-1);

/** ต้นทุนมาตรฐานที่ปล่อยไว้สำหรับงวดถัดไป */
export const nextEstimate = (code: string) =>
  COST_ESTIMATES.find((e) => e.material === code && e.status === "ปล่อยใช้แล้ว" && e.validFrom === NEXT_PERIOD);

export function runEstimate(code: string, input: { materialCost: number; labourCost: number; note: string }) {
  const m = material(code);
  if (m.group !== "สินค้าสำเร็จรูป") throw new Error(`${m.name} ไม่ใช่สินค้าที่ผลิต`);
  positive(input.materialCost, "ค่าวัตถุดิบ");
  if (!(input.labourCost >= 0)) throw new Error("ค่าแรงต้องไม่ติดลบ");
  return commit(() => {
    const e: CostEstimate = {
      no: nextNo(COST_ESTIMATES.map((x) => x.no), "CE-2569-", 4), material: code, date: TODAY,
      materialCost: input.materialCost, labourCost: input.labourCost,
      rates: OVERHEAD.map((o) => ({ code: o.code, name: o.name, rate: o.rate })), status: "คำนวณแล้ว", note: input.note.trim(),
    };
    COST_ESTIMATES.push(e);
    return e;
  });
}

/** กำหนดใช้ — ใบเดียวต่อสินค้า ใบที่กำหนดไว้ก่อนหน้ากลับเป็นคำนวณแล้ว */
export function markEstimate(no: string) {
  const e = COST_ESTIMATES.find((x) => x.no === no);
  if (!e || e.status !== "คำนวณแล้ว") throw new Error(`${no} กำหนดใช้ไม่ได้`);
  return commit(() => {
    for (const x of COST_ESTIMATES) if (x.material === e.material && x.status === "กำหนดใช้แล้ว") x.status = "คำนวณแล้ว";
    e.status = "กำหนดใช้แล้ว";
    return e;
  });
}

/** ปล่อยใช้เป็นต้นทุนมาตรฐานงวดถัดไป — ย้อนกลับไม่ได้ ปล่อยใหม่ได้เพื่อแทนที่ */
export function releaseEstimate(no: string) {
  const e = COST_ESTIMATES.find((x) => x.no === no);
  if (!e || e.status !== "กำหนดใช้แล้ว") throw new Error(`${no} ต้องกำหนดใช้ก่อนปล่อยใช้`);
  return commit(() => {
    const previous = nextEstimate(e.material);
    if (previous) previous.status = "ถูกแทนที่";
    e.status = "ปล่อยใช้แล้ว";
    e.validFrom = NEXT_PERIOD;
    return e;
  });
}

/* --------------------------------------------------------------- margins */

/**
 * กำไรขั้นต้นรายใบสั่งขาย จากใบกำกับภาษีที่ออกแล้วลบใบลดหนี้ — ชุดเดียวกับที่บัญชีลงรายได้
 * ใบสั่งขายที่ถูกยกเลิกไม่นับ ต้นทุนคือจำนวนที่ส่งมอบคูณต้นทุนผลิตภัณฑ์
 */
export function marginRows() {
  const orders = new Map<
    string,
    { so: string; customer: string; date: string; invoices: string[]; credits: string[]; revenue: number; direct: number; absorbed: number }
  >();
  const entry = (so: string, customerCode: string) => {
    const cur = orders.get(so) ?? { so, customer: customerCode, date: "", invoices: [], credits: [], revenue: 0, direct: 0, absorbed: 0 };
    orders.set(so, cur);
    return cur;
  };
  for (const inv of BILLINGS) {
    if (isCancelled(salesOrder(inv.so))) continue;
    const e = entry(inv.so, inv.customer);
    e.invoices.push(inv.no);
    e.date = e.date > inv.date ? e.date : inv.date;
    e.revenue += inv.net;
    for (const l of invoiceLines(inv)) {
      const c = productCost(l.material);
      e.direct += l.qty * c.direct;
      e.absorbed += l.qty * c.overhead;
    }
  }
  for (const cn of CREDIT_NOTES) {
    if (isCancelled(salesOrder(cn.so))) continue;
    const e = entry(cn.so, cn.customer);
    e.credits.push(cn.no);
    e.revenue -= cn.net;
    if (cn.kind === "รับคืนสินค้า") {
      for (const l of cn.lines) {
        const c = productCost(l.material);
        e.direct -= l.qty * c.direct;
        e.absorbed -= l.qty * c.overhead;
      }
    }
  }
  return [...orders.values()].map((e) => {
    const c = customer(e.customer);
    const cost = e.direct + e.absorbed;
    return {
      so: e.so, customer: e.customer, customerName: c.name, channel: c.channel, date: e.date,
      invoices: e.invoices, credits: e.credits, direct: e.direct, absorbed: e.absorbed,
      profitCenter: profitCenterOfChannel(c.channel),
      revenue: e.revenue, cost, margin: e.revenue - cost,
      pct: e.revenue ? Math.round(((e.revenue - cost) / e.revenue) * 100) : 0,
    };
  });
}

export function byChannel() {
  const rows = marginRows();
  const channels = [...new Set(rows.map((r) => r.channel))];
  return channels.map((ch) => {
    const mine = rows.filter((r) => r.channel === ch);
    const revenue = mine.reduce((n, r) => n + r.revenue, 0);
    const cost = mine.reduce((n, r) => n + r.cost, 0);
    return { channel: ch, orders: mine.length, revenue, cost, margin: revenue - cost, pct: revenue ? Math.round(((revenue - cost) / revenue) * 100) : 0 };
  });
}

/* -------------------------------------------------------- profit centres */

/** ศูนย์กำไร — กำไรขั้นต้นที่ช่องทางนำมาให้ ลบค่าใช้จ่ายทางอ้อมของศูนย์ต้นทุนที่สังกัดอยู่ */
export function profitCenterRows() {
  const margins = marginRows();
  const centers = costCenterRows();
  return PROFIT_CENTERS.map((p) => {
    const mine = margins.filter((m) => m.profitCenter === p.code);
    const revenue = mine.reduce((n, m) => n + m.revenue, 0);
    const productCost = mine.reduce((n, m) => n + m.cost, 0);
    const absorbed = mine.reduce((n, m) => n + m.absorbed, 0);
    const overhead = centers.filter((c) => c.profitCenter === p.code).reduce((n, c) => n + c.actual, 0);
    // ลบเฉพาะส่วนที่ยังไม่ถูกดูดเข้าต้นทุนสินค้า มิฉะนั้นค่าใช้จ่ายทางอ้อมถูกนับสองรอบ
    const unabsorbed = overhead - absorbed;
    return {
      ...p, revenue, productCost, grossMargin: revenue - productCost,
      overhead, absorbed, unabsorbed, result: revenue - productCost - unabsorbed,
    };
  });
}

export function addProfitCenter(input: ProfitCenter) {
  if (!/^PC-[A-Z0-9]+$/.test(input.code)) throw new Error("รหัสศูนย์กำไรต้องขึ้นต้นด้วย PC- ตามด้วยตัวพิมพ์ใหญ่หรือตัวเลข");
  if (PROFIT_CENTERS.some((p) => p.code === input.code)) throw new Error(`มีศูนย์กำไร ${input.code} แล้ว`);
  if (input.name.trim().length < 2) throw new Error("ตั้งชื่อศูนย์กำไร");
  return commit(() => {
    const p = { code: input.code, name: input.name.trim() };
    PROFIT_CENTERS.push(p);
    return p;
  });
}

/** ย้ายศูนย์ต้นทุนไปสังกัดศูนย์กำไรอื่น — ค่าใช้จ่ายของศูนย์ตามไปหักที่ศูนย์กำไรใหม่ */
export function assignCostCenter(code: string, pc: string) {
  const c = costCenter(code);
  profitCenter(pc);
  return commit(() => {
    c.profitCenter = pc;
    return c;
  });
}

/** กำหนดว่าช่องทางขายนำรายได้เข้าศูนย์กำไรไหน */
export function assignChannel(channel: string, pc: string) {
  if (!(channel in CHANNEL_PROFIT_CENTER)) throw new Error(`ไม่รู้จักช่องทาง ${channel}`);
  profitCenter(pc);
  commit(() => {
    CHANNEL_PROFIT_CENTER[channel] = pc;
  });
}

export const companyResult = () => profitAndLoss().profit;

/**
 * กระทบยอดบัญชีบริหารกับงบการเงิน: ผลรวมทุกศูนย์กำไรเทียบกำไรสุทธิ แล้วแยกให้เห็นว่า
 * ส่วนต่างมาจากอะไร — รายได้หรือต้นทุนขายที่ไม่ได้มาจากใบกำกับ ค่าใช้จ่ายที่ยังไม่กำหนด
 * ศูนย์ต้นทุน และต้นทุนคำสั่งงานที่ชำระเข้าศูนย์ต้นทุนแต่บันทึกเฉพาะฝั่งบัญชีบริหาร
 */
export function reconcile() {
  const centres = profitCenterRows().reduce((n, p) => n + p.result, 0);
  const pl = profitAndLoss();
  const margins = marginRows();
  const otherRevenue = pl.revenue - margins.reduce((n, m) => n + m.revenue, 0);
  const otherCogs = balanceOf("5010") - margins.reduce((n, m) => n + m.direct, 0);
  const book = balances();
  const undistributed = expenseAccounts().reduce((n, a) => {
    const shares = Object.values(ALLOCATION[a.code] ?? {}).reduce((s, x) => s + x, 0);
    return n + (book.get(a.code) ?? 0) * (1 - shares);
  }, 0);
  const coOnly = IO_SETTLEMENTS.filter((s) => inPeriod(s.date) && s.receiverType === "ศูนย์ต้นทุน").reduce((n, s) => n + s.amount, 0);
  return {
    centres, company: pl.profit, otherRevenue, otherCogs, undistributed, coOnly,
    tiesOut: Math.abs(centres - pl.profit) <= 1,
  };
}

export { FINISHED_GOODS };

import { material, FINISHED_GOODS } from "../mm/data";
import { SALES_ORDERS, customer, orderTotal } from "../sd/data";
import { balanceOf, profitAndLoss, baht } from "../fi/data";

export { baht };

export const PROFIT_CENTERS = [
  { code: "PC-MFG", name: "สายการผลิต" },
  { code: "PC-TRD", name: "สายการค้า" },
  { code: "PC-ADM", name: "สำนักงานกลาง" },
];

export const COST_CENTERS = [
  { code: "CC-PROD", name: "ฝ่ายผลิต", profitCenter: "PC-MFG", budget: 145000, owner: "หัวหน้าสายการผลิต" },
  { code: "CC-WH", name: "ฝ่ายคลัง", profitCenter: "PC-MFG", budget: 68000, owner: "ผู้จัดการคลัง" },
  { code: "CC-SALE", name: "ฝ่ายขาย", profitCenter: "PC-TRD", budget: 105000, owner: "หัวหน้าฝ่ายขาย" },
  { code: "CC-ADM", name: "ฝ่ายบริหารและบัญชี", profitCenter: "PC-ADM", budget: 120000, owner: "นักบัญชีอาวุโส" },
];

/**
 * สัดส่วนที่แต่ละศูนย์ต้นทุนรับค่าใช้จ่ายไป — รวมกันได้ 1.00 ต่อบัญชี
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

export const INTERNAL_ORDERS = [
  { no: "IO-7001", name: "ติดตั้งสายพานลำเลียงใหม่", costCenter: "CC-PROD", budget: 320000, spent: 268400, status: "กำลังดำเนินการ", opened: "2026-07-01" },
  { no: "IO-7002", name: "งานออกบูธงานแสดงสินค้า", costCenter: "CC-SALE", budget: 180000, spent: 194500, status: "กำลังดำเนินการ", opened: "2026-08-15" },
  { no: "IO-7003", name: "ปรับปรุงระบบไฟฟ้าคลังสินค้า", costCenter: "CC-WH", budget: 145000, spent: 145000, status: "ปิดงานแล้ว", opened: "2026-05-02" },
  { no: "IO-7004", name: "อบรมความปลอดภัยประจำปี", costCenter: "CC-ADM", budget: 60000, spent: 22000, status: "กำลังดำเนินการ", opened: "2026-09-01" },
];

/** อัตราค่าใช้จ่ายทางอ้อมที่บวกเข้าต้นทุนผลิตภัณฑ์ */
export const OVERHEAD = [
  { code: "OH-MFG", name: "ค่าใช้จ่ายโรงงาน", base: "ต้นทุนวัสดุและค่าแรง", rate: 0.12 },
  { code: "OH-ADM", name: "ค่าใช้จ่ายบริหาร", base: "ต้นทุนวัสดุและค่าแรง", rate: 0.05 },
];

/** ยอดจริงของศูนย์ต้นทุนหนึ่ง = ผลรวมของส่วนแบ่งที่รับมาจากทุกบัญชีค่าใช้จ่าย */
export function actualOf(code: string) {
  return Object.entries(ALLOCATION).reduce((n, [account, shares]) => {
    const share = shares[code] ?? 0;
    return n + balanceOf(account) * share;
  }, 0);
}

export function costCenterRows() {
  return COST_CENTERS.map((c) => {
    const actual = Math.round(actualOf(c.code));
    return {
      ...c, actual,
      variance: c.budget - actual,
      pct: c.budget ? Math.round((actual / c.budget) * 100) : 0,
      over: actual > c.budget,
    };
  });
}

/** ต้นทุนผลิตภัณฑ์ = ราคามาตรฐานจากแฟ้มวัสดุ + ค่าใช้จ่ายทางอ้อมตามอัตรา */
export function productCost(code: string) {
  const m = material(code);
  const direct = m?.price ?? 0;
  const lines = OVERHEAD.map((o) => ({ ...o, amount: Math.round(direct * o.rate) }));
  const overhead = lines.reduce((n, l) => n + l.amount, 0);
  return { name: m?.name ?? code, unit: m?.unit ?? "", direct, lines, overhead, total: direct + overhead };
}

/** กำไรขั้นต้นรายใบสั่งขาย — รายได้จริงลบต้นทุนผลิตภัณฑ์จริง */
export function marginRows() {
  return SALES_ORDERS.map((so) => {
    const c = customer(so.customer);
    const revenue = orderTotal(so).net;
    const cost = so.lines.reduce((n, l) => n + l.qty * productCost(l.material).total, 0);
    // ส่วนของค่าใช้จ่ายทางอ้อมที่ถูกดูดเข้าต้นทุนสินค้าไปแล้วผ่านอัตราคิดกลับ
    const absorbed = so.lines.reduce((n, l) => n + l.qty * productCost(l.material).overhead, 0);
    return {
      so: so.no, customerName: c.name, channel: c.channel, absorbed,
      profitCenter: c.channel === "ขายตรง" ? "PC-MFG" : c.channel === "ตัวแทนจำหน่าย" ? "PC-TRD" : "PC-TRD",
      revenue, cost, margin: revenue - cost,
      pct: revenue ? Math.round(((revenue - cost) / revenue) * 100) : 0,
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

export const companyResult = () => profitAndLoss().profit;
export { FINISHED_GOODS };

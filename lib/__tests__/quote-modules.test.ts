import { describe, expect, it } from "vitest";
import { emptyRow, lineTotal, newDoc, quoteTotals, rowsFromShots, type QuoteDoc, type QuoteRow } from "../quote";
import { rowsFromModules } from "../quote-modules";
import type { ProposalModule } from "../proposal-modules";
import type { Shot } from "../shots";

/**
 * The quotation re-cut by module (SQP-0002): one line per module in place of a
 * line per screen, the module's parts and their key points as its detail.
 * What the sales team added by hand — an annual fee, a discount — stays, and
 * money already on the screen lines moves to their module instead of vanishing.
 */
const shot = (index: number, name: string, parent: string | null = null): Shot => ({
  path: `p/${index}.png`,
  name,
  parent,
  index,
  url: "",
});

const SHOTS = [
  shot(0, "แดชบอร์ดโครงการ"),
  shot(1, "สร้างโครงการใหม่", "แดชบอร์ดโครงการ"),
  shot(2, "ภาพรวมการจัดซื้อ"),
  shot(3, "ทะเบียนคู่ค้า"),
];

const MODULES: ProposalModule[] = [
  {
    id: "m-sales",
    name: "Module: Sales Management (งานขาย)",
    parts: [{ id: "p1", name: "Dashboard ฝ่ายประเมินราคา", points: ["แสดงภาพรวมยอดขาย"], screens: ["แดชบอร์ดโครงการ"] }],
  },
  {
    id: "m-proc",
    name: "Module: Procurement Management (งานจัดซื้อ)",
    parts: [{ id: "p2", name: "Dashboard ฝ่ายจัดซื้อ", points: ["แสดงคำขอราคา"], screens: ["ภาพรวมการจัดซื้อ"] }],
  },
];

const fee: QuoteRow = { ...emptyRow(), id: "custom:fee", name: "ค่าบริการรายปี", pricing: "unit", qty: 1, unitPrice: 240_000 };
const discount: QuoteRow = { ...emptyRow(), id: "custom:off", name: "ส่วนลดพิเศษ", pricing: "unit", qty: 1, unitPrice: -120_000 };

const quote = (rows: QuoteRow[]): QuoteDoc => ({ ...newDoc([], "First Chapter", "2026-10-16"), rows });

describe("rowsFromModules", () => {
  const before = quote([...rowsFromShots(SHOTS), fee, discount]);
  const { rows, replaced } = rowsFromModules(before, MODULES);

  it("puts one line per module first, its parts numbered under the module's number", () => {
    expect(rows.slice(0, 2).map((r) => r.name)).toEqual(MODULES.map((m) => m.name));
    expect(rows[0].note).toBe("1.1 Dashboard ฝ่ายประเมินราคา\n- แสดงภาพรวมยอดขาย");
    expect(rows[1].note).toBe("2.1 Dashboard ฝ่ายจัดซื้อ\n- แสดงคำขอราคา");
  });

  it("replaces the lines of the screens it covers, and the modals that open from them", () => {
    expect(replaced.map((r) => r.name)).toEqual(["แดชบอร์ดโครงการ", "สร้างโครงการใหม่", "ภาพรวมการจัดซื้อ"]);
  });

  it("keeps every line no module covers, in its order: a screen left out, the fee, the discount", () => {
    expect(rows.slice(2).map((r) => r.name)).toEqual(["ทะเบียนคู่ค้า", "ค่าบริการรายปี", "ส่วนลดพิเศษ"]);
  });

  it("moves the money of the lines it replaces onto their module, so the total does not move", () => {
    const sales = before.rows.slice(0, 2).reduce((n, r) => n + lineTotal(r, before.ratePerDay), 0);
    expect(rows[0]).toMatchObject({ pricing: "unit", qty: 1, unitPrice: sales });
    expect(quoteTotals({ ...before, rows }).subtotal).toBe(quoteTotals(before).subtotal);
  });

  it("run again, updates the module lines in place and keeps the price typed on them", () => {
    const priced = rows.map((r) => (r.name === MODULES[0].name ? { ...r, unitPrice: 240_000 } : r));
    const again = rowsFromModules(quote(priced), [{ ...MODULES[0], parts: [{ ...MODULES[0].parts[0], points: ["ใหม่"] }] }, MODULES[1]]);
    expect(again.rows[0]).toMatchObject({ unitPrice: 240_000, note: "1.1 Dashboard ฝ่ายประเมินราคา\n- ใหม่" });
    expect(again.rows.filter((r) => r.name === MODULES[0].name)).toHaveLength(1);
  });

  it("takes over a line typed by hand under the module's exact name, price and all", () => {
    const typed: QuoteRow = { ...emptyRow(), id: "custom:x", name: "Module: Sales Management (งานขาย)", pricing: "unit", qty: 1, unitPrice: 300_000 };
    const out = rowsFromModules(quote([typed, ...rowsFromShots(SHOTS)]), MODULES);
    expect(out.rows[0]).toMatchObject({ id: "custom:x", unitPrice: 300_000 });
    expect(out.rows.filter((r) => r.name === typed.name)).toHaveLength(1);
  });
});

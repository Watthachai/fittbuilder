import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QuotationPrint from "@/components/studio/QuotationPrint";
import QuoteTerms from "@/components/studio/QuoteTerms";
import {
  emptyRow,
  emptyTerm,
  newDoc,
  parseDoc,
  presetEqual,
  presetUat,
  restoreTermText,
  termTextEdited,
  withDueLine,
} from "@/lib/quote";
import type { Shot } from "@/lib/shots";

/**
 * Case #19, second round: the switch went into the proposal, but the paper
 * that needed it is the quotation — every captured screen printed as an
 * appendix behind the signatures, with no way to leave it off.
 */
const shots: Shot[] = [
  { path: "a.png", name: "รายการสินค้า", parent: null, index: 0, url: "https://x/a.png" },
  { path: "b.png", name: "ตะกร้า", parent: null, index: 1, url: "https://x/b.png" },
];

function paper(showShots: boolean): string {
  const doc = { ...newDoc(shots, "Pace", "2026-10-12"), showShots };
  return renderToStaticMarkup(createElement(QuotationPrint, { doc, shots, modules: [], draft: false }));
}

describe("the quotation's screenshot appendix", () => {
  it("is left off when the switch is off, and the priced rows stay", () => {
    const html = paper(false);
    expect(html).not.toContain("ภาคผนวก");
    expect(html).not.toContain("https://x/a.png");
    expect(html).toContain("ตะกร้า");
  });

  it("prints when the switch is on", () => {
    const html = paper(true);
    expect(html).toContain("ภาคผนวก");
    expect(html).toContain("https://x/b.png");
  });

  it("stays on for a quotation saved before the switch existed", () => {
    const saved = JSON.parse(JSON.stringify(newDoc(shots, "Pace", "2026-10-12")));
    delete saved.showShots;
    expect(parseDoc(saved, "2026-10-12")!.showShots).toBe(true);
    expect(parseDoc({ ...saved, showShots: false }, "2026-10-12")!.showShots).toBe(false);
  });
});

/**
 * Case #23: a line that is not labour prints what it is made of — quantity,
 * unit and unit price — not a size and a day count it never had.
 */
describe("a row priced by the unit on the paper", () => {
  it("prints quantity × unit price and its own total", () => {
    const doc = newDoc([], "Mabuchi", "2026-10-13");
    doc.rows = [
      { ...emptyRow(), name: "ค่าบริการรายปี", pricing: "unit", qty: 12, unit: "เดือน", unitPrice: 12_500 },
    ];
    const html = renderToStaticMarkup(createElement(QuotationPrint, { doc, shots: [], modules: [], draft: false }));
    expect(html).toContain("12 เดือน × 12,500");
    expect(html).toContain("150,000");
    expect(html).not.toContain(" วัน × ");
  });
});

/**
 * Case #25: the sender wants the customer to see each line's price, not the
 * arithmetic behind it — "ใหญ่ · 4.5 วัน × 100,000" tells the customer the day
 * rate, and "1 × 450,000" says nothing. Off, the paper prints the line total
 * alone; the arithmetic stays in the panel.
 */
describe("what each line's price is made of, on the paper", () => {
  const rows = [
    { ...emptyRow(), name: "ค่าพัฒนาระบบ", size: "L" as const, days: 4.5 },
    { ...emptyRow(), name: "ค่าบริการรายปี", pricing: "unit" as const, qty: 12, unit: "เดือน", unitPrice: 12_500 },
  ];
  const paper = (showBasis: boolean) => {
    const doc = { ...newDoc([], "Mabuchi", "2026-10-13"), ratePerDay: 100_000, rows, showBasis };
    return renderToStaticMarkup(createElement(QuotationPrint, { doc, shots: [], modules: [], draft: false }));
  };

  it("is left off when the switch is off, and each line keeps its total", () => {
    const html = paper(false);
    expect(html).not.toContain("q-basis");
    expect(html).not.toContain("4.5 วัน");
    expect(html).toContain("450,000");
    expect(html).toContain("150,000");
  });

  it("prints when the switch is on", () => {
    const html = paper(true);
    expect(html).toContain("ใหญ่ · 4.5 วัน × 100,000");
    expect(html).toContain("12 เดือน × 12,500");
  });

  it("stays on for a quotation saved before the switch existed", () => {
    const saved = JSON.parse(JSON.stringify(newDoc([], "Mabuchi", "2026-10-13")));
    delete saved.showBasis;
    expect(parseDoc(saved, "2026-10-13")!.showBasis).toBe(true);
    expect(parseDoc({ ...saved, showBasis: false }, "2026-10-13")!.showBasis).toBe(false);
  });
});

describe("the printed MA table", () => {
  it("prints the billing cycle row only when one is chosen", () => {
    const base = newDoc([], "Pace", "2026-10-12");
    const render = (billingCycle: "monthly" | "yearly" | null) =>
      renderToStaticMarkup(
        createElement(QuotationPrint, { doc: { ...base, ma: { ...base.ma, enabled: true, billingCycle } }, shots: [], modules: [], draft: false })
      );
    expect(render("yearly")).toContain("รอบการชำระ");
    expect(render("yearly")).toContain("รายปี");
    expect(render(null)).not.toContain("รอบการชำระ");
  });
});

/**
 * A line priced at 0 is scope given with the deal — a module included at no
 * charge — so the paper describes it and prints no figure, not a "0".
 */
describe("a row priced at 0 on the paper", () => {
  it("prints its name and detail but no amount and no price basis", () => {
    const doc = newDoc([], "Smart Product Library", "2026-10-15");
    doc.rows = [
      { ...emptyRow(), name: "Module: Product Library", pricing: "unit", qty: 1, unitPrice: 240_000 },
      { ...emptyRow(), name: "Module: Sale", note: "ระบบ Dashboard สำหรับฝ่ายขาย", pricing: "unit", qty: 1, unitPrice: 0 },
    ];
    const html = renderToStaticMarkup(createElement(QuotationPrint, { doc, shots: [], modules: [], draft: false }));
    expect(html).toContain("Module: Sale");
    expect(html).toContain("ระบบ Dashboard สำหรับฝ่ายขาย");
    expect(html).not.toContain(`<td class="q-r">0</td>`);
    expect(html).not.toContain("1 × 0");
    expect(html).toContain("1 × 240,000");
  });
});

describe("the payment share on the paper (case #36)", () => {
  const render = (showPercent: boolean) =>
    renderToStaticMarkup(createElement(QuotationPrint, { doc: { ...newDoc(shots, "Pace", "2026-10-16"), showPercent }, shots, modules: [], draft: false }));

  it("prints the share column and its 100% while it is switched on", () => {
    const html = render(true);
    expect(html).toContain("สัดส่วน");
    expect(html).toContain("100%");
  });

  it("leaves the column out when it is switched off, the amounts kept", () => {
    const html = render(false);
    expect(html).not.toContain("สัดส่วน");
    expect(html).not.toContain("100%");
    expect(html).toContain("งวดการชำระเงิน / Payment Schedule");
  });
});

/** The cover layout on paper: the cover's totals, then the detail on a page of its own. */
describe("the cover layout on the paper", () => {
  const base = () => {
    const doc = newDoc([], "Mabuchi", "2026-10-19");
    doc.rows = [
      { ...emptyRow(), name: "รับสินค้าเข้าคลัง", days: 4 },
      { ...emptyRow(), name: "ค่าบริการรายปี", pricing: "unit", qty: 12, unit: "เดือน", unitPrice: 12_500 },
    ];
    return doc;
  };
  const modules = [
    { id: "m1", name: "ระบบคลังสินค้า", parts: [{ id: "p1", name: "รับเข้า", points: [], screens: ["รับสินค้าเข้าคลัง"] }] },
  ];

  it("totals each module on the cover and lists every line in the detail", () => {
    const html = renderToStaticMarkup(createElement(QuotationPrint, { doc: { ...base(), layout: "cover" }, shots: [], modules, draft: false }));
    expect(html).toContain("รวมทุกรายการ");
    expect(html).toContain("ราคาสุทธิ / Grand Total");
    expect(html).toContain("q-detail");
    expect(html).toContain("รวม ระบบคลังสินค้า");
    expect(html).toContain("รายการอื่น ๆ");
    expect(html).toContain("TOTAL");
    // 182,000 + 7% VAT = 194,740
    expect(html).toContain("หนึ่งแสนเก้าหมื่นสี่พันเจ็ดร้อยสี่สิบบาทถ้วน");
  });

  it("prints the list layout unchanged", () => {
    const html = renderToStaticMarkup(createElement(QuotationPrint, { doc: base(), shots: [], modules, draft: false }));
    expect(html).not.toContain("q-detail");
    expect(html).toContain("ราคาสุทธิ / Net");
  });
});

/**
 * Case #47: under each instalment the paper said "ชำระภายใน 7 วันนับจากวันที่
 * ถึงกำหนด" and nothing could change the wording, while the sender's own clause
 * above it read "ภายใน 7 วัน ณ วันสั่งซื้อ". The line is now the sender's to write.
 */
describe("the line under each instalment", () => {
  const signing = (due?: string, netDays = 7) => ({
    ...newDoc([], "SiamPools", "2026-11-05"),
    payment: [
      { id: "a", when: "เมื่อลงนามในสัญญา", percent: 60, netDays, ...(due === undefined ? {} : { due }) },
      { id: "b", when: "เมื่อส่งมอบงาน", percent: 40, netDays: 30 },
    ],
  });
  const print = (doc: ReturnType<typeof signing>) =>
    renderToStaticMarkup(createElement(QuotationPrint, { doc, shots: [], modules: [], draft: false }));

  it("prints the sender's wording in place of the days sentence", () => {
    const html = print(signing("ชำระภายใน 7 วัน ณ วันสั่งซื้อ"));
    expect(html).toContain("ชำระภายใน 7 วัน ณ วันสั่งซื้อ");
    expect(html).not.toContain("ชำระภายใน 7 วันนับจากวันที่ถึงกำหนด");
    expect(html).toContain("ชำระภายใน 30 วันนับจากวันที่ถึงกำหนด");
  });

  it("keeps the days sentence until the sender touches the line", () => {
    expect(print(signing())).toContain("ชำระภายใน 7 วันนับจากวันที่ถึงกำหนด");
  });

  it("prints the sender's wording even with no days to count", () => {
    expect(print(signing("ชำระเป็นเงินสด ณ วันส่งมอบ", 0))).toContain("ชำระเป็นเงินสด ณ วันส่งมอบ");
  });

  it("survives saving, and an untouched one leaves nothing behind", () => {
    const saved = (d: object) => parseDoc(JSON.parse(JSON.stringify(d)), "2026-11-05")!;
    expect(saved(signing("ณ วันสั่งซื้อ")).payment[0].due).toBe("ณ วันสั่งซื้อ");
    // An approved quotation compares its content key by key: an untouched line
    // must not add one, or every quotation approved before this would read as changed.
    expect("due" in saved(signing()).payment[1]).toBe(false);
  });
});

/**
 * Case #48: clearing the line brought the days sentence straight back, so a
 * sender who wanted it gone could not have that, and once the wording was
 * changed nothing led back to what the system had set.
 */
describe("leaving an instalment's wording blank", () => {
  const signing = (over: { when?: string; due?: string }) => ({
    ...newDoc([], "SiamPools", "2026-11-06"),
    payment: [{ id: "a", when: "เมื่อลงนามในสัญญา", percent: 100, netDays: 7, ...over }],
  });
  const print = (doc: ReturnType<typeof signing>) =>
    renderToStaticMarkup(createElement(QuotationPrint, { doc, shots: [], modules: [], draft: false }));

  it("prints no line under the condition once it is cleared", () => {
    expect(print(signing({ due: "" }))).not.toContain("นับจากวันที่ถึงกำหนด");
    expect(print(signing({ due: "  " }))).not.toContain("นับจากวันที่ถึงกำหนด");
  });

  it("prints a blank condition as blank, not a dash", () => {
    const html = print(signing({ when: "" }));
    expect(html).not.toMatch(/—\s*<span class="q-of">/);
    expect(html).toContain("ชำระภายใน 7 วันนับจากวันที่ถึงกำหนด");
  });

  it("stays cleared after saving", () => {
    const saved = parseDoc(JSON.parse(JSON.stringify(signing({ due: "" }))), "2026-11-06")!;
    expect(saved.payment[0].due).toBe("");
  });

  it("stores a cleared line, and drops the key when the sentence is typed back", () => {
    const term = presetUat()[0];
    expect(withDueLine(term, "").due).toBe("");
    const typedBack = withDueLine({ ...term, due: "x" }, "ชำระภายใน 30 วันนับจากวันที่ถึงกำหนด");
    expect("due" in typedBack).toBe(false);
  });

  it("leaves no key when there are no days to say anything about", () => {
    expect("due" in withDueLine({ ...presetUat()[0], netDays: 0 }, "")).toBe(false);
  });
});

describe("restoring an instalment's wording", () => {
  it("brings back a preset's text and leaves its share and days alone", () => {
    const edited = { ...presetUat()[0], when: "ข้อความที่แก้", due: "", percent: 25, netDays: 15 };
    const back = restoreTermText(edited);
    expect(back.when).toBe(presetUat()[0].when);
    expect("due" in back).toBe(false);
    expect(back.percent).toBe(25);
    expect(back.netDays).toBe(15);
  });

  it("knows the wording of an equal instalment by its place", () => {
    const third = presetEqual(4)[2];
    expect(restoreTermText({ ...third, when: "แก้แล้ว" }).when).toBe("งวดที่ 3");
    const first = presetEqual(4)[0];
    expect(restoreTermText({ ...first, when: "แก้แล้ว" }).when).toBe("งวดแรก — เมื่อลงนามในสัญญา");
  });

  it("keeps the condition of a row the sender added, which the system never set", () => {
    const added = { ...emptyTerm(2), when: "เมื่อขึ้นระบบจริง", due: "" };
    const back = restoreTermText(added);
    expect(back.when).toBe("เมื่อขึ้นระบบจริง");
    expect("due" in back).toBe(false);
  });

  it("is only on offer when there is something to restore", () => {
    expect(termTextEdited(presetUat()[0])).toBe(false);
    expect(termTextEdited({ ...presetUat()[0], percent: 10, netDays: 3 })).toBe(false);
    expect(termTextEdited({ ...presetUat()[0], when: "แก้แล้ว" })).toBe(true);
    expect(termTextEdited({ ...presetUat()[0], due: "" })).toBe(true);
    expect(termTextEdited({ ...emptyTerm(2), when: "เมื่อขึ้นระบบจริง" })).toBe(false);
    expect(termTextEdited({ ...emptyTerm(2), due: "ภายใน 3 วัน" })).toBe(true);
  });
});

describe("the instalment rows in the editor", () => {
  const panel = (term: ReturnType<typeof presetUat>[number], readOnly = false) => {
    const doc = { ...newDoc([], "SiamPools", "2026-11-06"), payment: [term] };
    return renderToStaticMarkup(createElement(QuoteTerms, { doc, readOnly, onEdit: () => {} }));
  };

  it("shows the sentence that will print as text in the field", () => {
    expect(panel(presetUat()[0])).toContain('value="ชำระภายใน 30 วันนับจากวันที่ถึงกำหนด"');
  });

  it("shows a cleared line as empty, and says what empty does", () => {
    const html = panel({ ...presetUat()[0], due: "" });
    expect(html).not.toContain('value="ชำระภายใน 30 วันนับจากวันที่ถึงกำหนด"');
    expect(html).toContain("ไม่พิมพ์บรรทัดนี้");
  });

  it("offers คืนค่า only on a row whose wording changed, and not when read-only", () => {
    expect(panel(presetUat()[0])).not.toContain("คืนค่าข้อความ");
    expect(panel({ ...presetUat()[0], due: "" })).toContain("คืนค่าข้อความ");
    expect(panel({ ...presetUat()[0], due: "" }, true)).not.toContain("คืนค่าข้อความ");
  });
});

import { AlignmentType, ShadingType, TableRow, TabStopType, type Document, type Paragraph, type Table } from "docx";
import {
  BILLING_CYCLE_LABEL,
  discountRate,
  formatTHB,
  lineTotal,
  lumpSumScope,
  maintenanceTotals,
  marketComparison,
  paymentSchedule,
  percentText,
  printsPrice,
  quoteTotals,
  rowBasis,
  thaiDate,
  thaiDateShort,
  validUntil,
  type QuoteDoc,
  type QuoteRow,
  type BillingCycle,
} from "@/lib/quote";
import { acceptanceClauses } from "@/lib/quote-clauses";
import { bahtText } from "@/lib/baht-text";
import type { ProposalModule } from "@/lib/proposal-modules";
import { quoteSheet, type QuoteSheet, type SheetLine } from "@/lib/quote-sheet";
import type { Shot } from "@/lib/shots";
import {
  CONTENT,
  DIM,
  GREEN,
  HEAD_FILL,
  INK,
  LIST,
  NOTE,
  RULE,
  accentOf,
  cell,
  dashed,
  framedShot,
  fs,
  gap,
  grid,
  heading,
  letterhead,
  para,
  px,
  run,
  signatures,
  solid,
  typed,
  wordDocument,
  type Tone,
  type WordArt,
} from "@/lib/word-paper";

/**
 * The quotation as a Word file (case #27): QuotationPrint, block for block,
 * read off the same document through the same helpers, so the .docx and the
 * PDF cannot disagree about a number. The layout notes live in QuotationPrint
 * and app/globals.css; this file only says how each block is written in Word.
 */
export function quotationDocx(doc: QuoteDoc, shots: Shot[], modules: ProposalModule[], art: WordArt): Document {
  const accent = accentOf(doc.brand);
  const t = quoteTotals(doc);
  const market = marketComparison(doc);
  const plan = paymentSchedule(doc);
  const ma = maintenanceTotals(doc.ma);
  const clauses = acceptanceClauses(doc);
  const gallery = shots.filter((s) => s.url);
  const sheet = doc.layout === "cover" ? quoteSheet(doc, modules) : null;

  const body: (Paragraph | Table)[] = [];
  if (doc.subject) body.push(para([run(`เรื่อง : ${doc.subject}`, { bold: true })], { spacing: { before: px(14) } }));
  if (sheet) {
    body.push(gap(10), coverTable(doc, sheet, accent), gap(10), totals(doc, accent));
    body.push(para([run(`(${bahtText(t.grand)})`, { bold: true })], { alignment: AlignmentType.RIGHT, spacing: { before: px(6) } }));
  } else {
    body.push(gap(10), items(doc, accent), gap(10), totals(doc, accent));
  }

  if (market) {
    body.push(gap(14), marketBox(market, doc.marketNote));
  }

  if (plan.rows.length > 0) {
    body.push(heading("งวดการชำระเงิน / Payment Schedule", accent), payments(doc, plan));
  }

  if (doc.ma.enabled) {
    body.push(heading("ค่าบำรุงรักษาระบบ (MA) — ไม่รวมในราคาข้างต้น", accent), maintenance(ma, doc.ma.billingCycle));
    if (doc.ma.note) body.push(para(typed(doc.ma.note, { color: NOTE }), { spacing: { before: px(5) } }));
  }

  if (clauses.length > 0) {
    body.push(heading("เงื่อนไขการส่งมอบ ตรวจรับ และชำระเงิน", accent));
    for (const c of clauses) {
      body.push(para([run(c)], { numbering: { reference: LIST.numbered, level: 0 }, spacing: { before: px(4) } }));
    }
  }

  if (doc.terms.trim()) {
    body.push(heading("หมายเหตุ", accent));
    for (const line of doc.terms.replace(/\s+$/, "").split("\n")) body.push(para([run(line)]));
  }

  body.push(
    para([run("ทางบริษัทขอขอบพระคุณสำหรับการสั่งซื้อของท่าน", { bold: true })], {
      alignment: AlignmentType.RIGHT,
      spacing: { before: px(22) },
    }),
    gap(20),
    signatures(["ลงนามผู้เสนอราคา", `วันที่ ${thaiDate(doc.issuedAt)}`], ["ลงนามผู้อนุมัติสั่งซื้อ", "วันที่ ........./........./........."])
  );

  // The cover layout's second sheet, on a page of its own.
  if (sheet && sheet.sections.length > 0) {
    body.push(
      para([run(`รายละเอียดใบเสนอราคา / Details${doc.quoteNo ? ` · ${doc.quoteNo}` : ""}`, { bold: true, size: fs(14) })], {
        pageBreakBefore: true,
        keepNext: true,
        spacing: { after: px(6) },
        border: { bottom: { ...dashed(1, accent), space: 4 } },
      }),
      detailTable(doc, sheet, accent)
    );
  }

  if (doc.showShots && gallery.length > 0) {
    body.push(heading(`ภาคผนวก — หน้าจอที่เสนอราคา (${gallery.length})`, accent, fs(14)), appendix(gallery, art));
  }

  return wordDocument({
    title: `ใบเสนอราคา ${doc.quoteNo}`.trim(),
    creator: doc.brand.name,
    header: letterhead({
      title: "ใบเสนอราคา",
      meta: [
        ["เลขที่ :", doc.quoteNo || "—"],
        ["วันที่ :", thaiDateShort(doc.issuedAt)],
        ["ยืนราคาถึง :", thaiDateShort(validUntil(doc))],
      ],
      customer: {
        attn: doc.customerAttn,
        name: doc.customerName,
        address: doc.customerAddress,
        phone: doc.customerPhone,
      },
      presentedBy: doc.presentedBy,
      brand: doc.brand,
      logo: art.logo,
    }),
    body,
  });
}

// ---- line items: number, description, amount ----

const N = px(34);
const AMOUNT = px(130);
const DESC = CONTENT - N - AMOUNT;
const ITEM_PAD = { top: px(8), bottom: px(8), left: px(8), right: px(8) };

function items(doc: QuoteDoc, accent: string): Table {
  const edge = { top: dashed(2, accent), bottom: dashed(2, accent) };
  const head = (width: number, text: string, alignment: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    cell(width, [para([run(text, { bold: true })], { alignment })], {
      borders: edge,
      margins: { top: px(6), bottom: px(6), left: px(8), right: px(8) },
    });

  const rows: TableRow[] = [
    // Repeats at the top of every page the list runs onto, as the print path's <thead> does.
    new TableRow({
      tableHeader: true,
      children: [
        head(N, "", AlignmentType.RIGHT),
        head(DESC, "รายละเอียด / Description", AlignmentType.CENTER),
        head(AMOUNT, "ราคา / Amount", AlignmentType.RIGHT),
      ],
    }),
  ];

  if (doc.lumpSum.enabled) {
    rows.push(
      itemRow(
        "1",
        describe([
          { text: [run(doc.lumpSum.title || doc.subject || "—", { bold: true })], keep: true },
          { text: typed(lumpSumScope(doc), NOTE_TONE), keep: false, before: px(2) },
        ]),
        formatTHB(quoteTotals(doc).subtotal)
      )
    );
  } else if (doc.rows.length === 0) {
    rows.push(itemRow("", [para([run("—", { color: DIM })])], "0"));
  } else {
    doc.rows.forEach((r, i) =>
      rows.push(
        itemRow(String(i + 1), rowLines(r, doc), printsPrice(r, doc.ratePerDay) ? formatTHB(lineTotal(r, doc.ratePerDay)) : "")
      )
    );
  }

  return grid([N, DESC, AMOUNT], rows);
}

const NOTE_TONE: Tone = { size: fs(11.5), color: NOTE };

interface Line {
  text: ReturnType<typeof typed>;
  /** Kept on the same page as the line after it: a name never strands from its price basis. */
  keep: boolean;
  before?: number;
}

/** A row's description: who it belongs to, its name, what its price is made of, its scope. */
function rowLines(r: QuoteRow, doc: QuoteDoc): Paragraph[] {
  const lines: Line[] = [];
  if (r.sub && r.parent) lines.push({ text: [run(`modal ของ ${r.parent}`, { size: fs(10), color: DIM })], keep: true });
  lines.push({ text: [run(r.name || "—", { bold: true })], keep: true });
  if (doc.showBasis && printsPrice(r, doc.ratePerDay)) lines.push({ text: [run(rowBasis(r, doc.ratePerDay), { size: fs(10.5), color: DIM })], keep: true });
  if (r.note) lines.push({ text: typed(r.note, NOTE_TONE), keep: false, before: px(2) });
  // A modal reads as part of its screen: indented behind a grey rule.
  return describe(lines, r.sub);
}

function describe(lines: Line[], sub = false): Paragraph[] {
  return lines.map((l, i) =>
    para(l.text, {
      keepNext: l.keep && i < lines.length - 1,
      spacing: l.before ? { before: l.before } : undefined,
      ...(sub ? { indent: { left: px(12) }, border: { left: { ...solid(2, RULE), space: 6 } } } : {}),
    })
  );
}

function itemRow(n: string, desc: Paragraph[], amount: string): TableRow {
  return new TableRow({
    children: [
      cell(N, [para([run(n, { color: DIM })], { alignment: AlignmentType.RIGHT })], { margins: ITEM_PAD }),
      cell(DESC, desc, { margins: ITEM_PAD }),
      cell(AMOUNT, [para([run(amount)], { alignment: AlignmentType.RIGHT })], { margins: ITEM_PAD }),
    ],
  });
}

// ---- the cover layout: ruled tables, as the contractor's sheet prints them ----

const RULED = {
  top: solid(1, RULE),
  bottom: solid(1, RULE),
  left: solid(1, RULE),
  right: solid(1, RULE),
  insideHorizontal: solid(1, RULE),
  insideVertical: solid(1, RULE),
};
const BOQ_PAD = { top: px(5), bottom: px(5), left: px(7), right: px(7) };
const BOQ_N = px(52);
const BOQ_QTY = px(58);
const BOQ_UNIT = px(64);
const BOQ_MONEY = px(96);
const COVER_MONEY = px(130);
const SEC_FILL = "FAFAFA";

const qtyText = (n: number | null) => (n === null ? "" : n.toLocaleString("th-TH", { maximumFractionDigits: 2 }));
const moneyText = (n: number | null) => (n === null ? "" : formatTHB(n));

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

/** The filled header row — repeats at the top of every page the table runs onto. */
function boqHead(widths: number[], labels: string[], accent: string): TableRow {
  return new TableRow({
    tableHeader: true,
    children: labels.map((label, i) =>
      cell(widths[i], [para([run(label, { bold: true })], { alignment: AlignmentType.CENTER })], {
        margins: BOQ_PAD,
        shading: { fill: HEAD_FILL, type: ShadingType.CLEAR, color: "auto" },
        borders: { top: solid(2, accent) },
      })
    ),
  });
}

const textCell = (width: number, text: string, alignment: Align, tone: Tone = {}) =>
  cell(width, [para([run(text, tone)], { alignment })], { margins: BOQ_PAD });

/** "รวม …" or "TOTAL": the label across every column between the number and the figure. */
function closingRow(widths: number[], label: string, amount: number, total: boolean): TableRow {
  const edge = total ? { top: solid(2, INK) } : { top: solid(1, DIM) };
  const tone: Tone = total ? { bold: true, size: fs(13.5) } : { bold: true };
  const between = widths.slice(1, -1);
  return new TableRow({
    cantSplit: true,
    children: [
      cell(widths[0], [para([])], { margins: BOQ_PAD, borders: edge }),
      cell(between.reduce((a, b) => a + b, 0), [para([run(label, tone)], { alignment: AlignmentType.RIGHT })], {
        margins: BOQ_PAD,
        borders: edge,
        columnSpan: between.length,
      }),
      cell(widths[widths.length - 1], [para([run(formatTHB(amount), tone)], { alignment: AlignmentType.RIGHT })], {
        margins: BOQ_PAD,
        borders: edge,
      }),
    ],
  });
}

/** The cover: one line per module — ลำดับที่ · รายการ · จำนวน · หน่วย · จำนวนเงิน — and their total. */
function coverTable(doc: QuoteDoc, sheet: QuoteSheet, accent: string): Table {
  const desc = CONTENT - BOQ_N - BOQ_QTY - BOQ_UNIT - COVER_MONEY;
  const widths = [BOQ_N, desc, BOQ_QTY, BOQ_UNIT, COVER_MONEY];
  const rows: TableRow[] = [boqHead(widths, ["ลำดับที่", "รายการ", "จำนวน", "หน่วย", "จำนวนเงิน (บาท)"], accent)];
  for (const l of sheet.cover) {
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          textCell(widths[0], l.no, AlignmentType.CENTER),
          textCell(widths[1], l.name, AlignmentType.LEFT, { bold: true }),
          textCell(widths[2], qtyText(l.qty), AlignmentType.CENTER),
          textCell(widths[3], l.unit, AlignmentType.CENTER),
          textCell(widths[4], moneyText(l.amount), AlignmentType.RIGHT),
        ],
      })
    );
  }
  rows.push(closingRow(widths, doc.lumpSum.enabled ? "รวมทุกรายการ (ราคาเหมารวม)" : "รวมทุกรายการ", sheet.total, true));
  return grid(widths, rows, { borders: RULED });
}

/** The detail: each module's lines under it, a subtotal per module, the TOTAL last. */
function detailTable(doc: QuoteDoc, sheet: QuoteSheet, accent: string): Table {
  const desc = CONTENT - BOQ_N - BOQ_QTY - BOQ_UNIT - 2 * BOQ_MONEY;
  const widths = [BOQ_N, desc, BOQ_QTY, BOQ_UNIT, BOQ_MONEY, BOQ_MONEY];
  const rows: TableRow[] = [boqHead(widths, ["ลำดับที่", "รายการ", "จำนวน", "หน่วย", "ราคา/หน่วย", "จำนวนเงิน"], accent)];
  for (const s of sheet.sections) {
    const fill = { shading: { fill: SEC_FILL, type: ShadingType.CLEAR, color: "auto" } };
    rows.push(
      new TableRow({
        cantSplit: true,
        children: [
          cell(widths[0], [para([run(s.no, { bold: true })], { alignment: AlignmentType.CENTER, keepNext: true })], {
            margins: BOQ_PAD,
            ...fill,
          }),
          cell(CONTENT - BOQ_N, [para([run(s.name, { bold: true })], { keepNext: true })], {
            margins: BOQ_PAD,
            columnSpan: 5,
            ...fill,
          }),
        ],
      })
    );
    for (const l of s.lines) rows.push(detailRow(widths, l));
    if (s.subtotal !== null) rows.push(closingRow(widths, `รวม ${s.name}`, s.subtotal, false));
  }
  rows.push(closingRow(widths, doc.lumpSum.enabled ? "TOTAL (ราคาเหมารวม)" : "TOTAL", sheet.total, true));
  return grid(widths, rows, { borders: RULED });
}

function detailRow(widths: number[], l: SheetLine): TableRow {
  const lines: Line[] = [{ text: [run(l.name, { bold: true })], keep: true }];
  if (l.note) lines.push({ text: typed(l.note, NOTE_TONE), keep: false, before: px(2) });
  return new TableRow({
    cantSplit: true,
    children: [
      textCell(widths[0], l.no, AlignmentType.CENTER, { color: DIM }),
      cell(widths[1], describe(lines, l.sub), { margins: BOQ_PAD }),
      textCell(widths[2], qtyText(l.qty), AlignmentType.CENTER),
      textCell(widths[3], l.unit, AlignmentType.CENTER),
      textCell(widths[4], moneyText(l.unitPrice), AlignmentType.RIGHT),
      textCell(widths[5], moneyText(l.amount), AlignmentType.RIGHT),
    ],
  });
}

// ---- totals, right-aligned under a dashed rule ----

function totals(doc: QuoteDoc, accent: string): Table {
  const t = quoteTotals(doc);
  // The cover layout labels its totals the way the contractor's sheet does (QuotationSheet.tsx).
  const cover = doc.layout === "cover";
  const lines: [string, string, boolean][] = [[cover ? "ราคารวม / Sub Total" : "ราคารวม / Total", formatTHB(t.subtotal), false]];
  if (t.discount > 0) {
    lines.push([`ส่วนลด / Discount ${discountRate(doc.discount)}`, `−${formatTHB(t.discount)}`, false]);
    if (cover) lines.push(["ราคาหลังหักส่วนลด / Total", formatTHB(t.net), false]);
  }
  if (doc.vatPercent > 0) lines.push([`ภาษีมูลค่าเพิ่ม / ${cover ? "VAT" : "Vat"} ${doc.vatPercent}%`, formatTHB(t.vat), false]);
  lines.push([cover ? "ราคาสุทธิ / Grand Total" : "ราคาสุทธิ / Net", formatTHB(t.grand), true]);

  const label = px(240);
  const value = px(160);
  const pad = { top: px(4), bottom: px(4) };
  return grid(
    [label, value],
    lines.map(([l, v, net]) => {
      const tone: Tone = net ? { bold: true, size: fs(14) } : { bold: false };
      return new TableRow({
        children: [
          cell(label, [para([run(l, { ...tone, bold: true })], { alignment: AlignmentType.RIGHT })], {
            margins: { ...pad, right: px(18) },
          }),
          cell(value, [para([run(v, tone)], { alignment: AlignmentType.RIGHT })], {
            margins: pad,
            borders: { bottom: dashed(1, accent) },
          }),
        ],
      });
    }),
    { alignment: AlignmentType.RIGHT, borders: { top: dashed(2, accent) } }
  );
}

// ---- the market comparison: an estimate, boxed apart from the price ----

function marketBox(m: NonNullable<ReturnType<typeof marketComparison>>, note: string): Table {
  const tab = [{ type: TabStopType.RIGHT, position: px(470) }];
  const children: Paragraph[] = [
    para([run("ราคาตลาดโดยประมาณสำหรับขอบเขตงานนี้\t"), run(formatTHB(m.market), { color: DIM, strike: true })], { tabStops: tab }),
    para([run(`ราคาที่เสนอ\t${formatTHB(m.quoted)}`)], { tabStops: tab }),
    para([run(`ประหยัด\t${formatTHB(m.saved)} (${m.percent}%)`, { bold: true, color: GREEN })], { tabStops: tab }),
  ];
  if (note) children.push(para(typed(note, { color: NOTE }), { spacing: { before: px(5) } }));
  return grid([CONTENT], [
    new TableRow({
      cantSplit: true,
      children: [
        cell(CONTENT, children, {
          margins: { top: px(9), bottom: px(9), left: px(12), right: px(12) },
          borders: { top: solid(1, RULE), right: solid(1, RULE), bottom: solid(1, RULE), left: solid(3, GREEN) },
        }),
      ],
    }),
  ]);
}

// ---- payment schedule ----

function payments(doc: QuoteDoc, plan: ReturnType<typeof paymentSchedule>): Table {
  const withVat = doc.vatPercent > 0;
  const money = withVat ? [px(100), px(90), px(100)] : [px(120)];
  const n = px(44);
  // The share column, when it prints (case #36); the money columns follow it.
  const pct = doc.showPercent ? [px(70)] : [];
  const when = CONTENT - n - pct.reduce((a, b) => a + b, 0) - money.reduce((a, b) => a + b, 0);
  const widths = [n, when, ...pct, ...money];
  const m = 2 + pct.length;
  const pad = { top: px(4), bottom: px(4), left: px(8), right: px(8) };
  const R = AlignmentType.RIGHT;
  const C = AlignmentType.CENTER;
  const L = AlignmentType.LEFT;

  const head = (i: number, text: string, alignment: typeof R | typeof C | typeof L) =>
    cell(widths[i], [para([run(text, { bold: true })], { alignment })], {
      margins: pad,
      shading: { fill: HEAD_FILL, type: ShadingType.CLEAR, color: "auto" },
      borders: { bottom: solid(1, RULE) },
    });
  const body = (i: number, children: Paragraph[]) => cell(widths[i], children, { margins: pad, borders: { bottom: solid(1, RULE) } });
  const foot = (i: number, text: string, alignment: typeof R | typeof C, span = 1) =>
    cell(
      span === 1 ? widths[i] : widths[i] + widths[i + 1],
      [para([run(text, { bold: true })], { alignment })],
      { margins: pad, borders: { top: solid(2, INK) }, columnSpan: span }
    );
  const sum = (pick: (r: (typeof plan.rows)[number]) => number) => formatTHB(plan.rows.reduce((s, r) => s + pick(r), 0));

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        head(0, "งวด", L),
        head(1, "เงื่อนไขการชำระ", L),
        ...(doc.showPercent ? [head(2, "สัดส่วน", C)] : []),
        ...(withVat
          ? [head(m, "ก่อนภาษี", R), head(m + 1, `VAT ${doc.vatPercent}%`, R), head(m + 2, "รวม", R)]
          : [head(m, "จำนวนเงิน", R)]),
      ],
    }),
    ...plan.rows.map((line, i) => {
      const term: Paragraph[] = [para([run(line.term.when || "—")])];
      if (line.term.netDays > 0) {
        term.push(para([run(`ชำระภายใน ${line.term.netDays} วันนับจากวันที่ถึงกำหนด`, { size: fs(10), color: DIM })]));
      }
      const amount = (text: string) => [para([run(text)], { alignment: R })];
      return new TableRow({
        cantSplit: true,
        children: [
          body(0, [para([run(String(i + 1), { color: DIM })])]),
          body(1, term),
          ...(doc.showPercent ? [body(2, [para([run(`${percentText(line.term.percent)}%`)], { alignment: C })])] : []),
          ...(withVat
            ? [body(m, amount(formatTHB(line.beforeVat))), body(m + 1, amount(formatTHB(line.vat))), body(m + 2, amount(formatTHB(line.amount)))]
            : [body(m, amount(formatTHB(line.amount)))]),
        ],
      });
    }),
    new TableRow({
      cantSplit: true,
      children: [
        foot(0, "", R, 2),
        ...(doc.showPercent ? [foot(2, `${plan.percentSum}%`, C)] : []),
        ...(withVat
          ? [foot(m, sum((r) => r.beforeVat), R), foot(m + 1, sum((r) => r.vat), R), foot(m + 2, sum((r) => r.amount), R)]
          : [foot(m, sum((r) => r.amount), R)]),
      ],
    }),
  ];
  return grid(widths, rows);
}

// ---- maintenance: priced beside the project, never inside its total ----

function maintenance(ma: ReturnType<typeof maintenanceTotals>, cycle: BillingCycle | null): Table {
  const value = px(260);
  const label = CONTENT - value;
  const pad = { top: px(4), bottom: px(4), left: px(8), right: px(8) };
  const lines: [string, string, boolean][] = [
    ["อัตราค่าบำรุงรักษา", `${formatTHB(ma.perModule)} / module / เดือน × ${ma.modules} module`, false],
    ["รวมต่อเดือน", formatTHB(ma.monthly), false],
  ];
  if (ma.includedMonths > 0) lines.push([`${ma.includedMonths} เดือนแรกนับจากวันตรวจรับ`, "รวมอยู่ในราคาโครงการแล้ว", false]);
  if (cycle) lines.push(["รอบการชำระ", BILLING_CYCLE_LABEL[cycle], false]);
  lines.push(["ปีที่ 2 เป็นต้นไป", `${formatTHB(ma.annual)} / ปี`, true]);
  return grid(
    [label, value],
    lines.map(
      ([l, v, year2]) =>
        new TableRow({
          cantSplit: true,
          children: [
            cell(label, [para([run(l, year2 ? { bold: true } : { color: DIM })])], { margins: pad, borders: { bottom: solid(1, RULE) } }),
            cell(value, [para([run(v, { bold: year2 })], { alignment: AlignmentType.RIGHT })], {
              margins: pad,
              borders: { bottom: solid(1, RULE) },
            }),
          ],
        })
    )
  );
}

// ---- the screenshot appendix, three to a row ----

function appendix(gallery: Shot[], art: WordArt): Table {
  const col = Math.floor(CONTENT / 3);
  const imageWidth = Math.floor((col - px(10)) / 15);
  const pad = { top: px(10), bottom: 0, left: px(5), right: px(5) };
  const rows: TableRow[] = [];
  for (let start = 0; start < gallery.length; start += 3) {
    const cells = [0, 1, 2].map((k) => {
      const i = start + k;
      const s = gallery[i];
      if (!s) return cell(col, [para([])], { margins: pad });
      const img = art.shots.get(s.url);
      return cell(
        col,
        [
          para(img ? [framedShot(img, imageWidth, s.name)] : []),
          para(
            [run(`${String(i + 1).padStart(2, "0")} · ${s.parent ? `${s.parent} — ` : ""}${s.name}`, { size: fs(10), color: DIM })],
            { spacing: { before: px(3) } }
          ),
        ],
        { margins: pad }
      );
    });
    rows.push(new TableRow({ cantSplit: true, children: cells }));
  }
  return grid([col, col, col], rows);
}

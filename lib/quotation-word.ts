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
export function quotationDocx(doc: QuoteDoc, shots: Shot[], art: WordArt): Document {
  const accent = accentOf(doc.brand);
  const t = quoteTotals(doc);
  const market = marketComparison(doc);
  const plan = paymentSchedule(doc);
  const ma = maintenanceTotals(doc.ma);
  const clauses = acceptanceClauses(doc);
  const gallery = shots.filter((s) => s.url);

  const body: (Paragraph | Table)[] = [];
  if (doc.subject) body.push(para([run(`เรื่อง : ${doc.subject}`, { bold: true })], { spacing: { before: px(14) } }));
  body.push(gap(10), items(doc, accent), gap(10), totals(doc, accent));

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

// ---- totals, right-aligned under a dashed rule ----

function totals(doc: QuoteDoc, accent: string): Table {
  const t = quoteTotals(doc);
  const lines: [string, string, boolean][] = [["ราคารวม / Total", formatTHB(t.subtotal), false]];
  if (t.discount > 0) lines.push([`ส่วนลด / Discount ${discountRate(doc.discount)}`, `−${formatTHB(t.discount)}`, false]);
  if (doc.vatPercent > 0) lines.push([`ภาษีมูลค่าเพิ่ม / Vat ${doc.vatPercent}%`, formatTHB(t.vat), false]);
  lines.push(["ราคาสุทธิ / Net", formatTHB(t.grand), true]);

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
  const pct = px(70);
  const when = CONTENT - n - pct - money.reduce((a, b) => a + b, 0);
  const widths = [n, when, pct, ...money];
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
        head(2, "สัดส่วน", C),
        ...(withVat ? [head(3, "ก่อนภาษี", R), head(4, `VAT ${doc.vatPercent}%`, R), head(5, "รวม", R)] : [head(3, "จำนวนเงิน", R)]),
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
          body(2, [para([run(`${percentText(line.term.percent)}%`)], { alignment: C })]),
          ...(withVat
            ? [body(3, amount(formatTHB(line.beforeVat))), body(4, amount(formatTHB(line.vat))), body(5, amount(formatTHB(line.amount)))]
            : [body(3, amount(formatTHB(line.amount)))]),
        ],
      });
    }),
    new TableRow({
      cantSplit: true,
      children: [
        foot(0, "", R, 2),
        foot(2, `${plan.percentSum}%`, C),
        ...(withVat
          ? [foot(3, sum((r) => r.beforeVat), R), foot(4, sum((r) => r.vat), R), foot(5, sum((r) => r.amount), R)]
          : [foot(3, sum((r) => r.amount), R)]),
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

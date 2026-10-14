import { AlignmentType, TableRow, TabStopType, type Document, type Paragraph, type Table } from "docx";
import { thaiDate, thaiDateShort, type QuoteDoc } from "@/lib/quote";
import {
  howLines,
  proposalSteps,
  proposalTimeline,
  screenDocFor,
  stepJourney,
  type ProposalDoc,
  type ProposalStep,
} from "@/lib/proposal";
import type { Shot } from "@/lib/shots";
import {
  CONTENT,
  DIM,
  LIST,
  RULE,
  accentOf,
  cell,
  framedShot,
  fs,
  gap,
  grid,
  heading,
  letterhead,
  mm,
  para,
  px,
  run,
  signatures,
  solid,
  typed,
  wordDocument,
  type WordArt,
} from "@/lib/word-paper";

/**
 * The proposal as a Word file (case #27): ProposalPrint, block for block. Like
 * the paper, it names no money: every figure comes off the quotation through
 * proposalTimeline, and the price section only points at the quotation.
 */
export function proposalDocx(doc: ProposalDoc, quote: QuoteDoc | null, shots: Shot[], art: WordArt): Document {
  const accent = accentOf(doc.brand);
  const steps = proposalSteps(shots, quote);
  const time = proposalTimeline(quote);
  const points = doc.points.filter((p) => p.problem.trim() || p.feature.trim());
  const excluded = doc.excluded.filter((x) => x.trim());
  const quoteNo = doc.quoteNo.trim() || quote?.quoteNo?.trim() || "";

  const body: (Paragraph | Table)[] = [];
  if (doc.subject) body.push(para([run(`เรื่อง : ${doc.subject}`, { bold: true })], { spacing: { before: px(14) } }));

  if (doc.context.trim()) {
    body.push(heading("สภาพการทำงานในปัจจุบัน", accent), para(typed(doc.context)));
  }

  if (points.length > 0) {
    body.push(heading("ระบบนี้แก้ปัญหาอะไรให้บ้าง", accent), pointsTable(points, accent));
  }

  if (doc.showSteps && steps.length > 0) {
    body.push(heading(`การใช้งานจริง — เดินให้ดูทีละหน้า (${steps.length})`, accent), walk(doc, steps, art, accent));
  }

  if (time.known) {
    const boxes: [string, string, string][] = [];
    // A quotation priced by the unit counts no man-days; "0 วันทำการ" is not a schedule.
    if (time.buildDays > 0) boxes.push([String(time.buildDays), "วันทำการ", "พัฒนาและติดตั้งตามขอบเขต"]);
    boxes.push([String(time.reviewDays), "วัน", "ตรวจรับหลังส่งมอบ"]);
    if (time.includedMonths > 0) boxes.push([String(time.includedMonths), "เดือนแรก", "ดูแลระบบรวมในราคาโครงการ"]);
    body.push(heading("ขั้นตอนและระยะเวลา", accent), timeline(boxes));
  }

  if (excluded.length > 0) {
    body.push(heading("สิ่งที่ไม่รวมในเฟสนี้", accent));
    for (const x of excluded) {
      body.push(para([run(x)], { numbering: { reference: LIST.bullets, level: 0 }, spacing: { before: px(3) } }));
    }
  }

  if (doc.showQuoteRef) {
    body.push(
      heading("ราคาและเงื่อนไขการชำระเงิน", accent),
      para([
        run(
          quoteNo
            ? `ตามใบเสนอราคาเลขที่ ${quoteNo} ที่แนบมาพร้อมเอกสารฉบับนี้`
            : "ตามใบเสนอราคาที่แนบมาพร้อมเอกสารฉบับนี้"
        ),
      ])
    );
  }

  if (doc.closing.trim()) body.push(para(typed(doc.closing), { spacing: { before: px(14) } }));

  body.push(
    gap(20),
    signatures(["ลงนามผู้เสนอ", `วันที่ ${thaiDate(doc.issuedAt)}`], ["ลงนามผู้รับข้อเสนอ", "วันที่ ........./........./........."])
  );

  const meta: [string, string][] = [
    ["เลขที่ :", doc.proposalNo || "—"],
    ["วันที่ :", thaiDateShort(doc.issuedAt)],
  ];
  if (doc.showQuoteRef && quoteNo) meta.push(["อ้างถึงใบเสนอราคา :", quoteNo]);

  return wordDocument({
    title: `ข้อเสนอโครงการ ${doc.proposalNo}`.trim(),
    creator: doc.brand.name,
    header: letterhead({
      title: "ข้อเสนอโครงการ",
      meta,
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

/** Problem → what the system does → outcome, one row each. */
function pointsTable(points: ProposalDoc["points"], accent: string): Table {
  const col = Math.floor(CONTENT / 3);
  const widths = [col, col, CONTENT - 2 * col];
  const pad = (first: boolean) => ({ top: px(6), bottom: px(6), left: first ? 0 : px(8), right: px(8) });
  const head = (i: number, text: string) =>
    cell(widths[i], [para([run(text, { size: fs(11), color: DIM, bold: true })])], {
      margins: { ...pad(i === 0), top: px(4), bottom: px(4) },
      borders: { bottom: solid(1.5, accent) },
    });
  return grid(widths, [
    new TableRow({
      tableHeader: true,
      children: [head(0, "ปัญหาที่พบวันนี้"), head(1, "สิ่งที่ระบบทำให้"), head(2, "ผลที่ได้")],
    }),
    ...points.map(
      (p) =>
        new TableRow({
          cantSplit: true,
          children: [p.problem, p.feature, p.outcome].map((text, i) =>
            cell(widths[i], [para(typed(text || "—"))], { margins: pad(i === 0), borders: { bottom: solid(1, RULE) } })
          ),
        })
    ),
  ]);
}

/**
 * The demonstrated walk, one screen per row: the picture on the left, what the
 * screen does and how it is used on the right. Without pictures the manual
 * takes the full width, as on the paper.
 */
function walk(doc: ProposalDoc, steps: ProposalStep[], art: WordArt, accent: string): Table {
  const shotWidth = mm(62);
  const withShots = doc.showShots;
  const widths = withShots ? [shotWidth + px(12), CONTENT - shotWidth - px(12)] : [CONTENT];
  const text = widths[widths.length - 1];
  const small = fs(10.5);
  const pad = { top: px(12), bottom: 0, left: 0, right: 0 };
  const top = { top: solid(1, RULE) };

  return grid(
    widths,
    steps.map((s, i) => {
      const lines: (Paragraph | Table)[] = [
        para([
          run(`ขั้นตอนที่ ${i + 1}`, { bold: true, color: accent, size: fs(11.5) }),
          run(" · ", { size: fs(11.5) }),
          run(s.name, { bold: true, size: fs(11.5) }),
        ]),
      ];
      // One origin line, not two: "เปิดจากหน้า X" already says whose window this is.
      const route = stepJourney(s) ?? (s.parent ? `หน้าต่างย่อยของ ${s.parent}` : null);
      if (route) lines.push(para([run(route, { size: small, color: DIM })], { spacing: { before: px(1) } }));

      const manual = screenDocFor(doc, s.name);
      if (manual) {
        lines.push(manualTable(manual, i, text, accent), gap(1));
      } else if (s.note) {
        lines.push(para(typed(s.note, { size: small, color: DIM }), { spacing: { before: px(3) } }));
      }

      const img = art.shots.get(s.url);
      const picture = cell(widths[0], [para(img ? [framedShot(img, Math.round((shotWidth / 1440) * 96), s.name)] : [])], {
        margins: { ...pad, right: px(12) },
        borders: top,
      });
      return new TableRow({
        cantSplit: true,
        children: [...(withShots ? [picture] : []), cell(text, lines, { margins: pad, borders: top })],
      });
    })
  );
}

/** The what / how / result register under a step; the how is numbered under the step's own number. */
function manualTable(manual: NonNullable<ReturnType<typeof screenDocFor>>, step: number, width: number, accent: string): Table {
  const label = px(58);
  const small = fs(10.5);
  const pad = { top: px(2), bottom: px(2), left: 0, right: 0 };
  const row = (name: string, content: Paragraph[]) =>
    new TableRow({
      children: [
        cell(label, [para([run(name, { size: small, color: DIM, bold: true })])], { margins: pad }),
        cell(width - label, content, { margins: pad }),
      ],
    });

  const rows: TableRow[] = [];
  if (manual.does) rows.push(row("ทำอะไร", [para(typed(manual.does, { size: small }))]));
  const how = howLines(manual.how);
  if (how.length > 0) {
    const tabs = [{ type: TabStopType.LEFT, position: px(30) }];
    rows.push(
      row(
        "ขั้นตอน",
        how.map((line, j) =>
          para([run(`${step + 1}.${j + 1}`, { size: small, bold: true, color: accent }), run(`\t${line}`, { size: small })], {
            tabStops: tabs,
            indent: { left: px(30), hanging: px(30) },
            spacing: { before: px(1) },
          })
        )
      )
    );
  }
  if (manual.result) rows.push(row("ผลลัพธ์", [para(typed(manual.result, { size: small }))]));
  return grid([label, width - label], rows);
}

/** The figures read off the quotation, side by side: a big number and what it is for. */
function timeline(boxes: [string, string, string][]): Table {
  const width = px(190);
  return grid(
    boxes.map(() => width),
    [
      new TableRow({
        cantSplit: true,
        children: boxes.map(([n, unit, caption]) =>
          cell(width, [
            para([run(n, { bold: true, size: fs(17) }), run(` ${unit}`)]),
            para([run(caption, { size: fs(10.5), color: DIM })]),
          ])
        ),
      }),
    ],
    { alignment: AlignmentType.LEFT }
  );
}

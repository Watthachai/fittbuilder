import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  Tab,
  TextRun,
  WidthType,
  type IBorderOptions,
  type IParagraphOptions,
  type ITableBordersOptions,
  type ParagraphChild,
} from "docx";
import { safeAccent, type QuoteBrand } from "@/lib/quote";

/**
 * The paper as a Word file: the parts the quotation and the proposal share.
 *
 * Case #27. The printed sheet (QuotationPrint / ProposalPrint) is still the
 * reference, and this rebuilds the same paper in WordprocessingML so it can be
 * opened and retyped in Word or Google Docs. It is rebuilt rather than
 * converted from the print HTML: Word ignores flex and grid, so a converted
 * letterhead comes out as a column of loose boxes. The letterhead becomes a
 * Word page header, Word's own way of repeating it on every page (the print
 * path does that with <thead>). Every block below it is a real table or
 * paragraph.
 *
 * Pure. Pictures arrive already fetched and cropped (lib/word-export.ts does
 * that in the browser), so the builders can be tested without a network.
 */

/** A picture ready to embed. `width`/`height` give the shape; the bytes may be scaled down. */
export interface WordImage {
  data: Uint8Array;
  type: "png" | "jpg";
  width: number;
  height: number;
}

/** The fetched pictures: the letterhead logo, and each screenshot keyed by its URL. */
export interface WordArt {
  logo: WordImage | null;
  shots: ReadonlyMap<string, WordImage>;
}

/**
 * Tahoma ships with both Windows and macOS and carries Thai, so the file looks
 * the same wherever it opens. It is set once, on the document defaults, so
 * whoever prefers another face changes it in one place (the Normal style).
 */
export const FONT = "Tahoma";

// The print sheet's palette (app/globals.css, .fitt-paper), as Word writes colours.
export const INK = "1F2937";
export const DIM = "6B7280";
export const RULE = "D1D5DB";
export const NOTE = "374151";
export const GREEN = "15803D";
export const HEAD_FILL = "F6F7F8";

/** CSS px on the print sheet → twips. */
export const px = (n: number): number => Math.round(n * 15);
/** Millimetres → twips. */
export const mm = (n: number): number => Math.round((n * 1440) / 25.4);
/** A CSS font size on the print sheet → Word's half-points (1px = 0.75pt). */
export const fs = (cssPx: number): number => Math.round(cssPx * 1.5);
/** A border width in CSS px → Word's eighths of a point. */
const bw = (cssPx: number): number => Math.round(cssPx * 6);

/** A4 with the print sheet's margins (14mm sides and top, 12mm bottom). */
const PAGE = { width: 11906, height: 16838, side: mm(14), top: mm(14), bottom: mm(12) };
/** The width everything in the body is laid out against. */
export const CONTENT = PAGE.width - 2 * PAGE.side;

/** The sender's brand colour, as Word writes it. */
export const accentOf = (brand: QuoteBrand): string => safeAccent(brand.accent).slice(1).toUpperCase();

export interface Tone {
  size?: number;
  bold?: boolean;
  color?: string;
  strike?: boolean;
}

/**
 * Face, size and colour go on every run, not only on the document defaults.
 * Word reads the defaults, but Apple's renderer (QuickLook, Mail, an iPhone
 * opening the attachment) ignores them and sets the whole paper in 12pt Times.
 */
const BASE = { font: FONT, size: fs(12.5), color: INK };

/**
 * A tab in the text becomes Word's tab element. A raw tab character inside
 * <w:t> is outside the schema, and renderers disagree about what to do with it.
 */
const withTabs = (text: string): (string | Tab)[] =>
  text.split("\t").flatMap((part, i) => [...(i > 0 ? [new Tab()] : []), ...(part ? [part] : [])]);

export const run = (text: string, tone: Tone = {}): TextRun =>
  new TextRun({ children: withTabs(text), ...BASE, ...tone });

/** What the person typed, with the line breaks they typed kept as line breaks. */
export function typed(text: string, tone: Tone = {}): TextRun[] {
  return text
    .split("\n")
    .map((line, i) => new TextRun({ children: withTabs(line), ...(i > 0 ? { break: 1 } : {}), ...BASE, ...tone }));
}

export const para = (children: ParagraphChild[], opts: Omit<IParagraphOptions, "children"> = {}): Paragraph =>
  new Paragraph({ children, ...opts });

/**
 * Vertical space of an exact height, the paper's margin between two blocks.
 * Also what closes a cell that ends in a table: Word needs a paragraph there,
 * and a full-height empty one would open a gap under the table, so it is
 * written as `gap(1)`.
 */
export const gap = (cssPx: number): Paragraph =>
  new Paragraph({ spacing: { before: 0, after: 0, line: Math.max(20, px(cssPx)), lineRule: LineRuleType.EXACT } });

export const border = (style: IBorderOptions["style"], cssPx: number, color: string): IBorderOptions => ({
  style,
  size: bw(cssPx),
  color,
});
const NONE: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
export const dashed = (cssPx: number, color: string) => border(BorderStyle.DASHED, cssPx, color);
export const solid = (cssPx: number, color: string) => border(BorderStyle.SINGLE, cssPx, color);
export const NO_BORDERS: ITableBordersOptions = {
  top: NONE,
  bottom: NONE,
  left: NONE,
  right: NONE,
  insideHorizontal: NONE,
  insideVertical: NONE,
};

/**
 * A table on a fixed grid. Widths are in twips and always given: Google Docs
 * and Pages lay a table out from its grid alone, so a grid left to "auto"
 * opens as squeezed columns everywhere except Word.
 */
export function grid(
  widths: number[],
  rows: TableRow[],
  opts: { borders?: ITableBordersOptions; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}
): Table {
  return new Table({
    rows,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: opts.borders ?? NO_BORDERS,
    alignment: opts.alignment,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
}

export function cell(
  width: number,
  children: (Paragraph | Table)[],
  opts: Omit<ConstructorParameters<typeof TableCell>[0], "children" | "width"> = {}
): TableCell {
  return new TableCell({ children, width: { size: width, type: WidthType.DXA }, ...opts });
}

/** A section title: bold, over a dashed rule in the brand colour. Kept with what follows it. */
export function heading(text: string, accent: string, size: number = fs(12.5)): Paragraph {
  return para([run(text, { bold: true, size })], {
    keepNext: true,
    spacing: { before: px(16), after: px(5) },
    border: { bottom: { ...dashed(1, accent), space: 2 } },
  });
}

/** Fit a picture inside a box without enlarging it, as `max-width`/`max-height` do on the paper. */
export function fitImage(img: WordImage, maxW: number, maxH: number): ImageRun {
  const scale = Math.min(1, maxW / img.width, maxH / img.height);
  return new ImageRun({
    type: img.type,
    data: img.data,
    transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) },
  });
}

/** A screenshot in its 4:3 frame (already cropped to it), with the paper's hairline border. */
export function framedShot(img: WordImage, widthPx: number, alt: string): ImageRun {
  return new ImageRun({
    type: img.type,
    data: img.data,
    transformation: { width: widthPx, height: Math.round((widthPx * 3) / 4) },
    altText: { name: alt, description: alt, title: alt },
    outline: { type: "solidFill", solidFillType: "rgb", value: RULE, width: 9525 },
  });
}

/** Who the paper is addressed to and who sends it: the same in both documents. */
export interface Letterhead {
  /** "ใบเสนอราคา" / "ข้อเสนอโครงการ". */
  title: string;
  /** The numbered lines under the title: [label, value]. */
  meta: [string, string][];
  customer: { attn: string; name: string; address: string; phone: string };
  presentedBy: string;
  brand: QuoteBrand;
  logo: WordImage | null;
}

/**
 * The page header: logo and title on top, the two parties under it. It repeats
 * on every page because a second page without it is an anonymous sheet of
 * numbers (see QuotationPrint).
 */
export function letterhead(h: Letterhead): Header {
  const left = Math.round(CONTENT * 0.45);
  const right = CONTENT - left;
  // The numbered lines are two right-aligned columns, as on the paper: a tab
  // stop for the labels and one at the edge for the values. Tab stops rather
  // than a table nested in the cell, which Apple's renderer collapses to the
  // width of its text.
  const metaTabs = [
    { type: TabStopType.RIGHT, position: right - px(130) },
    { type: TabStopType.RIGHT, position: right },
  ];
  const top = grid(
    [left, right],
    [
      new TableRow({
        children: [
          cell(left, [para(h.logo ? [fitImage(h.logo, 200, 84)] : [])]),
          cell(right, [
            para([run(h.title, { bold: true, size: fs(24) })], { alignment: AlignmentType.RIGHT }),
            ...h.meta.map(([label, value]) =>
              para([run("\t"), run(label, { bold: true }), run(`\t${value}`)], { tabStops: metaTabs })
            ),
          ]),
        ],
      }),
    ]
  );

  const to = Math.round(CONTENT * 0.62);
  const label = px(62);
  const recipient = grid(
    [label, to - label],
    (
      [
        ["เรียน :", h.customer.attn, false],
        ["ชื่อ :", h.customer.name, true],
        ["ที่อยู่ :", h.customer.address, false],
        ["โทร. :", h.customer.phone, false],
      ] as const
    ).map(
      ([l, value, strong]) =>
        new TableRow({
          children: [
            cell(label, [para([run(l, { bold: true })], { alignment: AlignmentType.RIGHT, indent: { right: px(12) } })]),
            // A blank field prints as a dash: a missing address should look unfilled, not unasked.
            cell(to - label, [para(typed(value || "—", { bold: strong }))]),
          ],
        })
    )
  );

  const toRight = { alignment: AlignmentType.RIGHT } as const;
  const dim = (size: number): Tone => ({ size, color: DIM });
  const from: Paragraph[] = [];
  if (h.brand.name) from.push(para([run(h.brand.name, { bold: true, size: fs(14) })], toRight));
  if (h.brand.address) from.push(para(typed(h.brand.address, dim(fs(11))), toRight));
  if (h.brand.taxId) from.push(para([run(`เลขประจำตัวผู้เสียภาษี : ${h.brand.taxId}`, dim(fs(11)))], toRight));
  if (h.presentedBy || h.brand.contact) {
    from.push(para([run("นำเสนอโดย", { bold: true })], { ...toRight, spacing: { before: px(8) } }));
    if (h.presentedBy) from.push(para([run(h.presentedBy, dim(fs(11.5)))], toRight));
    if (h.brand.contact) from.push(para(typed(h.brand.contact, dim(fs(11))), toRight));
  }

  const parties = grid(
    [to, CONTENT - to],
    [new TableRow({ children: [cell(to, [recipient, gap(1)]), cell(CONTENT - to, from.length ? from : [para([])])] })]
  );

  return new Header({ children: [top, gap(10), parties, gap(1)] });
}

/** The two signature lines at the foot of the document. */
export function signatures(left: [string, string], right: [string, string]): Table {
  const gap = px(44);
  const half = Math.round((CONTENT - gap) / 2);
  const side = ([label, date]: [string, string]) =>
    cell(half, [
      para([], { spacing: { before: px(40) }, border: { bottom: { ...border(BorderStyle.DOTTED, 1, INK), space: 1 } } }),
      para([run(label, { color: DIM })], { alignment: AlignmentType.CENTER, spacing: { before: px(5) } }),
      para([run(date, { color: DIM, size: fs(10.5) })], { alignment: AlignmentType.CENTER }),
    ]);
  return grid(
    [half, gap, half],
    [new TableRow({ cantSplit: true, children: [side(left), cell(gap, [para([])]), side(right)] })]
  );
}

/** Numbering for the documents' lists: clauses are referred to by number, exclusions are bullets. */
export const LIST = { numbered: "numbered", bullets: "bullets" } as const;

/** One A4 section with the letterhead on every page, in the shared face and size. */
export function wordDocument(opts: { title: string; creator: string; header: Header; body: (Paragraph | Table)[] }): Document {
  const indent = { left: px(20), hanging: px(20) };
  return new Document({
    title: opts.title,
    creator: opts.creator || opts.title,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: fs(12.5), color: INK },
          paragraph: { spacing: { before: 0, after: 0, line: 264 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: LIST.numbered,
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent } } }],
        },
        {
          reference: LIST.bullets,
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent } } }],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: {
              top: PAGE.top,
              bottom: PAGE.bottom,
              left: PAGE.side,
              right: PAGE.side,
              // The header starts where the paper's padding does; Word pushes the
              // body down below however tall the letterhead turns out to be.
              header: PAGE.top,
              footer: PAGE.bottom,
            },
          },
        },
        headers: { default: opts.header },
        children: opts.body,
      },
    ],
  });
}

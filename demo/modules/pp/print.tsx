import type { ReactNode } from "react";
import { TODAY, material } from "../mm/data";
import {
  COMPANY, CONFIRMATIONS, ORDERS, baht, costOf, product, progressOf, scrapOf, workCenter,
} from "./data";
import type { GoodsMovement, ProductionOrder, PurchaseProposal } from "./data";
import { Paper, money } from "../kit";

/**
 * The factory's paper: the job ticket that travels with the work, the slip the
 * storeroom signs before anything leaves the shelf, the proposal purchasing
 * receives, and the report the plant manager initials at month end. None of
 * them carry prices and VAT the way an invoice does, so each lays itself out
 * inside Paper and prints the same way.
 */

function DocHead({ title, number, date, sub }: { title: string; number: string; date: string; sub?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
      <div className="min-w-0">
        <p className="text-[16px] font-bold text-slate-900">{COMPANY.name}</p>
        <p className="mt-1 max-w-sm leading-relaxed text-slate-600">{COMPANY.address}</p>
        <p className="text-slate-600">เลขประจำตัวผู้เสียภาษี {COMPANY.taxId} · โทร {COMPANY.phone}</p>
      </div>
      <div className="text-right">
        <p className="text-[18px] font-bold text-slate-900">{title}</p>
        {sub && <p className="mt-0.5 text-[11.5px] text-slate-500">{sub}</p>}
        <dl className="mt-2 grid grid-cols-[auto_auto] justify-end gap-x-3 gap-y-0.5">
          <dt className="text-slate-500">เลขที่</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{number}</dd>
          <dt className="text-slate-500">วันที่</dt>
          <dd className="tabular-nums">{date}</dd>
        </dl>
      </div>
    </div>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-slate-300 p-3 sm:grid-cols-3">
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[11px] text-slate-500">{k}</dt>
          <dd className="truncate font-medium text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const TH_CELL = "border border-slate-300 px-2 py-1.5 font-medium";
const TD_CELL = "border border-slate-300 px-2 py-1.5";

function Grid({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <table className="mt-4 w-full border-collapse">
      <thead>
        <tr className="bg-slate-100 text-[11.5px] text-slate-600">
          {head.map((h, i) => (
            <th key={h + i} className={TH_CELL + (right.includes(i) ? " text-right" : " text-left")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className={TD_CELL + (right.includes(j) ? " text-right tabular-nums" : "")}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Signatures({ names }: { names: string[] }) {
  return (
    <div className="mt-12 grid gap-8" style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
      {names.map((s) => (
        <div key={s} className="text-center">
          <div className="mx-auto h-10 w-36 border-b border-dotted border-slate-500" />
          <p className="mt-1.5 text-slate-600">{s}</p>
          <p className="text-[11px] text-slate-400">วันที่ ____/____/______</p>
        </div>
      ))}
    </div>
  );
}

const Heading = ({ children }: { children: ReactNode }) => (
  <p className="mt-5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{children}</p>
);

/** ใบสั่งผลิต / ใบงาน — เดินไปกับงาน ช่างกรอกของดี ของเสีย และลงชื่อทีละขั้นตอน */
export function OrderTicket({ order: o }: { order: ProductionOrder }) {
  const p = product(o.product);
  return (
    <Paper>
      <DocHead title="ใบสั่งผลิต / ใบงาน" number={o.no} date={TODAY} sub={`สถานะ: ${o.status}`} />
      <Facts
        rows={[
          ["สินค้า", `${p.code} · ${p.name}`],
          ["จำนวนสั่งผลิต", `${o.qty.toLocaleString("th-TH")} ${p.unit}`],
          ["กำหนดเริ่ม – ส่ง", `${o.start} → ${o.due}`],
          ["ปล่อยงานเมื่อ", o.releasedOn ?? "ยังไม่ปล่อยงาน"],
          ["ผลิตได้แล้ว", `${o.done} ${p.unit} · เสีย ${scrapOf(o)}`],
          ["อ้างอิงแผน", o.source ?? "—"],
        ]}
      />

      <Heading>วัสดุที่ต้องเบิก</Heading>
      <Grid
        head={["ลำดับ", "รหัส", "รายการ", "ที่เก็บ", "ต่อหน่วย", "ต้องใช้", "เบิกแล้ว", "หน่วย"]}
        right={[4, 5, 6]}
        rows={o.components.map((c, i) => {
          const m = material(c.material);
          return [i + 1, c.material, m.name, m.bin, c.per + (c.scrap ? ` (+${c.scrap}%)` : ""), c.qty, c.issued, m.unit];
        })}
      />

      <Heading>ขั้นตอนการผลิต</Heading>
      <Grid
        head={["ขั้นตอน", "ศูนย์งาน", "งาน", "ชม./หน่วย", "ชม.ตามแผน", "ของดี", "ของเสีย", "ผู้ปฏิบัติงาน"]}
        right={[3, 4, 5, 6]}
        rows={o.operations.map((r) => {
          const done = progressOf(o, r.op);
          return [
            r.op, workCenter(r.wc).name, r.text, r.hrs, (r.hrs * o.qty).toFixed(1),
            done.yield || "", done.scrap || "", "",
          ];
        })}
      />

      <Signatures names={["ผู้วางแผนการผลิต", "หัวหน้าสายการผลิต", "ผู้ตรวจสอบคุณภาพ"]} />
    </Paper>
  );
}

/**
 * ใบเบิกวัสดุหรือใบรับสินค้าเข้าคลัง จากเอกสารที่บันทึกแล้ว
 * ถ้ายังไม่มีเอกสาร พิมพ์เป็นใบจ่ายวัสดุตามที่ใบสั่งผลิตยังค้างเบิก ให้คลังหยิบของ
 */
export function MovementSlip({ order: o, movement }: { order: ProductionOrder; movement?: GoodsMovement }) {
  const receipt = movement?.kind === "รับเข้าคลัง";
  const lines = movement
    ? movement.lines
    : o.components.filter((c) => c.qty > c.issued).map((c) => ({ material: c.material, qty: c.qty - c.issued }));
  return (
    <Paper>
      <DocHead
        title={receipt ? "ใบรับสินค้าสำเร็จรูปเข้าคลัง" : movement ? "ใบเบิกวัสดุ" : "ใบจ่ายวัสดุตามใบสั่งผลิต"}
        number={movement?.no ?? "ร่าง — ยังไม่บันทึกเบิก"}
        date={movement?.date ?? TODAY}
      />
      <Facts
        rows={[
          ["อ้างอิงใบสั่งผลิต", o.no],
          ["สินค้าที่ผลิต", product(o.product).name],
          [receipt ? "รับเข้าจาก" : "เบิกเข้า", receipt ? "สายการผลิต" : "สายการผลิต · ศูนย์งานตามใบงาน"],
        ]}
      />
      <Grid
        head={["ลำดับ", "รหัส", "รายการ", "ที่เก็บ", "จำนวน", "หน่วย"]}
        right={[4]}
        rows={lines.map((l, i) => {
          const m = material(l.material);
          return [i + 1, l.material, m.name, m.bin, l.qty.toLocaleString("th-TH"), m.unit];
        })}
      />
      {lines.length === 0 && <p className="mt-3 text-center text-slate-500">ไม่มีวัสดุค้างเบิกในใบสั่งผลิตนี้</p>}
      <Signatures names={receipt ? ["ผู้ส่งมอบ (ฝ่ายผลิต)", "ผู้รับของ (คลังสินค้า)"] : ["ผู้เบิก", "ผู้จ่ายของ (คลังวัสดุ)", "ผู้อนุมัติ"]} />
    </Paper>
  );
}

/** ข้อเสนอซื้อจาก MRP — ฝ่ายวางแผนส่งให้ฝ่ายจัดซื้อพิจารณาเปิดใบขอซื้อ */
export function ProposalSheet({ proposals }: { proposals: PurchaseProposal[] }) {
  const total = proposals.reduce((n, p) => n + p.qty * material(p.material).price, 0);
  return (
    <Paper>
      <DocHead
        title="ใบเสนอซื้อจากการวางแผนวัสดุ"
        number={proposals[0]?.run ?? "—"}
        date={TODAY}
        sub="ส่งฝ่ายจัดซื้อพิจารณาเปิดใบขอซื้อ"
      />
      <Grid
        head={["ลำดับ", "เลขที่", "รหัส", "รายการ", "จำนวน", "หน่วย", "ต้องการภายใน", "ราคาประมาณ", "เป็นเงิน"]}
        right={[4, 7, 8]}
        rows={proposals.map((p, i) => {
          const m = material(p.material);
          return [i + 1, p.no, p.material, m.name, p.qty.toLocaleString("th-TH"), m.unit, p.needBy, money(m.price), money(p.qty * m.price)];
        })}
      />
      <div className="mt-2 flex justify-end">
        <p className="rounded-md bg-slate-100 px-3 py-1.5 font-semibold text-slate-900">รวมมูลค่าประมาณ {money(total)} บาท</p>
      </div>
      <p className="mt-3 leading-relaxed text-slate-600">
        ราคาประมาณจากราคาต่อหน่วยในแฟ้มวัสดุ ยังไม่รวมภาษีมูลค่าเพิ่ม จำนวนคำนวณจากสูตรการผลิตหักสต็อกและของที่สั่งซื้อไว้แล้ว
      </p>
      <Signatures names={["ผู้วางแผนการผลิต", "ผู้จัดการฝ่ายผลิต", "ฝ่ายจัดซื้อรับเรื่อง"]} />
    </Paper>
  );
}

/** รายงานผลการผลิตทุกใบ — ของดี ของเสีย ต้นทุนจริงเทียบมาตรฐาน */
export function ProductionReportSheet() {
  const rows = ORDERS.filter((o) => o.status !== "ยกเลิก");
  const totals = rows.reduce(
    (n, o) => {
      const c = costOf(o);
      return { actual: n.actual + c.actual, standard: n.standard + c.standard };
    },
    { actual: 0, standard: 0 }
  );
  const hours = CONFIRMATIONS.reduce((n, c) => n + c.hrs, 0);
  return (
    <Paper>
      <DocHead title="รายงานผลการผลิต" number={"RPT-PP-" + TODAY.replaceAll("-", "")} date={TODAY} sub="ทุกใบสั่งผลิตที่ยังไม่ยกเลิก" />
      <Grid
        head={["เลขที่", "สินค้า", "สั่ง", "ของดี", "ของเสีย", "รับเข้า", "ต้นทุนจริง", "มาตรฐาน", "ผลต่าง", "สถานะ"]}
        right={[2, 3, 4, 5, 6, 7, 8]}
        rows={rows.map((o) => {
          const c = costOf(o);
          return [o.no, product(o.product).name, o.qty, o.done, scrapOf(o), o.received, baht(c.actual), baht(c.standard), baht(c.variance), o.status];
        })}
      />
      <dl className="mt-3 ml-auto grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1">
        <dt className="text-slate-600">ชั่วโมงทำงานที่ยืนยัน</dt>
        <dd className="text-right tabular-nums">{hours.toFixed(1)} ชม.</dd>
        <dt className="text-slate-600">ต้นทุนจริงรวม</dt>
        <dd className="text-right tabular-nums">{baht(totals.actual)}</dd>
        <dt className="text-slate-600">ต้นทุนมาตรฐานของที่รับเข้า</dt>
        <dd className="text-right tabular-nums">{baht(totals.standard)}</dd>
        <dt className="border-t border-slate-800 pt-1 font-bold text-slate-900">ผลต่างรวม</dt>
        <dd className="border-t border-slate-800 pt-1 text-right font-bold tabular-nums text-slate-900">
          {baht(totals.actual - totals.standard)}
        </dd>
      </dl>
      <p className="mt-3 leading-relaxed text-slate-600">
        ผลต่าง = ต้นทุนจริง − ต้นทุนมาตรฐานของจำนวนที่รับเข้าคลัง ใบที่ยังไม่ปิดงานคือต้นทุนงานระหว่างทำ ยังไม่ใช่ผลต่างสุดท้าย
      </p>
      <Signatures names={["ผู้จัดทำ", "ผู้จัดการโรงงาน"]} />
    </Paper>
  );
}

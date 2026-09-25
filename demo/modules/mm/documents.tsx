import type { ReactNode } from "react";
import { COMPANY, approver, material, outstandingQty, purchaseOrder, requisitionValue, vendor } from "./data";
import type { GoodsReceipt, PurchaseOrder, Requisition, StockMove } from "./data";
import { DocumentSheet, Paper } from "../kit";

/**
 * The purchasing documents as they are printed and signed.
 *
 * The purchase order and the requisition carry prices, so they are the kit's
 * DocumentSheet. A goods receipt or a stores issue slip has no price on it — the
 * storeman counts, the receiver signs — so it is its own layout on Paper, built
 * from the pieces below, which the warehouse module prints its sheets with too.
 */

/** "2026-09-22" → "22/09/2569", the way a Thai document writes a date. */
export const thaiDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
};

/** The letterhead and the document's name, the same on every sheet the company prints. */
export function PaperHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
      <div className="min-w-0">
        <p className="text-[16px] font-bold text-slate-900">{COMPANY.name}</p>
        <p className="mt-1 max-w-sm leading-relaxed text-slate-600">{COMPANY.address}</p>
        <p className="text-slate-600">เลขประจำตัวผู้เสียภาษี {COMPANY.taxId}</p>
        <p className="text-slate-600">โทร {COMPANY.phone}</p>
      </div>
      <div className="text-right">
        <p className="text-[18px] font-bold text-slate-900">{title}</p>
        {sub && <p className="mt-0.5 text-[11.5px] text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

/** Label and value pairs in a ruled box — the "เลขที่ / วันที่ / อ้างอิง" block. */
export function PaperFacts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid min-w-52 grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1 rounded-md border border-slate-300 p-3">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right font-medium tabular-nums text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The other side of the document — the vendor, the department, the warehouse. */
export function PaperParty({ label, name, lines = [] }: { label: string; name: string; lines?: string[] }) {
  return (
    <div className="rounded-md border border-slate-300 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900">{name}</p>
      {lines.map((l) => (
        <p key={l} className="leading-relaxed text-slate-600">{l}</p>
      ))}
    </div>
  );
}

export type PaperColumn = { header: string; align?: "right" | "center" };

/** A ruled table. Blank cells are left for the pen — a count, a tick, a signature. */
export function PaperTable({ columns, rows }: { columns: PaperColumn[]; rows: ReactNode[][] }) {
  const align = (a?: "right" | "center") => (a === "right" ? " text-right" : a === "center" ? " text-center" : " text-left");
  return (
    <table className="mt-4 w-full border-collapse">
      <thead>
        <tr className="bg-slate-100 text-[11.5px] text-slate-600">
          {columns.map((c) => (
            <th key={c.header} className={"border border-slate-300 px-2 py-1.5 font-medium" + align(c.align)}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} className={"h-8 border border-slate-300 px-2 py-1.5 tabular-nums" + align(columns[j].align)}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PaperSignatures({ roles }: { roles: string[] }) {
  return (
    <div className="mt-12 grid gap-8" style={{ gridTemplateColumns: `repeat(${roles.length}, minmax(0, 1fr))` }}>
      {roles.map((s) => (
        <div key={s} className="text-center">
          <div className="mx-auto h-10 w-40 border-b border-dotted border-slate-500" />
          <p className="mt-1.5 text-slate-600">{s}</p>
          <p className="text-[11px] text-slate-400">วันที่ ____/____/______</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ documents */

export function PoDocument({ po }: { po: PurchaseOrder }) {
  const v = vendor(po.vendor);
  return (
    <DocumentSheet
      title="ใบสั่งซื้อ"
      number={po.no}
      date={thaiDate(po.date)}
      company={COMPANY}
      party={{ label: "ผู้ขาย", name: v.name, address: v.address, taxId: v.taxId }}
      lines={po.lines.map((l) => ({ name: `${l.material} ${material(l.material).name}`, qty: l.qty, unit: material(l.material).unit, price: l.price }))}
      notes={
        <>
          <p>กำหนดส่งของ {thaiDate(po.deliverBy)} · เงื่อนไขชำระ {v.terms}</p>
          <p>ผู้ติดต่อ {v.contact} โทร {v.phone}{po.pr ? ` · อ้างอิงใบขอซื้อ ${po.pr}` : ""}</p>
          {po.note && <p>หมายเหตุ {po.note}</p>}
          {po.approvedBy && <p>อนุมัติโดย {po.approvedBy} ({approver(po.approvedBy).role})</p>}
        </>
      }
      signatures={["ผู้สั่งซื้อ", "ผู้มีอำนาจลงนาม", "ผู้ขายรับทราบ"]}
    />
  );
}

export function PrDocument({ pr }: { pr: Requisition }) {
  return (
    <DocumentSheet
      title="ใบขอซื้อ"
      number={pr.no}
      date={thaiDate(pr.date)}
      company={COMPANY}
      party={{ label: "หน่วยงานที่ขอซื้อ", name: pr.requester, address: `ต้องการใช้ภายใน ${thaiDate(pr.needBy)}` }}
      lines={pr.lines.map((l) => ({ name: `${l.material} ${material(l.material).name}`, qty: l.qty, unit: material(l.material).unit, price: l.price }))}
      notes={
        <>
          <p>ราคาเป็นราคาประมาณจากราคาที่ผู้ขายเคยเสนอ ใช้กำหนดผู้มีอำนาจอนุมัติ (มูลค่าก่อนภาษี {requisitionValue(pr).toLocaleString("th-TH")} บาท)</p>
          {pr.note && <p>หมายเหตุ {pr.note}</p>}
          {pr.approvedBy && <p>อนุมัติโดย {pr.approvedBy} ({approver(pr.approvedBy).role})</p>}
        </>
      }
      signatures={["ผู้ขอซื้อ", "หัวหน้าหน่วยงาน", "ผู้อนุมัติ"]}
    />
  );
}

export function GrDocument({ gr }: { gr: GoodsReceipt }) {
  const po = purchaseOrder(gr.po);
  const v = vendor(po.vendor);
  return (
    <Paper>
      <PaperHead title="ใบรับสินค้า" sub="ต้นฉบับ · สำหรับฝ่ายบัญชี" />
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <PaperParty label="ผู้ขาย" name={v.name} lines={[v.address, `เลขประจำตัวผู้เสียภาษี ${v.taxId}`]} />
        <PaperFacts
          rows={[
            ["เลขที่", gr.no],
            ["วันที่รับ", thaiDate(gr.date)],
            ["อ้างอิงใบสั่งซื้อ", po.no],
            ["ใบส่งของผู้ขาย", gr.deliveryNote ?? "—"],
          ]}
        />
      </div>
      <PaperTable
        columns={[
          { header: "ลำดับ", align: "center" },
          { header: "รหัส" },
          { header: "รายการ" },
          { header: "สั่งซื้อ", align: "right" },
          { header: "รับครั้งนี้", align: "right" },
          { header: "ค้างรับ", align: "right" },
          { header: "หน่วย" },
          { header: "ช่องเก็บ" },
        ]}
        rows={gr.lines.map((l, i) => {
          const m = material(l.material);
          const ordered = po.lines.find((x) => x.material === l.material)?.qty ?? 0;
          return [i + 1, l.material, m.name, ordered.toLocaleString("th-TH"), l.qty.toLocaleString("th-TH"), outstandingQty(po, l.material).toLocaleString("th-TH"), m.unit, m.bin];
        })}
      />
      <p className="mt-3 leading-relaxed text-slate-600">
        ตรวจรับตามจำนวนข้างต้นในสภาพเรียบร้อย ของที่ค้างรับผู้ขายต้องส่งตามใบสั่งซื้อเดิม
        {gr.receivedBy ? ` · ผู้ตรวจรับ ${gr.receivedBy}` : ""}
      </p>
      <PaperSignatures roles={["ผู้ส่งของ", "ผู้ตรวจรับ", "เจ้าหน้าที่คลัง"]} />
    </Paper>
  );
}

/** ใบเบิกวัสดุ for an issue, ใบปรับปรุงสต็อก for scrap and adjustments. */
export function MoveSlip({ move }: { move: StockMove }) {
  const m = material(move.material);
  const issue = move.kind === "เบิกใช้";
  return (
    <Paper>
      <PaperHead title={issue ? "ใบเบิกวัสดุ" : "ใบปรับปรุงสต็อก"} sub={move.kind} />
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <PaperParty
          label={issue ? "หน่วยงานที่เบิก" : "สาเหตุ"}
          name={issue ? (move.department ?? "—") : (move.kind ?? "ปรับยอด")}
          lines={[move.reason]}
        />
        <PaperFacts rows={[["เลขที่", move.doc ?? "—"], ["วันที่", thaiDate(move.date)]]} />
      </div>
      <PaperTable
        columns={[
          { header: "ลำดับ", align: "center" },
          { header: "รหัส" },
          { header: "รายการ" },
          { header: "จำนวน", align: "right" },
          { header: "หน่วย" },
          { header: "ช่องเก็บ" },
        ]}
        rows={[[1, m.code, m.name, Math.abs(move.qty).toLocaleString("th-TH"), m.unit, m.bin]]}
      />
      <PaperSignatures roles={issue ? ["ผู้เบิก", "ผู้อนุมัติ", "ผู้จ่ายของ"] : ["ผู้บันทึก", "ผู้ตรวจสอบ", "ผู้อนุมัติ"]} />
    </Paper>
  );
}

import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { vendor } from "../mm/data";
import {
  AGING_BUCKETS, COMPANY, PAYMENTS, TODAY, account, accumulated, activeDisposal, assetRegister,
  assetStatus, balanceSheet, bookValue, bucketOf, depreciatedThrough, entryByNo, entryTotal, isVoided,
  monthlyDepreciation, payable, profitAndLoss, receivable, receivables, salesReceipts, statusOf, thaiDate, whtForm, whtType,
} from "./data";
import type { JournalBook, StatementPeriod } from "./data";
import { Button } from "../ui";
import { Paper, bahtText, money, printDocument } from "../kit";

/**
 * The paper this module prints: vouchers, the receipt, the withholding-tax
 * certificate, the reminder, the registers. None of them is a priced sales
 * document, so each lays itself out inside Paper rather than DocumentSheet.
 */

/** The print button above a sheet. printDocument() prints the sheet and nothing around it. */
export function PrintFrame({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="primary" icon={<Printer size={15} />} onClick={printDocument}>
          พิมพ์
        </Button>
      </div>
      {children}
    </div>
  );
}

function Letterhead({ title, english, right }: { title: string; english: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
      <div className="min-w-0">
        <p className="text-[16px] font-bold text-slate-900">{COMPANY.name}</p>
        <p className="mt-1 max-w-sm leading-relaxed text-slate-600">{COMPANY.address}</p>
        <p className="text-slate-600">
          เลขประจำตัวผู้เสียภาษี {COMPANY.taxId} · {COMPANY.branch}
        </p>
        <p className="text-slate-600">โทร {COMPANY.phone}</p>
      </div>
      <div className="text-right">
        <p className="text-[18px] font-bold text-slate-900">{title}</p>
        <p className="mt-0.5 text-[11.5px] uppercase tracking-wide text-slate-500">{english}</p>
        {right}
      </div>
    </div>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid min-w-52 grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1 rounded-md border border-slate-300 p-3">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right tabular-nums text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Party({ label, name, lines }: { label: string; name: string; lines: string[] }) {
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

function Signatures({ roles }: { roles: string[] }) {
  return (
    <div className="mt-12 grid gap-6" style={{ gridTemplateColumns: `repeat(${roles.length}, minmax(0, 1fr))` }}>
      {roles.map((s) => (
        <div key={s} className="text-center">
          <div className="mx-auto h-10 w-32 border-b border-dotted border-slate-500" />
          <p className="mt-1.5 text-slate-600">{s}</p>
          <p className="text-[11px] text-slate-400">วันที่ ____/____/______</p>
        </div>
      ))}
    </div>
  );
}

/** A stamp across the top of a sheet that is not an ordinary live document. */
function Stamp({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-md border-2 border-rose-500 px-3 py-1.5 text-center font-semibold text-rose-600">{children}</p>
  );
}

const TD = "border border-slate-300 px-2 py-1.5";
const TH = TD + " bg-slate-100 text-[11.5px] font-medium text-slate-600";

/* ---------------------------------------------------------------- voucher */

const BOOK_TITLE: Record<JournalBook, [string, string]> = {
  ทั่วไป: ["ใบสำคัญทั่วไป", "Journal Voucher"],
  ขาย: ["ใบสำคัญบันทึกขาย", "Sales Journal Voucher"],
  ซื้อ: ["ใบสำคัญบันทึกซื้อ", "Purchase Journal Voucher"],
  รับเงิน: ["ใบสำคัญรับ", "Receipt Voucher"],
  จ่ายเงิน: ["ใบสำคัญจ่าย", "Payment Voucher"],
};

/** Any entry in the journal as the voucher that gets filed and signed. */
export function VoucherPaper({ no }: { no: string }) {
  const e = entryByNo(no);
  const [title, english] = BOOK_TITLE[e.book ?? "ทั่วไป"];
  const status = statusOf(e);
  const debit = e.lines.filter((l) => l.amount > 0).reduce((n, l) => n + l.amount, 0);
  const credit = -e.lines.filter((l) => l.amount < 0).reduce((n, l) => n + l.amount, 0);
  return (
    <Paper>
      <Letterhead title={title} english={english} />
      {status === "ร่าง" && <Stamp>ร่าง — ยังไม่ผ่านรายการ ไม่มีผลในบัญชี</Stamp>}
      {status === "กลับรายการแล้ว" && <Stamp>กลับรายการแล้วด้วยใบสำคัญ {e.reversedBy}</Stamp>}

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="rounded-md border border-slate-300 p-3">
          <p className="text-[11px] text-slate-500">คำอธิบายรายการ</p>
          <p className="font-medium text-slate-900">{e.memo}</p>
          {e.ref && <p className="mt-1 text-slate-600">เอกสารอ้างอิง {e.ref}</p>}
        </div>
        <Facts rows={[["เลขที่", <b key="n">{e.no}</b>], ["วันที่", thaiDate(e.date)], ["สมุดรายวัน", e.book ?? "ทั่วไป"]]} />
      </div>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr>
            <th className={TH + " text-left"}>รหัสบัญชี</th>
            <th className={TH + " text-left"}>ชื่อบัญชี</th>
            <th className={TH + " text-left"}>คำอธิบาย</th>
            <th className={TH + " text-right"}>เดบิต</th>
            <th className={TH + " text-right"}>เครดิต</th>
          </tr>
        </thead>
        <tbody>
          {e.lines.map((l, i) => (
            <tr key={i}>
              <td className={TD + " tabular-nums"}>{l.account}</td>
              <td className={TD}>{account(l.account).name}</td>
              <td className={TD + " text-slate-600"}>{l.note ?? ""}</td>
              <td className={TD + " text-right tabular-nums"}>{l.amount > 0 ? money(l.amount) : ""}</td>
              <td className={TD + " text-right tabular-nums"}>{l.amount < 0 ? money(-l.amount) : ""}</td>
            </tr>
          ))}
          <tr className="font-bold text-slate-900">
            <td className={TD + " text-right"} colSpan={3}>รวม</td>
            <td className={TD + " text-right tabular-nums"}>{money(debit)}</td>
            <td className={TD + " text-right tabular-nums"}>{money(credit)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 font-medium text-slate-800">({bahtText(entryTotal(e))})</p>

      <Signatures roles={["ผู้จัดทำ", "ผู้ตรวจสอบ", "ผู้อนุมัติ"]} />
    </Paper>
  );
}

/* ------------------------------------------------------- payment voucher */

export function PaymentVoucherPaper({ no }: { no: string }) {
  const p = PAYMENTS.find((x) => x.no === no);
  if (!p) throw new Error(`ไม่พบใบสำคัญจ่าย ${no}`);
  const doc = payable(p.invoice);
  const v = vendor(p.vendor);
  return (
    <Paper>
      <Letterhead title="ใบสำคัญจ่าย" english="Payment Voucher" />
      {isVoided(p.no) && <Stamp>ยกเลิกแล้ว — กลับรายการด้วย {entryByNo(p.no).reversedBy}</Stamp>}
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <Party label="จ่ายให้" name={v.name} lines={[`เลขประจำตัวผู้เสียภาษี ${v.taxId}`, `ผู้ติดต่อ ${v.contact}`]} />
        <Facts
          rows={[
            ["เลขที่", <b key="n">{p.no}</b>],
            ["วันที่", thaiDate(p.date)],
            ["วิธีชำระ", p.method],
            ...(p.bankRef ? ([["อ้างอิง", p.bankRef]] as [string, ReactNode][]) : []),
          ]}
        />
      </div>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr>
            <th className={TH + " text-left"}>รายการ</th>
            <th className={TH + " text-right"}>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={TD}>
              ชำระหนี้ตามใบแจ้งหนี้ {doc.no} ลงวันที่ {thaiDate(doc.date)}
              <span className="block text-[11.5px] text-slate-500">
                {doc.description} · ยอดตามใบ {money(doc.amount)}
              </span>
            </td>
            <td className={TD + " text-right tabular-nums"}>{money(p.settle)}</td>
          </tr>
          {p.wht > 0 && (
            <tr>
              <td className={TD}>
                หัก ภาษีเงินได้ ณ ที่จ่าย {p.whtRate * 100}% ({whtType(p.whtRate).income}) จากฐาน {money(p.whtBase)}
              </td>
              <td className={TD + " text-right tabular-nums"}>({money(p.wht)})</td>
            </tr>
          )}
          <tr className="font-bold text-slate-900">
            <td className={TD + " text-right"}>ยอดจ่ายสุทธิ</td>
            <td className={TD + " text-right tabular-nums"}>{money(p.net)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 font-medium text-slate-800">({bahtText(p.net)})</p>

      <p className="mt-4 text-[11.5px] font-medium text-slate-500">บันทึกบัญชี</p>
      <table className="mt-1 w-full border-collapse text-[11.5px]">
        <tbody>
          {entryByNo(p.no).lines.map((l, i) => (
            <tr key={i}>
              <td className={TD + " w-20 tabular-nums"}>{l.account}</td>
              <td className={TD}>{account(l.account).name}</td>
              <td className={TD + " w-32 text-right tabular-nums"}>{l.amount > 0 ? "Dr " + money(l.amount) : ""}</td>
              <td className={TD + " w-32 text-right tabular-nums"}>{l.amount < 0 ? "Cr " + money(-l.amount) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Signatures roles={["ผู้จัดทำ", "ผู้ตรวจสอบ", "ผู้อนุมัติ", "ผู้รับเงิน"]} />
    </Paper>
  );
}

/* ---------------------------------------------- withholding certificate */

function Box({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="grid size-3.5 place-items-center border border-slate-600 text-[10px] leading-none">{on ? "✓" : ""}</span>
      {children}
    </span>
  );
}

/** หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ — the copy the supplier files with their return. */
export function WhtCertificatePaper({ no }: { no: string }) {
  const p = PAYMENTS.find((x) => x.no === no);
  if (!p) throw new Error(`ไม่พบใบสำคัญจ่าย ${no}`);
  const v = vendor(p.vendor);
  const form = whtForm(v.taxId);
  return (
    <Paper>
      <div className="border-b-2 border-slate-800 pb-3 text-center">
        <p className="text-[17px] font-bold text-slate-900">หนังสือรับรองการหักภาษี ณ ที่จ่าย</p>
        <p className="text-slate-600">ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</p>
        <p className="mt-1 text-[11.5px] text-slate-500">เล่มที่ 1 · เลขที่ {p.no}</p>
      </div>
      {isVoided(p.no) && <Stamp>ยกเลิกแล้ว — ใบสำคัญจ่ายถูกกลับรายการ</Stamp>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Party label="ผู้มีหน้าที่หักภาษี ณ ที่จ่าย" name={COMPANY.name} lines={[COMPANY.address, `เลขประจำตัวผู้เสียภาษี ${COMPANY.taxId}`]} />
        <Party label="ผู้ถูกหักภาษี ณ ที่จ่าย" name={v.name} lines={[`เลขประจำตัวผู้เสียภาษี ${v.taxId}`]} />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-md border border-slate-300 p-3">
        <span className="text-slate-500">ลำดับที่ในแบบ</span>
        <Box on={false}>ภ.ง.ด.1ก</Box>
        <Box on={form === "ภ.ง.ด.3"}>ภ.ง.ด.3</Box>
        <Box on={form === "ภ.ง.ด.53"}>ภ.ง.ด.53</Box>
      </div>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr>
            <th className={TH + " text-left"}>ประเภทเงินได้พึงประเมินที่จ่าย</th>
            <th className={TH}>วัน เดือน ปีภาษี ที่จ่าย</th>
            <th className={TH + " text-right"}>จำนวนเงินที่จ่าย</th>
            <th className={TH + " text-right"}>ภาษีที่หักและนำส่งไว้</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={TD}>
              5. การจ่ายเงินได้ที่ต้องหักภาษี ณ ที่จ่าย ตามคำสั่งกรมสรรพากรที่ออกตามมาตรา 3 เตรส
              <span className="block text-slate-600">— {whtType(p.whtRate).income} (อัตราร้อยละ {p.whtRate * 100})</span>
            </td>
            <td className={TD + " text-center tabular-nums"}>{thaiDate(p.date)}</td>
            <td className={TD + " text-right tabular-nums"}>{money(p.whtBase)}</td>
            <td className={TD + " text-right tabular-nums"}>{money(p.wht)}</td>
          </tr>
          <tr className="font-bold text-slate-900">
            <td className={TD + " text-right"} colSpan={2}>รวมเงินที่จ่ายและภาษีที่หักนำส่ง</td>
            <td className={TD + " text-right tabular-nums"}>{money(p.whtBase)}</td>
            <td className={TD + " text-right tabular-nums"}>{money(p.wht)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-slate-800">
        รวมเงินภาษีที่หักนำส่ง (ตัวอักษร) <b>{bahtText(p.wht)}</b>
      </p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-md border border-slate-300 p-3">
        <span className="text-slate-500">ผู้จ่ายเงิน</span>
        <Box on>หัก ณ ที่จ่าย</Box>
        <Box on={false}>ออกให้ตลอดไป</Box>
        <Box on={false}>ออกให้ครั้งเดียว</Box>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-[1fr_auto]">
        <p className="leading-relaxed text-slate-600">
          ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ
        </p>
        <div className="text-center">
          <div className="mx-auto h-10 w-44 border-b border-dotted border-slate-500" />
          <p className="mt-1.5 text-slate-600">ลงชื่อผู้จ่ายเงิน</p>
          <p className="text-[11px] text-slate-400">{thaiDate(p.date)} · ประทับตรานิติบุคคล (ถ้ามี)</p>
        </div>
      </div>
    </Paper>
  );
}

/* ----------------------------------------------------------------- receipt */

export function ReceiptPaper({ no }: { no: string }) {
  const r = salesReceipts().find((x) => x.no === no);
  if (!r) throw new Error(`ไม่พบใบเสร็จ ${no}`);
  const doc = receivable(r.invoice);
  const settled = r.amount + r.wht;
  return (
    <Paper>
      <Letterhead title="ใบเสร็จรับเงิน" english="Receipt" right={<p className="mt-0.5 text-[11.5px] text-slate-500">ต้นฉบับ</p>} />
      {r.voided && <Stamp>ยกเลิกแล้ว — {r.reason}</Stamp>}
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <Party label="ได้รับเงินจาก" name={doc.customerName} lines={[doc.address, `เลขประจำตัวผู้เสียภาษี ${doc.taxId}`]} />
        <Facts rows={[["เลขที่", <b key="n">{r.no}</b>], ["วันที่", thaiDate(r.date)], ["วิธีชำระ", r.method]]} />
      </div>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr>
            <th className={TH + " text-left"}>เลขที่เอกสาร</th>
            <th className={TH}>วันที่</th>
            <th className={TH + " text-right"}>ยอดตามใบกำกับ</th>
            <th className={TH + " text-right"}>หักลดหนี้</th>
            <th className={TH + " text-right"}>ชำระครั้งนี้</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={TD}>
              ใบกำกับภาษี/ใบแจ้งหนี้ {r.invoice}
              <span className="block text-[11.5px] text-slate-500">อ้างอิงใบสั่งขาย {doc.so}</span>
            </td>
            <td className={TD + " text-center tabular-nums"}>{thaiDate(doc.date)}</td>
            <td className={TD + " text-right tabular-nums"}>{money(doc.amount)}</td>
            <td className={TD + " text-right tabular-nums"}>{doc.credited ? money(doc.credited) : "—"}</td>
            <td className={TD + " text-right tabular-nums"}>{money(settled)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="rounded-md bg-slate-100 px-3 py-2 font-medium text-slate-800">({bahtText(settled)})</p>
          <p className="mt-2 leading-relaxed text-slate-600">
            ชำระโดย{r.method}{r.ref ? ` · ${r.ref}` : ""}
            {r.method === "เช็ค" && " — ใบเสร็จนี้สมบูรณ์เมื่อเช็คเรียกเก็บเงินได้แล้ว"}
          </p>
        </div>
        <dl className="grid min-w-60 grid-cols-[1fr_auto] gap-x-6 gap-y-1">
          <dt className="text-slate-600">รับชำระหนี้</dt>
          <dd className="text-right tabular-nums">{money(settled)}</dd>
          {r.wht > 0 && (
            <>
              <dt className="text-slate-600">หัก ภาษีถูกหัก ณ ที่จ่าย</dt>
              <dd className="text-right tabular-nums">({money(r.wht)})</dd>
            </>
          )}
          <dt className="border-t border-slate-800 pt-1 font-bold text-slate-900">รับเงินสุทธิ</dt>
          <dd className="border-t border-slate-800 pt-1 text-right font-bold tabular-nums text-slate-900">{money(r.amount)}</dd>
        </dl>
      </div>

      <Signatures roles={["ผู้รับเงิน", "ผู้มีอำนาจลงนาม"]} />
    </Paper>
  );
}

/* ------------------------------------------------- statement of account */

/** ใบแจ้งยอดค้างชำระ — the polite reminder with every open document on it. */
export function StatementOfAccountPaper({ customer }: { customer: string }) {
  const rows = receivables().filter((r) => r.customer === customer);
  const first = rows[0];
  const total = rows.reduce((n, r) => n + r.open, 0);
  const byBucket = AGING_BUCKETS.map((b) => ({
    label: b.label,
    sum: rows.filter((r) => bucketOf(r.overdueDays).label === b.label).reduce((n, r) => n + r.open, 0),
  }));
  return (
    <Paper>
      <Letterhead title="ใบแจ้งยอดค้างชำระ" english="Statement of Account" />
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <Party
          label="เรียน"
          name={first?.customerName ?? customer}
          lines={first ? [first.address, `เลขประจำตัวผู้เสียภาษี ${first.taxId}`, `เงื่อนไขชำระ ${first.terms}`] : []}
        />
        <Facts rows={[["ณ วันที่", thaiDate(TODAY)], ["จำนวนเอกสาร", `${rows.length} ใบ`]]} />
      </div>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr>
            <th className={TH + " text-left"}>เลขที่เอกสาร</th>
            <th className={TH}>วันที่</th>
            <th className={TH}>ครบกำหนด</th>
            <th className={TH + " text-right"}>เกินกำหนด</th>
            <th className={TH + " text-right"}>ยอดตามเอกสาร</th>
            <th className={TH + " text-right"}>ลดหนี้/ชำระแล้ว</th>
            <th className={TH + " text-right"}>คงค้าง</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.invoice}>
              <td className={TD}>{r.invoice}</td>
              <td className={TD + " text-center tabular-nums"}>{thaiDate(r.date)}</td>
              <td className={TD + " text-center tabular-nums"}>{thaiDate(r.due)}</td>
              <td className={TD + " text-right tabular-nums"}>{r.overdueDays > 0 ? `${r.overdueDays} วัน` : "—"}</td>
              <td className={TD + " text-right tabular-nums"}>{money(r.amount)}</td>
              <td className={TD + " text-right tabular-nums"}>{r.credited + r.received ? money(r.credited + r.received) : "—"}</td>
              <td className={TD + " text-right tabular-nums"}>{money(r.open)}</td>
            </tr>
          ))}
          <tr className="font-bold text-slate-900">
            <td className={TD + " text-right"} colSpan={6}>ยอดค้างชำระทั้งสิ้น</td>
            <td className={TD + " text-right tabular-nums"}>{money(total)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 font-medium text-slate-800">({bahtText(total)})</p>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11.5px]">
        {byBucket.map((b) => (
          <div key={b.label} className="rounded-md border border-slate-300 p-2">
            <p className="text-slate-500">{b.label}</p>
            <p className="font-semibold tabular-nums text-slate-900">{money(b.sum)}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 leading-relaxed text-slate-700">
        บริษัทฯ ขอแจ้งยอดค้างชำระตามรายการข้างต้น และใคร่ขอความกรุณาชำระยอดที่ถึงกำหนดแล้วโดยโอนเข้า{COMPANY.bank}
        หากท่านชำระแล้ว โปรดแจ้งหลักฐานการโอนกลับมาเพื่อออกใบเสร็จรับเงิน ขอบพระคุณที่ใช้บริการ
      </p>
      <Signatures roles={["ฝ่ายบัญชีลูกหนี้", "ผู้มีอำนาจลงนาม"]} />
    </Paper>
  );
}

/* ----------------------------------------------------------- asset register */

export function AssetRegisterPaper() {
  const list = assetRegister();
  const through = depreciatedThrough();
  const live = list.filter((a) => !activeDisposal(a));
  return (
    <Paper>
      <Letterhead title="ทะเบียนทรัพย์สินและค่าเสื่อมราคา" english="Fixed Asset Register" />
      <p className="mt-3 text-slate-600">ค่าเสื่อมราคาวิธีเส้นตรง คิดถึงวันที่ {thaiDate(through)}</p>
      <table className="mt-3 w-full border-collapse text-[11.5px]">
        <thead>
          <tr>
            <th className={TH + " text-left"}>รหัส</th>
            <th className={TH + " text-left"}>รายการ</th>
            <th className={TH}>วันที่ได้มา</th>
            <th className={TH + " text-right"}>ราคาทุน</th>
            <th className={TH + " text-right"}>อายุ (ปี)</th>
            <th className={TH + " text-right"}>ค่าเสื่อม/เดือน</th>
            <th className={TH + " text-right"}>ค่าเสื่อมสะสม</th>
            <th className={TH + " text-right"}>มูลค่าคงเหลือ</th>
            <th className={TH}>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.code}>
              <td className={TD}>{a.code}</td>
              <td className={TD}>{a.name}</td>
              <td className={TD + " text-center tabular-nums"}>{thaiDate(a.acquired)}</td>
              <td className={TD + " text-right tabular-nums"}>{money(a.cost)}</td>
              <td className={TD + " text-right tabular-nums"}>{a.lifeYears}</td>
              <td className={TD + " text-right tabular-nums"}>{money(monthlyDepreciation(a))}</td>
              <td className={TD + " text-right tabular-nums"}>{money(accumulated(a))}</td>
              <td className={TD + " text-right tabular-nums"}>{activeDisposal(a) ? "—" : money(bookValue(a))}</td>
              <td className={TD + " text-center"}>{assetStatus(a)}</td>
            </tr>
          ))}
          <tr className="font-bold text-slate-900">
            <td className={TD + " text-right"} colSpan={3}>รวมสินทรัพย์ที่ยังใช้งาน</td>
            <td className={TD + " text-right tabular-nums"}>{money(live.reduce((n, a) => n + a.cost, 0))}</td>
            <td className={TD} colSpan={2} />
            <td className={TD + " text-right tabular-nums"}>{money(live.reduce((n, a) => n + accumulated(a), 0))}</td>
            <td className={TD + " text-right tabular-nums"}>{money(live.reduce((n, a) => n + bookValue(a), 0))}</td>
            <td className={TD} />
          </tr>
        </tbody>
      </table>
      <Signatures roles={["ผู้จัดทำ", "ผู้ตรวจสอบ"]} />
    </Paper>
  );
}

/* --------------------------------------------------------------- statements */

export function StatementsPaper({ period }: { period: StatementPeriod }) {
  const pl = profitAndLoss(period.from ? { from: period.from, to: period.to } : undefined);
  const bs = balanceSheet(period.to);
  const line = (label: string, v: number, strong?: boolean) => (
    <tr className={strong ? "font-bold text-slate-900" : ""}>
      <td className={TD}>{label}</td>
      <td className={TD + " w-40 text-right tabular-nums"}>{v < 0 ? `(${money(-v)})` : money(v)}</td>
    </tr>
  );
  return (
    <Paper>
      <Letterhead title="งบการเงิน" english="Financial Statements" />
      <p className="mt-3 font-semibold text-slate-900">งบกำไรขาดทุน · {period.label}</p>
      <table className="mt-2 w-full border-collapse">
        <tbody>
          {pl.revenues.filter((a) => a.balance !== 0).map((a) => line(a.name, -a.balance))}
          {line("รวมรายได้", pl.revenue, true)}
          {pl.expenses.filter((a) => a.balance !== 0).map((a) => line(a.name, a.balance))}
          {line("รวมค่าใช้จ่าย", pl.expenseTotal, true)}
          {line(pl.profit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ", pl.profit, true)}
        </tbody>
      </table>

      <p className="mt-6 font-semibold text-slate-900">
        งบแสดงฐานะการเงิน · {period.to ? `ณ วันที่ ${thaiDate(period.to)}` : "ณ วันที่ปัจจุบัน"}
      </p>
      <table className="mt-2 w-full border-collapse">
        <tbody>
          {bs.assets.filter((a) => a.balance !== 0).map((a) => line(a.name, a.balance))}
          {line("รวมสินทรัพย์", bs.assetTotal, true)}
          {bs.liabilities.filter((a) => a.balance !== 0).map((a) => line(a.name, -a.balance))}
          {line("รวมหนี้สิน", bs.liabilityTotal, true)}
          {bs.equity.filter((a) => a.balance !== 0).map((a) => line(a.name, -a.balance))}
          {line(bs.profit >= 0 ? "กำไรสะสมปีปัจจุบัน" : "ขาดทุนสะสมปีปัจจุบัน", bs.profit)}
          {line("รวมหนี้สินและส่วนของเจ้าของ", bs.liabilityTotal + bs.equityTotal + bs.profit, true)}
        </tbody>
      </table>
      <p className="mt-3 text-slate-600">
        {bs.balances ? "สินทรัพย์เท่ากับหนี้สินบวกส่วนของเจ้าของ งบลงตัว" : "งบไม่ลงตัว โปรดตรวจสอบรายการในสมุดรายวัน"}
      </p>
      <Signatures roles={["ผู้จัดทำ", "กรรมการผู้มีอำนาจ"]} />
    </Paper>
  );
}

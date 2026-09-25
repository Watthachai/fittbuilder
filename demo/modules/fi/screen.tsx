import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, Ban, Banknote, BookOpen, Building, CalendarClock, CircleCheck, CircleX, Coins, FileDown,
  FilePen, FileText, HandCoins, Landmark, Layers, Pencil, Plus, Printer, Receipt as ReceiptIcon, RotateCcw, Scale,
  Search as SearchIcon, Send, Sigma, Tags, Trash2, TrendingDown, TrendingUp, TriangleAlert, Users, Wallet,
} from "lucide-react";
import {
  ACCOUNTS, ACCOUNT_TYPES, AGING_BUCKETS, DEPRECIATION_RUNS, JOURNAL_BOOKS, PAYMENTS, PERIOD,
  account, accountLedger, accumulated, activeDisposal, agingByParty, asset, assetRegister, assetStatus, balanceOf,
  balanceSheet, baht, bookValue, bucketOf, canChangeDepreciation, depreciatedThrough, depreciationPreview,
  entryByNo, entryDifference, entryTotal, isBalanced, isVoided, ledger, monthlyDepreciation, monthsHeld,
  nextDepreciationPeriod, payables, postJournal, profitAndLoss, receivables, reversalBlocker, salesReceipts, satang,
  statementPeriods, statusOf, thaiMonth, trialBalance,
} from "./data";
import type { EntryStatus, JournalEntry, StatementPeriod } from "./data";
import { vendor } from "../mm/data";
import { readyToInvoice } from "../sd/data";
import {
  AccountForm, AssetForm, CancelReceiptDialog, DeleteDraftDialog, DepreciationForm, DisposeDialog, JournalForm, PaymentForm,
  ReceiptForm, ReverseDialog, ServiceBillForm,
} from "./forms";
import {
  AssetRegisterPaper, PaymentVoucherPaper, PrintFrame, ReceiptPaper, StatementOfAccountPaper, StatementsPaper,
  VoucherPaper, WhtCertificatePaper,
} from "./papers";
import {
  Avatar, Badge, Bar, Button, Card, Chip, Donut, Dot, IconRow, Note, PageHead, Progress, Reveal, Search,
  Segmented, Select, StatStrip, Tabs, Tag, swatchFor,
} from "../ui";
import type { Tone } from "../ui";
import { DataTable, FormModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";

const TABS = ["ผังบัญชีและสมุดรายวัน", "เจ้าหนี้การค้า", "ลูกหนี้การค้า", "สินทรัพย์ถาวร", "งบการเงิน"];

const typeSwatch = (t: string) => swatchFor(t, ACCOUNT_TYPES);

const LEDGER_TABS = ["ผังบัญชี", "สมุดรายวัน"];
const LEDGER_ICONS: Record<string, ReactNode> = {
  ผังบัญชี: <Layers size={13} />,
  สมุดรายวัน: <BookOpen size={13} />,
};

const STATEMENT_TABS = ["งบกำไรขาดทุน", "งบแสดงฐานะการเงิน"];
const STATEMENT_ICONS: Record<string, ReactNode> = {
  งบกำไรขาดทุน: <TrendingUp size={13} />,
  งบแสดงฐานะการเงิน: <Scale size={13} />,
};

const ENTRY_TONE: Record<EntryStatus, Tone> = {
  ร่าง: "warn",
  ผ่านรายการแล้ว: "ok",
  กลับรายการแล้ว: "idle",
  รายการกลับ: "info",
};

type TrialRow = ReturnType<typeof trialBalance>[number];

/** A small action inside a table row — the row's own verb, not a page button. */
function RowAction({ icon, children, onClick, tone = "accent" }: { icon: ReactNode; children: ReactNode; onClick: () => void; tone?: "accent" | "danger" }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={
        "inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1 text-[12px] transition " +
        (tone === "danger"
          ? "border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
          : "border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300 dark:hover:text-violet-300")
      }
    >
      {icon}
      {children}
    </button>
  );
}

const THEAD = "bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400";

/* --------------------------------------------------------------- dialogs */

type PrintDoc =
  | { kind: "voucher"; no: string }
  | { kind: "payment"; no: string }
  | { kind: "wht"; no: string }
  | { kind: "receipt"; no: string }
  | { kind: "statement"; customer: string }
  | { kind: "register" }
  | { kind: "statements"; period: StatementPeriod };

type Dialog =
  | { kind: "entry"; no: string }
  | { kind: "account"; code: string }
  | { kind: "asset"; code: string }
  | { kind: "journal"; no?: string }
  | { kind: "accountForm"; code?: string }
  | { kind: "bill" }
  | { kind: "pay"; invoice: string }
  | { kind: "receive"; invoice: string }
  | { kind: "assetForm"; code?: string }
  | { kind: "depreciate" }
  | { kind: "print"; doc: PrintDoc };

type Confirm =
  | { kind: "reverse"; no: string }
  | { kind: "deleteDraft"; no: string }
  | { kind: "dispose"; code: string }
  | { kind: "cancelReceipt"; invoice: string };

const PRINT_TITLE: Record<PrintDoc["kind"], string> = {
  voucher: "พิมพ์ใบสำคัญ",
  payment: "พิมพ์ใบสำคัญจ่าย",
  wht: "หนังสือรับรองการหักภาษี ณ ที่จ่าย",
  receipt: "ใบเสร็จรับเงิน",
  statement: "ใบแจ้งยอดค้างชำระ",
  register: "ทะเบียนทรัพย์สินและค่าเสื่อมราคา",
  statements: "พิมพ์งบการเงิน",
};

/** What a screen needs to open any of the module's dialogs. */
type Open = {
  dialog: (d: Dialog) => void;
  confirm: (c: Confirm) => void;
  print: (doc: PrintDoc) => void;
};

/* ----------------------------------------------------------------- screen */

export default function FiScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [type, setType] = useState("ทุกประเภท");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const open: Open = { dialog: setDialog, confirm: setConfirm, print: (doc) => setDialog({ kind: "print", doc }) };
  const close = () => setDialog(null);

  const entries = ledger();
  const tb = trialBalance();
  const bs = balanceSheet();
  const pl = profitAndLoss();
  const ap = payables();
  const ar = receivables();
  const unbalanced = entries.filter((e) => !isBalanced(e));
  const drafts = entries.filter((e) => statusOf(e) === "ร่าง");

  const d = dialog;
  const printing = d?.kind === "print" ? d.doc : null;

  const panels = (
    <>
      <FormModal
        open={d?.kind === "entry"}
        title="รายการในสมุดรายวัน"
        subtitle={d?.kind === "entry" ? `${d.no} · ${entryByNo(d.no).date}` : undefined}
        onClose={close}
        size="lg"
      >
        {d?.kind === "entry" && <EntryRecord no={d.no} open={open} />}
      </FormModal>

      <FormModal
        open={d?.kind === "account"}
        title="บัญชีแยกประเภท"
        subtitle={d?.kind === "account" ? `${d.code} · ${account(d.code).name}` : undefined}
        onClose={close}
        size="lg"
      >
        {d?.kind === "account" && <AccountRecord code={d.code} open={open} />}
      </FormModal>

      <FormModal
        open={d?.kind === "asset"}
        title="สินทรัพย์ถาวร"
        subtitle={d?.kind === "asset" ? `${d.code} · ${asset(d.code).name}` : undefined}
        onClose={close}
        size="sm"
      >
        {d?.kind === "asset" && <AssetRecord code={d.code} open={open} />}
      </FormModal>

      <FormModal
        open={d?.kind === "journal"}
        title={d?.kind === "journal" && d.no ? `แก้ไขร่างใบสำคัญ ${d.no}` : "บันทึกใบสำคัญทั่วไป"}
        subtitle="ใส่บัญชีด้านเดบิตและเครดิต ผ่านรายการได้เมื่อยอดสองด้านเท่ากัน"
        onClose={close}
        size="lg"
      >
        {d?.kind === "journal" && (
          <JournalForm
            draft={d.no ? entryByNo(d.no) : undefined}
            onCancel={close}
            onDone={(e) => setDialog({ kind: "entry", no: e.no })}
          />
        )}
      </FormModal>

      <FormModal
        open={d?.kind === "accountForm"}
        title={d?.kind === "accountForm" && d.code ? `แก้ไขบัญชี ${d.code}` : "เพิ่มบัญชีในผังบัญชี"}
        subtitle="รหัสสี่หลัก เลขตัวแรกบอกหมวดบัญชี"
        onClose={close}
        size="sm"
      >
        {d?.kind === "accountForm" && (
          <AccountForm
            editing={d.code ? account(d.code) : undefined}
            onCancel={close}
            onDone={(a) => setDialog({ kind: "account", code: a.code })}
          />
        )}
      </FormModal>

      <FormModal open={d?.kind === "bill"} title="ตั้งหนี้ค่าบริการ" subtitle="ใบแจ้งหนี้ค่าบริการหรือค่าใช้จ่ายที่ไม่ได้ผ่านใบสั่งซื้อ" onClose={close}>
        {d?.kind === "bill" && <ServiceBillForm onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal
        open={d?.kind === "pay"}
        title="จ่ายชำระหนี้"
        subtitle={d?.kind === "pay" ? `ใบแจ้งหนี้ ${d.invoice}` : undefined}
        onClose={close}
      >
        {d?.kind === "pay" && (
          <PaymentForm invoice={d.invoice} onCancel={close} onDone={(p) => open.print({ kind: "payment", no: p.no })} />
        )}
      </FormModal>

      <FormModal
        open={d?.kind === "receive"}
        title="รับชำระหนี้"
        subtitle={d?.kind === "receive" ? `ใบกำกับ ${d.invoice}` : undefined}
        onClose={close}
      >
        {d?.kind === "receive" && (
          <ReceiptForm invoice={d.invoice} onCancel={close} onDone={(no) => open.print({ kind: "receipt", no })} />
        )}
      </FormModal>

      <FormModal
        open={d?.kind === "assetForm"}
        title={d?.kind === "assetForm" && d.code ? `แก้ไขข้อมูลสินทรัพย์ ${d.code}` : "ลงทะเบียนสินทรัพย์"}
        subtitle="ค่าเสื่อมราคาวิธีเส้นตรง รายเดือน"
        onClose={close}
      >
        {d?.kind === "assetForm" && (
          <AssetForm
            editing={d.code ? asset(d.code) : undefined}
            onCancel={close}
            onDone={(a) => setDialog({ kind: "asset", code: a.code })}
          />
        )}
      </FormModal>

      <FormModal
        open={d?.kind === "depreciate"}
        title="บันทึกค่าเสื่อมราคาประจำงวด"
        subtitle={`งวด ${thaiMonth(nextDepreciationPeriod())} · ต่อจากงวดที่ตัดไว้ถึง ${depreciatedThrough()}`}
        onClose={close}
      >
        {d?.kind === "depreciate" && <DepreciationForm onCancel={close} onDone={close} />}
      </FormModal>

      <FormModal open={printing !== null} title={printing ? PRINT_TITLE[printing.kind] : ""} onClose={close} size="lg">
        {printing && <PrintFrame>{paperFor(printing)}</PrintFrame>}
      </FormModal>

      <ReverseDialog
        key={confirm?.kind === "reverse" ? "rv-" + confirm.no : "rv"}
        no={confirm?.kind === "reverse" ? confirm.no : null}
        onCancel={() => setConfirm(null)}
        onDone={() => setConfirm(null)}
      />
      <DeleteDraftDialog
        no={confirm?.kind === "deleteDraft" ? confirm.no : null}
        onCancel={() => setConfirm(null)}
        onDone={() => {
          setConfirm(null);
          close();
        }}
      />
      <CancelReceiptDialog
        key={confirm?.kind === "cancelReceipt" ? "cr-" + confirm.invoice : "cr"}
        invoice={confirm?.kind === "cancelReceipt" ? confirm.invoice : null}
        onCancel={() => setConfirm(null)}
        onDone={() => setConfirm(null)}
      />
      <DisposeDialog
        key={confirm?.kind === "dispose" ? "dp-" + confirm.code : "dp"}
        code={confirm?.kind === "dispose" ? confirm.code : null}
        onCancel={() => setConfirm(null)}
        onDone={() => setConfirm(null)}
      />
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview
          pl={pl}
          bs={bs}
          ap={ap}
          ar={ar}
          entries={entries}
          unbalanced={unbalanced}
          drafts={drafts}
          onOpenSection={onOpenSection}
          open={open}
        />
        {panels}
      </>
    );
  }

  const firstPayment = PAYMENTS.find((p) => p.wht > 0) ?? PAYMENTS[0];
  const reversible = [...entries].reverse().find((e) => reversalBlocker(e.no) === null) ?? entries[0];
  const receiptsNow = salesReceipts();
  const liveReceipt = receiptsNow.find((r) => !r.voided);
  const toReceive = ar.find((r) => !r.paid && r.open > 0);
  const firstAsset = assetRegister().find((a) => !activeDisposal(a)) ?? assetRegister()[0];

  return (
    <div>
      <PageHead
        title="บัญชีการเงิน"
        meta={`${tab} · ${PERIOD.label} · ${entries.length} รายการในสมุดรายวัน · ${ACCOUNTS.length} บัญชี`}
        right={<Badge tone={bs.balances ? "ok" : "bad"} dot>{bs.balances ? "งบดุลลงตัว" : "งบดุลไม่ลงตัว"}</Badge>}
      />

      {tab === "ผังบัญชีและสมุดรายวัน" && (
        <Ledger tb={tb} entries={entries} q={q} setQ={setQ} type={type} setType={setType} open={open} />
      )}
      {tab === "เจ้าหนี้การค้า" && <Payables rows={ap} open={open} />}
      {tab === "ลูกหนี้การค้า" && <Receivables rows={ar} open={open} />}
      {tab === "สินทรัพย์ถาวร" && <Assets open={open} />}
      {tab === "งบการเงิน" && <Statements open={open} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="บัญชีการเงิน" />
        <button data-fitt-screen="รายการในสมุดรายวัน" data-fitt-modal onClick={() => setDialog({ kind: "entry", no: entries[0].no })} />
        <button data-fitt-screen="บัญชีแยกประเภท" data-fitt-modal onClick={() => setDialog({ kind: "account", code: tb[0].code })} />
        <button data-fitt-screen="สินทรัพย์ถาวร" data-fitt-modal onClick={() => setDialog({ kind: "asset", code: firstAsset.code })} />
        <button data-fitt-screen="บันทึกใบสำคัญทั่วไป" data-fitt-modal onClick={() => setDialog({ kind: "journal" })} />
        <button data-fitt-screen="แก้ไขร่างใบสำคัญ" data-fitt-modal onClick={() => setDialog({ kind: "journal", no: drafts[0]?.no })} />
        <button data-fitt-screen="ลบร่างใบสำคัญ" data-fitt-modal onClick={() => drafts[0] && setConfirm({ kind: "deleteDraft", no: drafts[0].no })} />
        <button data-fitt-screen="กลับรายการใบสำคัญ" data-fitt-modal onClick={() => setConfirm({ kind: "reverse", no: reversible.no })} />
        <button data-fitt-screen="พิมพ์ใบสำคัญ" data-fitt-modal onClick={() => open.print({ kind: "voucher", no: entries[0].no })} />
        <button data-fitt-screen="เพิ่มบัญชีในผังบัญชี" data-fitt-modal onClick={() => setDialog({ kind: "accountForm" })} />
        <button data-fitt-screen="แก้ไขบัญชี" data-fitt-modal onClick={() => setDialog({ kind: "accountForm", code: tb[0].code })} />
        <button data-fitt-screen="ตั้งหนี้ค่าบริการ" data-fitt-modal onClick={() => setDialog({ kind: "bill" })} />
        <button data-fitt-screen="จ่ายชำระหนี้" data-fitt-modal onClick={() => ap.find((p) => !p.blocked) && setDialog({ kind: "pay", invoice: ap.find((p) => !p.blocked)!.no })} />
        <button data-fitt-screen="พิมพ์ใบสำคัญจ่าย" data-fitt-modal onClick={() => open.print({ kind: "payment", no: PAYMENTS[0].no })} />
        <button data-fitt-screen="หนังสือรับรองการหักภาษี ณ ที่จ่าย" data-fitt-modal onClick={() => open.print({ kind: "wht", no: firstPayment.no })} />
        <button data-fitt-screen="รับชำระหนี้" data-fitt-modal onClick={() => toReceive && setDialog({ kind: "receive", invoice: toReceive.invoice })} />
        <button data-fitt-screen="ใบเสร็จรับเงิน" data-fitt-modal onClick={() => receiptsNow[0] && open.print({ kind: "receipt", no: receiptsNow[0].no })} />
        <button data-fitt-screen="ยกเลิกใบเสร็จรับเงิน" data-fitt-modal onClick={() => liveReceipt && setConfirm({ kind: "cancelReceipt", invoice: liveReceipt.invoice })} />
        <button data-fitt-screen="ใบแจ้งยอดค้างชำระ" data-fitt-modal onClick={() => ar[0] && open.print({ kind: "statement", customer: ar[0].customer })} />
        <button data-fitt-screen="ลงทะเบียนสินทรัพย์" data-fitt-modal onClick={() => setDialog({ kind: "assetForm" })} />
        <button data-fitt-screen="แก้ไขข้อมูลสินทรัพย์" data-fitt-modal onClick={() => setDialog({ kind: "assetForm", code: firstAsset.code })} />
        <button data-fitt-screen="บันทึกค่าเสื่อมราคาประจำงวด" data-fitt-modal onClick={() => setDialog({ kind: "depreciate" })} />
        <button data-fitt-screen="จำหน่ายสินทรัพย์" data-fitt-modal onClick={() => setConfirm({ kind: "dispose", code: firstAsset.code })} />
        <button data-fitt-screen="พิมพ์ทะเบียนทรัพย์สิน" data-fitt-modal onClick={() => open.print({ kind: "register" })} />
        <button data-fitt-screen="พิมพ์งบการเงิน" data-fitt-modal onClick={() => open.print({ kind: "statements", period: statementPeriods()[0] })} />
      </div>
    </div>
  );
}

function paperFor(doc: PrintDoc) {
  if (doc.kind === "voucher") return <VoucherPaper no={doc.no} />;
  if (doc.kind === "payment") return <PaymentVoucherPaper no={doc.no} />;
  if (doc.kind === "wht") return <WhtCertificatePaper no={doc.no} />;
  if (doc.kind === "receipt") return <ReceiptPaper no={doc.no} />;
  if (doc.kind === "statement") return <StatementOfAccountPaper customer={doc.customer} />;
  if (doc.kind === "register") return <AssetRegisterPaper />;
  return <StatementsPaper period={doc.period} />;
}

/* ------------------------------------------------------------- overview */

function Overview({
  pl,
  bs,
  ap,
  ar,
  entries,
  unbalanced,
  drafts,
  onOpenSection,
  open,
}: {
  pl: ReturnType<typeof profitAndLoss>;
  bs: ReturnType<typeof balanceSheet>;
  ap: ReturnType<typeof payables>;
  ar: ReturnType<typeof receivables>;
  entries: JournalEntry[];
  unbalanced: JournalEntry[];
  drafts: JournalEntry[];
  onOpenSection?: (index: number) => void;
  open: Open;
}) {
  const overdueAp = ap.filter((x) => x.overdueDays > 0);
  const overdueAr = ar.filter((x) => x.overdueDays > 0);
  const unbilled = readyToInvoice();

  const expenseSegments = pl.expenses
    .filter((a) => a.balance > 0)
    .map((a) => ({ label: a.name, value: a.balance, swatch: swatchFor(a.code) }));

  const recent = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const seeAll = (index: number) =>
    onOpenSection ? (
      <button
        onClick={() => onOpenSection(index)}
        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300"
      >
        ดูทั้งหมด <ArrowRight size={12} />
      </button>
    ) : undefined;

  return (
    <div>
      <PageHead
        title="ภาพรวมบัญชีการเงิน"
        meta={`${PERIOD.label} · ${PERIOD.from} ถึง ${PERIOD.to}`}
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<FilePen size={15} />} onClick={() => open.dialog({ kind: "journal" })}>
              บันทึกใบสำคัญ
            </Button>
            {onOpenSection && (
              <Button variant="primary" icon={<Sigma size={15} />} onClick={() => onOpenSection(4)}>
                เปิดงบการเงิน
              </Button>
            )}
          </div>
        }
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><TrendingUp size={15} className="text-slate-400" />ผลประกอบการงวดนี้</span>}
            action={seeAll(4)}
          >
            <div className="p-4">
              <p className={"text-[32px] font-semibold leading-none tabular-nums " + (pl.profit >= 0 ? "text-slate-900 dark:text-slate-50" : "text-rose-600 dark:text-rose-400")}>
                {baht(pl.profit)}
              </p>
              <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                {pl.profit >= 0 ? "กำไร" : "ขาดทุน"}สุทธิ · รายได้ {baht(pl.revenue)} ค่าใช้จ่าย {baht(pl.expenseTotal)}
              </p>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[12.5px] text-slate-600 dark:text-slate-300">รายได้</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={100} tone="ok" width="w-full" />
                  </span>
                  <span className="w-32 shrink-0 text-right text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">{baht(pl.revenue)}</span>
                </div>
                {pl.expenses
                  .filter((a) => a.balance > 0)
                  .map((a) => (
                    <div key={a.code} className="flex items-center gap-3">
                      <span className="flex w-28 shrink-0 items-center gap-1.5 truncate text-[12.5px] text-slate-600 dark:text-slate-300">
                        <Dot className={swatchFor(a.code).dot} />
                        {a.name.length > 12 ? a.name.slice(0, 12) + "…" : a.name}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Bar pct={pl.revenue ? (a.balance / pl.revenue) * 100 : 0} tone="bad" width="w-full" />
                      </span>
                      <span className="w-32 shrink-0 text-right text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">
                        {baht(a.balance)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><TriangleAlert size={15} className="text-slate-400" />ต้องจัดการ</span>}
            action={seeAll(1)}
          >
            <div className="space-y-2.5 p-4">
              {[
                { icon: <ReceiptIcon size={15} />, label: "เจ้าหนี้เลยกำหนดชำระ", value: overdueAp.length, unit: "ใบ", tone: "bad" as const, to: 1 },
                { icon: <Users size={15} />, label: "ลูกหนี้เลยกำหนดชำระ", value: overdueAr.length, unit: "ใบ", tone: "bad" as const, to: 2 },
                { icon: <FileText size={15} />, label: "ส่งของแล้วยังไม่ออกใบกำกับ", value: unbilled.length, unit: "ใบ", tone: "warn" as const, to: 2 },
                { icon: <FilePen size={15} />, label: "ใบสำคัญที่ยังเป็นร่าง", value: drafts.length, unit: "ใบ", tone: "warn" as const, to: 0 },
                { icon: <Scale size={15} />, label: "สมุดรายวันที่ไม่ลงตัว", value: unbalanced.length, unit: "รายการ", tone: "bad" as const, to: 0 },
              ].map((r) => (
                <button
                  key={r.label}
                  onClick={() => onOpenSection?.(r.to)}
                  className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-left transition hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                >
                  <span className="text-slate-400">{r.icon}</span>
                  <span className="min-w-0 flex-1 text-[12.5px] text-slate-700 dark:text-slate-200">{r.label}</span>
                  <Badge tone={r.value > 0 ? r.tone : "ok"}>
                    {r.value} {r.unit}
                  </Badge>
                </button>
              ))}
              <Note tone={bs.balances ? "ok" : "bad"}>
                {bs.balances
                  ? "งบดุลลงตัว สินทรัพย์เท่ากับหนี้สินบวกส่วนของเจ้าของบวกกำไรงวดนี้"
                  : "งบดุลไม่ลงตัว ควรตรวจรายการในสมุดรายวันที่เดบิตไม่เท่าเครดิต"}
              </Note>
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-3">
          <Card title={<span className="flex items-center gap-2"><Coins size={15} className="text-slate-400" />โครงสร้างค่าใช้จ่าย</span>} action={seeAll(4)}>
            <div className="p-4">
              <Donut
                segments={expenseSegments}
                size={128}
                format={(n) => baht(n)}
                center={
                  <span>
                    <span className="block text-[18px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {pl.revenue ? Math.round((pl.expenseTotal / pl.revenue) * 100) : 0}%
                    </span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">ของรายได้</span>
                  </span>
                }
              />
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><ReceiptIcon size={15} className="text-slate-400" />เจ้าหนี้แยกตามอายุหนี้</span>}
            action={seeAll(1)}
          >
            <Aging rows={ap.map((x) => ({ amount: x.open, overdueDays: x.overdueDays }))} tone="bad" />
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Users size={15} className="text-slate-400" />ลูกหนี้แยกตามอายุหนี้</span>}
            action={seeAll(2)}
          >
            <Aging rows={ar.filter((x) => x.open > 0).map((x) => ({ amount: x.open, overdueDays: x.overdueDays }))} tone="warn" />
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.16} className="mt-3">
        <Card
          title={<span className="flex items-center gap-2"><BookOpen size={15} className="text-slate-400" />รายการล่าสุดในสมุดรายวัน</span>}
          subtitle="รายการขายและซื้อมาจากเอกสารต้นทางจริง กดเพื่อดูรายบรรทัด"
          action={seeAll(0)}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((e) => (
              <li key={e.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className={"grid size-8 shrink-0 place-items-center rounded-full " + (isBalanced(e) ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300")}>
                  {isBalanced(e) ? <CircleCheck size={14} /> : <CircleX size={14} />}
                </span>
                <button onClick={() => open.dialog({ kind: "entry", no: e.no })} className="w-28 shrink-0 text-left font-mono text-[12px] text-slate-500 transition hover:text-violet-700 dark:text-slate-400">
                  {e.no}
                </button>
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900 dark:text-slate-50">{e.memo}</span>
                {statusOf(e) !== "ผ่านรายการแล้ว" && <Badge tone={ENTRY_TONE[statusOf(e)]}>{statusOf(e)}</Badge>}
                <span className="flex shrink-0 flex-wrap gap-1">
                  {[...new Set(e.lines.map((l) => l.account))].map((code) => (
                    <button
                      key={code}
                      onClick={() => open.dialog({ kind: "account", code })}
                      className={"rounded-md px-1.5 py-0.5 font-mono text-[10.5px] " + typeSwatch(account(code).type).tint}
                    >
                      {code}
                    </button>
                  ))}
                </span>
                <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-slate-400">{e.date}</span>
                <span className="w-28 shrink-0 text-right text-[13px] tabular-nums text-slate-900 dark:text-slate-50">
                  {baht(entryTotal(e))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>
    </div>
  );
}

function Aging({ rows, tone }: { rows: { amount: number; overdueDays: number }[]; tone: "bad" | "warn" }) {
  const total = rows.reduce((n, r) => n + r.amount, 0);
  return (
    <div className="space-y-3 p-4">
      {AGING_BUCKETS.map((b) => {
        const list = rows.filter((r) => bucketOf(r.overdueDays).label === b.label);
        const sum = list.reduce((n, r) => n + r.amount, 0);
        return (
          <div key={b.label}>
            <div className="mb-1 flex items-center gap-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{b.label}</span>
              <span className="shrink-0 text-[11px] text-slate-400">{list.length} ใบ</span>
              <span className="shrink-0 tabular-nums text-slate-900 dark:text-slate-50">{sum ? baht(sum) : "—"}</span>
            </div>
            <Bar pct={total ? (sum / total) * 100 : 0} tone={b.max === 0 ? "ok" : tone} width="w-full" />
          </div>
        );
      })}
      <p className="text-[11.5px] text-slate-400">รวมทั้งสิ้น {baht(total)}</p>
    </div>
  );
}

/** Aging by party — the report an accountant prints for the credit meeting. */
function AgingByParty({ rows, partyLabel, file }: { rows: { party: string; open: number; overdueDays: number }[]; partyLabel: string; file: string }) {
  const report = agingByParty(rows);
  const header = [partyLabel, "จำนวนใบ", ...AGING_BUCKETS.map((b) => b.label), "รวม"];
  return (
    <Card
      title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />รายงานอายุหนี้แยกราย{partyLabel}</span>}
      subtitle={`ยอดคงค้าง ณ ${PERIOD.to} แยกตามจำนวนวันที่เลยกำหนด`}
      action={
        <Button
          variant="secondary"
          icon={<FileDown size={14} />}
          onClick={() => {
            downloadCsv(file, header, report.map((r) => [r.party, r.documents, ...r.buckets, r.total]));
            notify(`ส่งออกรายงานอายุหนี้ ${report.length} ราย แล้ว`);
          }}
        >
          ส่งออก Excel
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className={THEAD}>
            <tr>
              <th className="px-4 py-3 font-medium">{partyLabel}</th>
              {AGING_BUCKETS.map((b) => (
                <th key={b.label} className="px-4 py-3 text-right font-medium">{b.label}</th>
              ))}
              <th className="px-4 py-3 text-right font-medium">รวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {report.map((r) => (
              <tr key={r.party}>
                <td className="px-4 py-2.5 text-slate-900 dark:text-slate-50">
                  {r.party} <span className="text-[11.5px] text-slate-400">· {r.documents} ใบ</span>
                </td>
                {r.buckets.map((v, i) => (
                  <td key={i} className={"px-4 py-2.5 text-right tabular-nums " + (v && i > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300")}>
                    {v ? baht(v) : "—"}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(r.total)}</td>
              </tr>
            ))}
            {report.length === 0 && (
              <tr><td colSpan={AGING_BUCKETS.length + 2} className="px-4 py-10 text-center text-slate-400">ไม่มียอดคงค้าง</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- ledger */

const STATUS_FILTERS = ["ทั้งหมด", "ร่าง", "ผ่านรายการแล้ว", "กลับรายการแล้ว"] as const;

function Ledger({
  tb,
  entries,
  q,
  setQ,
  type,
  setType,
  open,
}: {
  tb: TrialRow[];
  entries: JournalEntry[];
  q: string;
  setQ: (v: string) => void;
  type: string;
  setType: (v: string) => void;
  open: Open;
}) {
  useData();
  const [view, setView] = useState(LEDGER_TABS[0]);
  const [status, setStatus] = useState<string>("ทั้งหมด");
  const [book, setBook] = useState("ทุกสมุด");
  const needle = q.trim().toLowerCase();
  const rows = tb.filter(
    (a) =>
      (type === "ทุกประเภท" || a.type === type) &&
      (needle === "" || [a.code, a.name].some((t) => t.toLowerCase().includes(needle)))
  );
  const journal = [...entries].reverse().filter(
    (e) =>
      (status === "ทั้งหมด" || statusOf(e) === status || (status === "กลับรายการแล้ว" && statusOf(e) === "รายการกลับ")) &&
      (book === "ทุกสมุด" || (e.book ?? "ทั่วไป") === book) &&
      (needle === "" || [e.no, e.memo, e.ref ?? ""].some((t) => t.toLowerCase().includes(needle)))
  );
  const counts = Object.fromEntries(
    STATUS_FILTERS.map((s) => [
      s,
      s === "ทั้งหมด" ? entries.length : entries.filter((e) => statusOf(e) === s || (s === "กลับรายการแล้ว" && statusOf(e) === "รายการกลับ")).length,
    ])
  );

  const debit = tb.filter((a) => a.balance > 0).reduce((n, a) => n + a.balance, 0);
  const credit = -tb.filter((a) => a.balance < 0).reduce((n, a) => n + a.balance, 0);
  const tied = Math.abs(debit - credit) < 0.005;
  const unbalanced = entries.filter((e) => !isBalanced(e));

  const columns: Column<TrialRow>[] = [
    {
      key: "code",
      header: "รหัสบัญชี",
      width: "14%",
      sort: (a, b) => a.code.localeCompare(b.code),
      cell: (a) => (
        <span className="flex items-center gap-2">
          <Dot className={typeSwatch(a.type).dot} />
          <span className="font-mono text-[12.5px] text-slate-900 dark:text-slate-50">{a.code}</span>
        </span>
      ),
    },
    { key: "name", header: "ชื่อบัญชี", width: "34%", sort: (a, b) => a.name.localeCompare(b.name, "th"), cell: (a) => <span className="text-slate-900 dark:text-slate-50">{a.name}</span> },
    { key: "type", header: "ประเภท", width: "18%", cell: (a) => <Tag swatch={typeSwatch(a.type)}>{a.type}</Tag> },
    {
      key: "debit",
      header: "เดบิต",
      align: "right",
      width: "17%",
      sort: (a, b) => Math.max(0, a.balance) - Math.max(0, b.balance),
      cell: (a) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{a.balance > 0 ? baht(a.balance) : "—"}</span>,
    },
    {
      key: "credit",
      header: "เครดิต",
      align: "right",
      width: "17%",
      sort: (a, b) => Math.max(0, -a.balance) - Math.max(0, -b.balance),
      cell: (a) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{a.balance < 0 ? baht(-a.balance) : "—"}</span>,
    },
  ];

  const exportTrialBalance = () => {
    downloadCsv(
      `งบทดลอง-${PERIOD.to}`,
      ["รหัสบัญชี", "ชื่อบัญชี", "ประเภท", "เดบิต", "เครดิต"],
      rows.map((a) => [a.code, a.name, a.type, a.balance > 0 ? a.balance : 0, a.balance < 0 ? -a.balance : 0])
    );
    notify(`ส่งออกงบทดลอง ${rows.length} บัญชี แล้ว`);
  };

  const exportJournal = () => {
    downloadCsv(
      `สมุดรายวัน-${PERIOD.to}`,
      ["เลขที่", "วันที่", "สมุด", "คำอธิบาย", "เอกสารต้นทาง", "รหัสบัญชี", "ชื่อบัญชี", "คำอธิบายบรรทัด", "เดบิต", "เครดิต", "สถานะ"],
      journal.flatMap((e) =>
        e.lines.map((l) => [
          e.no, e.date, e.book ?? "ทั่วไป", e.memo, e.ref ?? "", l.account, account(l.account).name, l.note ?? "",
          l.amount > 0 ? l.amount : 0, l.amount < 0 ? -l.amount : 0, statusOf(e),
        ])
      )
    );
    notify(`ส่งออกสมุดรายวัน ${journal.length} ใบสำคัญ แล้ว`);
  };

  return (
    <div className="space-y-3">
      <Tabs tabs={LEDGER_TABS} active={view} onPick={setView} icons={LEDGER_ICONS} id="ledger" />

      {view === "ผังบัญชี" && (
        <>
          <StatStrip
            title="งบทดลอง"
            icon={<Scale size={15} />}
            cells={[
              { icon: <Layers size={13} />, label: "บัญชีในผัง", value: ACCOUNTS.length + " บัญชี", sub: "แบ่งเป็นห้าประเภทตามหมวด" },
              { icon: <TrendingUp size={13} />, label: "ยอดเดบิตรวม", value: baht(debit), sub: "สินทรัพย์และค่าใช้จ่าย", tone: "info" },
              { icon: <TrendingDown size={13} />, label: "ยอดเครดิตรวม", value: baht(credit), sub: "หนี้สิน ส่วนของเจ้าของ และรายได้", tone: "accent" },
              { icon: tied ? <CircleCheck size={13} /> : <CircleX size={13} />, label: "ผลการตรวจ", value: tied ? "ลงตัว" : "ไม่ลงตัว", sub: tied ? "เดบิตเท่ากับเครดิตพอดี" : `ต่างกัน ${satang(Math.abs(debit - credit))}`, tone: tied ? "ok" : "bad" },
            ]}
          />
          <DataTable
            rows={rows}
            columns={columns}
            getId={(a) => a.code}
            onOpen={(a) => open.dialog({ kind: "account", code: a.code })}
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Search value={q} onChange={setQ} placeholder="ค้นหารหัสหรือชื่อบัญชี" icon={<SearchIcon size={14} />} />
                <Select value={type} onChange={setType} options={["ทุกประเภท", ...ACCOUNT_TYPES]} />
                <span className="ml-auto text-[12px] text-slate-400">กดที่แถวเพื่อเปิดบัญชีแยกประเภท</span>
                <Button variant="secondary" icon={<FileDown size={14} />} onClick={exportTrialBalance}>ส่งออก Excel</Button>
                <Button variant="primary" icon={<Plus size={15} />} onClick={() => open.dialog({ kind: "accountForm" })}>เพิ่มบัญชี</Button>
              </div>
            }
          />
        </>
      )}

      {view === "สมุดรายวัน" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Search value={q} onChange={setQ} placeholder="ค้นหาเลขที่ คำอธิบาย เอกสาร" icon={<SearchIcon size={14} />} />
            <Segmented options={STATUS_FILTERS} value={status} onChange={setStatus} counts={counts} />
            <Select value={book} onChange={setBook} options={["ทุกสมุด", ...JOURNAL_BOOKS]} className="w-36" />
            <span className="ml-auto" />
            <Button variant="secondary" icon={<FileDown size={14} />} onClick={exportJournal}>ส่งออก Excel</Button>
            <Button variant="primary" icon={<FilePen size={15} />} onClick={() => open.dialog({ kind: "journal" })}>บันทึกใบสำคัญ</Button>
          </div>
          <Card
            title={<span className="flex items-center gap-2"><BookOpen size={15} className="text-slate-400" />สมุดรายวัน</span>}
            subtitle={unbalanced.length ? `มี ${unbalanced.length} รายการที่เดบิตยังไม่เท่าเครดิต` : "ทุกรายการเดบิตเท่ากับเครดิต"}
            action={<Chip>{journal.length} รายการ</Chip>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className={THEAD}>
                  <tr>
                    <th className="px-4 py-3 font-medium">เลขที่</th>
                    <th className="px-4 py-3 font-medium">วันที่</th>
                    <th className="px-4 py-3 font-medium">สมุด</th>
                    <th className="px-4 py-3 font-medium">คำอธิบาย</th>
                    <th className="px-4 py-3 font-medium">เอกสารต้นทาง</th>
                    <th className="px-4 py-3 text-right font-medium">จำนวนเงิน</th>
                    <th className="px-4 py-3 font-medium">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {journal.map((e) => (
                    <tr
                      key={e.no}
                      onClick={() => open.dialog({ kind: "entry", no: e.no })}
                      className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{e.no}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">{e.date}</td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{e.book ?? "ทั่วไป"}</td>
                      <td className="px-4 py-2.5 text-slate-900 dark:text-slate-50">{e.memo}</td>
                      <td className="px-4 py-2.5 font-mono text-[11.5px] text-violet-700 dark:text-violet-300">{e.ref ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-50">{satang(entryTotal(e))}</td>
                      <td className="px-4 py-2.5">
                        {isBalanced(e) ? (
                          <Badge tone={ENTRY_TONE[statusOf(e)]} dot>{statusOf(e)}</Badge>
                        ) : (
                          <Badge tone="bad" dot>ไม่ลงตัว</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {journal.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">ไม่มีรายการที่ตรงกับเงื่อนไข</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- payables */

function Payables({ rows, open }: { rows: ReturnType<typeof payables>; open: Open }) {
  useData();
  const total = rows.reduce((n, r) => n + r.open, 0);
  const overdue = rows.filter((r) => r.overdueDays > 0);
  const whtPayable = -balanceOf("2120");
  const payments = [...PAYMENTS].reverse();

  const exportOpen = () => {
    downloadCsv(
      `เจ้าหนี้ค้างจ่าย-${PERIOD.to}`,
      ["เลขที่", "ผู้ขาย", "เงื่อนไข", "วันที่", "ครบกำหนด", "ยอดตามใบ", "ชำระแล้ว", "คงค้าง", "เลยกำหนด (วัน)", "สถานะ"],
      rows.map((r) => [r.no, r.vendorName, r.terms, r.date, r.due, r.amount, r.paidAmount, r.open, r.overdueDays, r.blocked ? "ระงับจ่าย" : r.overdueDays > 0 ? "เลยกำหนด" : "ยังไม่ถึงกำหนด"])
    );
    notify(`ส่งออกเจ้าหนี้ค้างจ่าย ${rows.length} ใบ แล้ว`);
  };
  const exportPayments = () => {
    downloadCsv(
      `ใบสำคัญจ่าย-${PERIOD.to}`,
      ["เลขที่", "วันที่", "ผู้ขาย", "ใบแจ้งหนี้", "ยอดตัดหนี้", "หัก ณ ที่จ่าย", "จ่ายสุทธิ", "วิธีจ่าย", "สถานะ"],
      payments.map((p) => [p.no, p.date, vendor(p.vendor).name, p.invoice, p.settle, p.wht, p.net, p.method, isVoided(p.no) ? "ยกเลิก" : "ใช้งาน"])
    );
    notify(`ส่งออกใบสำคัญจ่าย ${payments.length} ใบ แล้ว`);
  };

  return (
    <div className="space-y-3">
      <StatStrip
        title="เจ้าหนี้การค้า"
        icon={<ReceiptIcon size={15} />}
        cells={[
          { icon: <ReceiptIcon size={13} />, label: "ใบแจ้งหนี้ค้างจ่าย", value: rows.length + " ใบ", sub: baht(total) },
          { icon: <CalendarClock size={13} />, label: "เลยกำหนดชำระ", value: overdue.length + " ใบ", sub: baht(overdue.reduce((n, r) => n + r.open, 0)), tone: overdue.length > 0 ? "bad" : "ok" },
          { icon: <Building size={13} />, label: "ผู้ขายที่มียอดค้าง", value: new Set(rows.map((r) => r.vendorName)).size + " ราย", sub: "อ่านจากแฟ้มจัดซื้อ", tone: "info" },
          { icon: <Banknote size={13} />, label: "ภาษีหัก ณ ที่จ่ายค้างนำส่ง", value: baht(whtPayable), sub: "นำส่งด้วยแบบ ภ.ง.ด.53 ภายในวันที่ 7 ของเดือนถัดไป", tone: "accent" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><ReceiptIcon size={15} className="text-slate-400" />ใบแจ้งหนี้ที่ยังไม่ได้จ่าย</span>}
        subtitle="ใบแจ้งหนี้จากแฟ้มจัดซื้อและใบตั้งหนี้ค่าบริการ วันครบกำหนดคำนวณจากเงื่อนไขชำระของผู้ขาย"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<FileDown size={14} />} onClick={exportOpen}>ส่งออก Excel</Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => open.dialog({ kind: "bill" })}>ตั้งหนี้ค่าบริการ</Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className={THEAD}>
              <tr>
                <th className="px-4 py-3 font-medium">เลขที่</th>
                <th className="px-4 py-3 font-medium">ผู้ขาย</th>
                <th className="px-4 py-3 font-medium">เงื่อนไข</th>
                <th className="px-4 py-3 font-medium">ครบกำหนด</th>
                <th className="px-4 py-3 text-right font-medium">ยอดตามใบ</th>
                <th className="px-4 py-3 text-right font-medium">คงค้าง</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.no} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5">
                    <span className="block font-mono text-[12px] text-slate-500 dark:text-slate-400">{r.no}</span>
                    <span className="block text-[11px] text-slate-400">{r.source}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.vendorName.replace(/^(บจก\.|หจก\.)\s*/, "")} size="sm" />
                      <span className="min-w-0">
                        <span className="block text-slate-900 dark:text-slate-50">{r.vendorName}</span>
                        <span className="block truncate text-[11.5px] text-slate-400">{r.description}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{r.terms}</td>
                  <td className={"px-4 py-2.5 tabular-nums " + (r.overdueDays > 0 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400")}>
                    {r.due}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{satang(r.amount)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{satang(r.open)}</td>
                  <td className="px-4 py-2.5">
                    {r.blocked ? (
                      <span title={r.blocked}><Badge tone="bad" icon={<Ban size={11} />}>ระงับจ่าย</Badge></span>
                    ) : (
                      <Badge tone={r.overdueDays > 0 ? "bad" : r.paidAmount > 0 ? "info" : "ok"} dot>
                        {r.overdueDays > 0 ? `เลยกำหนด ${r.overdueDays} วัน` : r.paidAmount > 0 ? "จ่ายแล้วบางส่วน" : "ยังไม่ถึงกำหนด"}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!r.blocked && (
                      <RowAction icon={<Send size={12} />} onClick={() => open.dialog({ kind: "pay", invoice: r.no })}>จ่ายชำระ</RowAction>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">ไม่มีหนี้ค้างจ่าย</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.some((r) => r.blocked) && (
          <div className="border-t border-slate-100 p-3 dark:border-slate-800">
            <Note tone="warn">ใบที่ระงับจ่ายคือใบที่ฝ่ายจัดซื้อพบว่ายอดวางบิลไม่ตรงกับของที่รับจริง ต้องแก้ที่ระบบจัดซื้อก่อนจึงจ่ายได้</Note>
          </div>
        )}
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><Wallet size={15} className="text-slate-400" />ประวัติการจ่ายชำระ</span>}
        subtitle="ใบสำคัญจ่ายที่ออกจากระบบบัญชี พิมพ์ใบสำคัญจ่ายและหนังสือรับรองการหักภาษี ณ ที่จ่ายได้จากแต่ละใบ"
        action={<Button variant="secondary" icon={<FileDown size={14} />} onClick={exportPayments}>ส่งออก Excel</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className={THEAD}>
              <tr>
                <th className="px-4 py-3 font-medium">เลขที่</th>
                <th className="px-4 py-3 font-medium">วันที่</th>
                <th className="px-4 py-3 font-medium">ใบแจ้งหนี้</th>
                <th className="px-4 py-3 text-right font-medium">ยอดตัดหนี้</th>
                <th className="px-4 py-3 text-right font-medium">หัก ณ ที่จ่าย</th>
                <th className="px-4 py-3 text-right font-medium">จ่ายสุทธิ</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map((p) => {
                const voided = isVoided(p.no);
                return (
                  <tr key={p.no} className={voided ? "opacity-60" : ""}>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{p.no}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">{p.date}</td>
                    <td className="px-4 py-2.5 font-mono text-[11.5px] text-violet-700 dark:text-violet-300">{p.invoice}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{satang(p.settle)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{p.wht ? `${satang(p.wht)} (${p.whtRate * 100}%)` : "—"}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{satang(p.net)}</td>
                    <td className="px-4 py-2.5"><Badge tone={voided ? "idle" : "ok"} dot>{voided ? "ยกเลิกแล้ว" : p.method}</Badge></td>
                    <td className="px-4 py-2.5">
                      <span className="flex justify-end gap-1.5">
                        <RowAction icon={<Printer size={12} />} onClick={() => open.print({ kind: "payment", no: p.no })}>ใบสำคัญจ่าย</RowAction>
                        {p.wht > 0 && <RowAction icon={<FileText size={12} />} onClick={() => open.print({ kind: "wht", no: p.no })}>50 ทวิ</RowAction>}
                        {!voided && <RowAction icon={<RotateCcw size={12} />} tone="danger" onClick={() => open.confirm({ kind: "reverse", no: p.no })}>ยกเลิก</RowAction>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
        <Card title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />อายุหนี้เจ้าหนี้</span>}>
          <Aging rows={rows.map((r) => ({ amount: r.open, overdueDays: r.overdueDays }))} tone="bad" />
        </Card>
        <AgingByParty rows={rows.map((r) => ({ party: r.vendorName, open: r.open, overdueDays: r.overdueDays }))} partyLabel="ผู้ขาย" file={`อายุหนี้เจ้าหนี้-${PERIOD.to}`} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- receivables */

function Receivables({ rows, open }: { rows: ReturnType<typeof receivables>; open: Open }) {
  useData();
  const owing = rows.filter((r) => r.open > 0);
  const total = owing.reduce((n, r) => n + r.open, 0);
  const overdue = owing.filter((r) => r.overdueDays > 0);
  const unbilled = readyToInvoice();
  const receipts = salesReceipts();

  const exportOpen = () => {
    downloadCsv(
      `ลูกหนี้ค้างรับ-${PERIOD.to}`,
      ["ใบกำกับ", "ใบสั่งขาย", "ลูกค้า", "เงื่อนไข", "วันที่", "ครบกำหนด", "ยอดตามใบ", "ลดหนี้", "รับแล้ว", "คงค้าง", "เลยกำหนด (วัน)"],
      rows.map((r) => [r.invoice, r.so, r.customerName, r.terms, r.date, r.due, r.amount, r.credited, r.received, r.open, r.overdueDays])
    );
    notify(`ส่งออกลูกหนี้ค้างรับ ${rows.length} ใบ แล้ว`);
  };
  const exportReceipts = () => {
    downloadCsv(
      `ใบเสร็จรับเงิน-${PERIOD.to}`,
      ["เลขที่", "วันที่", "ใบกำกับ", "ตัดหนี้", "ถูกหัก ณ ที่จ่าย", "รับสุทธิ", "วิธีรับ", "อ้างอิง", "สถานะ"],
      receipts.map((r) => [r.no, r.date, r.invoice, r.amount + r.wht, r.wht, r.amount, r.method, r.ref, r.voided ? "ยกเลิก" : "ใช้งาน"])
    );
    notify(`ส่งออกใบเสร็จรับเงิน ${receipts.length} ใบ แล้ว`);
  };

  return (
    <div className="space-y-3">
      <StatStrip
        title="ลูกหนี้การค้า"
        icon={<Users size={15} />}
        cells={[
          { icon: <Users size={13} />, label: "ยอดที่ยังไม่ได้เก็บ", value: owing.length + " ใบ", sub: baht(total) },
          { icon: <CalendarClock size={13} />, label: "เลยกำหนดชำระ", value: overdue.length + " ใบ", sub: baht(overdue.reduce((n, r) => n + r.open, 0)), tone: overdue.length > 0 ? "bad" : "ok" },
          { icon: <FileText size={13} />, label: "ส่งของแล้วยังไม่ออกใบกำกับ", value: unbilled.length + " ใบ", sub: "ยังไม่เป็นรายได้และยังไม่เป็นลูกหนี้", tone: unbilled.length > 0 ? "warn" : "ok" },
          { icon: <Wallet size={13} />, label: "ภาษีขายค้างนำส่ง", value: baht(-balanceOf("2110")), sub: "ต้องนำส่งในแบบภาษีมูลค่าเพิ่ม", tone: "accent" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Users size={15} className="text-slate-400" />ยอดที่ลูกค้ายังไม่ชำระ</span>}
        subtitle="รายใบกำกับจากระบบขาย หักใบลดหนี้และใบเสร็จแล้ว วันครบกำหนดตามใบกำกับ"
        action={<Button variant="secondary" icon={<FileDown size={14} />} onClick={exportOpen}>ส่งออก Excel</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className={THEAD}>
              <tr>
                <th className="px-4 py-3 font-medium">ใบกำกับ</th>
                <th className="px-4 py-3 font-medium">ลูกค้า</th>
                <th className="px-4 py-3 font-medium">ครบกำหนด</th>
                <th className="px-4 py-3 text-right font-medium">ยอดตามใบ</th>
                <th className="px-4 py-3 text-right font-medium">คงค้าง</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => (
                <tr key={r.invoice} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5">
                    <span className="block font-mono text-[12px] text-slate-500 dark:text-slate-400">{r.invoice}</span>
                    <span className="block font-mono text-[11px] text-slate-400">{r.so}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.customerName.replace(/^(บจก\.|หจก\.|ร้าน)\s*/, "")} size="sm" />
                      <span className="min-w-0">
                        <span className="block text-slate-900 dark:text-slate-50">{r.customerName}</span>
                        <span className="block text-[11.5px] text-slate-400">{r.terms}</span>
                      </span>
                    </span>
                  </td>
                  <td className={"px-4 py-2.5 tabular-nums " + (r.overdueDays > 0 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400")}>
                    {r.due}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {satang(r.amount)}
                    {r.credited > 0 && <span className="block text-[11px] text-slate-400">ลดหนี้ {satang(r.credited)}</span>}
                  </td>
                  <td className={"px-4 py-2.5 text-right font-semibold tabular-nums " + (r.open < 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-900 dark:text-slate-50")}>{satang(r.open)}</td>
                  <td className="px-4 py-2.5">
                    {r.open < 0 ? (
                      <Badge tone="warn" dot>ลดหนี้หลังรับเงิน ต้องคืนลูกค้า</Badge>
                    ) : (
                      <Badge tone={r.overdueDays > 0 ? "bad" : "ok"} dot>
                        {r.overdueDays > 0 ? `เลยกำหนด ${r.overdueDays} วัน` : "ยังไม่ถึงกำหนด"}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex justify-end gap-1.5">
                      {!r.paid && r.open > 0 && (
                        <RowAction icon={<HandCoins size={12} />} onClick={() => open.dialog({ kind: "receive", invoice: r.invoice })}>รับชำระ</RowAction>
                      )}
                      <RowAction icon={<Printer size={12} />} onClick={() => open.print({ kind: "statement", customer: r.customer })}>ใบแจ้งยอด</RowAction>
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">ไม่มียอดค้างรับ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title={<span className="flex items-center gap-2"><Tags size={15} className="text-slate-400" />ใบเสร็จรับเงิน</span>}
        subtitle="เล่มเดียวกับระบบขาย รับชำระที่หน้าไหนก็เห็นทั้งสองที่ บัญชีลงสมุดรายวันรับเงินให้อัตโนมัติ"
        action={<Button variant="secondary" icon={<FileDown size={14} />} onClick={exportReceipts}>ส่งออก Excel</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className={THEAD}>
              <tr>
                <th className="px-4 py-3 font-medium">เลขที่</th>
                <th className="px-4 py-3 font-medium">วันที่</th>
                <th className="px-4 py-3 font-medium">ใบกำกับ</th>
                <th className="px-4 py-3 text-right font-medium">ตัดหนี้</th>
                <th className="px-4 py-3 text-right font-medium">ถูกหัก ณ ที่จ่าย</th>
                <th className="px-4 py-3 text-right font-medium">รับสุทธิ</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {receipts.map((r) => (
                <tr key={r.no} className={r.voided ? "opacity-60" : ""}>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{r.no}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">{r.date}</td>
                  <td className="px-4 py-2.5 font-mono text-[11.5px] text-violet-700 dark:text-violet-300">{r.invoice}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{satang(r.amount + r.wht)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{r.wht ? satang(r.wht) : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{satang(r.amount)}</td>
                  <td className="px-4 py-2.5"><Badge tone={r.voided ? "idle" : "ok"} dot>{r.voided ? "ยกเลิกแล้ว" : r.method}</Badge></td>
                  <td className="px-4 py-2.5">
                    <span className="flex justify-end gap-1.5">
                      <RowAction icon={<Printer size={12} />} onClick={() => open.print({ kind: "receipt", no: r.no })}>พิมพ์</RowAction>
                      {!r.voided && <RowAction icon={<RotateCcw size={12} />} tone="danger" onClick={() => open.confirm({ kind: "cancelReceipt", invoice: r.invoice })}>ยกเลิก</RowAction>}
                    </span>
                  </td>
                </tr>
              ))}
              {receipts.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">ยังไม่มีใบเสร็จ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
        <Card title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />อายุหนี้ลูกหนี้</span>}>
          <Aging rows={owing.map((r) => ({ amount: r.open, overdueDays: r.overdueDays }))} tone="warn" />
        </Card>
        <AgingByParty rows={owing.map((r) => ({ party: r.customerName, open: r.open, overdueDays: r.overdueDays }))} partyLabel="ลูกค้า" file={`อายุหนี้ลูกหนี้-${PERIOD.to}`} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- assets */

function Assets({ open }: { open: Open }) {
  useData();
  const register = assetRegister();
  const live = register.filter((a) => !activeDisposal(a));
  const cost = live.reduce((n, a) => n + a.cost, 0);
  const accum = live.reduce((n, a) => n + accumulated(a), 0);
  const next = depreciationPreview();
  const runs = [...DEPRECIATION_RUNS].reverse();

  const exportRegister = () => {
    downloadCsv(
      `ทะเบียนสินทรัพย์-${depreciatedThrough()}`,
      ["รหัส", "รายการ", "วันที่ได้มา", "ราคาทุน", "อายุ (ปี)", "ราคาซาก", "ค่าเสื่อมต่อเดือน", "ค่าเสื่อมสะสม", "มูลค่าคงเหลือ", "สถานะ"],
      register.map((a) => [a.code, a.name, a.acquired, a.cost, a.lifeYears, a.salvage, monthlyDepreciation(a), accumulated(a), activeDisposal(a) ? 0 : bookValue(a), assetStatus(a)])
    );
    notify(`ส่งออกทะเบียนสินทรัพย์ ${register.length} รายการ แล้ว`);
  };

  return (
    <div className="space-y-3">
      <StatStrip
        title="สินทรัพย์ถาวร"
        icon={<Landmark size={15} />}
        cells={[
          { icon: <Landmark size={13} />, label: "ราคาทุนรวม", value: baht(cost), sub: `${live.length} รายการที่ยังใช้งาน` },
          { icon: <TrendingDown size={13} />, label: "ค่าเสื่อมราคาสะสม", value: baht(accum), sub: `คิดวิธีเส้นตรงถึง ${depreciatedThrough()}`, tone: "warn" },
          { icon: <Scale size={13} />, label: "มูลค่าคงเหลือตามบัญชี", value: baht(cost - accum), sub: "ราคาทุนหักค่าเสื่อมสะสม", tone: "ok" },
          { icon: <CalendarClock size={13} />, label: "ค่าเสื่อมงวดถัดไป", value: baht(next.total), sub: `งวด ${thaiMonth(next.period)} ยังไม่ได้บันทึก`, tone: "accent" },
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => open.dialog({ kind: "assetForm" })}>ลงทะเบียนสินทรัพย์</Button>
        <Button variant="secondary" icon={<Sigma size={15} />} onClick={() => open.dialog({ kind: "depreciate" })}>
          บันทึกค่าเสื่อม {thaiMonth(next.period)}
        </Button>
        <span className="ml-auto" />
        <Button variant="secondary" icon={<Printer size={14} />} onClick={() => open.print({ kind: "register" })}>พิมพ์ทะเบียน</Button>
        <Button variant="secondary" icon={<FileDown size={14} />} onClick={exportRegister}>ส่งออก Excel</Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {register.map((a) => {
          const acc = accumulated(a);
          const held = monthsHeld(a);
          const life = a.lifeYears * 12;
          const sw = swatchFor(a.code);
          const status = assetStatus(a);
          return (
            <Card
              key={a.code}
              title={
                <button onClick={() => open.dialog({ kind: "asset", code: a.code })} className="flex items-center gap-2.5 text-left transition hover:text-violet-700">
                  <span className={"grid size-8 place-items-center rounded-lg " + sw.tint}>
                    <Landmark size={15} />
                  </span>
                  {a.name}
                </button>
              }
              subtitle={`${a.code} · ได้มาเมื่อ ${a.acquired} · อายุการใช้งาน ${a.lifeYears} ปี`}
              action={
                <Badge tone={status === "จำหน่ายแล้ว" ? "bad" : status === "ตัดค่าเสื่อมครบแล้ว" ? "idle" : "ok"}>
                  {status === "ใช้งาน" ? `ใช้มา ${held} เดือน` : status}
                </Badge>
              }
            >
              <div className="space-y-3 p-4">
                <Progress done={Math.min(held, life)} total={life} label={`อายุการใช้งานที่ผ่านไป ${Math.min(held, life)} จาก ${life} เดือน`} />
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "ราคาทุน", value: baht(a.cost) },
                    { label: "ค่าเสื่อมสะสม", value: baht(acc) },
                    { label: "มูลค่าคงเหลือ", value: activeDisposal(a) ? "จำหน่ายแล้ว" : baht(a.cost - acc) },
                  ].map((c) => (
                    <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                      <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
                      <div className="mt-1 text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card
        title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />การตัดค่าเสื่อมราคาที่บันทึกแล้ว</span>}
        subtitle="ตัดได้ทีละงวดต่อกัน กลับรายการได้เฉพาะงวดล่าสุด"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {runs.map((r) => {
            const e = entryByNo(r.jv);
            return (
              <li key={r.jv} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="w-24 shrink-0 font-medium text-slate-900 dark:text-slate-50">{thaiMonth(r.period)}</span>
                <button onClick={() => open.dialog({ kind: "entry", no: r.jv })} className="font-mono text-[12px] text-violet-700 hover:underline dark:text-violet-300">
                  {r.jv}
                </button>
                <span className="min-w-0 flex-1 text-slate-500 dark:text-slate-400">{r.lines.length} รายการ · ลงวันที่ {r.date}</span>
                <Badge tone={ENTRY_TONE[statusOf(e)]} dot>{statusOf(e)}</Badge>
                <span className="w-28 text-right tabular-nums text-slate-900 dark:text-slate-50">{baht(entryTotal(e))}</span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ statements */

function Statements({ open }: { open: Open }) {
  useData();
  const periods = statementPeriods();
  const [key, setKey] = useState(periods[0].key);
  const [view, setView] = useState(STATEMENT_TABS[0]);
  const period = periods.find((p) => p.key === key) ?? periods[0];
  const pl = profitAndLoss(period.from ? { from: period.from, to: period.to } : undefined);
  const bs = balanceSheet(period.to);

  const exportStatements = () => {
    const rows: (string | number)[][] = [
      ["งบกำไรขาดทุน", period.label, ""],
      ...pl.revenues.filter((a) => a.balance !== 0).map((a) => ["รายได้", a.name, -a.balance]),
      ...pl.expenses.filter((a) => a.balance !== 0).map((a) => ["ค่าใช้จ่าย", a.name, a.balance]),
      ["", pl.profit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ", pl.profit],
      ["งบแสดงฐานะการเงิน", period.to ?? "ปัจจุบัน", ""],
      ...bs.assets.map((a) => ["สินทรัพย์", a.name, a.balance]),
      ...bs.liabilities.map((a) => ["หนี้สิน", a.name, -a.balance]),
      ...bs.equity.map((a) => ["ส่วนของเจ้าของ", a.name, -a.balance]),
      ["ส่วนของเจ้าของ", "กำไร(ขาดทุน)ปีปัจจุบัน", bs.profit],
    ];
    downloadCsv(`งบการเงิน-${period.key}`, ["หมวด", "รายการ", "จำนวนเงิน"], rows);
    notify(`ส่งออกงบการเงิน ${period.label} แล้ว`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={period.label} onChange={(label) => setKey(periods.find((p) => p.label === label)?.key ?? "ytd")} options={periods.map((p) => p.label)} className="w-56" />
        <span className="text-[12px] text-slate-400">คำนวณจากทุกรายการที่ผ่านแล้วในสมุดรายวัน</span>
        <span className="ml-auto" />
        <Button variant="secondary" icon={<FileDown size={14} />} onClick={exportStatements}>ส่งออก Excel</Button>
        <Button variant="primary" icon={<Printer size={14} />} onClick={() => open.print({ kind: "statements", period })}>พิมพ์งบการเงิน</Button>
      </div>

      <Tabs tabs={STATEMENT_TABS} active={view} onPick={setView} icons={STATEMENT_ICONS} id="statement" />

      {view === "งบกำไรขาดทุน" && (
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><TrendingUp size={15} className="text-slate-400" />งบกำไรขาดทุน</span>}
            subtitle={`${period.label} · คำนวณจากยอดคงเหลือในสมุดรายวัน`}
          >
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pl.revenues.filter((a) => a.balance !== 0).map((a) => (
                <li key={a.code} className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] font-medium text-slate-900 dark:text-slate-50">{a.name}</span>
                  <span className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(-a.balance)}</span>
                </li>
              ))}
              {pl.expenses.filter((a) => a.balance !== 0).map((a) => (
                <li key={a.code} className="flex items-center gap-3 px-4 py-2.5">
                  <Dot className={swatchFor(a.code).dot} />
                  <span className="min-w-0 flex-1 text-[13px] text-slate-700 dark:text-slate-200">{a.name}</span>
                  <span className="w-24 shrink-0">
                    <Bar pct={pl.revenue ? (a.balance / pl.revenue) * 100 : 0} tone="bad" width="w-full" />
                  </span>
                  <span className="w-28 shrink-0 text-right text-[13px] tabular-nums text-rose-600 dark:text-rose-400">
                    −{baht(a.balance)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
                  {pl.profit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"}
                </span>
                <span className={"text-[16px] font-semibold tabular-nums " + (pl.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {baht(pl.profit)}
                </span>
              </li>
            </ul>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Coins size={15} className="text-slate-400" />สัดส่วนค่าใช้จ่าย</span>}>
            <div className="p-4">
              <Donut
                segments={pl.expenses.filter((a) => a.balance > 0).map((a) => ({ label: a.name, value: a.balance, swatch: swatchFor(a.code) }))}
                size={128}
                format={(n) => baht(n)}
                center={
                  <span>
                    <span className="block text-[18px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {pl.revenue ? Math.round((pl.expenseTotal / pl.revenue) * 100) : 0}%
                    </span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">ของรายได้</span>
                  </span>
                }
              />
            </div>
          </Card>
        </div>
      )}

      {view === "งบแสดงฐานะการเงิน" && (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card
              title={<span className="flex items-center gap-2"><Wallet size={15} className="text-slate-400" />สินทรัพย์</span>}
              action={<Chip>{baht(bs.assetTotal)}</Chip>}
            >
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {bs.assets.map((a) => (
                  <li key={a.code} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="font-mono text-[11.5px] text-slate-400">{a.code}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{a.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-900 dark:text-slate-50">{baht(a.balance)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">รวมสินทรัพย์</span>
                  <span className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(bs.assetTotal)}</span>
                </li>
              </ul>
            </Card>

            <Card
              title={<span className="flex items-center gap-2"><Scale size={15} className="text-slate-400" />หนี้สินและส่วนของเจ้าของ</span>}
              action={<Chip>{baht(bs.liabilityTotal + bs.equityTotal + bs.profit)}</Chip>}
            >
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...bs.liabilities, ...bs.equity].map((a) => (
                  <li key={a.code} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="font-mono text-[11.5px] text-slate-400">{a.code}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{a.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-900 dark:text-slate-50">{baht(-a.balance)}</span>
                  </li>
                ))}
                <li className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="font-mono text-[11.5px] text-slate-400">—</span>
                  <span className="min-w-0 flex-1 text-slate-800 dark:text-slate-100">
                    {bs.profit >= 0 ? "กำไรงวดนี้" : "ขาดทุนงวดนี้"}
                  </span>
                  <span className={"shrink-0 tabular-nums " + (bs.profit >= 0 ? "text-slate-900 dark:text-slate-50" : "text-rose-600 dark:text-rose-400")}>
                    {baht(bs.profit)}
                  </span>
                </li>
                <li className="flex items-center justify-between bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">รวมหนี้สินและส่วนของเจ้าของ</span>
                  <span className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                    {baht(bs.liabilityTotal + bs.equityTotal + bs.profit)}
                  </span>
                </li>
              </ul>
            </Card>
          </div>

          <Note tone={bs.balances ? "ok" : "bad"}>
            {bs.balances
              ? `งบดุลลงตัว ${period.to ? "ณ " + period.to : ""} สินทรัพย์เท่ากับหนี้สินบวกส่วนของเจ้าของบวกกำไรงวดนี้`
              : `สินทรัพย์ไม่เท่ากับหนี้สินบวกส่วนของเจ้าของ ต่างกัน ${baht(Math.abs(bs.assetTotal - (bs.liabilityTotal + bs.equityTotal + bs.profit)))}`}
          </Note>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- records */

function EntryRecord({ no, open }: { no: string; open: Open }) {
  useData();
  const e = entryByNo(no);
  const status = statusOf(e);
  const blocker = reversalBlocker(no);
  const debit = e.lines.filter((l) => l.amount > 0);
  const credit = e.lines.filter((l) => l.amount < 0);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="เลขที่">
          <span className="flex items-center gap-2">{e.no} <Badge tone={ENTRY_TONE[status]} dot>{status}</Badge></span>
        </IconRow>
        <IconRow icon={<CalendarClock size={14} />} label="วันที่">{e.date}</IconRow>
        <IconRow icon={<BookOpen size={14} />} label="คำอธิบาย">{e.memo}</IconRow>
        <IconRow icon={<Layers size={14} />} label="สมุดรายวัน">{e.book ?? "ทั่วไป"}{e.origin ? ` · บันทึกอัตโนมัติจาก${e.origin}` : ""}</IconRow>
        {e.ref && <IconRow icon={<ReceiptIcon size={14} />} label="เอกสารต้นทาง">{e.ref}</IconRow>}
        {e.reversedBy && (
          <IconRow icon={<RotateCcw size={14} />} label="กลับรายการด้วย">
            <button onClick={() => open.dialog({ kind: "entry", no: e.reversedBy! })} className="text-violet-700 hover:underline dark:text-violet-300">{e.reversedBy}</button>
          </IconRow>
        )}
      </div>

      <table className="w-full text-[13px]">
        <thead className={THEAD}>
          <tr>
            <th className="px-3 py-2.5 font-medium">บัญชี</th>
            <th className="px-3 py-2.5 font-medium">ประเภท</th>
            <th className="px-3 py-2.5 text-right font-medium">เดบิต</th>
            <th className="px-3 py-2.5 text-right font-medium">เครดิต</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {e.lines.map((l, i) => {
            const a = account(l.account);
            return (
              <tr key={i}>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <Dot className={typeSwatch(a.type).dot} />
                    <span className="font-mono text-[11.5px] text-slate-400">{l.account}</span>
                    <span className="text-slate-900 dark:text-slate-50">{a.name}</span>
                  </span>
                  {l.note && <span className="ml-4 block text-[11.5px] text-slate-400">{l.note}</span>}
                </td>
                <td className="px-3 py-2">
                  <Tag swatch={typeSwatch(a.type)}>{a.type}</Tag>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                  {l.amount > 0 ? satang(l.amount) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                  {l.amount < 0 ? satang(-l.amount) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-slate-50/80 dark:bg-slate-800/60">
          <tr>
            <td colSpan={2} className="px-3 py-2.5 text-right font-medium text-slate-600 dark:text-slate-300">
              รวมทั้งสองด้าน
            </td>
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {satang(debit.reduce((n, l) => n + l.amount, 0))}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {satang(-credit.reduce((n, l) => n + l.amount, 0))}
            </td>
          </tr>
        </tfoot>
      </table>

      <Note tone={isBalanced(e) ? (status === "ร่าง" ? "warn" : "ok") : "bad"}>
        {!isBalanced(e)
          ? `รายการนี้เดบิตไม่เท่าเครดิต ต่างกัน ${satang(Math.abs(entryDifference(e)))} แก้ร่างให้ลงตัวก่อนจึงผ่านรายการได้`
          : status === "ร่าง"
            ? "ร่างยังไม่มีผลในบัญชีและงบการเงิน ตรวจแล้วกดผ่านรายการ"
            : e.reason
              ? `เหตุผลที่กลับรายการ: ${e.reason}`
              : "รายการนี้เดบิตเท่ากับเครดิต ลงบัญชีแล้ว"}
      </Note>
      {status === "ผ่านรายการแล้ว" && blocker && <Note tone="idle">{blocker}</Note>}

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        {status === "ร่าง" && (
          <>
            <Button variant="ghost" icon={<Trash2 size={14} />} onClick={() => open.confirm({ kind: "deleteDraft", no })}>ลบร่าง</Button>
            <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => open.dialog({ kind: "journal", no })}>แก้ไข</Button>
          </>
        )}
        <Button variant="secondary" icon={<Printer size={14} />} onClick={() => open.print({ kind: "voucher", no })}>พิมพ์ใบสำคัญ</Button>
        {status === "ร่าง" && (
          <Button
            variant="primary"
            icon={<CircleCheck size={14} />}
            disabled={!isBalanced(e)}
            onClick={() => {
              postJournal(no);
              notify(`ผ่านรายการใบสำคัญ ${no} แล้ว`);
            }}
          >
            ผ่านรายการ
          </Button>
        )}
        {status === "ผ่านรายการแล้ว" && !blocker && (
          <Button variant="danger" icon={<RotateCcw size={14} />} onClick={() => open.confirm({ kind: "reverse", no })}>
            กลับรายการ
          </Button>
        )}
      </div>
    </div>
  );
}

function AccountRecord({ code, open }: { code: string; open: Open }) {
  useData();
  const a = account(code);
  const rows = accountLedger(code);
  const balance = rows.length ? rows[rows.length - 1].running : 0;

  const exportLedger = () => {
    downloadCsv(
      `บัญชีแยกประเภท-${code}`,
      ["เลขที่", "วันที่", "คำอธิบาย", "เดบิต", "เครดิต", "ยอดสะสม"],
      rows.map((r) => [r.entry.no, r.entry.date, r.entry.memo, r.amount > 0 ? r.amount : 0, r.amount < 0 ? -r.amount : 0, r.running])
    );
    notify(`ส่งออกบัญชีแยกประเภท ${code} ${rows.length} รายการ แล้ว`);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="รหัสบัญชี">{a.code}</IconRow>
        <IconRow icon={<Layers size={14} />} label="ประเภท">{a.type}</IconRow>
        <IconRow icon={<Sigma size={14} />} label="ยอดคงเหลือ">
          {balance >= 0 ? `${satang(balance)} ทางเดบิต` : `${satang(-balance)} ทางเครดิต`}
        </IconRow>
        <IconRow icon={<BookOpen size={14} />} label="จำนวนรายการ">{rows.length} รายการ</IconRow>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => open.dialog({ kind: "accountForm", code })}>แก้ไขชื่อบัญชี</Button>
        <Button variant="secondary" icon={<FileDown size={14} />} onClick={exportLedger}>ส่งออก Excel</Button>
      </div>

      <table className="w-full text-[13px]">
        <thead className={THEAD}>
          <tr>
            <th className="px-3 py-2.5 font-medium">เลขที่</th>
            <th className="px-3 py-2.5 font-medium">วันที่</th>
            <th className="px-3 py-2.5 font-medium">คำอธิบาย</th>
            <th className="px-3 py-2.5 text-right font-medium">เดบิต</th>
            <th className="px-3 py-2.5 text-right font-medium">เครดิต</th>
            <th className="px-3 py-2.5 text-right font-medium">ยอดสะสม</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map(({ entry: e, amount, running }) => (
            <tr
              key={e.no}
              onClick={() => open.dialog({ kind: "entry", no: e.no })}
              className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
            >
              <td className="px-3 py-2 font-mono text-[11.5px] text-slate-500 dark:text-slate-400">{e.no}</td>
              <td className="px-3 py-2 tabular-nums text-slate-500 dark:text-slate-400">{e.date}</td>
              <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{e.memo}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{amount > 0 ? baht(amount) : "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{amount < 0 ? baht(-amount) : "—"}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900 dark:text-slate-50">{baht(running)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-10 text-center text-slate-400">ยังไม่มีรายการที่ผ่านแล้วในบัญชีนี้</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AssetRecord({ code, open }: { code: string; open: Open }) {
  useData();
  const a = asset(code);
  const acc = accumulated(a);
  const held = monthsHeld(a);
  const life = a.lifeYears * 12;
  const sold = activeDisposal(a);
  const status = assetStatus(a);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="รหัสสินทรัพย์">{a.code}</IconRow>
        <IconRow icon={<CalendarClock size={14} />} label="วันที่ได้มา">{a.acquired}</IconRow>
        <IconRow icon={<Landmark size={14} />} label="ราคาทุน">{baht(a.cost)}</IconRow>
        <IconRow icon={<Layers size={14} />} label="อายุการใช้งาน">{a.lifeYears} ปี ({life} เดือน) · ราคาซาก {baht(a.salvage)}</IconRow>
        <IconRow icon={<TrendingDown size={14} />} label="ค่าเสื่อมต่อเดือน">{baht(monthlyDepreciation(a))}</IconRow>
        <IconRow icon={<BookOpen size={14} />} label="ใบสำคัญ">
          {a.jv ? (
            <button onClick={() => open.dialog({ kind: "entry", no: a.jv! })} className="text-violet-700 hover:underline dark:text-violet-300">{a.jv}</button>
          ) : (
            "ยกมาพร้อมยอดต้นงวด"
          )}
        </IconRow>
      </div>

      <Progress done={Math.min(held, life)} total={life} label={`ตัดค่าเสื่อมไปแล้ว ${Math.min(held, life)} จาก ${life} เดือน`} />

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "ค่าเสื่อมสะสม", value: baht(acc) },
          { label: "มูลค่าคงเหลือตามบัญชี", value: sold ? "—" : baht(a.cost - acc) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
          </div>
        ))}
      </div>

      {sold ? (
        <Note tone="bad">
          จำหน่ายเมื่อ {sold.date} ({sold.reason}) ราคาขาย {satang(sold.price)} มูลค่าตามบัญชี {satang(sold.bookValue)}{" "}
          {sold.gain >= 0 ? "กำไร" : "ขาดทุน"} {satang(Math.abs(sold.gain))} · ใบสำคัญ{" "}
          <button onClick={() => open.dialog({ kind: "entry", no: sold.jv })} className="underline">{sold.jv}</button>
        </Note>
      ) : (
        <Note tone={status === "ตัดค่าเสื่อมครบแล้ว" ? "idle" : "ok"}>
          {status === "ตัดค่าเสื่อมครบแล้ว"
            ? "ตัดค่าเสื่อมราคาครบอายุการใช้งานแล้ว เหลือเท่าราคาซาก"
            : `คิดด้วยวิธีเส้นตรงเดือนละ ${baht(monthlyDepreciation(a))} ค่าเสื่อมสะสมนับถึง ${depreciatedThrough()}`}
        </Note>
      )}

      {!sold && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => open.dialog({ kind: "assetForm", code })}>
            แก้ไข{canChangeDepreciation(a) ? "" : "ชื่อ"}
          </Button>
          <Button variant="danger" icon={<Ban size={14} />} onClick={() => open.confirm({ kind: "dispose", code })}>จำหน่าย / ขาย</Button>
        </div>
      )}
    </div>
  );
}

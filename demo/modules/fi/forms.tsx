import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  ACCOUNTS, ACCOUNT_TYPES, PAY_METHODS, TODAY, TYPE_DIGIT, VAT_RATE, VENDORS, WHT_RATES, account, addAccount,
  asset, billAccounts, canChangeDepreciation, createJournal, createServiceBill, deleteJournalDraft,
  depreciationPreview, disposalPreview, disposeAsset, earliestAcquisition, entryByNo, entryTotal,
  monthlyDepreciation, nextAccountCode, nextAssetCode, nextBillNo, nextJournalNo, nextPaymentNo,
  payable, postJournal, receivable, recordPayment, registerAsset, renameAccount, reverseJournal,
  reversalBlocker, runDepreciation, satang, thaiMonth, updateAsset, updateJournalDraft, withholding,
} from "./data";
import type {
  Account, AccountType, Asset, JournalEntry, JournalLine, PayMethod, Payment,
} from "./data";
import { cancelPayment as cancelSalesPayment, paymentErrors, recordPayment as receiveSalesPayment } from "../sd/data";
import { Badge, Button, FIELD, Note, SURFACE } from "../ui";
import { ConfirmDialog, Field, notify } from "../kit";

/**
 * Every form that changes the books. Each one checks what it can before saving,
 * shows the posting it is about to make, and leaves the rule itself to the data
 * function it calls — the screen and the test hold the same rule.
 */

const input = (error?: string) => FIELD + " w-full " + (error ? "border-rose-400 dark:border-rose-500" : "");
const num = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/,/g, "")));
const later = (a: string, b: string) => (a > b ? a : b);

/** A native select for value ≠ label — the kit's Select shows its values as they are. */
function Choice({
  value,
  onChange,
  options,
  disabled,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  error?: string;
}) {
  return (
    <span className="relative block">
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={input(error) + " appearance-none pr-8 disabled:opacity-60"}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </span>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded accent-violet-600" />
      {children}
    </label>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">{children}</div>;
}

/** The posting a form is about to make, shown before it is made. */
function PostingPreview({ lines }: { lines: JournalLine[] }) {
  return (
    <div className={"overflow-hidden " + SURFACE}>
      <p className="border-b border-slate-100 px-3 py-2 text-[11.5px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
        รายการที่จะลงบัญชี
      </p>
      <table className="w-full text-[12.5px]">
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {lines.filter((l) => l.amount !== 0).map((l, i) => (
            <tr key={i}>
              <td className="px-3 py-1.5 font-mono text-[11.5px] text-slate-400">{l.account}</td>
              <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">{account(l.account).name}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{l.amount > 0 ? satang(l.amount) : ""}</td>
              <td className="px-3 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{l.amount < 0 ? satang(-l.amount) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PAY_OPTIONS = PAY_METHODS.map((m) => ({ value: m, label: m }));
const WHT_OPTIONS = WHT_RATES.map((w) => ({ value: String(w.rate), label: w.label }));

/* ------------------------------------------------------- journal voucher */

type DraftLine = { key: number; account: string; note: string; debit: string; credit: string };
let lineSeq = 0;
const blankLine = (): DraftLine => ({ key: ++lineSeq, account: "", note: "", debit: "", credit: "" });
const fromLine = (l: JournalLine): DraftLine => ({
  key: ++lineSeq, account: l.account, note: l.note ?? "",
  debit: l.amount > 0 ? String(l.amount) : "", credit: l.amount < 0 ? String(-l.amount) : "",
});
const amountOf = (l: DraftLine) => (num(l.debit) || 0) - (num(l.credit) || 0);

/**
 * The debit/credit editor. Typing on one side clears the other, because a line
 * is a debit or a credit, never both; the totals and the difference sit under
 * the lines so the person sees it balance before they press anything.
 */
function JournalLines({ lines, onChange, error }: { lines: DraftLine[]; onChange: (l: DraftLine[]) => void; error?: string }) {
  const update = (key: number, patch: Partial<DraftLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const debit = lines.reduce((n, l) => n + (num(l.debit) || 0), 0);
  const credit = lines.reduce((n, l) => n + (num(l.credit) || 0), 0);
  const diff = Math.round((debit - credit) * 100) / 100;
  const cell = FIELD + " w-full py-2";
  const options = [{ value: "", label: "เลือกบัญชี…" }, ...ACCOUNTS.map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` }))];

  return (
    <div className={"overflow-hidden " + SURFACE}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-[11.5px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <th className="w-8 px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">บัญชี</th>
              <th className="px-3 py-2.5">คำอธิบายบรรทัด</th>
              <th className="w-32 px-3 py-2.5 text-right">เดบิต</th>
              <th className="w-32 px-3 py-2.5 text-right">เครดิต</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.key} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-3 py-2 tabular-nums text-slate-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <select value={l.account} onChange={(e) => update(l.key, { account: e.target.value })} className={cell} aria-label={`บัญชีบรรทัดที่ ${i + 1}`}>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input value={l.note} onChange={(e) => update(l.key, { note: e.target.value })} className={cell} aria-label={`คำอธิบายบรรทัดที่ ${i + 1}`} />
                </td>
                <td className="px-3 py-2">
                  <input
                    inputMode="decimal"
                    value={l.debit}
                    onChange={(e) => update(l.key, { debit: e.target.value, credit: e.target.value ? "" : l.credit })}
                    className={cell + " text-right tabular-nums"}
                    aria-label={`เดบิตบรรทัดที่ ${i + 1}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    inputMode="decimal"
                    value={l.credit}
                    onChange={(e) => update(l.key, { credit: e.target.value, debit: e.target.value ? "" : l.debit })}
                    className={cell + " text-right tabular-nums"}
                    aria-label={`เครดิตบรรทัดที่ ${i + 1}`}
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
                    disabled={lines.length <= 2}
                    aria-label={`ลบบรรทัดที่ ${i + 1}`}
                    className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 border-t border-slate-100 px-3 py-3 dark:border-slate-800">
        <div>
          <Button variant="ghost" icon={<Plus size={14} />} onClick={() => onChange([...lines, blankLine()])}>
            เพิ่มบรรทัด
          </Button>
          {error && <p className="mt-1 px-1 text-[11.5px] text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
        <dl className="min-w-60 space-y-1 text-[13px]">
          <div className="flex justify-between gap-6 text-slate-500 dark:text-slate-400">
            <dt>รวมเดบิต</dt>
            <dd className="tabular-nums">{satang(debit)}</dd>
          </div>
          <div className="flex justify-between gap-6 text-slate-500 dark:text-slate-400">
            <dt>รวมเครดิต</dt>
            <dd className="tabular-nums">{satang(credit)}</dd>
          </div>
          <div className="flex items-center justify-between gap-6 border-t border-slate-100 pt-1.5 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50">
            <dt>ผลต่าง</dt>
            <dd className="flex items-center gap-2 tabular-nums">
              {satang(Math.abs(diff))}
              <Badge tone={diff === 0 && debit > 0 ? "ok" : "bad"} dot>{diff === 0 && debit > 0 ? "ลงตัว" : "ไม่ลงตัว"}</Badge>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

/** Create a general journal voucher, or edit a draft one. */
export function JournalForm({
  draft,
  onDone,
  onCancel,
}: {
  draft?: JournalEntry;
  onDone: (e: JournalEntry) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(draft?.date ?? TODAY);
  const [memo, setMemo] = useState(draft?.memo ?? "");
  const [ref, setRef] = useState(draft?.ref ?? "");
  const [lines, setLines] = useState<DraftLine[]>(draft ? draft.lines.map(fromLine) : [blankLine(), blankLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const check = (post: boolean) => {
    const e: Record<string, string> = {};
    if (!date) e.date = "ระบุวันที่";
    if (memo.trim().length < 3) e.memo = "อธิบายว่ารายการนี้คืออะไร";
    const used = lines.filter((l) => l.account || l.debit || l.credit);
    const bad = used.findIndex((l) => !l.account || !(Math.abs(amountOf(l)) > 0) || Number.isNaN(num(l.debit || l.credit)));
    const sum = Math.round(used.reduce((n, l) => n + amountOf(l), 0) * 100) / 100;
    if (used.length < 2) e.lines = "ต้องมีอย่างน้อยสองบรรทัดที่มีบัญชีและจำนวนเงิน";
    else if (bad >= 0) e.lines = `บรรทัดที่ ${lines.indexOf(used[bad]) + 1} ต้องเลือกบัญชีและใส่จำนวนเงินด้านใดด้านหนึ่ง`;
    else if (!used.some((l) => amountOf(l) > 0) || !used.some((l) => amountOf(l) < 0)) e.lines = "ต้องมีทั้งด้านเดบิตและด้านเครดิต";
    else if (post && sum !== 0) e.lines = `เดบิตไม่เท่าเครดิต ต่างกัน ${satang(Math.abs(sum))} บันทึกเป็นร่างได้ แต่ผ่านรายการไม่ได้`;
    setErrors(e);
    return Object.keys(e).length === 0 ? used : null;
  };

  const save = (post: boolean) => {
    const used = check(post);
    if (!used) return;
    const input = { date, memo, ref, lines: used.map((l) => ({ account: l.account, amount: amountOf(l), note: l.note })) };
    let saved: JournalEntry;
    if (draft) {
      saved = updateJournalDraft(draft.no, input);
      if (post) saved = postJournal(draft.no);
    } else {
      saved = createJournal(input, post);
    }
    notify(post ? `ผ่านรายการใบสำคัญ ${saved.no} แล้ว` : `บันทึกร่างใบสำคัญ ${saved.no} แล้ว`);
    onDone(saved);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_12rem]">
        <Field label="วันที่" error={errors.date}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input(errors.date)} />
        </Field>
        <Field label="คำอธิบายรายการ" error={errors.memo}>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="เช่น ปรับปรุงค่าใช้จ่ายค้างจ่ายสิ้นเดือน" className={input(errors.memo)} />
        </Field>
        <Field label="เอกสารอ้างอิง" hint="ไม่บังคับ">
          <input value={ref} onChange={(e) => setRef(e.target.value)} className={input()} />
        </Field>
      </div>
      <JournalLines lines={lines} onChange={setLines} error={errors.lines} />
      <Note tone="idle">
        เลขที่ {draft?.no ?? nextJournalNo()} · ร่างยังไม่มีผลในบัญชีและแก้ไขได้ ใบที่ผ่านรายการแล้วแก้ไม่ได้ ต้องกลับรายการ
      </Note>
      <Footer>
        <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
        <Button variant="secondary" onClick={() => save(false)}>บันทึกร่าง</Button>
        <Button variant="primary" onClick={() => save(true)}>บันทึกและผ่านรายการ</Button>
      </Footer>
    </div>
  );
}

/* ------------------------------------------------------------ accounts */

export function AccountForm({ editing, onDone, onCancel }: { editing?: Account; onDone: (a: Account) => void; onCancel: () => void }) {
  const [type, setType] = useState<AccountType>(editing?.type ?? "ค่าใช้จ่าย");
  const [code, setCode] = useState(editing?.code ?? nextAccountCode("ค่าใช้จ่าย"));
  const [name, setName] = useState(editing?.name ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const e: Record<string, string> = {};
    if (!editing) {
      if (!/^\d{4}$/.test(code)) e.code = "ตัวเลขสี่หลัก";
      else if (!code.startsWith(TYPE_DIGIT[type])) e.code = `หมวด${type}ขึ้นต้นด้วยเลข ${TYPE_DIGIT[type]}`;
      else if (ACCOUNTS.some((a) => a.code === code)) e.code = "รหัสนี้มีอยู่แล้ว";
    }
    if (name.trim().length < 2) e.name = "ตั้งชื่อบัญชี";
    else if (ACCOUNTS.some((a) => a.name === name.trim() && a.code !== editing?.code)) e.name = "ชื่อนี้มีอยู่แล้วในผังบัญชี";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (editing) {
      renameAccount(editing.code, name);
      notify(`แก้ชื่อบัญชี ${editing.code} แล้ว`);
      onDone(account(editing.code));
    } else {
      const a = addAccount({ code, name, type });
      notify(`เพิ่มบัญชี ${a.code} ${a.name} ในผังบัญชีแล้ว`);
      onDone(a);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="หมวดบัญชี" hint={editing ? "หมวดผูกกับรหัส เปลี่ยนไม่ได้" : undefined}>
          <Choice
            value={type}
            disabled={Boolean(editing)}
            onChange={(v) => {
              setType(v as AccountType);
              setCode(nextAccountCode(v as AccountType));
            }}
            options={ACCOUNT_TYPES.map((t) => ({ value: t, label: `${TYPE_DIGIT[t]} · ${t}` }))}
          />
        </Field>
        <Field label="รหัสบัญชี" error={errors.code} hint={editing ? "รหัสมีรายการผูกอยู่ เปลี่ยนไม่ได้" : "ระบบเสนอรหัสว่างถัดไปในหมวด"}>
          <input value={code} disabled={Boolean(editing)} onChange={(e) => setCode(e.target.value)} className={input(errors.code) + " disabled:opacity-60"} />
        </Field>
      </div>
      <Field label="ชื่อบัญชี" error={errors.name}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ค่าขนส่งสินค้าขาย" className={input(errors.name)} />
      </Field>
      <Footer>
        <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
        <Button variant="primary" onClick={save}>{editing ? "บันทึกชื่อบัญชี" : "เพิ่มบัญชี"}</Button>
      </Footer>
    </div>
  );
}

/* ---------------------------------------------------------- service bill */

export function ServiceBillForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [vendor, setVendor] = useState(VENDORS[0].code);
  const [vendorInvoice, setVendorInvoice] = useState("");
  const [date, setDate] = useState(TODAY);
  const [description, setDescription] = useState("");
  const [acct, setAcct] = useState("5310");
  const [base, setBase] = useState("");
  const [withVat, setWithVat] = useState(true);
  const [whtRate, setWhtRate] = useState(0.03);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const amount = num(base);
  const vat = withVat && amount > 0 ? Math.round(amount * VAT_RATE * 100) / 100 : 0;
  const gross = (amount > 0 ? amount : 0) + vat;

  const save = () => {
    const e: Record<string, string> = {};
    if (vendorInvoice.trim().length < 2) e.vendorInvoice = "ใส่เลขที่ตามใบแจ้งหนี้ของผู้ขาย";
    if (!date) e.date = "ระบุวันที่";
    if (description.trim().length < 3) e.description = "ระบุว่าเป็นค่าอะไร";
    if (!(amount > 0)) e.base = "ใส่ยอดก่อนภาษีมากกว่าศูนย์";
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      const b = createServiceBill({ date, vendor, vendorInvoice, description, account: acct, base: amount, withVat, whtRate });
      notify(`ตั้งหนี้ ${b.no} (${b.vendorInvoice}) แล้ว`);
      onDone();
    } catch (err) {
      setErrors({ vendorInvoice: (err as Error).message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="ผู้ขาย" hint="อ่านจากแฟ้มผู้ขายของฝ่ายจัดซื้อ">
          <Choice value={vendor} onChange={setVendor} options={VENDORS.map((v) => ({ value: v.code, label: v.name }))} />
        </Field>
        <Field label="เลขที่ใบแจ้งหนี้ของผู้ขาย" error={errors.vendorInvoice}>
          <input value={vendorInvoice} onChange={(e) => setVendorInvoice(e.target.value)} className={input(errors.vendorInvoice)} />
        </Field>
        <Field label="วันที่ใบแจ้งหนี้" error={errors.date}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input(errors.date)} />
        </Field>
        <Field label="ลงบัญชี">
          <Choice value={acct} onChange={setAcct} options={billAccounts().map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` }))} />
        </Field>
      </div>
      <Field label="รายการ" error={errors.description}>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="เช่น ค่าซ่อมบำรุงเครื่องตัดเหล็ก" className={input(errors.description)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ยอดก่อนภาษีมูลค่าเพิ่ม (บาท)" error={errors.base}>
          <input inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} className={input(errors.base) + " text-right tabular-nums"} />
        </Field>
        <Field label="หัก ณ ที่จ่ายตอนจ่ายเงิน" hint="ค่าบริการและค่าจ้างทำของหัก 3%">
          <Choice value={String(whtRate)} onChange={(v) => setWhtRate(Number(v))} options={WHT_OPTIONS} />
        </Field>
      </div>
      <Check checked={withVat} onChange={setWithVat}>มีใบกำกับภาษี — ภาษีซื้อ 7% {satang(vat)}</Check>
      <PostingPreview
        lines={[
          { account: acct, amount: amount > 0 ? amount : 0 },
          { account: "1120", amount: vat },
          { account: "2010", amount: -gross },
        ]}
      />
      <Note tone="idle">เลขที่ {nextBillNo()} · ยอดตั้งหนี้ {satang(gross)} ภาษีหัก ณ ที่จ่ายหักตอนจ่ายเงิน ไม่ใช่ตอนตั้งหนี้</Note>
      <Footer>
        <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
        <Button variant="primary" onClick={save}>ตั้งหนี้</Button>
      </Footer>
    </div>
  );
}

/* --------------------------------------------------------------- payment */

export function PaymentForm({ invoice, onDone, onCancel }: { invoice: string; onDone: (p: Payment) => void; onCancel: () => void }) {
  const doc = payable(invoice);
  const [date, setDate] = useState(later(TODAY, doc.date));
  const [settle, setSettle] = useState(String(doc.open));
  const [whtRate, setWhtRate] = useState(doc.whtRate);
  const [method, setMethod] = useState<PayMethod>("โอนเงิน");
  const [bankRef, setBankRef] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const amount = num(settle);
  const w = withholding(amount > 0 ? amount : 0, doc, whtRate);

  const save = () => {
    const e: Record<string, string> = {};
    if (!date || date < doc.date) e.date = "ต้องไม่ก่อนวันที่ใบแจ้งหนี้ " + doc.date;
    if (!(amount > 0)) e.settle = "ใส่ยอดที่จ่ายมากกว่าศูนย์";
    else if (amount > doc.open + 0.004) e.settle = `เกินยอดค้าง ${satang(doc.open)}`;
    if (method === "เช็ค" && !bankRef.trim()) e.bankRef = "ใส่เลขที่เช็ค";
    setErrors(e);
    if (Object.keys(e).length) return;
    const p = recordPayment({ invoice, date, settle: amount, whtRate, method, bankRef });
    notify(`บันทึกใบสำคัญจ่าย ${p.no} ชำระ ${invoice} แล้ว`);
    onDone(p);
  };

  return (
    <div className="space-y-4">
      <div className={"grid grid-cols-3 gap-3 p-3 text-[12.5px] " + SURFACE}>
        <div><p className="text-slate-500 dark:text-slate-400">ผู้ขาย</p><p className="font-medium text-slate-900 dark:text-slate-50">{doc.vendorName}</p></div>
        <div><p className="text-slate-500 dark:text-slate-400">ยอดตามใบ · ครบกำหนด</p><p className="tabular-nums text-slate-900 dark:text-slate-50">{satang(doc.amount)} · {doc.due}</p></div>
        <div><p className="text-slate-500 dark:text-slate-400">คงค้าง</p><p className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{satang(doc.open)}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="วันที่จ่าย" error={errors.date}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input(errors.date)} />
        </Field>
        <Field label="ยอดตัดหนี้ครั้งนี้ (รวม VAT)" error={errors.settle} hint="จ่ายบางส่วนได้ ใบนี้จะค้างส่วนที่เหลือไว้">
          <input inputMode="decimal" value={settle} onChange={(e) => setSettle(e.target.value)} className={input(errors.settle) + " text-right tabular-nums"} />
        </Field>
        <Field label="ภาษีหัก ณ ที่จ่าย" hint={doc.source === "ใบแจ้งหนี้ซื้อสินค้า" ? "ซื้อสินค้าไม่ต้องหัก" : "ตั้งไว้ตอนตั้งหนี้ เปลี่ยนได้"}>
          <Choice value={String(whtRate)} onChange={(v) => setWhtRate(Number(v))} options={WHT_OPTIONS} />
        </Field>
        <Field label="วิธีจ่าย">
          <Choice value={method} onChange={(v) => setMethod(v as PayMethod)} options={PAY_OPTIONS} />
        </Field>
      </div>
      <Field label={method === "เช็ค" ? "เลขที่เช็ค" : "อ้างอิงการโอน"} error={errors.bankRef} hint={method === "เช็ค" ? undefined : "ไม่บังคับ"}>
        <input value={bankRef} onChange={(e) => setBankRef(e.target.value)} className={input(errors.bankRef)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <dl className={"space-y-1 p-3 text-[13px] " + SURFACE}>
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><dt>ฐานภาษี (ก่อน VAT)</dt><dd className="tabular-nums">{satang(w.base)}</dd></div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><dt>หัก ณ ที่จ่าย {whtRate * 100}%</dt><dd className="tabular-nums">{satang(w.wht)}</dd></div>
          <div className="flex justify-between border-t border-slate-100 pt-1.5 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50"><dt>จ่ายสุทธิ</dt><dd className="tabular-nums">{satang(w.net)}</dd></div>
        </dl>
        <PostingPreview lines={[{ account: "2010", amount: amount > 0 ? amount : 0 }, { account: "1010", amount: -w.net }, { account: "2120", amount: -w.wht }]} />
      </div>
      {doc.blocked && <Note tone="bad">ฝ่ายจัดซื้อระงับการจ่ายใบนี้: {doc.blocked}</Note>}
      <Note tone="idle">เลขที่ {nextPaymentNo()}{w.wht > 0 ? " · ออกหนังสือรับรองการหักภาษี ณ ที่จ่ายให้ผู้ขายได้ทันทีหลังบันทึก" : ""}</Note>
      <Footer>
        <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
        <Button variant="primary" onClick={save} disabled={Boolean(doc.blocked)}>บันทึกการจ่าย</Button>
      </Footer>
    </div>
  );
}

/* --------------------------------------------------------------- receipt */

/**
 * รับชำระตามใบกำกับของฝ่ายขาย. ใบเสร็จมีที่เดียวคือในระบบขาย บันทึกที่นี่หรือที่หน้าขาย
 * ก็เป็นใบเดียวกัน รับได้ครั้งเดียวเต็มยอดคงค้าง ลูกค้าหัก ณ ที่จ่ายไว้เท่าไรเงินเข้าก็น้อยลงเท่านั้น
 */
export function ReceiptForm({ invoice, onDone, onCancel }: { invoice: string; onDone: (receiptNo: string) => void; onCancel: () => void }) {
  const doc = receivable(invoice);
  const [date, setDate] = useState(later(TODAY, doc.date));
  const [whtRate, setWhtRate] = useState(0);
  const [method, setMethod] = useState<string>("โอนเงิน");
  const [ref, setRef] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ฐานภาษีคือยอดก่อน VAT ที่ยังค้างอยู่ หลังหักใบลดหนี้
  const base = Math.round(doc.open * (doc.net / doc.amount) * 100) / 100;
  const wht = Math.round(base * whtRate * 100) / 100;
  const cash = Math.round((doc.open - wht) * 100) / 100;

  const save = () => {
    const input = { date, method, ref, wht };
    const e = paymentErrors(invoice, input);
    setErrors(e);
    if (Object.keys(e).length) return;
    const r = receiveSalesPayment(invoice, input);
    notify(`ออกใบเสร็จรับเงิน ${r.no} สำหรับ ${invoice} แล้ว`);
    onDone(r.no);
  };

  return (
    <div className="space-y-4">
      <div className={"grid grid-cols-3 gap-3 p-3 text-[12.5px] " + SURFACE}>
        <div><p className="text-slate-500 dark:text-slate-400">ลูกค้า</p><p className="font-medium text-slate-900 dark:text-slate-50">{doc.customerName}</p></div>
        <div><p className="text-slate-500 dark:text-slate-400">ยอดตามใบ{doc.credited ? " หักลดหนี้" : ""}</p><p className="tabular-nums text-slate-900 dark:text-slate-50">{satang(doc.amount)}{doc.credited ? ` − ${satang(doc.credited)}` : ""}</p></div>
        <div><p className="text-slate-500 dark:text-slate-400">ยอดที่ต้องรับ</p><p className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{satang(doc.open)}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="วันที่รับเงิน" error={errors.date}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input(errors.date)} />
        </Field>
        <Field label="ลูกค้าหัก ณ ที่จ่าย" error={errors.wht} hint="ถ้าลูกค้าหักไว้ จะได้หนังสือรับรอง 50 ทวิ มาแทนเงินส่วนนั้น">
          <Choice value={String(whtRate)} onChange={(v) => setWhtRate(Number(v))} options={WHT_OPTIONS} />
        </Field>
        <Field label="วิธีรับ" error={errors.method}>
          <Choice value={method} onChange={setMethod} options={PAY_OPTIONS} />
        </Field>
        <Field label={method === "เช็ค" ? "เลขที่เช็คและธนาคาร" : "อ้างอิงการโอน"} error={errors.ref} hint={method === "เงินสด" ? "ไม่บังคับ" : undefined}>
          <input value={ref} onChange={(e) => setRef(e.target.value)} className={input(errors.ref)} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <dl className={"space-y-1 p-3 text-[13px] " + SURFACE}>
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><dt>ตัดลูกหนี้</dt><dd className="tabular-nums">{satang(doc.open)}</dd></div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400"><dt>ถูกหัก ณ ที่จ่าย {whtRate * 100}%</dt><dd className="tabular-nums">{satang(wht)}</dd></div>
          <div className="flex justify-between border-t border-slate-100 pt-1.5 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-50"><dt>รับเงินสุทธิ</dt><dd className="tabular-nums">{satang(cash)}</dd></div>
        </dl>
        <PostingPreview lines={[{ account: "1010", amount: cash }, { account: "1130", amount: wht }, { account: "1110", amount: -doc.open }]} />
      </div>
      <Note tone="idle">ใบกำกับหนึ่งใบรับชำระครั้งเดียวเต็มยอด ใบเสร็จออกเลขต่อจากเล่มของฝ่ายขาย และเห็นทั้งในระบบขายและบัญชี</Note>
      <Footer>
        <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
        <Button variant="primary" onClick={save}>ออกใบเสร็จรับเงิน</Button>
      </Footer>
    </div>
  );
}

/** Cancel a sales receipt — a bounced cheque, the wrong invoice. The sales module owns it. */
export function CancelReceiptDialog({ invoice, onCancel, onDone }: { invoice: string | null; onCancel: () => void; onDone: () => void }) {
  const doc = invoice ? receivable(invoice) : null;
  const [reason, setReason] = useState("");
  const ready = reason.trim().length >= 5 && Boolean(doc?.receipt);
  return (
    <ConfirmDialog
      open={doc !== null}
      title="ยกเลิกใบเสร็จรับเงิน"
      body="ใบกำกับกลับเป็นค้างชำระ ใบเสร็จเดิมเก็บไว้พร้อมเหตุผลและเลขไม่ถูกนำกลับมาใช้ บัญชีลงรายการกลับให้อัตโนมัติ"
      confirmLabel="ยกเลิกใบเสร็จ"
      disabled={!ready}
      onCancel={onCancel}
      onConfirm={() => {
        if (!doc?.receipt || !ready) return;
        const v = cancelSalesPayment(doc.invoice, reason);
        notify(`ยกเลิกใบเสร็จ ${v.no} ของ ${doc.invoice} แล้ว`);
        onDone();
      }}
      subject={
        doc?.receipt && (
          <div className={"p-3 text-[12.5px] " + SURFACE}>
            <p className="font-semibold text-slate-900 dark:text-slate-50">{doc.receipt.no} · {doc.receipt.date}</p>
            <p className="text-slate-600 dark:text-slate-300">{doc.invoice} · {doc.customerName}</p>
            <p className="mt-1 tabular-nums text-slate-500 dark:text-slate-400">รับเงิน {satang(doc.receipt.amount)}{doc.receipt.wht ? ` · หัก ณ ที่จ่าย ${satang(doc.receipt.wht)}` : ""}</p>
          </div>
        )
      }
      fields={
        <Field label="เหตุผล" error={reason && reason.trim().length < 5 ? "อย่างน้อย 5 ตัวอักษร" : undefined}>
          <input autoFocus value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="เช่น เช็คคืน ธนาคารแจ้งเงินไม่พอจ่าย" className={input()} />
        </Field>
      }
    />
  );
}

/* ----------------------------------------------------------------- assets */

export function AssetForm({ editing, onDone, onCancel }: { editing?: Asset; onDone: (a: Asset) => void; onCancel: () => void }) {
  const [name, setName] = useState(editing?.name ?? "");
  const [cost, setCost] = useState(editing ? String(editing.cost) : "");
  const [acquired, setAcquired] = useState(editing?.acquired ?? later(TODAY, earliestAcquisition()));
  const [life, setLife] = useState(editing ? String(editing.lifeYears) : "5");
  const [salvage, setSalvage] = useState(editing ? String(editing.salvage) : "1");
  const [withVat, setWithVat] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const locked = editing !== undefined && !canChangeDepreciation(editing);

  const c = editing ? editing.cost : num(cost);
  const years = num(life);
  const s = num(salvage);
  const preview =
    c > 0 && Number.isInteger(years) && years > 0 && s >= 0 && s < c
      ? monthlyDepreciation({ code: "", name, cost: c, lifeYears: years, acquired, salvage: s })
      : 0;

  const save = () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "ตั้งชื่อสินทรัพย์";
    if (!editing) {
      if (!(c > 0)) e.cost = "ราคาทุนต้องมากกว่าศูนย์";
      if (!acquired) e.acquired = "ระบุวันที่ได้มา";
      else if (acquired < earliestAcquisition()) e.acquired = `งวดก่อน ${earliestAcquisition()} ตัดค่าเสื่อมไปแล้ว`;
    }
    if (!Number.isInteger(years) || years < 1 || years > 50) e.life = "จำนวนปีเต็ม 1–50";
    if (!(s >= 0) || s >= c) e.salvage = "ไม่ติดลบและน้อยกว่าราคาทุน";
    setErrors(e);
    if (Object.keys(e).length) return;
    if (editing) {
      updateAsset(editing.code, { name, lifeYears: years, salvage: s });
      notify(`แก้ข้อมูลสินทรัพย์ ${editing.code} แล้ว`);
      onDone(editing);
    } else {
      const a = registerAsset({ name, cost: c, acquired, lifeYears: years, salvage: s, withVat });
      notify(`ลงทะเบียนสินทรัพย์ ${a.code} ${a.name} แล้ว (ใบสำคัญ ${a.jv})`);
      onDone(a);
    }
  };

  const vat = !editing && withVat && c > 0 ? Math.round(c * VAT_RATE * 100) / 100 : 0;

  return (
    <div className="space-y-4">
      <Field label="ชื่อสินทรัพย์" error={errors.name}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น เครื่องเชื่อมไฟฟ้า MIG 250A" className={input(errors.name)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ราคาทุน ก่อนภาษี (บาท)" error={errors.cost} hint={editing ? "ราคาทุนลงบัญชีไปแล้ว เปลี่ยนไม่ได้" : undefined}>
          <input inputMode="decimal" value={cost} disabled={Boolean(editing)} onChange={(e) => setCost(e.target.value)} className={input(errors.cost) + " text-right tabular-nums disabled:opacity-60"} />
        </Field>
        <Field label="วันที่ได้มา" error={errors.acquired} hint="เริ่มคิดค่าเสื่อมเดือนถัดไป">
          <input type="date" value={acquired} disabled={Boolean(editing)} onChange={(e) => setAcquired(e.target.value)} className={input(errors.acquired) + " disabled:opacity-60"} />
        </Field>
        <Field label="อายุการใช้งาน (ปี)" error={errors.life} hint={locked ? "ตัดค่าเสื่อมไปแล้ว เปลี่ยนไม่ได้" : undefined}>
          <input inputMode="numeric" value={life} disabled={locked} onChange={(e) => setLife(e.target.value)} className={input(errors.life) + " text-right tabular-nums disabled:opacity-60"} />
        </Field>
        <Field label="ราคาซาก (บาท)" error={errors.salvage} hint={locked ? "ตัดค่าเสื่อมไปแล้ว เปลี่ยนไม่ได้" : "นิยมตั้ง 1 บาท ให้ยังอยู่ในทะเบียนเมื่อตัดครบ"}>
          <input inputMode="decimal" value={salvage} disabled={locked} onChange={(e) => setSalvage(e.target.value)} className={input(errors.salvage) + " text-right tabular-nums disabled:opacity-60"} />
        </Field>
      </div>
      {!editing && <Check checked={withVat} onChange={setWithVat}>ซื้อพร้อมใบกำกับภาษี — ภาษีซื้อ 7% {satang(vat)}</Check>}
      <Note tone="accent">ค่าเสื่อมราคาวิธีเส้นตรงเดือนละ {satang(preview)} = (ราคาทุน − ราคาซาก) ÷ อายุ ÷ 12</Note>
      {!editing && (
        <PostingPreview lines={[{ account: "1310", amount: c > 0 ? c : 0 }, { account: "1120", amount: vat }, { account: "1010", amount: -((c > 0 ? c : 0) + vat) }]} />
      )}
      <Footer>
        <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
        <Button variant="primary" onClick={save}>{editing ? "บันทึกการแก้ไข" : `ลงทะเบียน ${nextAssetCode()}`}</Button>
      </Footer>
    </div>
  );
}

export function DepreciationForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const p = depreciationPreview();
  const save = () => {
    const run = runDepreciation();
    notify(`บันทึกค่าเสื่อมราคางวด ${thaiMonth(run.period)} ด้วยใบสำคัญ ${run.jv} แล้ว`);
    onDone();
  };
  return (
    <div className="space-y-4">
      <div className={"overflow-hidden " + SURFACE}>
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2.5 font-medium">สินทรัพย์</th>
              <th className="px-3 py-2.5 text-right font-medium">ค่าเสื่อมงวดนี้</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {p.lines.map((l) => (
              <tr key={l.asset}>
                <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                  <span className="mr-2 font-mono text-[11.5px] text-slate-400">{l.asset}</span>
                  {asset(l.asset).name}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-50">{satang(l.amount)}</td>
              </tr>
            ))}
            {p.lines.length === 0 && (
              <tr><td colSpan={2} className="px-3 py-8 text-center text-slate-400">ไม่มีสินทรัพย์ที่ต้องตัดค่าเสื่อมในงวดนี้</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <PostingPreview lines={[{ account: "5210", amount: p.total }, { account: "1319", amount: -p.total }]} />
      <Note tone="idle">
        ลงวันที่ {p.date} ด้วยใบสำคัญ {nextJournalNo()} · ตัดได้ทีละงวดต่อจากงวดล่าสุด ถ้าตัดผิดให้กลับรายการใบสำคัญของงวดนั้นแล้วตัดใหม่
      </Note>
      <Footer>
        <Button variant="secondary" onClick={onCancel}>ยกเลิก</Button>
        <Button variant="primary" onClick={save} disabled={p.total <= 0}>บันทึกค่าเสื่อมราคา {satang(p.total)}</Button>
      </Footer>
    </div>
  );
}

/* ---------------------------------------------------------------- confirms */

const PAYMENT_OR_RECEIPT = (no: string) =>
  no.startsWith("PV-") ? "ใบสำคัญจ่าย" : no.startsWith("AP-") ? "ใบตั้งหนี้" : null;

/** Reverse a posted voucher — which is also how a payment, receipt or bill is cancelled. */
export function ReverseDialog({ no, onCancel, onDone }: { no: string | null; onCancel: () => void; onDone: () => void }) {
  const e = no ? entryByNo(no) : null;
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(e ? later(TODAY, e.date) : TODAY);
  const blocker = no ? reversalBlocker(no) : null;
  const doc = no ? PAYMENT_OR_RECEIPT(no) : null;
  const ready = reason.trim().length >= 3 && e !== null && date >= e.date && !blocker;

  return (
    <ConfirmDialog
      open={e !== null}
      title={doc ? `ยกเลิก${doc}` : "กลับรายการใบสำคัญ"}
      body={
        doc
          ? `ระบบออกใบสำคัญกลับรายการให้ ${doc}ใบเดิมยังอยู่พร้อมตรายกเลิกและเหตุผล ยอดที่ตัดไว้จะกลับมาค้างเหมือนเดิม`
          : "ใบสำคัญที่ผ่านรายการแล้วแก้ไม่ได้ ระบบออกใบใหม่ที่เดบิตเครดิตสลับกัน ใบเดิมยังอยู่ให้ตรวจย้อนได้"
      }
      confirmLabel={doc ? `ยกเลิก${doc}` : "กลับรายการ"}
      disabled={!ready}
      onCancel={onCancel}
      onConfirm={() => {
        if (!e || !ready) return;
        const r = reverseJournal(e.no, reason, date);
        notify(doc ? `ยกเลิก${doc} ${e.no} แล้ว (กลับรายการด้วย ${r.no})` : `กลับรายการ ${e.no} ด้วยใบสำคัญ ${r.no} แล้ว`);
        onDone();
      }}
      subject={
        e && (
          <div className={"p-3 text-[12.5px] " + SURFACE}>
            <p className="font-semibold text-slate-900 dark:text-slate-50">{e.no} · {e.date}</p>
            <p className="text-slate-600 dark:text-slate-300">{e.memo}</p>
            <p className="mt-1 tabular-nums text-slate-500 dark:text-slate-400">ยอด {satang(entryTotal(e))}</p>
          </div>
        )
      }
      fields={
        blocker ? (
          <Note tone="bad">{blocker}</Note>
        ) : (
          <>
            <Field label="เหตุผล" error={reason && reason.trim().length < 3 ? "อธิบายสั้น ๆ ว่าทำไม" : undefined}>
              <input autoFocus value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="เช่น คีย์ยอดผิด ต้องลงใหม่" className={input()} />
            </Field>
            <Field label="วันที่กลับรายการ" error={e && date < e.date ? "ต้องไม่ก่อนวันที่ของใบเดิม" : undefined}>
              <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={input()} />
            </Field>
          </>
        )
      }
    />
  );
}

export function DeleteDraftDialog({ no, onCancel, onDone }: { no: string | null; onCancel: () => void; onDone: () => void }) {
  const e = no ? entryByNo(no) : null;
  return (
    <ConfirmDialog
      open={e !== null}
      title="ลบร่างใบสำคัญ"
      body="ร่างยังไม่เข้าบัญชี ลบแล้วไม่มีผลกับยอดใด ๆ แต่เรียกกลับมาไม่ได้"
      confirmLabel="ลบร่าง"
      onCancel={onCancel}
      onConfirm={() => {
        if (!e) return;
        deleteJournalDraft(e.no);
        notify(`ลบร่างใบสำคัญ ${e.no} แล้ว`);
        onDone();
      }}
      subject={e && <div className={"p-3 text-[12.5px] text-slate-700 dark:text-slate-200 " + SURFACE}>{e.no} · {e.memo}</div>}
    />
  );
}

const DISPOSAL_REASONS = ["ขายให้บุคคลภายนอก", "ชำรุดใช้การไม่ได้", "สูญหาย", "บริจาค"];

/** Sell or write off an asset. Irreversible except by reversing its voucher, so it is confirmed. */
export function DisposeDialog({ code, onCancel, onDone }: { code: string | null; onCancel: () => void; onDone: () => void }) {
  const a = code ? asset(code) : null;
  const [date, setDate] = useState(a ? later(TODAY, a.acquired) : TODAY);
  const [price, setPrice] = useState("0");
  const [withVat, setWithVat] = useState(true);
  const [buyer, setBuyer] = useState("");
  const [reason, setReason] = useState(DISPOSAL_REASONS[0]);
  const p = num(price);
  const preview = a && p >= 0 ? disposalPreview(a.code, p, withVat) : null;
  const ready = a !== null && p >= 0 && Boolean(date) && date >= a.acquired && (reason !== DISPOSAL_REASONS[0] || p > 0);

  return (
    <ConfirmDialog
      open={a !== null}
      title="จำหน่ายสินทรัพย์"
      body="ล้างราคาทุนและค่าเสื่อมสะสมออกจากบัญชี ส่วนต่างระหว่างราคาขายกับมูลค่าตามบัญชีเป็นกำไรหรือขาดทุน ค่าเสื่อมคิดถึงงวดล่าสุดที่บันทึกแล้ว"
      confirmLabel="บันทึกการจำหน่าย"
      disabled={!ready}
      onCancel={onCancel}
      onConfirm={() => {
        if (!a || !ready) return;
        const d = disposeAsset({ asset: a.code, date, price: p, withVat, buyer, reason });
        notify(`จำหน่าย ${a.code} ${a.name} แล้ว (ใบสำคัญ ${d.jv})`);
        onDone();
      }}
      subject={
        a && (
          <div className={"p-3 text-[12.5px] " + SURFACE}>
            <p className="font-semibold text-slate-900 dark:text-slate-50">{a.code} · {a.name}</p>
            {preview && (
              <p className="mt-1 tabular-nums text-slate-500 dark:text-slate-400">
                ราคาทุน {satang(a.cost)} · ค่าเสื่อมสะสม {satang(preview.accumulated)} · มูลค่าตามบัญชี {satang(preview.bookValue)}
              </p>
            )}
          </div>
        )
      }
      fields={
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="เหตุผล">
              <Choice value={reason} onChange={setReason} options={DISPOSAL_REASONS.map((r) => ({ value: r, label: r }))} />
            </Field>
            <Field label="วันที่จำหน่าย" error={a && date < a.acquired ? "ต้องไม่ก่อนวันที่ได้มา" : undefined}>
              <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={input()} />
            </Field>
            <Field label="ราคาขาย ก่อนภาษี" error={!(p >= 0) ? "ไม่ติดลบ" : reason === DISPOSAL_REASONS[0] && p <= 0 ? "ขายต้องมีราคา" : undefined}>
              <input inputMode="decimal" value={price} onChange={(ev) => setPrice(ev.target.value)} className={input() + " text-right tabular-nums"} />
            </Field>
            <Field label="ผู้ซื้อ" hint="ไม่บังคับ">
              <input value={buyer} onChange={(ev) => setBuyer(ev.target.value)} className={input()} />
            </Field>
          </div>
          {p > 0 && <Check checked={withVat} onChange={setWithVat}>ออกใบกำกับภาษีขาย 7% {preview ? satang(preview.vat) : ""}</Check>}
          {preview && (
            <Note tone={preview.gain >= 0 ? "ok" : "warn"}>
              {preview.gain >= 0 ? "กำไร" : "ขาดทุน"}จากการจำหน่าย {satang(Math.abs(preview.gain))}
            </Note>
          )}
        </>
      }
    />
  );
}

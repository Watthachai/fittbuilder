import { describe, expect, it } from "vitest";
import {
  JOURNAL, accumulated, asset, balanceOf, balanceSheet, createJournal, createServiceBill, depreciationPreview,
  disposeAsset, entryByNo, payable, payables, postJournal, profitAndLoss, receivable, receivables, recordPayment,
  registerAsset, reverseJournal, runDepreciation, trialBalance,
} from "../../demo/modules/fi/data";
import {
  BILLINGS, CREDIT_NOTES, amountDue, cancelPayment, recordPayment as receiveSalesPayment,
} from "../../demo/modules/sd/data";

/**
 * The accounting core, held to the rules an accountant checks by hand: every
 * posting balances, a posting moves the trial balance and the statements by
 * exactly its amount, a receipt clears the receivable, withholding is taken
 * from the pre-VAT base, and straight-line depreciation is (cost − salvage) ÷
 * life ÷ 12. Expected figures are worked out from those rules here, not read
 * back from the functions under test.
 *
 * The records are shared module state, so the cases run in order and measure
 * movements rather than absolute balances.
 */

const snapshot = () => Object.fromEntries(trialBalance().map((a) => [a.code, a.balance]));
const moved = (before: Record<string, number>, code: string) => Math.round((balanceOf(code) - before[code]) * 100) / 100;

describe("journal vouchers", () => {
  it("refuses to post a voucher whose debits and credits differ", () => {
    const before = snapshot();
    const count = JOURNAL.length;
    const lines = [
      { account: "5310", amount: 1000 },
      { account: "1010", amount: -900 },
    ];
    expect(() => createJournal({ date: "2026-09-22", memo: "ค่าใช้จ่ายไม่ลงตัว", lines }, true)).toThrow(/เดบิตไม่เท่าเครดิต/);
    expect(JOURNAL.length).toBe(count);

    // As a draft it may be saved, but it stays out of the books and cannot be posted.
    const draft = createJournal({ date: "2026-09-22", memo: "ค่าใช้จ่ายไม่ลงตัว", lines }, false);
    expect(snapshot()).toEqual(before);
    expect(() => postJournal(draft.no)).toThrow(/เดบิตไม่เท่าเครดิต/);
  });

  it("moves the trial balance and both statements by the amount posted, and back when reversed", () => {
    const before = snapshot();
    const profit = profitAndLoss().profit;
    const assets = balanceSheet().assetTotal;

    const e = createJournal(
      {
        date: "2026-09-23",
        memo: "ค่าซ่อมหลังคาโรงงาน",
        lines: [
          { account: "5310", amount: 12000 },
          { account: "1010", amount: -12000 },
        ],
      },
      true
    );
    expect(e.no).toMatch(/^JV-69\d{2}$/);
    expect(moved(before, "5310")).toBe(12000);
    expect(moved(before, "1010")).toBe(-12000);
    expect(profitAndLoss().profit).toBe(profit - 12000);
    expect(balanceSheet().assetTotal).toBe(assets - 12000);
    expect(balanceSheet().balances).toBe(true);

    const r = reverseJournal(e.no, "คีย์ซ้ำกับใบแจ้งหนี้ของผู้รับเหมา", "2026-09-24");
    expect(entryByNo(e.no).reversedBy).toBe(r.no);
    expect(snapshot()).toEqual(before);
    expect(() => reverseJournal(e.no, "ซ้ำอีกรอบ", "2026-09-24")).toThrow(/กลับรายการไปแล้ว/);
  });

  it("will not reverse a posting that belongs to the sales module", () => {
    const sale = BILLINGS[0].no.replace(/^IV-/, "SJ-");
    expect(() => reverseJournal(sale, "ลองกลับรายการขาย", "2026-09-30")).toThrow(/ระบบขาย/);
  });
});

describe("sales and receivables", () => {
  it("earns revenue per invoice issued, net of credit notes, not per order", () => {
    const invoiced = BILLINGS.reduce((n, b) => n + b.net, 0);
    const credited = CREDIT_NOTES.reduce((n, c) => n + c.net, 0);
    const outputVat = BILLINGS.reduce((n, b) => n + b.vat, 0) - CREDIT_NOTES.reduce((n, c) => n + c.vat, 0);
    expect(-balanceOf("4010")).toBe(invoiced);
    expect(balanceOf("4020")).toBe(credited);
    expect(-balanceOf("2110")).toBe(outputVat);
    // The control account equals the list of what customers owe, invoice by invoice.
    expect(balanceOf("1110")).toBe(Math.round(receivables().reduce((n, r) => n + r.open, 0) * 100) / 100);
  });

  it("clears an invoice once the sales receipt is recorded, and reopens it when the receipt is cancelled", () => {
    const bill = BILLINGS.find((b) => !b.paid);
    if (!bill) throw new Error("ต้องมีใบกำกับของฝ่ายขายที่ยังไม่เก็บเงินอย่างน้อยหนึ่งใบ");
    const owed = amountDue(bill);
    expect(receivable(bill.no).open).toBe(owed);

    const before = snapshot();
    // The customer withholds 3% of the pre-VAT amount; the cash is the rest.
    const wht = Math.round(bill.net * 3) / 100;
    receiveSalesPayment(bill.no, { date: "2026-09-24", method: "โอนเงิน", ref: "KBANK 2409", wht });
    expect(receivables().some((r) => r.invoice === bill.no)).toBe(false);
    expect(moved(before, "1110")).toBe(-owed);
    expect(moved(before, "1130")).toBe(wht);
    expect(moved(before, "1010")).toBe(Math.round((owed - wht) * 100) / 100);
    expect(() => receiveSalesPayment(bill.no, { date: "2026-09-24", method: "เงินสด", ref: "", wht: 0 })).toThrow();

    cancelPayment(bill.no, "เช็คคืน เงินไม่พอจ่าย");
    expect(receivable(bill.no).open).toBe(owed);
    expect(snapshot()).toEqual(before);
  });
});

describe("payables with withholding tax", () => {
  it("pays a service invoice net of 3% on the pre-VAT amount and books the tax as payable", () => {
    const before = snapshot();
    const bill = createServiceBill({
      date: "2026-09-22", vendor: "V-004", vendorInvoice: "SV-2569-0077", description: "ค่าซ่อมบำรุงเครื่องตัดเหล็ก",
      account: "5310", base: 10000, withVat: true, whtRate: 0.03,
    });
    // 10,000 + VAT 7% = 10,700 owed to the supplier.
    expect(moved(before, "2010")).toBe(-10700);
    expect(moved(before, "1120")).toBe(700);
    expect(payable(bill.no).open).toBe(10700);

    const mid = snapshot();
    const pay = recordPayment({ invoice: bill.no, date: "2026-09-24", settle: 10700, whtRate: 0.03, method: "โอนเงิน" });
    // 3% of 10,000 is withheld; the supplier receives 10,700 − 300.
    expect(pay.wht).toBe(300);
    expect(pay.net).toBe(10400);
    expect(moved(mid, "2010")).toBe(10700);
    expect(moved(mid, "1010")).toBe(-10400);
    expect(moved(mid, "2120")).toBe(-300);
    expect(payables().some((p) => p.no === bill.no)).toBe(false);
  });

  it("withholds in proportion on a part payment and leaves the rest owing", () => {
    const bill = createServiceBill({
      date: "2026-09-22", vendor: "V-002", vendorInvoice: "SV-2569-0078", description: "ค่าจ้างเชื่อมโครงชั้นวาง",
      account: "1210", base: 20000, withVat: true, whtRate: 0.03,
    });
    // Half of 21,400 carries half of the 20,000 base: 3% of 10,000 = 300.
    const pay = recordPayment({ invoice: bill.no, date: "2026-09-24", settle: 10700, whtRate: 0.03, method: "เช็ค", bankRef: "0099812" });
    expect(pay.wht).toBe(300);
    expect(pay.net).toBe(10400);
    expect(payable(bill.no).open).toBe(10700);
    expect(() => recordPayment({ invoice: bill.no, date: "2026-09-24", settle: 10701, whtRate: 0, method: "โอนเงิน" })).toThrow(/เกินยอดค้าง/);
  });

  it("will not pay an invoice purchasing has blocked", () => {
    const blocked = payables().find((p) => p.blocked);
    if (blocked) expect(() => recordPayment({ invoice: blocked.no, date: "2026-09-24", settle: 1, whtRate: 0, method: "โอนเงิน" })).toThrow(/ระงับ/);
  });
});

describe("fixed assets", () => {
  let registered = "";

  it("posts one month of straight-line depreciation for every asset in service", () => {
    const a = registerAsset({ name: "เครื่องเชื่อม MIG", cost: 120000, acquired: "2026-09-24", lifeYears: 5, salvage: 0, withVat: true });
    // (1,800,000 ÷ 120) + (850,000 ÷ 96 → 8,854) + (420,000 ÷ 60) + (130,000 ÷ 36 → 3,611) + (120,000 ÷ 60)
    const expected = 15000 + 8854 + 7000 + 3611 + 2000;
    registered = a.code;
    const before = snapshot();
    expect(depreciationPreview().period).toBe("2026-10");
    const run = runDepreciation();
    expect(run.period).toBe("2026-10");
    expect(run.lines.find((l) => l.asset === a.code)?.amount).toBe(2000);
    expect(moved(before, "5210")).toBe(expected);
    expect(moved(before, "1319")).toBe(-expected);
    expect(accumulated(asset(a.code))).toBe(2000);
    expect(depreciationPreview().period).toBe("2026-11");
  });

  it("books the loss when an asset is sold below its book value", () => {
    const a = asset(registered);
    const before = snapshot();
    // Book value 120,000 − 2,000 = 118,000; sold for 100,000 + VAT → loss 18,000.
    disposeAsset({ asset: a.code, date: "2026-11-05", price: 100000, withVat: true, reason: "ขายให้บุคคลภายนอก" });
    expect(moved(before, "5410")).toBe(18000);
    expect(moved(before, "1310")).toBe(-120000);
    expect(moved(before, "1319")).toBe(2000);
    expect(moved(before, "1010")).toBe(107000);
    expect(moved(before, "2110")).toBe(-7000);
    expect(balanceSheet().balances).toBe(true);
  });
});

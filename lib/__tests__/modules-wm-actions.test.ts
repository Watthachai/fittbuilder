import { describe, expect, it } from "vitest";
import { TODAY, postGoodsReceipt } from "../../demo/modules/mm/data";
import {
  COUNTS, GOODS_ISSUES, INBOUND, approveCount, bin, confirmPick, confirmPutaway, createCountSheet, createPickList,
  createPutawayTasks, enterCounts, openVariances, pendingReceipts, pickListProblems, postCountAdjustment,
  postGoodsIssue, putawayCandidates, stockInWarehouse, transferStock,
} from "../../demo/modules/wm/data";

/**
 * The warehouse moves: put away what purchasing received, pick oldest stock
 * first, move between bins, count and adjust. Expected figures come from the
 * rule — bin weight ceilings, first-in-first-out, a count posts only after
 * someone other than the counter approves it — worked out by hand.
 *
 * The records are module state shared by the file; each test uses bins and
 * materials the others leave alone.
 */

describe("moving stock between bins", () => {
  it("moves quantity between bins without changing the warehouse total", () => {
    // Gloves (MAT-3001): 640 pairs in D-01-01, C-03-05 is an empty pick bin.
    const t = transferStock({ from: "D-01-01", to: "C-03-05", qty: 100, reason: "ลดน้ำหนักช่องที่ใกล้เต็ม" });
    expect(t.no).toBe("TO-MV-2203");
    expect(bin("D-01-01").qty).toBe(540);
    expect(bin("C-03-05").qty).toBe(100);
    expect(bin("C-03-05").material).toBe("MAT-3001");
    // The lot keeps its date: the pairs moved are as old as the ones left behind.
    expect(bin("C-03-05").since).toBe(bin("D-01-01").since);
    expect(stockInWarehouse("MAT-3001")).toBe(640);

    // A bin holding something else is refused; so is more than the source holds.
    expect(() => transferStock({ from: "C-03-05", to: "C-01-12", qty: 10, reason: "ทดสอบ" })).toThrow();
    expect(() => transferStock({ from: "C-03-05", to: "D-01-01", qty: 101, reason: "ทดสอบ" })).toThrow();

    // Moving everything back empties the pick bin.
    transferStock({ from: "C-03-05", to: "D-01-01", qty: 100, reason: "รวมล็อตเดียวกันไว้ช่องเดียว" });
    expect(bin("C-03-05").material).toBeNull();
    expect(bin("C-03-05").qty).toBe(0);
    expect(stockInWarehouse("MAT-3001")).toBe(640);
  });
});

describe("put-away", () => {
  it("refuses a bin that would exceed its weight ceiling and suggests one that fits", () => {
    // 200 bars × 8.9 kg into A-01-07, which already holds 86 bars: 286 × 8.9 = 2,545 kg > 2,000.
    expect(() => confirmPutaway("TO-IN-4401", "A-01-07")).toThrow(/เกินเพดาน/);
    // 200 × 8.9 = 1,780 kg fits the empty 2,000 kg bulk bin A-02-01, the first empty bulk bin by code.
    expect(putawayCandidates("MAT-1002", 200)[0].bin.code).toBe("A-02-01");

    confirmPutaway("TO-IN-4401", "A-02-01");
    expect(bin("A-02-01").material).toBe("MAT-1002");
    expect(bin("A-02-01").qty).toBe(200);
    expect(bin("A-02-01").since).toBe(TODAY);
    expect(INBOUND.find((t) => t.no === "TO-IN-4401")!.status).toBe("จัดเก็บแล้ว");
  });
});

describe("picking and goods issue", () => {
  it("picks the oldest lot first, records a short pick, and issues what was really picked", () => {
    // Purchasing receives 40 boxes of M8 nuts; the warehouse puts them in the empty bulk bin A-02-02.
    const gr = postGoodsReceipt({ po: "PO-2569-121", date: TODAY, deliveryNote: "DN-7701", receivedBy: "ณัฐพล ทองดี", lines: [{ material: "MAT-2001", qty: 40 }] });
    expect(pendingReceipts().map((g) => g.no)).toContain(gr.no);
    const [task] = createPutawayTasks(gr.no);
    expect(task.no).toBe("TO-IN-4403");
    expect(pendingReceipts().map((g) => g.no)).not.toContain(gr.no);
    confirmPutaway(task.no, "A-02-02");

    // 25 boxes wanted: the 18 in C-01-12 (lot of 2026-07-31) go first, then 7 of today's lot.
    const tasks = createPickList({ ref: "DO-2569-0310", lines: [{ material: "MAT-2001", qty: 25 }] });
    expect(tasks.map((t) => [t.no, t.bin, t.qty])).toEqual([
      ["TO-PK-7714", "C-01-12", 18],
      ["TO-PK-7715", "A-02-02", 7],
    ]);

    confirmPick("TO-PK-7714", 18);
    expect(bin("C-01-12").material).toBeNull();
    confirmPick("TO-PK-7715", 5);
    expect(bin("A-02-02").qty).toBe(35);

    const gi = postGoodsIssue("DO-2569-0310");
    expect(gi.no).toBe("GI-2569-001");
    expect(gi.lines).toEqual([{ material: "MAT-2001", qty: 23 }]);
    expect(GOODS_ISSUES).toContain(gi);
    expect(() => postGoodsIssue("DO-2569-0310")).toThrow();
  });

  it("does not hand out stock already reserved for another pick", () => {
    // E-02-02 holds 5 trolleys and TO-PK-7712 has 6 of them reserved: nothing is free.
    const problems = pickListProblems({ ref: "DO-2569-0311", lines: [{ material: "FG-5003", qty: 1 }] });
    expect(problems["line:FG-5003"]).toMatch(/มีให้หยิบ 0/);
  });
});

describe("stock count", () => {
  it("posts a count difference only after someone other than the counter approves it", () => {
    // Paint (MAT-1003) sits in B-02-01: 34 buckets in the system; ณัฐพล counts 31.
    const sheet = createCountSheet({ bins: ["B-02-01"], scope: "นับวนรอบสัปดาห์ที่ 39", counter: "ณัฐพล" });
    expect(sheet.no).toBe("PI-2569-013");
    expect(() => createCountSheet({ bins: ["B-02-01"], scope: "นับซ้ำ", counter: "อนุชา" })).toThrow();

    const [count] = enterCounts(sheet.no, { "B-02-01": 31 });
    expect(count.system).toBe(34);
    expect(count.status).toBe("รออนุมัติ");
    expect(openVariances()).toContain(count);

    expect(() => postCountAdjustment(sheet.no, "B-02-01")).toThrow(/อนุมัติ/);
    expect(bin("B-02-01").qty).toBe(34);

    expect(() => approveCount(sheet.no, "B-02-01", "ณัฐพล", "สีรั่วเสียหาย 3 ถัง")).toThrow();
    approveCount(sheet.no, "B-02-01", "ธีรศักดิ์", "สีรั่วเสียหาย 3 ถัง");
    postCountAdjustment(sheet.no, "B-02-01");
    expect(bin("B-02-01").qty).toBe(31);
    expect(count.status).toBe("ปรับยอดแล้ว");
    expect(openVariances()).not.toContain(count);
    expect(() => postCountAdjustment(sheet.no, "B-02-01")).toThrow();
  });

  it("closes a count that matches without any approval", () => {
    const sheet = createCountSheet({ bins: ["E-01-01"], scope: "นับสินค้าสำเร็จรูป", counter: "อนุชา" });
    const [count] = enterCounts(sheet.no, { "E-01-01": bin("E-01-01").qty });
    expect(count.status).toBe("ตรงกัน");
    expect(COUNTS).toContain(count);
    expect(openVariances()).not.toContain(count);
  });
});

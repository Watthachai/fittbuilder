import { describe, expect, it } from "vitest";
import {
  continuationPrompt,
  looksMultiTask,
  nextAttempt,
  parseTaskVerdict,
  taskOutcome,
  taskProgress,
  taskTurnPrompt,
  type BuildTask,
  type TurnOutcome,
} from "@/lib/tasks";

const task = (id: string, title: string, status: BuildTask["status"] = "pending"): BuildTask => ({
  id,
  title,
  detail: title,
  status,
});

describe("looksMultiTask", () => {
  it("splits a numbered list of three or more", () => {
    expect(looksMultiTask("ช่วยแก้\n1. เพิ่มเมนูรายงาน\n2) ใส่ข้อมูลพนักงาน 20 คน\n3. เปลี่ยนสีปุ่ม")).toBe(true);
  });

  it("counts bullets and ข้อ markers too", () => {
    expect(looksMultiTask("- หน้าแรก\n• หน้าสินค้า\nข้อ 3 หน้าตะกร้า")).toBe(true);
  });

  it("leaves a single ask, or a two-item list, as one turn", () => {
    expect(looksMultiTask("เปลี่ยนสีปุ่มเป็นสีเขียว")).toBe(false);
    expect(looksMultiTask("1. เปลี่ยนสีปุ่ม\n2. เพิ่มโลโก้")).toBe(false);
  });

  it("splits a long request even without a list", () => {
    expect(looksMultiTask("ก".repeat(700))).toBe(true);
  });
});

describe("parseTaskVerdict", () => {
  it("reads a finished task and drops the status line from the note", () => {
    expect(parseTaskVerdict("เพิ่มหน้ารายงานแล้ว\nสถานะงาน: ครบ")).toEqual({
      complete: true,
      reason: "",
      note: "เพิ่มหน้ารายงานแล้ว",
    });
  });

  it("reads what an unfinished task still lacks", () => {
    expect(parseTaskVerdict("ใส่ข้อมูลได้ 12 คน\nสถานะงาน: ไม่ครบ — ยังขาดพนักงานอีก 8 คน")).toEqual({
      complete: false,
      reason: "ยังขาดพนักงานอีก 8 คน",
      note: "ใส่ข้อมูลได้ 12 คน",
    });
  });

  it("says nothing when the model gave no verdict", () => {
    expect(parseTaskVerdict("แก้แล้ว")).toEqual({ complete: null, reason: "", note: "แก้แล้ว" });
  });
});

describe("prompts", () => {
  const tasks = [task("a", "เพิ่มเมนูรายงาน", "done"), task("b", "ใส่ข้อมูลพนักงาน 20 คน"), task("c", "เปลี่ยนสีปุ่ม")];

  it("gives a task turn the whole request but only its own item", () => {
    const prompt = taskTurnPrompt("คำสั่งเต็ม", tasks, 1);
    expect(prompt).toContain("คำสั่งเต็ม");
    expect(prompt).toContain("1. เพิ่มเมนูรายงาน (ทำแล้ว)");
    expect(prompt).toContain("2. ใส่ข้อมูลพนักงาน 20 คน ← รอบนี้");
    expect(prompt).toContain("3. เปลี่ยนสีปุ่ม (ทำในรอบอื่น)");
    expect(prompt).toContain("รอบนี้ทำเฉพาะข้อ 2: ใส่ข้อมูลพนักงาน 20 คน");
  });

  it("tells a continuation why the last turn stopped and what it already wrote", () => {
    const prompt = continuationPrompt("เพิ่มหน้ารายงาน", "time", ["src/pages/Report.tsx"]);
    expect(prompt).toContain("หมดเวลาของรอบ");
    expect(prompt).toContain("src/pages/Report.tsx");
    expect(prompt).toContain("เพิ่มหน้ารายงาน");
  });
});

const outcome = (over: Partial<TurnOutcome>): TurnOutcome => ({
  status: "done",
  note: "",
  cut: null,
  written: [],
  ...over,
});

describe("after a task turn", () => {
  it("is done when the turn finished and said so", () => {
    const out = outcome({ note: "เพิ่มพนักงาน 20 คนแล้ว\nสถานะงาน: ครบ" });
    expect(nextAttempt("P", out)).toBeNull();
    expect(taskOutcome(out)).toEqual({ status: "done", note: "เพิ่มพนักงาน 20 คนแล้ว" });
  });

  it("keeps what a done turn listed, not just its opening line", () => {
    const out = outcome({ note: "ทำข้อ 1 แล้ว:\n- **เพิ่มรายการ** 15 รายการ\n- ใส่สถานะครบ\nสถานะงาน: ครบ" });
    expect(taskOutcome(out).note).toBe("ทำข้อ 1 แล้ว: · เพิ่มรายการ 15 รายการ · ใส่สถานะครบ");
  });

  it("continues a cut turn from the files it already wrote", () => {
    const out = outcome({ status: "cut", cut: "time", written: ["src/data/employees.ts"] });
    expect(nextAttempt("P", out)).toContain("src/data/employees.ts");
    expect(taskOutcome(out)).toEqual({ status: "partial", note: "หยุดกลางทางเพราะหมดเวลาของรอบ" });
  });

  it("asks again for what a turn said it still lacks", () => {
    const out = outcome({ note: "สถานะงาน: ไม่ครบ — ยังขาดอีก 8 คน" });
    expect(nextAttempt("P", out)).toContain("ยังขาดอีก 8 คน");
    expect(taskOutcome(out)).toEqual({ status: "partial", note: "ยังขาดอีก 8 คน" });
  });

  it("tries a failed turn again with the same prompt", () => {
    const out = outcome({ status: "failed", note: "AI ใช้เวลานานเกินไป กรุณาลองใหม่" });
    expect(nextAttempt("P", out)).toBe("P");
    expect(taskOutcome(out)).toEqual({ status: "failed", note: "AI ใช้เวลานานเกินไป กรุณาลองใหม่" });
  });

  it("stops when the person stopped it", () => {
    const out = outcome({ status: "cancelled" });
    expect(nextAttempt("P", out)).toBeNull();
    expect(taskOutcome(out).status).toBe("pending");
  });
});

describe("taskProgress", () => {
  it("counts done tasks and lists the rest", () => {
    const progress = taskProgress([task("a", "x", "done"), task("b", "y", "partial"), task("c", "z", "failed")]);
    expect(progress.done).toBe(1);
    expect(progress.total).toBe(3);
    expect(progress.open.map((t) => t.id)).toEqual(["b", "c"]);
  });
});

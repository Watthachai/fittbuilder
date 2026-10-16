import { describe, expect, it } from "vitest";
import {
  buildModulesUser,
  MODULES_SYSTEM,
  moduleNote,
  parseModulesDraft,
  unplacedScreens,
  type ProposalModule,
} from "../proposal-modules";

/**
 * A project broken into the modules it was sold as.
 *
 * SQP-0002 is the shape a customer accepted: one line per module, under it
 * each part numbered 1.1, 1.2 … with three or four lines on what it does — the
 * key points of the proposal, not every detail of every screen. The sales team
 * wrote it by hand from sixty screens; the model drafts it, the person edits it.
 */
const SCREENS = ["แดชบอร์ดโครงการ BOQ", "ทำเนียบโครงการทั้งหมด", "ภาพรวมการจัดซื้อ", "ทะเบียนคู่ค้า"];

const answer = JSON.stringify({
  modules: [
    {
      name: " Module: Sales Management (งานขาย) ",
      parts: [
        {
          name: "1.1 Dashboard ฝ่ายประเมินราคา",
          points: ["- แสดงภาพรวมยอดเสนอขาย ต้นทุน และอัตรากำไร", "ติดตามสถานะโครงการ BOQ", ""],
          screens: ["แดชบอร์ดโครงการ BOQ", "หน้าที่ไม่มีจริง"],
        },
        { name: "ระบบบริหารจัดการโครงการ (Project Management)", points: ["จัดเก็บข้อมูลโครงการ"], screens: ["ทำเนียบโครงการทั้งหมด"] },
      ],
    },
    {
      name: "Module: Procurement Management (งานจัดซื้อ)",
      parts: [
        // A screen already placed above stays where it was first put.
        { name: "Dashboard ฝ่ายจัดซื้อ", points: ["แสดงภาพรวมคำขอราคา"], screens: ["ภาพรวมการจัดซื้อ", "แดชบอร์ดโครงการ BOQ"] },
        { name: "", points: ["ไม่มีชื่อ"], screens: [] },
      ],
    },
    { name: "Module: ว่างเปล่า", parts: [] },
  ],
});

describe("parseModulesDraft", () => {
  const modules = parseModulesDraft(answer, SCREENS)!;

  it("keeps the modules and parts that carry something, names trimmed, numbering stripped", () => {
    expect(modules.map((m) => m.name)).toEqual(["Module: Sales Management (งานขาย)", "Module: Procurement Management (งานจัดซื้อ)"]);
    expect(modules[0].parts.map((p) => p.name)).toEqual([
      "Dashboard ฝ่ายประเมินราคา",
      "ระบบบริหารจัดการโครงการ (Project Management)",
    ]);
    expect(modules[1].parts).toHaveLength(1);
  });

  it("keeps the summary lines bare — the paper adds the dash", () => {
    expect(modules[0].parts[0].points).toEqual(["แสดงภาพรวมยอดเสนอขาย ต้นทุน และอัตรากำไร", "ติดตามสถานะโครงการ BOQ"]);
  });

  it("places a screen only once, and only one the project has", () => {
    expect(modules[0].parts[0].screens).toEqual(["แดชบอร์ดโครงการ BOQ"]);
    expect(modules[1].parts[0].screens).toEqual(["ภาพรวมการจัดซื้อ"]);
  });

  it("gives every module and part an id of its own", () => {
    const ids = modules.flatMap((m) => [m.id, ...m.parts.map((p) => p.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is null when nothing usable came back", () => {
    expect(parseModulesDraft("not json", SCREENS)).toBeNull();
    expect(parseModulesDraft(JSON.stringify({ modules: [] }), SCREENS)).toBeNull();
  });
});

describe("unplacedScreens", () => {
  it("names the screens no part covers, so none drops out of the scope unseen", () => {
    expect(unplacedScreens(parseModulesDraft(answer, SCREENS)!, SCREENS)).toEqual(["ทะเบียนคู่ค้า"]);
  });
});

describe("moduleNote", () => {
  const sales: ProposalModule = {
    id: "m1",
    name: "Module: Sales Management (งานขาย)",
    parts: [
      { id: "p1", name: "Dashboard ฝ่ายประเมินราคา", points: ["แสดงภาพรวมยอดเสนอขาย", "ติดตามสถานะโครงการ BOQ"], screens: [] },
      { id: "p2", name: "ระบบบริหารจัดการโครงการ (Project Management)", points: ["จัดเก็บข้อมูลโครงการ"], screens: [] },
    ],
  };

  it("numbers each part under the module's own number, its lines dashed beneath, a blank line between", () => {
    expect(moduleNote(sales, 2)).toBe(
      [
        "2.1 Dashboard ฝ่ายประเมินราคา",
        "- แสดงภาพรวมยอดเสนอขาย",
        "- ติดตามสถานะโครงการ BOQ",
        "",
        "2.2 ระบบบริหารจัดการโครงการ (Project Management)",
        "- จัดเก็บข้อมูลโครงการ",
      ].join("\n")
    );
  });
});

describe("the instructions", () => {
  it("ask for key points only, three or four a part, in the accepted shape", () => {
    expect(MODULES_SYSTEM).toContain("Module: Sales Management (งานขาย)");
    expect(MODULES_SYSTEM).toMatch(/3-4 ข้อ/);
    expect(MODULES_SYSTEM).toMatch(/ไม่ดึงรายละเอียดทุกอย่าง/);
    expect(MODULES_SYSTEM).toMatch(/ห้ามใส่ราคา/);
  });

  it("hand over every screen with what it does and the windows that open from it", () => {
    const user = buildModulesUser({
      projectName: "First Chapter",
      context: "เดิมใช้ Excel",
      features: ["ระบบเปรียบเทียบราคา"],
      screens: [{ name: "ภาพรวมการจัดซื้อ", does: "ดูคำขอราคาทั้งหมด", modals: ["สร้างใบขอราคาใหม่"] }],
      brd: "",
      prd: "",
    });
    expect(user).toContain("- ภาพรวมการจัดซื้อ — ดูคำขอราคาทั้งหมด (หน้าต่างย่อย: สร้างใบขอราคาใหม่)");
    expect(user).toContain("ระบบเปรียบเทียบราคา");
  });
});

import { describe, expect, it } from "vitest";
import { buildScreenMapUser, pageFiles, parseScreenMap } from "../screen-map";

describe("pageFiles", () => {
  it("lists the screen files the architecture contract guarantees", () => {
    expect(
      pageFiles({
        "src/pages/DashboardPage.tsx": "",
        "src/pages/OrdersPage.tsx": "",
        "src/components/ui/Card.tsx": "",
        "src/App.tsx": "",
      })
    ).toEqual(["src/pages/DashboardPage.tsx", "src/pages/OrdersPage.tsx"]);
  });
});

describe("buildScreenMapUser", () => {
  it("sends the code that decides navigation, and nothing decorative", () => {
    const user = buildScreenMapUser({
      "src/App.tsx": "APP",
      "src/pages/OrdersPage.tsx": "ORDERS",
      "src/components/layout/Sidebar.tsx": "SIDEBAR",
      "src/components/ui/Card.tsx": "CARD",
    });
    expect(user).toContain("APP");
    expect(user).toContain("ORDERS");
    expect(user).toContain("SIDEBAR");
    expect(user).not.toContain("CARD");
  });

  // A company card on a picker screen is labelled from mock data. Without it the
  // model invents a name that is on no screen, and the walk stalls at the gate.
  it("includes the sample data that gate labels are drawn from", () => {
    const user = buildScreenMapUser({
      "src/App.tsx": "APP",
      "src/data/companies.ts": 'export const COMPANIES = [{ name: "สยามซอฟท์ จำกัด" }];',
    });
    expect(user).toContain("สยามซอฟท์ จำกัด");
  });

  it("caps each data file so one big fixture cannot eat the prompt", () => {
    const user = buildScreenMapUser({
      "src/App.tsx": "APP",
      "src/data/rows.ts": "x".repeat(9000),
    });
    expect(user).toContain("x".repeat(4000));
    expect(user).not.toContain("x".repeat(4001));
  });
});

describe("parseScreenMap", () => {
  it("reads the map and keeps the screen → modal hierarchy", () => {
    const { screens: map } = parseScreenMap(
      `{"screens":[{"name":"แดชบอร์ด","navText":"","subs":[]},
        {"name":"ออเดอร์","navText":"ออเดอร์","subs":[{"name":"เพิ่มออเดอร์","openBy":"เพิ่มออเดอร์","closeBy":"ยกเลิก"}]}]}`
    );
    expect(map).toHaveLength(2);
    expect(map[0].navText).toBe("");
    expect(map[1].subs[0]).toEqual({
      name: "เพิ่มออเดอร์",
      openBy: "เพิ่มออเดอร์",
      closeBy: "ยกเลิก",
    });
  });

  it("tolerates prose or fences around the JSON", () => {
    expect(
      parseScreenMap('นี่คือแผนผัง:\n```json\n{"screens":[{"name":"หน้าแรก"}]}\n```').screens
    ).toEqual([{ name: "หน้าแรก", navText: "", subs: [] }]);
  });

  it("drops a sub with nothing to click — the walker could not open it anyway", () => {
    const { screens: map } = parseScreenMap(
      `{"screens":[{"name":"ก","navText":"ก","subs":[{"name":"x","openBy":"","closeBy":"ปิด"}]}]}`
    );
    expect(map[0].subs).toEqual([]);
  });

  it("defaults a missing close control to ปิด", () => {
    const { screens: map } = parseScreenMap(
      `{"screens":[{"name":"ก","navText":"ก","subs":[{"name":"x","openBy":"เปิด"}]}]}`
    );
    expect(map[0].subs[0].closeBy).toBe("ปิด");
  });

  it("returns nothing usable rather than guessing", () => {
    expect(parseScreenMap("ขอโทษครับ อ่านไม่ออก")).toEqual({ setup: [], screens: [] });
    expect(parseScreenMap('{"screens":"nope"}')).toEqual({ setup: [], screens: [] });
  });
});

describe("gates", () => {
  // A sign-in screen and a company picker are screens the customer pays for, so
  // each one is named — the walk captures it on the way past.
  it("keeps a name and a control for every gate", () => {
    const { setup } = parseScreenMap(
      `{"setup":[{"name":"หน้าเข้าสู่ระบบ","click":"เข้าสู่ระบบ"},
        {"name":"หน้าเลือกบริษัท","click":"บริษัท สยามซอฟท์ จำกัด"}],
        "screens":[{"name":"เอกสารทั้งหมด","navText":"เอกสารทั้งหมด"}]}`
    );
    expect(setup).toEqual([
      { name: "หน้าเข้าสู่ระบบ", click: "เข้าสู่ระบบ" },
      { name: "หน้าเลือกบริษัท", click: "บริษัท สยามซอฟท์ จำกัด" },
    ]);
  });

  it("still understands the older bare-string shape", () => {
    expect(parseScreenMap(`{"setup":["เข้าสู่ระบบ"],"screens":[{"name":"ก"}]}`).setup).toEqual([
      { name: "เข้าสู่ระบบ", click: "เข้าสู่ระบบ" },
    ]);
  });

  it("drops a gate with nothing to click", () => {
    expect(
      parseScreenMap(`{"setup":[{"name":"หน้าต้อนรับ"}],"screens":[{"name":"ก"}]}`).setup
    ).toEqual([]);
  });

  it("defaults to no gates when the demo opens straight onto a screen", () => {
    expect(parseScreenMap(`{"screens":[{"name":"หน้าแรก"}]}`).setup).toEqual([]);
  });
});

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
  it("sends only the code that decides navigation", () => {
    const user = buildScreenMapUser({
      "src/App.tsx": "APP",
      "src/pages/OrdersPage.tsx": "ORDERS",
      "src/components/layout/Sidebar.tsx": "SIDEBAR",
      "src/data/orders.ts": "BIGDATA",
      "src/components/ui/Card.tsx": "CARD",
    });
    expect(user).toContain("APP");
    expect(user).toContain("ORDERS");
    expect(user).toContain("SIDEBAR");
    expect(user).not.toContain("BIGDATA");
    expect(user).not.toContain("CARD");
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
  // The reported failure: a demo that opens on sign-in → company picker walked
  // nowhere, so all 18 captures were the same screen.
  it("carries the sequence that clears sign-in and company selection", () => {
    const { setup } = parseScreenMap(
      `{"setup":["เข้าสู่ระบบ","บริษัทของคุณ"],"screens":[{"name":"เอกสารทั้งหมด","navText":"เอกสารทั้งหมด"}]}`
    );
    expect(setup).toEqual(["เข้าสู่ระบบ", "บริษัทของคุณ"]);
  });

  it("defaults to no gates when the demo opens straight onto a screen", () => {
    expect(parseScreenMap(`{"screens":[{"name":"หน้าแรก"}]}`).setup).toEqual([]);
  });
});

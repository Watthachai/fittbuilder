import { describe, expect, it } from "vitest";
import { shotKeyFor, shotMetaFromPath } from "../shots";

const PID = "99518d4e-5b78-458f-bf37-322ad90c1b0b";

describe("shot object keys", () => {
  // Supabase Storage rejects "%" in a key, so percent-encoding a Thai screen
  // name failed every upload with "Invalid key".
  it("keeps Thai names out of the key charset entirely", () => {
    const key = shotKeyFor(PID, "standard", { index: 0, parent: null, name: "แดชบอร์ดสรุปยอด" });
    expect(key.startsWith(`${PID}/shots/`)).toBe(true);
    expect(key).toMatch(/^[\w./-]+$/); // no %, no spaces, no &, no parentheses
  });

  it("survives the characters that broke it: & ( ) spaces", () => {
    for (const name of ["สต็อกกลาง & ซิงค์ช่องทาง", "รับสินค้าเข้าคลัง (Inbound)", "a/b*c.d"]) {
      const key = shotKeyFor(PID, "standard", { index: 3, parent: null, name });
      expect(key).toMatch(/^[\w./-]+$/);
      expect(shotMetaFromPath(key).name).toBe(name);
    }
  });

  it("round-trips the screen → modal hierarchy and the walk order", () => {
    const key = shotKeyFor(PID, "standard", { index: 12, parent: "ออเดอร์", name: "โมดัลเพิ่มออเดอร์" });
    expect(shotMetaFromPath(key)).toEqual({
      index: 12,
      parent: "ออเดอร์",
      name: "โมดัลเพิ่มออเดอร์",
      via: null,
      from: null,
    });
  });

  // Recording adds the edge: which control led here, and from where. `parent`
  // stays reserved for a modal nested under its screen — conflating the two
  // made every recorded screen a sub-item of the first one.
  it("round-trips a modal: nested under its screen, with its edge", () => {
    const key = shotKeyFor(PID, "standard", {
      index: 3,
      parent: "เอกสารทั้งหมด",
      from: "เอกสารทั้งหมด",
      name: "รายงานสรุปเอกสาร",
      via: "สร้าง Report ทั้งหมด",
    });
    expect(shotMetaFromPath(key)).toEqual({
      index: 3,
      parent: "เอกสารทั้งหมด",
      from: "เอกสารทั้งหมด",
      name: "รายงานสรุปเอกสาร",
      via: "สร้าง Report ทั้งหมด",
    });
  });

  it("round-trips a screen: an edge but no nesting", () => {
    const key = shotKeyFor(PID, "standard", {
      index: 4,
      parent: null,
      from: "เอกสารทั้งหมด",
      name: "ใบแจ้งหนี้",
      via: "ใบแจ้งหนี้",
    });
    const meta = shotMetaFromPath(key);
    expect(meta.parent).toBeNull();
    expect(meta.from).toBe("เอกสารทั้งหมด");
    expect(meta.name).toBe("ใบแจ้งหนี้");
  });

  it("still reads keys written before edges existed", () => {
    expect(shotMetaFromPath(`${PID}/shots/001..${btoa("x")}.png`.replace(/=+\./, "."))).toHaveProperty(
      "via",
      null
    );
  });

  it("sorts by name the way the walk ran (zero-padded index)", () => {
    const keys = [2, 10, 1].map((i) =>
      shotKeyFor(PID, "standard", { index: i, parent: null, name: `หน้า ${i}` })
    );
    const sorted = [...keys].sort();
    expect(sorted.map((k) => shotMetaFromPath(k).index)).toEqual([1, 2, 10]);
  });

  it("reads a top-level screen as having no parent", () => {
    const key = shotKeyFor(PID, "standard", { index: 0, parent: null, name: "หน้าแรก" });
    expect(shotMetaFromPath(key).parent).toBeNull();
  });

  // A Standard walk and a Premium walk must not land in one gallery.
  it("files each version under its own folder", () => {
    const shot = { index: 1, parent: null, name: "หน้าแรก" };
    expect(shotKeyFor(PID, "standard", shot).startsWith(`${PID}/shots/standard/`)).toBe(true);
    expect(shotKeyFor(PID, "premium", shot).startsWith(`${PID}/shots/premium/`)).toBe(true);
  });

  // The version folder is a path level, not a filename segment — the metadata
  // parser reads the same fields it always did, so nothing regressed.
  it("still parses name/index the same with a version folder in the path", () => {
    const key = shotKeyFor(PID, "premium", { index: 7, parent: "ออเดอร์", name: "โมดัล" });
    expect(shotMetaFromPath(key)).toMatchObject({ index: 7, parent: "ออเดอร์", name: "โมดัล" });
  });
});

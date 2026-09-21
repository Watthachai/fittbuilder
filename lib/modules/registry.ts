import type { Module } from "./types";
import { PA } from "./hr/pa";
import { OM } from "./hr/om";
import { TM } from "./hr/tm";
import { PY } from "./hr/py";
import { MM } from "./logistics/mm";
import { PP } from "./logistics/pp";
import { SD } from "./logistics/sd";
import { WM } from "./logistics/wm";
import { FI } from "./finance/fi";
import { CO } from "./finance/co";

/**
 * Every module, in catalogue order. Mirrors `lib/skills/registry.ts` — modules are
 * dev-authored and live in the repo, so a module earns its place by compiling and
 * being tested, not by being configured.
 *
 * HR ships first because payroll cannot exist without personnel records: the
 * `provides`/`needs` contract has a real dependency to prove itself against from
 * the first build rather than three families of unrelated screens.
 */
// Catalogue order follows how an HR team grows into the system: records first,
// then the structure around them, then what people do with their time, then pay.
export const MODULES: Module[] = [PA, OM, TM, PY, MM, PP, SD, WM, FI, CO];

/** Buyer-facing name for each family, in catalogue order. */
export const FAMILIES: { id: Module["family"]; name: string; blurb: string }[] = [
  { id: "hr", name: "บุคคลและเงินเดือน", blurb: "ทะเบียนพนักงานเป็นฐาน แล้วโครงสร้าง เวลา และเงินเดือนอ่านต่อจากที่เดียวกัน" },
  { id: "logistics", name: "จัดซื้อ ผลิต ขาย คลัง", blurb: "แฟ้มวัสดุชุดเดียวเดินตั้งแต่ขอซื้อจนส่งของถึงลูกค้า" },
  { id: "finance", name: "บัญชีและต้นทุน", blurb: "ลงบัญชีจากเอกสารที่ออกจริง จึงต้องมีฝั่งจัดซื้อและขายอยู่ด้วย" },
];

export function getModule(id: string | null | undefined): Module | undefined {
  if (!id) return undefined;
  return MODULES.find((m) => m.id === id);
}

/** The modules of one family, in catalogue order. */
export function modulesOf(family: Module["family"]): Module[] {
  return MODULES.filter((m) => m.family === family);
}

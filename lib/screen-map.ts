import type { ProjectFiles } from "./types";

/**
 * The screen map: what screens the demo has, how to reach each one, and which
 * modals/panels hang off it.
 *
 * Who knows this? The model that wrote the app. Static analysis gets us the
 * page files (our architecture contract puts one screen per src/pages/*.tsx),
 * but not the label a user must click to get there — so the model fills that in
 * and the file list is what we check its answer against.
 */

export interface ScreenSub {
  name: string;
  /** Visible text of the control that opens it. */
  openBy: string;
  /** Visible text that closes it again (Escape is the fallback). */
  closeBy: string;
}

export interface ScreenNode {
  name: string;
  /** Visible nav text to reach the screen; empty for the landing screen. */
  navText: string;
  subs: ScreenSub[];
}

export interface ScreenMap {
  /**
   * Controls to click, in order, before any screen is reachable — sign in, pick
   * a company, dismiss a welcome step. Without these the walk photographs the
   * gate over and over, because every nav click lands on the same page.
   */
  setup: string[];
  screens: ScreenNode[];
}

/** Page files the architecture contract guarantees, used to sanity-check the map. */
export function pageFiles(files: ProjectFiles | null | undefined): string[] {
  if (!files) return [];
  return Object.keys(files)
    .filter((p) => /^src\/pages\/.+\.(tsx|jsx)$/.test(p))
    .sort();
}

export const SCREEN_MAP_SYSTEM = `คุณกำลังอ่านซอร์สโค้ดของเว็บเดโม (Vite + React) แล้วสรุป "แผนผังหน้าจอ" เพื่อเอาไปเดินแคปหน้าจอทีละหน้าโดยอัตโนมัติ

ตอบเป็น JSON อย่างเดียว รูปแบบ:
{"setup":["เข้าสู่ระบบ","บริษัทตัวอย่าง"],"screens":[{"name":"แดชบอร์ด","navText":"แดชบอร์ด","subs":[{"name":"โมดัลเพิ่มออเดอร์","openBy":"เพิ่มออเดอร์","closeBy":"ปิด"}]}]}

กติกา:
- setup = ลำดับ "ข้อความบนปุ่ม/การ์ด" ที่ต้องคลิกก่อน ถึงจะเข้าถึงหน้าจอหลักได้ เช่น หน้าเข้าสู่ระบบ, หน้าเลือกบริษัท/สาขา, หน้าต้อนรับ — เรียงตามลำดับที่ต้องกดจริง · ถ้าเปิดมาเจอหน้าหลักเลยให้เป็น []
- ข้อความใน setup ต้องเป็นข้อความที่ "ปรากฏบนจอจริง" — ถ้าการ์ดแสดงชื่อจากข้อมูลตัวอย่าง ให้ใช้ชื่อจริงตัวแรกจากไฟล์ข้อมูล (เช่นชื่อบริษัทจริงใน src/data) ห้ามแต่งชื่อสมมติเช่น "บริษัทตัวอย่าง"
- อย่าใส่หน้ากั้นเหล่านั้นซ้ำใน screens ถ้ามันไม่ใช่หน้าที่ผู้ใช้กลับมาใช้งานอีก
- name = ชื่อหน้าจอที่คนอ่านเข้าใจ (ภาษาเดียวกับใน UI) — จะเอาไปใส่ใบเสนอราคา
- navText = "ข้อความที่มองเห็นบนปุ่ม/เมนู" ที่ต้องคลิกเพื่อไปหน้านั้น ต้องตรงกับข้อความในโค้ดเป๊ะ (ไม่ใช่ชื่อไฟล์ ไม่ใช่ id) · หน้าที่เปิดมาเจอเป็นหน้าแรกให้ navText เป็น ""
- subs = modal / drawer / panel / ขั้นตอนถัดไป ที่เปิดจากปุ่มในหน้านั้น — openBy/closeBy ก็ต้องเป็นข้อความที่มองเห็นจริงเช่นกัน
- ใส่ทุกหน้าที่ผู้ใช้เข้าถึงได้ และทุก modal ที่เปิดได้จริง ห้ามเดาสิ่งที่ไม่มีในโค้ด
- ถ้า modal ต้องกรอกฟอร์มก่อนถึงจะเปิด ให้ข้ามไป (อย่าใส่)
- ไม่มี markdown ไม่มีคำอธิบาย ตอบ JSON ล้วน`;

/** Only the code that decides navigation — keeps the prompt small and on-topic. */
export function buildScreenMapUser(files: ProjectFiles): string {
  const nav = Object.keys(files)
    .filter((p) => /^src\/(App|pages\/|components\/layout\/)/.test(p) && /\.(tsx|jsx)$/.test(p))
    .sort();
  // Gate labels are usually DATA, not code: the company card on a picker screen
  // reads its name from src/data. Without these the model invents a plausible
  // label ("บริษัทตัวอย่าง") that exists nowhere on screen, and the walk stalls.
  const data = Object.keys(files)
    .filter((p) => /^src\/data\//.test(p))
    .sort();
  const dump = [
    ...nav.map((p) => `--- ${p} ---\n${files[p]}`),
    ...data.map((p) => `--- ${p} (ข้อมูลตัวอย่าง) ---\n${files[p].slice(0, 4000)}`),
  ].join("\n\n");
  return `ไฟล์ที่เกี่ยวกับการนำทางของเดโมนี้:\n\n${dump}`;
}

/** Parse + clamp the model's answer; unusable output yields an empty map. */
export function parseScreenMap(raw: string): ScreenMap {
  const empty: ScreenMap = { setup: [], screens: [] };
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return empty;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return empty;
  }
  const screens = (parsed as { screens?: unknown })?.screens;
  if (!Array.isArray(screens)) return empty;
  const text = (v: unknown, max = 80): string =>
    typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
  const rawSetup = (parsed as { setup?: unknown })?.setup;
  const setup = (Array.isArray(rawSetup) ? rawSetup : [])
    .slice(0, 6)
    .map((v) => text(v))
    .filter(Boolean);
  const list = screens
    .slice(0, 40)
    .map((s) => {
      const o = s as Record<string, unknown>;
      return {
        name: text(o.name) || "หน้าจอ",
        navText: text(o.navText),
        subs: (Array.isArray(o.subs) ? o.subs : [])
          .slice(0, 12)
          .map((x) => {
            const sub = x as Record<string, unknown>;
            return {
              name: text(sub.name) || "หน้าต่างย่อย",
              openBy: text(sub.openBy),
              closeBy: text(sub.closeBy) || "ปิด",
            };
          })
          .filter((sub) => sub.openBy.length > 0),
      } satisfies ScreenNode;
    })
    .filter((s) => s.name.length > 0);
  return { setup, screens: list };
}

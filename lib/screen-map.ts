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
  /** Collapsible group this menu hides inside — its children are absent from
   *  the DOM until the group is opened, so the walk must expand it first. */
  expand?: string;
  subs: ScreenSub[];
}

/** A screen you must pass THROUGH: sign-in, company picker, welcome step. */
export interface ScreenGate {
  /** What the screen is called on the quotation — it is a screen too. */
  name: string;
  /** Visible text of the control that moves past it. */
  click: string;
}

export interface ScreenMap {
  /**
   * Words this particular app uses for "go on" and for "get out", read off its
   * own UI. They ADD to the built-in list rather than replacing it: the
   * fallback exists for when the map is wrong, so it must not depend entirely
   * on the same answer being right.
   */
  forward: string[];
  avoid: string[];
  /**
   * Gates in the order they appear. Without them every nav click lands on the
   * same locked page; with them, each gate is also captured on the way past —
   * a sign-in screen is work the customer is paying for.
   */
  setup: ScreenGate[];
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
{"setup":[{"name":"<ชื่อหน้าที่ต้องผ่าน>","click":"<ข้อความบนปุ่มที่ต้องกด>"}],"screens":[{"name":"<ชื่อหน้าจอ>","navText":"<ข้อความบนเมนู>","expand":"<หัวข้อกลุ่มที่ต้องกางก่อน หรือ \"\">","subs":[{"name":"<ชื่อ modal>","openBy":"<ข้อความบนปุ่มที่เปิด>","closeBy":"<ข้อความบนปุ่มที่ปิด>"}]}]}

และเพิ่ม 2 ช่องนี้ที่ระดับบนสุด:
{"forward":["<ข้อความบนปุ่มที่แปลว่าไปต่อ>"],"avoid":["<ข้อความบนปุ่มที่พาออกหรืออันตราย>"]}
- forward = ข้อความบนปุ่ม/การ์ดในแอปนี้ที่หมายถึง "ไปต่อ/ยืนยัน/เลือก/เข้าใช้งาน" (ใช้ภาษาเดียวกับที่แอปเขียนจริง)
- avoid = ข้อความบนปุ่มที่ห้ามกดระหว่างเดินอัตโนมัติ เพราะพาออกหรือทำลายข้อมูล เช่น ออกจากระบบ ลบ รีเซ็ต ยกเลิก
- ทั้งสองช่องเอาไว้ให้ระบบใช้ตอนต้องหาทางเข้าเอง ใส่เท่าที่มีจริงในแอป ไม่ต้องแต่งเพิ่ม

ค่าทุกช่องต้องมาจากโค้ดของเดโมที่กำลังอ่านอยู่เท่านั้น ห้ามลอกตัวอย่างข้างบน

กติกา:
- setup = หน้าจอที่ต้องผ่านก่อนถึงจะใช้งานระบบได้ (เข้าสู่ระบบ, เลือกบริษัท/สาขา, หน้าต้อนรับ) เรียงตามลำดับจริง · แต่ละอันมี name (ชื่อหน้าจอสำหรับใบเสนอราคา) และ click (ข้อความบนปุ่ม/การ์ดที่ต้องกดเพื่อผ่านไป) · ถ้าเปิดมาเจอหน้าหลักเลยให้เป็น []
- หน้าใน setup จะถูก "เก็บภาพด้วย" เพราะมันคือหน้าจอที่ต้องพัฒนาเหมือนกัน — ตั้งชื่อให้ดีเหมือนหน้าอื่น
- ถ้าหน้าเข้าสู่ระบบให้เลือก "บทบาท/สิทธิ์/บัญชีตัวอย่าง" ได้ ให้เลือกอันที่เห็นเมนูมากที่สุด (แอดมิน/เจ้าของ/ผู้ดูแล) เพราะเมนูบางอันแสดงเฉพาะสิทธิ์สูง ถ้าเข้าด้วยสิทธิ์ต่ำจะแคปหน้าจอได้ไม่ครบ
- ข้อความใน setup ต้องเป็นข้อความที่ "ปรากฏบนจอจริง" — ถ้าการ์ดแสดงชื่อจากข้อมูลตัวอย่าง ให้ใช้ชื่อจริงตัวแรกจากไฟล์ข้อมูล (เช่นชื่อบริษัทจริงใน src/data) ห้ามแต่งชื่อสมมติเช่น "บริษัทตัวอย่าง"
- อย่าใส่หน้ากั้นเหล่านั้นซ้ำใน screens ถ้ามันไม่ใช่หน้าที่ผู้ใช้กลับมาใช้งานอีก
- name = ชื่อหน้าจอที่คนอ่านเข้าใจ (ภาษาเดียวกับใน UI) — จะเอาไปใส่ใบเสนอราคา
- navText = "ข้อความที่มองเห็นบนปุ่ม/เมนู" ที่ต้องคลิกเพื่อไปหน้านั้น ต้องตรงกับข้อความในโค้ดเป๊ะ (ไม่ใช่ชื่อไฟล์ ไม่ใช่ id) · หน้าที่เปิดมาเจอเป็นหน้าแรกให้ navText เป็น ""
- subs = modal / drawer / panel / ขั้นตอนถัดไป ที่เปิดจากปุ่มในหน้านั้น — openBy/closeBy ก็ต้องเป็นข้อความที่มองเห็นจริงเช่นกัน
- expand = ถ้าเมนูนั้นอยู่ในกลุ่มที่ "พับ/กางได้" (accordion, submenu) ให้ใส่ข้อความของหัวข้อกลุ่มที่ต้องกดเพื่อกางก่อน · ถ้าเมนูอยู่ระดับบนสุดเห็นได้เลย ให้เป็น ""
- ห้ามใส่ "หัวข้อกลุ่ม" ใน sidebar (ข้อความหมวดที่กดไม่ได้ มักเป็นตัวเล็ก/สีจาง คั่นกลุ่มเมนู) เป็นหน้าจอ — ใส่เฉพาะเมนูที่กดแล้วเปลี่ยนหน้าจริง
- ใส่ทุกหน้าที่ผู้ใช้เข้าถึงได้ และทุก modal ที่เปิดได้จริง ห้ามเดาสิ่งที่ไม่มีในโค้ด
- ใส่ modal ให้ครบที่สุด: หา state แบบ useState ที่ชื่อประมาณ open/show/modal/drawer/dialog แล้วดูว่าปุ่มไหนตั้งค่าให้เป็น true — ปุ่มนั้นคือ openBy (ใช้ข้อความที่ผู้ใช้เห็นบนปุ่ม ไม่ใช่ชื่อตัวแปร)
- ถ้าปุ่มเป็นไอคอนล้วนไม่มีข้อความ ให้ใช้ข้อความใน aria-label/title แทน · ถ้าไม่มีอะไรเลยให้ข้ามไป ระบบมีวิธีหาเองอยู่แล้ว
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
  const empty: ScreenMap = { setup: [], screens: [], forward: [], avoid: [] };
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
  // Tolerates the older shape (a bare string) — then the label doubles as the name.
  const setup: ScreenGate[] = (Array.isArray(rawSetup) ? rawSetup : [])
    .slice(0, 6)
    .map((v) => {
      if (typeof v === "string") return { name: text(v), click: text(v) };
      const o = (v ?? {}) as Record<string, unknown>;
      const click = text(o.click);
      return { name: text(o.name) || click, click };
    })
    .filter((g) => g.click.length > 0);
  const list = screens
    .slice(0, 40)
    .map((s) => {
      const o = s as Record<string, unknown>;
      return {
        name: text(o.name) || "หน้าจอ",
        navText: text(o.navText),
        expand: text(o.expand) || undefined,
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
  const words = (key: "forward" | "avoid"): string[] => {
    const raw = (parsed as Record<string, unknown>)[key];
    return (Array.isArray(raw) ? raw : []).slice(0, 12).map((v) => text(v, 40)).filter(Boolean);
  };
  return { setup, screens: list, forward: words("forward"), avoid: words("avoid") };
}

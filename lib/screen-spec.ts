import type { ProjectFiles } from "./types";

/**
 * What each screen DOES, written from the code, for the quotation.
 *
 * A line that says only "หน้าจัดการผู้ใช้ · 2.5 วัน" asks the customer to take
 * the price on faith. A line that also says what the screen contains is the
 * same price with the scope attached — and the scope is what an estimate is
 * actually about. The model that can answer this is the one that can read the
 * source, so this reads the source rather than the screenshot.
 */

export const SCREEN_SPEC_SYSTEM = `คุณกำลังอ่านซอร์สโค้ดของเว็บระบบ (Vite + React) แล้วเขียน "คำอธิบายการทำงานของแต่ละหน้าจอ" เพื่อนำไปใส่ใบเสนอราคาให้ลูกค้าอ่าน

ตอบเป็น JSON อย่างเดียว: {"<ชื่อหน้าจอที่ให้มา>":"<คำอธิบาย>", ...}

กติกา:
- ใช้ "ชื่อหน้าจอ" จากรายการที่ให้มาเป็น key เป๊ะๆ ห้ามแก้ ห้ามเพิ่มชื่อที่ไม่ได้ให้มา ห้ามข้ามชื่อไหน
- คำอธิบาย 1-3 ประโยค ภาษาไทย เขียนให้ "ลูกค้าที่ไม่ใช่โปรแกรมเมอร์" อ่านรู้เรื่อง
- บอกว่าหน้านี้ทำอะไรได้บ้าง มีข้อมูลอะไรแสดง มีปุ่ม/ฟังก์ชันสำคัญอะไร เช่น ค้นหา กรอง เรียงลำดับ อัปโหลด ส่งออก อนุมัติ คำนวณ
- อ้างจากโค้ดจริงเท่านั้น ห้ามแต่งฟีเจอร์ที่ไม่มีในโค้ด ถ้าหน้าไหนหาไม่เจอในโค้ดให้เขียนสั้นๆ ตามชื่อหน้าอย่างเดียว
- ห้ามพูดถึงชื่อไฟล์ ชื่อตัวแปร ชื่อ component หรือศัพท์เทคนิค (state, props, component, API) — ลูกค้าไม่ได้อ่านโค้ด
- ห้ามประเมินราคา ห้ามบอกจำนวนวัน
- ไม่มี markdown ไม่มีคำอธิบายนอก JSON`;

/** Per-file cap; the whole dump is capped again so one huge app cannot blow the window. */
const FILE_CHARS = 6_000;
const TOTAL_CHARS = 120_000;

/**
 * The code that decides what a screen contains — pages and feature components.
 *
 * Wider than the screen map's dump, which only needed navigation: describing a
 * screen means reading the table, the form and the modal that live on it.
 */
export function buildScreenSpecUser(files: ProjectFiles, names: string[]): string {
  const relevant = Object.keys(files)
    .filter((p) => /^src\/(App|pages\/|components\/)/.test(p) && /\.(tsx|jsx)$/.test(p))
    .sort();
  let used = 0;
  const chunks: string[] = [];
  for (const path of relevant) {
    if (used >= TOTAL_CHARS) break;
    const body = files[path].slice(0, FILE_CHARS);
    used += body.length;
    chunks.push(`--- ${path} ---\n${body}`);
  }
  return `รายชื่อหน้าจอที่ต้องเขียนคำอธิบาย (ใช้เป็น key เป๊ะๆ ทุกตัว):
${names.map((n) => `- ${n}`).join("\n")}

โค้ดของระบบ:

${chunks.join("\n\n")}`;
}

/**
 * Parse the answer back to name → description, keeping only names we asked
 * about. A model that invents a screen would otherwise put a line on a
 * quotation for work nobody scoped.
 */
export function parseScreenSpecs(raw: string, names: string[]): Record<string, string> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const asked = new Set(names);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!asked.has(key) || typeof value !== "string") continue;
    const text = value.replace(/\s+/g, " ").trim().slice(0, 400);
    if (text) out[key] = text;
  }
  return out;
}

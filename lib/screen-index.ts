import type { ProjectFiles } from "./types";

/**
 * The screen index: a hidden door per screen, written by the model that wrote
 * the app.
 *
 * Everything before this tried to DISCOVER how to reach a screen — read the
 * code and guess a menu label, or press likely-looking buttons and see what
 * happens. On a real app that guess keeps being wrong: menus hide inside shut
 * accordions, appear only for some roles, sit behind a company picker, and
 * modals are hand-rolled divs with no role="dialog".
 *
 * The app's author knows all of it exactly. So it declares the doors instead:
 *
 *   <div data-fitt-index style={{ display: "none" }}>
 *     <button data-fitt-screen="ใบแจ้งหนี้" onClick={() => { signIn(ADMIN); setPage("invoices"); }} />
 *     <button data-fitt-screen="สร้างใบแจ้งหนี้" data-fitt-modal onClick={() => setCreateOpen(true)} />
 *   </div>
 *
 * The capture bot clicks them. No hunting, no heuristics, no partial coverage.
 * Screen entries live in App.tsx (always mounted); modal entries live in the
 * component that owns the modal's state, so they only exist while their screen
 * is on — which is exactly how the walk knows which screen a modal belongs to.
 */

/** Marks the hidden container. Presence of this is what "has an index" means. */
export const SCREEN_INDEX_MARK = "data-fitt-index";

/** One index entry, as declared in source. */
export interface ScreenIndexEntry {
  name: string;
  /** A modal/drawer/panel of the screen that renders it, not a screen itself. */
  modal: boolean;
}

/**
 * Index entries declared across the project's source.
 *
 * The whole tag is matched, so `data-fitt-modal` is found whichever side of
 * `data-fitt-screen` the model wrote it on.
 */
export function screenIndexEntries(files: ProjectFiles | null | undefined): ScreenIndexEntry[] {
  if (!files) return [];
  const out: ScreenIndexEntry[] = [];
  const tag = /<button\b[^>]*\bdata-fitt-screen\s*=\s*["']([^"']+)["'][^>]*>/g;
  for (const [path, source] of Object.entries(files)) {
    if (!/\.(tsx|jsx)$/.test(path)) continue;
    for (const m of source.matchAll(tag)) {
      out.push({ name: m[1], modal: /\bdata-fitt-modal\b/.test(m[0]) });
    }
  }
  return out;
}

/** Does this project declare any doors at all? Drives the retrofit prompt. */
export function hasScreenIndex(files: ProjectFiles | null | undefined): boolean {
  if (!files) return false;
  return Object.entries(files).some(
    ([path, source]) => /\.(tsx|jsx)$/.test(path) && source.includes(SCREEN_INDEX_MARK)
  );
}

/**
 * The canned prompt behind "เพิ่มดัชนีหน้าจอ": retrofit the index into a
 * project generated before the contract existed. Behaviour-preserving on
 * purpose — the buttons never render, so the demo must look identical after.
 */
export const SCREEN_INDEX_PROMPT = `เพิ่ม "ดัชนีหน้าจอ" ให้โปรเจกต์นี้ เพื่อให้ระบบแคปหน้าจออัตโนมัติเข้าถึงได้ครบทุกหน้า (เป็นการเพิ่มปุ่มที่ซ่อนไว้เท่านั้น — หน้าตา UI ฟีเจอร์ และข้อมูล ต้องเหมือนเดิม 100% ผู้ใช้ต้องไม่เห็นอะไรเปลี่ยนเลย):

1) ที่ src/App.tsx ต่อท้าย JSX ที่ return ใส่บล็อกนี้:
<div data-fitt-index style={{ display: "none" }}>
  <button data-fitt-screen="<ชื่อหน้าจอ>" onClick={() => { /* ตั้ง state ทุกตัวที่ทำให้ไปโผล่หน้านั้น */ }} />
</div>
- ต้องมีครบ "ทุกหน้าจอ" ที่ผู้ใช้เข้าถึงได้ รวมหน้าที่อยู่หลังหน้าเข้าสู่ระบบ / เลือกบริษัท / สิทธิ์ผู้ใช้
- onClick ต้องพาไปถึงหน้านั้นได้จริง "จากสถานะเริ่มต้น" ในคลิกเดียว เช่น ล็อกอินเป็นผู้ดูแลระบบ + เลือกบริษัท + สลับหน้า ให้ครบในฟังก์ชันเดียว
- ใส่หน้ากั้นเองด้วย เช่น <button data-fitt-screen="เข้าสู่ระบบ" onClick={() => setUser(null)} />
- ถ้าเมนูไหนแสดงเฉพาะบางสิทธิ์ ให้ตั้งสิทธิ์ที่เห็นหน้านั้นได้ก่อนใน onClick

2) ในไฟล์หน้า/คอมโพเนนต์ที่เป็น "เจ้าของ state" ของ modal / drawer / panel ให้ใส่บล็อกเดียวกัน แต่ปุ่มติด data-fitt-modal:
<div data-fitt-index style={{ display: "none" }}>
  <button data-fitt-screen="<ชื่อ modal>" data-fitt-modal onClick={() => setXxxOpen(true)} />
</div>
- ครบทุก modal / drawer / panel ที่เปิดได้จริงในหน้านั้น (ดู useState ที่ชื่อประมาณ open/show/modal/drawer/dialog)
- ถ้า modal ต้องมีข้อมูลที่เลือกไว้ก่อน ให้ตั้งค่าตัวอย่างจริงจาก src/data ใน onClick ด้วย

3) ชื่อใน data-fitt-screen = ชื่อที่ลูกค้าอ่านแล้วเข้าใจ ใช้ภาษาเดียวกับที่แสดงบน UI (ชื่อนี้จะถูกนำไปใส่ใบเสนอราคา) ห้ามซ้ำกัน
4) ปุ่มพวกนี้ไม่มีข้อความข้างใน ไม่ต้องใส่ className และต้องไม่แสดงผลบนจอ

ส่งเฉพาะไฟล์ที่เปลี่ยน`;

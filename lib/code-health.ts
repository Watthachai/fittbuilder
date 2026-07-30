import type { ProjectFiles } from "./types";

/**
 * Structure health of a generated project. One giant src/App.tsx is the failure
 * mode this guards: an edit must rewrite the whole file (≈30k output tokens for
 * 2,600 lines), so it truncates mid-string and a single stray brace takes the
 * entire app down. Small files keep an edit — and a syntax error — local.
 *
 * Used on both sides: the generator prompt (structure audit fed back to the
 * model on every iteration) and the Code panel banner.
 */

/** Size a generated source file should stay under — a file heading past this gets split. */
export const TARGET_MAX_LINES = 200;

/** Past this a file counts as structure debt (prompt directive + Code-panel banner). */
export const OVERSIZE_LINES = 300;

/** Docs (BRD/PRD) are legitimately long — only real source files are audited. */
const CODE_FILE = /\.(tsx?|jsx?|css|html)$/;

export interface OversizedFile {
  path: string;
  lines: number;
}

/** Source files that outgrew the structure contract, biggest first. */
export function oversizedFiles(files: ProjectFiles | null | undefined): OversizedFile[] {
  if (!files) return [];
  const out: OversizedFile[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (!CODE_FILE.test(path)) continue;
    const lines = content.split("\n").length;
    if (lines > OVERSIZE_LINES) out.push({ path, lines });
  }
  return out.sort((a, b) => b.lines - a.lines);
}

/**
 * The canned prompt behind "จัดโครงสร้างใหม่" in the Code panel: a
 * behaviour-preserving reorganization, spelled out so the model splits files
 * instead of taking the chance to redesign.
 */
export const REORGANIZE_PROMPT = `จัดโครงสร้างโค้ดใหม่ให้เป็นระเบียบแบบโปรเจกต์จริง (refactor เท่านั้น — ห้ามเปลี่ยนหน้าตา UI, ฟีเจอร์ หรือข้อมูลแม้แต่นิดเดียว หน้าจอต้องเหมือนเดิม 100%):
- src/App.tsx เหลือแค่ shell: layout + state ว่ากำลังเปิดหน้าไหน + render <XxxPage /> (ไม่เกิน 120 บรรทัด ห้ามมี markup ของฟีเจอร์)
- แต่ละหน้าจอแยกเป็น src/pages/XxxPage.tsx
- ชิ้นส่วนที่ใช้ซ้ำเป็น src/components/ui/*.tsx, ส่วน layout เป็น src/components/layout/*.tsx, ก้อนของฟีเจอร์เป็น src/components/<feature>/*.tsx
- mock data ย้ายไป src/data/*.ts, type รวมที่ src/types.ts, helper (format เงิน/วันที่) ไป src/lib/format.ts, custom hook ไป src/hooks/
- ทุกไฟล์ไม่เกิน ~200 บรรทัด และ 1 ไฟล์ = 1 component
ส่งเฉพาะไฟล์ที่เปลี่ยน และลบไฟล์เก่าที่ไม่ใช้แล้วด้วย`;

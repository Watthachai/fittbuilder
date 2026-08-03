import type { ChatAttachmentInput } from "./types";

/**
 * Wand: point at an element in the running demo and edit exactly it.
 *
 * The picked element carries `data-fitt-loc` (stamped by the Babel plugin in the
 * canonical vite.config — see lib/scaffold.ts), so a click resolves to an exact
 * file and line instead of a guess. That precision is what makes the targeted
 * prompt below cheap: the model rewrites one small file, not the whole app.
 */
export interface WandTarget {
  /** "src/components/orders/OrderTable.tsx:64:8" */
  loc: string;
  tag: string;
  className: string;
  text: string;
  /** Position inside the preview iframe, normalized 0..1. */
  rect: { x: number; y: number; w: number; h: number };
}

/** "src/components/orders/OrderTable.tsx:64:8" → { path, line } */
export function parseLoc(loc: string): { path: string; line: number } {
  const parts = loc.split(":");
  const line = Number(parts[parts.length - 2]);
  return { path: parts.slice(0, -2).join(":"), line: Number.isFinite(line) ? line : 0 };
}

/** Short label for the target chip: "OrderTable.tsx:64". */
export function shortLoc(loc: string): string {
  const { path, line } = parseLoc(loc);
  return `${path.split("/").pop()}:${line}`;
}

/**
 * The iteration prompt for a wand turn. Naming the file, the line and the
 * element the user is looking at removes the model's hardest step (finding the
 * thing "ตรงนี้" refers to) and keeps the diff to one element.
 */
export function buildWandPrompt(target: WandTarget, instruction: string): string {
  const { path, line } = parseLoc(target.loc);
  const bits = [
    `ผู้ใช้ชี้ element นี้ในหน้า preview แล้วสั่งแก้เฉพาะจุดนี้:`,
    `- ไฟล์: ${path} (บรรทัด ${line})`,
    `- แท็ก: <${target.tag}>`,
  ];
  if (target.className) bits.push(`- class ปัจจุบัน: ${target.className}`);
  if (target.text) bits.push(`- ข้อความข้างใน: "${target.text}"`);
  bits.push(
    "",
    `คำสั่ง: ${instruction}`,
    "",
    "กติกาของเทิร์นนี้:",
    `- แก้เฉพาะ element นี้ (และสิ่งที่จำเป็นต่อมันจริงๆ) ห้ามแตะส่วนอื่นของแอป`,
    `- ส่งเฉพาะไฟล์ที่เปลี่ยน — ปกติควรเป็น ${path} ไฟล์เดียว`,
    `- data-fitt-loc เป็น attribute ที่ระบบใส่ให้อัตโนมัติ ห้ามเขียนเองและห้ามลบของเดิม`
  );
  return bits.join("\n");
}

/** One quick edit: a deterministic patch, no model call. */
export interface QuickEdit {
  kind: "class" | "text";
  /** For "class": utilities to add (conflicting ones are replaced by prefix). */
  add?: string[];
  /** For "text": the new text content. */
  text?: string;
  /** Human label for the chat/terminal line. */
  label: string;
}

export interface WandRequest {
  target: WandTarget;
  instruction: string;
  attachments?: ChatAttachmentInput[];
}

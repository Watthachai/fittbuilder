import { DOC_PATHS } from "@/lib/define";
import { SCAFFOLD_FILES } from "@/lib/scaffold";
import type { ProjectFiles } from "@/lib/types";
import { composeModules } from "./compose";
import type { Module } from "./types";

/**
 * A module selection, as a project the studio can open and run.
 *
 * `composeModules` stays pure — modules in, answers out — so it knows nothing
 * about scaffolds or document paths. This is the thin layer that turns its
 * answers into the shape the rest of the app already speaks: the same flat
 * `ProjectFiles` map the generator produces, which means the studio boots it
 * through the ordinary path with nothing special-cased for modules.
 *
 * The scaffold goes UNDER the composed files, never over: the composer owns
 * `src/App.tsx` and the scaffold ships a placeholder of the same name, so the
 * spread order is the difference between the chosen modules and a waiting-room
 * screen.
 *
 * The PRD is written here rather than left for the interview, because the
 * production build reads documents and not the prototype's source — a project
 * born from a module selection would otherwise reach Code Runner with its scope
 * stated nowhere.
 */
export function projectFilesFor(selected: Module[]): ProjectFiles {
  const composed = composeModules(selected);
  return {
    ...SCAFFOLD_FILES,
    ...composed.files,
    [DOC_PATHS.prd]: prdDocument(composed.prdSection, selected),
  };
}

function prdDocument(scope: string, selected: Module[]): string {
  const names = selected.map((m) => m.name).join(" · ");
  const days = selected.reduce((n, m) => n + m.effortDays, 0);
  const ma = selected.reduce((n, m) => n + m.maPerMonth, 0);
  return `# PRD — ระบบที่ประกอบจากโมดูลมาตรฐาน

ขอบเขตนี้ถูกเลือกจากแคตตาล็อกโมดูล ไม่ได้มาจากการสัมภาษณ์ — แต่ละโมดูลมีขอบเขตงาน
และราคาที่กำหนดไว้ล่วงหน้า และเดโมที่เห็นคือสิ่งที่โมดูลเหล่านี้สร้างขึ้นจริง

โมดูลที่เลือก: ${names}
แรงงานรวม: ${days} วัน · ค่าดูแลรายเดือน: ${ma.toLocaleString("th-TH")} บาท

${scope}

## สิ่งที่ต้องรักษาไว้เมื่อสร้างเป็นระบบจริง

ความเป็นเจ้าของข้อมูลที่ระบุไว้ข้างบนคือข้อกำหนด ไม่ใช่คำอธิบาย โมดูลที่อ่าน
ข้อมูลของโมดูลอื่นต้องอ่านจากแหล่งเดียวกันนั้น ห้ามสร้างตารางของตัวเองขึ้นมาซ้ำ
เพราะสองตารางที่เก็บเรื่องเดียวกันจะเริ่มขัดกันตั้งแต่การแก้ไขครั้งแรก
`;
}

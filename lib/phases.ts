/**
 * The forced production flow (mirrors DVIBE). Owner view / dev view:
 *   Define → Plan → Build → Verify → Review → Ship
 *   Idea   → Spec → Code  → Test   → QA     → Production
 * Each phase is owned by exactly one SKILL.md agent (see agents/<slug>/).
 */
export const PHASES = [
  { id: "define", user: "Define", dev: "Idea",       agent: "idea-interviewer", name: "ผู้สัมภาษณ์ไอเดีย", blurb: "เปลี่ยนไอเดียให้เป็น BRD ที่ชัดเจน ไม่มีคำว่า 'น่าจะ'" },
  { id: "plan",   user: "Plan",   dev: "Spec",       agent: "spec-writer",      name: "ผู้เขียนสเปก",     blurb: "แปลง BRD ที่อนุมัติแล้วเป็น PRD ให้ทีม dev" },
  { id: "build",  user: "Build",  dev: "Code",       agent: "code-builder",     name: "ผู้สร้างโค้ด",     blurb: "สร้าง prototype ที่คลิกได้จาก BRD/PRD" },
  { id: "verify", user: "Verify", dev: "Test",       agent: "test-runner",      name: "ผู้ตรวจสอบ",       blurb: "พิสูจน์ว่าแต่ละหน้าจอใช้งานได้จริง" },
  { id: "review", user: "Review", dev: "QA",         agent: "qa-reviewer",      name: "ผู้รีวิวคุณภาพ",   blurb: "ตรวจอ่านง่าย ปลอดภัย และ performance" },
  { id: "ship",   user: "Ship",   dev: "Production", agent: "shipper",          name: "ผู้ส่งมอบ",        blurb: "สรุปการส่งมอบ แชร์ลิงก์ และ export โค้ด" },
] as const;

export type PhaseId = (typeof PHASES)[number]["id"];
export type AgentSlug = (typeof PHASES)[number]["agent"];

export const PHASE_IDS = PHASES.map((p) => p.id) as PhaseId[];

export function phaseDef(id: PhaseId): (typeof PHASES)[number] {
  const def = PHASES.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown phase: ${id}`);
  return def;
}

export function phaseIndex(id: PhaseId): number {
  return PHASES.findIndex((p) => p.id === id);
}

export function agentSlugForPhase(id: PhaseId): AgentSlug {
  return phaseDef(id).agent;
}

export function nextPhase(id: PhaseId): PhaseId | null {
  const i = phaseIndex(id);
  return i >= 0 && i < PHASES.length - 1 ? PHASES[i + 1].id : null;
}

export function phaseLabel(id: PhaseId, view: "user" | "dev" = "user"): string {
  return phaseDef(id)[view];
}

/** "build" is the only phase that emits runnable code; the rest emit markdown docs. */
export function isBuildPhase(id: PhaseId): boolean {
  return id === "build";
}

export function isPhaseId(value: unknown): value is PhaseId {
  return typeof value === "string" && (PHASE_IDS as string[]).includes(value);
}

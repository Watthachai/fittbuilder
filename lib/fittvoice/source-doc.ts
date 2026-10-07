import { CATEGORIES, WORKFLOWS, type Assertion, type CategoryKey, type Delivery, type Item, type WorkflowItem } from "./types";

/**
 * A FITT Voice delivery as the document people read in the studio and the
 * Define/Plan agents read as their source.
 *
 * The contract's one hard rule about display is that nobody may mistake a
 * proposal for something the customer said: every item carries who it comes
 * from in words and a symbol, never colour alone, and a draft says it is a
 * draft above everything else.
 */

const ASSERTION: Record<Assertion, string> = {
  CUSTOMER_STATED: "🗣 ลูกค้าระบุ",
  USER_CONFIRMED: "✔︎ ผู้ตรวจยืนยัน",
  AI_PROPOSED: "💡 AI เสนอ — ยังไม่ยืนยัน",
};

const CATEGORY: Record<CategoryKey, string> = {
  businessContext: "บริบทธุรกิจ",
  goals: "เป้าหมาย",
  actors: "ผู้ใช้งานและผู้เกี่ยวข้อง",
  asIsWorkflow: "ขั้นตอนทำงานปัจจุบัน",
  painPoints: "ปัญหาที่พบ",
  functionalRequirements: "สิ่งที่ระบบต้องทำ",
  nonFunctionalRequirements: "คุณสมบัติด้านอื่นของระบบ",
  toBeWorkflow: "ขั้นตอนที่ต้องการหลังมีระบบ",
  businessRules: "กฎทางธุรกิจ",
  dataEntities: "ข้อมูลหลัก",
  integrations: "ระบบที่ต้องเชื่อม",
  constraints: "ข้อจำกัด",
  acceptanceCriteria: "เกณฑ์ยอมรับงาน",
  openQuestions: "คำถามที่ต้องถามเพิ่ม",
  outOfScope: "ไม่อยู่ในขอบเขต",
};

export const DRAFT_LABEL = "ร่างระหว่างคุย — ยังไม่ตรวจ";

/** Milliseconds from the start of the recording, as m:ss or h:mm:ss. */
function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  return h ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/** Markdown text from the payload stays text — it cannot open a heading or a list here. */
const inline = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();

export function sourceMarkdown(d: Delivery): string {
  const discovery = d.content.discovery;
  const actorText = new Map(discovery.actors.items.map((a) => [a.id, a.text]));
  const isWorkflow = (key: CategoryKey) => (WORKFLOWS as readonly string[]).includes(key);

  const itemLine = (item: Item, workflow: boolean): string => {
    const parts = [`- **${ASSERTION[item.assertion]}** · ${inline(item.text)}`];
    if (item.priority !== "UNSPECIFIED") parts.push(`ความสำคัญ ${item.priority}`);
    if (workflow) {
      const w = item as WorkflowItem;
      if (w.actorId) parts.push(`ผู้ทำ: ${inline(actorText.get(w.actorId) ?? w.actorId)}`);
      if (w.tool) parts.push(`เครื่องมือ: ${inline(w.tool)}`);
      if (w.input) parts.push(`ข้อมูลเข้า: ${inline(w.input)}`);
      if (w.output) parts.push(`ข้อมูลออก: ${inline(w.output)}`);
      if (w.nextStepId) parts.push(`ต่อไปที่: ${w.nextStepId}`);
    }
    if (item.evidenceIds.length) parts.push(`หลักฐาน: ${item.evidenceIds.join(", ")}`);
    return `${parts.join(" · ")} \`${item.id}\``;
  };

  const status =
    d.stage === "DRAFT"
      ? `> **${DRAFT_LABEL}** — ข้อความลื่นไหลไม่ได้แปลว่ายืนยันแล้ว`
      : `> ตรวจแล้วโดย ${d.review!.reviewerRef} เมื่อ ${d.review!.reviewedAt}`;

  const captured = CATEGORIES.filter((c) => discovery[c].knowledgeStatus === "CAPTURED");
  const notCaptured = CATEGORIES.filter((c) => discovery[c].knowledgeStatus === "NOT_CAPTURED");
  const none = CATEGORIES.filter((c) => discovery[c].knowledgeStatus === "CONFIRMED_NONE");

  const sections = captured.map(
    (c) => `### ${CATEGORY[c]}\n\n${discovery[c].items.map((i) => itemLine(i, isWorkflow(c))).join("\n")}`
  );

  return [
    `# ${inline(d.content.projectTitle)}`,
    status,
    `ข้อมูลจาก FITT Voice · ฉบับที่ ${d.snapshotRevision} · ส่งเมื่อ ${d.sentAt}`,
    `## สรุป${d.stage === "DRAFT" ? ` (${DRAFT_LABEL})` : ""}`,
    d.content.summaryMarkdown,
    "## ข้อมูลธุรกิจ",
    ...sections,
    notCaptured.length ? `ยังไม่มีข้อมูล: ${notCaptured.map((c) => CATEGORY[c]).join(", ")}` : "",
    none.length ? `ผู้ตรวจยืนยันว่าไม่มี: ${none.map((c) => CATEGORY[c]).join(", ")}` : "",
    "## หลักฐานจากการสัมภาษณ์",
    d.evidence
      .map((e) => `- \`${e.id}\` · ${clock(e.startMs)}–${clock(e.endMs)} · ${inline(e.speaker ?? "ไม่ทราบผู้พูด")}: “${inline(e.text)}”`)
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

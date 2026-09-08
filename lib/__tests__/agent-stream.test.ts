import { describe, expect, it } from "vitest";
import { AgentStreamFilter } from "../agent-stream";

/**
 * A document is allowed to contain code fences of its own.
 *
 * The spec-writer answered a round of PRD feedback with a v2.0 that drew its
 * trip state machine in a ```text block at §3.1. The filter closed the ```prd
 * block at that first inner fence, so docs/PRD.md was saved cut off mid-section
 * and §3.2 through §11 — sixteen thousand characters of it — fell through into
 * the chat reply instead. The user's next message was "3. State Machines &
 * Status Contracts เหมือนจะมีรายละเอียดไม่ครบนะครับ", which is exactly where the
 * knife went in. The leaked reply then blew the message cap and 400'd every
 * following turn of that phase, so the project could not advance at all.
 */
const PRD = [
  "# PRD — ระบบจัดรอบรถ",
  "",
  "## 3. State Machines & Status Contracts",
  "",
  "### 3.1 Trip Status Lifecycle",
  "",
  "```text",
  "DRAFT -> PLANNED -> IN_TRANSIT -> DELIVERED",
  "```",
  "",
  "## 4. โครงสร้างข้อมูล",
  "",
  "```json",
  '{ "shipment_lines": ["so_no", "qty"] }',
  "```",
  "",
  "## 11. Out of Scope",
  "",
  "ระบบบัญชี",
].join("\n");

const STREAM = `จัดทำเอกสาร PRD ให้เรียบร้อยแล้วครับ

\`\`\`prd
${PRD}
\`\`\`
ตรวจสอบได้ที่ docs/PRD.md แล้วกดอนุมัติได้เลยครับ`;

describe("AgentStreamFilter · nested fences inside a document", () => {
  it("keeps the whole document, past its own fenced blocks", () => {
    const f = new AgentStreamFilter();
    f.push(STREAM);
    const turn = f.getTurn();

    expect(turn.docs.prd).toBe(PRD);
    // The sections that used to be lost at the first inner fence.
    expect(turn.docs.prd).toContain("## 4. โครงสร้างข้อมูล");
    expect(turn.docs.prd).toContain("## 11. Out of Scope");
  });

  it("leaves the document out of the chat reply", () => {
    const f = new AgentStreamFilter();
    f.push(STREAM);
    const turn = f.getTurn();

    expect(turn.reply).toBe(
      "จัดทำเอกสาร PRD ให้เรียบร้อยแล้วครับ\n\nตรวจสอบได้ที่ docs/PRD.md แล้วกดอนุมัติได้เลยครับ"
    );
    // What overflowed the chat bubble — and then the request schema.
    expect(turn.reply).not.toContain("## 4.");
    expect(turn.reply).not.toContain("```");
  });

  it("reaches the same result one character at a time", () => {
    // The fence and its info string routinely straddle a chunk boundary, and
    // the info string is what tells an opening fence from a closing one.
    const f = new AgentStreamFilter();
    for (const ch of STREAM) f.push(ch);
    const turn = f.getTurn();

    expect(turn.docs.prd).toBe(PRD);
    expect(turn.reply).not.toContain("## 4.");
  });

  it("still closes a document that has no fences of its own", () => {
    const f = new AgentStreamFilter();
    f.push("นี่คือ BRD ครับ\n\n```brd\n# BRD\n- ข้อกำหนด\n```\nจบแล้วครับ");
    const turn = f.getTurn();

    expect(turn.docs.brd).toBe("# BRD\n- ข้อกำหนด");
    expect(turn.reply).toBe("นี่คือ BRD ครับ\n\nจบแล้วครับ");
  });

  it("does not swallow the closing fence when the stream ends on it", () => {
    // No trailing newline after the terminator — the fence is held waiting for
    // one, and must not be salvaged into the document as content.
    const f = new AgentStreamFilter();
    f.push("```brd\n# BRD\n- ข้อกำหนด\n```");
    expect(f.getTurn().docs.brd).toBe("# BRD\n- ข้อกำหนด");
  });

  it("salvages a document cut off inside a nested block", () => {
    // maxOutputTokens hit mid-diagram: keep what was written rather than lose
    // the document entirely.
    const f = new AgentStreamFilter();
    f.push("```prd\n# PRD\n\n```text\nDRAFT -> PLANNED");
    const turn = f.getTurn();

    expect(turn.docs.prd).toContain("# PRD");
    expect(turn.docs.prd).toContain("DRAFT -> PLANNED");
  });

  it("still reads an ask block, and keeps it out of the reply", () => {
    const f = new AgentStreamFilter();
    f.push(
      'เลือกได้เลยครับ\n\n```ask\n{"question":"ธุรกิจแบบไหน?","options":["ร้านอาหาร","ร้านค้าออนไลน์"]}\n```\n'
    );
    const turn = f.getTurn();

    expect(turn.ask?.options).toEqual(["ร้านอาหาร", "ร้านค้าออนไลน์"]);
    expect(turn.reply).toBe("เลือกได้เลยครับ");
  });
});

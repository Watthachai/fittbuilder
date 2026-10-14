import { describe, expect, it } from "vitest";
import { proposalDocx } from "@/lib/proposal-word";
import { newProposal, type ProposalDoc } from "@/lib/proposal";
import { emptyRow, newDoc } from "@/lib/quote";
import type { Shot } from "@/lib/shots";
import { PIXEL, readWord } from "./fixtures/word";

/**
 * Case #27: the proposal as a Word file — ProposalPrint's switches hold in the
 * .docx exactly as they do on paper.
 */
const shots: Shot[] = [
  { path: "a.png", name: "รายการสินค้า", parent: null, index: 0, url: "https://x/a.png", from: null, via: null },
  { path: "b.png", name: "ตะกร้า", parent: null, index: 1, url: "https://x/b.png", from: "รายการสินค้า", via: "หยิบใส่ตะกร้า" },
];
const art = {
  logo: null,
  shots: new Map(shots.map((s) => [s.url, { data: PIXEL, type: "png" as const, width: 4, height: 3 }])),
};
const quote = { ...newDoc([], "Mabuchi", "2026-10-14"), quoteNo: "SQP-0001" };

function proposal(over: Partial<ProposalDoc> = {}): ProposalDoc {
  return {
    ...newProposal("Mabuchi", "2026-10-14"),
    proposalNo: "PRP-0003",
    screenDocs: { ตะกร้า: { does: "รวมสินค้าที่เลือก", how: "- กดหยิบใส่ตะกร้า\n- ตรวจจำนวน", result: "" } },
    excluded: ["เชื่อมต่อ ERP"],
    ...over,
  };
}

describe("the proposal as a Word file", () => {
  it("walks every step with its manual, numbered under the step", async () => {
    const { header, body, pictures } = await readWord(proposalDocx(proposal(), quote, shots, art));
    expect(header).toContain("ข้อเสนอโครงการ");
    expect(header).toContain("PRP-0003");
    expect(body).toContain("ขั้นตอนที่ 2");
    expect(body).toContain("จากหน้า “รายการสินค้า” กด “หยิบใส่ตะกร้า” → ตะกร้า");
    expect(body).toContain("2.1\tกดหยิบใส่ตะกร้า");
    expect(body).toContain("2.2\tตรวจจำนวน");
    expect(body).toContain("เชื่อมต่อ ERP");
    expect(pictures.body).toBe(2);
  });

  it("keeps the walk but packs no picture when the screenshots are switched off", async () => {
    const { body, pictures } = await readWord(proposalDocx(proposal({ showShots: false }), quote, shots, art));
    expect(body).toContain("รวมสินค้าที่เลือก");
    expect(pictures.body).toBe(0);
  });

  it("names the quotation in the header and the price section only while the switch is on", async () => {
    const on = await readWord(proposalDocx(proposal(), quote, [], art));
    const off = await readWord(proposalDocx(proposal({ showQuoteRef: false }), quote, [], art));
    expect(on.header).toContain("อ้างถึงใบเสนอราคา :");
    expect(on.body).toContain("ตามใบเสนอราคาเลขที่ SQP-0001");
    expect(off.header).not.toContain("SQP-0001");
    expect(off.body).not.toContain("ราคาและเงื่อนไขการชำระเงิน");
  });

  it("leaves the build time out when the quotation counts no man-days", async () => {
    const byUnit = { ...quote, rows: [{ ...emptyRow(), name: "ค่าพัฒนาระบบ", pricing: "unit" as const, qty: 1, unitPrice: 450_000 }] };
    const { body } = await readWord(proposalDocx(proposal(), byUnit, [], art));
    expect(body).not.toContain("วันทำการ");
    expect(body).toContain("ตรวจรับหลังส่งมอบ");
  });
});

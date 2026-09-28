import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AUDITS, CAPAS, DOCUMENTS, GAUGES, LOTS, NCRS } from "../../demo/modules/qm/data";
import { QmPaper } from "../../demo/modules/qm/documents";
import type { QmDoc } from "../../demo/modules/qm/documents";

/**
 * ทุกใบที่ระบบพิมพ์คือแบบฟอร์มควบคุม (ข้อ 7.5.3) ผู้ตรวจประเมินจะหยิบใบจริงมาเทียบกับ
 * บัญชีรายชื่อเอกสาร ถ้ารหัสที่มุมกระดาษไม่อยู่ในบัญชี หรือฉบับไม่ตรงกับที่ใช้งาน
 * คือข้อบกพร่องทันที — ระบบที่ขายว่าพร้อมรับการตรวจจึงพิมพ์แบบนั้นไม่ได้
 */
const printed: QmDoc[] = [
  { doc: "master-list" },
  { doc: "lot", no: LOTS.find((l) => l.origin === "ตรวจรับ")!.no },
  { doc: "lot", no: LOTS.find((l) => l.origin === "ตรวจก่อนส่ง" && l.decision === "ผ่าน")!.no },
  { doc: "ncr", no: NCRS[0].no },
  { doc: "car", no: CAPAS[0].no },
  { doc: "audit", no: AUDITS[0].no },
  { doc: "gauge", code: GAUGES[0].code },
];

const formOn = (d: QmDoc) => {
  const html = renderToStaticMarkup(createElement(QmPaper, { d }));
  const m = html.match(/(FM-[\w-]+) Rev\.(\d+)/);
  if (!m) throw new Error(`ไม่พบเลขแบบฟอร์มบน ${d.doc}`);
  return { code: m[1], rev: Number(m[2]) };
};

describe("printed quality forms", () => {
  for (const d of printed) {
    it(`prints ${d.doc} on a form listed in the master list at its current revision`, () => {
      const { code, rev } = formOn(d);
      const listed = DOCUMENTS.find((x) => x.code === code);
      expect(listed, `${code} ไม่อยู่ในบัญชีรายชื่อเอกสาร`).toBeDefined();
      expect(listed!.status).toBe("ใช้งาน");
      expect(rev).toBe(listed!.rev);
    });
  }

  it("prints a new revision once the form is revised and approved", async () => {
    const { reviseDocument, submitDocument, approveDocument, QMR } = await import("../../demo/modules/qm/data");
    const before = formOn({ doc: "ncr", no: NCRS[0].no });
    reviseDocument(before.code, "เพิ่มช่องลายมือชื่อผู้ขาย", "สุภาพร แก้วมณี");
    submitDocument(before.code);
    approveDocument(before.code, QMR);
    expect(formOn({ doc: "ncr", no: NCRS[0].no })).toEqual({ code: before.code, rev: before.rev + 1 });
  });
});

import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AUDITS, CAPAS, DOCUMENTS, QMR, REVIEWS, approveDocument, reviseDocument, submitDocument } from "../../demo/modules/ims/data";
import { ImsPaper } from "../../demo/modules/ims/documents";
import type { ImsDoc } from "../../demo/modules/ims/documents";
import { APPROVALS, DESIGNS, GAUGES, LOTS, NCRS, commitments } from "../../demo/modules/qm/data";
import { QmPaper } from "../../demo/modules/qm/documents";
import type { QmDoc } from "../../demo/modules/qm/documents";
import { DRILLS, MONITORINGS } from "../../demo/modules/em/data";
import { EmPaper } from "../../demo/modules/em/documents";
import type { EmDoc } from "../../demo/modules/em/documents";

/**
 * ทุกใบที่ระบบมาตรฐานพิมพ์คือแบบฟอร์มควบคุม (ข้อ 7.5.3) ผู้ตรวจประเมินจะหยิบใบจริงมาเทียบกับ
 * บัญชีรายชื่อเอกสาร ถ้ารหัสที่มุมกระดาษไม่อยู่ในบัญชี หรือฉบับไม่ตรงกับที่ใช้งาน
 * คือข้อบกพร่องทันที — ระบบที่ขายว่าพร้อมรับการตรวจจึงพิมพ์แบบนั้นไม่ได้
 */
const papers: [string, () => string][] = [
  ...([
    { doc: "master-list" },
    { doc: "car", no: CAPAS[0].no },
    { doc: "audit", no: AUDITS[0].no },
    { doc: "risks" },
    { doc: "person", name: QMR },
    { doc: "review", no: REVIEWS[0].no },
  ] as ImsDoc[]).map((d) => [`ระบบบริหารบูรณาการ ${d.doc}`, () => renderToStaticMarkup(createElement(ImsPaper, { d }))] as [string, () => string]),
  ...([
    { doc: "lot", no: LOTS.find((l) => l.origin === "ตรวจรับ")!.no },
    { doc: "lot", no: LOTS.find((l) => l.origin === "ตรวจก่อนส่ง" && l.decision === "ผ่าน")!.no },
    { doc: "ncr", no: NCRS[0].no },
    { doc: "gauge", code: GAUGES[0].code },
    { doc: "requirement", no: commitments()[0].doc },
    { doc: "design", no: DESIGNS[0].no },
    { doc: "supplier", code: APPROVALS[0].vendor },
    { doc: "satisfaction" },
  ] as QmDoc[]).map((d) => [`บริหารคุณภาพ ${d.doc}`, () => renderToStaticMarkup(createElement(QmPaper, { d }))] as [string, () => string]),
  ...([
    { doc: "aspects" },
    { doc: "obligations" },
    { doc: "waste" },
    { doc: "monitoring", no: MONITORINGS[0].no },
    { doc: "drill", no: DRILLS[0].no },
  ] as EmDoc[]).map((d) => [`สิ่งแวดล้อม ${d.doc}`, () => renderToStaticMarkup(createElement(EmPaper, { d }))] as [string, () => string]),
];

const formOn = (html: string) => {
  const m = html.match(/(FM-\d+) Rev\.(\d+)/);
  if (!m) throw new Error("ไม่พบเลขแบบฟอร์มบนกระดาษ");
  return { code: m[1], rev: Number(m[2]) };
};

describe("printed standards forms", () => {
  for (const [name, render] of papers) {
    it(`prints ${name} on a form listed in the master list at its current revision`, () => {
      const { code, rev } = formOn(render());
      const listed = DOCUMENTS.find((x) => x.code === code);
      expect(listed, `${code} ไม่อยู่ในบัญชีรายชื่อเอกสาร`).toBeDefined();
      expect(listed!.status).toBe("ใช้งาน");
      expect(rev).toBe(listed!.rev);
    });
  }

  it("prints a new revision once the form is revised and approved", () => {
    const ncr = () => renderToStaticMarkup(createElement(QmPaper, { d: { doc: "ncr", no: NCRS[0].no } }));
    const before = formOn(ncr());
    reviseDocument(before.code, "เพิ่มช่องลายมือชื่อผู้ขาย", "สุภาพร แก้วมณี");
    submitDocument(before.code);
    approveDocument(before.code, QMR);
    expect(formOn(ncr())).toEqual({ code: before.code, rev: before.rev + 1 });
  });
});

import { Paper } from "../kit";
import { QMR, TOP, formNo } from "../ims/data";
import { Block, Facts, Foot, PaperHead, PaperTable, Signatures } from "../ims/parts";
import { CSRS, certOf, contingencyByCode, customerName, deviceByCode, effective, grade, lastTest, supplierAuditByNo, vendorName } from "./data";

/** เอกสารที่พิมพ์ได้จากข้อกำหนด IATF — ทุกใบมีเลขแบบฟอร์มจากบัญชีรายชื่อเอกสาร */
export type IatfDoc =
  | { doc: "csr"; customer: string }
  | { doc: "contingency"; code: string }
  | { doc: "supplier-audit"; no: string }
  | { doc: "device"; code: string };

const Foot_ = () => <Foot system="IATF 16949:2016" />;

function CsrMatrix({ customer }: { customer: string }) {
  const rows = CSRS.filter((c) => c.customer === customer);
  return (
    <>
      <PaperHead title="ตารางข้อกำหนดเฉพาะลูกค้า" number={customer} form={formNo("FM-27")} />
      <Facts rows={[["ลูกค้า", customerName(customer)], ["จำนวนข้อ", `${rows.length} ข้อ`], ["นำไปใช้แล้ว", `${rows.filter(effective).length} ข้อ`], ["เอกสารต้นทาง", [...new Set(rows.map((r) => r.source))].join(", ")]]} />
      <PaperTable head={["#", "ข้อ IATF", "ข้อกำหนดของลูกค้า", "เอกสารของเรา", "สถานะ", "ผู้รับผิดชอบ"]} rows={rows.map((c) => [String(c.id), c.clause, c.requirement, c.doc ?? "—", c.status, c.owner])} />
      <Signatures names={[["ผู้จัดทำ", "ธนพล เจริญผล"], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function ContingencySheet({ code }: { code: string }) {
  const c = contingencyByCode(code);
  return (
    <>
      <PaperHead title="แผนฉุกเฉินทางธุรกิจ" number={c.code} form={formNo("FM-28")} />
      <Facts rows={[["สถานการณ์", c.scenario], ["กระทบลูกค้าภายใน", `${c.impactDays} วัน`], ["ผู้รับผิดชอบ", c.owner], ["ความเสี่ยงที่เกี่ยวข้อง", c.risk ?? "—"]]} />
      <Block title="สิ่งที่ต้องทำ"><ol className="list-decimal pl-5">{c.actions.map((a) => <li key={a}>{a}</li>)}</ol></Block>
      <PaperTable head={["วันที่ทดสอบ", "ผล", "สิ่งที่พบ", "ผู้ทดสอบ"]} rows={c.tests.map((t) => [t.date, t.result, t.note, t.by])} />
      <p className="mt-3 text-slate-600">ทดสอบล่าสุด: {lastTest(c) ? `${lastTest(c)!.date} ${lastTest(c)!.result}` : "ยังไม่เคยทดสอบ"} · ทดสอบอย่างน้อยปีละครั้ง</p>
      <Signatures names={[["ผู้รับผิดชอบ", c.owner], ["ผู้อนุมัติ", TOP]]} />
      <Foot_ />
    </>
  );
}

function SupplierAuditReport({ no }: { no: string }) {
  const a = supplierAuditByNo(no);
  const cert = certOf(a.vendor);
  return (
    <>
      <PaperHead title="รายงานการตรวจประเมินผู้ส่งมอบ" number={a.no} form={formNo("FM-29")} />
      <Facts
        rows={[
          ["ผู้ส่งมอบ", vendorName(a.vendor)],
          ["ใบรับรองระบบ", cert.standard === "ไม่มี" ? "ไม่มี" : `${cert.standard} ${cert.certNo} ถึง ${cert.validUntil}`],
          ["วันที่ตรวจ", a.performedOn ?? `ตามแผน ${a.planned}`],
          ["ผู้ตรวจ", a.auditor],
          ["วิธีตรวจ", "ตรวจกระบวนการตาม VDA 6.3"],
          ["ผล", a.score !== undefined ? `${a.score}% เกรด ${grade(a.score)}` : "ยังไม่ตรวจ"],
        ]}
      />
      <Block title="สิ่งที่พบ">{a.findings ?? "—"}</Block>
      <p className="mt-3 text-slate-600">เกรด A ตั้งแต่ 90% · B 80–89% · C ต่ำกว่า 80% ต้องมีแผนพัฒนาผู้ส่งมอบ</p>
      <Signatures names={[["ผู้ตรวจ", a.auditor], ["ผู้แทนผู้ส่งมอบ"], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function DeviceSheet({ code }: { code: string }) {
  const d = deviceByCode(code);
  return (
    <>
      <PaperHead title="ใบทวนสอบอุปกรณ์ป้องกันความผิดพลาดประจำกะ" number={d.code} form={formNo("FM-30")} />
      <Facts rows={[["อุปกรณ์", d.name], ["ขั้นตอน", d.op], ["ป้องกัน", d.prevents], ["ชิ้นต้นแบบเสีย", d.master]]} />
      <PaperTable head={["วันที่", "กะ", "ผล", "ผู้ทวนสอบ", "หมายเหตุ"]} rows={[...d.checks].reverse().slice(0, 20).map((c) => [c.date, c.shift, c.ok ? "จับได้" : "ไม่จับ", c.by, c.note ?? ""])} />
      <p className="mt-3 text-slate-600">ทวนสอบด้วยชิ้นต้นแบบเสียทุกกะก่อนผลิต ถ้าไม่จับ ให้หยุดใช้ ตรวจ 100% ด้วยมือ และกักชิ้นงานตั้งแต่ครั้งทวนสอบก่อน</p>
      <Signatures names={[["หัวหน้ากะ"], ["QC"]]} />
      <Foot_ />
    </>
  );
}

export function IatfPaper({ d }: { d: IatfDoc }) {
  return (
    <Paper>
      {d.doc === "csr" && <CsrMatrix customer={d.customer} />}
      {d.doc === "contingency" && <ContingencySheet code={d.code} />}
      {d.doc === "supplier-audit" && <SupplierAuditReport no={d.no} />}
      {d.doc === "device" && <DeviceSheet code={d.code} />}
    </Paper>
  );
}

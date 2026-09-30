import { Paper } from "../kit";
import { QMR, formNo } from "../ims/data";
import { Block, Facts, Foot, PaperHead, PaperTable, Signatures } from "../ims/parts";
import {
  DESIGN_STAGES, REVIEW_CHECKS, SATISFACTION_CRITERIA, SURVEYS, approvalOf, carOfNcr, commitments, customerName, designByNo,
  gaugeByCode, lotByNo, materialName, materialUnit, ncrByNo, nextDue, planOf, purchasingGrade, reviewOf,
  satisfactionByCustomer, supplierQuality, vendorName,
} from "./data";

/** เอกสารที่พิมพ์ได้จากระบบคุณภาพ — ทุกใบมีเลขแบบฟอร์มจากบัญชีรายชื่อเอกสารของระบบบริหารบูรณาการ */
export type QmDoc =
  | { doc: "lot"; no: string }
  | { doc: "ncr"; no: string }
  | { doc: "gauge"; code: string }
  | { doc: "requirement"; no: string }
  | { doc: "design"; no: string }
  | { doc: "supplier"; code: string }
  | { doc: "satisfaction" };

const Foot_ = () => <Foot system="ระบบบริหารคุณภาพ ISO 9001:2015" />;

function LotReport({ no }: { no: string }) {
  const l = lotByNo(no);
  const plan = planOf(l.material);
  const certificate = l.origin === "ตรวจก่อนส่ง" && l.decision && l.decision !== "ไม่ผ่าน";
  return (
    <>
      <PaperHead title={certificate ? "ใบรับรองคุณภาพสินค้า" : "ใบรายงานผลการตรวจสอบ"} number={l.no} form={certificate ? `${formNo("FM-03")} · Certificate of Conformance` : formNo("FM-02")} />
      <Facts
        rows={[
          ["ประเภทการตรวจ", l.origin],
          ["วันที่ตรวจ", l.inspectedOn ?? "ยังไม่ตรวจ"],
          ["รายการ", `${l.material} · ${materialName(l.material)}`],
          ["จำนวนล็อต", `${l.qty.toLocaleString("th-TH")} ${materialUnit(l.material)}`],
          ["เอกสารต้นทาง", l.source === l.ref ? l.source : `${l.source} · ${l.ref}`],
          ["จำนวนตัวอย่าง", `${l.sample} ${materialUnit(l.material)}`],
          [l.vendor ? "ผู้ขาย" : "ผู้ผลิต", l.vendor ? vendorName(l.vendor) : "ฝ่ายผลิต"],
          ["ผลการตัดสิน", l.decision ?? l.status],
        ]}
      />
      <PaperTable
        head={["คุณลักษณะ", "วิธีตรวจ", "เกณฑ์", "ผลที่ได้", "ผล"]}
        rows={plan.map((c) => {
          const r = l.results.find((x) => x.characteristic === c.name);
          return [
            c.name, c.method,
            c.kind === "วัดค่า" ? `${c.lsl}–${c.usl} ${c.unit ?? ""}` : "ไม่พบจุดบกพร่อง",
            !r ? "—" : c.kind === "วัดค่า" ? `${r.min} – ${r.max}` : r.defects === 0 ? "ไม่พบ" : `พบ ${r.defects}`,
            !r ? "—" : r.ok ? "ผ่าน" : "ไม่ผ่าน",
          ];
        })}
      />
      {l.note && <Block title="หมายเหตุ">{l.note}</Block>}
      {certificate && (
        <p className="mt-4 leading-relaxed text-slate-700">
          ขอรับรองว่าสินค้าในล็อตนี้ได้รับการตรวจสอบตามแผนการตรวจ และเป็นไปตามข้อกำหนด{l.decision === "ยอมรับแบบมีเงื่อนไข" ? " ภายใต้เงื่อนไขที่ระบุในหมายเหตุ" : ""}
        </p>
      )}
      {l.ncr && <p className="mt-3 text-slate-700">อ้างอิงใบรายงานสิ่งที่ไม่เป็นไปตามข้อกำหนด {l.ncr}</p>}
      <Signatures names={[["ผู้ตรวจ", l.inspector], ["ผู้ตัดสินผล", l.decidedBy]]} />
      <Foot_ />
    </>
  );
}

function NcrReport({ no }: { no: string }) {
  const n = ncrByNo(no);
  const car = carOfNcr(n);
  return (
    <>
      <PaperHead title="ใบรายงานสิ่งที่ไม่เป็นไปตามข้อกำหนด" number={n.no} form={`${formNo("FM-04")} · NCR`} />
      <Facts
        rows={[
          ["วันที่พบ", n.date],
          ["แหล่งที่พบ", n.source],
          ["เอกสารอ้างอิง", n.ref],
          ["ความรุนแรง", n.severity],
          ["รายการ", n.material ? `${n.material} · ${materialName(n.material)}` : "—"],
          ["จำนวน", n.material ? `${n.qty.toLocaleString("th-TH")} ${materialUnit(n.material)}` : n.qty.toLocaleString("th-TH")],
          [n.customer ? "ลูกค้า" : "ผู้ขาย", n.customer ? customerName(n.customer) : vendorName(n.vendor)],
          ["ผู้รายงาน", n.reportedBy],
        ]}
      />
      <Block title="สิ่งที่พบ">{n.description}</Block>
      <Block title="การสั่งการ">
        {n.disposition ? (
          <>
            <p className="font-medium text-slate-900">{n.disposition}</p>
            <p>{n.dispositionNote}</p>
            {n.stockDoc && <p className="mt-1 text-slate-500">ตัดสต็อกตามเอกสาร {n.stockDoc}</p>}
            <p className="mt-1 text-slate-500">สั่งการโดย {n.dispositionBy}</p>
          </>
        ) : (
          "ยังไม่สั่งการ"
        )}
      </Block>
      <Block title="การแก้ไขที่สาเหตุ">{car ? `ออกใบขอให้แก้ไข ${car.no} (${car.method}) — ${car.status}` : "ไม่ต้องออก CAR"}</Block>
      <Signatures names={[["ผู้รายงาน", n.reportedBy], ["ผู้สั่งการ", n.dispositionBy], ["ผู้ปิดเรื่อง", n.closedBy]]} />
      <Foot_ />
    </>
  );
}

function GaugeReport({ code }: { code: string }) {
  const g = gaugeByCode(code);
  return (
    <>
      <PaperHead title="บันทึกประวัติการสอบเทียบเครื่องมือวัด" number={g.code} form={formNo("FM-07")} />
      <Facts
        rows={[
          ["เครื่องมือ", g.name],
          ["ช่วงการวัด", g.range],
          ["ความละเอียด", g.resolution],
          ["ที่ใช้งาน", g.location],
          ["รอบสอบเทียบ", `ทุก ${g.intervalMonths} เดือน`],
          ["ครบกำหนดครั้งถัดไป", g.status === "พักใช้" ? "พักใช้" : nextDue(g)],
        ]}
      />
      <PaperTable head={["วันที่", "ผู้สอบเทียบ", "เลขที่ใบรับรอง", "ค่าคลาดเคลื่อน", "ผล"]} rows={g.records.map((r) => [r.date, r.by, r.certNo, r.error, r.result])} />
      <Signatures names={[["ผู้บันทึก", "สุภาพร แก้วมณี"], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function RequirementReport({ no }: { no: string }) {
  const c = commitments().find((x) => x.doc === no)!;
  const r = reviewOf(no);
  return (
    <>
      <PaperHead title="ใบทบทวนข้อกำหนดลูกค้า" number={no} form={formNo("FM-12")} />
      <Facts rows={[["เอกสาร", c.kind], ["ลูกค้า", customerName(c.customer)], ["วันที่เอกสาร", c.date], ["ต้องการรับของ", c.shipBy ?? "ตามตกลง"]]} />
      <PaperTable head={["สินค้า", "จำนวน"]} rows={c.lines.map((l) => [materialName(l.material), `${l.qty.toLocaleString("th-TH")} ${materialUnit(l.material)}`])} />
      <PaperTable head={["หัวข้อทบทวน", "ผล"]} rows={REVIEW_CHECKS.map((k) => [k.label, r ? (r.checks[k.key] ? "ได้" : "ไม่ได้") : "—"])} />
      {r?.special && <Block title="ข้อกำหนดพิเศษของลูกค้า">{r.special}</Block>}
      <Block title="ผลการทบทวน">{r ? `${r.result}${r.note ? ` — ${r.note}` : ""}` : "ยังไม่ทบทวน"}</Block>
      <Signatures names={[["ผู้ทบทวน", r?.by], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function DesignRecord({ no }: { no: string }) {
  const d = designByNo(no);
  return (
    <>
      <PaperHead title="บันทึกการออกแบบและพัฒนา" number={d.no} form={formNo("FM-13")} />
      <Facts rows={[["ผลิตภัณฑ์", d.product], ["ผู้รับผิดชอบ", d.owner], ["เริ่ม", d.started], ["กำหนดเสร็จ", d.target]]} />
      <PaperTable
        head={["ขั้น", "วันที่", "ผู้บันทึก", "หลักฐาน"]}
        rows={DESIGN_STAGES.map((stage) => {
          const r = d.records.find((x) => x.stage === stage);
          return [stage, r?.date ?? "—", r?.by ?? "—", r ? `${r.evidence}${r.participants ? ` (ผู้เข้าร่วม: ${r.participants.join(", ")})` : ""}` : "ยังไม่ถึง"];
        })}
      />
      {d.changes.length > 0 && (
        <>
          <p className="mt-4 font-semibold text-slate-900">การเปลี่ยนแปลงแบบหลังส่งมอบ (ข้อ 8.3.6)</p>
          <PaperTable head={["วันที่", "สิ่งที่เปลี่ยน", "เหตุผล", "ผู้อนุมัติ", "ทวนสอบซ้ำ"]} rows={d.changes.map((c) => [c.date, c.change, c.reason, c.approvedBy, c.reverified ? "แล้ว" : "ยัง"])} />
        </>
      )}
      <Signatures names={[["ผู้ออกแบบ", d.owner], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function SupplierReport({ code }: { code: string }) {
  const a = approvalOf(code);
  const q = supplierQuality(code);
  return (
    <>
      <PaperHead title="ใบประเมินผู้ส่งมอบประจำปี" number={code} form={formNo("FM-14")} />
      <Facts
        rows={[
          ["ผู้ขาย", vendorName(code)],
          ["สถานะ", a?.status ?? "รอประเมิน"],
          ["ล็อตผ่านครั้งแรก", `${q.accepted} จาก ${q.lots} (${q.score}%)`],
          ["เกรดจากฝ่ายจัดซื้อ", purchasingGrade(code) ?? "—"],
          ["NCR ที่เปิดกับผู้ขาย", `${q.ncrs} เรื่อง`],
          ["ทบทวนครั้งถัดไป", a?.nextReview ?? "—"],
        ]}
      />
      <Block title="ขอบเขตที่อนุมัติ">{a ? a.scope.map(materialName).join(" · ") || "—" : "ยังไม่อนุมัติ"}</Block>
      <PaperTable head={["วันที่", "ผล", "คุณภาพ %", "เกรดจัดซื้อ", "เหตุผล", "ผู้ประเมิน"]} rows={(a?.history ?? []).map((h) => [h.date, h.status, String(h.quality), h.grade ?? "—", h.note, h.by])} />
      <Signatures names={[["ผู้ประเมิน", a?.history.at(-1)?.by], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function SatisfactionReport() {
  const rows = satisfactionByCustomer();
  return (
    <>
      <PaperHead title="สรุปผลสำรวจความพึงพอใจลูกค้า" form={formNo("FM-15")} />
      <PaperTable
        head={["ลูกค้า", "รอบ", ...SATISFACTION_CRITERIA.map((c) => c.label), "เฉลี่ย", "ข้อร้องเรียน"]}
        rows={rows.map((x) => [
          x.customer.name,
          x.last?.period ?? "ยังไม่สำรวจ",
          ...SATISFACTION_CRITERIA.map((c) => (x.last ? String(x.last.scores[c.key]) : "—")),
          x.score !== undefined ? String(x.score) : "—",
          String(x.complaints),
        ])}
      />
      <p className="mt-4 font-semibold text-slate-900">ความเห็นและสิ่งที่จะทำต่อ</p>
      <PaperTable head={["เลขที่", "ลูกค้า", "ความเห็น", "สิ่งที่จะทำต่อ"]} rows={SURVEYS.filter((v) => v.comment || v.followUp).map((v) => [v.no, customerName(v.customer), v.comment || "—", v.followUp ?? "—"])} />
      <p className="mt-3 text-slate-600">คะแนน 1–5 จากรอบล่าสุดของแต่ละลูกค้า · เฉลี่ยต่ำกว่า 3.5 ต้องมีสิ่งที่จะทำต่อ</p>
      <Signatures names={[["ผู้จัดทำ", "ชลธิชา มั่นคง"], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

export function QmPaper({ d }: { d: QmDoc }) {
  return (
    <Paper>
      {d.doc === "lot" && <LotReport no={d.no} />}
      {d.doc === "ncr" && <NcrReport no={d.no} />}
      {d.doc === "gauge" && <GaugeReport code={d.code} />}
      {d.doc === "requirement" && <RequirementReport no={d.no} />}
      {d.doc === "design" && <DesignRecord no={d.no} />}
      {d.doc === "supplier" && <SupplierReport code={d.code} />}
      {d.doc === "satisfaction" && <SatisfactionReport />}
    </Paper>
  );
}

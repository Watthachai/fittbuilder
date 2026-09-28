import type { ReactNode } from "react";
import { Paper } from "../kit";
import {
  COMPANY, DOCUMENTS, QMR, TODAY, auditByNo, docByCode, capaByNo, clauseName, customerName, gaugeByCode, lotByNo, materialName,
  materialUnit, ncrByNo, nextDue, planOf, revLabel, vendorName,
} from "./data";

/** เอกสารที่พิมพ์ได้จากระบบคุณภาพ — ทุกใบมีเลขแบบฟอร์มควบคุมที่มุมขวาเหมือนเอกสารจริง */
export type QmDoc =
  | { doc: "master-list" }
  | { doc: "lot"; no: string }
  | { doc: "ncr"; no: string }
  | { doc: "car"; no: string }
  | { doc: "audit"; no: string }
  | { doc: "gauge"; code: string };

/** เลขแบบฟอร์มที่มุมกระดาษ อ่านฉบับจากบัญชีรายชื่อเอกสาร จึงตรงกับที่ผู้ตรวจประเมินเทียบเสมอ */
const formNo = (code: string) => `${code} ${revLabel(docByCode(code).rev)}`;

function Head({ title, form, number }: { title: string; form: string; number?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b-2 border-slate-800 pb-3">
      <div>
        <p className="text-[15px] font-bold text-slate-900">{COMPANY.name}</p>
        <p className="max-w-sm leading-relaxed text-slate-600">{COMPANY.address}</p>
      </div>
      <div className="text-right">
        <p className="text-[16px] font-bold text-slate-900">{title}</p>
        {number && <p className="mt-0.5 font-semibold tabular-nums text-slate-900">{number}</p>}
        <p className="mt-1 text-[10.5px] text-slate-500">{form}</p>
      </div>
    </div>
  );
}

function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="mt-4 grid grid-cols-[auto_1fr_auto_1fr] gap-x-4 gap-y-1.5 rounded-md border border-slate-300 p-3">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="mt-4 w-full border-collapse">
      <thead>
        <tr className="bg-slate-100 text-[11.5px] text-slate-600">
          {head.map((h) => (
            <th key={h} className="border border-slate-300 px-2 py-1.5 text-left font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={head.length} className="border border-slate-300 px-2 py-3 text-center text-slate-400">ไม่มีรายการ</td>
          </tr>
        )}
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="border border-slate-300 px-2 py-1.5 align-top">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="font-semibold text-slate-900">{title}</p>
      <div className="mt-1 rounded-md border border-slate-300 p-3 leading-relaxed text-slate-700">{children}</div>
    </div>
  );
}

function Signatures({ names }: { names: [string, string?][] }) {
  return (
    <div className="mt-10 grid gap-8" style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
      {names.map(([role, name]) => (
        <div key={role} className="text-center">
          <div className="mx-auto h-9 w-40 border-b border-dotted border-slate-500" />
          <p className="mt-1.5 text-slate-700">{name ? `( ${name} )` : "(............................)"}</p>
          <p className="text-slate-500">{role}</p>
        </div>
      ))}
    </div>
  );
}

const Foot = () => (
  <p className="mt-8 border-t border-slate-200 pt-2 text-[10.5px] text-slate-400">
    เอกสารควบคุมตามระบบบริหารคุณภาพ ISO 9001:2015 · พิมพ์จากระบบเมื่อ {TODAY}
  </p>
);

function MasterList() {
  const live = DOCUMENTS.filter((d) => d.status !== "ยกเลิก");
  const dead = DOCUMENTS.filter((d) => d.status === "ยกเลิก");
  return (
    <>
      <Head title="บัญชีรายชื่อเอกสารควบคุม" form={formNo("FM-01")} />
      <p className="mt-3 text-slate-600">เอกสารที่ใช้งานและฉบับที่มีผลบังคับ ณ วันที่ {TODAY} — ฉบับที่ไม่อยู่ในบัญชีนี้ห้ามใช้ที่หน้างาน</p>
      <Table
        head={["รหัส", "ชื่อเอกสาร", "ประเภท", "ฉบับ", "วันที่มีผล", "ฝ่ายเจ้าของ", "ทบทวนครั้งถัดไป"]}
        rows={live.map((d) => [d.code, d.title, d.type, revLabel(d.rev), d.effective ?? "รออนุมัติ", d.owner, d.reviewDue ?? "—"])}
      />
      {dead.length > 0 && (
        <>
          <p className="mt-5 font-semibold text-slate-900">เอกสารที่ยกเลิก</p>
          <Table head={["รหัส", "ชื่อเอกสาร", "ฉบับสุดท้าย", "เหตุผล"]} rows={dead.map((d) => [d.code, d.title, revLabel(d.rev), d.obsoleteReason ?? ""])} />
        </>
      )}
      <Signatures names={[["ผู้จัดทำ", "สุภาพร แก้วมณี"], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot />
    </>
  );
}

function LotReport({ no }: { no: string }) {
  const l = lotByNo(no);
  const plan = planOf(l.material);
  const certificate = l.origin === "ตรวจก่อนส่ง" && l.decision && l.decision !== "ไม่ผ่าน";
  return (
    <>
      <Head
        title={certificate ? "ใบรับรองคุณภาพสินค้า" : "ใบรายงานผลการตรวจสอบ"}
        number={l.no}
        form={certificate ? `${formNo("FM-03")} · Certificate of Conformance` : formNo("FM-02")}
      />
      <Facts
        rows={[
          ["ประเภทการตรวจ", l.origin],
          ["วันที่ตรวจ", l.inspectedOn ?? "ยังไม่ตรวจ"],
          ["รายการ", `${l.material} · ${materialName(l.material)}`],
          ["จำนวนล็อต", `${l.qty.toLocaleString("th-TH")} ${materialUnit(l.material)}`],
          ["เอกสารต้นทาง", `${l.source} · ${l.ref}`],
          ["จำนวนตัวอย่าง", `${l.sample} ${materialUnit(l.material)}`],
          [l.vendor ? "ผู้ขาย" : "หน่วยผลิต", l.vendor ? vendorName(l.vendor) : "ฝ่ายผลิต"],
          ["ผลการตัดสิน", l.decision ?? "รอตัดสิน"],
        ]}
      />
      <Table
        head={["คุณลักษณะ", "วิธีตรวจ", "เกณฑ์", "ผลที่ได้", "ผล"]}
        rows={plan.map((c) => {
          const r = l.results.find((x) => x.characteristic === c.name);
          const spec = c.kind === "วัดค่า" ? `${c.lsl} – ${c.usl} ${c.unit ?? ""}` : "ไม่พบจุดบกพร่อง";
          const got = !r ? "—" : c.kind === "วัดค่า" ? `${r.min} – ${r.max} ${c.unit ?? ""}` : r.defects === 0 ? "ไม่พบ" : `พบ ${r.defects} ชิ้น`;
          return [c.name, c.method, spec, got, !r ? "—" : r.ok ? "ผ่าน" : "ไม่ผ่าน"];
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
      <Foot />
    </>
  );
}

function NcrReport({ no }: { no: string }) {
  const n = ncrByNo(no);
  return (
    <>
      <Head title="ใบรายงานสิ่งที่ไม่เป็นไปตามข้อกำหนด" number={n.no} form={`${formNo("FM-04")} · NCR`} />
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
      <Block title="การแก้ไขที่สาเหตุ">{n.capa ? `ออกใบขอให้แก้ไข ${n.capa}` : "ไม่ต้องออก CAR"}</Block>
      <Signatures names={[["ผู้รายงาน", n.reportedBy], ["ผู้สั่งการ", n.dispositionBy], ["ผู้ปิดเรื่อง", n.closedBy]]} />
      <Foot />
    </>
  );
}

function CarReport({ no }: { no: string }) {
  const c = capaByNo(no);
  return (
    <>
      <Head title="ใบขอให้ดำเนินการแก้ไขและป้องกัน" number={c.no} form={`${formNo("FM-05")} · CAR`} />
      <Facts
        rows={[
          ["วันที่ออก", c.date],
          ["ประเภท", `การ${c.kind}`],
          ["ต้นเรื่อง", c.ref],
          ["ผู้รับผิดชอบ", c.owner],
        ]}
      />
      <Block title="1. ปัญหา">{c.problem}</Block>
      <Block title="2. สาเหตุราก">
        {c.rootCause ? (
          <>
            <p className="text-slate-500">กลุ่มสาเหตุ: {c.rootCause.category}</p>
            <ol className="mt-1 list-decimal pl-5">
              {c.rootCause.whys.map((w, i) => (
                <li key={i}>ทำไม — {w}</li>
              ))}
            </ol>
          </>
        ) : (
          "ยังไม่วิเคราะห์"
        )}
      </Block>
      <p className="mt-4 font-semibold text-slate-900">3. มาตรการแก้ไข</p>
      <Table
        head={["มาตรการ", "ผู้รับผิดชอบ", "กำหนดเสร็จ", "เสร็จเมื่อ"]}
        rows={c.actions.map((a) => [a.what, a.owner, a.due, a.doneOn ?? "—"])}
      />
      <Block title="4. ติดตามประสิทธิผล">
        {c.verification ? `${c.verification.effective ? "ได้ผล" : "ไม่ได้ผล"} — ${c.verification.note} (${c.verification.by}, ${c.verification.date})` : "ยังไม่ติดตามผล"}
      </Block>
      <Signatures names={[["ผู้รับผิดชอบ", c.owner], ["ผู้ติดตามผล", c.verification?.by], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot />
    </>
  );
}

function AuditReport({ no }: { no: string }) {
  const a = auditByNo(no);
  const count = (t: string) => a.findings.filter((f) => f.type === t).length;
  return (
    <>
      <Head title="รายงานการตรวจติดตามภายใน" number={a.no} form={formNo("FM-06")} />
      <Facts
        rows={[
          ["ฝ่ายที่ตรวจ", a.area],
          ["วันที่ตรวจ", a.performedOn ?? `ตามแผน ${a.planned}`],
          ["ผู้ตรวจ", a.auditor],
          ["สถานะ", a.status],
        ]}
      />
      <Block title="ขอบเขตการตรวจ">
        {a.clauses.map((c) => `ข้อ ${c} ${clauseName(c)}`).join(" · ")}
      </Block>
      <Table
        head={["#", "ข้อกำหนด", "ประเภท", "สิ่งที่พบ", "CAR"]}
        rows={a.findings.map((f) => [String(f.id), f.clause, f.type, f.detail, f.capa ?? (f.type === "ข้อสังเกต" ? "—" : "ยังไม่ออก")])}
      />
      <p className="mt-3 text-slate-700">
        สรุป: ข้อบกพร่องหลัก {count("ข้อบกพร่องหลัก")} · ข้อบกพร่องย่อย {count("ข้อบกพร่องย่อย")} · ข้อสังเกต {count("ข้อสังเกต")}
      </p>
      <Signatures names={[["ผู้ตรวจ", a.auditor], ["ผู้รับการตรวจ"], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot />
    </>
  );
}

function GaugeReport({ code }: { code: string }) {
  const g = gaugeByCode(code);
  return (
    <>
      <Head title="บันทึกประวัติการสอบเทียบเครื่องมือวัด" number={g.code} form={formNo("FM-07")} />
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
      <Table
        head={["วันที่", "ผู้สอบเทียบ", "เลขที่ใบรับรอง", "ค่าคลาดเคลื่อน", "ผล"]}
        rows={g.records.map((r) => [r.date, r.by, r.certNo, r.error, r.result])}
      />
      <Signatures names={[["ผู้บันทึก", "สุภาพร แก้วมณี"], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot />
    </>
  );
}

export function QmPaper({ d }: { d: QmDoc }) {
  return (
    <Paper>
      {d.doc === "master-list" && <MasterList />}
      {d.doc === "lot" && <LotReport no={d.no} />}
      {d.doc === "ncr" && <NcrReport no={d.no} />}
      {d.doc === "car" && <CarReport no={d.no} />}
      {d.doc === "audit" && <AuditReport no={d.no} />}
      {d.doc === "gauge" && <GaugeReport code={d.code} />}
    </Paper>
  );
}

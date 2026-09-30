import { Paper } from "../kit";
import {
  DOCUMENTS, QMR, RISKS, TOP, TRAININGS, auditByNo, capaByNo, carOf, clauseLabel, clauseName, courseName, currentScore,
  eightD, findingRef, formNo, gapsOf, levelNo, levelOf, personOf, qualificationsOf, rating, reviewByNo, revLabel, score,
} from "./data";
import { Block, Facts, Foot, PaperHead, PaperTable, Signatures } from "./parts";

/** เอกสารที่พิมพ์ได้จากระบบบริหารบูรณาการ — ทุกใบมีเลขแบบฟอร์มจากบัญชีรายชื่อเอกสาร */
export type ImsDoc =
  | { doc: "master-list" }
  | { doc: "car"; no: string }
  | { doc: "audit"; no: string }
  | { doc: "risks" }
  | { doc: "person"; name: string }
  | { doc: "review"; no: string };

const SYSTEM = "ระบบบริหารบูรณาการ ISO 9001 · ISO 14001 · IATF 16949";
const Foot_ = () => <Foot system={SYSTEM} />;

function MasterList() {
  const live = DOCUMENTS.filter((d) => d.status !== "ยกเลิก").sort((a, b) => levelNo(a.level) - levelNo(b.level) || a.code.localeCompare(b.code));
  const dead = DOCUMENTS.filter((d) => d.status === "ยกเลิก");
  return (
    <>
      <PaperHead title="บัญชีรายชื่อเอกสารควบคุม" form={formNo("FM-01")} />
      <p className="mt-3 text-slate-600">เอกสารที่ใช้งานและฉบับที่มีผลบังคับ ณ วันพิมพ์ — ฉบับที่ไม่อยู่ในบัญชีนี้ห้ามใช้ที่หน้างาน</p>
      <PaperTable
        head={["ระดับ", "รหัส", "ชื่อเอกสาร", "มาตรฐาน", "ฉบับ", "วันที่มีผล", "ฝ่ายเจ้าของ", "ทบทวนครั้งถัดไป"]}
        rows={live.map((d) => [String(levelNo(d.level)), d.code, d.title, d.standards.map((s) => s.replace("ISO ", "")).join(", "), revLabel(d.rev), d.effective ?? "รออนุมัติ", d.owner, d.reviewDue ?? "—"])}
      />
      {dead.length > 0 && (
        <>
          <p className="mt-5 font-semibold text-slate-900">เอกสารที่ยกเลิก</p>
          <PaperTable head={["รหัส", "ชื่อเอกสาร", "ฉบับสุดท้าย", "เหตุผล"]} rows={dead.map((d) => [d.code, d.title, revLabel(d.rev), d.obsoleteReason ?? ""])} />
        </>
      )}
      <Signatures names={[["ผู้จัดทำ", "สุภาพร แก้วมณี"], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function CarReport({ no }: { no: string }) {
  const c = capaByNo(no);
  const is8D = c.method === "8D";
  return (
    <>
      <PaperHead title={is8D ? "รายงานการแก้ปัญหา 8D" : "ใบขอให้ดำเนินการแก้ไขและป้องกัน"} number={c.no} form={is8D ? formNo("FM-11") : `${formNo("FM-05")} · CAR`} />
      <Facts rows={[["วันที่ออก", c.date], ["มาตรฐาน", c.std], ["ต้นเรื่อง", c.ref], ["ผู้รับผิดชอบ", c.owner]]} />
      {is8D && <Block title="D1 ทีม">{c.team.join(" · ")}</Block>}
      <Block title={is8D ? "D2 อธิบายปัญหา" : "1. ปัญหา"}>{c.problem}</Block>
      {is8D && <Block title="D3 การกักกันชั่วคราว">{c.containment ?? "ยังไม่บันทึก"}</Block>}
      <Block title={is8D ? "D4 สาเหตุรากและจุดที่หลุด" : "2. สาเหตุราก"}>
        {c.rootCause ? (
          <>
            <p className="text-slate-500">กลุ่มสาเหตุ: {c.rootCause.category}</p>
            <ol className="mt-1 list-decimal pl-5">
              {c.rootCause.whys.map((w, i) => <li key={i}>ทำไม — {w}</li>)}
            </ol>
            {c.rootCause.escape && <p className="mt-2"><span className="text-slate-500">ทำไมจึงหลุดถึงลูกค้า:</span> {c.rootCause.escape}</p>}
          </>
        ) : (
          "ยังไม่วิเคราะห์"
        )}
      </Block>
      <p className="mt-4 font-semibold text-slate-900">{is8D ? "D5–D6 มาตรการถาวรและการดำเนินการ" : "3. มาตรการ"}</p>
      <PaperTable head={["มาตรการ", "ชนิด", "ผู้รับผิดชอบ", "กำหนดเสร็จ", "เสร็จเมื่อ"]} rows={c.actions.map((a) => [a.what, a.type, a.owner, a.due, a.doneOn ?? "—"])} />
      {is8D && <Block title="D7 ป้องกันการเกิดซ้ำ">{c.prevention ?? "ยังไม่บันทึก"}</Block>}
      <Block title={is8D ? "D8 ปิดและติดตามประสิทธิผล" : "4. ติดตามประสิทธิผล"}>
        {c.verification ? `${c.verification.effective ? "ได้ผล" : "ไม่ได้ผล"} — ${c.verification.note} (${c.verification.by}, ${c.verification.date})` : "ยังไม่ติดตามผล"}
      </Block>
      {is8D && <p className="mt-3 text-slate-600">สถานะขั้นตอน: {eightD(c).map((s) => `${s.step}${s.done ? " ✓" : ""}`).join(" · ")}</p>}
      <Signatures names={[["ผู้รับผิดชอบ", c.owner], ["ผู้ติดตามผล", c.verification?.by], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function AuditReport({ no }: { no: string }) {
  const a = auditByNo(no);
  const count = (t: string) => a.findings.filter((f) => f.type === t).length;
  return (
    <>
      <PaperHead title="รายงานการตรวจติดตามภายใน" number={a.no} form={formNo("FM-06")} />
      <Facts
        rows={[
          ["ชนิดการตรวจ", `${a.type} · ${a.std}`],
          ["ฝ่ายที่ตรวจ", a.subject ? `${a.area} · ${a.subject}` : a.area],
          ["วันที่ตรวจ", a.performedOn ?? `ตามแผน ${a.planned}`],
          ["ผู้ตรวจ", a.auditor],
        ]}
      />
      <Block title="ขอบเขตการตรวจ">{a.clauses.map((c) => `${clauseLabel(c)} ${clauseName(c)}`).join(" · ")}</Block>
      <PaperTable
        head={["#", "ข้อกำหนด", "ประเภท", "สิ่งที่พบ", "CAR"]}
        rows={a.findings.map((f) => [String(f.id), clauseLabel(f.clause), f.type, f.detail, carOf(findingRef(a, f))?.no ?? (f.type === "ข้อสังเกต" ? "—" : "ยังไม่ออก")])}
      />
      <p className="mt-3 text-slate-700">
        สรุป: ข้อบกพร่องหลัก {count("ข้อบกพร่องหลัก")} · ข้อบกพร่องย่อย {count("ข้อบกพร่องย่อย")} · ข้อสังเกต {count("ข้อสังเกต")}
        {a.score !== undefined && ` · คะแนน VDA 6.3 ${a.score}% ระดับ ${rating(a.score)}`}
      </p>
      <Signatures names={[["ผู้ตรวจ", a.auditor], ["ผู้รับการตรวจ"], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function RiskRegister() {
  return (
    <>
      <PaperHead title="ทะเบียนความเสี่ยงและโอกาส" form={formNo("FM-08")} />
      <PaperTable
        head={["เลขที่", "ประเภท", "กระบวนการ", "เรื่อง", "โอกาส×ผลกระทบ", "ระดับ", "การจัดการ", "มาตรการ", "เจ้าของ"]}
        rows={RISKS.map((r) => [
          r.no, r.kind, r.process, r.description,
          r.residual ? `${score(r)} → ${currentScore(r)}` : String(score(r)),
          levelOf(currentScore(r)), r.treatment,
          r.tasks.map((t) => `${t.what}${t.doneOn ? " ✓" : ` (${t.due})`}`).join(" / ") || "—",
          r.owner,
        ])}
      />
      <p className="mt-3 text-slate-600">ระดับ: สูง 15–25 · กลาง 8–14 · ต่ำ 1–7 — ความเสี่ยงระดับสูงต้องมีมาตรการ ยอมรับไม่ได้</p>
      <Signatures names={[["ผู้จัดทำ (QMR)", QMR], ["ผู้อนุมัติ", TOP]]} />
      <Foot_ />
    </>
  );
}

function PersonRecord({ name }: { name: string }) {
  const p = personOf(name)!;
  const attended = TRAININGS.filter((t) => t.attendees.some((a) => a.name === name));
  const quals = qualificationsOf(name);
  return (
    <>
      <PaperHead title="บันทึกประวัติการฝึกอบรมรายบุคคล" number={name} form={formNo("FM-09")} />
      <Facts rows={[["ตำแหน่ง", p.role], ["ฝ่าย", p.dept], ["หลักสูตรที่ตำแหน่งต้องมี", `${p.requires.length} หลักสูตร`], ["ยังขาด", gapsOf(name).map(courseName).join(", ") || "ครบ"]]} />
      <PaperTable
        head={["เลขที่", "หลักสูตร", "วันที่", "ชั่วโมง", "วิทยากร", "ผล", "ใช้ได้ถึง"]}
        rows={attended.map((t) => {
          const q = quals.find((x) => x.training === t.no);
          return [t.no, courseName(t.course), t.date, String(t.hours), t.trainer, t.attendees.find((a) => a.name === name)?.result ?? "รออบรม", q ? (q.until ?? "ไม่หมดอายุ") : "—"];
        })}
      />
      <Signatures names={[["พนักงาน", name], ["หัวหน้างาน"], ["ผู้รับผิดชอบการฝึกอบรม", QMR]]} />
      <Foot_ />
    </>
  );
}

function Minutes({ no }: { no: string }) {
  const r = reviewByNo(no);
  return (
    <>
      <PaperHead title="รายงานการประชุมทบทวนโดยฝ่ายบริหาร" number={r.no} form={formNo("FM-10")} />
      <Facts rows={[["วันที่ประชุม", r.heldOn ?? `ตามแผน ${r.planned}`], ["ประธาน", r.chair], ["ผู้เข้าประชุม", r.attendees.join(" · ") || "—"], ["สถานะ", r.status]]} />
      <p className="mt-4 font-semibold text-slate-900">ข้อมูลเข้าการทบทวน (ข้อ 9.3.2)</p>
      <PaperTable head={["เรื่อง", "ข้อมูล"]} rows={r.inputs.map((i) => [i.title, i.facts.map((f) => `${f.label}: ${f.value}`).join(" · ")])} />
      <p className="mt-4 font-semibold text-slate-900">ผลการทบทวนและข้อสั่งการ (ข้อ 9.3.3)</p>
      <PaperTable head={["ข้อสั่งการ", "ประเภท", "ผู้รับผิดชอบ", "กำหนดเสร็จ", "เสร็จเมื่อ"]} rows={r.outputs.map((o) => [o.decision, o.kind, o.owner, o.due, o.doneOn ?? "—"])} />
      <Signatures names={[["ผู้บันทึก (QMR)", QMR], ["ประธาน", r.chair]]} />
      <Foot_ />
    </>
  );
}

export function ImsPaper({ d }: { d: ImsDoc }) {
  return (
    <Paper>
      {d.doc === "master-list" && <MasterList />}
      {d.doc === "car" && <CarReport no={d.no} />}
      {d.doc === "audit" && <AuditReport no={d.no} />}
      {d.doc === "risks" && <RiskRegister />}
      {d.doc === "person" && <PersonRecord name={d.name} />}
      {d.doc === "review" && <Minutes no={d.no} />}
    </Paper>
  );
}

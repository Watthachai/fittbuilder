import { Paper } from "../kit";
import { COMPANY, QMR, formNo } from "../ims/data";
import { Block, Facts, Foot, PaperHead, PaperTable, Signatures } from "../ims/parts";
import {
  PHASES, PPAP_ELEMENTS, apOf, chartByCode, customerName, elementStatus, fmeaByNo, grr, isDone, materialName, partOf, planByNo,
  projectByNo, rated, stats, capabilityTarget, studyByNo, submissionByNo,
} from "./data";

/** เอกสารที่พิมพ์ได้จาก Core Tools — ทุกใบมีเลขแบบฟอร์มจากบัญชีรายชื่อเอกสาร */
export type CtDoc =
  | { doc: "psw"; no: string }
  | { doc: "fmea"; no: string }
  | { doc: "control-plan"; no: string }
  | { doc: "spc"; code: string }
  | { doc: "msa"; no: string }
  | { doc: "apqp"; no: string };

const Foot_ = () => <Foot system="IATF 16949:2016 · AIAG-VDA Core Tools" />;
const f2 = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "—");
const f4 = (n: number) => (Number.isFinite(n) ? n.toFixed(4) : "—");

function Psw({ no }: { no: string }) {
  const s = submissionByNo(no);
  const p = partOf(s.part);
  return (
    <>
      <PaperHead title="ใบรับรองการส่งชิ้นส่วน (Part Submission Warrant)" number={s.no} form={formNo("FM-21")} />
      <Facts
        rows={[
          ["ชื่อชิ้นส่วน", materialName(s.part)],
          ["เลขชิ้นส่วนลูกค้า", p.customerPart],
          ["แบบเลขที่", p.drawing],
          ["โครงการ", p.program],
          ["ผู้ผลิต", COMPANY.name],
          ["ลูกค้า", customerName(p.customer)],
          ["เหตุผลที่ส่ง", s.reason],
          ["ระดับการส่ง", `ระดับ ${s.level}`],
        ]}
      />
      <PaperTable
        head={["#", "องค์ประกอบ", "สถานะ", "หมายเหตุ"]}
        rows={PPAP_ELEMENTS.map((el, i) => {
          const st = elementStatus(s, el);
          return [String(i + 1), el, st.status, st.why];
        })}
      />
      <Block title="คำรับรอง">
        ขอรับรองว่าตัวอย่างที่ส่งผลิตจากเครื่องมือ แม่พิมพ์ และกระบวนการผลิตจริง ในอัตราการผลิตจริง และเป็นไปตามข้อกำหนดทุกข้อในแบบและข้อกำหนดเฉพาะของลูกค้า
        {s.submittedOn ? ` · ลงนามส่ง ${s.submittedOn}` : " · ยังไม่ส่ง"}
      </Block>
      <Block title="ผลการพิจารณาของลูกค้า">
        {s.decision ? `${s.decision} เมื่อ ${s.decidedOn}${s.interimUntil ? ` ใช้ได้ถึง ${s.interimUntil}` : ""}${s.customerNote ? ` — ${s.customerNote}` : ""}` : "รอผล"}
      </Block>
      <Signatures names={[["ผู้ลงนามของผู้ผลิต", QMR], ["ผู้อนุมัติของลูกค้า"]]} />
      <Foot_ />
    </>
  );
}

function FmeaSheet({ no }: { no: string }) {
  const f = fmeaByNo(no);
  return (
    <>
      <PaperHead title={f.type === "PFMEA" ? "การวิเคราะห์ลักษณะความล้มเหลวของกระบวนการ (PFMEA)" : "การวิเคราะห์ลักษณะความล้มเหลวของการออกแบบ (DFMEA)"} number={`${f.no} Rev.${f.rev}`} form={formNo("FM-22")} />
      <Facts rows={[["ชิ้นส่วน", `${f.part} · ${materialName(f.part)}`], ["ปรับปรุงล่าสุด", f.date], ["ทีม", f.team.join(", ")], ["วิธีจัดลำดับ", "Action Priority ตาม AIAG-VDA"]]} />
      <PaperTable
        head={[f.type === "PFMEA" ? "ขั้นตอน" : "หน้าที่", "ความล้มเหลว", "ผลกระทบ", "สาเหตุ", "S", "O", "D", "AP", "พิเศษ", "มาตรการ", "หลังมาตรการ"]}
        rows={f.rows.map((r) => [
          r.step, r.failure, r.effect, r.cause, String(r.s), String(r.o), String(r.d), apOf({ ...r, action: undefined }), r.special ? `${r.special} ${r.characteristic}` : "—",
          r.action ? `${r.action.what} (${r.action.owner}, ${r.action.doneOn ?? `กำหนด ${r.action.due}`})` : "—",
          r.action?.doneOn ? `S${rated(r).s} O${rated(r).o} D${rated(r).d} · AP ${apOf(r)}` : "—",
        ])}
      />
      <Signatures names={[["หัวหน้าทีม", f.team[0]], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function ControlPlanSheet({ no }: { no: string }) {
  const cp = planByNo(no);
  const p = partOf(cp.part);
  return (
    <>
      <PaperHead title={`แผนควบคุม — ระยะ${cp.phase}`} number={`${cp.no} Rev.${cp.rev}`} form={formNo("FM-23")} />
      <Facts rows={[["ชิ้นส่วน", `${materialName(cp.part)} (${p.customerPart})`], ["ลูกค้า", customerName(p.customer)], ["วันที่", cp.date], ["อนุมัติ", cp.approvedBy ?? "ยังไม่อนุมัติ"]]} />
      <PaperTable
        head={["ขั้นตอน", "คุณลักษณะ", "พิเศษ", "เกณฑ์", "เครื่องมือวัด", "ขนาด/ความถี่", "วิธีควบคุม", "แผนตอบสนอง"]}
        rows={cp.rows.map((r) => [r.op, r.characteristic, r.special ?? "—", r.spec, r.gauge, r.sample, r.control, r.reaction])}
      />
      <Signatures names={[["ผู้จัดทำ", "ธนพล เจริญผล"], ["ผู้อนุมัติ (QMR)", cp.approvedBy]]} />
      <Foot_ />
    </>
  );
}

function SpcReport({ code }: { code: string }) {
  const c = chartByCode(code);
  const st = stats(c);
  return (
    <>
      <PaperHead title="รายงานความสามารถของกระบวนการ" number={c.code} form={formNo("FM-24")} />
      <Facts
        rows={[
          ["คุณลักษณะ", `${c.characteristic}${c.special ? ` (${c.special})` : ""}`],
          ["เกณฑ์", `${c.lsl} – ${c.usl}`],
          ["กลุ่มย่อย", `${c.subgroups.length} กลุ่ม × ${c.n} ชิ้น`],
          ["เป้า Ppk", String(capabilityTarget(c))],
          ["X̄", f4(st.xbar)],
          ["R̄", f4(st.rbar)],
          ["Cp / Cpk", `${f2(st.cp)} / ${f2(st.cpk)}`],
          ["Pp / Ppk", `${f2(st.pp)} / ${f2(st.ppk)}`],
        ]}
      />
      <Block title="เส้นควบคุม">UCL X̄ {f4(st.limits.uclX)} · LCL X̄ {f4(st.limits.lclX)} · UCL R {f4(st.limits.uclR)} · จุดหลุดการควบคุม {st.outOfControl.length} จุด</Block>
      <PaperTable head={["#", "วันที่", "ค่าที่วัด", "X̄", "R"]} rows={c.subgroups.map((g, i) => [String(i + 1), g.date, g.values.join("  "), f4(st.means[i]), f4(st.ranges[i])])} />
      {c.history.length > 0 && <Block title="การศึกษาก่อนหน้า">{c.history.map((h) => `ปิด ${h.closedOn}: ${h.reason} (${h.subgroups.length} กลุ่ม)`).join(" · ")}</Block>}
      <Signatures names={[["ผู้วิเคราะห์", "ธนพล เจริญผล"], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function MsaReport({ no }: { no: string }) {
  const s = studyByNo(no);
  const r = grr(s);
  return (
    <>
      <PaperHead title="รายงานการวิเคราะห์ระบบการวัด (Gage R&R)" number={s.no} form={formNo("FM-25")} />
      <Facts
        rows={[
          ["เครื่องมือวัด", `${s.gauge} · ${s.gaugeName}`],
          ["คุณลักษณะ", s.characteristic],
          ["เกณฑ์", `${s.lsl} – ${s.usl}`],
          ["วันที่ศึกษา", s.date],
          ["ผู้วัด", s.appraisers.join(", ")],
          ["วิธี", "ค่าเฉลี่ยและพิสัย · 10 ชิ้น × 3 คน × 3 ครั้ง"],
        ]}
      />
      <PaperTable
        head={["รายการ", "ค่า"]}
        rows={[
          ["ความผันแปรของเครื่องมือ (EV)", f4(r.ev)],
          ["ความผันแปรของผู้วัด (AV)", f4(r.av)],
          ["GRR", f4(r.grr)],
          ["ความผันแปรของชิ้นงาน (PV)", f4(r.pv)],
          ["%GRR เทียบความผันแปรรวม", `${r.pct}%`],
          ["จำนวนกลุ่มที่แยกได้ (ndc)", String(r.ndc)],
        ]}
      />
      <Block title="ผลการตัดสิน">{r.verdict} — เกณฑ์: ต่ำกว่า 10% และ ndc ตั้งแต่ 5 ยอมรับได้ · 10–30% ยอมรับได้แบบมีเงื่อนไข · เกิน 30% ยอมรับไม่ได้</Block>
      <Signatures names={[["ผู้วิเคราะห์", "ธนพล เจริญผล"], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

function ApqpReport({ no }: { no: string }) {
  const p = projectByNo(no);
  const part = partOf(p.part);
  return (
    <>
      <PaperHead title="รายงานสถานะ APQP" number={p.no} form={formNo("FM-26")} />
      <Facts rows={[["ชิ้นส่วน", `${materialName(p.part)} (${part.customerPart})`], ["ลูกค้า", customerName(part.customer)], ["เริ่มผลิตจริง", part.sop], ["หัวหน้าทีม", p.leader]]} />
      {PHASES.map((ph, i) => {
        const gate = p.gates.find((g) => g.phase === i);
        return (
          <div key={ph}>
            <p className="mt-4 font-semibold text-slate-900">เฟส {i + 1} {ph} — {gate ? `${gate.decision} ${gate.date}` : "ยังไม่ผ่านประตู"}</p>
            <PaperTable head={["รายการส่งมอบ", "ผู้รับผิดชอบ", "กำหนด", "สถานะ"]} rows={p.deliverables.filter((d) => d.phase === i).map((d) => [d.item, d.owner, d.due, isDone(p, d) ? "เสร็จ" : "ค้าง"])} />
          </div>
        );
      })}
      <Signatures names={[["หัวหน้าทีม", p.leader], ["ผู้อนุมัติ (QMR)", QMR]]} />
      <Foot_ />
    </>
  );
}

export function CtPaper({ d }: { d: CtDoc }) {
  return (
    <Paper>
      {d.doc === "psw" && <Psw no={d.no} />}
      {d.doc === "fmea" && <FmeaSheet no={d.no} />}
      {d.doc === "control-plan" && <ControlPlanSheet no={d.no} />}
      {d.doc === "spc" && <SpcReport code={d.code} />}
      {d.doc === "msa" && <MsaReport no={d.no} />}
      {d.doc === "apqp" && <ApqpReport no={d.no} />}
    </Paper>
  );
}

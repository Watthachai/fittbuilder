import { Paper } from "../kit";
import { EMR, TOP, formNo } from "../ims/data";
import { Block, Facts, Foot, PaperHead, PaperTable, Signatures } from "../ims/parts";
import {
  ASPECTS, DISPOSALS, DRILLS, GENERATIONS, MONITORINGS, OBLIGATIONS, PARAMETERS, WASTE_TYPES, aspectScore, exceeds, lastEvaluation,
  limitText, nextEvaluation, onHand, planByCode, significant, wasteType,
} from "./data";

/** เอกสารที่พิมพ์ได้จากระบบสิ่งแวดล้อม — ทุกใบมีเลขแบบฟอร์มจากบัญชีรายชื่อเอกสาร */
export type EmDoc =
  | { doc: "aspects" }
  | { doc: "obligations" }
  | { doc: "waste" }
  | { doc: "monitoring"; no: string }
  | { doc: "drill"; no: string };

const Foot_ = () => <Foot system="ระบบการจัดการสิ่งแวดล้อม ISO 14001:2015" />;

function AspectRegister() {
  return (
    <>
      <PaperHead title="ทะเบียนประเด็นสิ่งแวดล้อม" form={formNo("FM-16")} />
      <PaperTable
        head={["เลขที่", "กิจกรรม", "ประเด็น", "ผลกระทบ", "สภาวะ", "วัฏจักร", "ร×ถ", "กฎหมาย", "นัยสำคัญ", "การควบคุม"]}
        rows={ASPECTS.map((a) => [a.no, a.activity, a.aspect, a.impact, a.condition, a.stage, String(aspectScore(a)), a.legal ? "มี" : "—", significant(a) ? "มี" : "—", a.control ?? "—"])}
      />
      <p className="mt-3 text-slate-600">มีนัยสำคัญเมื่อมีกฎหมายเกี่ยวข้อง หรือความรุนแรง × ความถี่ตั้งแต่ 12 · ประเด็นที่มีนัยสำคัญต้องมีเอกสารควบคุมการปฏิบัติงาน</p>
      <Signatures names={[["ผู้จัดทำ (EMR)", EMR], ["ผู้อนุมัติ", TOP]]} />
      <Foot_ />
    </>
  );
}

function ObligationRegister() {
  return (
    <>
      <PaperHead title="ทะเบียนกฎหมายและผลการประเมินความสอดคล้อง" form={formNo("FM-17")} />
      <PaperTable
        head={["เลขที่", "กฎหมาย / พันธะ", "หน่วยงาน", "สิ่งที่ต้องทำ", "ประเมินล่าสุด", "ผล", "ประเมินครั้งถัดไป"]}
        rows={OBLIGATIONS.map((o) => [o.no, o.title, o.authority, o.requirement, lastEvaluation(o)?.date ?? "—", lastEvaluation(o)?.result ?? "ยังไม่ประเมิน", nextEvaluation(o)])}
      />
      <Signatures names={[["ผู้ประเมิน (EMR)", EMR], ["ผู้อนุมัติ", TOP]]} />
      <Foot_ />
    </>
  );
}

function WasteBook() {
  return (
    <>
      <PaperHead title="บัญชีของเสียและการส่งกำจัด" form={formNo("FM-18")} />
      <PaperTable
        head={["รหัส", "ของเสีย", "รหัสของเสีย", "อันตราย", "เกิดรวม (กก.)", "ส่งกำจัดรวม (กก.)", "คงเก็บ (กก.)", "เก็บนานสุด (วัน)", "วิธีกำจัด"]}
        rows={WASTE_TYPES.map((w) => {
          const gen = GENERATIONS.filter((g) => g.type === w.code).reduce((n, g) => n + g.kg, 0);
          const out = DISPOSALS.filter((d) => d.type === w.code).reduce((n, d) => n + d.kg, 0);
          const h = onHand(w.code);
          return [w.code, w.name, w.wasteCode, w.hazardous ? "ใช่" : "—", gen.toLocaleString("th-TH"), out.toLocaleString("th-TH"), h.kg.toLocaleString("th-TH"), h.kg > 0 ? String(h.days) : "—", w.method];
        })}
      />
      <p className="mt-4 font-semibold text-slate-900">การส่งกำจัด</p>
      <PaperTable
        head={["เลขที่", "วันที่", "ของเสีย", "น้ำหนัก (กก.)", "ผู้รับกำจัด", "ใบกำกับ", "ใบรับรองการกำจัด"]}
        rows={DISPOSALS.map((d) => [d.no, d.date, wasteType(d.type).name, d.kg.toLocaleString("th-TH"), d.receiver, d.manifest, d.certificate ?? "รอ"])}
      />
      <Signatures names={[["ผู้บันทึก (EMR)", EMR], ["ผู้ตรวจสอบ", "วรวุฒิ พึ่งบุญ"]]} />
      <Foot_ />
    </>
  );
}

function MonitoringReport({ no }: { no: string }) {
  const m = MONITORINGS.find((x) => x.no === no)!;
  const params = PARAMETERS.filter((p) => p.group === m.group);
  return (
    <>
      <PaperHead title="รายงานผลการตรวจวัดสิ่งแวดล้อม" number={m.no} form={formNo("FM-19")} />
      <Facts rows={[["กลุ่ม", m.group], ["วันที่เก็บตัวอย่าง", m.date], ["ห้องปฏิบัติการ", m.lab], ["จุดตรวจ", params[0]?.point ?? "—"]]} />
      <PaperTable
        head={["พารามิเตอร์", "ผลตรวจ", "ค่ามาตรฐาน", "ผล", "อ้างอิงกฎหมาย"]}
        rows={params.map((p) => [p.name, `${m.values[p.code]}${p.unit ? ` ${p.unit}` : ""}`, limitText(p), exceeds(p, m.values[p.code]) ? "เกินค่ามาตรฐาน" : "ผ่าน", p.law])}
      />
      {m.car && <Block title="การแก้ไข">เปิด {m.car} ในระบบบริหารบูรณาการ</Block>}
      <Signatures names={[["ผู้บันทึก (EMR)", EMR], ["ผู้อนุมัติ", TOP]]} />
      <Foot_ />
    </>
  );
}

function DrillReport({ no }: { no: string }) {
  const d = DRILLS.find((x) => x.no === no)!;
  const p = planByCode(d.plan);
  return (
    <>
      <PaperHead title="รายงานการฝึกซ้อมแผนฉุกเฉิน" number={d.no} form={formNo("FM-20")} />
      <Facts rows={[["แผน", `${p.code} ${p.scenario}`], ["พื้นที่", p.area], ["วันที่ซ้อม", d.date], ["ผู้เข้าร่วม", `${d.participants} คน · ${d.minutes} นาที`]]} />
      <Block title="ขั้นตอนตามแผน">
        <ol className="list-decimal pl-5">{p.response.map((r) => <li key={r}>{r}</li>)}</ol>
      </Block>
      <Block title="สิ่งที่พบ">{d.findings}</Block>
      <Block title="ผลการซ้อม">{d.result}{d.improvement ? ` — ปรับปรุง: ${d.improvement}` : ""}</Block>
      <Signatures names={[["ผู้บันทึก", d.by], ["ผู้อนุมัติ", TOP]]} />
      <Foot_ />
    </>
  );
}

export function EmPaper({ d }: { d: EmDoc }) {
  return (
    <Paper>
      {d.doc === "aspects" && <AspectRegister />}
      {d.doc === "obligations" && <ObligationRegister />}
      {d.doc === "waste" && <WasteBook />}
      {d.doc === "monitoring" && <MonitoringReport no={d.no} />}
      {d.doc === "drill" && <DrillReport no={d.no} />}
    </Paper>
  );
}

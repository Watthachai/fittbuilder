import { Paper } from "../kit";
import { formNo } from "../ims/data";
import { Block, Facts, Foot, PaperHead, PaperTable, Signatures } from "../ims/parts";
import { MATERIALS } from "../mm/data";
import { PM_RECORDS, machineByCode, planByCode, pmDue, requestByNo, wcName } from "./data";

/** เอกสารที่พิมพ์ได้จากงานบำรุงรักษา — ทุกใบมีเลขแบบฟอร์มจากบัญชีรายชื่อเอกสาร */
export type TpmDoc = { doc: "pm"; code: string } | { doc: "request"; no: string };

const materialName = (code: string) => MATERIALS.find((m) => m.code === code)?.name ?? code;

function PmSheet({ code }: { code: string }) {
  const p = planByCode(code);
  const m = machineByCode(p.machine);
  const last = PM_RECORDS.filter((r) => r.plan === code).at(-1);
  return (
    <>
      <PaperHead title="ใบตรวจเช็คบำรุงรักษาเชิงป้องกัน" number={p.code} form={formNo("FM-31")} />
      <Facts
        rows={[
          ["เครื่องจักร", `${m.code} · ${m.name}`],
          ["ศูนย์งาน", wcName(m.wc)],
          ["งาน", `${p.task} (${p.type === "AM" ? "ผู้ควบคุมเครื่องทำเอง" : "ช่างซ่อมบำรุง"})`],
          ["รอบ", p.everyShots ? `ทุก ${p.everyShots.toLocaleString("th-TH")} ครั้งปั๊ม` : `ทุก ${p.everyDays} วัน`],
          ["สถานะรอบ", pmDue(p).label],
          ["ทำล่าสุด", last ? `${last.date} โดย ${last.by}` : p.lastDone],
        ]}
      />
      <PaperTable head={["#", "รายการตรวจ", "ผ่าน", "ไม่ผ่าน", "หมายเหตุ"]} rows={p.checklist.map((c, i) => [String(i + 1), c, "☐", "☐", ""])} />
      <Block title="สิ่งที่พบและสิ่งที่ทำต่อ"><div className="h-16" /></Block>
      <Signatures names={[["ผู้ทำ"], ["หัวหน้าซ่อมบำรุง"]]} />
      <Foot system="IATF 16949:2016 ข้อ 8.5.1.5" />
    </>
  );
}

function RequestSheet({ no }: { no: string }) {
  const r = requestByNo(no);
  const m = machineByCode(r.machine);
  return (
    <>
      <PaperHead title="ใบแจ้งซ่อมและรายงานการซ่อม" number={r.no} form={formNo("FM-32")} />
      <Facts
        rows={[
          ["เครื่องจักร", `${m.code} · ${m.name}${m.critical ? " (เครื่องหลัก)" : ""}`],
          ["ผู้แจ้ง", `${r.reportedBy} · ${r.reportedOn}`],
          ["อาการ", r.symptom],
          ["ช่างผู้ซ่อม", r.technician ?? "—"],
          ["ซ่อม", r.startedOn ? `${r.startedOn} ถึง ${r.finishedOn ?? "ยังไม่เสร็จ"}` : "ยังไม่เริ่ม"],
          ["เครื่องหยุด", r.downtimeHrs !== undefined ? `${r.downtimeHrs} ชั่วโมง` : "—"],
        ]}
      />
      <Block title="สาเหตุ">{r.cause ?? "—"}</Block>
      <Block title="สิ่งที่ทำ">{r.fix ?? "—"}</Block>
      <PaperTable head={["อะไหล่", "จำนวน", "เอกสารเบิก"]} rows={r.parts.length ? r.parts.map((p) => [`${p.material} · ${materialName(p.material)}`, String(p.qty), p.doc ?? "—"]) : [["ไม่ได้ใช้อะไหล่", "", ""]]} />
      <Signatures names={[["ผู้แจ้ง", r.reportedBy], ["ช่างผู้ซ่อม", r.technician], ["ผู้รับเครื่องคืน"]]} />
      <Foot system="IATF 16949:2016 ข้อ 8.5.1.5" />
    </>
  );
}

export function TpmPaper({ d }: { d: TpmDoc }) {
  return (
    <Paper>
      {d.doc === "pm" && <PmSheet code={d.code} />}
      {d.doc === "request" && <RequestSheet no={d.no} />}
    </Paper>
  );
}

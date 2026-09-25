import type { ReactNode } from "react";
import { EMPLOYEES } from "../pa/data";
import {
  COMPANY, LEAVE_TYPES, attendanceOf, empName, leaveBalance, leaveNo,
} from "./data";
import type { FollowUp, Leave } from "./data";
import { Paper } from "../kit";

/**
 * The two papers time and leave still puts in a file: the leave form a manager
 * signs, and the warning an employee signs for. Neither has prices, so each is
 * its own layout on Paper and prints the same way.
 */

const thaiDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

function Letterhead({ title, no, date }: { title: string; no: string; date: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
      <div className="min-w-0">
        <p className="text-[16px] font-bold text-slate-900">{COMPANY.name}</p>
        <p className="mt-1 max-w-sm leading-relaxed text-slate-600">{COMPANY.address}</p>
        <p className="text-slate-600">โทร {COMPANY.phone}</p>
      </div>
      <div className="text-right">
        <p className="text-[18px] font-bold text-slate-900">{title}</p>
        <p className="mt-1 tabular-nums text-slate-600">เลขที่ {no}</p>
        <p className="tabular-nums text-slate-600">วันที่ {thaiDate(date)}</p>
      </div>
    </div>
  );
}

function Signatures({ names }: { names: { role: string; name?: string }[] }) {
  return (
    <div className="mt-12 grid gap-8" style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
      {names.map((n) => (
        <div key={n.role} className="text-center">
          <div className="mx-auto h-10 w-40 border-b border-dotted border-slate-500" />
          <p className="mt-1.5 text-slate-700">({n.name ?? "......................................"})</p>
          <p className="text-slate-600">{n.role}</p>
          <p className="text-[11px] text-slate-400">วันที่ ____/____/______</p>
        </div>
      ))}
    </div>
  );
}

function Pair({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex gap-2 py-0.5">
      <span className="w-32 shrink-0 text-slate-500">{k}</span>
      <span className="min-w-0 flex-1 text-slate-900">{children}</span>
    </div>
  );
}

/** ใบลา — แบบฟอร์มที่ผู้ลาและหัวหน้าเซ็น พร้อมสิทธิ์ลาคงเหลือ ณ วันพิมพ์ */
export function LeavePaper({ leave }: { leave: Leave }) {
  const e = EMPLOYEES.find((x) => x.id === leave.employeeId);
  const b = leaveBalance(leave.employeeId, leave.type, leave.from.slice(0, 4));
  return (
    <Paper>
      <Letterhead title="ใบลา" no={leaveNo(leave)} date={leave.filedAt} />

      <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
        <Pair k="ชื่อ-นามสกุล">{empName(leave.employeeId)}</Pair>
        <Pair k="รหัสพนักงาน">{e?.code ?? "—"}</Pair>
        <Pair k="ตำแหน่ง">{e?.position ?? "—"}</Pair>
        <Pair k="แผนก">{e?.department ?? "—"}</Pair>
      </div>

      <p className="mt-4 font-semibold text-slate-900">ประเภทการลา</p>
      <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
        {LEAVE_TYPES.map((t) => (
          <span key={t.name} className="text-slate-800">
            {t.name === leave.type ? "☑" : "☐"} {t.name}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-0.5">
        <Pair k="ตั้งแต่วันที่">
          {thaiDate(leave.from)} ถึง {thaiDate(leave.to)} · รวม {leave.days} วันทำงาน
        </Pair>
        <Pair k="เหตุผล">{leave.reason || "ไม่ได้ระบุ"}</Pair>
        {leave.type === "ลาป่วย" && <Pair k="ใบรับรองแพทย์">{leave.certificate ? "แนบแล้ว" : "ไม่มี"}</Pair>}
      </div>

      {b.limited && (
        <table className="mt-4 w-full border-collapse text-center">
          <thead>
            <tr className="bg-slate-100 text-[11.5px] text-slate-600">
              {["สิทธิ์ทั้งปี", "อนุมัติแล้ว", "รออนุมัติ", "คงเหลือ"].map((h) => (
                <th key={h} className="border border-slate-300 px-2 py-1.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="tabular-nums">
              <td className="border border-slate-300 px-2 py-1.5">{b.quota} วัน</td>
              <td className="border border-slate-300 px-2 py-1.5">{b.used} วัน</td>
              <td className="border border-slate-300 px-2 py-1.5">{b.pending} วัน</td>
              <td className="border border-slate-300 px-2 py-1.5 font-semibold">{b.left - b.pending} วัน</td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="mt-4 rounded-md border border-slate-300 p-3">
        <p className="text-slate-500">ความเห็นผู้บังคับบัญชา</p>
        <p className="mt-1 font-semibold text-slate-900">
          {leave.status === "รออนุมัติ" ? "☐ อนุมัติ   ☐ ไม่อนุมัติ" : `${leave.status}${leave.decidedBy ? ` โดย ${leave.decidedBy}` : ""}`}
        </p>
        {leave.note && <p className="mt-1 text-slate-700">{leave.note}</p>}
      </div>

      <Signatures
        names={[
          { role: "ผู้ลา", name: empName(leave.employeeId) },
          { role: "ผู้บังคับบัญชา", name: leave.status === "รออนุมัติ" ? undefined : leave.decidedBy },
          { role: "ฝ่ายบุคคล" },
        ]}
      />
    </Paper>
  );
}

/**
 * หนังสือเตือน หรือบันทึกการตักเตือนด้วยวาจา — ข้อความเรื่องผลของการทำผิดซ้ำ
 * อ้างมาตรา 119 เพราะหนังสือเตือนที่ไม่บอกผลใช้อ้างเลิกจ้างไม่ได้
 */
export function WarningPaper({ item }: { item: FollowUp }) {
  const e = EMPLOYEES.find((x) => x.id === item.employeeId);
  const a = attendanceOf(item.employeeId);
  const letter = item.kind === "หนังสือเตือน";
  return (
    <Paper>
      <Letterhead title={letter ? "หนังสือเตือน" : "บันทึกการตักเตือน"} no={item.no} date={item.date} />

      <div className="mt-4 space-y-0.5">
        <Pair k="เรียน">
          คุณ{empName(item.employeeId)} ({e?.code ?? "—"}) {e?.position ?? ""} {e?.department ?? ""}
        </Pair>
        <Pair k="เรื่อง">ตักเตือนเรื่อง{item.topic}</Pair>
      </div>

      <div className="mt-4 space-y-3 leading-relaxed text-slate-800">
        <p>{item.detail}</p>
        <p>
          สถิติการเข้างานในงวดปัจจุบัน: วันทำงานตามกะ {a.scheduled} วัน มาสาย {a.late} ครั้ง ขาดงาน {a.absent} วัน
        </p>
        <p>
          การกระทำดังกล่าวฝ่าฝืนข้อบังคับเกี่ยวกับการทำงานของบริษัทเรื่องเวลาทำงานและการลา
          {letter
            ? " บริษัทจึงออกหนังสือฉบับนี้เพื่อตักเตือนเป็นลายลักษณ์อักษร หากกระทำผิดซ้ำในเรื่องเดียวกันภายในหนึ่งปีนับจากวันที่กระทำผิด บริษัทอาจพิจารณาเลิกจ้างโดยไม่จ่ายค่าชดเชย ตามมาตรา 119 (4) แห่งพระราชบัญญัติคุ้มครองแรงงาน พ.ศ. 2541"
            : " ผู้บังคับบัญชาได้ตักเตือนด้วยวาจาและชี้แจงข้อบังคับแล้ว บันทึกนี้เก็บไว้เป็นหลักฐานในแฟ้มพนักงาน"}
        </p>
      </div>

      <Signatures
        names={[
          { role: "ผู้บังคับบัญชา", name: item.by },
          { role: "พนักงานผู้รับทราบ", name: empName(item.employeeId) },
          { role: "พยาน" },
        ]}
      />
    </Paper>
  );
}

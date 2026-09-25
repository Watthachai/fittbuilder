import type { ReactNode } from "react";
import {
  Ban, BellRing, CalendarCheck, CalendarDays, CircleCheck, CircleX, Clock3, FileText, FileWarning, LogIn, LogOut,
  MessageSquareWarning, Pencil, Printer, Timer, UserRound,
} from "lucide-react";
import type { Employee } from "../pa/data";
import {
  LEAVE_TYPES, approvedOtHours, attendanceOf, canCancelLeave, daysBetween, empName, fixesOf, followUpsOf, hhmm,
  judge, leaveBalance, leaveNo, pendingFixOf, punchesOf, shiftOf, shiftOn,
} from "./data";
import type { FollowUp, FollowUpKind, Leave, Punch, PunchFix } from "./data";
import { Avatar, Badge, Bar, Button, Chip, IconRow, Note, Progress, Tag } from "../ui";
import { MiniButton, REQUEST_TONE, STATE_TONE, STATUS_TONE, shiftSwatch, typeSwatch } from "./shared";

/** A punch with its verdict and the person it belongs to, worked out once. */
export type Day = { punch: Punch; employee: Employee; verdict: ReturnType<typeof judge> };

function Head({ name, sub, badges, actions }: { name: string; sub: ReactNode; badges: ReactNode; actions: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
      <Avatar name={name} size="xl" />
      <div className="min-w-0 flex-1">
        <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">{name}</h2>
        <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">{sub}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div>
    </div>
  );
}

const Label = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">{children}</p>
);

/* ----------------------------------------------------------------- leave */

export function LeaveRecord({
  leave,
  onApprove,
  onReject,
  onEdit,
  onCancel,
  onPrint,
}: {
  leave: Leave;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onPrint: () => void;
}) {
  const type = LEAVE_TYPES.find((t) => t.name === leave.type)!;
  const b = leaveBalance(leave.employeeId, leave.type, leave.from.slice(0, 4));
  const days = daysBetween(leave.from, leave.to);
  const waiting = leave.status === "รออนุมัติ";

  return (
    <div>
      <Head
        name={empName(leave.employeeId)}
        sub={`${leaveNo(leave)} · ${leave.from} ถึง ${leave.to} · ${leave.days} วัน · ยื่นเมื่อ ${leave.filedAt}`}
        badges={
          <>
            <Tag swatch={typeSwatch(leave.type)}>{leave.type}</Tag>
            <Badge tone={STATUS_TONE[leave.status]} dot>
              {leave.status}
            </Badge>
            <Chip>{type.paid ? "ได้รับค่าจ้าง" : "ไม่ได้รับค่าจ้าง"}</Chip>
            {leave.certificate && <Chip>มีใบรับรองแพทย์</Chip>}
          </>
        }
        actions={
          <>
            {waiting && (
              <>
                <Button variant="primary" icon={<CircleCheck size={15} />} onClick={onApprove}>
                  อนุมัติ
                </Button>
                <Button variant="secondary" icon={<CircleX size={15} />} onClick={onReject}>
                  ไม่อนุมัติ
                </Button>
                <Button variant="secondary" icon={<Pencil size={15} />} onClick={onEdit}>
                  แก้ไข
                </Button>
              </>
            )}
            {canCancelLeave(leave) && (
              <Button variant="ghost" icon={<Ban size={15} />} onClick={onCancel}>
                ยกเลิกใบลา
              </Button>
            )}
            <Button variant="ghost" icon={<Printer size={15} />} onClick={onPrint}>
              พิมพ์ใบลา
            </Button>
          </>
        }
      />

      <div className="space-y-4 px-5 py-4">
        <div className="space-y-1">
          <IconRow icon={<FileText size={14} />} label="เหตุผล">{leave.reason || "ไม่ได้ระบุ"}</IconRow>
          <IconRow icon={<CalendarDays size={14} />} label="วันที่ลา">
            {days.map((d) => `${d.slice(8)}/${d.slice(5, 7)}`).join(" · ")}
          </IconRow>
          <IconRow icon={<UserRound size={14} />} label="ผู้พิจารณา">{leave.decidedBy ?? "ยังไม่มีการพิจารณา"}</IconRow>
        </div>

        {b.limited && (
          <div>
            <Label>สิทธิ์{leave.type}ปีนี้</Label>
            <Progress
              done={b.used}
              total={Math.max(1, b.quota)}
              label={`อนุมัติแล้ว ${b.used} จาก ${b.quota} วัน · รออนุมัติ ${b.pending} วัน · คงเหลือ ${b.left} วัน`}
            />
          </div>
        )}

        {leave.note && <Note tone={leave.status === "ไม่อนุมัติ" ? "bad" : "idle"}>{leave.note}</Note>}

        {waiting && b.limited && b.used + leave.days > b.quota && (
          <Note tone="warn">
            อนุมัติใบนี้แล้วจะใช้สิทธิ์{leave.type}เกินไป {b.used + leave.days - b.quota} วัน
            เพราะมีใบอื่นที่อนุมัติไปก่อนหน้า ส่วนที่เกินควรเปลี่ยนเป็นลาไม่รับค่าจ้าง
          </Note>
        )}

        <div>
          <Label>ตารางกะในวันที่ลา</Label>
          <ul className="space-y-1.5">
            {days.map((d) => {
              const code = shiftOn(leave.employeeId, d) ?? "O";
              const s = shiftOf(code);
              return (
                <li key={d} className="flex items-center gap-2.5 text-[13px]">
                  <span className="w-24 shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{d}</span>
                  <Tag swatch={shiftSwatch(code)}>{s.name}</Tag>
                  <span className="text-slate-400">{code === "O" ? "เป็นวันหยุดอยู่แล้ว ไม่หักสิทธิ์" : `${s.start}–${s.end}`}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- day */

function FixLine({ fix, onApprove, onReject }: { fix: PunchFix; onApprove?: () => void; onReject?: () => void }) {
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-[12.5px]">
      <Badge tone={REQUEST_TONE[fix.status]} dot>
        {fix.status}
      </Badge>
      <span className="tabular-nums text-slate-700 dark:text-slate-200">
        {fix.before.in ?? "—"}–{fix.before.out ?? "—"} → {fix.in}–{fix.out}
      </span>
      <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-slate-400">
        {fix.reason}
        {fix.note ? ` · ${fix.note}` : ""}
      </span>
      {onApprove && onReject && (
        <span className="flex gap-1.5">
          <MiniButton tone="ok" onClick={onApprove}>
            อนุมัติ
          </MiniButton>
          <MiniButton tone="bad" onClick={onReject}>
            ไม่อนุมัติ
          </MiniButton>
        </span>
      )}
    </li>
  );
}

export function DayRecord({
  row,
  onFix,
  onOt,
  onApproveFix,
  onRejectFix,
}: {
  row: Day;
  onFix: () => void;
  onOt: () => void;
  onApproveFix: (f: PunchFix) => void;
  onRejectFix: (f: PunchFix) => void;
}) {
  const s = shiftOf(row.punch.shift);
  const a = attendanceOf(row.employee.id);
  const pending = pendingFixOf(row.punch.id);
  const history = fixesOf(row.punch.id);
  const onLeave = row.verdict.state === "ลา";

  return (
    <div>
      <Head
        name={row.employee.name}
        sub={`${row.punch.date} · ${s.name} ${s.start}–${s.end}`}
        badges={
          <>
            <Badge tone={STATE_TONE[row.verdict.state]} dot>
              {row.verdict.state}
            </Badge>
            <Tag swatch={shiftSwatch(row.punch.shift)}>{s.name}</Tag>
            {history.some((f) => f.status === "อนุมัติแล้ว") && <Chip>แก้ไขเวลาแล้ว</Chip>}
            {pending && <Badge tone="warn">มีคำขอแก้เวลารออนุมัติ</Badge>}
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon={<Pencil size={15} />} onClick={onFix} disabled={pending !== undefined || onLeave}>
              ขอแก้เวลา
            </Button>
            <Button variant="secondary" icon={<Timer size={15} />} onClick={onOt} disabled={onLeave}>
              ขอล่วงเวลา
            </Button>
          </>
        }
      />

      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <LogIn size={15} />, label: "เวลาเข้า", value: row.punch.in ?? "ไม่ได้ตอก" },
            { icon: <LogOut size={15} />, label: "เวลาออก", value: row.punch.out ?? "ไม่ได้ตอก" },
            { icon: <Clock3 size={15} />, label: "ชั่วโมงทำงาน", value: row.verdict.workedMin > 0 ? hhmm(row.verdict.workedMin) : "—" },
            { icon: <Timer size={15} />, label: "ล่วงเวลา", value: row.verdict.otMin ? hhmm(row.verdict.otMin) : "—" },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
              <div className="flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                <span className="text-slate-400">{c.icon}</span>
                {c.label}
              </div>
              <div className="mt-1 text-[16px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
            </div>
          ))}
        </div>

        {row.verdict.state === "มาสาย" && (
          <Note tone="warn">เข้างานช้ากว่าเวลาเริ่มกะ {row.verdict.lateMin} นาที เกินเกณฑ์ 15 นาทีจึงนับเป็นมาสาย</Note>
        )}
        {row.verdict.state === "ขาดงาน" && (
          <Note tone="bad">
            วันนี้อยู่ในตารางกะแต่ไม่มีการตอกบัตรทั้งเข้าและออก ถ้าลืมตอกให้ขอแก้เวลา ถ้าป่วยให้ยื่นลาย้อนหลังสำหรับวันนี้
          </Note>
        )}
        {onLeave && <Note tone="info">วันนี้มีใบลาที่อนุมัติแล้ว จึงนับเป็นวันลา ไม่ใช่ขาดงาน</Note>}

        {history.length > 0 && (
          <div>
            <Label>คำขอแก้เวลาของวันนี้</Label>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((f) =>
                f.status === "รออนุมัติ" ? (
                  <FixLine key={f.id} fix={f} onApprove={() => onApproveFix(f)} onReject={() => onRejectFix(f)} />
                ) : (
                  <FixLine key={f.id} fix={f} />
                )
              )}
            </ul>
          </div>
        )}

        <div>
          <Label>สถิติทั้งงวดของคนนี้</Label>
          <div className="space-y-1">
            <IconRow icon={<CalendarCheck size={14} />} label="วันตามกะ">{a.scheduled} วัน</IconRow>
            <IconRow icon={<Clock3 size={14} />} label="มาสาย">{a.late} ครั้ง</IconRow>
            <IconRow icon={<CircleX size={14} />} label="ขาดงาน">{a.absent} วัน</IconRow>
            <IconRow icon={<Timer size={14} />} label="ล่วงเวลาสะสม">{hhmm(a.otMin)}</IconRow>
          </div>
          <div className="mt-2">
            <Bar pct={a.rate} tone={a.rate === 100 ? "ok" : a.rate >= 90 ? "warn" : "bad"} width="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ follow-up */

const KIND_TONE: Record<FollowUpKind, "info" | "warn" | "bad"> = {
  แจ้งเตือน: "info",
  ตักเตือนด้วยวาจา: "warn",
  หนังสือเตือน: "bad",
};

/** การเข้างานของคนหนึ่งทั้งงวด พร้อมประวัติการติดตาม — ที่หัวหน้าตัดสินใจว่าจะเตือนหรือไม่ */
export function PersonRecord({
  employee,
  onFollowUp,
  onPrint,
  onOpenDay,
}: {
  employee: Employee;
  onFollowUp: (kind: FollowUpKind) => void;
  onPrint: (f: FollowUp) => void;
  onOpenDay: (p: Punch) => void;
}) {
  const a = attendanceOf(employee.id);
  const ot = approvedOtHours(employee.id);
  const marks = punchesOf(employee.id)
    .map((p) => ({ p, j: judge(p) }))
    .filter((x) => x.j.state === "มาสาย" || x.j.state === "ขาดงาน")
    .sort((x, y) => y.p.date.localeCompare(x.p.date));
  const log = followUpsOf(employee.id);

  return (
    <div>
      <Head
        name={employee.name}
        sub={`${employee.code} · ${employee.position} · ${employee.department}`}
        badges={
          <>
            <Badge tone={a.rate === 100 ? "ok" : a.rate >= 90 ? "warn" : "bad"} dot>
              เข้างาน {a.rate}%
            </Badge>
            {a.late > 0 && <Badge tone="warn">สาย {a.late} ครั้ง</Badge>}
            {a.absent > 0 && <Badge tone="bad">ขาด {a.absent} วัน</Badge>}
            {log.length > 0 && <Chip>ติดตามแล้ว {log.length} ครั้ง</Chip>}
          </>
        }
        actions={
          <>
            <Button variant="primary" icon={<BellRing size={15} />} onClick={() => onFollowUp("แจ้งเตือน")}>
              ส่งข้อความเตือน
            </Button>
            <Button variant="secondary" icon={<MessageSquareWarning size={15} />} onClick={() => onFollowUp("ตักเตือนด้วยวาจา")}>
              บันทึกการตักเตือน
            </Button>
            <Button variant="secondary" icon={<FileWarning size={15} />} onClick={() => onFollowUp("หนังสือเตือน")}>
              ออกหนังสือเตือน
            </Button>
          </>
        }
      />

      <div className="grid gap-5 px-5 py-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-1">
            <IconRow icon={<CalendarCheck size={14} />} label="วันตามกะ">{a.scheduled} วัน · มาทำงาน {a.worked} วัน</IconRow>
            <IconRow icon={<CalendarDays size={14} />} label="ลา">{a.leaveDays} วัน</IconRow>
            <IconRow icon={<Timer size={14} />} label="ล่วงเวลา">
              ตามเวลาตอกบัตร {hhmm(a.otMin)} · อนุมัติจ่าย {ot} ชม.
            </IconRow>
          </div>
          <div>
            <Label>วันที่มาสายหรือขาดงาน</Label>
            {marks.length === 0 ? (
              <p className="py-4 text-[12.5px] text-slate-400">ตรงเวลาทุกวันในงวดนี้</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {marks.map(({ p, j }) => (
                  <li key={p.id}>
                    <button onClick={() => onOpenDay(p)} className="flex w-full items-center gap-3 py-2 text-left text-[13px]">
                      <span className="w-24 shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{p.date}</span>
                      <Badge tone={STATE_TONE[j.state]} dot>
                        {j.state}
                        {j.state === "มาสาย" ? ` ${j.lateMin} น.` : ""}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-slate-400">
                        {pendingFixOf(p.id) ? "มีคำขอแก้เวลารออนุมัติ" : `เข้า ${p.in ?? "—"} ออก ${p.out ?? "—"}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <Label>ประวัติการติดตาม</Label>
          {log.length === 0 ? (
            <p className="py-4 text-[12.5px] text-slate-400">ยังไม่เคยเตือนหรือตักเตือน</p>
          ) : (
            <ul className="space-y-2">
              {log.map((f) => (
                <li key={f.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND_TONE[f.kind]}>{f.kind}</Badge>
                    <span className="text-[12px] text-slate-500 dark:text-slate-400">
                      {f.no} · {f.date} · เรื่อง{f.topic} · โดย {f.by}
                    </span>
                    {f.kind !== "แจ้งเตือน" && (
                      <span className="ml-auto">
                        <MiniButton onClick={() => onPrint(f)}>
                          <Printer size={12} /> พิมพ์
                        </MiniButton>
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200">{f.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

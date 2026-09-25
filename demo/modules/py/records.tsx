import { useState } from "react";
import type { ReactNode } from "react";
import { CalendarClock, Clock3, Coins, CreditCard, Landmark, Pencil, Percent, Plus, Printer, Scale, Wallet } from "lucide-react";
import { SSO_CAP, SSO_RATE, TAX_BANDS, baht, bankOf, isLocked } from "./data";
import type { Payslip, Period } from "./data";
import { Avatar, Badge, Bar, Button, Chip, IconRow, Note, Progress, Tabs, Tag } from "../ui";
import { STATUS_TONE, planSwatch } from "./shared";

const SLIP_TABS = ["รายได้", "รายการหัก", "ที่มาของภาษี", "การจ่ายเงิน"];
const SLIP_TAB_ICONS: Record<string, ReactNode> = {
  รายได้: <Coins size={13} />,
  รายการหัก: <Scale size={13} />,
  ที่มาของภาษี: <Percent size={13} />,
  การจ่ายเงิน: <CreditCard size={13} />,
};

/** One payslip, every line with where it came from — and what can still be changed on it. */
export function Slip({
  slip,
  period,
  onPrint,
  onAdjust,
  onEditAttendance,
}: {
  slip: Payslip;
  period: Period;
  onPrint: () => void;
  onAdjust: () => void;
  onEditAttendance: () => void;
}) {
  const [tab, setTab] = useState(SLIP_TABS[0]);
  const bank = bankOf(slip.employeeId);
  const open = !isLocked(period);

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 pb-5 pt-4 dark:border-slate-800">
        <Avatar name={slip.employee.name} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">{slip.employee.name}</h2>
          <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400">
            {slip.employee.code} · {slip.employee.position} · {slip.employee.department}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip>{period.label}</Chip>
            <Badge tone={STATUS_TONE[period.status]} dot>
              {period.status}
            </Badge>
            {!open && <Chip>ล็อกแล้ว แก้ไม่ได้</Chip>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Printer size={15} />} onClick={onPrint}>
              พิมพ์สลิป
            </Button>
            {open && (
              <>
                <Button variant="secondary" icon={<Plus size={15} />} onClick={onAdjust}>
                  เพิ่มรายการเงินได้/เงินหัก
                </Button>
                <Button variant="ghost" icon={<Pencil size={15} />} onClick={onEditAttendance}>
                  แก้ขาดลามาสาย
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11.5px] text-slate-400">จ่ายสุทธิ</p>
          <p className="text-[24px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(slip.netPay)}</p>
        </div>
      </div>

      <div className="px-5">
        <Tabs tabs={SLIP_TABS} active={tab} onPick={setTab} icons={SLIP_TAB_ICONS} id="slip" />
      </div>

      <div className="px-5 py-4">
        {tab === "รายได้" && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            <Line
              label="เงินเดือนฐาน"
              note={
                slip.base === slip.fullBase
                  ? `${baht(Math.round(slip.perDay))} ต่อวัน · ${period.workDays} วันทำงาน`
                  : `เป็นพนักงาน ${slip.employedDays} จาก ${slip.daysInMonth} วันของเดือน · เต็มเดือน ${baht(slip.fullBase)}`
              }
              value={slip.base}
            />
            {slip.benefitLines.map((b) => (
              <Line
                key={b.code}
                label={b.name}
                note={b.forfeited ? "ถูกตัดทั้งก้อนเพราะมีวันขาดงานในงวดนี้" : b.note}
                value={b.amount}
                muted={b.forfeited}
                tag={<Tag swatch={planSwatch(b.code)}>{b.taxable ? "คิดภาษี" : "ยกเว้น"}</Tag>}
              />
            ))}
            {slip.otNormalPay > 0 && (
              <Line label="ค่าล่วงเวลา" note={`${slip.otHours} ชั่วโมง × ${baht(Math.round(slip.perHour))} × 1.5`} value={slip.otNormalPay} />
            )}
            {slip.otHolidayPay > 0 && (
              <Line label="ค่าล่วงเวลาในวันหยุด" note={`${slip.holidayOtHours} ชั่วโมง × ${baht(Math.round(slip.perHour))} × 3`} value={slip.otHolidayPay} />
            )}
            {slip.adjustments
              .filter((a) => a.sign > 0)
              .map((a) => (
                <Line key={a.id} label={a.kind} note={a.note} value={a.amount} tag={<Tag swatch={planSwatch("COMM")}>{a.taxable ? "คิดภาษี" : "ยกเว้น"}</Tag>} />
              ))}
            {slip.claimLines.map((c) => (
              <Line key={c.id} label={`เบิก${c.type}`} note={`${c.no} · ${c.detail}`} value={c.amount} tag={<Tag swatch={planSwatch("TRV")}>{c.taxable ? "คิดภาษี" : "ยกเว้น"}</Tag>} />
            ))}
            <Line label="รวมรายได้" value={slip.gross} strong />
          </ul>
        )}

        {tab === "รายการหัก" && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {slip.absentDays > 0 && (
              <Line label="ขาดงาน" note={`${slip.absentDays} วัน × ${baht(Math.round(slip.perDay))}`} value={-Math.round(slip.absentDays * slip.perDay)} />
            )}
            {slip.unpaidDays > 0 && (
              <Line label="ลาไม่รับค่าจ้าง" note={`${slip.unpaidDays} วัน × ${baht(Math.round(slip.perDay))}`} value={-Math.round(slip.unpaidDays * slip.perDay)} />
            )}
            {slip.lateMinutes > 0 && (
              <Line label="มาสาย" note={`${slip.lateMinutes} นาที คิดตามฐานต่อชั่วโมง ${baht(Math.round(slip.perHour))}`} value={-slip.lateCut} />
            )}
            <Line label="ประกันสังคม" note={`${SSO_RATE * 100}% ของค่าจ้าง ${baht(slip.ssoBase)} สูงสุด ${SSO_CAP} บาท`} value={-slip.sso} />
            {slip.pvd > 0 && (
              <Line label="กองทุนสำรองเลี้ยงชีพ" note={`${Math.round(slip.pvdRate * 100)}% ตามที่ตกลงไว้ในแฟ้มพนักงาน`} value={-slip.pvd} />
            )}
            <Line
              label="ภาษีหัก ณ ที่จ่าย"
              note={slip.taxOneOff ? `ประจำเดือน ${baht(slip.taxRegular)} + เงินได้ครั้งคราว ${baht(slip.taxOneOff)}` : "คำนวณจากขั้นภาษีทั้งปีแล้วเฉลี่ยรายเดือน"}
              value={-slip.tax}
            />
            {slip.adjustments
              .filter((a) => a.sign < 0)
              .map((a) => (
                <Line key={a.id} label={a.kind} note={a.note} value={-a.amount} />
              ))}
            <Line label="รวมรายการหัก" value={-slip.deductions} strong />
          </ul>
        )}

        {tab === "ที่มาของภาษี" && <TaxBreakdown slip={slip} />}

        {tab === "การจ่ายเงิน" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <IconRow icon={<CreditCard size={14} />} label="วิธีจ่าย">{bank.method}</IconRow>
              <IconRow icon={<Landmark size={14} />} label="ธนาคาร">{bank.method === "เงินสด" ? "รับที่ฝ่ายบัญชี" : bank.bank}</IconRow>
              <IconRow icon={<Wallet size={14} />} label="เลขบัญชี">{bank.account}</IconRow>
              <IconRow icon={<CalendarClock size={14} />} label="กำหนดจ่าย">{period.payDate}</IconRow>
              {slip.note && <IconRow icon={<Clock3 size={14} />} label="หมายเหตุการแก้">{slip.note}</IconRow>}
            </div>
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">สัดส่วนที่ถูกหักจากรายได้</p>
              <Progress done={slip.deductions} total={slip.gross} label={`หัก ${baht(slip.deductions)} จากรายได้ ${baht(slip.gross)}`} />
            </div>
            <Note tone={period.status === "จ่ายแล้ว" ? "ok" : "idle"}>
              {period.status === "จ่ายแล้ว"
                ? `จ่ายแล้วเมื่อ ${period.paidAt ?? period.payDate} ยอดสุทธิ ${baht(slip.netPay)}`
                : `งวดนี้อยู่ในสถานะ${period.status} ยอดจะถูกโอนในวันที่ ${period.payDate}`}
            </Note>
          </div>
        )}
      </div>
    </div>
  );
}

function Line({
  label,
  note,
  value,
  strong,
  muted,
  tag,
}: {
  label: string;
  note?: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
  tag?: ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span
          className={
            "flex items-center gap-2 text-[13px] " +
            (strong
              ? "font-semibold text-slate-900 dark:text-slate-50"
              : muted
                ? "text-slate-400 line-through"
                : "text-slate-800 dark:text-slate-100")
          }
        >
          {label}
          {tag}
        </span>
        {note && <span className="mt-0.5 block text-[11.5px] text-slate-400">{note}</span>}
      </span>
      <span
        className={
          "shrink-0 tabular-nums " +
          (strong ? "text-[15px] font-semibold " : "text-[13px] ") +
          (value < 0 ? "text-rose-600 dark:text-rose-400" : muted ? "text-slate-400" : "text-slate-900 dark:text-slate-50")
        }
      >
        {baht(value)}
      </span>
    </li>
  );
}

/** How this slip's withholding was worked out, line by line, from the year's income down. */
export function TaxBreakdown({ slip }: { slip: Payslip }) {
  const year = slip.taxableMonth * 12;
  const t = slip.yearTax;
  const net = t.net;
  const rows = [
    { label: "เงินได้ที่ต้องเสียภาษีทั้งปี", value: year, note: "เงินได้ประจำของเดือนนี้คูณสิบสอง" },
    { label: "หักค่าใช้จ่าย", value: -t.expense, note: "50% ของเงินได้ แต่ไม่เกิน 100,000 บาท" },
    { label: "หักค่าลดหย่อนส่วนตัว", value: -t.allowance, note: "อัตราเดียวสำหรับผู้มีเงินได้ทุกคน" },
    { label: "หักประกันสังคมทั้งปี", value: -t.sso, note: `${baht(slip.sso)} ต่อเดือน` },
    ...(t.pvd ? [{ label: "หักเงินสะสมกองทุนสำรองเลี้ยงชีพ", value: -t.pvd, note: `${baht(slip.pvd)} ต่อเดือน ไม่เกิน 15% ของค่าจ้าง` }] : []),
  ];

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-slate-800 dark:text-slate-100">{r.label}</span>
              <span className="block text-[11.5px] text-slate-400">{r.note}</span>
            </span>
            <span className={"shrink-0 text-[13px] tabular-nums " + (r.value < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-50")}>
              {baht(r.value)}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-3 py-2">
          <span className="min-w-0 flex-1 text-[13px] font-medium text-slate-900 dark:text-slate-50">เงินได้สุทธิ</span>
          <span className="shrink-0 text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(net)}</span>
        </li>
      </ul>

      <Note tone="accent">
        ภาษีทั้งปี {baht(Math.round(t.tax))} เฉลี่ยเป็นรายเดือน {baht(slip.taxRegular)}
        {slip.taxOneOff > 0 && ` และเงินได้ครั้งคราว ${baht(slip.taxableOneOff)} ทำให้ภาษีทั้งปีเพิ่ม ${baht(slip.taxOneOff)} ซึ่งหักในงวดนี้ครั้งเดียว`}
        {" "}รวมหักในสลิปงวดนี้ {baht(slip.tax)}
      </Note>

      <div className="space-y-1.5">
        {TAX_BANDS.map((b, i) => {
          const from = i === 0 ? 0 : TAX_BANDS[i - 1].upTo;
          const inBand = Math.max(0, Math.min(net, b.upTo) - from);
          if (inBand === 0) return null;
          return (
            <div key={i} className="flex items-center gap-3 text-[12.5px]">
              <span className="w-32 shrink-0 tabular-nums text-slate-500 dark:text-slate-400">{from.toLocaleString("th-TH")}+</span>
              <span className="min-w-0 flex-1">
                <Bar pct={(inBand / net) * 100} tone={b.rate === 0 ? "idle" : "accent"} width="w-full" />
              </span>
              <span className="w-12 shrink-0 text-right tabular-nums text-slate-600 dark:text-slate-300">{Math.round(b.rate * 100)}%</span>
              <span className="w-24 shrink-0 text-right tabular-nums text-slate-900 dark:text-slate-50">{baht(inBand * b.rate)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

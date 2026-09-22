import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, Banknote, Calculator, CalendarClock, Circle, CircleCheck, CircleDot, CircleX,
  Clock3, Coins, CreditCard,
  Gift, HandCoins, Landmark, Percent, PiggyBank, Receipt, Scale, Search as SearchIcon,
  ShieldCheck, TrendingUp, TriangleAlert, Wallet,
} from "lucide-react";
import {
  BANKS, BENEFIT_PLANS, PERIODS, PERIOD_FLOW, SSO_CAP, SSO_RATE, TAX_BANDS, TODAY, annualTax,
  baht, periodById, periodCost, slipsFor,
} from "./data";
import type { Payslip, Period, PeriodStatus, Variable } from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, FIELD, IconRow, Note, PageHead,
  Progress, Reveal, Search, Segmented, Select, StatStrip, Stepper, Tabs, Tag, TintCard, swatchFor,
} from "../ui";
import type { StepState } from "../ui";
import { ConfirmDialog, DataTable, DetailModal, Field, FormModal } from "../kit";
import type { Column } from "../kit";

const TABS = ["คำนวณเงินเดือน", "สวัสดิการ", "ขาดลามาสาย", "ภาษีและประกันสังคม", "การจ่ายเงิน"];

const SLIP_TABS = ["รายได้", "รายการหัก", "ที่มาของภาษี", "การจ่ายเงิน"];
const SLIP_TAB_ICONS: Record<string, ReactNode> = {
  รายได้: <Coins size={13} />,
  รายการหัก: <Scale size={13} />,
  ที่มาของภาษี: <Percent size={13} />,
  การจ่ายเงิน: <CreditCard size={13} />,
};

const PLAN_ORDER = BENEFIT_PLANS.map((p) => p.code);
const planSwatch = (code: string) => swatchFor(code, PLAN_ORDER);

const EARNING_KINDS = ["เงินเดือนฐาน", "สวัสดิการ", "ล่วงเวลา"];

const FLOW_ICONS = {
  done: <CircleCheck size={14} />,
  current: <CircleDot size={14} />,
  todo: <Circle size={14} />,
  failed: <CircleX size={14} />,
};

const STATUS_TONE: Record<PeriodStatus, "idle" | "warn" | "info" | "ok"> = {
  กำลังคำนวณ: "idle",
  รอตรวจสอบ: "warn",
  อนุมัติแล้ว: "info",
  จ่ายแล้ว: "ok",
};

/* ----------------------------------------------------------------- screen */

export default function PyScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  const tab = section && TABS.includes(section) ? section : undefined;

  const [periodId, setPeriodId] = useState(PERIODS[0].id);
  const [statuses, setStatuses] = useState<Record<number, PeriodStatus>>({});
  const [overrides, setOverrides] = useState<Record<number, Record<number, Partial<Variable>>>>({});
  const [q, setQ] = useState("");
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [editing, setEditing] = useState<Payslip | null>(null);
  const [paying, setPaying] = useState(false);

  const period: Period = { ...periodById(periodId), status: statuses[periodId] ?? periodById(periodId).status };

  const slips = useMemo(() => slipsFor(periodId, overrides[periodId] ?? {}), [periodId, overrides]);

  const needle = q.trim().toLowerCase();
  const rows = slips.filter(
    (s) =>
      needle === "" ||
      [s.employee.name, s.employee.nickname, s.employee.code, s.employee.department].some((t) =>
        t.toLowerCase().includes(needle)
      )
  );
  const picked = openAt === null ? null : (rows[openAt] ?? null);

  const totals = {
    gross: slips.reduce((n, s) => n + s.gross, 0),
    deductions: slips.reduce((n, s) => n + s.deductions, 0),
    net: slips.reduce((n, s) => n + s.netPay, 0),
    tax: slips.reduce((n, s) => n + s.tax, 0),
    sso: slips.reduce((n, s) => n + s.sso, 0),
    pvd: slips.reduce((n, s) => n + s.pvd, 0),
  };

  const setVariable = (employeeId: number, patch: Partial<Variable>) =>
    setOverrides((all) => ({
      ...all,
      [periodId]: { ...(all[periodId] ?? {}), [employeeId]: { ...(all[periodId]?.[employeeId] ?? {}), ...patch } },
    }));

  const periodPicker = (
    <div className="flex items-center gap-2">
      <Select
        value={period.label}
        onChange={(label) => {
          setPeriodId(PERIODS.find((p) => p.label === label)!.id);
          setOpenAt(null);
        }}
        options={PERIODS.map((p) => p.label)}
      />
      <Badge tone={STATUS_TONE[period.status]} dot>
        {period.status}
      </Badge>
    </div>
  );

  const panels = (
    <>
      <DetailModal
        open={picked !== null}
        title="สลิปเงินเดือน"
        onClose={() => setOpenAt(null)}
        index={openAt ?? 0}
        total={rows.length}
        onStep={(d) => setOpenAt((i) => Math.min(rows.length - 1, Math.max(0, (i ?? 0) + d)))}
      >
        {picked && <Slip key={picked.employeeId} slip={picked} period={period} />}
      </DetailModal>

      <AttendanceForm
        slip={editing}
        onCancel={() => setEditing(null)}
        onSave={(id, patch) => {
          setVariable(id, patch);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={paying}
        title="ยืนยันการจ่ายเงินทั้งงวด"
        body={`ระบบจะบันทึกว่างวดนี้จ่ายแล้ว ยอดโอนรวม ${baht(totals.net)} ให้พนักงาน ${slips.length} คน`}
        subject={
          <span className="block">
            <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">{period.label}</span>
            <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">กำหนดจ่าย {period.payDate}</span>
          </span>
        }
        confirmWord="จ่ายเงิน"
        confirmLabel="ยืนยันการจ่าย"
        onCancel={() => setPaying(false)}
        onConfirm={() => {
          setStatuses((s) => ({ ...s, [periodId]: "จ่ายแล้ว" }));
          setPaying(false);
        }}
      />
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview
          period={period}
          slips={slips}
          totals={totals}
          onOpenSection={onOpenSection}
          onOpenSlip={(s) => {
            setQ("");
            setOpenAt(slips.indexOf(s));
          }}
          periodPicker={periodPicker}
        />
        {panels}
      </>
    );
  }

  return (
    <div>
      <PageHead
        title="เงินเดือน"
        meta={`${tab} · ${period.label} · ${slips.length} คน · จ่ายสุทธิ ${baht(totals.net)}`}
        right={periodPicker}
      />

      {tab === "คำนวณเงินเดือน" && (
        <Calculation rows={rows} totals={totals} q={q} setQ={setQ} onOpen={(s) => setOpenAt(rows.indexOf(s))} />
      )}

      {tab === "สวัสดิการ" && <Benefits slips={slips} />}

      {tab === "ขาดลามาสาย" && <Absences slips={slips} period={period} onEdit={setEditing} />}

      {tab === "ภาษีและประกันสังคม" && <Statutory slips={slips} totals={totals} />}

      {tab === "การจ่ายเงิน" && (
        <Payments slips={slips} period={period} total={totals.net} onPay={() => setPaying(true)} />
      )}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="คำนวณเงินเดือน" />
        <button data-fitt-screen="สลิปเงินเดือน" data-fitt-modal onClick={() => setOpenAt(0)} />
        <button data-fitt-screen="แก้ขาดลามาสาย" data-fitt-modal onClick={() => setEditing(slips[0])} />
        <button data-fitt-screen="ยืนยันการจ่ายเงิน" data-fitt-modal onClick={() => setPaying(true)} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- overview */

function Overview({
  period,
  slips,
  totals,
  onOpenSection,
  onOpenSlip,
  periodPicker,
}: {
  period: Period;
  slips: Payslip[];
  totals: { gross: number; deductions: number; net: number; tax: number; sso: number; pvd: number };
  onOpenSection?: (index: number) => void;
  onOpenSlip: (s: Payslip) => void;
  periodPicker: ReactNode;
}) {
  const base = slips.reduce((n, s) => n + s.base, 0);
  const benefits = slips.reduce((n, s) => n + s.benefitTotal, 0);
  const ot = slips.reduce((n, s) => n + s.otPay, 0);
  const top = Math.max(...slips.map((s) => s.netPay));

  const composition = [
    { label: "เงินเดือนฐาน", value: base, swatch: swatchFor("เงินเดือนฐาน", EARNING_KINDS) },
    { label: "สวัสดิการ", value: benefits, swatch: swatchFor("สวัสดิการ", EARNING_KINDS) },
    { label: "ล่วงเวลา", value: ot, swatch: swatchFor("ล่วงเวลา", EARNING_KINDS) },
  ].filter((s) => s.value > 0);

  const at = PERIOD_FLOW.indexOf(period.status);
  const flow: { label: string; state: StepState }[] = PERIOD_FLOW.map((s, i) => ({
    label: s,
    state: i < at ? "done" : i === at ? "current" : "todo",
  }));

  const attention = slips.filter(
    (s) => s.absentDays + s.unpaidDays > 0 || s.lateMinutes > 0 || s.benefitLines.some((b) => b.forfeited)
  );

  const history = [...PERIODS].reverse().map((p) => ({
    label: p.month.slice(5) + "/" + p.month.slice(2, 4),
    value: Math.round(periodCost(p.id).total),
    tone: p.id === period.id ? ("accent" as const) : undefined,
  }));

  const seeAll = (index: number) =>
    onOpenSection ? (
      <button
        onClick={() => onOpenSection(index)}
        className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] text-slate-600 transition hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:text-slate-300"
      >
        ดูทั้งหมด <ArrowRight size={12} />
      </button>
    ) : undefined;

  return (
    <div>
      <PageHead
        title="ภาพรวมเงินเดือน"
        meta={`${period.label} · จ่ายวันที่ ${period.payDate} · ข้อมูล ณ ${TODAY}`}
        right={periodPicker}
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><Wallet size={15} className="text-slate-400" />ยอดจ่ายงวดนี้</span>}
            action={seeAll(0)}
          >
            <div className="p-4">
              <p className="text-[32px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                {baht(totals.net)}
              </p>
              <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                จ่ายให้พนักงาน {slips.length} คน · รายได้รวม {baht(totals.gross)} หักรวม {baht(totals.deductions)}
              </p>

              <div className="mt-4 space-y-2.5">
                {[
                  { label: "เงินเดือนฐาน", value: base, tone: "accent" as const },
                  { label: "สวัสดิการ", value: benefits, tone: "info" as const },
                  { label: "ล่วงเวลา", value: ot, tone: "ok" as const },
                  { label: "รายการหัก", value: -totals.deductions, tone: "bad" as const },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[12.5px] text-slate-600 dark:text-slate-300">{r.label}</span>
                    <span className="min-w-0 flex-1">
                      <Bar pct={(Math.abs(r.value) / totals.gross) * 100} tone={r.tone} width="w-full" />
                    </span>
                    <span className="w-28 shrink-0 text-right text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">
                      {baht(r.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />สถานะงวด</span>}
            action={seeAll(4)}
          >
            <div className="space-y-4 p-4">
              <Stepper steps={flow} icons={FLOW_ICONS} />
              <div className="space-y-1">
                <IconRow icon={<CalendarClock size={14} />} label="กำหนดจ่าย">{period.payDate}</IconRow>
                <IconRow icon={<Clock3 size={14} />} label="วันทำงานในงวด">{period.workDays} วัน</IconRow>
                <IconRow icon={<Landmark size={14} />} label="นำส่งประกันสังคม">{baht(totals.sso * 2)}</IconRow>
                <IconRow icon={<Receipt size={14} />} label="ภาษีหัก ณ ที่จ่าย">{baht(totals.tax)}</IconRow>
              </div>
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            title={<span className="flex items-center gap-2"><Coins size={15} className="text-slate-400" />โครงสร้างรายได้</span>}
            action={seeAll(1)}
          >
            <div className="p-4">
              <Donut
                segments={composition}
                size={128}
                format={(n) => baht(n)}
                center={
                  <span>
                    <span className="block text-[22px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {Math.round((benefits / totals.gross) * 100)}%
                    </span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">สวัสดิการ</span>
                  </span>
                }
              />
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><TrendingUp size={15} className="text-slate-400" />ต้นทุนแรงงานย้อนหลัง</span>}
            subtitle="รวมส่วนที่นายจ้างสมทบประกันสังคมและกองทุนสำรองเลี้ยงชีพ"
          >
            <ColumnChart data={history} format={(n) => baht(n)} height={170} />
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><TriangleAlert size={15} className="text-slate-400" />รายการที่ต้องดูก่อนอนุมัติ</span>}
            action={seeAll(2)}
          >
            {attention.length === 0 ? (
              <p className="py-14 text-center text-[12.5px] text-slate-400">ไม่มีรายการขาด ลา หรือมาสายในงวดนี้</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {attention.map((s) => (
                  <li key={s.employeeId} className="flex items-start gap-3 px-4 py-2.5">
                    <Avatar name={s.employee.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => onOpenSlip(s)}
                        className="block truncate text-left text-[13px] text-slate-900 hover:text-violet-700 dark:text-slate-50"
                      >
                        {s.employee.name}
                      </button>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.absentDays > 0 && <Badge tone="bad">ขาด {s.absentDays} วัน</Badge>}
                        {s.unpaidDays > 0 && <Badge tone="warn">ลาไม่รับค่าจ้าง {s.unpaidDays} วัน</Badge>}
                        {s.lateMinutes > 0 && <Badge tone="warn">สาย {s.lateMinutes} นาที</Badge>}
                        {s.benefitLines.some((b) => b.forfeited) && <Badge tone="idle">ตัดเบี้ยขยัน</Badge>}
                      </div>
                    </div>
                    <span className="shrink-0 text-[11.5px] tabular-nums text-rose-600 dark:text-rose-400">
                      −{baht(s.absenceCut + s.lateCut)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.16} className="mt-3">
        <Card
          title={<span className="flex items-center gap-2"><HandCoins size={15} className="text-slate-400" />เงินเดือนสุทธิรายคน</span>}
          action={seeAll(0)}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...slips]
              .sort((a, b) => b.netPay - a.netPay)
              .map((s) => (
                <li key={s.employeeId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <Avatar name={s.employee.name} size="sm" />
                  <button onClick={() => onOpenSlip(s)} className="w-44 shrink-0 text-left">
                    <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{s.employee.name}</span>
                    <span className="block truncate text-[11.5px] text-slate-400">
                      {s.employee.position} · {s.employee.department}
                    </span>
                  </button>
                  <span className="hidden min-w-0 flex-1 sm:block">
                    <Bar pct={(s.netPay / top) * 100} tone="accent" width="w-full" />
                  </span>
                  <span className="w-28 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                    {baht(s.netPay)}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------ calculation */

function Calculation({
  rows,
  totals,
  q,
  setQ,
  onOpen,
}: {
  rows: Payslip[];
  totals: { gross: number; deductions: number; net: number };
  q: string;
  setQ: (v: string) => void;
  onOpen: (s: Payslip) => void;
}) {
  const columns: Column<Payslip>[] = [
    {
      key: "name",
      header: "พนักงาน",
      width: "26%",
      sort: (a, b) => a.employee.name.localeCompare(b.employee.name, "th"),
      cell: (s) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={s.employee.name} size="sm" />
          <span>
            <span className="block font-medium text-slate-900 dark:text-slate-50">{s.employee.name}</span>
            <span className="block text-[11px] text-slate-400">{s.employee.position}</span>
          </span>
        </span>
      ),
    },
    {
      key: "base",
      header: "เงินเดือนฐาน",
      align: "right",
      width: "14%",
      sort: (a, b) => a.base - b.base,
      cell: (s) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{baht(s.base)}</span>,
    },
    {
      key: "benefit",
      header: "สวัสดิการ",
      align: "right",
      width: "13%",
      sort: (a, b) => a.benefitTotal - b.benefitTotal,
      cell: (s) => (
        <span className="tabular-nums text-slate-700 dark:text-slate-200">{s.benefitTotal ? baht(s.benefitTotal) : "—"}</span>
      ),
    },
    {
      key: "ot",
      header: "ล่วงเวลา",
      align: "right",
      width: "13%",
      sort: (a, b) => a.otPay - b.otPay,
      cell: (s) => (
        <span className="tabular-nums text-slate-700 dark:text-slate-200">
          {s.otPay ? baht(s.otPay) : "—"}
          {s.otHours > 0 && <span className="ml-1 text-[11px] text-slate-400">{s.otHours} ชม.</span>}
        </span>
      ),
    },
    {
      key: "cut",
      header: "รายการหัก",
      align: "right",
      width: "13%",
      sort: (a, b) => a.deductions - b.deductions,
      cell: (s) => <span className="tabular-nums text-rose-600 dark:text-rose-400">−{baht(s.deductions)}</span>,
    },
    {
      key: "net",
      header: "จ่ายสุทธิ",
      align: "right",
      width: "15%",
      sort: (a, b) => a.netPay - b.netPay,
      cell: (s) => <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(s.netPay)}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <StatStrip
        title="ยอดรวมทั้งงวด"
        icon={<Calculator size={15} />}
        cells={[
          { icon: <Coins size={13} />, label: "รายได้รวม", value: baht(totals.gross), sub: "เงินเดือนฐาน สวัสดิการ และล่วงเวลา" },
          { icon: <Scale size={13} />, label: "รายการหักรวม", value: baht(totals.deductions), sub: "ขาดลามาสาย ประกันสังคม กองทุน และภาษี", tone: "bad" },
          { icon: <Wallet size={13} />, label: "จ่ายสุทธิ", value: baht(totals.net), sub: "ยอดที่โอนเข้าบัญชีพนักงาน", tone: "ok" },
          { icon: <Percent size={13} />, label: "สัดส่วนที่ถูกหัก", value: Math.round((totals.deductions / totals.gross) * 100) + "%", sub: "ของรายได้รวมทั้งงวด", tone: "accent" },
        ]}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getId={(s) => s.employeeId}
        onOpen={onOpen}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Search value={q} onChange={setQ} placeholder="ค้นหาชื่อ รหัส หรือแผนก" icon={<SearchIcon size={14} />} />
            <span className="ml-auto text-[12px] text-slate-400">กดที่แถวเพื่อเปิดสลิปเต็มใบ</span>
          </div>
        }
      />
    </div>
  );
}

/* -------------------------------------------------------------- benefits */

function Benefits({ slips }: { slips: Payslip[] }) {
  const [only, setOnly] = useState("ทั้งหมด");
  const plans = BENEFIT_PLANS.filter((p) => (only === "ทั้งหมด" ? true : only === "คิดภาษี" ? p.taxable : !p.taxable));
  const paidFor = (code: string) => slips.filter((s) => s.benefitLines.some((b) => b.code === code && b.amount > 0));
  const totalFor = (code: string) =>
    slips.reduce((n, s) => n + (s.benefitLines.find((b) => b.code === code)?.amount ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          options={["ทั้งหมด", "คิดภาษี", "ยกเว้นภาษี"]}
          value={only}
          onChange={setOnly}
          counts={{
            ทั้งหมด: BENEFIT_PLANS.length,
            คิดภาษี: BENEFIT_PLANS.filter((p) => p.taxable).length,
            ยกเว้นภาษี: BENEFIT_PLANS.filter((p) => !p.taxable).length,
          }}
        />
        <span className="ml-auto text-[12px] text-slate-400">
          สวัสดิการที่คิดภาษีจะถูกรวมเข้าฐานคำนวณภาษีหัก ณ ที่จ่าย
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const sw = planSwatch(p.code);
          const who = paidFor(p.code);
          return (
            <TintCard key={p.code} swatch={sw}>
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <Gift size={14} />
                  {p.name}
                </span>
                <Tag swatch={sw}>{p.taxable ? "คิดภาษี" : "ยกเว้น"}</Tag>
              </div>
              <p className="mt-2 text-[18px] font-semibold tabular-nums">{baht(totalFor(p.code))}</p>
              <p className="mt-1 text-[11.5px] opacity-75">
                {who.length > 0 ? `จ่ายให้ ${who.length} คน` : "ไม่มีคนได้รับในงวดนี้"} · {p.note}
              </p>
            </TintCard>
          );
        })}
      </div>

      <Card
        title={<span className="flex items-center gap-2"><Gift size={15} className="text-slate-400" />สวัสดิการรายคน</span>}
        subtitle="รายการที่ขีดฆ่าคือสวัสดิการที่ถูกตัดตามเงื่อนไขของงวดนี้"
      >
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {slips.map((s) => (
            <li key={s.employeeId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={s.employee.name} size="sm" />
              <span className="w-40 shrink-0">
                <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{s.employee.name}</span>
                <span className="block truncate text-[11px] text-slate-400">{s.employee.department}</span>
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {s.benefitLines.length === 0 ? (
                  <span className="text-[12px] text-slate-400">ไม่มีสวัสดิการเป็นตัวเงิน</span>
                ) : (
                  s.benefitLines.map((b) => (
                    <span
                      key={b.code}
                      className={
                        "rounded-full px-2.5 py-1 text-[11.5px] " +
                        (b.forfeited ? "bg-slate-100 text-slate-400 line-through dark:bg-slate-800" : planSwatch(b.code).tint)
                      }
                    >
                      {b.name} {baht(b.full)}
                    </span>
                  ))
                )}
              </span>
              <span className="w-28 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {baht(s.benefitTotal)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- absences */

function Absences({ slips, period, onEdit }: { slips: Payslip[]; period: Period; onEdit: (s: Payslip) => void }) {
  const cut = slips.reduce((n, s) => n + s.absenceCut + s.lateCut, 0);
  const affected = slips.filter((s) => s.absentDays + s.unpaidDays > 0 || s.lateMinutes > 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title={`ขาด ลา มาสาย · ${period.label}`}
        icon={<Clock3 size={15} />}
        cells={[
          {
            icon: <TriangleAlert size={13} />,
            label: "คนที่มีรายการ",
            value: affected.length + " คน",
            sub: `จากทั้งหมด ${slips.length} คนในงวด`,
            tone: affected.length > 0 ? "warn" : "ok",
          },
          {
            icon: <Clock3 size={13} />,
            label: "วันขาดและลาไม่รับค่าจ้าง",
            value: slips.reduce((n, s) => n + s.absentDays + s.unpaidDays, 0) + " วัน",
            sub: "หักตามฐานเงินเดือนต่อวัน",
            tone: "bad",
          },
          {
            icon: <CalendarClock size={13} />,
            label: "นาทีที่มาสาย",
            value: slips.reduce((n, s) => n + s.lateMinutes, 0) + " นาที",
            sub: "หักตามฐานเงินเดือนต่อชั่วโมง",
            tone: "warn",
          },
          {
            icon: <Scale size={13} />,
            label: "ยอดหักรวม",
            value: baht(cut),
            sub: `คิดจากวันทำงาน ${period.workDays} วันในงวดนี้`,
            tone: "accent",
          },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Clock3 size={15} className="text-slate-400" />รายการหักตามการเข้างาน</span>}
        subtitle="กดแก้ไขเพื่อปรับตัวเลขของงวดนี้ ยอดหักและเงินเดือนสุทธิจะคำนวณใหม่ทันที"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-[13px]">
            <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">พนักงาน</th>
                <th className="px-4 py-3 text-right font-medium">ฐานต่อวัน</th>
                <th className="px-4 py-3 text-right font-medium">ขาดงาน</th>
                <th className="px-4 py-3 text-right font-medium">ลาไม่รับค่าจ้าง</th>
                <th className="px-4 py-3 text-right font-medium">มาสาย</th>
                <th className="px-4 py-3 text-right font-medium">ยอดหัก</th>
                <th className="px-4 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {slips.map((s) => (
                <tr key={s.employeeId} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={s.employee.name} size="sm" />
                      <span className="font-medium text-slate-900 dark:text-slate-50">{s.employee.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {baht(Math.round(s.perDay))}
                  </td>
                  <td className={"px-4 py-2.5 text-right tabular-nums " + (s.absentDays ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-300 dark:text-slate-600")}>
                    {s.absentDays || "—"}
                  </td>
                  <td className={"px-4 py-2.5 text-right tabular-nums " + (s.unpaidDays ? "text-amber-700 dark:text-amber-400" : "text-slate-300 dark:text-slate-600")}>
                    {s.unpaidDays || "—"}
                  </td>
                  <td className={"px-4 py-2.5 text-right tabular-nums " + (s.lateMinutes ? "text-amber-700 dark:text-amber-400" : "text-slate-300 dark:text-slate-600")}>
                    {s.lateMinutes ? s.lateMinutes + " น." : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                    {s.absenceCut + s.lateCut ? "−" + baht(s.absenceCut + s.lateCut) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => onEdit(s)}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11.5px] text-slate-700 transition hover:border-violet-400 hover:text-violet-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      แก้ไข
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Note tone="idle">
        ยอดหักคิดจากฐานเงินเดือนหารด้วยวันทำงานในงวด วันขาดและลาไม่รับค่าจ้างหักเป็นรายวัน
        ส่วนการมาสายหักตามสัดส่วนของชั่วโมง เบี้ยขยันถูกตัดทั้งก้อนเมื่อมีวันขาดในงวด
      </Note>
    </div>
  );
}

/* -------------------------------------------------------------- statutory */

function Statutory({ slips, totals }: { slips: Payslip[]; totals: { tax: number; sso: number; pvd: number } }) {
  const [showing, setShowing] = useState<Payslip | null>(null);

  return (
    <div className="space-y-3">
      <StatStrip
        title="ยอดนำส่งหน่วยงานรัฐและกองทุน"
        icon={<ShieldCheck size={15} />}
        cells={[
          { icon: <Landmark size={13} />, label: "ประกันสังคมฝั่งลูกจ้าง", value: baht(totals.sso), sub: `${SSO_RATE * 100}% ของฐานเงินเดือน สูงสุด ${SSO_CAP} บาท` },
          { icon: <Landmark size={13} />, label: "สมทบฝั่งนายจ้าง", value: baht(totals.sso), sub: "บริษัทสมทบเท่ากับที่หักจากลูกจ้าง", tone: "info" },
          { icon: <PiggyBank size={13} />, label: "กองทุนสำรองเลี้ยงชีพ", value: baht(totals.pvd), sub: "อัตราตามที่ตกลงไว้รายคนในแฟ้มพนักงาน", tone: "accent" },
          { icon: <Receipt size={13} />, label: "ภาษีหัก ณ ที่จ่าย", value: baht(totals.tax), sub: "คำนวณจากขั้นภาษีแล้วเฉลี่ยรายเดือน", tone: "warn" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title={<span className="flex items-center gap-2"><Receipt size={15} className="text-slate-400" />รายการนำส่งรายคน</span>}
          subtitle="กดที่แถวเพื่อดูว่าภาษีของคนนั้นคำนวณมาอย่างไร"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-[13px]">
              <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">พนักงาน</th>
                  <th className="px-4 py-3 text-right font-medium">ฐานคำนวณ</th>
                  <th className="px-4 py-3 text-right font-medium">ประกันสังคม</th>
                  <th className="px-4 py-3 text-right font-medium">กองทุนสำรองฯ</th>
                  <th className="px-4 py-3 text-right font-medium">ภาษี</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {slips.map((s) => (
                  <tr
                    key={s.employeeId}
                    onClick={() => setShowing(s)}
                    className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={s.employee.name} size="sm" />
                        <span className="font-medium text-slate-900 dark:text-slate-50">{s.employee.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{baht(s.taxableMonth)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{baht(s.sso)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                      {s.pvd ? baht(s.pvd) : "—"}
                      {s.pvdRate > 0 && <span className="ml-1 text-[11px] text-slate-400">{Math.round(s.pvdRate * 100)}%</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-50">{s.tax ? baht(s.tax) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title={<span className="flex items-center gap-2"><Percent size={15} className="text-slate-400" />ขั้นภาษีเงินได้บุคคลธรรมดา</span>}
          subtitle="คิดจากเงินได้สุทธิต่อปี หลังหักค่าใช้จ่ายและค่าลดหย่อน"
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {TAX_BANDS.map((b, i) => {
              const from = i === 0 ? 0 : TAX_BANDS[i - 1].upTo;
              return (
                <li key={i} className="flex items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate text-[12.5px] tabular-nums text-slate-600 dark:text-slate-300">
                    {from.toLocaleString("th-TH")} – {b.upTo === Infinity ? "ขึ้นไป" : b.upTo.toLocaleString("th-TH")}
                  </span>
                  <Badge tone={b.rate === 0 ? "idle" : b.rate <= 0.1 ? "ok" : b.rate <= 0.2 ? "warn" : "bad"}>
                    {Math.round(b.rate * 100)}%
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <FormModal
        open={showing !== null}
        title="ที่มาของภาษีหัก ณ ที่จ่าย"
        subtitle={showing ? showing.employee.name : undefined}
        onClose={() => setShowing(null)}
      >
        {showing && <TaxBreakdown slip={showing} />}
      </FormModal>
    </div>
  );
}

function TaxBreakdown({ slip }: { slip: Payslip }) {
  const year = slip.taxableMonth * 12;
  const { expense, net } = annualTax(year);
  const rows = [
    { label: "เงินได้ที่ต้องเสียภาษีทั้งปี", value: year, note: "ฐานคำนวณรายเดือนคูณสิบสอง" },
    { label: "หักค่าใช้จ่าย", value: -expense, note: "50% ของเงินได้ แต่ไม่เกิน 100,000 บาท" },
    { label: "หักค่าลดหย่อนส่วนตัว", value: -60000, note: "อัตราเดียวสำหรับผู้มีเงินได้ทุกคน" },
    { label: "หักประกันสังคมทั้งปี", value: -SSO_CAP * 12, note: `${SSO_CAP} บาทต่อเดือน` },
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
        ภาษีทั้งปี {baht(slip.tax * 12)} เฉลี่ยเป็นรายเดือน {baht(slip.tax)} ซึ่งเป็นยอดที่หักในสลิปงวดนี้
      </Note>

      <div className="space-y-1.5">
        {TAX_BANDS.map((b, i) => {
          const from = i === 0 ? 0 : TAX_BANDS[i - 1].upTo;
          const inBand = Math.max(0, Math.min(net, b.upTo) - from);
          if (inBand === 0) return null;
          return (
            <div key={i} className="flex items-center gap-3 text-[12.5px]">
              <span className="w-32 shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                {from.toLocaleString("th-TH")}+
              </span>
              <span className="min-w-0 flex-1">
                <Bar pct={(inBand / net) * 100} tone={b.rate === 0 ? "idle" : "accent"} width="w-full" />
              </span>
              <span className="w-12 shrink-0 text-right tabular-nums text-slate-600 dark:text-slate-300">
                {Math.round(b.rate * 100)}%
              </span>
              <span className="w-24 shrink-0 text-right tabular-nums text-slate-900 dark:text-slate-50">
                {baht(inBand * b.rate)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- payments */

function Payments({
  slips,
  period,
  total,
  onPay,
}: {
  slips: Payslip[];
  period: Period;
  total: number;
  onPay: () => void;
}) {
  const methods = [...new Set(Object.values(BANKS).map((b) => b.method))];
  const paid = period.status === "จ่ายแล้ว";

  return (
    <div className="space-y-3">
      <Card
        title={<span className="flex items-center gap-2"><Banknote size={15} className="text-slate-400" />สรุปการจ่ายเงิน</span>}
        subtitle={`${period.label} · กำหนดจ่าย ${period.payDate}`}
        action={<Badge tone={STATUS_TONE[period.status]} dot>{period.status}</Badge>}
      >
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[30px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">{baht(total)}</p>
            <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
              โอนเข้าบัญชี {slips.filter((s) => BANKS[s.employeeId].method === "โอนเข้าบัญชี").length} คน · จ่ายเป็นเงินสด{" "}
              {slips.filter((s) => BANKS[s.employeeId].method === "เงินสด").length} คน
            </p>
          </div>
          {paid ? (
            <Badge tone="ok" icon={<CircleCheck size={13} />}>จ่ายเรียบร้อยเมื่อ {period.payDate}</Badge>
          ) : (
            <Button variant="primary" icon={<HandCoins size={15} />} onClick={onPay}>
              ยืนยันการจ่ายเงินทั้งงวด
            </Button>
          )}
        </div>
      </Card>

      {methods.map((method) => {
        const list = slips.filter((s) => BANKS[s.employeeId].method === method);
        if (list.length === 0) return null;
        return (
          <Card
            key={method}
            title={
              <span className="flex items-center gap-2">
                {method === "เงินสด" ? <Banknote size={15} className="text-slate-400" /> : <CreditCard size={15} className="text-slate-400" />}
                {method}
              </span>
            }
            subtitle={method === "เงินสด" ? "ต้องเตรียมเงินสดและให้ผู้รับเซ็นรับในวันจ่าย" : "ส่งไฟล์โอนเงินให้ธนาคารล่วงหน้าหนึ่งวันทำการ"}
            action={<Chip>{baht(list.reduce((n, s) => n + s.netPay, 0))}</Chip>}
          >
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {list.map((s) => {
                const bank = BANKS[s.employeeId];
                return (
                  <li key={s.employeeId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <Avatar name={s.employee.name} size="sm" />
                    <span className="w-44 shrink-0">
                      <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{s.employee.name}</span>
                      <span className="block truncate font-mono text-[11px] text-slate-400">{s.employee.code}</span>
                    </span>
                    <span className="min-w-0 flex-1 text-[12.5px] text-slate-500 dark:text-slate-400">
                      {bank.bank === "—" ? "รับที่ฝ่ายบัญชี" : `${bank.bank} · ${bank.account}`}
                    </span>
                    <Badge tone={paid ? "ok" : "idle"} dot>
                      {paid ? "จ่ายแล้ว" : "รอจ่าย"}
                    </Badge>
                    <span className="w-28 shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                      {baht(s.netPay)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- record */

function Slip({ slip, period }: { slip: Payslip; period: Period }) {
  const [tab, setTab] = useState(SLIP_TABS[0]);
  const bank = BANKS[slip.employeeId];

  return (
    <div>
      <div className="flex flex-wrap items-start gap-4 border-b border-slate-100 px-5 pb-5 dark:border-slate-800">
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
            <Line label="เงินเดือนฐาน" note={`${baht(Math.round(slip.perDay))} ต่อวัน · ${period.workDays} วันทำงาน`} value={slip.base} />
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
            {slip.otPay > 0 && (
              <Line label="ค่าล่วงเวลา" note={`${slip.otHours} ชั่วโมง × ${baht(Math.round(slip.perHour))} × 1.5`} value={slip.otPay} />
            )}
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
            <Line label="ประกันสังคม" note={`${SSO_RATE * 100}% ของฐานเงินเดือน สูงสุด ${SSO_CAP} บาท`} value={-slip.sso} />
            {slip.pvd > 0 && (
              <Line label="กองทุนสำรองเลี้ยงชีพ" note={`${Math.round(slip.pvdRate * 100)}% ตามที่ตกลงไว้ในแฟ้มพนักงาน`} value={-slip.pvd} />
            )}
            <Line label="ภาษีหัก ณ ที่จ่าย" note="คำนวณจากขั้นภาษีทั้งปีแล้วเฉลี่ยรายเดือน" value={-slip.tax} />
            <Line label="รวมรายการหัก" value={-slip.deductions} strong />
          </ul>
        )}

        {tab === "ที่มาของภาษี" && <TaxBreakdown slip={slip} />}

        {tab === "การจ่ายเงิน" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <IconRow icon={<CreditCard size={14} />} label="วิธีจ่าย">{bank.method}</IconRow>
              <IconRow icon={<Landmark size={14} />} label="ธนาคาร">{bank.bank === "—" ? "รับที่ฝ่ายบัญชี" : bank.bank}</IconRow>
              <IconRow icon={<Wallet size={14} />} label="เลขบัญชี">{bank.account}</IconRow>
              <IconRow icon={<CalendarClock size={14} />} label="กำหนดจ่าย">{period.payDate}</IconRow>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">สัดส่วนที่ถูกหักจากรายได้</p>
              <Progress done={slip.deductions} total={slip.gross} label={`หัก ${baht(slip.deductions)} จากรายได้ ${baht(slip.gross)}`} />
            </div>
            <Note tone={period.status === "จ่ายแล้ว" ? "ok" : "idle"}>
              {period.status === "จ่ายแล้ว"
                ? `โอนแล้วเมื่อ ${period.payDate} ยอดสุทธิ ${baht(slip.netPay)}`
                : `งวดนี้อยู่ในสถานะ ${period.status} ยอดจะถูกโอนในวันที่ ${period.payDate}`}
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

/* ------------------------------------------------------------------ form */

function AttendanceForm({
  slip,
  onCancel,
  onSave,
}: {
  slip: Payslip | null;
  onCancel: () => void;
  onSave: (employeeId: number, patch: Partial<Variable>) => void;
}) {
  const [absent, setAbsent] = useState("");
  const [unpaid, setUnpaid] = useState("");
  const [late, setLate] = useState("");
  const [ot, setOt] = useState("");
  const [error, setError] = useState<string>();

  const num = (v: string, fallback: number) => (v.trim() === "" ? fallback : Number(v));

  return (
    <FormModal
      open={slip !== null}
      title="แก้ขาดลามาสาย"
      subtitle={slip ? `${slip.employee.name} · ฐานต่อวัน ${baht(Math.round(slip.perDay))}` : undefined}
      onClose={onCancel}
      size="sm"
    >
      {slip && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="วันขาดงาน" error={error} hint={`เดิม ${slip.absentDays} วัน`}>
              <input value={absent} onChange={(e) => setAbsent(e.target.value)} placeholder={String(slip.absentDays)} className={FIELD + " w-full tabular-nums"} />
            </Field>
            <Field label="ลาไม่รับค่าจ้าง" hint={`เดิม ${slip.unpaidDays} วัน`}>
              <input value={unpaid} onChange={(e) => setUnpaid(e.target.value)} placeholder={String(slip.unpaidDays)} className={FIELD + " w-full tabular-nums"} />
            </Field>
            <Field label="นาทีที่มาสาย" hint={`เดิม ${slip.lateMinutes} นาที`}>
              <input value={late} onChange={(e) => setLate(e.target.value)} placeholder={String(slip.lateMinutes)} className={FIELD + " w-full tabular-nums"} />
            </Field>
            <Field label="ชั่วโมงล่วงเวลา" hint={`เดิม ${slip.otHours} ชั่วโมง`}>
              <input value={ot} onChange={(e) => setOt(e.target.value)} placeholder={String(slip.otHours)} className={FIELD + " w-full tabular-nums"} />
            </Field>
          </div>

          <Note tone="idle">
            ยอดหักคำนวณใหม่ทันทีที่บันทึก ฐานเงินเดือนและอัตรากองทุนอ่านจากทะเบียนพนักงาน
            การแก้ที่นี่ไม่กระทบแฟ้มพนักงาน
          </Note>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onCancel}>
              ยกเลิก
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const patch = {
                  absentDays: num(absent, slip.absentDays),
                  unpaidDays: num(unpaid, slip.unpaidDays),
                  lateMinutes: num(late, slip.lateMinutes),
                  otHours: num(ot, slip.otHours),
                };
                if (Object.values(patch).some((n) => !Number.isFinite(n) || n < 0)) {
                  setError("กรอกเป็นตัวเลขไม่ติดลบ");
                  return;
                }
                setError(undefined);
                onSave(slip.employeeId, patch);
                setAbsent("");
                setUnpaid("");
                setLate("");
                setOt("");
              }}
            >
              บันทึกและคำนวณใหม่
            </Button>
          </div>
        </div>
      )}
    </FormModal>
  );
}

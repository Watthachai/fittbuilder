import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, Banknote, Calculator, CalendarClock, CalendarPlus, Circle, CircleCheck, CircleDot, CircleX, Clock3,
  Coins, CreditCard, FileSpreadsheet, Gift, HandCoins, Landmark, Lock, LockOpen, Pencil, Percent, PiggyBank, Plus,
  Printer, Receipt, RefreshCw, Scale, Search as SearchIcon, ShieldCheck, Trash2, TrendingUp, TriangleAlert, Wallet,
} from "lucide-react";
import {
  ADJUSTMENTS, BENEFIT_PLANS, CLAIMS, PERIODS, PERIOD_FLOW, SSO_CAP, SSO_RATE, TAX_BANDS, TODAY, adjustmentKindOf,
  approvalBlockers, approveClaim, approvePeriod, baht, bankFile, bankOf, cert50, empName, isLocked, latestPeriod,
  markPaid, missingFrom, periodById, periodCost, pnd1, rejectClaim, removeAdjustment, reopenPeriod, runPayroll,
  slipsFor, sso110,
} from "./data";
import type { Adjustment, Claim, Payslip, Period } from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, IconRow, Note, PageHead, Reveal, Search, Segmented,
  Select, StatStrip, Stepper, Tag, TintCard, swatchFor,
} from "../ui";
import type { StepState } from "../ui";
import { ConfirmDialog, DataTable, DetailModal, FormModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";
import { AdjustmentForm, AttendanceForm, BenefitForm, ClaimForm, PeriodForm } from "./forms";
import { Slip, TaxBreakdown } from "./records";
import { BankPaper, Cert50Paper, PayslipBatch, PayslipPaper, Pnd1Paper, Sso110Paper } from "./documents";
import { CLAIM_TONE, MiniButton, PrintModal, ReasonDialog, STATUS_TONE, Who, attempt, planSwatch } from "./shared";

const TABS = ["คำนวณเงินเดือน", "สวัสดิการ", "ขาดลามาสาย", "ภาษีและประกันสังคม", "การจ่ายเงิน"];

const EARNING_KINDS = ["เงินเดือนฐาน", "สวัสดิการ", "ล่วงเวลา"];

const FLOW_ICONS = {
  done: <CircleCheck size={14} />,
  current: <CircleDot size={14} />,
  todo: <Circle size={14} />,
  failed: <CircleX size={14} />,
};

type Totals = { gross: number; deductions: number; net: number; tax: number; sso: number; pvd: number };

/** What is on its way to the printer. */
type Printing =
  | { kind: "slip"; slip: Payslip }
  | { kind: "slips" }
  | { kind: "pnd1" }
  | { kind: "sso" }
  | { kind: "cert"; employeeId: number }
  | { kind: "bank" };

/* --------------------------------------------------------------- export */

function exportRegister(period: Period, slips: Payslip[]) {
  downloadCsv(
    `ทะเบียนเงินเดือน-${period.month}`,
    ["รหัส", "พนักงาน", "แผนก", "เงินเดือนฐาน", "สวัสดิการ", "ล่วงเวลา", "เงินได้อื่น", "รายได้รวม", "ขาดลามาสาย", "ประกันสังคม", "กองทุนสำรองฯ", "ภาษี", "เงินหักอื่น", "รายการหักรวม", "จ่ายสุทธิ"],
    slips.map((s) => [
      s.employee.code, s.employee.name, s.employee.department, s.base, s.benefitTotal, s.otPay, s.extraEarnings + s.claimTotal,
      s.gross, s.absenceCut + s.lateCut, s.sso, s.pvd, s.tax, s.extraDeductions, s.deductions, s.netPay,
    ])
  );
  notify(`ส่งออกทะเบียนเงินเดือน${period.label} ${slips.length} คนแล้ว`);
}

function exportBank(periodId: number) {
  attempt(
    () => {
      const f = bankFile(periodId);
      downloadCsv(
        `ไฟล์โอนเงินเดือน-${f.period.month}`,
        ["ลำดับ", "รหัสพนักงาน", "ชื่อบัญชี", "ธนาคาร", "เลขบัญชี", "จำนวนเงิน", "วันที่โอน"],
        [...f.rows.map((r) => [r.seq, r.code, r.name, r.bank, r.account, r.amount.toFixed(2), f.period.payDate]), ["", "", "รวม", "", "", f.total.toFixed(2), ""]]
      );
      return f;
    },
    (f) => `สร้างไฟล์โอนเงิน ${f.count} รายการ ยอดรวม ${baht(f.total)} แล้ว ส่งให้ธนาคารได้เลย`
  );
}

function exportPnd1(periodId: number) {
  const r = pnd1(periodId);
  downloadCsv(
    `ภงด1-${r.period.month}`,
    ["ลำดับ", "เลขประจำตัวผู้เสียภาษี", "ชื่อผู้มีเงินได้", "วันที่จ่าย", "จำนวนเงินที่จ่าย", "ภาษีที่หัก", "เงื่อนไข"],
    r.rows.map((x) => [x.seq, x.taxId, x.name, r.period.payDate, x.income.toFixed(2), x.tax.toFixed(2), 1])
  );
  notify(`ส่งออกใบแนบ ภ.ง.ด.1 ${r.rows.length} ราย ภาษีรวม ${baht(r.tax)} แล้ว`);
}

function exportSso(periodId: number) {
  const r = sso110(periodId);
  downloadCsv(
    `สปส1-10-${r.period.month}`,
    ["ลำดับ", "เลขประจำตัวประชาชน", "ชื่อ-นามสกุล", "ค่าจ้าง", "เงินสมทบ"],
    r.rows.map((x) => [x.seq, x.idCard, x.name, x.wage.toFixed(2), x.contribution.toFixed(2)])
  );
  notify(`ส่งออก สปส.1-10 ${r.rows.length} คน นำส่งรวม ${baht(r.total)} แล้ว`);
}

/* ----------------------------------------------------------------- screen */

export default function PyScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  const tab = section && TABS.includes(section) ? section : undefined;
  const version = useData();

  const [periodId, setPeriodId] = useState(PERIODS[0].id);
  const [q, setQ] = useState("");
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [editing, setEditing] = useState<Payslip | null>(null);
  const [paying, setPaying] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [newPeriod, setNewPeriod] = useState(false);
  const [adjusting, setAdjusting] = useState<{ employeeId?: number; item?: Adjustment } | null>(null);
  const [removing, setRemoving] = useState<Adjustment | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [rejectingClaim, setRejectingClaim] = useState<Claim | null>(null);
  const [benefitFor, setBenefitFor] = useState<number | null>(null);
  const [showingTax, setShowingTax] = useState<Payslip | null>(null);
  const [printing, setPrinting] = useState<Printing | null>(null);

  const period = periodById(periodId);
  const locked = isLocked(period);

  // `version` moves on every commit; the records are the same arrays after a change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const slips = useMemo(() => slipsFor(periodId), [periodId, version]);

  const needle = q.trim().toLowerCase();
  const rows = slips.filter(
    (s) =>
      needle === "" ||
      [s.employee.name, s.employee.nickname, s.employee.code, s.employee.department].some((t) =>
        t.toLowerCase().includes(needle)
      )
  );
  const picked = openAt === null ? null : (rows[openAt] ?? null);

  const totals: Totals = {
    gross: slips.reduce((n, s) => n + s.gross, 0),
    deductions: slips.reduce((n, s) => n + s.deductions, 0),
    net: slips.reduce((n, s) => n + s.netPay, 0),
    tax: slips.reduce((n, s) => n + s.tax, 0),
    sso: slips.reduce((n, s) => n + s.sso, 0),
    pvd: slips.reduce((n, s) => n + s.pvd, 0),
  };

  const run = () =>
    attempt(
      () => runPayroll(periodId),
      (r) =>
        r.added.length
          ? `คำนวณ${period.label}แล้ว บันทึกพนักงานใหม่ ${r.added.map((e) => e.name).join(", ")} เข้างวด`
          : `คำนวณ${period.label}ใหม่แล้ว ${r.slips.length} คน จ่ายสุทธิ ${baht(r.slips.reduce((n, s) => n + s.netPay, 0))}`
    );

  const periodPicker = (
    <div className="flex flex-wrap items-center gap-2">
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
      <Button variant="secondary" icon={<CalendarPlus size={15} />} onClick={() => setNewPeriod(true)}>
        เปิดงวดใหม่
      </Button>
    </div>
  );

  const workflow = (
    <Workflow
      period={period}
      slips={slips}
      onRun={run}
      onApprove={() => setApproving(true)}
      onReopen={() => setReopening(true)}
      onPay={() => setPaying(true)}
      onNewPeriod={() => setNewPeriod(true)}
    />
  );

  const printView = (p: Printing): { title: string; what: string; body: ReactNode } => {
    switch (p.kind) {
      case "slip":
        return { title: "พิมพ์สลิปเงินเดือน", what: `สลิปของ${p.slip.employee.name}`, body: <PayslipPaper slip={p.slip} period={period} /> };
      case "slips":
        return { title: "พิมพ์สลิปทั้งงวด", what: `สลิป ${slips.length} ใบ`, body: <PayslipBatch slips={slips} period={period} /> };
      case "pnd1":
        return { title: "พิมพ์ใบแนบ ภ.ง.ด.1", what: "ใบแนบ ภ.ง.ด.1", body: <Pnd1Paper periodId={periodId} /> };
      case "sso":
        return { title: "พิมพ์ สปส.1-10", what: "แบบ สปส.1-10", body: <Sso110Paper periodId={periodId} /> };
      case "cert":
        return {
          title: "พิมพ์หนังสือรับรอง 50 ทวิ",
          what: `50 ทวิ ของ${empName(p.employeeId)}`,
          body: <Cert50Paper employeeId={p.employeeId} year={period.month.slice(0, 4)} />,
        };
      case "bank":
        return { title: "พิมพ์ใบนำส่งรายการโอน", what: "ใบนำส่งรายการโอนเงินเดือน", body: <BankPaper periodId={periodId} /> };
    }
  };
  const view = printing ? printView(printing) : null;

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
        {picked && (
          <Slip
            key={picked.employeeId}
            slip={picked}
            period={period}
            onPrint={() => setPrinting({ kind: "slip", slip: picked })}
            onAdjust={() => setAdjusting({ employeeId: picked.employeeId })}
            onEditAttendance={() => setEditing(picked)}
          />
        )}
      </DetailModal>

      <FormModal open={showingTax !== null} title="ที่มาของภาษีหัก ณ ที่จ่าย" subtitle={showingTax?.employee.name} onClose={() => setShowingTax(null)}>
        {showingTax && <TaxBreakdown slip={showingTax} />}
      </FormModal>

      <ConfirmDialog
        open={approving}
        title="อนุมัติและล็อกงวด"
        body="สลิปทุกใบจะถูกเก็บตามตัวเลข ณ ตอนนี้ แก้ขาดลามาสาย เพิ่มรายการ หรือปรับเงินเดือนในทะเบียนพนักงานภายหลังจะไม่กระทบงวดนี้"
        subject={
          <span className="block text-center">
            <span className="block text-[13px] font-medium text-slate-900 dark:text-slate-50">{period.label}</span>
            <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
              {slips.length} คน · จ่ายสุทธิ {baht(totals.net)} · ภาษี {baht(totals.tax)}
            </span>
          </span>
        }
        confirmLabel="อนุมัติและล็อก"
        onCancel={() => setApproving(false)}
        onConfirm={() => {
          if (attempt(() => approvePeriod(periodId), `อนุมัติและล็อก${period.label}แล้ว สร้างไฟล์โอนเงินได้ที่หน้าการจ่ายเงิน`)) {
            setApproving(false);
          }
        }}
      />

      <ReasonDialog
        open={reopening}
        title="ปลดล็อกงวดเพื่อแก้ไข"
        body="งวดจะกลับไปรอตรวจสอบ ตัวเลขทุกตัวคำนวณสดอีกครั้ง ไฟล์โอนเงินที่สร้างไว้แล้วต้องสร้างใหม่หลังอนุมัติ"
        subject={<span className="block text-center text-[13px] text-slate-800 dark:text-slate-100">{period.label}</span>}
        confirmLabel="ปลดล็อก"
        label="เหตุผลที่ปลดล็อก"
        placeholder="เช่น ฝ่ายคลังส่งชั่วโมงล่วงเวลาเพิ่มหลังอนุมัติ"
        onCancel={() => setReopening(false)}
        onConfirm={(reason) => {
          if (attempt(() => reopenPeriod(periodId, reason), `ปลดล็อก${period.label}แล้ว กลับไปรอตรวจสอบ`)) setReopening(false);
        }}
      />

      <ConfirmDialog
        open={paying}
        title="ยืนยันการจ่ายเงินทั้งงวด"
        body={`ระบบจะบันทึกว่างวดนี้จ่ายแล้ว ยอดรวม ${baht(totals.net)} ให้พนักงาน ${slips.length} คน บันทึกแล้วย้อนกลับไม่ได้`}
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
          if (attempt(() => markPaid(periodId), `บันทึกการจ่ายเงิน${period.label}แล้ว ยอดรวม ${baht(totals.net)}`)) setPaying(false);
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="ลบรายการ"
        body="รายการจะหายจากสลิปและคำนวณภาษีใหม่ทันที"
        subject={removing && <Who id={removing.employeeId} sub={`${removing.kind} ${baht(removing.amount)} · ${removing.note}`} />}
        confirmLabel="ลบรายการ"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing && attempt(() => removeAdjustment(removing.id), `ลบ${removing.kind}ของ${empName(removing.employeeId)}แล้ว`)) {
            setRemoving(null);
          }
        }}
      />

      <ReasonDialog
        open={rejectingClaim !== null}
        title="ไม่อนุมัติใบเบิก"
        body="พนักงานจะเห็นเหตุผลนี้ และยอดเบิกไม่เข้าสลิป วงเงินที่จองไว้คืนกลับ"
        subject={rejectingClaim && <Who id={rejectingClaim.employeeId} sub={`${rejectingClaim.no} · ${rejectingClaim.type} ${baht(rejectingClaim.amount)}`} />}
        confirmLabel="ไม่อนุมัติ"
        placeholder="เช่น ใบเสร็จไม่ได้ออกในนามพนักงาน"
        onCancel={() => setRejectingClaim(null)}
        onConfirm={(reason) => {
          if (rejectingClaim && attempt(() => rejectClaim(rejectingClaim.id, reason), `ไม่อนุมัติใบเบิก ${rejectingClaim.no} แล้ว`)) {
            setRejectingClaim(null);
          }
        }}
      />

      {editing && <AttendanceForm slip={editing} onClose={() => setEditing(null)} />}
      {adjusting && (
        <AdjustmentForm periodId={periodId} employeeId={adjusting.employeeId} item={adjusting.item} onClose={() => setAdjusting(null)} />
      )}
      {claiming && <ClaimForm periodId={periodId} onClose={() => setClaiming(false)} />}
      {benefitFor !== null && <BenefitForm employeeId={benefitFor} onClose={() => setBenefitFor(null)} />}
      {newPeriod && (
        <PeriodForm
          onClose={() => setNewPeriod(false)}
          onCreated={(p) => {
            setNewPeriod(false);
            setPeriodId(p.id);
            setOpenAt(null);
          }}
        />
      )}
      {view && (
        <PrintModal title={view.title} subtitle={period.label} what={view.what} onClose={() => setPrinting(null)}>
          {view.body}
        </PrintModal>
      )}
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
          workflow={workflow}
        />
        {panels}
      </>
    );
  }

  const openClaim = CLAIMS.find((c) => c.periodId === periodId && c.status === "รออนุมัติ");
  const firstAdjustment = ADJUSTMENTS.find((a) => a.periodId === periodId);

  return (
    <div>
      <PageHead
        title="เงินเดือน"
        meta={`${tab} · ${period.label} · ${slips.length} คน · จ่ายสุทธิ ${baht(totals.net)}`}
        right={periodPicker}
      />

      {tab === "คำนวณเงินเดือน" && (
        <Calculation
          rows={rows}
          totals={totals}
          q={q}
          setQ={setQ}
          onOpen={(s) => setOpenAt(rows.indexOf(s))}
          workflow={workflow}
          period={period}
          slips={slips}
          onAdd={() => setAdjusting({})}
          onEditItem={(item) => setAdjusting({ item })}
          onRemoveItem={setRemoving}
          onPrintAll={() => setPrinting({ kind: "slips" })}
          onPrintOne={(slip) => setPrinting({ kind: "slip", slip })}
        />
      )}

      {tab === "สวัสดิการ" && (
        <Benefits
          slips={slips}
          period={period}
          onClaim={() => setClaiming(true)}
          onRejectClaim={setRejectingClaim}
          onEditBenefits={setBenefitFor}
        />
      )}

      {tab === "ขาดลามาสาย" && <Absences slips={slips} period={period} onEdit={setEditing} />}

      {tab === "ภาษีและประกันสังคม" && (
        <Statutory
          slips={slips}
          totals={totals}
          period={period}
          onShow={setShowingTax}
          onPrint={(kind) => setPrinting({ kind })}
          onCert={(employeeId) => setPrinting({ kind: "cert", employeeId })}
        />
      )}

      {tab === "การจ่ายเงิน" && (
        <Payments
          slips={slips}
          period={period}
          total={totals.net}
          workflow={workflow}
          onPrintBank={() => setPrinting({ kind: "bank" })}
          onPrintAll={() => setPrinting({ kind: "slips" })}
          onPrintOne={(slip) => setPrinting({ kind: "slip", slip })}
        />
      )}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="คำนวณเงินเดือน" />
        <button data-fitt-screen="สลิปเงินเดือน" data-fitt-modal onClick={() => setOpenAt(0)} />
        <button data-fitt-screen="แก้ขาดลามาสาย" data-fitt-modal onClick={() => slips[0] && setEditing(slips[0])} />
        <button data-fitt-screen="ยืนยันการจ่ายเงิน" data-fitt-modal onClick={() => setPaying(true)} />
        <button data-fitt-screen="อนุมัติและล็อกงวด" data-fitt-modal onClick={() => setApproving(true)} />
        <button data-fitt-screen="ปลดล็อกงวด" data-fitt-modal onClick={() => setReopening(true)} />
        <button data-fitt-screen="เปิดงวดเงินเดือนใหม่" data-fitt-modal onClick={() => setNewPeriod(true)} />
        <button data-fitt-screen="เพิ่มรายการเงินได้เงินหัก" data-fitt-modal onClick={() => setAdjusting({})} />
        <button data-fitt-screen="ลบรายการเงินได้เงินหัก" data-fitt-modal onClick={() => firstAdjustment && setRemoving(firstAdjustment)} />
        <button data-fitt-screen="บันทึกเบิกสวัสดิการ" data-fitt-modal onClick={() => setClaiming(true)} />
        <button data-fitt-screen="ไม่อนุมัติใบเบิกสวัสดิการ" data-fitt-modal onClick={() => openClaim && setRejectingClaim(openClaim)} />
        <button data-fitt-screen="ปรับสวัสดิการประจำ" data-fitt-modal onClick={() => slips[0] && setBenefitFor(slips[0].employeeId)} />
        <button data-fitt-screen="ที่มาของภาษี" data-fitt-modal onClick={() => slips[0] && setShowingTax(slips[0])} />
        <button data-fitt-screen="พิมพ์สลิปเงินเดือน" data-fitt-modal onClick={() => slips[0] && setPrinting({ kind: "slip", slip: slips[0] })} />
        <button data-fitt-screen="พิมพ์สลิปทั้งงวด" data-fitt-modal onClick={() => setPrinting({ kind: "slips" })} />
        <button data-fitt-screen="พิมพ์ ภ.ง.ด.1" data-fitt-modal onClick={() => setPrinting({ kind: "pnd1" })} />
        <button data-fitt-screen="พิมพ์ สปส.1-10" data-fitt-modal onClick={() => setPrinting({ kind: "sso" })} />
        <button data-fitt-screen="พิมพ์ 50 ทวิ" data-fitt-modal onClick={() => slips[0] && setPrinting({ kind: "cert", employeeId: slips[0].employeeId })} />
        {/* From a cold start the open period is still under review, so the door
            goes to the latest approved one — that is the sheet there is to print. */}
        <button data-fitt-screen="พิมพ์ใบนำส่งรายการโอน" data-fitt-modal onClick={() => { const done = PERIODS.find(isLocked); if (done) { setPeriodId(done.id); setPrinting({ kind: "bank" }); } }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- workflow */

/** Where the period is, and the one or two moves it can make from there. */
function Workflow({
  period,
  slips,
  onRun,
  onApprove,
  onReopen,
  onPay,
  onNewPeriod,
}: {
  period: Period;
  slips: Payslip[];
  onRun: () => void;
  onApprove: () => void;
  onReopen: () => void;
  onPay: () => void;
  onNewPeriod: () => void;
}) {
  const at = PERIOD_FLOW.indexOf(period.status);
  const flow: { label: string; state: StepState }[] = PERIOD_FLOW.map((s, i) => ({
    label: s,
    state: i < at ? "done" : i === at ? "current" : "todo",
  }));
  const blockers = period.status === "รอตรวจสอบ" ? approvalBlockers(period.id) : [];
  const joined = isLocked(period) ? [] : missingFrom(period.id);
  const latest = latestPeriod();

  return (
    <Card
      title={<span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />ขั้นตอนของงวด</span>}
      subtitle={`${period.label} · ${slips.length} คน · กำหนดจ่าย ${period.payDate}${period.approvedBy ? ` · อนุมัติโดย ${period.approvedBy}` : ""}`}
    >
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Stepper steps={flow} icons={FLOW_ICONS} />
          <span className="ml-auto flex flex-wrap gap-2">
            {period.status === "กำลังคำนวณ" && (
              <Button variant="primary" icon={<Calculator size={15} />} onClick={onRun}>
                คำนวณเงินเดือน
              </Button>
            )}
            {period.status === "รอตรวจสอบ" && (
              <>
                <Button variant="secondary" icon={<RefreshCw size={15} />} onClick={onRun}>
                  คำนวณใหม่
                </Button>
                <Button variant="primary" icon={<Lock size={15} />} onClick={onApprove} disabled={blockers.length > 0}>
                  อนุมัติและล็อกงวด
                </Button>
              </>
            )}
            {period.status === "อนุมัติแล้ว" && (
              <>
                <Button variant="ghost" icon={<LockOpen size={15} />} onClick={onReopen}>
                  ปลดล็อกเพื่อแก้ไข
                </Button>
                <Button variant="primary" icon={<HandCoins size={15} />} onClick={onPay}>
                  บันทึกการจ่ายเงิน
                </Button>
              </>
            )}
            {period.id === latest.id && isLocked(period) && (
              <Button variant="secondary" icon={<CalendarPlus size={15} />} onClick={onNewPeriod}>
                เปิดงวดถัดไป
              </Button>
            )}
          </span>
        </div>
        {blockers.length > 0 && <Note tone="warn">ยังอนุมัติไม่ได้ · {blockers.join(" · ")}</Note>}
        {joined.length > 0 && (
          <Note tone="accent">
            {joined.map((e) => e.name).join(", ")} เข้างวดนี้หลังคำนวณครั้งก่อน สลิปคิดเงินเดือนตามสัดส่วนวันทำงานแล้ว
            กดคำนวณใหม่เพื่อบันทึกเข้างวดและเริ่มคีย์ขาดลามาสาย
          </Note>
        )}
        {period.note && period.status === "รอตรวจสอบ" && <Note tone="idle">ปลดล็อกครั้งล่าสุดเพราะ: {period.note}</Note>}
        {period.status === "จ่ายแล้ว" && <Note tone="ok">จ่ายเงินงวดนี้แล้วเมื่อ {period.paidAt ?? period.payDate} สลิปทุกใบถูกเก็บตามที่จ่ายจริง</Note>}
      </div>
    </Card>
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
  workflow,
}: {
  period: Period;
  slips: Payslip[];
  totals: Totals;
  onOpenSection?: (index: number) => void;
  onOpenSlip: (s: Payslip) => void;
  periodPicker: ReactNode;
  workflow: ReactNode;
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

      <Reveal className="mb-3">{workflow}</Reveal>

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
                      <Bar pct={totals.gross ? (Math.abs(r.value) / totals.gross) * 100 : 0} tone={r.tone} width="w-full" />
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
  workflow,
  period,
  slips,
  onAdd,
  onEditItem,
  onRemoveItem,
  onPrintAll,
  onPrintOne,
}: {
  rows: Payslip[];
  totals: Totals;
  q: string;
  setQ: (v: string) => void;
  onOpen: (s: Payslip) => void;
  workflow: ReactNode;
  period: Period;
  slips: Payslip[];
  onAdd: () => void;
  onEditItem: (a: Adjustment) => void;
  onRemoveItem: (a: Adjustment) => void;
  onPrintAll: () => void;
  onPrintOne: (s: Payslip) => void;
}) {
  const locked = isLocked(period);
  const items = ADJUSTMENTS.filter((a) => a.periodId === period.id);
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
      {workflow}

      <StatStrip
        title="ยอดรวมทั้งงวด"
        icon={<Calculator size={15} />}
        cells={[
          { icon: <Coins size={13} />, label: "รายได้รวม", value: baht(totals.gross), sub: "เงินเดือนฐาน สวัสดิการ และล่วงเวลา" },
          { icon: <Scale size={13} />, label: "รายการหักรวม", value: baht(totals.deductions), sub: "ขาดลามาสาย ประกันสังคม กองทุน และภาษี", tone: "bad" },
          { icon: <Wallet size={13} />, label: "จ่ายสุทธิ", value: baht(totals.net), sub: "ยอดที่โอนเข้าบัญชีพนักงาน", tone: "ok" },
          { icon: <Percent size={13} />, label: "สัดส่วนที่ถูกหัก", value: (totals.gross ? Math.round((totals.deductions / totals.gross) * 100) : 0) + "%", sub: "ของรายได้รวมทั้งงวด", tone: "accent" },
        ]}
      />

      <DataTable
        rows={rows}
        columns={columns}
        getId={(s) => s.employeeId}
        onOpen={onOpen}
        trailing={(s) => (
          <MiniButton onClick={() => onPrintOne(s)}>
            <Printer size={12} /> สลิป
          </MiniButton>
        )}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Search value={q} onChange={setQ} placeholder="ค้นหาชื่อ รหัส หรือแผนก" icon={<SearchIcon size={14} />} />
            <span className="text-[12px] text-slate-400">กดที่แถวเพื่อเปิดสลิปเต็มใบ</span>
            <span className="ml-auto flex flex-wrap gap-2">
              <Button variant="secondary" icon={<FileSpreadsheet size={15} />} onClick={() => exportRegister(period, slips)}>
                ส่งออก Excel
              </Button>
              <Button variant="secondary" icon={<Printer size={15} />} onClick={onPrintAll}>
                พิมพ์สลิปทั้งงวด
              </Button>
              <Button variant="primary" icon={<Plus size={15} />} onClick={onAdd} disabled={locked}>
                เพิ่มรายการเงินได้/เงินหัก
              </Button>
            </span>
          </div>
        }
      />

      <Card
        title={<span className="flex items-center gap-2"><Coins size={15} className="text-slate-400" />รายการเงินได้และเงินหักครั้งคราวของงวด</span>}
        subtitle={locked ? "งวดนี้ล็อกแล้ว รายการแก้ไม่ได้" : "โบนัส คอมมิชชั่น เบิกล่วงหน้า กยศ. — เข้าสลิปทันทีและคำนวณภาษีใหม่"}
      >
        {items.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-slate-400">ยังไม่มีรายการในงวดนี้</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((a) => {
              const k = adjustmentKindOf(a.kind);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <Who id={a.employeeId} sub={`${a.kind} · ${a.note}`} />
                  </span>
                  <Badge tone={k.sign > 0 ? "ok" : "bad"}>{k.sign > 0 ? (k.taxable ? "เงินได้ คิดภาษี" : "เงินได้") : "เงินหัก"}</Badge>
                  <span className={"w-28 text-right text-[13px] font-semibold tabular-nums " + (k.sign > 0 ? "text-slate-900 dark:text-slate-50" : "text-rose-600 dark:text-rose-400")}>
                    {k.sign > 0 ? "" : "−"}
                    {baht(a.amount)}
                  </span>
                  <span className="flex gap-1.5">
                    <MiniButton onClick={() => onEditItem(a)} disabled={locked}>
                      <Pencil size={12} /> แก้
                    </MiniButton>
                    <MiniButton tone="bad" onClick={() => onRemoveItem(a)} disabled={locked}>
                      <Trash2 size={12} /> ลบ
                    </MiniButton>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- benefits */

function Benefits({
  slips,
  period,
  onClaim,
  onRejectClaim,
  onEditBenefits,
}: {
  slips: Payslip[];
  period: Period;
  onClaim: () => void;
  onRejectClaim: (c: Claim) => void;
  onEditBenefits: (employeeId: number) => void;
}) {
  const [only, setOnly] = useState("ทั้งหมด");
  const locked = isLocked(period);
  const claims = CLAIMS.filter((c) => c.periodId === period.id).sort((a, b) => b.id - a.id);
  const claimColumns: Column<Claim>[] = [
    { key: "no", header: "เลขที่", width: "14%", sort: (a, b) => a.no.localeCompare(b.no), cell: (c) => <span className="font-mono text-[12px]">{c.no}</span> },
    { key: "who", header: "พนักงาน", width: "24%", cell: (c) => <Who id={c.employeeId} sub={c.detail} /> },
    { key: "type", header: "ประเภท", width: "16%", cell: (c) => <Chip>{c.type}</Chip> },
    { key: "date", header: "วันที่ใบเสร็จ", width: "13%", sort: (a, b) => a.receiptDate.localeCompare(b.receiptDate), cell: (c) => <span className="tabular-nums">{c.receiptDate}</span> },
    { key: "amount", header: "ยอดเบิก", align: "right", width: "12%", sort: (a, b) => a.amount - b.amount, cell: (c) => <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(c.amount)}</span> },
    { key: "status", header: "สถานะ", width: "12%", cell: (c) => <Badge tone={CLAIM_TONE[c.status]} dot>{c.status}</Badge> },
  ];
  const exportClaims = () => {
    downloadCsv(
      `ใบเบิกสวัสดิการ-${period.month}`,
      ["เลขที่", "พนักงาน", "ประเภท", "วันที่ใบเสร็จ", "ยอดเบิก", "สถานะ", "รายละเอียด", "ผู้พิจารณา"],
      claims.map((c) => [c.no, empName(c.employeeId), c.type, c.receiptDate, c.amount, c.status, c.detail, c.decidedBy ?? ""])
    );
    notify(`ส่งออกใบเบิกสวัสดิการ ${claims.length} ใบแล้ว`);
  };
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

      <DataTable
        rows={claims}
        columns={claimColumns}
        getId={(c) => c.id}
        empty="ยังไม่มีใบเบิกสวัสดิการในงวดนี้"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">
              <Receipt size={15} className="text-slate-400" />
              ใบเบิกสวัสดิการของงวด
            </span>
            <span className="text-[12px] text-slate-400">อนุมัติแล้วจ่ายรวมในสลิปงวดนี้ · ต้องพิจารณาครบก่อนอนุมัติงวด</span>
            <span className="ml-auto flex gap-2">
              <Button variant="secondary" icon={<FileSpreadsheet size={15} />} onClick={exportClaims}>
                ส่งออก Excel
              </Button>
              <Button variant="primary" icon={<Plus size={15} />} onClick={onClaim} disabled={locked}>
                บันทึกเบิกสวัสดิการ
              </Button>
            </span>
          </div>
        }
        trailing={(c) =>
          c.status === "รออนุมัติ" ? (
            <span className="flex items-center justify-end gap-1.5">
              <MiniButton
                tone="ok"
                disabled={locked}
                onClick={() => attempt(() => approveClaim(c.id), `อนุมัติใบเบิก ${c.no} ${baht(c.amount)} แล้ว เข้าสลิปของ${empName(c.employeeId)}`)}
              >
                อนุมัติ
              </MiniButton>
              <MiniButton tone="bad" disabled={locked} onClick={() => onRejectClaim(c)}>
                ไม่อนุมัติ
              </MiniButton>
            </span>
          ) : (
            <span className="block truncate text-right text-[11px] text-slate-400">{c.note ?? c.decidedBy ?? "—"}</span>
          )
        }
      />

      <Card
        title={<span className="flex items-center gap-2"><Gift size={15} className="text-slate-400" />สวัสดิการรายคน</span>}
        subtitle="รายการที่ขีดฆ่าคือสวัสดิการที่ถูกตัดตามเงื่อนไขของงวดนี้ · กดปรับเพื่อแก้สวัสดิการประจำ"
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
              <MiniButton onClick={() => onEditBenefits(s.employeeId)}>
                <Pencil size={12} /> ปรับ
              </MiniButton>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- absences */

function Absences({ slips, period, onEdit }: { slips: Payslip[]; period: Period; onEdit: (s: Payslip) => void }) {
  const locked = isLocked(period);
  const exportCuts = () => {
    downloadCsv(
      `ขาดลามาสาย-${period.month}`,
      ["รหัส", "พนักงาน", "ฐานต่อวัน", "ขาดงาน (วัน)", "ลาไม่รับค่าจ้าง (วัน)", "มาสาย (นาที)", "ยอดหัก", "หมายเหตุ"],
      slips.map((s) => [s.employee.code, s.employee.name, Math.round(s.perDay), s.absentDays, s.unpaidDays, s.lateMinutes, s.absenceCut + s.lateCut, s.note ?? ""])
    );
    notify(`ส่งออกรายการขาดลามาสาย${period.label}แล้ว`);
  };
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
        subtitle={locked ? "งวดนี้ล็อกแล้ว ตัวเลขแก้ไม่ได้จนกว่าจะปลดล็อก" : "กดแก้ไขเพื่อปรับตัวเลขของงวดนี้ ยอดหักและเงินเดือนสุทธิจะคำนวณใหม่ทันที"}
        action={
          <MiniButton onClick={exportCuts}>
            <FileSpreadsheet size={12} /> ส่งออก Excel
          </MiniButton>
        }
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
                    <span className="inline-flex items-center gap-2">
                      {s.note && <span className="max-w-40 truncate text-[11px] text-slate-400" title={s.note}>{s.note}</span>}
                      <MiniButton onClick={() => onEdit(s)} disabled={locked}>
                        <Pencil size={12} /> แก้ไข
                      </MiniButton>
                    </span>
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

function Statutory({
  slips,
  totals,
  period,
  onShow,
  onPrint,
  onCert,
}: {
  slips: Payslip[];
  totals: Totals;
  period: Period;
  onShow: (s: Payslip) => void;
  onPrint: (kind: "pnd1" | "sso") => void;
  onCert: (employeeId: number) => void;
}) {
  const year = period.month.slice(0, 4);
  return (
    <div className="space-y-3">
      <Card
        title={<span className="flex items-center gap-2"><Landmark size={15} className="text-slate-400" />แบบนำส่งประจำเดือน</span>}
        subtitle={`${period.label} · ภ.ง.ด.1 ยื่นภายในวันที่ 7 · สปส.1-10 นำส่งภายในวันที่ 15 ของเดือนถัดไป`}
      >
        <div className="flex flex-wrap items-center gap-2 p-4">
          <Button variant="secondary" icon={<Printer size={15} />} onClick={() => onPrint("pnd1")}>
            พิมพ์ ภ.ง.ด.1
          </Button>
          <Button variant="secondary" icon={<FileSpreadsheet size={15} />} onClick={() => exportPnd1(period.id)}>
            ส่งออก ภ.ง.ด.1
          </Button>
          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-700" />
          <Button variant="secondary" icon={<Printer size={15} />} onClick={() => onPrint("sso")}>
            พิมพ์ สปส.1-10
          </Button>
          <Button variant="secondary" icon={<FileSpreadsheet size={15} />} onClick={() => exportSso(period.id)}>
            ส่งออก สปส.1-10
          </Button>
          {!isLocked(period) && <span className="text-[12px] text-amber-600 dark:text-amber-400">งวดยังไม่อนุมัติ ตัวเลขอาจเปลี่ยน</span>}
        </div>
      </Card>

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
          subtitle={`กดที่แถวเพื่อดูว่าภาษีคำนวณมาอย่างไร · หนังสือรับรอง 50 ทวิ ปี ${Number(year) + 543} รวมงวดที่จ่ายแล้ว`}
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
                  <th className="px-4 py-3 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {slips.map((s) => (
                  <tr
                    key={s.employeeId}
                    onClick={() => onShow(s)}
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
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <MiniButton onClick={() => onCert(s.employeeId)} disabled={cert50(s.employeeId, year).periods.length === 0}>
                        <Printer size={12} /> 50 ทวิ
                      </MiniButton>
                    </td>
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
    </div>
  );
}

/* --------------------------------------------------------------- payments */

function Payments({
  slips,
  period,
  total,
  workflow,
  onPrintBank,
  onPrintAll,
  onPrintOne,
}: {
  slips: Payslip[];
  period: Period;
  total: number;
  workflow: ReactNode;
  onPrintBank: () => void;
  onPrintAll: () => void;
  onPrintOne: (s: Payslip) => void;
}) {
  const methods = [...new Set(slips.map((s) => bankOf(s.employeeId).method))];
  const paid = period.status === "จ่ายแล้ว";
  const locked = isLocked(period);
  const by = (method: string) => slips.filter((s) => bankOf(s.employeeId).method === method);

  return (
    <div className="space-y-3">
      {workflow}

      <Card
        title={<span className="flex items-center gap-2"><Banknote size={15} className="text-slate-400" />สรุปการจ่ายเงิน</span>}
        subtitle={`${period.label} · กำหนดจ่าย ${period.payDate}`}
        action={<Badge tone={STATUS_TONE[period.status]} dot>{period.status}</Badge>}
      >
        <div className="flex flex-wrap items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[30px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">{baht(total)}</p>
            <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
              โอนเข้าบัญชี {by("โอนเข้าบัญชี").length} คน · จ่ายเป็นเงินสด {by("เงินสด").length} คน
              {!locked && " · อนุมัติงวดก่อนจึงสร้างไฟล์โอนและบันทึกการจ่ายได้"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<Printer size={15} />} onClick={onPrintAll}>
              พิมพ์สลิปทั้งงวด
            </Button>
            <Button variant="secondary" icon={<Printer size={15} />} onClick={onPrintBank} disabled={!locked}>
              พิมพ์ใบนำส่งธนาคาร
            </Button>
            <Button variant="primary" icon={<FileSpreadsheet size={15} />} onClick={() => exportBank(period.id)} disabled={!locked}>
              สร้างไฟล์โอนเงิน
            </Button>
          </div>
          {paid && <Badge tone="ok" icon={<CircleCheck size={13} />}>จ่ายเรียบร้อยเมื่อ {period.paidAt ?? period.payDate}</Badge>}
        </div>
      </Card>

      {methods.map((method) => {
        const list = by(method);
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
                const bank = bankOf(s.employeeId);
                return (
                  <li key={s.employeeId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <Avatar name={s.employee.name} size="sm" />
                    <span className="w-44 shrink-0">
                      <span className="block truncate text-[13px] text-slate-900 dark:text-slate-50">{s.employee.name}</span>
                      <span className="block truncate font-mono text-[11px] text-slate-400">{s.employee.code}</span>
                    </span>
                    <span className="min-w-0 flex-1 text-[12.5px] text-slate-500 dark:text-slate-400">
                      {method === "เงินสด" ? "รับที่ฝ่ายบัญชี" : `${bank.bank} · ${bank.account}`}
                    </span>
                    <Badge tone={paid ? "ok" : "idle"} dot>
                      {paid ? "จ่ายแล้ว" : "รอจ่าย"}
                    </Badge>
                    <MiniButton onClick={() => onPrintOne(s)}>
                      <Printer size={12} /> สลิป
                    </MiniButton>
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

import { useState } from "react";
import type { ReactNode } from "react";
import {
  ClipboardCheck, FileSpreadsheet, Handshake, LifeBuoy, Plus, Printer, RotateCcw, Route, ScanLine, ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { TODAY, carOf } from "../ims/data";
import { Body, Empty, Header, Line, Lines, run } from "../ims/parts";
import {
  CERTS, CONTINGENCIES, CSRS, DEVICES, PSR, SCORECARDS, SHIFTS, SUPPLIER_AUDITS, TRACE_DRILLS, TRACE_LIMIT_MINUTES, automotiveCustomers,
  certOf, certified, contingencyByCode, coverage, customerName, deviceByCode, effective, grade, lastTest, missingChecks, ourPpm,
  progressCsr, rating, restoreDevice, safetyChecks, safetyGaps, safetyParts, supplierAuditByNo, testDue, vendorName,
} from "./data";
import type { Contingency, Csr, Device, SupplierAudit } from "./data";
import { IatfActions } from "./forms";
import type { Act, RecordKind } from "./forms";
import { VENDORS } from "../mm/data";
import { Badge, Button, Card, Chip, Metric, Note, PageHead, Reveal } from "../ui";
import type { Tone } from "../ui";
import { DataTable, DetailModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";

const TABS = ["ข้อกำหนดเฉพาะลูกค้า", "ความปลอดภัยผลิตภัณฑ์", "แผนฉุกเฉินทางธุรกิจ", "ตรวจประเมินผู้ส่งมอบ", "ผลงานต่อลูกค้า (Scorecard)", "ป้องกันความผิดพลาด (Poka-Yoke)"];

const exportIcon = <FileSpreadsheet size={14} />;
const csv = (name: string, head: string[], rows: (string | number)[][]) => {
  downloadCsv(name, head, rows);
  notify(`ส่งออก${name} ${rows.length} รายการแล้ว`);
};
const csrTone = (c: Csr): Tone => (effective(c) ? "ok" : c.status === "ยังไม่ได้ทำ" ? "bad" : "warn");
const ratingTone = (r: string): Tone => (r === "เขียว" ? "ok" : r === "เหลือง" ? "warn" : "bad");
const gradeTone = (g: string): Tone => (g === "A" ? "ok" : g === "B" ? "warn" : "bad");

type Handlers = { onAct: (a: Act) => void; onOpen: (kind: RecordKind, key: string) => void };

export default function IatfScreen({ section, onOpenSection }: { section?: string; onOpenSection?: (index: number) => void }) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;
  const [act, setAct] = useState<Act | null>(null);
  const [record, setRecord] = useState<{ kind: RecordKind; key: string } | null>(null);
  const open = (kind: RecordKind, key: string) => setRecord({ kind, key });

  const keys: Record<RecordKind, string[]> = {
    contingency: CONTINGENCIES.map((c) => c.code),
    "supplier-audit": SUPPLIER_AUDITS.map((a) => a.no),
    device: DEVICES.map((d) => d.code),
  };
  const list = record ? keys[record.kind] : [];
  const at = record ? list.indexOf(record.key) : -1;
  const TITLES: Record<RecordKind, string> = { contingency: "แผนฉุกเฉิน", "supplier-audit": "การตรวจประเมินผู้ส่งมอบ", device: "อุปกรณ์ป้องกันความผิดพลาด" };
  const h: Handlers = { onAct: setAct, onOpen: open };
  const planned = SUPPLIER_AUDITS.find((a) => a.status === "ตามแผน") ?? SUPPLIER_AUDITS[0];

  const panels = (
    <>
      <DetailModal
        open={record !== null && at >= 0}
        title={record ? TITLES[record.kind] : ""}
        onClose={() => setRecord(null)}
        index={at}
        total={list.length}
        onStep={(d) => record && setRecord({ kind: record.kind, key: list[Math.min(list.length - 1, Math.max(0, at + d))] })}
      >
        {record && at >= 0 && <RecordView kind={record.kind} id={record.key} {...h} />}
      </DetailModal>
      <IatfActions act={act} onAct={setAct} onOpen={open} />
    </>
  );

  const index = (
    <div hidden data-fitt-index>
      <button data-fitt-screen="ข้อกำหนด IATF 16949" />
      <button data-fitt-screen="เพิ่มข้อกำหนดเฉพาะลูกค้า" data-fitt-modal onClick={() => setAct({ kind: "csr-new" })} />
      <button data-fitt-screen="นำข้อกำหนดไปใช้" data-fitt-modal onClick={() => setAct({ kind: "csr-implement", id: (CSRS.find((c) => !effective(c)) ?? CSRS[0]).id })} />
      <button data-fitt-screen="ทดสอบการสอบกลับ" data-fitt-modal onClick={() => setAct({ kind: "trace-new" })} />
      <button data-fitt-screen="แผนฉุกเฉิน" data-fitt-modal onClick={() => open("contingency", CONTINGENCIES[0].code)} />
      <button data-fitt-screen="ทดสอบแผนฉุกเฉิน" data-fitt-modal onClick={() => setAct({ kind: "contingency-test", code: CONTINGENCIES[1].code })} />
      <button data-fitt-screen="การตรวจประเมินผู้ส่งมอบ" data-fitt-modal onClick={() => open("supplier-audit", SUPPLIER_AUDITS[0].no)} />
      <button data-fitt-screen="วางแผนตรวจผู้ส่งมอบ" data-fitt-modal onClick={() => setAct({ kind: "supplier-audit-new" })} />
      <button data-fitt-screen="บันทึกผลตรวจผู้ส่งมอบ" data-fitt-modal onClick={() => setAct({ kind: "supplier-audit-close", no: planned.no })} />
      <button data-fitt-screen="บันทึก scorecard จากลูกค้า" data-fitt-modal onClick={() => setAct({ kind: "scorecard-new" })} />
      <button data-fitt-screen="อุปกรณ์ป้องกันความผิดพลาด" data-fitt-modal onClick={() => open("device", DEVICES[0].code)} />
      <button data-fitt-screen="ทวนสอบอุปกรณ์ประจำกะ" data-fitt-modal onClick={() => setAct({ kind: "device-verify", code: DEVICES[0].code })} />
      <button data-fitt-screen="พิมพ์ตารางข้อกำหนดเฉพาะลูกค้า" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "csr", customer: automotiveCustomers()[0] }, title: "ตารางข้อกำหนดเฉพาะลูกค้า" })} />
      <button data-fitt-screen="พิมพ์แผนฉุกเฉิน" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "contingency", code: CONTINGENCIES[0].code }, title: "แผนฉุกเฉินทางธุรกิจ" })} />
      <button data-fitt-screen="พิมพ์รายงานตรวจผู้ส่งมอบ" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "supplier-audit", no: SUPPLIER_AUDITS[0].no }, title: "รายงานการตรวจประเมินผู้ส่งมอบ" })} />
      <button data-fitt-screen="พิมพ์ใบทวนสอบ Poka-Yoke" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "device", code: DEVICES[0].code }, title: "ใบทวนสอบอุปกรณ์ป้องกันความผิดพลาด" })} />
    </div>
  );

  if (!tab) {
    return (
      <>
        <Overview onOpenSection={onOpenSection} {...h} />
        {panels}
        {index}
      </>
    );
  }

  return (
    <div>
      <PageHead title="ข้อกำหนด IATF 16949" meta={`${tab} · ข้อมูล ณ ${TODAY}`} />
      {tab === TABS[0] && <Csrs {...h} />}
      {tab === TABS[1] && <Safety {...h} />}
      {tab === TABS[2] && <Contingencies {...h} />}
      {tab === TABS[3] && <SupplierAudits {...h} />}
      {tab === TABS[4] && <Scorecards {...h} />}
      {tab === TABS[5] && <Devices {...h} />}
      {panels}
      {index}
    </div>
  );
}

/* -------------------------------------------------------------- overview */

function Overview({ onOpenSection, onAct, onOpen }: Handlers & { onOpenSection?: (i: number) => void }) {
  const customers = automotiveCustomers();
  const cov = customers.map(coverage).reduce((a, b) => ({ done: a.done + b.done, total: a.total + b.total }), { done: 0, total: 0 });
  const last = SCORECARDS.at(-1);
  const due = CONTINGENCIES.filter(testDue);
  const missing = missingChecks();

  const todo: { icon: ReactNode; text: string; sub: string; go: () => void; tone: Tone }[] = [
    ...DEVICES.filter((d) => d.status === "หยุดใช้").map((d) => ({ icon: <ScanLine size={15} />, text: `${d.code} หยุดใช้`, sub: `${d.name} · ตรวจ 100% ด้วยมือจนกว่าจะปิด CAR`, go: () => onOpen("device", d.code), tone: "bad" as Tone })),
    ...missing.map((m) => ({ icon: <ScanLine size={15} />, text: `ทวนสอบ ${m.device} กะ${m.shift}`, sub: deviceByCode(m.device).name, go: () => onAct({ kind: "device-verify", code: m.device, shift: m.shift }), tone: "warn" as Tone })),
    ...safetyGaps().map((g) => ({ icon: <ShieldAlert size={15} />, text: `${g.part} · ${g.item}`, sub: "ความปลอดภัยผลิตภัณฑ์", go: () => onOpenSection?.(1), tone: "bad" as Tone })),
    ...due.map((c) => ({ icon: <LifeBuoy size={15} />, text: `${c.code} ${c.scenario}`, sub: lastTest(c) ? `ทดสอบล่าสุด ${lastTest(c)!.date} ${lastTest(c)!.result}` : "ยังไม่เคยทดสอบ", go: () => onAct({ kind: "contingency-test", code: c.code }), tone: "warn" as Tone })),
    ...CSRS.filter((c) => !effective(c)).map((c) => ({ icon: <ClipboardCheck size={15} />, text: `ข้อ ${c.clause} ${c.requirement}`, sub: `${customerName(c.customer)} · ${c.status} · ${c.owner}`, go: () => onAct({ kind: "csr-implement", id: c.id }), tone: (c.status === "ยังไม่ได้ทำ" ? "bad" : "warn") as Tone })),
  ];

  return (
    <div>
      <PageHead
        title="ข้อกำหนด IATF 16949"
        meta={`ข้อกำหนดเฉพาะลูกค้า · ความปลอดภัยผลิตภัณฑ์ · แผนฉุกเฉิน · ผู้ส่งมอบ · Scorecard · Poka-Yoke · ข้อมูล ณ ${TODAY}`}
        right={<Button icon={<Printer size={14} />} variant="secondary" onClick={() => onAct({ kind: "print", d: { doc: "csr", customer: customers[0] }, title: "ตารางข้อกำหนดเฉพาะลูกค้า" })}>พิมพ์ตารางข้อกำหนดลูกค้า</Button>}
      />
      <Reveal>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<ClipboardCheck size={17} />} label="ข้อกำหนดเฉพาะลูกค้าที่นำไปใช้" value={`${cov.done} จาก ${cov.total}`} deltaLabel="นับเฉพาะข้อที่มีเอกสารใช้งานอยู่" />
          <Metric icon={<ShieldAlert size={17} />} label="ความปลอดภัยผลิตภัณฑ์ยังไม่ผ่าน" value={`${safetyGaps().length} ข้อ`} deltaLabel={`ผู้แทน ${PSR}`} />
          <Metric icon={<LifeBuoy size={17} />} label="แผนฉุกเฉินที่ต้องทดสอบ" value={`${due.length} จาก ${CONTINGENCIES.length}`} deltaLabel="ทดสอบและผ่านอย่างน้อยปีละครั้ง" />
          <Metric icon={<TrendingUp size={17} />} label="Scorecard ล่าสุด" value={last ? rating(last) : "—"} deltaLabel={last ? `${customerName(last.customer)} ${last.month}` : "ยังไม่มี"} />
        </div>
      </Reveal>
      <Reveal delay={0.05} className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="ต้องจัดการ" subtitle="กดรายการเพื่อเปิดงานนั้น" className="lg:col-span-2">
          {todo.length === 0 ? <Empty>ไม่มีงานค้าง</Empty> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {todo.slice(0, 9).map((t, i) => (
                <li key={i}>
                  <button onClick={t.go} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <span className={t.tone === "bad" ? "text-rose-500" : t.tone === "warn" ? "text-amber-500" : "text-sky-500"}>{t.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-slate-800 dark:text-slate-100">{t.text}</span>
                      <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">{t.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="ผู้ส่งมอบ" subtitle="ใบรับรองระบบและผลตรวจล่าสุด" action={<Button variant="ghost" className="whitespace-nowrap" onClick={() => onOpenSection?.(3)}>ทั้งหมด</Button>}>
          <Lines>
            {VENDORS.map((v) => {
              const a = SUPPLIER_AUDITS.filter((x) => x.vendor === v.code && x.score !== undefined).at(-1);
              return <Line key={v.code} title={v.name} sub={`${certOf(v.code).standard}${a ? ` · ตรวจ ${a.performedOn} ${a.score}%` : ""}`} right={certified(v.code) ? (a ? <Badge tone={gradeTone(grade(a.score!))}>เกรด {grade(a.score!)}</Badge> : <Badge tone="idle">ยังไม่ตรวจ</Badge>) : <Badge tone="bad">ไม่มีใบรับรอง</Badge>} />;
            })}
          </Lines>
        </Card>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------- csr */

function Csrs({ onAct }: Handlers) {
  const columns: Column<Csr>[] = [
    { key: "clause", header: "ข้อ IATF", cell: (c) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-100">{c.clause}</span> },
    { key: "req", header: "ข้อกำหนดของลูกค้า", cell: (c) => <span className="block max-w-md">{c.requirement}</span> },
    { key: "customer", header: "ลูกค้า", cell: (c) => customerName(c.customer) },
    { key: "doc", header: "เอกสารของเรา", cell: (c) => c.doc ?? "—" },
    { key: "owner", header: "ผู้รับผิดชอบ", cell: (c) => c.owner },
    { key: "status", header: "สถานะ", cell: (c) => <Badge tone={csrTone(c)}>{c.status}</Badge> },
    {
      key: "act", header: "", cell: (c) => effective(c) ? null : (
        <span className="flex gap-1.5">
          {c.status === "ยังไม่ได้ทำ" && <Button variant="ghost" onClick={() => run(() => progressCsr(c.id), `เริ่มดำเนินการข้อ ${c.clause} แล้ว`)}>เริ่มทำ</Button>}
          <Button variant="secondary" onClick={() => onAct({ kind: "csr-implement", id: c.id })}>นำไปใช้</Button>
        </span>
      ),
    },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {automotiveCustomers().map((c) => {
          const cov = coverage(c);
          return <Metric key={c} icon={<Handshake size={17} />} label={customerName(c)} value={`${cov.done} จาก ${cov.total}`} deltaLabel="ข้อที่นำไปใช้ในเอกสารควบคุมแล้ว" />;
        })}
      </div>
      <DataTable
        rows={CSRS}
        columns={columns}
        getId={(c) => String(c.id)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ข้อกำหนดของลูกค้าต้องแปลงเป็นเอกสารควบคุมของเรา — นับว่านำไปใช้เมื่อเอกสารนั้นใช้งานอยู่ในทะเบียนกลางเท่านั้น</p>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" icon={exportIcon} onClick={() => csv("ข้อกำหนดเฉพาะลูกค้า", ["ลูกค้า", "ข้อ", "ข้อกำหนด", "เอกสาร", "สถานะ", "ผู้รับผิดชอบ"], CSRS.map((c) => [customerName(c.customer), c.clause, c.requirement, c.doc ?? "", c.status, c.owner]))}>ส่งออก Excel</Button>
              <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "csr", customer: automotiveCustomers()[0] }, title: "ตารางข้อกำหนดเฉพาะลูกค้า" })}>พิมพ์</Button>
              <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "csr-new" })}>เพิ่มข้อกำหนด</Button>
            </div>
          </div>
        }
      />
    </div>
  );
}

/* ---------------------------------------------------------------- safety */

function Safety({ onAct }: Handlers) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ชิ้นส่วนที่เกี่ยวกับความปลอดภัย · ผู้แทนความปลอดภัยผลิตภัณฑ์ {PSR} · ทุกข้ออ่านจาก Core Tools และทะเบียนความสามารถ</p>
        <Button className="ml-auto" icon={<Route size={14} />} onClick={() => onAct({ kind: "trace-new" })}>ทดสอบการสอบกลับ</Button>
      </div>
      {safetyParts().map((p) => {
        const checks = safetyChecks(p.code);
        const fail = checks.filter((c) => !c.ok).length;
        return (
          <Card key={p.code} title={`${p.code} · ${p.customerPart}`} subtitle={`${customerName(p.customer)} · ${p.program}`} action={fail ? <Badge tone="bad">ยังไม่ผ่าน {fail} ข้อ</Badge> : <Badge tone="ok">พร้อมส่งมอบ</Badge>}>
            <Lines>
              {checks.map((c) => <Line key={c.item} title={c.item} sub={c.why} subTone={c.ok ? undefined : "bad"} right={<Badge tone={c.ok ? "ok" : "bad"}>{c.ok ? "ผ่าน" : "ไม่ผ่าน"}</Badge>} />)}
            </Lines>
          </Card>
        );
      })}
      <Card title="ทดสอบการสอบกลับ" subtitle={`จากชิ้นงานถึงล็อตวัตถุดิบ ลูกค้ากำหนดไม่เกิน ${TRACE_LIMIT_MINUTES / 60} ชั่วโมง`}>
        {TRACE_DRILLS.length === 0 ? <Empty>ยังไม่เคยทดสอบ</Empty> : (
          <Lines>
            {[...TRACE_DRILLS].reverse().map((d) => <Line key={d.no} title={`${d.no} · ${d.lot}`} sub={`${d.date} · ${d.tracedTo} · ${d.by}`} right={<Badge tone={d.minutes <= TRACE_LIMIT_MINUTES ? "ok" : "bad"}>{d.minutes} นาที</Badge>} />)}
          </Lines>
        )}
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- contingency */

function Contingencies({ onAct, onOpen }: Handlers) {
  const columns: Column<Contingency>[] = [
    { key: "code", header: "รหัส", cell: (c) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-100">{c.code}</span> },
    { key: "scenario", header: "สถานการณ์", cell: (c) => c.scenario },
    { key: "impact", header: "กระทบลูกค้าภายใน", align: "right", cell: (c) => <span className="tabular-nums">{c.impactDays} วัน</span> },
    { key: "owner", header: "ผู้รับผิดชอบ", cell: (c) => c.owner },
    { key: "test", header: "ทดสอบล่าสุด", cell: (c) => (lastTest(c) ? `${lastTest(c)!.date} ${lastTest(c)!.result}` : "ยังไม่เคย") },
    { key: "status", header: "สถานะ", cell: (c) => (testDue(c) ? <Badge tone="warn">ต้องทดสอบ</Badge> : <Badge tone="ok">พร้อม</Badge>) },
  ];
  return (
    <DataTable
      rows={CONTINGENCIES}
      columns={columns}
      getId={(c) => c.code}
      onOpen={(c) => onOpen("contingency", c.code)}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400">แผนสำหรับเหตุที่ทำให้ส่งมอบลูกค้าไม่ได้ · ต้องทดสอบอย่างน้อยปีละครั้งและครั้งล่าสุดต้องผ่าน</p>
          <Button className="ml-auto" variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "contingency", code: CONTINGENCIES[0].code }, title: "แผนฉุกเฉินทางธุรกิจ" })}>พิมพ์</Button>
        </div>
      }
    />
  );
}

/* -------------------------------------------------------- supplier audit */

function SupplierAudits({ onAct, onOpen }: Handlers) {
  const columns: Column<SupplierAudit>[] = [
    { key: "no", header: "เลขที่", cell: (a) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-100">{a.no}</span> },
    { key: "vendor", header: "ผู้ส่งมอบ", cell: (a) => vendorName(a.vendor) },
    { key: "date", header: "วันที่", cell: (a) => a.performedOn ?? `แผน ${a.planned}` },
    { key: "auditor", header: "ผู้ตรวจ", cell: (a) => a.auditor },
    { key: "score", header: "คะแนน", align: "right", cell: (a) => (a.score !== undefined ? <span className="tabular-nums">{a.score}%</span> : "—") },
    { key: "grade", header: "ผล", cell: (a) => (a.score !== undefined ? <span className="flex gap-1.5"><Badge tone={gradeTone(grade(a.score))}>เกรด {grade(a.score)}</Badge>{carOf(a.no) && <Badge tone="info">{carOf(a.no)!.no}</Badge>}</span> : <Badge tone="idle">{a.status}</Badge>) },
  ];
  return (
    <div className="space-y-4">
      <Card title="ใบรับรองระบบของผู้ส่งมอบ" subtitle="ผู้ส่งมอบต้องได้ ISO 9001 เป็นอย่างน้อยและมุ่งสู่ IATF 16949 (8.4.2.3)">
        <Lines>
          {CERTS.map((c) => <Line key={c.vendor} title={vendorName(c.vendor)} sub={c.standard === "ไม่มี" ? "ไม่มีใบรับรอง — ต้องตรวจประเมินและมีแผนพัฒนา" : `${c.standard} · ${c.certNo} · ถึง ${c.validUntil}`} right={<Badge tone={certified(c.vendor) ? (c.standard === "IATF 16949" ? "ok" : "info") : "bad"}>{certified(c.vendor) ? c.standard : "ไม่ผ่าน"}</Badge>} />)}
        </Lines>
      </Card>
      <DataTable
        rows={SUPPLIER_AUDITS}
        columns={columns}
        getId={(a) => a.no}
        onOpen={(a) => onOpen("supplier-audit", a.no)}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ตรวจกระบวนการตาม VDA 6.3 · ผู้ตรวจต้องผ่าน VDA 6.3 และ Core Tools · เกรด C เปิด 8D ให้ผู้ส่งมอบพัฒนา</p>
            <Button className="ml-auto" icon={<Plus size={14} />} onClick={() => onAct({ kind: "supplier-audit-new" })}>วางแผนตรวจ</Button>
          </div>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------- scorecard */

function Scorecards({ onAct }: Handlers) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ตัวเลขที่ลูกค้ารายงานวางคู่กับที่ระบบคุณภาพนับเอง · เขียว PPM ≤ 50 ส่งตรงเวลา ≥ 98% · แดงเปิด 8D ทันที</p>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" icon={exportIcon} onClick={() => csv("Scorecard ลูกค้า", ["ลูกค้า", "เดือน", "PPM", "ส่งตรงเวลา", "ขนส่งด่วน", "กระทบสายการผลิต", "ระดับ"], SCORECARDS.map((s) => [customerName(s.customer), s.month, s.ppm, s.delivery, s.premiumFreight, s.disruptions, rating(s)]))}>ส่งออก Excel</Button>
          <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "scorecard-new" })}>บันทึก scorecard</Button>
        </div>
      </div>
      <Card title="Scorecard รายเดือน">
        <Lines>
          {[...SCORECARDS].reverse().map((s) => {
            const ours = ourPpm(s.customer, s.month);
            const car = carOf(`SC ${s.customer} ${s.month}`);
            return (
              <Line
                key={`${s.customer}-${s.month}`}
                title={`${s.month} · ${customerName(s.customer)}`}
                sub={`PPM ${s.ppm} (${ours.shipped ? `ระบบเรานับ ${ours.ppm} จาก ${ours.shipped.toLocaleString()} ชิ้น` : "ระบบขายไม่มีใบส่งของเดือนนี้"}) · ส่งตรงเวลา ${s.delivery}% · ขนส่งด่วน ${s.premiumFreight} · กระทบสายการผลิต ${s.disruptions}${car ? ` · ${car.no}` : ""}`}
                right={<Badge dot tone={ratingTone(rating(s))}>{rating(s)}</Badge>}
              />
            );
          })}
        </Lines>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------- poka-yoke */

function Devices({ onAct, onOpen }: Handlers) {
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-slate-500 dark:text-slate-400">ทวนสอบด้วยชิ้นต้นแบบเสียทุกกะก่อนผลิต (10.2.4) · ไม่จับคือหยุดใช้ ตรวจ 100% ด้วยมือ และเปิด CAR</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {DEVICES.map((d) => (
          <Card key={d.code} title={`${d.code} · ${d.name}`} subtitle={`${d.part} ขั้นตอน ${d.op} · ป้องกัน${d.prevents}`} action={<Button variant="ghost" onClick={() => onOpen("device", d.code)}>เปิด</Button>}>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <Badge dot tone={d.status === "ใช้งาน" ? "ok" : "bad"}>{d.status}</Badge>
              {SHIFTS.map((s) => {
                const c = d.checks.find((x) => x.date === TODAY && x.shift === s);
                return c ? <Chip key={s}>กะ{s} {c.ok ? "จับได้" : "ไม่จับ"}</Chip> : d.status === "ใช้งาน" ? <Button key={s} variant="secondary" icon={<ScanLine size={14} />} onClick={() => onAct({ kind: "device-verify", code: d.code, shift: s })}>ทวนสอบกะ{s}</Button> : null;
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- records */

function RecordView({ kind, id, ...h }: { kind: RecordKind; id: string } & Handlers) {
  if (kind === "contingency") return <ContingencyRecord c={contingencyByCode(id)} {...h} />;
  if (kind === "supplier-audit") return <AuditRecord a={supplierAuditByNo(id)} {...h} />;
  return <DeviceRecord d={deviceByCode(id)} {...h} />;
}

function ContingencyRecord({ c, onAct }: { c: Contingency } & Handlers) {
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${c.code} · ${c.scenario}`}
        meta={`กระทบลูกค้าภายใน ${c.impactDays} วัน · ${c.owner}${c.risk ? ` · ${c.risk}` : ""}`}
        badges={testDue(c) ? <Badge tone="warn">ต้องทดสอบ</Badge> : <Badge tone="ok">ทดสอบผ่านในรอบปี</Badge>}
        actions={
          <>
            <Button icon={<LifeBuoy size={14} />} onClick={() => onAct({ kind: "contingency-test", code: c.code })}>บันทึกผลทดสอบ</Button>
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "contingency", code: c.code }, title: "แผนฉุกเฉินทางธุรกิจ" })}>พิมพ์</Button>
          </>
        }
      />
      <Body>
        <Card title="สิ่งที่ต้องทำ"><Lines>{c.actions.map((a, i) => <Line key={a} title={`${i + 1}. ${a}`} />)}</Lines></Card>
        <Card title="ประวัติการทดสอบ">
          {c.tests.length === 0 ? <Empty>ยังไม่เคยทดสอบ</Empty> : <Lines>{[...c.tests].reverse().map((t, i) => <Line key={i} title={`${t.date} · ${t.by}`} sub={t.note} right={<Badge tone={t.result === "ผ่าน" ? "ok" : "warn"}>{t.result}</Badge>} />)}</Lines>}
        </Card>
      </Body>
    </div>
  );
}

function AuditRecord({ a, onAct }: { a: SupplierAudit } & Handlers) {
  const car = carOf(a.no);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${a.no} · ${vendorName(a.vendor)}`}
        meta={`${a.performedOn ?? `แผน ${a.planned}`} · ผู้ตรวจ ${a.auditor} · VDA 6.3`}
        badges={<>{a.score !== undefined ? <Badge tone={gradeTone(grade(a.score))}>{a.score}% เกรด {grade(a.score)}</Badge> : <Badge tone="idle">{a.status}</Badge>}{car && <Badge tone="info">{car.no} {car.status}</Badge>}</>}
        actions={
          <>
            {a.status === "ตามแผน" && <Button icon={<ClipboardCheck size={14} />} onClick={() => onAct({ kind: "supplier-audit-close", no: a.no })}>บันทึกผลตรวจ</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "supplier-audit", no: a.no }, title: "รายงานการตรวจประเมินผู้ส่งมอบ" })}>พิมพ์</Button>
          </>
        }
      />
      <Body>
        <Card title="ใบรับรองระบบ"><Lines><Line title={certOf(a.vendor).standard} sub={certOf(a.vendor).certNo ? `${certOf(a.vendor).certNo} ถึง ${certOf(a.vendor).validUntil}` : "ไม่มีใบรับรอง"} right={<Badge tone={certified(a.vendor) ? "ok" : "bad"}>{certified(a.vendor) ? "ใช้ได้" : "ไม่ผ่าน"}</Badge>} /></Lines></Card>
        <Card title="สิ่งที่พบ"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{a.findings ?? "ยังไม่ได้ตรวจ"}</p></Card>
      </Body>
    </div>
  );
}

function DeviceRecord({ d, onAct }: { d: Device } & Handlers) {
  const failed = [...d.checks].reverse().find((c) => !c.ok);
  const car = failed ? carOf(`${d.code} ${failed.date} ${failed.shift}`) : undefined;
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${d.code} · ${d.name}`}
        meta={`${d.part} ขั้นตอน ${d.op} · ชิ้นทดสอบ ${d.master}`}
        badges={<><Badge dot tone={d.status === "ใช้งาน" ? "ok" : "bad"}>{d.status}</Badge>{car && <Badge tone={car.status === "ปิดแล้ว" ? "ok" : "warn"}>{car.no} {car.status}</Badge>}</>}
        actions={
          <>
            {d.status === "ใช้งาน" && <Button icon={<ScanLine size={14} />} onClick={() => onAct({ kind: "device-verify", code: d.code })}>ทวนสอบ</Button>}
            {d.status === "หยุดใช้" && <Button icon={<RotateCcw size={14} />} onClick={() => run(() => restoreDevice(d.code), `นำ ${d.code} กลับมาใช้แล้ว`)}>นำกลับมาใช้</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "device", code: d.code }, title: "ใบทวนสอบอุปกรณ์ป้องกันความผิดพลาด" })}>พิมพ์</Button>
          </>
        }
      />
      <Body>
        {d.status === "หยุดใช้" && <Note tone="bad">หยุดใช้ — ตรวจ 100% ด้วยมือแทน นำกลับมาใช้ได้เมื่อปิด {car?.no ?? "CAR"} แล้ว</Note>}
        <Card title="ป้องกัน"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{d.prevents}</p></Card>
        <Card title="ผลทวนสอบล่าสุด">
          <Lines>
            {[...d.checks].reverse().slice(0, 10).map((c, i) => <Line key={i} title={`${c.date} กะ${c.shift}`} sub={[c.by, c.note].filter(Boolean).join(" · ")} subTone={c.ok ? undefined : "bad"} right={<Badge tone={c.ok ? "ok" : "bad"}>{c.ok ? "จับได้" : "ไม่จับ"}</Badge>} />)}
          </Lines>
        </Card>
      </Body>
    </div>
  );
}


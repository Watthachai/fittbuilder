import { useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, ClipboardCheck, Cog, FileSpreadsheet, Gauge, Hammer, PackageOpen, Plus, Printer, ShoppingCart, Wrench } from "lucide-react";
import { TODAY } from "../ims/data";
import { Body, Empty, Header, Line, Lines, run } from "../ims/parts";
import { MATERIALS } from "../mm/data";
import {
  HOURS_PER_DAY, MACHINES, PLANS, PM_RECORDS, REQUESTS, SPARES, WINDOW_DAYS, machineByCode, oeeAll, openRequests, openRequisition,
  planByCode, pmDue, pmOverdue, pmSoon, reliability, requestByNo, requestSpare, spareNeeds, sparesBelow, wcName,
} from "./data";
import type { Machine, PmPlan, WorkRequest } from "./data";
import { TpmActions } from "./forms";
import type { Act, RecordKind } from "./forms";
import { Badge, Button, Card, Chip, Metric, Note, PageHead, Reveal } from "../ui";
import type { Tone } from "../ui";
import { DataTable, DetailModal, downloadCsv, notify, useData } from "../kit";
import type { Column } from "../kit";

const TABS = ["ทะเบียนเครื่องจักร", "แผนบำรุงรักษาเชิงป้องกัน", "แจ้งซ่อม", "ประสิทธิผลเครื่องจักร (OEE)", "อะไหล่วิกฤต"];

const exportIcon = <FileSpreadsheet size={14} />;
const csv = (name: string, head: string[], rows: (string | number)[][]) => {
  downloadCsv(name, head, rows);
  notify(`ส่งออก${name} ${rows.length} รายการแล้ว`);
};
const statusTone = (s: string): Tone => (s === "ใช้งาน" || s === "ซ่อมเสร็จ" ? "ok" : s === "กำลังซ่อม" ? "info" : s === "หยุดใช้" ? "idle" : "bad");
const oeeTone = (v?: number): Tone => (v === undefined ? "idle" : v >= 85 ? "ok" : v >= 60 ? "warn" : "bad");
const pct = (v?: number) => (v === undefined ? "—" : `${v}%`);
const materialName = (code: string) => MATERIALS.find((m) => m.code === code)?.name ?? code;

type Handlers = { onAct: (a: Act) => void; onOpen: (kind: RecordKind, key: string) => void };

export default function TpmScreen({ section, onOpenSection }: { section?: string; onOpenSection?: (index: number) => void }) {
  useData();
  const tab = section && TABS.includes(section) ? section : undefined;
  const [act, setAct] = useState<Act | null>(null);
  const [record, setRecord] = useState<{ kind: RecordKind; key: string } | null>(null);
  const open = (kind: RecordKind, key: string) => setRecord({ kind, key });

  const keys: Record<RecordKind, string[]> = { machine: MACHINES.map((m) => m.code), request: REQUESTS.map((r) => r.no) };
  const list = record ? keys[record.kind] : [];
  const at = record ? list.indexOf(record.key) : -1;
  const TITLES: Record<RecordKind, string> = { machine: "เครื่องจักร", request: "ใบแจ้งซ่อม" };
  const h: Handlers = { onAct: setAct, onOpen: open };
  const waiting = REQUESTS.find((r) => r.status === "รอซ่อม") ?? REQUESTS[REQUESTS.length - 1];
  const die = MACHINES.find((m) => m.kind === "แม่พิมพ์") ?? MACHINES[0];

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
      <TpmActions act={act} onAct={setAct} onOpen={open} />
    </>
  );

  const index = (
    <div hidden data-fitt-index>
      <button data-fitt-screen="บำรุงรักษาเครื่องจักร" />
      <button data-fitt-screen="เครื่องจักร" data-fitt-modal onClick={() => open("machine", MACHINES[0].code)} />
      <button data-fitt-screen="ขึ้นทะเบียนเครื่องจักร" data-fitt-modal onClick={() => setAct({ kind: "machine-new" })} />
      <button data-fitt-screen="บันทึกมิเตอร์แม่พิมพ์" data-fitt-modal onClick={() => setAct({ kind: "shots", code: die.code })} />
      <button data-fitt-screen="บันทึกผลบำรุงรักษา" data-fitt-modal onClick={() => setAct({ kind: "pm-record", code: PLANS[0].code })} />
      <button data-fitt-screen="ใบแจ้งซ่อม" data-fitt-modal onClick={() => open("request", REQUESTS[0].no)} />
      <button data-fitt-screen="แจ้งซ่อม" data-fitt-modal onClick={() => setAct({ kind: "breakdown" })} />
      <button data-fitt-screen="เริ่มซ่อม" data-fitt-modal onClick={() => setAct({ kind: "repair-start", no: waiting.no })} />
      <button data-fitt-screen="ปิดงานซ่อม" data-fitt-modal onClick={() => setAct({ kind: "repair-complete", no: waiting.no })} />
      <button data-fitt-screen="เพิ่มอะไหล่วิกฤต" data-fitt-modal onClick={() => setAct({ kind: "spare-new" })} />
      <button data-fitt-screen="พิมพ์ใบตรวจเช็ค PM" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "pm", code: PLANS[0].code }, title: "ใบตรวจเช็คบำรุงรักษาเชิงป้องกัน" })} />
      <button data-fitt-screen="พิมพ์ใบแจ้งซ่อม" data-fitt-modal onClick={() => setAct({ kind: "print", d: { doc: "request", no: REQUESTS[0].no }, title: "ใบแจ้งซ่อมและรายงานการซ่อม" })} />
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
      <PageHead title="บำรุงรักษาเครื่องจักร" meta={`${tab} · IATF 16949 ข้อ 8.5.1.5 · ข้อมูล ณ ${TODAY}`} />
      {tab === TABS[0] && <Machines {...h} />}
      {tab === TABS[1] && <Plans {...h} />}
      {tab === TABS[2] && <Requests {...h} />}
      {tab === TABS[3] && <Oee />}
      {tab === TABS[4] && <Spares {...h} />}
      {panels}
      {index}
    </div>
  );
}

/* -------------------------------------------------------------- overview */

function Overview({ onOpenSection, onAct, onOpen }: Handlers & { onOpenSection?: (i: number) => void }) {
  const measured = oeeAll().filter((x) => x.oee !== undefined);
  const avg = measured.length ? Math.round((measured.reduce((n, x) => n + x.oee!, 0) / measured.length) * 10) / 10 : undefined;
  const down = MACHINES.filter((m) => m.status === "รอซ่อม" || m.status === "กำลังซ่อม");

  const todo: { icon: ReactNode; text: string; sub: string; go: () => void; tone: Tone }[] = [
    ...openRequests().map((r) => ({ icon: <Hammer size={15} />, text: `${r.no} ${machineByCode(r.machine).name}`, sub: `${r.status} · ${r.symptom}`, go: () => onOpen("request", r.no), tone: (machineByCode(r.machine).critical ? "bad" : "warn") as Tone })),
    ...pmOverdue().map((p) => ({ icon: <CalendarClock size={15} />, text: `${p.code} ${p.task}`, sub: `${machineByCode(p.machine).name} · ${pmDue(p).label} · เลยกำหนด`, go: () => onAct({ kind: "pm-record", code: p.code }), tone: "bad" as Tone })),
    ...pmSoon().map((p) => ({ icon: <CalendarClock size={15} />, text: `${p.code} ${p.task}`, sub: `${machineByCode(p.machine).name} · ${pmDue(p).label}`, go: () => onAct({ kind: "pm-record", code: p.code }), tone: "warn" as Tone })),
    ...sparesBelow().map((s) => ({ icon: <PackageOpen size={15} />, text: `${s.name} ต่ำกว่าขั้นต่ำ`, sub: `คงเหลือ ${s.stock} จากขั้นต่ำ ${s.min}${openRequisition(s.material) ? ` · มี ${openRequisition(s.material)!.no} แล้ว` : ""}`, go: () => onOpenSection?.(4), tone: (openRequisition(s.material) ? "warn" : "bad") as Tone })),
  ];

  return (
    <div>
      <PageHead
        title="บำรุงรักษาเครื่องจักร"
        meta={`ทะเบียน · PM · แจ้งซ่อม · OEE · อะไหล่วิกฤต · ข้อมูล ณ ${TODAY}`}
        right={<Button icon={<Wrench size={14} />} onClick={() => onAct({ kind: "breakdown" })}>แจ้งซ่อม</Button>}
      />
      <Reveal>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric icon={<Gauge size={17} />} label="OEE เฉลี่ย 14 วัน" value={pct(avg)} deltaLabel={`${measured.length} ศูนย์งานที่มีการผลิต`} />
          <Metric icon={<AlertTriangle size={17} />} label="เครื่องหยุดอยู่" value={`${down.length} เครื่อง`} deltaLabel={down.filter((m) => m.critical).length ? `เครื่องหลัก ${down.filter((m) => m.critical).length}` : "ไม่มีเครื่องหลัก"} />
          <Metric icon={<CalendarClock size={17} />} label="PM เลยกำหนด" value={`${pmOverdue().length} แผน`} deltaLabel={`ใกล้ถึง ${pmSoon().length} แผน`} />
          <Metric icon={<PackageOpen size={17} />} label="อะไหล่ต่ำกว่าขั้นต่ำ" value={`${sparesBelow().length} รายการ`} deltaLabel={`จาก ${spareNeeds().length} รายการวิกฤต`} />
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
        <Card title="OEE ตามศูนย์งาน" subtitle="ความพร้อม × ประสิทธิภาพ × คุณภาพ" action={<Button variant="ghost" className="whitespace-nowrap" onClick={() => onOpenSection?.(3)}>รายละเอียด</Button>}>
          <Lines>
            {oeeAll().map((o) => <Line key={o.wc} title={o.name} sub={o.runs ? `${o.runs} การยืนยันงาน · หยุด ${o.downtime} ชม.` : "ไม่มีการผลิตใน 14 วัน"} right={<Badge tone={oeeTone(o.oee)}>{pct(o.oee)}</Badge>} />)}
          </Lines>
        </Card>
      </Reveal>
    </div>
  );
}

/* -------------------------------------------------------------- machines */

function Machines({ onAct, onOpen }: Handlers) {
  const columns: Column<Machine>[] = [
    { key: "code", header: "รหัส", cell: (m) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-100">{m.code}</span> },
    { key: "name", header: "ชื่อ", cell: (m) => <span className="flex items-center gap-1.5">{m.name}{m.critical && <Chip>เครื่องหลัก</Chip>}</span> },
    { key: "kind", header: "ประเภท", cell: (m) => m.kind },
    { key: "wc", header: "ศูนย์งาน", cell: (m) => wcName(m.wc) },
    { key: "mtbf", header: "MTBF", align: "right", cell: (m) => <span className="tabular-nums">{reliability(m.code).mtbf !== undefined ? `${reliability(m.code).mtbf} ชม.` : "—"}</span> },
    { key: "mttr", header: "MTTR", align: "right", cell: (m) => <span className="tabular-nums">{reliability(m.code).mttr !== undefined ? `${reliability(m.code).mttr} ชม.` : "—"}</span> },
    { key: "status", header: "สถานะ", cell: (m) => <Badge dot tone={statusTone(m.status)}>{m.status}</Badge> },
  ];
  return (
    <DataTable
      rows={MACHINES}
      columns={columns}
      getId={(m) => m.code}
      onOpen={(m) => onOpen("machine", m.code)}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400">MTBF และ MTTR จากใบแจ้งซ่อม {WINDOW_DAYS} วัน วันละ {HOURS_PER_DAY} ชั่วโมง · เครื่องหลักคือหยุดแล้วกระทบการส่งมอบลูกค้า</p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" icon={exportIcon} onClick={() => csv("ทะเบียนเครื่องจักร", ["รหัส", "ชื่อ", "ประเภท", "ศูนย์งาน", "เครื่องหลัก", "ยี่ห้อ", "ติดตั้ง", "สถานะ"], MACHINES.map((m) => [m.code, m.name, m.kind, wcName(m.wc), m.critical ? "ใช่" : "", m.maker, m.installed, m.status]))}>ส่งออก Excel</Button>
            <Button icon={<Plus size={14} />} onClick={() => onAct({ kind: "machine-new" })}>ขึ้นทะเบียน</Button>
          </div>
        </div>
      }
    />
  );
}

/* ----------------------------------------------------------------- plans */

function PlanLines({ plans, onAct }: { plans: PmPlan[]; onAct: (a: Act) => void }) {
  return (
    <Lines>
      {plans.map((p) => {
        const due = pmDue(p);
        return (
          <Line
            key={p.code}
            title={`${p.code} · ${p.task}`}
            sub={`${machineByCode(p.machine).name} · ${p.everyShots ? `ทุก ${p.everyShots.toLocaleString("th-TH")} ครั้งปั๊ม` : `ทุก ${p.everyDays} วัน`} · ${due.label}`}
            subTone={due.late ? "bad" : undefined}
            right={
              <span className="flex items-center gap-2">
                <Badge tone={due.late ? "bad" : due.soon ? "warn" : "ok"}>{due.late ? "เลยกำหนด" : due.soon ? "ใกล้ถึง" : "ปกติ"}</Badge>
                <Button variant="secondary" icon={<ClipboardCheck size={14} />} onClick={() => onAct({ kind: "pm-record", code: p.code })}>บันทึกผล</Button>
                <Button variant="ghost" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "pm", code: p.code }, title: "ใบตรวจเช็คบำรุงรักษาเชิงป้องกัน" })}>พิมพ์</Button>
              </span>
            }
          />
        );
      })}
    </Lines>
  );
}

function Plans({ onAct }: Handlers) {
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-slate-500 dark:text-slate-400">PM ช่างซ่อมบำรุงทำตามรอบวันหรือรอบครั้งปั๊ม · AM ผู้ควบคุมเครื่องทำเองทุกกะ · บันทึกผลแล้วเริ่มรอบใหม่</p>
      <Card title="บำรุงรักษาเชิงป้องกัน (PM)" subtitle="ช่างซ่อมบำรุง"><PlanLines plans={PLANS.filter((p) => p.type === "PM")} onAct={onAct} /></Card>
      <Card title="บำรุงรักษาด้วยตนเอง (AM)" subtitle="ผู้ควบคุมเครื่อง"><PlanLines plans={PLANS.filter((p) => p.type === "AM")} onAct={onAct} /></Card>
    </div>
  );
}

/* -------------------------------------------------------------- requests */

function Requests({ onAct, onOpen }: Handlers) {
  const columns: Column<WorkRequest>[] = [
    { key: "no", header: "เลขที่", cell: (r) => <span className="whitespace-nowrap font-medium tabular-nums text-slate-800 dark:text-slate-100">{r.no}</span> },
    { key: "machine", header: "เครื่องจักร", cell: (r) => machineByCode(r.machine).name },
    { key: "symptom", header: "อาการ", cell: (r) => r.symptom },
    { key: "date", header: "แจ้งเมื่อ", cell: (r) => r.reportedOn },
    { key: "down", header: "หยุด", align: "right", cell: (r) => <span className="tabular-nums">{r.downtimeHrs !== undefined ? `${r.downtimeHrs} ชม.` : "—"}</span> },
    { key: "status", header: "สถานะ", cell: (r) => <Badge dot tone={statusTone(r.status)}>{r.status}</Badge> },
  ];
  return (
    <DataTable
      rows={[...REQUESTS].reverse()}
      columns={columns}
      getId={(r) => r.no}
      onOpen={(r) => onOpen("request", r.no)}
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400">แจ้งซ่อมแล้วเครื่องเปลี่ยนเป็นรอซ่อม · อะไหล่ที่ใช้เบิกจากคลังวัสดุ · เวลาหยุดเข้า OEE MTBF MTTR</p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" icon={exportIcon} onClick={() => csv("ใบแจ้งซ่อม", ["เลขที่", "เครื่อง", "อาการ", "แจ้ง", "ช่าง", "หยุด (ชม.)", "สาเหตุ", "สิ่งที่ทำ", "สถานะ"], REQUESTS.map((r) => [r.no, r.machine, r.symptom, r.reportedOn, r.technician ?? "", r.downtimeHrs ?? "", r.cause ?? "", r.fix ?? "", r.status]))}>ส่งออก Excel</Button>
            <Button icon={<Wrench size={14} />} onClick={() => onAct({ kind: "breakdown" })}>แจ้งซ่อม</Button>
          </div>
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------------- oee */

function Oee() {
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-slate-500 dark:text-slate-400">14 วันล่าสุด · ความพร้อม = (กำลังการผลิต − เวลาหยุดจากใบแจ้งซ่อม) ÷ กำลังการผลิต · ประสิทธิภาพ = เวลามาตรฐาน ÷ เวลาจริงจากการยืนยันงาน · คุณภาพ = ของดี ÷ ทั้งหมด · ระดับโลก 85%</p>
      <div className="grid gap-4 md:grid-cols-2">
        {oeeAll().map((o) => (
          <Card key={o.wc} title={o.name} subtitle={`${o.wc} · ${o.runs} การยืนยันงาน · หยุด ${o.downtime} ชม.`} action={<Badge tone={oeeTone(o.oee)}>OEE {pct(o.oee)}</Badge>}>
            <div className="grid grid-cols-3 gap-3 p-4">
              {[["ความพร้อม", o.availability], ["ประสิทธิภาพ", o.performance], ["คุณภาพ", o.quality]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
                  <p className="text-[11.5px] text-slate-500">{k}</p>
                  <p className="text-[18px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{pct(v as number | undefined)}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- spares */

function Spares({ onAct }: Handlers) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12.5px] text-slate-500 dark:text-slate-400">คงเหลืออ่านจากคลังวัสดุ · ขั้นต่ำรวมทุกเครื่องที่ใช้อะไหล่ชิ้นนั้น · ต่ำกว่าขั้นต่ำเปิดใบขอซื้อในระบบจัดซื้อได้ทันที</p>
        <Button className="ml-auto" icon={<Plus size={14} />} onClick={() => onAct({ kind: "spare-new" })}>เพิ่มอะไหล่วิกฤต</Button>
      </div>
      <Card title="อะไหล่วิกฤต">
        <Lines>
          {spareNeeds().map((s) => {
            const pr = openRequisition(s.material);
            const low = s.stock < s.min;
            return (
              <Line
                key={s.material}
                title={`${s.material} · ${s.name}`}
                sub={`ใช้กับ ${s.machines.map((c) => machineByCode(c).name).join(", ")} · คงเหลือ ${s.stock} ขั้นต่ำ ${s.min}${pr ? ` · ${pr.no} ${pr.status}` : ""}`}
                subTone={low && !pr ? "bad" : undefined}
                right={
                  <span className="flex items-center gap-2">
                    <Badge tone={low ? (pr ? "warn" : "bad") : "ok"}>{low ? "ต่ำกว่าขั้นต่ำ" : "พอ"}</Badge>
                    {low && !pr && <Button variant="secondary" icon={<ShoppingCart size={14} />} onClick={() => run(() => requestSpare(s.material), `เปิดใบขอซื้อ${s.name}ในระบบจัดซื้อแล้ว`)}>ขอซื้อ</Button>}
                  </span>
                }
              />
            );
          })}
        </Lines>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------- records */

function RecordView({ kind, id, ...h }: { kind: RecordKind; id: string } & Handlers) {
  if (kind === "machine") return <MachineRecord m={machineByCode(id)} {...h} />;
  return <RequestRecord r={requestByNo(id)} {...h} />;
}

function MachineRecord({ m, onAct, onOpen }: { m: Machine } & Handlers) {
  const rel = reliability(m.code);
  const plans = PLANS.filter((p) => p.machine === m.code);
  const history = REQUESTS.filter((r) => r.machine === m.code).reverse();
  const spares = SPARES.filter((s) => s.machine === m.code);
  const open = history.find((r) => r.status !== "ซ่อมเสร็จ");
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${m.code} · ${m.name}`}
        meta={`${m.kind} · ${wcName(m.wc)} · ${m.maker} · ติดตั้ง ${m.installed}`}
        badges={<><Badge dot tone={statusTone(m.status)}>{m.status}</Badge>{m.critical && <Badge tone="info">เครื่องหลัก</Badge>}{m.shots !== undefined && <Badge tone="idle">{m.shots.toLocaleString("th-TH")} ครั้งปั๊ม</Badge>}</>}
        actions={
          <>
            {!open && <Button icon={<Wrench size={14} />} onClick={() => onAct({ kind: "breakdown", machine: m.code })}>แจ้งซ่อม</Button>}
            {open && <Button icon={<Hammer size={14} />} onClick={() => onOpen("request", open.no)}>เปิด {open.no}</Button>}
            {m.kind === "แม่พิมพ์" && <Button variant="secondary" icon={<Cog size={14} />} onClick={() => onAct({ kind: "shots", code: m.code })}>บันทึกมิเตอร์</Button>}
          </>
        }
      />
      <Body>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label={`เสีย ${WINDOW_DAYS} วัน`} value={`${rel.failures} ครั้ง`} deltaLabel={`หยุดรวม ${rel.downtime} ชม.`} />
          <Metric label="MTBF" value={rel.mtbf !== undefined ? `${rel.mtbf} ชม.` : "—"} />
          <Metric label="MTTR" value={rel.mttr !== undefined ? `${rel.mttr} ชม.` : "—"} />
        </div>
        <Card title="แผนบำรุงรักษา">{plans.length ? <PlanLines plans={plans} onAct={onAct} /> : <Empty>ยังไม่มีแผน</Empty>}</Card>
        {spares.length > 0 && <Card title="อะไหล่วิกฤต"><Lines>{spares.map((s) => <Line key={s.material} title={`${s.material} · ${materialName(s.material)}`} sub={`ขั้นต่ำสำหรับเครื่องนี้ ${s.min}`} />)}</Lines></Card>}
        <Card title="ประวัติการซ่อม">
          {history.length === 0 ? <Empty>ยังไม่เคยเสีย</Empty> : <Lines>{history.map((r) => <Line key={r.no} title={`${r.no} · ${r.symptom}`} sub={`${r.reportedOn}${r.cause ? ` · ${r.cause}` : ""}`} right={<Badge tone={statusTone(r.status)}>{r.status}</Badge>} />)}</Lines>}
        </Card>
        <Card title="บันทึก PM ล่าสุด">
          <Lines>{PM_RECORDS.filter((x) => planByCode(x.plan).machine === m.code).reverse().slice(0, 5).map((x, i) => <Line key={i} title={`${x.plan} · ${x.date}`} sub={[x.by, x.findings].filter(Boolean).join(" · ")} right={<Badge tone={x.checked.every(Boolean) ? "ok" : "warn"}>{x.checked.filter(Boolean).length}/{x.checked.length}</Badge>} />)}</Lines>
        </Card>
      </Body>
    </div>
  );
}

function RequestRecord({ r, onAct }: { r: WorkRequest } & Handlers) {
  const m = machineByCode(r.machine);
  return (
    <div className="flex h-full flex-col">
      <Header
        title={`${r.no} · ${m.name}`}
        meta={`แจ้งโดย ${r.reportedBy} ${r.reportedOn}${r.technician ? ` · ช่าง ${r.technician}` : ""}`}
        badges={<><Badge dot tone={statusTone(r.status)}>{r.status}</Badge>{m.critical && <Badge tone="info">เครื่องหลัก</Badge>}{r.downtimeHrs !== undefined && <Badge tone="idle">หยุด {r.downtimeHrs} ชม.</Badge>}</>}
        actions={
          <>
            {r.status === "รอซ่อม" && <Button icon={<Hammer size={14} />} onClick={() => onAct({ kind: "repair-start", no: r.no })}>เริ่มซ่อม</Button>}
            {r.status === "กำลังซ่อม" && <Button icon={<ClipboardCheck size={14} />} onClick={() => onAct({ kind: "repair-complete", no: r.no })}>ปิดงานซ่อม</Button>}
            <Button variant="secondary" icon={<Printer size={14} />} onClick={() => onAct({ kind: "print", d: { doc: "request", no: r.no }, title: "ใบแจ้งซ่อมและรายงานการซ่อม" })}>พิมพ์</Button>
          </>
        }
      />
      <Body>
        {r.status !== "ซ่อมเสร็จ" && m.critical && <Note tone="warn">เครื่องหลัก — หยุดนานกระทบการส่งมอบลูกค้า แจ้งฝ่ายวางแผนการผลิตให้จัดลำดับงานใหม่</Note>}
        <Card title="อาการ"><p className="px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200">{r.symptom}</p></Card>
        {r.cause && <Card title="สาเหตุและสิ่งที่ทำ"><Lines><Line title={r.cause} sub={r.fix} /></Lines></Card>}
        {r.parts.length > 0 && <Card title="อะไหล่ที่เบิก"><Lines>{r.parts.map((p) => <Line key={p.material} title={`${p.material} · ${materialName(p.material)}`} sub={p.doc} right={<span className="tabular-nums">{p.qty}</span>} />)}</Lines></Card>}
      </Body>
    </div>
  );
}

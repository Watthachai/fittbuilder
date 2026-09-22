import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  EMPLOYEES, EVENT_TYPES, TODAY, baht,
  allEvents, byDepartment, daysBetween, headcountAt, headcountTrend,
  hiredIn, leftIn, upcoming,
} from "./data";
import type { Employee, PersonnelEvent } from "./data";
import { Badge, Bar, Card, ColumnChart, FIELD, Metric, Note, PageHead, Search, Select, SURFACE } from "../ui";
import { ConfirmDialog, DataTable, Drawer, Field, Wizard } from "../kit";
import type { Column, Step } from "../kit";

const TABS = [
  "ข้อมูลส่วนตัว",
  "ข้อมูลสัญญาจ้าง",
  "ข้อมูลทางปกครอง",
  "เหตุการณ์ทางบุคคล",
  "ค่าตอบแทนและสวัสดิการ",
];

/** A draft employee: everything the wizard collects before the record exists. */
type Draft = {
  name: string; nickname: string; position: string; department: string;
  birthDate: string; nationalId: string; phone: string; email: string;
  type: string; startedAt: string; baseSalary: string;
  ssoNumber: string; bankName: string; bankAccount: string;
};

const EMPTY: Draft = {
  name: "", nickname: "", position: "", department: "ฝ่ายขาย",
  birthDate: "", nationalId: "", phone: "", email: "",
  type: "พนักงานประจำ", startedAt: TODAY, baseSalary: "",
  ssoNumber: "", bankName: "กสิกรไทย", bankAccount: "",
};

const DEPARTMENTS = [...new Set(EMPLOYEES.map((e) => e.department))];
const CONTRACT_TYPES = ["พนักงานประจำ", "สัญญาจ้าง 1 ปี", "พนักงานรายวัน", "พนักงานชั่วคราว"];
const BANKS = ["กสิกรไทย", "ไทยพาณิชย์", "กรุงไทย", "กรุงเทพ", "กรุงศรีอยุธยา"];

export default function PaScreen({ section }: { section?: string }) {
  // No section means the module's own overview; a section means one capability.
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("ทุกแผนก");
  const [picked, setPicked] = useState<Employee | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [added, setAdded] = useState<Employee[]>([]);
  const [events, setEvents] = useState<Record<number, PersonnelEvent[]>>({});
  const [resigned, setResigned] = useState<number[]>([]);
  const [confirming, setConfirming] = useState<Employee[] | null>(null);

  const people = useMemo(() => [...EMPLOYEES, ...added], [added]);
  const statusOf = (e: Employee) => (resigned.includes(e.id) ? "ลาออก" : e.status);
  const eventsOf = (e: Employee) => [...e.events, ...(events[e.id] ?? [])];

  const rows = people.filter(
    (e) =>
      (dept === "ทุกแผนก" || e.department === dept) &&
      (q.trim() === "" ||
        [e.name, e.nickname, e.code, e.position].some((t) =>
          t.toLowerCase().includes(q.trim().toLowerCase())
        ))
  );

  const addEvent = (id: number, ev: PersonnelEvent) =>
    setEvents((m) => ({ ...m, [id]: [...(m[id] ?? []), ev] }));

  const commitResignation = (who: Employee[]) => {
    setResigned((prev) => [...new Set([...prev, ...who.map((e) => e.id)])]);
    for (const e of who) {
      addEvent(e.id, { date: TODAY, type: "ลาออก", detail: "บันทึกจากหน้าทะเบียนพนักงาน" });
    }
    setConfirming(null);
    setPicked(null);
  };

  if (!tab) return <Overview people={people} statusOf={statusOf} />;

  return (
    <div>
      <PageHead
        title="ทะเบียนพนักงาน"
        meta={
          <>
            {tab} · {rows.length} คน จากทั้งหมด{" "}
            {people.filter((e) => statusOf(e) !== "ลาออก").length} คนที่ยังทำงานอยู่
          </>
        }
        right={
          <button
            onClick={() => {
              setDraft(EMPTY);
              setAdding(true);
            }}
            className="rounded-lg bg-sky-600 px-3.5 py-2 text-[13px] font-medium text-white transition hover:bg-sky-700"
          >
            + เพิ่มพนักงาน
          </button>
        }
      />

      <DataTable
        rows={rows}
        getId={(e) => e.id}
        onOpen={setPicked}
        selectable
        columns={columnsFor(tab, statusOf, eventsOf)}
        toolbar={
          <>
            <Select
              value={dept}
              onChange={setDept}
              options={["ทุกแผนก", ...DEPARTMENTS]}
            />
            <Search value={q} onChange={setQ} placeholder="ค้นหาชื่อ ชื่อเล่น รหัส หรือตำแหน่ง" />
          </>
        }
        bulkActions={(selected, clear) => (
          <button
            onClick={() => setConfirming(selected.filter((e) => statusOf(e) !== "ลาออก"))}
            disabled={selected.every((e) => statusOf(e) === "ลาออก")}
            className="rounded-md border border-rose-300 px-2.5 py-1 text-[12px] text-rose-700 transition hover:bg-rose-50 disabled:opacity-40 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
            title={`บันทึกการลาออกให้ ${selected.length} คนที่เลือกไว้`}
          >
            บันทึกการลาออก
          </button>
        )}
      />

      <Drawer
        open={picked !== null}
        title={picked?.name ?? ""}
        subtitle={picked ? `${picked.code} · ${picked.position} · ${picked.department}` : undefined}
        onClose={() => setPicked(null)}
        footer={
          picked && statusOf(picked) !== "ลาออก" ? (
            <button
              onClick={() => setConfirming([picked])}
              className="w-full rounded-lg border border-rose-300 py-2 text-[13px] text-rose-700 transition hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
            >
              บันทึกการลาออก
            </button>
          ) : undefined
        }
      >
        {picked && (
          <Record
            employee={picked}
            status={statusOf(picked)}
            events={eventsOf(picked)}
            openAt={tab}
            onAddEvent={(ev) => addEvent(picked.id, ev)}
          />
        )}
      </Drawer>

      <Drawer
        open={adding}
        title="เพิ่มพนักงานใหม่"
        subtitle="สามขั้นตอน — ตรวจความถูกต้องทีละขั้น ไม่ปล่อยไปเจอตอนบันทึก"
        onClose={() => setAdding(false)}
      >
        <NewEmployee
          draft={draft}
          setDraft={setDraft}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdded((prev) => [...prev, employeeFrom(draft, people.length + 1)]);
            setAdding(false);
          }}
        />
      </Drawer>

      <ConfirmDialog
        open={confirming !== null}
        title="บันทึกการลาออก"
        confirmWord="ลาออก"
        confirmLabel="บันทึกการลาออก"
        body={
          <>
            จะบันทึกการลาออกให้{" "}
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {confirming?.map((e) => e.name).join(", ")}
            </span>{" "}
            มีผลวันที่ {TODAY} · สถานะจะเปลี่ยนเป็นลาออกและมีเหตุการณ์บันทึกในประวัติ
            เงินเดือนงวดถัดไปจะไม่รวมคนเหล่านี้
          </>
        }
        onCancel={() => setConfirming(null)}
        onConfirm={() => confirming && commitResignation(confirming)}
      />

      <div hidden data-fitt-index>
        <button data-fitt-screen="ทะเบียนพนักงาน" />
        <button data-fitt-screen="แฟ้มประวัติพนักงาน" data-fitt-modal onClick={() => setPicked(EMPLOYEES[0])} />
      </div>
    </div>
  );
}

/** Each capability is a different set of columns over the same register. */
function columnsFor(
  tab: string,
  statusOf: (e: Employee) => string,
  eventsOf: (e: Employee) => PersonnelEvent[]
): Column<Employee>[] {
  const head: Column<Employee>[] = [
    {
      key: "code",
      header: "รหัส",
      sort: (a, b) => a.code.localeCompare(b.code),
      cell: (e) => <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{e.code}</span>,
    },
    {
      key: "name",
      header: "ชื่อ-นามสกุล",
      sort: (a, b) => a.name.localeCompare(b.name, "th"),
      cell: (e) => (
        <span>
          <span className="font-medium text-slate-900 dark:text-slate-100">{e.name}</span>
          <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">({e.nickname})</span>
        </span>
      ),
    },
    {
      key: "department",
      header: "แผนก",
      sort: (a, b) => a.department.localeCompare(b.department, "th"),
      cell: (e) => e.department,
    },
  ];

  const rest: Record<string, Column<Employee>[]> = {
    "ข้อมูลส่วนตัว": [
      { key: "birth", header: "วันเกิด", sort: (a, b) => a.personal.birthDate.localeCompare(b.personal.birthDate), cell: (e) => e.personal.birthDate },
      { key: "nid", header: "เลขบัตรประชาชน", cell: (e) => <span className="font-mono text-xs">{e.personal.nationalId}</span> },
      { key: "phone", header: "โทรศัพท์", cell: (e) => e.personal.phone },
      { key: "email", header: "อีเมล", cell: (e) => e.personal.email },
    ],
    "ข้อมูลสัญญาจ้าง": [
      { key: "type", header: "ประเภทจ้าง", sort: (a, b) => a.contract.type.localeCompare(b.contract.type, "th"), cell: (e) => e.contract.type },
      { key: "start", header: "วันเริ่มงาน", sort: (a, b) => a.contract.startedAt.localeCompare(b.contract.startedAt), cell: (e) => e.contract.startedAt },
      {
        key: "end",
        header: "สิ้นสุดสัญญา",
        sort: (a, b) => (a.contract.endsAt ?? "9999").localeCompare(b.contract.endsAt ?? "9999"),
        cell: (e) => {
          if (!e.contract.endsAt) return <span className="text-slate-400 dark:text-slate-500">ไม่กำหนด</span>;
          const left = daysBetween(TODAY, e.contract.endsAt);
          if (left < 0) return <Badge tone="idle">{e.contract.endsAt} · หมดอายุแล้ว</Badge>;
          if (left <= 90) return <Badge tone="bad">{e.contract.endsAt} · เหลือ {left} วัน</Badge>;
          return e.contract.endsAt;
        },
      },
      { key: "status", header: "สถานะ", cell: (e) => <StatusBadge status={statusOf(e)} /> },
    ],
    "ข้อมูลทางปกครอง": [
      { key: "sso", header: "เลขประกันสังคม", cell: (e) => <span className="font-mono text-xs">{e.admin.ssoNumber}</span> },
      { key: "tax", header: "เลขผู้เสียภาษี", cell: (e) => <span className="font-mono text-xs">{e.admin.taxId}</span> },
      { key: "bank", header: "ธนาคาร", sort: (a, b) => a.admin.bankName.localeCompare(b.admin.bankName, "th"), cell: (e) => e.admin.bankName },
      { key: "acct", header: "เลขบัญชี", cell: (e) => <span className="font-mono text-xs">{e.admin.bankAccount}</span> },
      { key: "pvd", header: "กองทุนสำรองฯ", align: "right", sort: (a, b) => a.admin.pvdRate - b.admin.pvdRate, cell: (e) => e.admin.pvdRate + "%" },
    ],
    "เหตุการณ์ทางบุคคล": [
      { key: "last", header: "เหตุการณ์ล่าสุด", cell: (e) => eventsOf(e).at(-1)?.type ?? "—" },
      { key: "when", header: "เมื่อ", sort: (a, b) => (eventsOf(a).at(-1)?.date ?? "").localeCompare(eventsOf(b).at(-1)?.date ?? ""), cell: (e) => eventsOf(e).at(-1)?.date ?? "—" },
      { key: "count", header: "จำนวนเหตุการณ์", align: "right", sort: (a, b) => eventsOf(a).length - eventsOf(b).length, cell: (e) => eventsOf(e).length + " ครั้ง" },
    ],
    "ค่าตอบแทนและสวัสดิการ": [
      { key: "salary", header: "เงินเดือนฐาน", align: "right", sort: (a, b) => a.contract.baseSalary - b.contract.baseSalary, cell: (e) => baht(e.contract.baseSalary) + " ฿" },
      { key: "ben", header: "สวัสดิการ", align: "right", sort: (a, b) => a.benefits.length - b.benefits.length, cell: (e) => e.benefits.length + " รายการ" },
      { key: "first", header: "รายการแรก", cell: (e) => e.benefits[0] ?? "—" },
    ],
  };

  return [...head, ...(rest[tab] ?? [])];
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={status === "ทำงานอยู่" ? "ok" : status === "ทดลองงาน" ? "warn" : "idle"}>
      {status}
    </Badge>
  );
}

/* ---------------------------------------------------------------- overview */

function Overview({
  people,
  statusOf,
}: {
  people: Employee[];
  statusOf: (e: Employee) => string;
}) {
  const active = people.filter((e) => statusOf(e) !== "ลาออก");
  const trend = headcountTrend();
  const yearAgo = headcountAt(TODAY.slice(0, 7).replace(/^(\d{4})/, (y) => String(Number(y) - 1)));
  const thisYear = TODAY.slice(0, 4);
  const lastYear = String(Number(thisYear) - 1);
  const hires = hiredIn(thisYear);
  const lastYearHires = hiredIn(lastYear);
  const leavers = leftIn(thisYear);
  const probation = active.filter((e) => statusOf(e) === "ทดลองงาน");
  const todo = upcoming();
  const departments = byDepartment();
  const recent = allEvents().slice(0, 7);

  const pct = (now: number, then: number) =>
    then === 0 ? 0 : Math.round(((now - then) / then) * 100);

  return (
    <div>
      <PageHead
        title="ภาพรวมทะเบียนพนักงาน"
        meta={`ข้อมูล ณ ${TODAY} · อัปเดตอัตโนมัติจากเหตุการณ์ทางบุคคล`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="พนักงานทั้งหมด"
          value={active.length + " คน"}
          delta={pct(active.length, yearAgo)}
          deltaLabel={`เทียบกับปีก่อน ${yearAgo} คน`}
          icon={<GlyphPeople />}
        />
        <Metric
          label={`รับเข้าปี ${thisYear}`}
          value={hires.length + " คน"}
          delta={lastYearHires.length === 0 ? undefined : pct(hires.length, lastYearHires.length)}
          deltaLabel={`ปี ${lastYear} รับเข้า ${lastYearHires.length} คน`}
          icon={<GlyphIn />}
        />
        <Metric
          label={`ลาออกปี ${thisYear}`}
          value={leavers.length + " คน"}
          delta={leavers.length === 0 ? 0 : Math.round((leavers.length / Math.max(1, active.length)) * 100)}
          goodWhen="down"
          deltaLabel="คิดเป็นอัตราการลาออกต่อกำลังคน"
          icon={<GlyphOut />}
        />
        <Metric
          label="อยู่ระหว่างทดลองงาน"
          value={probation.length + " คน"}
          deltaLabel={probation.length > 0 ? probation.map((e) => e.nickname).join(" · ") : "ไม่มีในงวดนี้"}
          icon={<GlyphClock />}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Card
          title="จำนวนพนักงานย้อนหลัง 12 เดือน"
          action={
            <span className="text-[11.5px] text-slate-400 dark:text-slate-500">
              นับจากวันเริ่มงานหักคนที่ลาออกแล้ว
            </span>
          }
        >
          <ColumnChart data={trend.map((t) => ({ label: t.label, value: t.value }))} format={(n) => n + " คน"} />
        </Card>

        <Card title={`ต้องทำก่อนสาย (${todo.length})`}>
          {todo.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-slate-400 dark:text-slate-500">
              ไม่มีรายการที่ครบกำหนดใน 120 วันข้างหน้า
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {todo.map((t, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={
                      "h-8 w-1 shrink-0 rounded-full " +
                      (t.tone === "bad" ? "bg-rose-500" : t.tone === "warn" ? "bg-amber-400" : "bg-sky-400")
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-slate-800 dark:text-slate-100">{t.name}</span>
                    <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                      {t.kind} · {t.date}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-slate-400 dark:text-slate-500">
                    อีก {t.inDays} วัน
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card title="กำลังคนตามแผนก">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {departments.map((d) => (
              <li key={d.department} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-28 shrink-0 truncate text-slate-700 dark:text-slate-200">{d.department}</span>
                <span className="flex-1">
                  <Bar pct={(d.count / active.length) * 100} tone="info" width="w-full" />
                </span>
                <span className="w-10 shrink-0 text-right tabular-nums text-slate-600 dark:text-slate-300">
                  {d.count}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="เหตุการณ์ทางบุคคลล่าสุด">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((e, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2.5">
                <span className="w-20 shrink-0 text-[11.5px] tabular-nums text-slate-400 dark:text-slate-500">
                  {e.date}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-slate-800 dark:text-slate-100">
                    {e.name} — {e.type}
                  </span>
                  <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">{e.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

const GlyphPeople = () => <span className="text-[15px]">👥</span>;
const GlyphIn = () => <span className="text-[15px]">📥</span>;
const GlyphOut = () => <span className="text-[15px]">📤</span>;
const GlyphClock = () => <span className="text-[15px]">⏳</span>;

/* ------------------------------------------------------------------ record */

function Record({
  employee: e,
  status,
  events,
  openAt,
  onAddEvent,
}: {
  employee: Employee;
  status: string;
  events: PersonnelEvent[];
  openAt: string;
  onAddEvent: (ev: PersonnelEvent) => void;
}) {
  // Opens on the part of the record the list was showing, then moves freely.
  const [tab, setTab] = useState(openAt);
  const [logging, setLogging] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "rounded-md px-2.5 py-1.5 text-[12px] transition " +
              (t === tab
                ? "bg-white font-medium text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100")
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "ข้อมูลส่วนตัว" && (
          <Facts
            items={[
              ["วันเกิด", e.personal.birthDate],
              ["เลขบัตรประชาชน", e.personal.nationalId],
              ["โทรศัพท์", e.personal.phone],
              ["อีเมล", e.personal.email],
              ["ที่อยู่ตามทะเบียนบ้าน", e.personal.address, true],
            ]}
          />
        )}

        {tab === "ข้อมูลสัญญาจ้าง" && (
          <>
            <Facts
              items={[
                ["ประเภทการจ้าง", e.contract.type],
                ["สถานะ", <StatusBadge key="s" status={status} />],
                ["วันเริ่มงาน", e.contract.startedAt],
                ["สิ้นสุดสัญญา", e.contract.endsAt ?? "ไม่กำหนด"],
                ["ครบกำหนดทดลองงาน", e.contract.probationUntil],
                ["วันทำงาน", e.contract.workDays],
              ]}
            />
            {e.contract.endsAt && daysBetween(TODAY, e.contract.endsAt) <= 90 && (
              <div className="mt-3">
                <Note tone="warn">
                  สัญญาหมดอายุ {e.contract.endsAt} — เหลืออีก {daysBetween(TODAY, e.contract.endsAt)} วัน
                  ควรเริ่มกระบวนการต่อสัญญาหรือแจ้งล่วงหน้าตามกฎหมายแรงงาน
                </Note>
              </div>
            )}
          </>
        )}

        {tab === "ข้อมูลทางปกครอง" && (
          <Facts
            items={[
              ["เลขประกันสังคม", e.admin.ssoNumber],
              ["เลขผู้เสียภาษี", e.admin.taxId],
              ["ธนาคาร", e.admin.bankName],
              ["เลขบัญชี", e.admin.bankAccount],
              ["กองทุนสำรองเลี้ยงชีพ", e.admin.pvdRate + "% ของเงินเดือน"],
            ]}
          />
        )}

        {tab === "เหตุการณ์ทางบุคคล" && (
          <div>
            <ol className="relative space-y-3 border-l border-slate-200 pl-4 dark:border-slate-800">
              {[...events].reverse().map((ev, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-sky-500" />
                  <p className="text-[12.5px] font-medium text-slate-900 dark:text-slate-100">{ev.type}</p>
                  <p className="text-[11.5px] text-slate-400 dark:text-slate-500">{ev.date}</p>
                  <p className="mt-0.5 text-[12.5px] text-slate-600 dark:text-slate-300">{ev.detail}</p>
                </li>
              ))}
            </ol>

            {logging ? (
              <AddEvent
                onCancel={() => setLogging(false)}
                onSave={(ev) => {
                  onAddEvent(ev);
                  setLogging(false);
                }}
              />
            ) : (
              <button
                onClick={() => setLogging(true)}
                className="mt-4 w-full rounded-lg border border-dashed border-slate-300 py-2 text-[12.5px] text-slate-500 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-700 dark:text-slate-400"
              >
                + บันทึกเหตุการณ์ใหม่
              </button>
            )}
          </div>
        )}

        {tab === "ค่าตอบแทนและสวัสดิการ" && (
          <>
            <Facts items={[["เงินเดือนฐาน", baht(e.contract.baseSalary) + " บาท/เดือน"]]} />
            <ul className="mt-3 space-y-1.5">
              {e.benefits.map((b) => (
                <li
                  key={b}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                >
                  {b}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Facts({ items }: { items: [string, ReactNode, boolean?][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map(([k, v, wide], i) => (
        <div key={i} className={wide ? "col-span-2" : ""}>
          <dt className="text-[11.5px] text-slate-500 dark:text-slate-400">{k}</dt>
          <dd className="mt-0.5 text-[13px] text-slate-900 dark:text-slate-100">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function AddEvent({
  onSave,
  onCancel,
}: {
  onSave: (ev: PersonnelEvent) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState(EVENT_TYPES[1]);
  const [date, setDate] = useState(TODAY);
  const [detail, setDetail] = useState("");
  const [tried, setTried] = useState(false);
  const bad = tried && detail.trim().length < 5;

  return (
    <div className={"mt-4 p-3 " + SURFACE}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ประเภทเหตุการณ์">
          <Select value={type} onChange={setType} options={EVENT_TYPES} />
        </Field>
        <Field label="วันที่มีผล">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD + " w-full"} />
        </Field>
      </div>
      <div className="mt-3">
        <Field
          label="รายละเอียด"
          error={bad ? "ใส่รายละเอียดอย่างน้อย 5 ตัวอักษร เพื่อให้คนอ่านประวัติย้อนหลังเข้าใจ" : undefined}
          hint="เช่น ย้ายจากฝ่ายขายไปฝ่ายการตลาด"
        >
          <input
            value={detail}
            onChange={(e) => {
              setDetail(e.target.value);
              if (tried) setTried(true);
            }}
            className={
              FIELD + " w-full " + (bad ? "border-rose-400 dark:border-rose-500" : "")
            }
          />
        </Field>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12.5px] text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          ยกเลิก
        </button>
        <button
          onClick={() => {
            setTried(true);
            if (detail.trim().length >= 5) onSave({ date, type, detail: detail.trim() });
          }}
          className="flex-1 rounded-lg bg-sky-600 py-1.5 text-[12.5px] font-medium text-white transition hover:bg-sky-700"
        >
          บันทึกเหตุการณ์
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ wizard */

function employeeFrom(d: Draft, n: number): Employee {
  return {
    id: 1000 + n,
    code: "EMP-" + String(1000 + n).slice(1).padStart(4, "0"),
    name: d.name,
    nickname: d.nickname || d.name.split(" ")[0],
    position: d.position,
    department: d.department,
    status: "ทดลองงาน",
    personal: {
      birthDate: d.birthDate,
      nationalId: d.nationalId,
      phone: d.phone,
      email: d.email,
      address: "—",
    },
    contract: {
      type: d.type,
      startedAt: d.startedAt,
      endsAt: null,
      probationUntil: d.startedAt,
      baseSalary: Number(d.baseSalary) || 0,
      workDays: "จันทร์–ศุกร์",
    },
    admin: {
      ssoNumber: d.ssoNumber,
      taxId: d.nationalId.replace(/-/g, ""),
      bankName: d.bankName,
      bankAccount: d.bankAccount,
      pvdRate: 3,
    },
    benefits: ["ประกันสุขภาพกลุ่ม"],
    events: [{ date: d.startedAt, type: "รับเข้าทำงาน", detail: `ตำแหน่ง ${d.position} · เงินเดือน ${d.baseSalary}` }],
  } as Employee;
}

/**
 * Declared out here, not inside the wizard.
 *
 * A component defined during render is a new type every render, so React throws
 * the input away and mounts a fresh one — which takes the caret with it and
 * leaves you able to type exactly one character per field.
 */
function DraftText({
  value,
  onChange,
  label,
  error,
  hint,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD + " w-full " + (error ? "border-rose-400 dark:border-rose-500" : "")}
      />
    </Field>
  );
}

function NewEmployee({
  draft,
  setDraft,
  onDone,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const set = (k: keyof Draft) => (v: string) => setDraft({ ...draft, [k]: v });
  const text = (k: keyof Draft, label: string, errors: Record<string, string>, extra?: { hint?: string; placeholder?: string }) => (
    <DraftText
      value={draft[k]}
      onChange={set(k)}
      label={label}
      error={errors[k]}
      hint={extra?.hint}
      placeholder={extra?.placeholder}
    />
  );

  const steps: Step[] = [
    {
      title: "ข้อมูลส่วนตัว",
      validate: () => {
        const e: Record<string, string> = {};
        if (draft.name.trim().split(" ").length < 2) e.name = "ใส่ทั้งชื่อและนามสกุล";
        if (!/^\d-\d{4}-\d{5}-\d{2}-\d$/.test(draft.nationalId)) e.nationalId = "รูปแบบต้องเป็น 1-2345-67890-12-3";
        if (!/^0\d{2}-\d{3}-\d{4}$/.test(draft.phone)) e.phone = "รูปแบบต้องเป็น 08X-XXX-XXXX";
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email)) e.email = "อีเมลไม่ถูกต้อง";
        return e;
      },
      render: (errors) => (
        <>
          <div className="grid grid-cols-2 gap-3">
            {text("name", "ชื่อ-นามสกุล", errors, { placeholder: "สมชาย รักดี" })}
            {text("nickname", "ชื่อเล่น", errors, { placeholder: "ชาย" })}
          </div>
          {text("nationalId", "เลขบัตรประชาชน", errors, { hint: "ใส่ขีดตามบัตร", placeholder: "1-2345-67890-12-3" })}
          <div className="grid grid-cols-2 gap-3">
            {text("phone", "โทรศัพท์", errors, { hint: "รูปแบบ 08X-XXX-XXXX", placeholder: "081-234-5678" })}
            <Field label="วันเกิด">
              <input type="date" value={draft.birthDate} onChange={(e) => set("birthDate")(e.target.value)} className={FIELD + " w-full"} />
            </Field>
          </div>
          {text("email", "อีเมล", errors, { placeholder: "somchai@example.co.th" })}
        </>
      ),
    },
    {
      title: "ข้อมูลการจ้าง",
      validate: () => {
        const e: Record<string, string> = {};
        if (draft.position.trim().length < 2) e.position = "ระบุตำแหน่ง";
        if (!draft.baseSalary || Number(draft.baseSalary) < 10000)
          e.baseSalary = "เงินเดือนต้องไม่ต่ำกว่า 10,000 บาท";
        return e;
      },
      render: (errors) => (
        <>
          {text("position", "ตำแหน่ง", errors, { placeholder: "พนักงานขาย" })}
          <div className="grid grid-cols-2 gap-3">
            <Field label="แผนก">
              <Select value={draft.department} onChange={set("department")} options={DEPARTMENTS} />
            </Field>
            <Field label="ประเภทการจ้าง">
              <Select value={draft.type} onChange={set("type")} options={CONTRACT_TYPES} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="วันเริ่มงาน">
              <input type="date" value={draft.startedAt} onChange={(e) => set("startedAt")(e.target.value)} className={FIELD + " w-full"} />
            </Field>
            {text("baseSalary", "เงินเดือนฐาน (บาท)", errors, { placeholder: "22000" })}
          </div>
        </>
      ),
    },
    {
      title: "ข้อมูลทางปกครอง",
      validate: () => {
        const e: Record<string, string> = {};
        if (!/^\d{10}$/.test(draft.ssoNumber)) e.ssoNumber = "เลขประกันสังคมต้องมี 10 หลัก";
        if (draft.bankAccount.trim().length < 6) e.bankAccount = "ใส่เลขบัญชีให้ครบ";
        return e;
      },
      render: (errors) => (
        <>
          {text("ssoNumber", "เลขประกันสังคม", errors, { hint: "10 หลัก ไม่ต้องใส่ขีด", placeholder: "1234567890" })}
          <div className="grid grid-cols-2 gap-3">
            <Field label="ธนาคาร">
              <Select value={draft.bankName} onChange={set("bankName")} options={BANKS} />
            </Field>
            {text("bankAccount", "เลขบัญชี", errors, { placeholder: "xxx-x-x1234-5" })}
          </div>
          <Note tone="info">
            เลขผู้เสียภาษีจะใช้เลขบัตรประชาชนที่กรอกไว้ และตั้งกองทุนสำรองเลี้ยงชีพเริ่มต้นที่ 3%
            แก้ได้ภายหลังในแฟ้มประวัติ
          </Note>
        </>
      ),
    },
  ];

  return <Wizard steps={steps} onDone={onDone} onCancel={onCancel} doneLabel="เพิ่มพนักงาน" />;
}

import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight, Banknote, BookOpen, Building, CalendarClock, CircleCheck, CircleX, Coins,
  FileText, Landmark, Layers, Receipt, Scale, Search as SearchIcon, Sigma, TrendingDown,
  TrendingUp, TriangleAlert, Users, Wallet,
} from "lucide-react";
import {
  ACCOUNTS, AGING_BUCKETS, ASSETS, JOURNAL, PERIOD, accumulated, account, baht, balanceSheet,
  bucketOf, entryTotal, isBalanced, monthlyDepreciation, monthsHeld, payables, profitAndLoss,
  receivables, trialBalance,
} from "./data";
import type { Asset, JournalEntry } from "./data";
import {
  Avatar, Badge, Bar, Button, Card, Chip, ColumnChart, Donut, Dot, IconRow, Note, PageHead,
  Progress, Reveal, Search, Segmented, Select, StatStrip, Tabs, Tag, TintCard, swatchFor,
} from "../ui";
import { DataTable, DetailModal, FormModal } from "../kit";
import type { Column } from "../kit";

const TABS = ["ผังบัญชีและสมุดรายวัน", "เจ้าหนี้การค้า", "ลูกหนี้การค้า", "สินทรัพย์ถาวร", "งบการเงิน"];

const ACCOUNT_TYPES = ["สินทรัพย์", "หนี้สิน", "ส่วนของเจ้าของ", "รายได้", "ค่าใช้จ่าย"];
const typeSwatch = (t: string) => swatchFor(t, ACCOUNT_TYPES);

const LEDGER_TABS = ["ผังบัญชี", "สมุดรายวัน"];
const LEDGER_ICONS: Record<string, ReactNode> = {
  ผังบัญชี: <Layers size={13} />,
  สมุดรายวัน: <BookOpen size={13} />,
};

const STATEMENT_TABS = ["งบกำไรขาดทุน", "งบแสดงฐานะการเงิน"];
const STATEMENT_ICONS: Record<string, ReactNode> = {
  งบกำไรขาดทุน: <TrendingUp size={13} />,
  งบแสดงฐานะการเงิน: <Scale size={13} />,
};

type TrialRow = ReturnType<typeof trialBalance>[number];

/* ----------------------------------------------------------------- screen */

export default function FiScreen({
  section,
  onOpenSection,
}: {
  section?: string;
  onOpenSection?: (index: number) => void;
}) {
  const tab = section && TABS.includes(section) ? section : undefined;

  const [q, setQ] = useState("");
  const [type, setType] = useState("ทุกประเภท");
  const [openEntry, setOpenEntry] = useState<JournalEntry | null>(null);
  const [openAccount, setOpenAccount] = useState<TrialRow | null>(null);
  const [openAsset, setOpenAsset] = useState<Asset | null>(null);

  const tb = trialBalance();
  const bs = balanceSheet();
  const pl = profitAndLoss();
  const ap = payables();
  const ar = receivables();
  const unbalanced = JOURNAL.filter((e) => !isBalanced(e));

  const panels = (
    <>
      <FormModal
        open={openEntry !== null}
        title="รายการในสมุดรายวัน"
        subtitle={openEntry ? `${openEntry.no} · ${openEntry.date}` : undefined}
        onClose={() => setOpenEntry(null)}
        size="lg"
      >
        {openEntry && <EntryRecord e={openEntry} />}
      </FormModal>

      <FormModal
        open={openAccount !== null}
        title="บัญชีแยกประเภท"
        subtitle={openAccount ? `${openAccount.code} · ${openAccount.name}` : undefined}
        onClose={() => setOpenAccount(null)}
        size="lg"
      >
        {openAccount && <AccountRecord a={openAccount} onOpenEntry={(e) => { setOpenAccount(null); setOpenEntry(e); }} />}
      </FormModal>

      <FormModal
        open={openAsset !== null}
        title="สินทรัพย์ถาวร"
        subtitle={openAsset ? `${openAsset.code} · ${openAsset.name}` : undefined}
        onClose={() => setOpenAsset(null)}
        size="sm"
      >
        {openAsset && <AssetRecord a={openAsset} />}
      </FormModal>
    </>
  );

  if (!tab) {
    return (
      <>
        <Overview
          pl={pl}
          bs={bs}
          ap={ap}
          ar={ar}
          unbalanced={unbalanced}
          onOpenSection={onOpenSection}
          onOpenEntry={setOpenEntry}
          onOpenAccount={setOpenAccount}
        />
        {panels}
      </>
    );
  }

  return (
    <div>
      <PageHead
        title="บัญชีการเงิน"
        meta={`${tab} · ${PERIOD.label} · ${JOURNAL.length} รายการในสมุดรายวัน · ${ACCOUNTS.length} บัญชี`}
        right={<Badge tone={bs.balances ? "ok" : "bad"} dot>{bs.balances ? "งบดุลลงตัว" : "งบดุลไม่ลงตัว"}</Badge>}
      />

      {tab === "ผังบัญชีและสมุดรายวัน" && (
        <Ledger
          tb={tb}
          q={q}
          setQ={setQ}
          type={type}
          setType={setType}
          onOpenAccount={setOpenAccount}
          onOpenEntry={setOpenEntry}
        />
      )}
      {tab === "เจ้าหนี้การค้า" && <Payables rows={ap} />}
      {tab === "ลูกหนี้การค้า" && <Receivables rows={ar} />}
      {tab === "สินทรัพย์ถาวร" && <Assets onOpen={setOpenAsset} />}
      {tab === "งบการเงิน" && <Statements pl={pl} bs={bs} />}

      {panels}

      <div hidden data-fitt-index>
        <button data-fitt-screen="บัญชีการเงิน" />
        <button data-fitt-screen="รายการในสมุดรายวัน" data-fitt-modal onClick={() => setOpenEntry(JOURNAL[0])} />
        <button data-fitt-screen="บัญชีแยกประเภท" data-fitt-modal onClick={() => setOpenAccount(tb[0])} />
        <button data-fitt-screen="สินทรัพย์ถาวร" data-fitt-modal onClick={() => setOpenAsset(ASSETS[0])} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- overview */

function Overview({
  pl,
  bs,
  ap,
  ar,
  unbalanced,
  onOpenSection,
  onOpenEntry,
  onOpenAccount,
}: {
  pl: ReturnType<typeof profitAndLoss>;
  bs: ReturnType<typeof balanceSheet>;
  ap: ReturnType<typeof payables>;
  ar: ReturnType<typeof receivables>;
  unbalanced: JournalEntry[];
  onOpenSection?: (index: number) => void;
  onOpenEntry: (e: JournalEntry) => void;
  onOpenAccount: (a: TrialRow) => void;
}) {
  const overdueAp = ap.filter((x) => x.overdueDays > 0);
  const overdueAr = ar.filter((x) => x.overdueDays > 0);
  const unbilled = ar.filter((x) => !x.billed);

  const expenseSegments = pl.expenses
    .filter((a) => a.balance > 0)
    .map((a) => ({ label: a.name, value: a.balance, swatch: swatchFor(a.code) }));

  const recent = [...JOURNAL].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

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
        title="ภาพรวมบัญชีการเงิน"
        meta={`${PERIOD.label} · ${PERIOD.from} ถึง ${PERIOD.to}`}
        right={
          onOpenSection ? (
            <Button variant="primary" icon={<Sigma size={15} />} onClick={() => onOpenSection(4)}>
              เปิดงบการเงิน
            </Button>
          ) : undefined
        }
      />

      <Reveal>
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><TrendingUp size={15} className="text-slate-400" />ผลประกอบการงวดนี้</span>}
            action={seeAll(4)}
          >
            <div className="p-4">
              <p className={"text-[32px] font-semibold leading-none tabular-nums " + (pl.profit >= 0 ? "text-slate-900 dark:text-slate-50" : "text-rose-600 dark:text-rose-400")}>
                {baht(pl.profit)}
              </p>
              <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                {pl.profit >= 0 ? "กำไร" : "ขาดทุน"}สุทธิ · รายได้ {baht(pl.revenue)} ค่าใช้จ่าย {baht(pl.expenseTotal)}
              </p>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[12.5px] text-slate-600 dark:text-slate-300">รายได้</span>
                  <span className="min-w-0 flex-1">
                    <Bar pct={100} tone="ok" width="w-full" />
                  </span>
                  <span className="w-32 shrink-0 text-right text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">{baht(pl.revenue)}</span>
                </div>
                {pl.expenses
                  .filter((a) => a.balance > 0)
                  .map((a) => (
                    <div key={a.code} className="flex items-center gap-3">
                      <span className="flex w-28 shrink-0 items-center gap-1.5 truncate text-[12.5px] text-slate-600 dark:text-slate-300">
                        <Dot className={swatchFor(a.code).dot} />
                        {a.name.length > 12 ? a.name.slice(0, 12) + "…" : a.name}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Bar pct={(a.balance / pl.revenue) * 100} tone="bad" width="w-full" />
                      </span>
                      <span className="w-32 shrink-0 text-right text-[12.5px] tabular-nums text-slate-700 dark:text-slate-200">
                        {baht(a.balance)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><TriangleAlert size={15} className="text-slate-400" />ต้องจัดการ</span>}
            action={seeAll(1)}
          >
            <div className="space-y-2.5 p-4">
              {[
                { icon: <Receipt size={15} />, label: "เจ้าหนี้เลยกำหนดชำระ", value: overdueAp.length, unit: "ใบ", tone: "bad" as const, to: 1 },
                { icon: <Users size={15} />, label: "ลูกหนี้เลยกำหนดชำระ", value: overdueAr.length, unit: "ใบ", tone: "bad" as const, to: 2 },
                { icon: <FileText size={15} />, label: "ส่งของแล้วยังไม่วางบิล", value: unbilled.length, unit: "ใบ", tone: "warn" as const, to: 2 },
                { icon: <Scale size={15} />, label: "สมุดรายวันที่ไม่ลงตัว", value: unbalanced.length, unit: "รายการ", tone: "bad" as const, to: 0 },
              ].map((r) => (
                <button
                  key={r.label}
                  onClick={() => onOpenSection?.(r.to)}
                  className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 text-left transition hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                >
                  <span className="text-slate-400">{r.icon}</span>
                  <span className="min-w-0 flex-1 text-[12.5px] text-slate-700 dark:text-slate-200">{r.label}</span>
                  <Badge tone={r.value > 0 ? r.tone : "ok"}>
                    {r.value} {r.unit}
                  </Badge>
                </button>
              ))}
              <Note tone={bs.balances ? "ok" : "bad"}>
                {bs.balances
                  ? "งบดุลลงตัว สินทรัพย์เท่ากับหนี้สินบวกส่วนของเจ้าของบวกกำไรงวดนี้"
                  : "งบดุลไม่ลงตัว ควรตรวจรายการในสมุดรายวันที่เดบิตไม่เท่าเครดิต"}
              </Note>
            </div>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="mt-3">
        <div className="grid gap-3 xl:grid-cols-3">
          <Card title={<span className="flex items-center gap-2"><Coins size={15} className="text-slate-400" />โครงสร้างค่าใช้จ่าย</span>} action={seeAll(4)}>
            <div className="p-4">
              <Donut
                segments={expenseSegments}
                size={128}
                format={(n) => baht(n)}
                center={
                  <span>
                    <span className="block text-[18px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {Math.round((pl.expenseTotal / pl.revenue) * 100)}%
                    </span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">ของรายได้</span>
                  </span>
                }
              />
            </div>
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Receipt size={15} className="text-slate-400" />เจ้าหนี้แยกตามอายุหนี้</span>}
            action={seeAll(1)}
          >
            <Aging rows={ap.map((x) => ({ amount: x.amount, overdueDays: x.overdueDays }))} tone="bad" />
          </Card>

          <Card
            title={<span className="flex items-center gap-2"><Users size={15} className="text-slate-400" />ลูกหนี้แยกตามอายุหนี้</span>}
            action={seeAll(2)}
          >
            <Aging rows={ar.map((x) => ({ amount: x.amount, overdueDays: x.overdueDays }))} tone="warn" />
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.16} className="mt-3">
        <Card
          title={<span className="flex items-center gap-2"><BookOpen size={15} className="text-slate-400" />รายการล่าสุดในสมุดรายวัน</span>}
          subtitle="ทุกรายการสร้างจากเอกสารต้นทางจริง กดเพื่อดูรายบรรทัด"
          action={seeAll(0)}
        >
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recent.map((e) => (
              <li key={e.no} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className={"grid size-8 shrink-0 place-items-center rounded-full " + (isBalanced(e) ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300")}>
                  {isBalanced(e) ? <CircleCheck size={14} /> : <CircleX size={14} />}
                </span>
                <button onClick={() => onOpenEntry(e)} className="w-28 shrink-0 text-left font-mono text-[12px] text-slate-500 transition hover:text-violet-700 dark:text-slate-400">
                  {e.no}
                </button>
                <span className="min-w-0 flex-1 truncate text-[13px] text-slate-900 dark:text-slate-50">{e.memo}</span>
                <span className="flex shrink-0 flex-wrap gap-1">
                  {e.lines.map((l) => (
                    <button
                      key={l.account}
                      onClick={() => onOpenAccount(trialBalance().find((a) => a.code === l.account)!)}
                      className={"rounded-md px-1.5 py-0.5 font-mono text-[10.5px] " + typeSwatch(account(l.account).type).tint}
                    >
                      {l.account}
                    </button>
                  ))}
                </span>
                <span className="w-24 shrink-0 text-right text-[11.5px] tabular-nums text-slate-400">{e.date}</span>
                <span className="w-28 shrink-0 text-right text-[13px] tabular-nums text-slate-900 dark:text-slate-50">
                  {baht(entryTotal(e))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>
    </div>
  );
}

function Aging({ rows, tone }: { rows: { amount: number; overdueDays: number }[]; tone: "bad" | "warn" }) {
  const total = rows.reduce((n, r) => n + r.amount, 0);
  return (
    <div className="space-y-3 p-4">
      {AGING_BUCKETS.map((b) => {
        const list = rows.filter((r) => bucketOf(r.overdueDays).label === b.label);
        const sum = list.reduce((n, r) => n + r.amount, 0);
        return (
          <div key={b.label}>
            <div className="mb-1 flex items-center gap-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{b.label}</span>
              <span className="shrink-0 text-[11px] text-slate-400">{list.length} ใบ</span>
              <span className="shrink-0 tabular-nums text-slate-900 dark:text-slate-50">{sum ? baht(sum) : "—"}</span>
            </div>
            <Bar pct={total ? (sum / total) * 100 : 0} tone={b.max === 0 ? "ok" : tone} width="w-full" />
          </div>
        );
      })}
      <p className="text-[11.5px] text-slate-400">รวมทั้งสิ้น {baht(total)}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- ledger */

function Ledger({
  tb,
  q,
  setQ,
  type,
  setType,
  onOpenAccount,
  onOpenEntry,
}: {
  tb: TrialRow[];
  q: string;
  setQ: (v: string) => void;
  type: string;
  setType: (v: string) => void;
  onOpenAccount: (a: TrialRow) => void;
  onOpenEntry: (e: JournalEntry) => void;
}) {
  const [view, setView] = useState(LEDGER_TABS[0]);
  const needle = q.trim().toLowerCase();
  const rows = tb.filter(
    (a) =>
      (type === "ทุกประเภท" || a.type === type) &&
      (needle === "" || [a.code, a.name].some((t) => t.toLowerCase().includes(needle)))
  );

  const debit = tb.filter((a) => a.balance > 0).reduce((n, a) => n + a.balance, 0);
  const credit = -tb.filter((a) => a.balance < 0).reduce((n, a) => n + a.balance, 0);
  const unbalanced = JOURNAL.filter((e) => !isBalanced(e));

  const columns: Column<TrialRow>[] = [
    {
      key: "code",
      header: "รหัสบัญชี",
      width: "14%",
      sort: (a, b) => a.code.localeCompare(b.code),
      cell: (a) => (
        <span className="flex items-center gap-2">
          <Dot className={typeSwatch(a.type).dot} />
          <span className="font-mono text-[12.5px] text-slate-900 dark:text-slate-50">{a.code}</span>
        </span>
      ),
    },
    { key: "name", header: "ชื่อบัญชี", width: "34%", sort: (a, b) => a.name.localeCompare(b.name, "th"), cell: (a) => <span className="text-slate-900 dark:text-slate-50">{a.name}</span> },
    { key: "type", header: "ประเภท", width: "18%", cell: (a) => <Tag swatch={typeSwatch(a.type)}>{a.type}</Tag> },
    {
      key: "debit",
      header: "เดบิต",
      align: "right",
      width: "17%",
      sort: (a, b) => Math.max(0, a.balance) - Math.max(0, b.balance),
      cell: (a) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{a.balance > 0 ? baht(a.balance) : "—"}</span>,
    },
    {
      key: "credit",
      header: "เครดิต",
      align: "right",
      width: "17%",
      sort: (a, b) => Math.max(0, -a.balance) - Math.max(0, -b.balance),
      cell: (a) => <span className="tabular-nums text-slate-700 dark:text-slate-200">{a.balance < 0 ? baht(-a.balance) : "—"}</span>,
    },
  ];

  return (
    <div className="space-y-3">
      <Tabs tabs={LEDGER_TABS} active={view} onPick={setView} icons={LEDGER_ICONS} id="ledger" />

      {view === "ผังบัญชี" && (
        <>
          <StatStrip
            title="งบทดลอง"
            icon={<Scale size={15} />}
            cells={[
              { icon: <Layers size={13} />, label: "บัญชีในผัง", value: ACCOUNTS.length + " บัญชี", sub: "แบ่งเป็นห้าประเภทตามหมวด" },
              { icon: <TrendingUp size={13} />, label: "ยอดเดบิตรวม", value: baht(debit), sub: "สินทรัพย์และค่าใช้จ่าย", tone: "info" },
              { icon: <TrendingDown size={13} />, label: "ยอดเครดิตรวม", value: baht(credit), sub: "หนี้สิน ส่วนของเจ้าของ และรายได้", tone: "accent" },
              { icon: debit === credit ? <CircleCheck size={13} /> : <CircleX size={13} />, label: "ผลการตรวจ", value: debit === credit ? "ลงตัว" : "ไม่ลงตัว", sub: debit === credit ? "เดบิตเท่ากับเครดิตพอดี" : `ต่างกัน ${baht(Math.abs(debit - credit))}`, tone: debit === credit ? "ok" : "bad" },
            ]}
          />
          <DataTable
            rows={rows}
            columns={columns}
            getId={(a) => a.code}
            onOpen={onOpenAccount}
            toolbar={
              <div className="flex flex-wrap items-center gap-2">
                <Search value={q} onChange={setQ} placeholder="ค้นหารหัสหรือชื่อบัญชี" icon={<SearchIcon size={14} />} />
                <Select value={type} onChange={setType} options={["ทุกประเภท", ...ACCOUNT_TYPES]} />
                <span className="ml-auto text-[12px] text-slate-400">กดที่แถวเพื่อเปิดบัญชีแยกประเภท</span>
              </div>
            }
          />
        </>
      )}

      {view === "สมุดรายวัน" && (
        <Card
          title={<span className="flex items-center gap-2"><BookOpen size={15} className="text-slate-400" />สมุดรายวัน</span>}
          subtitle={unbalanced.length ? `มี ${unbalanced.length} รายการที่เดบิตยังไม่เท่าเครดิต` : "ทุกรายการเดบิตเท่ากับเครดิต"}
          action={<Chip>{JOURNAL.length} รายการ</Chip>}
        >
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">เลขที่</th>
                <th className="px-4 py-3 font-medium">วันที่</th>
                <th className="px-4 py-3 font-medium">คำอธิบาย</th>
                <th className="px-4 py-3 font-medium">เอกสารต้นทาง</th>
                <th className="px-4 py-3 text-right font-medium">จำนวนเงิน</th>
                <th className="px-4 py-3 font-medium">ลงตัว</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...JOURNAL].reverse().map((e) => (
                <tr
                  key={e.no}
                  onClick={() => onOpenEntry(e)}
                  className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{e.no}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">{e.date}</td>
                  <td className="px-4 py-2.5 text-slate-900 dark:text-slate-50">{e.memo}</td>
                  <td className="px-4 py-2.5 font-mono text-[11.5px] text-violet-700 dark:text-violet-300">{e.ref ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 dark:text-slate-50">{baht(entryTotal(e))}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={isBalanced(e) ? "ok" : "bad"} dot>{isBalanced(e) ? "ลงตัว" : "ไม่ลงตัว"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- payables */

function Payables({ rows }: { rows: ReturnType<typeof payables> }) {
  const total = rows.reduce((n, r) => n + r.amount, 0);
  const overdue = rows.filter((r) => r.overdueDays > 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title="เจ้าหนี้การค้า"
        icon={<Receipt size={15} />}
        cells={[
          { icon: <Receipt size={13} />, label: "ใบแจ้งหนี้ค้างจ่าย", value: rows.length + " ใบ", sub: baht(total) },
          { icon: <CalendarClock size={13} />, label: "เลยกำหนดชำระ", value: overdue.length + " ใบ", sub: baht(overdue.reduce((n, r) => n + r.amount, 0)), tone: overdue.length > 0 ? "bad" : "ok" },
          { icon: <Building size={13} />, label: "ผู้ขายที่มียอดค้าง", value: new Set(rows.map((r) => r.vendorName)).size + " ราย", sub: "อ่านจากแฟ้มจัดซื้อ", tone: "info" },
          { icon: <Banknote size={13} />, label: "รวมภาษีซื้อ", value: baht(rows.reduce((n, r) => n + Math.round(r.amount - r.amount / 1.07), 0)), sub: "ขอคืนได้ในแบบภาษีมูลค่าเพิ่ม", tone: "accent" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Receipt size={15} className="text-slate-400" />ใบแจ้งหนี้ที่ยังไม่ได้จ่าย</span>}
        subtitle="รายชื่อผู้ขายอ่านจากแฟ้มจัดซื้อ วันครบกำหนดคำนวณจากเงื่อนไขชำระของผู้ขายรายนั้น"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">เลขที่</th>
              <th className="px-4 py-3 font-medium">ผู้ขาย</th>
              <th className="px-4 py-3 font-medium">เงื่อนไข</th>
              <th className="px-4 py-3 font-medium">วันที่</th>
              <th className="px-4 py-3 font-medium">ครบกำหนด</th>
              <th className="px-4 py-3 text-right font-medium">จำนวนเงิน</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.no} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{r.no}</td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={r.vendorName.replace(/^(บจก\.|หจก\.)\s*/, "")} size="sm" />
                    <span className="text-slate-900 dark:text-slate-50">{r.vendorName}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{r.terms}</td>
                <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">{r.date}</td>
                <td className={"px-4 py-2.5 tabular-nums " + (r.overdueDays > 0 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400")}>
                  {r.due}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(r.amount)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={r.overdueDays > 0 ? "bad" : "ok"} dot>
                    {r.overdueDays > 0 ? `เลยกำหนด ${r.overdueDays} วัน` : "ยังไม่ถึงกำหนด"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />อายุหนี้เจ้าหนี้</span>}>
        <Aging rows={rows.map((r) => ({ amount: r.amount, overdueDays: r.overdueDays }))} tone="bad" />
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------- receivables */

function Receivables({ rows }: { rows: ReturnType<typeof receivables> }) {
  const total = rows.reduce((n, r) => n + r.amount, 0);
  const overdue = rows.filter((r) => r.overdueDays > 0);
  const unbilled = rows.filter((r) => !r.billed);

  return (
    <div className="space-y-3">
      <StatStrip
        title="ลูกหนี้การค้า"
        icon={<Users size={15} />}
        cells={[
          { icon: <Users size={13} />, label: "ยอดที่ยังไม่ได้เก็บ", value: rows.length + " ใบ", sub: baht(total) },
          { icon: <CalendarClock size={13} />, label: "เลยกำหนดชำระ", value: overdue.length + " ใบ", sub: baht(overdue.reduce((n, r) => n + r.amount, 0)), tone: overdue.length > 0 ? "bad" : "ok" },
          { icon: <FileText size={13} />, label: "ยังไม่ได้วางบิล", value: unbilled.length + " ใบ", sub: "ส่งของแล้วแต่ยังไม่ออกใบแจ้งหนี้", tone: unbilled.length > 0 ? "warn" : "ok" },
          { icon: <Wallet size={13} />, label: "ภาษีขายค้างนำส่ง", value: baht(Math.round(total - total / 1.07)), sub: "ต้องนำส่งในแบบภาษีมูลค่าเพิ่ม", tone: "accent" },
        ]}
      />

      <Card
        title={<span className="flex items-center gap-2"><Users size={15} className="text-slate-400" />ยอดที่ลูกค้ายังไม่ชำระ</span>}
        subtitle="รายชื่อลูกค้าอ่านจากแฟ้มขาย วันครบกำหนดคำนวณจากเงื่อนไขชำระของลูกค้ารายนั้น"
      >
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">ใบสั่งขาย</th>
              <th className="px-4 py-3 font-medium">ลูกค้า</th>
              <th className="px-4 py-3 font-medium">เงื่อนไข</th>
              <th className="px-4 py-3 font-medium">ครบกำหนด</th>
              <th className="px-4 py-3 text-right font-medium">จำนวนเงิน</th>
              <th className="px-4 py-3 font-medium">การวางบิล</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((r) => (
              <tr key={r.so} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 dark:text-slate-400">{r.so}</td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={r.customerName.replace(/^(บจก\.|หจก\.|ร้าน)\s*/, "")} size="sm" />
                    <span className="text-slate-900 dark:text-slate-50">{r.customerName}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{r.terms}</td>
                <td className={"px-4 py-2.5 tabular-nums " + (r.overdueDays > 0 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400")}>
                  {r.due}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(r.amount)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={r.billed ? "ok" : "warn"}>{r.billed ? "วางบิลแล้ว" : "ยังไม่วางบิล"}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={r.overdueDays > 0 ? "bad" : "ok"} dot>
                    {r.overdueDays > 0 ? `เลยกำหนด ${r.overdueDays} วัน` : "ยังไม่ถึงกำหนด"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title={<span className="flex items-center gap-2"><Layers size={15} className="text-slate-400" />อายุหนี้ลูกหนี้</span>}>
        <Aging rows={rows.map((r) => ({ amount: r.amount, overdueDays: r.overdueDays }))} tone="warn" />
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- assets */

function Assets({ onOpen }: { onOpen: (a: Asset) => void }) {
  const cost = ASSETS.reduce((n, a) => n + a.cost, 0);
  const accum = ASSETS.reduce((n, a) => n + accumulated(a), 0);
  const monthly = ASSETS.reduce((n, a) => n + monthlyDepreciation(a), 0);

  return (
    <div className="space-y-3">
      <StatStrip
        title="สินทรัพย์ถาวร"
        icon={<Landmark size={15} />}
        cells={[
          { icon: <Landmark size={13} />, label: "ราคาทุนรวม", value: baht(cost), sub: `${ASSETS.length} รายการในทะเบียน` },
          { icon: <TrendingDown size={13} />, label: "ค่าเสื่อมราคาสะสม", value: baht(accum), sub: "คิดด้วยวิธีเส้นตรง", tone: "warn" },
          { icon: <Scale size={13} />, label: "มูลค่าคงเหลือตามบัญชี", value: baht(cost - accum), sub: "ราคาทุนหักค่าเสื่อมสะสม", tone: "ok" },
          { icon: <CalendarClock size={13} />, label: "ค่าเสื่อมต่อเดือน", value: baht(monthly), sub: "ลงบัญชีทุกสิ้นงวด", tone: "accent" },
        ]}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        {ASSETS.map((a) => {
          const acc = accumulated(a);
          const held = monthsHeld(a);
          const life = a.lifeYears * 12;
          const sw = swatchFor(a.code);
          return (
            <Card
              key={a.code}
              title={
                <button onClick={() => onOpen(a)} className="flex items-center gap-2.5 text-left transition hover:text-violet-700">
                  <span className={"grid size-8 place-items-center rounded-lg " + sw.tint}>
                    <Landmark size={15} />
                  </span>
                  {a.name}
                </button>
              }
              subtitle={`${a.code} · ได้มาเมื่อ ${a.acquired} · อายุการใช้งาน ${a.lifeYears} ปี`}
              action={<Badge tone={held >= life ? "idle" : "ok"}>{held >= life ? "ตัดค่าเสื่อมครบแล้ว" : `ใช้มา ${held} เดือน`}</Badge>}
            >
              <div className="space-y-3 p-4">
                <Progress done={Math.min(held, life)} total={life} label={`อายุการใช้งานที่ผ่านไป ${Math.min(held, life)} จาก ${life} เดือน`} />
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "ราคาทุน", value: baht(a.cost) },
                    { label: "ค่าเสื่อมสะสม", value: baht(acc) },
                    { label: "มูลค่าคงเหลือ", value: baht(a.cost - acc) },
                  ].map((c) => (
                    <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                      <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
                      <div className="mt-1 text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ statements */

function Statements({
  pl,
  bs,
}: {
  pl: ReturnType<typeof profitAndLoss>;
  bs: ReturnType<typeof balanceSheet>;
}) {
  const [view, setView] = useState(STATEMENT_TABS[0]);

  return (
    <div className="space-y-3">
      <Tabs tabs={STATEMENT_TABS} active={view} onPick={setView} icons={STATEMENT_ICONS} id="statement" />

      {view === "งบกำไรขาดทุน" && (
        <div className="grid gap-3 xl:grid-cols-3">
          <Card
            className="xl:col-span-2"
            title={<span className="flex items-center gap-2"><TrendingUp size={15} className="text-slate-400" />งบกำไรขาดทุน</span>}
            subtitle={`${PERIOD.label} · คำนวณจากยอดคงเหลือในสมุดรายวันทั้งหมด`}
          >
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              <li className="flex items-center justify-between px-4 py-3">
                <span className="text-[13px] font-medium text-slate-900 dark:text-slate-50">รายได้จากการขาย</span>
                <span className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(pl.revenue)}</span>
              </li>
              {pl.expenses.map((a) => (
                <li key={a.code} className="flex items-center gap-3 px-4 py-2.5">
                  <Dot className={swatchFor(a.code).dot} />
                  <span className="min-w-0 flex-1 text-[13px] text-slate-700 dark:text-slate-200">{a.name}</span>
                  <span className="w-24 shrink-0">
                    <Bar pct={pl.revenue ? (a.balance / pl.revenue) * 100 : 0} tone="bad" width="w-full" />
                  </span>
                  <span className="w-28 shrink-0 text-right text-[13px] tabular-nums text-rose-600 dark:text-rose-400">
                    −{baht(a.balance)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
                  {pl.profit >= 0 ? "กำไรสุทธิ" : "ขาดทุนสุทธิ"}
                </span>
                <span className={"text-[16px] font-semibold tabular-nums " + (pl.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {baht(pl.profit)}
                </span>
              </li>
            </ul>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Coins size={15} className="text-slate-400" />สัดส่วนค่าใช้จ่าย</span>}>
            <div className="p-4">
              <Donut
                segments={pl.expenses.filter((a) => a.balance > 0).map((a) => ({ label: a.name, value: a.balance, swatch: swatchFor(a.code) }))}
                size={128}
                format={(n) => baht(n)}
                center={
                  <span>
                    <span className="block text-[18px] font-semibold leading-none tabular-nums text-slate-900 dark:text-slate-50">
                      {Math.round((pl.expenseTotal / pl.revenue) * 100)}%
                    </span>
                    <span className="mt-1 block text-[10.5px] uppercase tracking-wide text-slate-400">ของรายได้</span>
                  </span>
                }
              />
            </div>
          </Card>
        </div>
      )}

      {view === "งบแสดงฐานะการเงิน" && (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card
              title={<span className="flex items-center gap-2"><Wallet size={15} className="text-slate-400" />สินทรัพย์</span>}
              action={<Chip>{baht(bs.assetTotal)}</Chip>}
            >
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {bs.assets.map((a) => (
                  <li key={a.code} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="font-mono text-[11.5px] text-slate-400">{a.code}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{a.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-900 dark:text-slate-50">{baht(a.balance)}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">รวมสินทรัพย์</span>
                  <span className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{baht(bs.assetTotal)}</span>
                </li>
              </ul>
            </Card>

            <Card
              title={<span className="flex items-center gap-2"><Scale size={15} className="text-slate-400" />หนี้สินและส่วนของเจ้าของ</span>}
              action={<Chip>{baht(bs.liabilityTotal + bs.equityTotal + bs.profit)}</Chip>}
            >
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...bs.liabilities, ...bs.equity].map((a) => (
                  <li key={a.code} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="font-mono text-[11.5px] text-slate-400">{a.code}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">{a.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-900 dark:text-slate-50">{baht(-a.balance)}</span>
                  </li>
                ))}
                <li className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                  <span className="font-mono text-[11.5px] text-slate-400">—</span>
                  <span className="min-w-0 flex-1 text-slate-800 dark:text-slate-100">
                    {bs.profit >= 0 ? "กำไรงวดนี้" : "ขาดทุนงวดนี้"}
                  </span>
                  <span className={"shrink-0 tabular-nums " + (bs.profit >= 0 ? "text-slate-900 dark:text-slate-50" : "text-rose-600 dark:text-rose-400")}>
                    {baht(bs.profit)}
                  </span>
                </li>
                <li className="flex items-center justify-between bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                  <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">รวมหนี้สินและส่วนของเจ้าของ</span>
                  <span className="text-[14px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                    {baht(bs.liabilityTotal + bs.equityTotal + bs.profit)}
                  </span>
                </li>
              </ul>
            </Card>
          </div>

          <Note tone={bs.balances ? "ok" : "bad"}>
            {bs.balances
              ? "งบดุลลงตัว สินทรัพย์เท่ากับหนี้สินบวกส่วนของเจ้าของบวกกำไรงวดนี้"
              : `สินทรัพย์ไม่เท่ากับหนี้สินบวกส่วนของเจ้าของ ต่างกัน ${baht(Math.abs(bs.assetTotal - (bs.liabilityTotal + bs.equityTotal + bs.profit)))}`}
          </Note>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- records */

function EntryRecord({ e }: { e: JournalEntry }) {
  const debit = e.lines.filter((l) => l.amount > 0);
  const credit = e.lines.filter((l) => l.amount < 0);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="เลขที่">{e.no}</IconRow>
        <IconRow icon={<CalendarClock size={14} />} label="วันที่">{e.date}</IconRow>
        <IconRow icon={<BookOpen size={14} />} label="คำอธิบาย">{e.memo}</IconRow>
        {e.ref && <IconRow icon={<Receipt size={14} />} label="เอกสารต้นทาง">{e.ref}</IconRow>}
      </div>

      <table className="w-full text-[13px]">
        <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2.5 font-medium">บัญชี</th>
            <th className="px-3 py-2.5 font-medium">ประเภท</th>
            <th className="px-3 py-2.5 text-right font-medium">เดบิต</th>
            <th className="px-3 py-2.5 text-right font-medium">เครดิต</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {e.lines.map((l) => {
            const a = account(l.account);
            return (
              <tr key={l.account}>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <Dot className={typeSwatch(a.type).dot} />
                    <span className="font-mono text-[11.5px] text-slate-400">{l.account}</span>
                    <span className="text-slate-900 dark:text-slate-50">{a.name}</span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Tag swatch={typeSwatch(a.type)}>{a.type}</Tag>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                  {l.amount > 0 ? baht(l.amount) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                  {l.amount < 0 ? baht(-l.amount) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-slate-50/80 dark:bg-slate-800/60">
          <tr>
            <td colSpan={2} className="px-3 py-2.5 text-right font-medium text-slate-600 dark:text-slate-300">
              รวมทั้งสองด้าน
            </td>
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {baht(debit.reduce((n, l) => n + l.amount, 0))}
            </td>
            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {baht(-credit.reduce((n, l) => n + l.amount, 0))}
            </td>
          </tr>
        </tfoot>
      </table>

      <Note tone={isBalanced(e) ? "ok" : "bad"}>
        {isBalanced(e)
          ? "รายการนี้เดบิตเท่ากับเครดิต ลงบัญชีได้"
          : `รายการนี้เดบิตไม่เท่าเครดิต ต่างกัน ${baht(Math.abs(e.lines.reduce((n, l) => n + l.amount, 0)))}`}
      </Note>
    </div>
  );
}

function AccountRecord({ a, onOpenEntry }: { a: TrialRow; onOpenEntry: (e: JournalEntry) => void }) {
  const entries = JOURNAL.filter((e) => e.lines.some((l) => l.account === a.code));
  let running = 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="รหัสบัญชี">{a.code}</IconRow>
        <IconRow icon={<Layers size={14} />} label="ประเภท">{a.type}</IconRow>
        <IconRow icon={<Sigma size={14} />} label="ยอดคงเหลือ">
          {a.balance >= 0 ? `${baht(a.balance)} ทางเดบิต` : `${baht(-a.balance)} ทางเครดิต`}
        </IconRow>
        <IconRow icon={<BookOpen size={14} />} label="จำนวนรายการ">{entries.length} รายการ</IconRow>
      </div>

      <table className="w-full text-[13px]">
        <thead className="bg-slate-50/80 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2.5 font-medium">เลขที่</th>
            <th className="px-3 py-2.5 font-medium">วันที่</th>
            <th className="px-3 py-2.5 font-medium">คำอธิบาย</th>
            <th className="px-3 py-2.5 text-right font-medium">เดบิต</th>
            <th className="px-3 py-2.5 text-right font-medium">เครดิต</th>
            <th className="px-3 py-2.5 text-right font-medium">ยอดสะสม</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {entries.map((e) => {
            const amount = e.lines.filter((l) => l.account === a.code).reduce((n, l) => n + l.amount, 0);
            running += amount;
            return (
              <tr
                key={e.no}
                onClick={() => onOpenEntry(e)}
                className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                <td className="px-3 py-2 font-mono text-[11.5px] text-slate-500 dark:text-slate-400">{e.no}</td>
                <td className="px-3 py-2 tabular-nums text-slate-500 dark:text-slate-400">{e.date}</td>
                <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{e.memo}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                  {amount > 0 ? baht(amount) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">
                  {amount < 0 ? baht(-amount) : "—"}
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900 dark:text-slate-50">
                  {baht(running)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssetRecord({ a }: { a: Asset }) {
  const acc = accumulated(a);
  const held = monthsHeld(a);
  const life = a.lifeYears * 12;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <IconRow icon={<FileText size={14} />} label="รหัสสินทรัพย์">{a.code}</IconRow>
        <IconRow icon={<CalendarClock size={14} />} label="วันที่ได้มา">{a.acquired}</IconRow>
        <IconRow icon={<Landmark size={14} />} label="ราคาทุน">{baht(a.cost)}</IconRow>
        <IconRow icon={<Layers size={14} />} label="อายุการใช้งาน">{a.lifeYears} ปี ({life} เดือน)</IconRow>
        <IconRow icon={<TrendingDown size={14} />} label="ค่าเสื่อมต่อเดือน">{baht(monthlyDepreciation(a))}</IconRow>
      </div>

      <Progress done={Math.min(held, life)} total={life} label={`ตัดค่าเสื่อมไปแล้ว ${Math.min(held, life)} จาก ${life} เดือน`} />

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "ค่าเสื่อมสะสม", value: baht(acc) },
          { label: "มูลค่าคงเหลือตามบัญชี", value: baht(a.cost - acc) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400">{c.label}</div>
            <div className="mt-1 text-[15px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">{c.value}</div>
          </div>
        ))}
      </div>

      <Note tone={held >= life ? "idle" : "ok"}>
        {held >= life
          ? "ตัดค่าเสื่อมราคาครบอายุการใช้งานแล้ว มูลค่าตามบัญชีเป็นศูนย์"
          : `เหลืออีก ${life - held} เดือนจึงจะตัดค่าเสื่อมครบ คิดด้วยวิธีเส้นตรงเดือนละ ${baht(monthlyDepreciation(a))}`}
      </Note>
    </div>
  );
}

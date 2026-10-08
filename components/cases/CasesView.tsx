"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Inbox, Loader2, Plus, Search, Send } from "lucide-react";
import ImageLightbox from "@/components/ui/ImageLightbox";
import { useFileDrop } from "@/lib/useFileDrop";
import { CASE_STATUS, CASE_STATUSES, type CaseDetail, type CaseStatus, type CaseSummary } from "@/lib/cases";
import { getCase, listCases, replyToCase } from "@/lib/cases-client";
import ReportCaseModal, { ContextRows } from "./ReportCaseModal";
import {
  ago,
  ImagePickButton,
  Initial,
  KindPill,
  PendingImages,
  personName,
  StatusPill,
  useCaseImages,
  when,
} from "./CaseBits";

type Filter = "open" | "released" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "ยังไม่ปิด" },
  { key: "released", label: "ปล่อยแล้ว" },
  { key: "all", label: "ทั้งหมด" },
];

/**
 * แจ้งเคส / ติดตามปัญหา — the list of cases on the left, the open one's thread
 * on the right. The team sees every case and can switch to their own; everyone
 * else sees the cases they reported.
 */
export default function CasesView({ initialId }: { initialId: string | null }) {
  const [team, setTeam] = useState(false);
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(initialId);
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [reporting, setReporting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadList = useCallback(async () => {
    try {
      const res = await listCases(scope);
      setTeam(res.team);
      setCases(res.cases);
      setListError(null);
      setNow(Date.now());
    } catch (e) {
      setListError(e instanceof Error ? e.message : "โหลดเคสไม่สำเร็จ");
    }
  }, [scope]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Coming back to the tab is when someone wants to know if the team answered.
  useEffect(() => {
    const onFocus = () => void loadList();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadList]);

  const open = (id: string) => {
    setSelected(id);
    setCases((prev) => prev?.map((c) => (c.id === id ? { ...c, unread: false } : c)) ?? prev);
    window.history.replaceState(null, "", `/cases?id=${id}`);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (cases ?? []).filter((c) => {
      if (filter === "open" && c.status === "released") return false;
      if (filter === "released" && c.status !== "released") return false;
      if (!q) return true;
      return [`#${c.number}`, c.title, c.reporter.name, c.reporter.email, c.project?.name]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q));
    });
  }, [cases, filter, query]);

  return (
    <div className="flex h-full min-h-0">
      <section className="flex w-[23rem] shrink-0 flex-col border-r border-night-edge">
        <div className="flex flex-col gap-3 border-b border-night-edge px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="font-display text-lg font-semibold text-chalk">แจ้งเคส / ติดตามปัญหา</h1>
            <button
              onClick={() => setReporting(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-shine px-3 py-1.5 font-display text-[12px] font-semibold text-night transition hover:brightness-110"
            >
              <Plus size={14} /> แจ้งเคสใหม่
            </button>
          </div>
          <label className="flex items-center gap-2 rounded-md border border-night-edge bg-night px-2.5 py-1.5 focus-within:border-shine">
            <Search size={14} className="shrink-0 text-chalk-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={team ? "ค้นหาเลขเคส หัวข้อ ผู้แจ้ง โปรเจกต์" : "ค้นหาเลขเคส หัวข้อ โปรเจกต์"}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-chalk outline-none placeholder:text-chalk-dim/60"
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`rounded-full px-2.5 py-1 font-display text-[11.5px] transition ${
                  filter === f.key ? "bg-chalk/10 text-chalk" : "text-chalk-dim hover:text-chalk"
                }`}
              >
                {f.label}
              </button>
            ))}
            {team && (
              <div className="ml-auto flex rounded-full border border-night-edge p-0.5">
                {(["all", "mine"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    aria-pressed={scope === s}
                    className={`rounded-full px-2.5 py-0.5 font-display text-[11px] transition ${
                      scope === s ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
                    }`}
                  >
                    {s === "all" ? "ทุกคน" : "ของฉัน"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
          {listError ? (
            <p className="m-2 rounded border border-halt/40 bg-halt/10 px-3 py-2 text-xs text-halt">{listError}</p>
          ) : cases === null ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-chalk-dim">
              <Loader2 size={14} className="animate-spin" /> กำลังโหลด…
            </div>
          ) : shown.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] leading-relaxed text-chalk-dim">
              {cases.length === 0
                ? "ยังไม่มีเคส เจอปัญหาตอนใช้งานกด แจ้งเคสใหม่ หรือกด รายงานปัญหา จากหน้าที่เห็น error"
                : "ไม่มีเคสที่ตรงกับตัวกรองนี้"}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {shown.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => open(c.id)}
                    className={`flex w-full gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      selected === c.id
                        ? "border-shine/60 bg-shine/[0.06]"
                        : "border-transparent hover:border-night-edge hover:bg-chalk/[0.03]"
                    }`}
                  >
                    <Initial name={team ? personName(c.reporter) : (c.project?.name ?? c.title)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-display text-[13px] font-semibold text-chalk">
                          {team ? personName(c.reporter) : (c.project?.name ?? "ไม่ได้ผูกกับโปรเจกต์")}
                        </span>
                        <span className="shrink-0 text-[11px] text-chalk-dim">{ago(c.updatedAt, now)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-chalk/85">{c.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusPill status={c.status} />
                        <KindPill kind={c.kind} />
                        <span className="font-mono text-[11px] text-chalk-dim">#{c.number}</span>
                        {c.unread && (
                          <span className="ml-auto inline-flex items-center gap-1 font-display text-[11px] font-semibold text-shine">
                            <span className="h-2 w-2 rounded-full bg-shine" />
                            ใหม่
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <CaseThread key={selected} id={selected} onChanged={() => void loadList()} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center text-chalk-dim">
            <Inbox size={28} className="text-chalk-dim/60" />
            <p className="text-[13px]">เลือกเคสทางซ้ายเพื่อดูรายละเอียดและคุยกับทีม</p>
          </div>
        )}
      </section>

      {reporting && (
        <ReportCaseModal
          preset={{ kind: "other" }}
          onClose={() => {
            setReporting(false);
            void loadList();
          }}
          onOpenCase={(id) => {
            setReporting(false);
            void loadList();
            open(id);
          }}
        />
      )}
    </div>
  );
}

function CaseThread({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [team, setTeam] = useState(false);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<CaseStatus | "">("");
  const [fixedIn, setFixedIn] = useState("");
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const images = useCaseImages();
  const { dragging, dropHandlers } = useFileDrop((files) => void images.add(Array.from(files)));

  const load = useCallback(async () => {
    try {
      const res = await getCase(id);
      setTeam(res.team);
      setDetail(res.case);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดเคสไม่สำเร็จ");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    setSending(true);
    try {
      await replyToCase(id, {
        body: body.trim(),
        attachments: images.images,
        status: status || null,
        fixedIn: (status === "fixed" || status === "released") && fixedIn.trim() ? fixedIn.trim() : null,
      });
      setBody("");
      setStatus("");
      setFixedIn("");
      images.clear();
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  const canSend =
    !sending && images.uploading === 0 && (body.trim().length > 0 || images.images.length > 0 || status !== "");

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canSend) {
      e.preventDefault();
      void send();
    }
  };

  if (!detail) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-chalk-dim">
        {error ? (
          <p className="rounded border border-halt/40 bg-halt/10 px-3 py-2 text-xs text-halt">{error}</p>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> กำลังโหลดเคส…
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-night-edge px-6 py-4">
        <h2 className="font-display text-xl font-semibold leading-snug text-chalk">
          <span className="mr-2 text-chalk-dim">#{detail.number}</span>
          {detail.title}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusPill status={detail.status} />
          <KindPill kind={detail.kind} />
          {detail.fixedIn && (
            <span className="rounded-full border border-night-edge px-2 py-0.5 font-display text-[11px] text-chalk-dim">
              แก้ในเวอร์ชัน {detail.fixedIn}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[12.5px] text-chalk-dim">{CASE_STATUS[detail.status].hint}</p>
        <p className="mt-2 text-[12px] text-chalk-dim">
          แจ้งโดย <span className="text-chalk">{personName(detail.reporter)}</span>
          {team && detail.reporter.email && detail.reporter.name ? ` (${detail.reporter.email})` : ""} ·{" "}
          {when(detail.createdAt)}
          {detail.project && (
            <>
              {" · "}
              <Link href={`/project/${detail.project.id}`} className="text-shine hover:underline">
                {detail.project.name}
              </Link>
            </>
          )}
        </p>
      </header>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="rounded-lg border border-night-edge bg-night-panel">
          <button
            onClick={() => setShowContext((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-display text-[12px] text-chalk-dim transition hover:text-chalk"
          >
            {showContext ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            ข้อมูลที่ระบบแนบมากับเคส
            {detail.context.error && !showContext && (
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-halt">{detail.context.error}</span>
            )}
          </button>
          {showContext && <ContextRows context={detail.context} projectName={detail.project?.name ?? null} />}
        </div>

        <ol className="mt-5 flex flex-col gap-5">
          {detail.messages.map((m) => {
            const name = m.authorKind === "team" ? (m.author ? personName(m.author) : "ทีม FITT Builder") : personName(m.author ?? detail.reporter);
            return (
              <li key={m.id} className="flex flex-col gap-3">
                {m.statusTo && (
                  <div className="flex items-center gap-2 text-[12px] text-chalk-dim">
                    <span className="h-px flex-1 bg-night-edge" />
                    <span>{name} เปลี่ยนสถานะเป็น</span>
                    <StatusPill status={m.statusTo} />
                    {m.fixedIn && <span>เวอร์ชัน {m.fixedIn}</span>}
                    <span>· {when(m.createdAt)}</span>
                    <span className="h-px flex-1 bg-night-edge" />
                  </div>
                )}
                {(m.body || m.attachments.length > 0) && (
                  <div className="flex gap-3">
                    <Initial name={name} team={m.authorKind === "team"} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-display text-[13px] font-semibold text-chalk">{name}</span>
                        {m.authorKind === "team" && m.author && (
                          <span className="rounded-full bg-shine/15 px-1.5 py-0.5 font-display text-[10px] font-semibold text-shine">
                            ทีม FITT Builder
                          </span>
                        )}
                        <span className="text-[11px] text-chalk-dim">{when(m.createdAt)}</span>
                      </div>
                      {m.body && (
                        <p
                          className={`mt-1.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-chalk/90 ${
                            m.authorKind === "team" ? "rounded-lg border border-shine/25 bg-shine/[0.06] px-3.5 py-2.5" : ""
                          }`}
                        >
                          {m.body}
                        </p>
                      )}
                      {m.attachments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {m.attachments.map((a) =>
                            a.url ? (
                              <button
                                key={a.path}
                                onClick={() => setLightbox(a.url!)}
                                className="overflow-hidden rounded-lg border border-night-edge transition hover:border-shine"
                                title={a.name}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.url} alt={a.name} className="h-24 w-36 object-cover" />
                              </button>
                            ) : (
                              <span key={a.path} className="text-[11px] text-chalk-dim">
                                {a.name} (เปิดไม่ได้)
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {detail.messages.length === 0 && (
            <li className="text-[13px] text-chalk-dim">ยังไม่มีข้อความในเคสนี้</li>
          )}
        </ol>
      </div>

      {/* pr-16: the floating theme toggle owns the bottom-right corner of every page. */}
      <div
        {...dropHandlers}
        className={`shrink-0 border-t border-night-edge py-4 pl-4 pr-16 ${dragging ? "bg-shine/[0.04]" : ""}`}
      >
        {error && (
          <p className="mb-2 rounded border border-halt/40 bg-halt/10 px-3 py-2 text-xs text-halt">{error}</p>
        )}
        <div className="rounded-xl border border-night-edge bg-night focus-within:border-shine">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={images.onPaste}
            onKeyDown={onKeyDown}
            rows={3}
            maxLength={10_000}
            placeholder={
              team
                ? "ตอบผู้แจ้ง หรือบอกว่าแก้อะไรไปแล้ว"
                : "ตอบกลับ หรือเพิ่มข้อมูล เช่น “ลองแล้วยังไม่ได้” หรือแนบภาพเพิ่ม"
            }
            className="block w-full resize-none rounded-t-xl bg-transparent px-3.5 py-3 text-[13.5px] leading-relaxed text-chalk outline-none placeholder:text-chalk-dim/60"
          />
          <div className="px-3">
            <PendingImages images={images.images} uploading={images.uploading} onRemove={images.remove} />
          </div>
          <div className="flex flex-wrap items-center gap-2 px-2 py-2">
            <ImagePickButton onFiles={(files) => void images.add(files)} disabled={sending} />
            {team && (
              <>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CaseStatus | "")}
                  className="rounded-md border border-night-edge bg-night px-2 py-1 font-display text-[12px] text-chalk outline-none focus:border-shine"
                >
                  <option value="">สถานะเดิม ({CASE_STATUS[detail.status].label})</option>
                  {CASE_STATUSES.filter((s) => s !== detail.status).map((s) => (
                    <option key={s} value={s}>
                      เปลี่ยนเป็น {CASE_STATUS[s].label}
                    </option>
                  ))}
                </select>
                {(status === "fixed" || status === "released") && (
                  <input
                    value={fixedIn}
                    onChange={(e) => setFixedIn(e.target.value)}
                    maxLength={60}
                    placeholder="เวอร์ชันที่แก้ เช่น 0.96.1"
                    className="w-44 rounded-md border border-night-edge bg-night px-2 py-1 text-[12px] text-chalk outline-none placeholder:text-chalk-dim/60 focus:border-shine"
                  />
                )}
              </>
            )}
            <span className="ml-auto hidden text-[11px] text-chalk-dim sm:inline">Ctrl + Enter เพื่อส่ง</span>
            <button
              onClick={() => void send()}
              disabled={!canSend}
              className="inline-flex items-center gap-1.5 rounded-full bg-shine px-3.5 py-1.5 font-display text-[12.5px] font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              ส่ง
            </button>
          </div>
        </div>
      </div>

      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

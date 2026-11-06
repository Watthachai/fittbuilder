"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, ExternalLink, FileText, Forward, Inbox, Loader2, SearchCheck, Undo2 } from "lucide-react";
import QuotationPrint from "@/components/studio/QuotationPrint";
import ProposalPrint from "@/components/studio/ProposalPrint";
import { listCompanyMembers } from "@/lib/company";
import { currentUser } from "@/lib/current-user";
import { decideApproval, myApprovals, type ApprovalItem } from "@/lib/doc-approval-store";
import { parseProposal } from "@/lib/proposal";
import type { ProposalModule } from "@/lib/proposal-modules";
import { loadProposal } from "@/lib/proposal-store";
import { parseDoc, thaiDateShort, type QuoteDoc } from "@/lib/quote";
import { loadQuote } from "@/lib/quote-store";
import { listShots, type Shot } from "@/lib/shots";
import { toast } from "@/lib/toast";
import { useApprovalInbox } from "./ApprovalInbox";
import { VERSION_LABEL } from "@/lib/versions";

const KIND_LABEL = { quote: "ใบเสนอราคา", proposal: "ข้อเสนอโครงการ" } as const;

/**
 * The approver's page: documents sent to them, read as the customer will get
 * them, then approved or returned with a reason
 * (docs/superpowers/specs/2026-11-03-document-approval-design.md). A reviewer
 * reads here too, first, and passes the document on to its approver
 * (migration 0066).
 */
export default function ApprovalsView() {
  const [meId, setMeId] = useState<string | null>(null);
  const [lists, setLists] = useState<{ waiting: ApprovalItem[]; decided: ApprovalItem[] } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());

  const reload = useCallback(async (me: string) => {
    const found = await myApprovals(me);
    setLists(found);
    setOpenId((cur) => cur ?? found.waiting[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void currentUser().then((me) => {
      if (!me) return;
      setMeId(me.id);
      reload(me.id).catch((e) => {
        console.error("[approvals] load failed:", e);
        setLists({ waiting: [], decided: [] });
      });
    });
    // Reviewers and approvers are the company's people; anyone else reads by role.
    void listCompanyMembers()
      .then((people) => setNames(new Map(people.map((p) => [p.userId, p.name || p.email]))))
      .catch((e) => console.error("[approvals] names failed:", e));
  }, [reload]);

  const open = useMemo(
    () => [...(lists?.waiting ?? []), ...(lists?.decided ?? [])].find((i) => i.id === openId) ?? null,
    [lists, openId]
  );

  return (
    <div className="flex h-full min-h-0">
      <section className="w-80 shrink-0 overflow-y-auto border-r border-night-edge p-4">
        <h1 className="font-display text-lg font-semibold text-chalk">อนุมัติเอกสาร</h1>
        <p className="mt-1 text-[0.78125rem] leading-relaxed text-chalk-dim">
          ใบเสนอราคาและข้อเสนอโครงการที่ส่งมาให้คุณตรวจ ก่อนส่งถึงลูกค้า
        </p>
        {lists === null ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-chalk-dim">
            <Loader2 size={14} className="animate-spin" /> กำลังโหลด…
          </p>
        ) : (
          <>
            <ListHead
              label={`${lists.waiting.some((i) => i.stage === "review") ? "รอคุณตรวจหรืออนุมัติ" : "รอคุณอนุมัติ"} (${lists.waiting.length})`}
            />
            {lists.waiting.length === 0 ? (
              <p className="flex items-center gap-2 px-1 py-2 text-[0.78125rem] text-chalk-dim">
                <Inbox size={13} /> ไม่มีเอกสารรออนุมัติ
              </p>
            ) : (
              lists.waiting.map((i) => <Entry key={i.id} item={i} active={i.id === openId} onOpen={setOpenId} />)
            )}
            {lists.decided.length > 0 && (
              <>
                <ListHead label="ที่คุณดำเนินการล่าสุด" />
                {lists.decided.map((i) => (
                  <Entry key={i.id} item={i} active={i.id === openId} onOpen={setOpenId} />
                ))}
              </>
            )}
          </>
        )}
      </section>

      <section className="min-w-0 flex-1 overflow-y-auto p-4">
        {open && meId ? (
          <Review
            key={open.id}
            item={open}
            meId={meId}
            onDesk={lists?.waiting.some((i) => i.id === open.id) ?? false}
            nameOf={(id, role) => names.get(id) ?? role}
            onDecided={() => void reload(meId)}
          />
        ) : (
          <p className="mt-10 text-center text-sm text-chalk-dim">เลือกเอกสารทางซ้ายเพื่อตรวจ</p>
        )}
      </section>
    </div>
  );
}

function ListHead({ label }: { label: string }) {
  return <p className="mt-5 px-1 pb-1.5 font-display text-[0.75rem] font-semibold text-chalk-dim">{label}</p>;
}

/** Where a request in the list stands, from where I sit. */
function entryMark(item: ApprovalItem): { text: string; tone: string } | null {
  if (item.status === "approved") return { text: "อนุมัติแล้ว", tone: "text-go" };
  if (item.status === "returned") return { text: "ส่งกลับ", tone: "text-halt" };
  if (item.stage === "review") return { text: "รอตรวจ", tone: "text-shine" };
  if (item.reviewedAt) return { text: "ตรวจแล้ว", tone: "text-shine" };
  return null;
}

function Entry({ item, active, onOpen }: { item: ApprovalItem; active: boolean; onOpen: (id: string) => void }) {
  const mark = entryMark(item);
  return (
    <button
      onClick={() => onOpen(item.id)}
      className={`mb-1 w-full rounded-lg border px-3 py-2 text-left transition ${
        active ? "border-shine/60 bg-chalk/5" : "border-night-edge hover:border-shine/40"
      }`}
    >
      <p className="truncate text-[0.8125rem] text-chalk">{item.projectName}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[0.71875rem] text-chalk-dim">
        <FileText size={11} /> {KIND_LABEL[item.kind]} · {VERSION_LABEL[item.version]} ·{" "}
        {thaiDateShort((item.decidedAt ?? item.requestedAt).slice(0, 10))}
        {mark && <span className={mark.tone}>· {mark.text}</span>}
      </p>
    </button>
  );
}

/**
 * One request: the paper as sent, and the decision. `onDesk` is whether it
 * waits on me now — to review, or to approve; a request I passed on after
 * review stays pending but is no longer mine to act on.
 */
function Review({
  item,
  meId,
  onDesk,
  nameOf,
  onDecided,
}: {
  item: ApprovalItem;
  meId: string;
  onDesk: boolean;
  nameOf: (id: string, role: string) => string;
  onDecided: () => void;
}) {
  const reviewing = onDesk && item.stage === "review";
  const approverName = nameOf(item.approverId, "ผู้อนุมัติ");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [shots, setShots] = useState<Shot[]>([]);
  const [modules, setModules] = useState<ProposalModule[]>([]);
  const [quote, setQuote] = useState<QuoteDoc | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const quoteDoc = item.kind === "quote" ? parseDoc(item.snapshot, today) : null;
  const proposalDoc = item.kind === "proposal" ? parseProposal(item.snapshot, today) : null;

  // The pictures and the parts the paper reads from beside the document itself.
  useEffect(() => {
    let alive = true;
    void listShots(item.projectId, item.version)
      .catch(() => [] as Shot[])
      .then((s) => alive && setShots(s));
    void loadProposal(item.projectId, item.version, today)
      .catch(() => null)
      .then((p) => alive && setModules(p?.modules ?? []));
    if (item.kind === "proposal") {
      void loadQuote(item.projectId, item.version, today)
        .catch(() => null)
        .then((q) => alive && setQuote(q));
    }
    return () => {
      alive = false;
    };
  }, [item.projectId, item.version, item.kind, today]);

  const { refresh: refreshInbox } = useApprovalInbox();
  const decide = async (approve: boolean) => {
    if (!approve && !note.trim()) {
      toast.error("ใส่เหตุผลที่ส่งกลับก่อน", { description: "คนส่งจะเห็นข้อความนี้และแก้ตาม" });
      return;
    }
    setBusy(true);
    try {
      await decideApproval(item.id, approve, note);
      refreshInbox();
      toast.success(!approve ? "ส่งกลับให้แก้แล้ว" : reviewing ? `ส่งต่อให้ ${approverName} อนุมัติแล้ว` : "อนุมัติแล้ว");
      onDecided();
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-chalk">
            {KIND_LABEL[item.kind]} · {item.projectName}
          </p>
          <p className="mt-0.5 text-[0.78125rem] text-chalk-dim">
            เวอร์ชัน{VERSION_LABEL[item.version]} · ส่งเมื่อ {thaiDateShort(item.requestedAt.slice(0, 10))}
          </p>
        </div>
        <Link
          href={`/project/${item.projectId}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1.5 text-[0.78125rem] text-chalk-dim transition hover:border-shine/60 hover:text-chalk"
        >
          <ExternalLink size={12} /> เปิดโปรเจกต์ (ดูอย่างเดียว)
        </Link>
      </div>

      {item.reviewerId && item.reviewedAt && item.stage === "approve" && (
        <div className="mt-4 rounded-xl border border-night-edge px-3 py-2.5 text-[0.8125rem]">
          <p className="flex items-center gap-1.5 text-chalk">
            <SearchCheck size={13} className="text-shine" /> ตรวจแล้วโดย {nameOf(item.reviewerId, "ผู้ตรวจ")} ·{" "}
            {thaiDateShort(item.reviewedAt.slice(0, 10))}
          </p>
          {item.reviewNote && <p className="mt-1 whitespace-pre-wrap text-chalk-dim">{item.reviewNote}</p>}
        </div>
      )}

      {onDesk ? (
        <div className="mt-4 rounded-xl border border-night-edge p-3">
          {reviewing && (
            <p className="mb-2 text-[0.78125rem] leading-relaxed text-chalk-dim">
              คุณเป็นผู้ตรวจ — ตรวจแล้วส่งต่อให้ {approverName} อนุมัติ หรือส่งกลับให้คนส่งแก้
            </p>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={
              reviewing
                ? "หมายเหตุถึงผู้อนุมัติ — ต้องใส่เมื่อส่งกลับให้แก้"
                : "หมายเหตุ — ต้องใส่เมื่อส่งกลับให้แก้"
            }
            className="w-full resize-y rounded-lg border border-night-edge bg-night px-3 py-2 text-[0.8125rem] text-chalk outline-none placeholder:text-chalk-dim/60 focus:border-shine"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => void decide(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-go px-3 py-1.5 font-display text-[0.8125rem] font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : reviewing ? (
                <Forward size={13} />
              ) : (
                <BadgeCheck size={13} />
              )}{" "}
              {reviewing ? "ตรวจแล้ว ส่งต่อให้ผู้อนุมัติ" : "อนุมัติ"}
            </button>
            <button
              onClick={() => void decide(false)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-halt/60 px-3 py-1.5 font-display text-[0.8125rem] text-halt transition hover:bg-halt/10 disabled:opacity-50"
            >
              <Undo2 size={13} /> ส่งกลับให้แก้
            </button>
          </div>
        </div>
      ) : (
        <p
          className={`mt-4 text-[0.8125rem] ${
            item.status === "approved" ? "text-go" : item.status === "returned" ? "text-halt" : "text-shine"
          }`}
        >
          {outcomeText(item, meId, nameOf)}
        </p>
      )}

      {/* The paper exactly as it will print: light, whatever the studio's theme. */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-night-edge">
        {quoteDoc && (
          <QuotationPrint doc={quoteDoc} shots={quoteDoc.showShots ? shots : []} modules={modules} draft={false} />
        )}
        {proposalDoc && <ProposalPrint doc={proposalDoc} quote={quote} shots={shots} draft={false} />}
        {!quoteDoc && !proposalDoc && <p className="p-6 text-sm text-chalk-dim">อ่านเอกสารนี้ไม่ได้</p>}
      </div>
    </div>
  );
}

/** What became of a request no longer on my desk. */
function outcomeText(item: ApprovalItem, meId: string, nameOf: (id: string, role: string) => string): string {
  const by = item.decidedBy === meId ? "คุณ" : nameOf(item.decidedBy ?? item.approverId, "ผู้อนุมัติ");
  if (item.status === "approved") return `${by}อนุมัติเอกสารนี้แล้ว`;
  if (item.status === "returned") return `${by}ส่งกลับให้แก้: ${item.comment ?? ""}`;
  return `คุณตรวจแล้ว ส่งต่อให้ ${nameOf(item.approverId, "ผู้อนุมัติ")} อนุมัติ · รอผู้อนุมัติ`;
}

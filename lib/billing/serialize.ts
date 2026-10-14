import { lineTotal, maintenanceTotals, parseDoc, paymentSchedule, quoteTotals, type QuoteDoc } from "@/lib/quote";
import { parseProposal, type ProposalDoc } from "@/lib/proposal";
import { docsFromFiles } from "@/lib/define";
import { VERSION_KEYS } from "@/lib/versions";
import type { ProjectFiles } from "@/lib/types";
import type { Json } from "@/lib/db/types";
import type {
  BillingBuild,
  BillingCustomer,
  BillingPage,
  BillingProjectDetail,
  BillingProjectSummary,
  BillingProposal,
  BillingQuote,
  BillingRow,
  BillingSnapshot,
  BillingStatus,
  DocRecord,
  ProjectBundle,
} from "./types";

/**
 * Stored rows → the FITT Billing contract. Pure: every figure comes from the
 * same functions the quotation editor prints with, so Billing never shows a
 * number the customer's paper doesn't.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const iso = (ms: number) => new Date(ms).toISOString();
const statusOf = (row: BillingRow | null | undefined): BillingStatus => (row?.status === "suspended" ? "suspended" : "active");

function docFor(records: DocRecord[], version: string): DocRecord | null {
  return records.find((r) => r.version === version) ?? null;
}

function serializeQuote(doc: QuoteDoc, updatedAt: string): BillingQuote {
  const ma = maintenanceTotals(doc.ma);
  return {
    quoteNo: doc.quoteNo,
    issuedAt: doc.issuedAt,
    validDays: doc.validDays,
    subject: doc.subject,
    currency: "THB",
    ratePerDay: doc.ratePerDay,
    vatPercent: doc.vatPercent,
    rows: doc.rows.map((r) => ({
      name: r.name,
      pricing: r.pricing,
      days: r.days,
      qty: r.qty,
      unit: r.unit,
      unitPrice: r.unitPrice,
      note: r.note,
      sub: r.sub,
      // Rounded once per line, exactly as the printed quotation rounds it.
      amount: Math.round(lineTotal(r, doc.ratePerDay) * 100) / 100,
    })),
    lumpSum: { enabled: doc.lumpSum.enabled, amount: doc.lumpSum.amount },
    totals: quoteTotals(doc),
    paymentSchedule: paymentSchedule(doc).rows.map((l) => ({
      when: l.term.when,
      percent: l.term.percent,
      netDays: l.term.netDays,
      amount: l.amount,
    })),
    maintenance: {
      enabled: doc.ma.enabled,
      billingCycle: doc.ma.billingCycle,
      modules: ma.modules,
      perModule: ma.perModule,
      monthly: ma.monthly,
      includedMonths: ma.includedMonths,
      includedValue: ma.includedValue,
      annual: ma.annual,
      note: doc.ma.note,
    },
    updatedAt,
  };
}

function serializeProposal(doc: ProposalDoc, updatedAt: string): BillingProposal {
  return {
    proposalNo: doc.proposalNo,
    issuedAt: doc.issuedAt,
    subject: doc.subject,
    context: doc.context,
    points: doc.points.map(({ problem, feature, outcome }) => ({ problem, feature, outcome })),
    excluded: doc.excluded,
    closing: doc.closing,
    quoteNo: doc.quoteNo,
    updatedAt,
  };
}

/** The last Code Runner hand-off (lib/types.ts RunnerSend); null when never sent or unreadable. */
function buildOf(runner: Json | null): BillingBuild | null {
  if (!runner || typeof runner !== "object" || Array.isArray(runner)) return null;
  const { sentAt, jobId, buildNo } = runner;
  if (typeof sentAt !== "string" || !Number.isFinite(Date.parse(sentAt)) || typeof jobId !== "string") return null;
  return { sentAt, jobId, buildNo: typeof buildNo === "number" ? buildNo : null };
}

/** The customer as the chosen tier's quotation names them, else its proposal; null when neither does. */
function customerOf(...docs: (QuoteDoc | ProposalDoc | null)[]): BillingCustomer | null {
  for (const d of docs) {
    if (!d) continue;
    const c = {
      name: d.customerName.trim(),
      attn: d.customerAttn.trim(),
      address: d.customerAddress.trim(),
      phone: d.customerPhone.trim(),
    };
    if (c.name || c.attn || c.address || c.phone) return c;
  }
  return null;
}

export function projectDetail(b: ProjectBundle, today: string): BillingProjectDetail {
  const quotes = { standard: null, premium: null } as BillingProjectDetail["quotes"];
  const proposals = { standard: null, premium: null } as BillingProjectDetail["proposals"];
  const quoteDocs: Record<string, QuoteDoc | null> = {};
  const proposalDocs: Record<string, ProposalDoc | null> = {};
  for (const v of VERSION_KEYS) {
    const q = docFor(b.quotes, v);
    const qd = q ? parseDoc(q.payload, today) : null;
    quoteDocs[v] = qd;
    if (q && qd) quotes[v] = serializeQuote(qd, q.updated_at);
    const p = docFor(b.proposals, v);
    const pd = p ? parseProposal(p.payload, today) : null;
    proposalDocs[v] = pd;
    if (p && pd) proposals[v] = serializeProposal(pd, p.updated_at);
  }
  const active = b.project.active_version;
  const files = b.project.files && typeof b.project.files === "object" && !Array.isArray(b.project.files)
    ? (b.project.files as unknown as ProjectFiles)
    : null;
  const docs = docsFromFiles(files);
  return {
    schemaVersion: "fittbuilder.billing.project.v1",
    project: {
      id: b.project.id,
      name: b.project.name,
      phase: b.project.phase,
      orgId: b.project.org_id,
      orgName: b.project.org_id ? (b.org?.name ?? null) : null,
      ownerId: b.project.owner_id,
      ownerName: b.owner?.name ?? null,
      ownerEmail: b.owner?.email ?? null,
      activeVersion: active,
      createdAt: b.project.created_at,
      updatedAt: b.project.updated_at,
    },
    customer: customerOf(quoteDocs[active] ?? null, proposalDocs[active] ?? null),
    build: buildOf(b.project.runner_last),
    billing: {
      status: statusOf(b.billing),
      reason: b.billing?.reason ?? "",
      changedAt: b.billing?.changed_at ?? null,
      licenseKeyIssued: Boolean(b.billing?.license_key_hash),
    },
    quotes,
    proposals,
    documents: { brd: docs.brd ?? null, prd: docs.prd ?? null },
  };
}

export function projectSummaries(s: BillingSnapshot, today: string): BillingProjectSummary[] {
  const orgName = new Map(s.orgs.map((o) => [o.id, o.name]));
  const ownerName = new Map(s.owners.map((o) => [o.id, o.name]));
  const latest = new Map<string, number>();
  const bump = (id: string, at: string) => {
    const t = Date.parse(at);
    if (Number.isFinite(t) && t > (latest.get(id) ?? -Infinity)) latest.set(id, t);
  };
  for (const p of s.projects) bump(p.id, p.updated_at);
  for (const r of [...s.quotes, ...s.proposals]) bump(r.project_id, r.updated_at);
  for (const r of s.billing) bump(r.project_id, r.changed_at);
  const items = s.projects.map((p) => {
    const q = s.quotes.find((r) => r.project_id === p.id && r.version === p.active_version);
    const qd = q ? parseDoc(q.payload, today) : null;
    return {
      id: p.id,
      name: p.name,
      phase: p.phase,
      orgId: p.org_id,
      orgName: p.org_id ? (orgName.get(p.org_id) ?? null) : null,
      ownerId: p.owner_id,
      ownerName: ownerName.get(p.owner_id) ?? null,
      buildSentAt: buildOf(p.runner_last)?.sentAt ?? null,
      updatedAt: iso(latest.get(p.id) ?? Date.parse(p.updated_at)),
      customerName: qd?.customerName.trim() || null,
      quoteNo: qd?.quoteNo || null,
      billingStatus: statusOf(s.billing.find((r) => r.project_id === p.id)),
    };
  });
  return items.sort((a, b) => (a.updatedAt === b.updatedAt ? a.id.localeCompare(b.id) : a.updatedAt.localeCompare(b.updatedAt)));
}

type ListQuery = { updatedSince: number | null; limit: number; cursor: { updatedAt: string; id: string } | null };

export function parseListQuery(params: URLSearchParams): ({ ok: true } & ListQuery) | { ok: false; message: string } {
  let updatedSince: number | null = null;
  const since = params.get("updatedSince");
  if (since !== null) {
    updatedSince = Date.parse(since);
    if (!Number.isFinite(updatedSince)) return { ok: false, message: "updatedSince ต้องเป็นเวลาแบบ ISO 8601" };
  }
  let limit = DEFAULT_LIMIT;
  const rawLimit = params.get("limit");
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return { ok: false, message: `limit ต้องเป็นจำนวนเต็ม 1–${MAX_LIMIT}` };
  }
  let cursor: ListQuery["cursor"] = null;
  const rawCursor = params.get("cursor");
  if (rawCursor !== null) {
    try {
      const v = JSON.parse(Buffer.from(rawCursor, "base64url").toString("utf8"));
      if (!Array.isArray(v) || typeof v[0] !== "string" || typeof v[1] !== "string" || !Number.isFinite(Date.parse(v[0]))) throw new Error();
      cursor = { updatedAt: v[0], id: v[1] };
    } catch {
      return { ok: false, message: "cursor ไม่ถูกต้อง ให้ใช้ค่า nextCursor ที่ได้จากหน้าก่อน" };
    }
  }
  return { ok: true, updatedSince, limit, cursor };
}

export function pageOf(items: BillingProjectSummary[], q: ListQuery): BillingPage {
  const after = (x: BillingProjectSummary) =>
    !q.cursor || x.updatedAt > q.cursor.updatedAt || (x.updatedAt === q.cursor.updatedAt && x.id > q.cursor.id);
  // Inclusive: a row stamped at the very millisecond Billing last saw — or saved
  // by a transaction that started earlier but committed later — must come back
  // on the next pull. Billing re-asks from a little before its last updatedAt
  // and de-duplicates by id; a repeat is harmless, a miss is a stale invoice.
  const eligible = items.filter((x) => (q.updatedSince === null || Date.parse(x.updatedAt) >= q.updatedSince) && after(x));
  const page = eligible.slice(0, q.limit);
  const last = page[page.length - 1];
  const more = eligible.length > page.length;
  return {
    items: page,
    nextCursor: more && last ? Buffer.from(JSON.stringify([last.updatedAt, last.id]), "utf8").toString("base64url") : null,
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Building2, Copy, Link2, Loader2, Shield, Trash2, User } from "lucide-react";
import { currentUser } from "@/lib/current-user";
import {
  COMPANY_ROLE_LABEL,
  companyErrorText,
  createCompanyLink,
  listCompanyInvites,
  listCompanyMembers,
  myCompany,
  removeCompanyMember,
  revokeCompanyInvite,
  setCompanyRole,
} from "@/lib/company";
import { confirm } from "@/lib/confirm";
import { thaiDateShort } from "@/lib/quote";
import { toast } from "@/lib/toast";
import type { Company, CompanyInvite, CompanyMember, CompanyRole } from "@/lib/types";

const ROLE_ORDER: Record<CompanyRole, number> = { admin: 0, approver: 1, member: 2 };
const ROLE_ICON = { admin: Shield, approver: BadgeCheck, member: User } as const;

/**
 * The company page (migration 0065): who works here and who approves. A
 * workspace belongs to its owner's company, so the approvers here approve the
 * quotations and proposals of every workspace the company's people own. Admins
 * change roles, take people out, and make one-use links with a role.
 */
export default function CompanyView() {
  const [meId, setMeId] = useState<string | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [myRole, setMyRole] = useState<CompanyRole | null>(null);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [invites, setInvites] = useState<CompanyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkRole, setLinkRole] = useState<CompanyRole>("approver");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [user, mine] = await Promise.all([currentUser(), myCompany()]);
    setMeId(user?.id ?? null);
    setCompany(mine?.company ?? null);
    setMyRole(mine?.role ?? null);
    if (!mine) return;
    const [people, links] = await Promise.all([
      listCompanyMembers(),
      mine.role === "admin" ? listCompanyInvites(mine.company.id) : Promise.resolve([] as CompanyInvite[]),
    ]);
    setMembers(people);
    setInvites(links);
  }, []);

  useEffect(() => {
    void load()
      .catch((e) => toast.error("โหลดข้อมูลบริษัทไม่สำเร็จ", { description: companyErrorText(e) }))
      .finally(() => setLoading(false));
  }, [load]);

  const isAdmin = myRole === "admin";
  const sorted = [...members].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || (a.name || a.email).localeCompare(b.name || b.email, "th")
  );
  const approvers = members.filter((m) => m.role !== "member").length;

  async function copyLink(inv: CompanyInvite) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${inv.token}`);
      toast.success("คัดลอกลิงก์คำเชิญแล้ว", {
        description: `คนแรกที่กดจะได้เป็น${COMPANY_ROLE_LABEL[inv.role]} · ใช้ได้ครั้งเดียว ภายใน 7 วัน`,
      });
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  }

  async function makeLink() {
    setBusy(true);
    try {
      const inv = await createCompanyLink(linkRole);
      setInvites((prev) => [...prev, inv]);
      await copyLink(inv);
    } catch (e) {
      toast.error("สร้างลิงก์ไม่สำเร็จ", { description: companyErrorText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(inv: CompanyInvite) {
    setBusy(true);
    try {
      await revokeCompanyInvite(inv.id);
      setInvites((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (e) {
      toast.error("ยกเลิกลิงก์ไม่สำเร็จ", { description: companyErrorText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(m: CompanyMember, role: CompanyRole) {
    setBusy(true);
    try {
      await setCompanyRole(m.userId, role);
      setMembers((prev) => prev.map((x) => (x.userId === m.userId ? { ...x, role } : x)));
      toast.success(`${m.name || m.email} เป็น${COMPANY_ROLE_LABEL[role]}แล้ว`);
    } catch (e) {
      toast.error("เปลี่ยนบทบาทไม่สำเร็จ", { description: companyErrorText(e) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: CompanyMember) {
    const ok = await confirm({
      title: `เอา ${m.name || m.email} ออกจากบริษัท?`,
      message: "workspace ของคนนี้จะไม่อยู่ในบริษัทอีก ผู้อนุมัติของบริษัทจะไม่เห็นเอกสารของเขา",
      confirmLabel: "เอาออก",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeCompanyMember(m.userId);
      setMembers((prev) => prev.filter((x) => x.userId !== m.userId));
    } catch (e) {
      toast.error("เอาออกไม่สำเร็จ", { description: companyErrorText(e) });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 px-8 py-10 text-sm text-chalk-dim">
        <Loader2 size={14} className="animate-spin" /> กำลังโหลด…
      </p>
    );
  }

  if (!company) {
    return (
      <div className="w-full max-w-3xl px-8 py-10">
        <Header name="บริษัท" />
        <p className="mt-6 rounded-xl border border-night-edge bg-night-panel p-4 text-sm text-chalk-dim">
          บัญชีนี้ยังไม่อยู่ในบริษัทใด — กรุณาขอลิงก์เชิญจากผู้ดูแลบริษัท
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl px-8 py-10">
      <Header name={company.name} />
      <p className="mt-3 text-[0.8125rem] leading-relaxed text-chalk-dim">
        ผู้อนุมัติของบริษัทอนุมัติใบเสนอราคาและข้อเสนอโครงการได้ทุก workspace ของคนในบริษัท และเปิดดูได้อย่างเดียว
        {company.emailDomain && <> · คนที่ใช้อีเมล @{company.emailDomain} เข้าบริษัทให้เอง</>}
      </p>

      {isAdmin && (
        <section className="mt-6 rounded-xl border border-night-edge bg-night-panel p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <Link2 size={15} className="text-shine" /> เชิญเข้าบริษัทด้วยลิงก์
          </h2>
          <p className="mt-1 text-[0.8125rem] text-chalk-dim">
            ส่งลิงก์ให้ทางแชตส่วนตัว คนแรกที่กดจะได้บทบาทที่เลือก · ใช้ได้ครั้งเดียว ภายใน 7 วัน · คนที่อยู่ในบริษัทแล้วจะได้บทบาทใหม่แทน
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={linkRole}
              onChange={(e) => setLinkRole(e.target.value as CompanyRole)}
              className="rounded-lg border border-night-edge bg-night px-2 py-2 text-xs text-chalk outline-none focus:border-shine"
              aria-label="บทบาทของคนที่กดลิงก์"
            >
              <option value="approver">{COMPANY_ROLE_LABEL.approver}</option>
              <option value="member">{COMPANY_ROLE_LABEL.member}</option>
              <option value="admin">{COMPANY_ROLE_LABEL.admin}</option>
            </select>
            <button
              onClick={() => void makeLink()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-shine px-3 py-2 font-display text-xs font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
            >
              <Link2 size={13} /> สร้างลิงก์เชิญ
            </button>
          </div>
          {invites.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 rounded-lg border border-night-edge/60 bg-night px-3 py-2"
                >
                  <Link2 size={14} className="shrink-0 text-chalk-dim" />
                  <span className="min-w-0 flex-1 truncate text-xs text-chalk-dim">
                    ลิงก์เชิญ{COMPANY_ROLE_LABEL[inv.role]} · ใช้ได้ถึง {thaiDateShort(inv.expiresAt.slice(0, 10))}
                  </span>
                  <button
                    onClick={() => void copyLink(inv)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-night-edge px-1.5 py-0.5 text-[0.625rem] text-chalk-dim transition hover:border-shine hover:text-chalk"
                    title="คัดลอกลิงก์ ส่งทางแชตได้"
                  >
                    <Copy size={11} /> ลิงก์
                  </button>
                  <button
                    onClick={() => void revoke(inv)}
                    disabled={busy}
                    className="shrink-0 rounded-sm border border-night-edge p-1 text-chalk-dim transition hover:border-halt hover:text-halt disabled:opacity-40"
                    title="ยกเลิกลิงก์"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-6 rounded-xl border border-night-edge bg-night-panel p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
          คนในบริษัท
          <span className="rounded-full bg-chalk/10 px-2 py-0.5 font-mono text-[0.625rem] text-chalk-dim">{members.length}</span>
          <span className="text-[0.75rem] font-normal text-chalk-dim">· อนุมัติได้ {approvers} คน</span>
        </h2>
        <div className="mt-3 space-y-1.5">
          {sorted.map((m) => {
            const Icon = ROLE_ICON[m.role];
            const isSelf = m.userId === meId;
            return (
              <div key={m.userId} className="flex items-center gap-3 rounded-lg border border-night-edge bg-night px-3 py-2">
                <Icon size={14} className={`shrink-0 ${m.role === "member" ? "text-chalk-dim" : "text-shine"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] text-chalk">
                    {m.name || m.email}
                    {isSelf && <span className="ml-1.5 text-[0.6875rem] text-chalk-dim">(คุณ)</span>}
                  </p>
                  {m.name && <p className="truncate font-mono text-[0.625rem] text-chalk-dim">{m.email}</p>}
                </div>
                {isAdmin && !isSelf ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => void changeRole(m, e.target.value as CompanyRole)}
                      disabled={busy}
                      className="shrink-0 rounded-sm border border-night-edge bg-night px-1.5 py-0.5 text-[0.6875rem] text-chalk-dim outline-none transition hover:text-chalk focus:border-shine disabled:opacity-40"
                      aria-label={`บทบาทของ ${m.name || m.email}`}
                    >
                      <option value="member">{COMPANY_ROLE_LABEL.member}</option>
                      <option value="approver">{COMPANY_ROLE_LABEL.approver}</option>
                      <option value="admin">{COMPANY_ROLE_LABEL.admin}</option>
                    </select>
                    <button
                      onClick={() => void remove(m)}
                      disabled={busy}
                      className="shrink-0 rounded-sm border border-night-edge p-1 text-chalk-dim transition hover:border-halt hover:text-halt disabled:opacity-40"
                      title="เอาออกจากบริษัท"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                ) : (
                  <span className="shrink-0 rounded-full border border-night-edge px-2 py-0.5 text-[0.625rem] text-chalk-dim">
                    {COMPANY_ROLE_LABEL[m.role]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Header({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-shine/10 text-shine">
        <Building2 size={22} />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-shine">บริษัท · ผู้อนุมัติเอกสาร</p>
        <h1 className="truncate font-display text-xl font-semibold text-chalk">{name}</h1>
      </div>
    </div>
  );
}

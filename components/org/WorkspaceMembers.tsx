"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, LogOut, Mail, Shield, Trash2, User, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createOrgInvite,
  listOrgInvites,
  listOrgMembers,
  removeOrgMember,
  revokeOrgInvite,
  updateOrgMemberRole,
} from "@/lib/org-members";
import { confirm } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import type { OrgInvite, OrgInviteRole, OrgMember } from "@/lib/types";

const ROLE_LABEL: Record<string, string> = {
  owner: "เจ้าของ",
  admin: "ผู้ดูแล",
  member: "สมาชิก",
};

/**
 * Workspace roster + invites, rendered inside the workspace page. Owners and
 * admins can invite by email, change a member's role, and remove people; plain
 * members see the roster read-only and can leave. Every workspace member (any
 * role) can access all projects in the workspace — hence the note.
 */
export default function WorkspaceMembers({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [meId, setMeId] = useState<string | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgInviteRole>("member");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: { user } }, memberList, inviteList] = await Promise.all([
          createClient().auth.getUser(),
          listOrgMembers(orgId),
          listOrgInvites(orgId).catch(() => [] as OrgInvite[]), // admin-only → empty for members
        ]);
        if (cancelled) return;
        setMeId(user?.id ?? null);
        setMembers(memberList);
        setInvites(inviteList);
      } catch (e) {
        if (!cancelled) toast.error("โหลดสมาชิกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  const myRole = members.find((m) => m.userId === meId)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  async function handleInvite() {
    const email = inviteEmail.trim();
    if (!email || inviteBusy) return;
    if (members.some((m) => m.email.toLowerCase() === email.toLowerCase())) {
      toast.warning("คนนี้อยู่ใน workspace แล้ว");
      return;
    }
    setInviteBusy(true);
    try {
      const inv = await createOrgInvite(orgId, email, inviteRole);
      setInvites((prev) => [...prev, inv]);
      setInviteEmail("");
      toast.success("ส่งคำเชิญแล้ว", { description: `เชิญ ${email} เป็น${ROLE_LABEL[inviteRole]}` });
    } catch (e) {
      toast.error("ส่งคำเชิญไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRoleChange(userId: string, role: OrgInviteRole) {
    const prev = members;
    setMembers((cur) => cur.map((m) => (m.userId === userId ? { ...m, role } : m)));
    setBusy(true);
    try {
      await updateOrgMemberRole(orgId, userId, role);
    } catch (e) {
      setMembers(prev);
      toast.error("เปลี่ยนสิทธิ์ไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(m: OrgMember) {
    const ok = await confirm({
      title: `เอา ${m.email} ออกจาก workspace?`,
      message: "จะไม่เห็นโปรเจกต์ใน workspace นี้อีก (โปรเจกต์ที่เขาถูกเชิญตรง ๆ ยังอยู่)",
      confirmLabel: "เอาออก",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeOrgMember(orgId, m.userId);
      setMembers((prev) => prev.filter((x) => x.userId !== m.userId));
    } catch (e) {
      toast.error("เอาออกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!meId) return;
    const ok = await confirm({
      title: "ออกจาก workspace นี้?",
      message: "จะไม่เห็นโปรเจกต์ใน workspace นี้อีก",
      confirmLabel: "ออกจาก workspace",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeOrgMember(orgId, meId);
      toast.success("ออกจาก workspace แล้ว");
      router.push("/");
    } catch (e) {
      toast.error("ออกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
      setBusy(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    setBusy(true);
    try {
      await revokeOrgInvite(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (e) {
      toast.error("ยกเลิกคำเชิญไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-7 rounded-xl border border-night-edge bg-night-panel p-4">
      <div className="flex items-center gap-2">
        <Users size={15} className="text-shine" />
        <h2 className="font-display text-sm font-semibold">สมาชิก workspace</h2>
        {!loading && (
          <span className="rounded-full bg-chalk/10 px-2 py-0.5 font-mono text-[10px] text-chalk-dim">
            {members.length}
          </span>
        )}
      </div>
      <p className="mt-1 text-[13px] text-chalk-dim">
        ทุกคนใน workspace เห็นและทำงานกับทุกโปรเจกต์ในนี้ได้ · ผู้ดูแลจัดการสมาชิกได้
      </p>

      {/* Invite by email (admins/owner only) */}
      {canManage && (
        <div className="mt-3 flex gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-night-edge bg-night px-3 focus-within:border-shine">
            <Mail size={13} className="shrink-0 text-chalk-dim" />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }}
              placeholder="email@example.com"
              className="min-w-0 flex-1 bg-transparent py-2 font-mono text-xs text-chalk outline-none placeholder:text-chalk-dim/50"
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as OrgInviteRole)}
            className="rounded-lg border border-night-edge bg-night px-2 py-2 text-xs text-chalk outline-none focus:border-shine"
          >
            <option value="member">สมาชิก</option>
            <option value="admin">ผู้ดูแล</option>
          </select>
          <button
            onClick={() => void handleInvite()}
            disabled={inviteBusy || !inviteEmail.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-shine px-3 py-2 font-display text-xs font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
          >
            เชิญ
          </button>
        </div>
      )}

      {/* Roster */}
      <div className="mt-3 space-y-1.5">
        {loading ? (
          <p className="text-xs text-chalk-dim">กำลังโหลด…</p>
        ) : (
          members.map((m) => {
            const isOwner = m.role === "owner";
            const isSelf = m.userId === meId;
            const RoleIcon = isOwner ? Crown : m.role === "admin" ? Shield : User;
            return (
              <div
                key={m.userId}
                className="flex items-center gap-3 rounded-lg border border-night-edge bg-night px-3 py-2"
              >
                <RoleIcon size={14} className={`shrink-0 ${isOwner ? "text-shine" : "text-chalk-dim"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-chalk">
                    {m.name || m.email}
                    {isSelf && <span className="ml-1.5 text-[11px] text-chalk-dim">(คุณ)</span>}
                  </p>
                  {m.name && <p className="truncate font-mono text-[10px] text-chalk-dim">{m.email}</p>}
                </div>

                {/* Owner: fixed badge. Manageable others: role select + remove.
                    Self (non-owner): leave. Otherwise: read-only badge. */}
                {isOwner ? (
                  <span className="shrink-0 rounded-full border border-shine/40 bg-shine/10 px-2 py-0.5 text-[10px] text-shine">
                    {ROLE_LABEL.owner}
                  </span>
                ) : canManage && !isSelf ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => void handleRoleChange(m.userId, e.target.value as OrgInviteRole)}
                      disabled={busy}
                      className="shrink-0 rounded-sm border border-night-edge bg-night px-1.5 py-0.5 text-[11px] text-chalk-dim outline-none transition hover:text-chalk focus:border-shine disabled:opacity-40"
                    >
                      <option value="member">สมาชิก</option>
                      <option value="admin">ผู้ดูแล</option>
                    </select>
                    <button
                      onClick={() => void handleRemove(m)}
                      disabled={busy}
                      className="shrink-0 rounded-sm border border-night-edge p-1 text-chalk-dim transition hover:border-halt hover:text-halt disabled:opacity-40"
                      title="เอาออกจาก workspace"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                ) : isSelf ? (
                  <button
                    onClick={() => void handleLeave()}
                    disabled={busy}
                    className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-night-edge px-2 py-0.5 text-[11px] text-chalk-dim transition hover:border-halt hover:text-halt disabled:opacity-40"
                    title="ออกจาก workspace"
                  >
                    <LogOut size={11} /> ออก
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full border border-night-edge px-2 py-0.5 text-[10px] text-chalk-dim">
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                )}
              </div>
            );
          })
        )}

        {/* Pending invites (admins/owner see them) */}
        {invites.map((inv) => (
          <div
            key={inv.id}
            className="flex items-center gap-3 rounded-lg border border-night-edge/60 bg-night px-3 py-2 opacity-75"
          >
            <Mail size={14} className="shrink-0 text-chalk-dim" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-chalk-dim">{inv.email}</span>
            <span className="shrink-0 rounded-sm border border-night-edge px-1.5 py-0.5 text-[10px] text-chalk-dim">
              {ROLE_LABEL[inv.role] ?? inv.role}
            </span>
            <span className="shrink-0 text-[10px] text-chalk-dim">รอตอบรับ</span>
            {canManage && (
              <button
                onClick={() => void handleRevoke(inv.id)}
                disabled={busy}
                className="shrink-0 rounded-sm border border-night-edge p-1 text-chalk-dim transition hover:border-halt hover:text-halt disabled:opacity-40"
                title="ยกเลิกคำเชิญ"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

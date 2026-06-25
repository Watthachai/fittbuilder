"use client";

import { useEffect, useState } from "react";
import { Copy, Link, Mail, Trash2, Users, X } from "lucide-react";
import Overlay from "@/components/ui/Overlay";
import GlassSurface from "@/components/ui/GlassSurface";
import {
  createInvite,
  disableShareLink,
  getShareToken,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  setShareLink,
} from "@/lib/sharing";
import type { ProjectInvite, ProjectMember, ShareRole } from "@/lib/types";

interface ShareModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export default function ShareModal({ projectId, onClose }: ShareModalProps) {
  // Public link state
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkRole, setLinkRole] = useState<ShareRole>("viewer");
  const [linkBusy, setLinkBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ShareRole>("viewer");
  const [inviteBusy, setInviteBusy] = useState(false);

  // People state
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invites, setInvites] = useState<ProjectInvite[]>([]);
  const [peopleBusy, setPeopleBusy] = useState(false);

  // Error
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const [tokenResult, memberList, inviteList] = await Promise.all([
          getShareToken(projectId),
          listMembers(projectId),
          listInvites(projectId),
        ]);
        if (cancelled) return;
        if (tokenResult) {
          setLinkToken(tokenResult.token);
          setLinkRole(tokenResult.role);
        } else {
          setLinkToken(null);
        }
        setMembers(memberList);
        setInvites(inviteList);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  async function handleCreateLink() {
    setLinkBusy(true);
    setError(null);
    try {
      const tok = await setShareLink(projectId, linkRole);
      setLinkToken(tok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างลิงก์ไม่สำเร็จ");
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleDisableLink() {
    setLinkBusy(true);
    setError(null);
    try {
      await disableShareLink(projectId);
      setLinkToken(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ปิดลิงก์ไม่สำเร็จ");
    } finally {
      setLinkBusy(false);
    }
  }

  function copyLink() {
    if (!linkToken) return;
    const url = `${location.origin}/join/${linkToken}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || inviteBusy) return;
    setInviteBusy(true);
    setError(null);
    try {
      await createInvite(projectId, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      // Refresh invite list
      const inviteList = await listInvites(projectId);
      setInvites(inviteList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งคำเชิญไม่สำเร็จ");
    } finally {
      setInviteBusy(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    setPeopleBusy(true);
    setError(null);
    try {
      await removeMember(projectId, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบสมาชิกไม่สำเร็จ");
    } finally {
      setPeopleBusy(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    setPeopleBusy(true);
    setError(null);
    try {
      await revokeInvite(inviteId);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "ยกเลิกคำเชิญไม่สำเร็จ");
    } finally {
      setPeopleBusy(false);
    }
  }

  const joinUrl = linkToken ? `${location.origin}/join/${linkToken}` : null;

  return (
    <Overlay open onClose={onClose} placement="center" blur>
      <GlassSurface
        strong
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-night-edge px-4 py-3">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-shine" />
            <h2 className="font-display text-[15px] font-semibold text-chalk">เชิญทีม</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm border border-night-edge p-1.5 text-chalk-dim transition hover:text-chalk"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">

          {/* Error */}
          {error && (
            <p className="rounded border border-halt/40 bg-halt/10 px-3 py-2 text-xs text-halt">
              {error}
            </p>
          )}

          {/* Section 1: Public link */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Link size={13} className="text-chalk-dim" />
              <span className="font-display text-[13px] font-semibold text-chalk">ลิงก์สาธารณะ</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-chalk-dim">สิทธิ์:</span>
              <div className="flex items-center rounded-sm border border-night-edge p-0.5">
                <button
                  onClick={() => setLinkRole("viewer")}
                  className={`rounded-[2px] px-2.5 py-1 text-xs font-medium transition ${
                    linkRole === "viewer" ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
                  }`}
                >
                  Viewer
                </button>
                <button
                  onClick={() => setLinkRole("editor")}
                  className={`rounded-[2px] px-2.5 py-1 text-xs font-medium transition ${
                    linkRole === "editor" ? "bg-shine text-night" : "text-chalk-dim hover:text-chalk"
                  }`}
                >
                  Editor
                </button>
              </div>

              {!linkToken ? (
                <button
                  onClick={() => void handleCreateLink()}
                  disabled={linkBusy}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-night-edge px-2.5 py-1 text-xs text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
                >
                  สร้างลิงก์
                </button>
              ) : (
                <button
                  onClick={() => void handleDisableLink()}
                  disabled={linkBusy}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-night-edge px-2.5 py-1 text-xs text-chalk-dim transition hover:border-halt hover:text-halt disabled:opacity-40"
                >
                  ปิดลิงก์
                </button>
              )}
            </div>

            {joinUrl && (
              <div className="flex items-center gap-2 rounded-lg border border-night-edge bg-night px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-chalk-dim">
                  {joinUrl}
                </span>
                <button
                  onClick={copyLink}
                  className="shrink-0 rounded-sm border border-night-edge p-1.5 text-chalk-dim transition hover:text-chalk"
                  title="คัดลอกลิงก์"
                >
                  <Copy size={12} className={copied ? "text-go" : ""} />
                </button>
              </div>
            )}
          </section>

          <div className="border-t border-night-edge" />

          {/* Section 2: Invite by email */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Mail size={13} className="text-chalk-dim" />
              <span className="font-display text-[13px] font-semibold text-chalk">เชิญด้วยอีเมล</span>
            </div>

            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleInvite();
                }}
                placeholder="email@example.com"
                className="min-w-0 flex-1 rounded-lg border border-night-edge bg-night px-3 py-2 font-mono text-xs text-chalk placeholder:text-chalk-dim/50 outline-none transition focus:border-shine"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as ShareRole)}
                className="rounded-lg border border-night-edge bg-night px-2 py-2 text-xs text-chalk outline-none transition focus:border-shine"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button
                onClick={() => void handleInvite()}
                disabled={inviteBusy || !inviteEmail.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-3 py-2 text-xs text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
              >
                เชิญ
              </button>
            </div>
          </section>

          <div className="border-t border-night-edge" />

          {/* Section 3: People */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Users size={13} className="text-chalk-dim" />
              <span className="font-display text-[13px] font-semibold text-chalk">สมาชิก</span>
            </div>

            {members.length === 0 && invites.length === 0 && (
              <p className="text-xs text-chalk-dim">ยังไม่มีสมาชิก</p>
            )}

            {/* Members */}
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 rounded-lg border border-night-edge bg-night px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-chalk">
                  {m.email}
                </span>
                <span className="shrink-0 rounded-sm border border-night-edge px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-chalk-dim">
                  {m.role}
                </span>
                <button
                  onClick={() => void handleRemoveMember(m.userId)}
                  disabled={peopleBusy}
                  className="shrink-0 rounded-sm border border-night-edge p-1 text-chalk-dim transition hover:border-halt hover:text-halt disabled:opacity-40"
                  title="ลบสมาชิก"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {/* Pending invites */}
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-night-edge/60 bg-night px-3 py-2 opacity-75">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-chalk-dim">
                  {inv.email}
                </span>
                <span className="shrink-0 rounded-sm border border-night-edge px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-chalk-dim">
                  {inv.role}
                </span>
                <span className="shrink-0 text-[10px] text-chalk-dim">รอตอบรับ</span>
                <button
                  onClick={() => void handleRevokeInvite(inv.id)}
                  disabled={peopleBusy}
                  className="shrink-0 rounded-sm border border-night-edge p-1 text-chalk-dim transition hover:border-halt hover:text-halt disabled:opacity-40"
                  title="ยกเลิกคำเชิญ"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </section>
        </div>
      </GlassSurface>
    </Overlay>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FileText, History, Loader2, Paperclip, Quote, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";
import SettingsShell from "@/components/settings/SettingsShell";
import { deleteOrg, getOrg, updateOrgMeta, updateOrgDna, dnaCompleteness } from "@/lib/orgs";
import { ARCHETYPES, DNA_BLOCKS, archetypeMeta } from "@/lib/org-dna";
import { DEFAULT_COLOR, DEFAULT_ICON, WorkspaceIcon } from "@/lib/workspace-style";
import { confirm } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import type { ChatAttachmentInput, OrgDna, OrgDnaVersion } from "@/lib/types";
import ColorIconPicker from "./ColorIconPicker";
import SourceViewer from "./SourceViewer";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_VERSIONS = 12;

/** DNA without its nested version history (what a snapshot stores). */
function snapshotOf(d: OrgDna): Omit<OrgDna, "versions"> {
  const copy = { ...d };
  delete copy.versions;
  return copy;
}

function makeVersion(snapshot: Omit<OrgDna, "versions">, source: "ai" | "manual"): OrgDnaVersion {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `v-${Math.random().toString(36).slice(2)}`;
  return { id, createdAt: new Date().toISOString(), source, snapshot };
}

/** One-line preview of a version for the history list. */
function versionPreview(s: Omit<OrgDna, "versions">): string {
  const arch = archetypeMeta(s.archetype);
  if (arch) return arch.th;
  return (s.decisionRights || s.structure || s.information || s.motivators || "—").slice(0, 60);
}

async function fileToAttachment(file: File): Promise<ChatAttachmentInput> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    data: dataUrl.split(",")[1] ?? "",
  };
}

export default function OrgDnaEditor({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [dna, setDna] = useState<OrgDna>({});
  const [paste, setPaste] = useState("");
  const [files, setFiles] = useState<ChatAttachmentInput[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewer, setViewer] = useState<{ highlight?: string } | null>(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const remove = async () => {
    const ok = await confirm({
      title: "ลบ workspace นี้?",
      message: "โปรเจกต์ข้างในจะไม่ถูกลบ แต่จะหลุดออกจาก workspace",
      confirmLabel: "ลบ",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteOrg(orgId);
      toast.success("ลบ workspace แล้ว");
      router.push("/");
    } catch (e) {
      toast.error("ลบไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
      setDeleting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const org = await getOrg(orgId);
      if (cancelled) return;
      if (!org) {
        setFound(false);
        setLoading(false);
        return;
      }
      setName(org.name);
      setColor(org.color || DEFAULT_COLOR);
      setIcon(org.icon || DEFAULT_ICON);
      setDna(org.dna);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const setField = (key: keyof OrgDna, value: string) =>
    setDna((prev) => ({ ...prev, [key]: value }));

  const pickFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_BYTES) {
        toast.warning(`ไฟล์ใหญ่เกิน 4MB: ${f.name}`);
        continue;
      }
      const att = await fileToAttachment(f);
      setFiles((prev) => [...prev, att]);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const draft = async () => {
    if ((!paste.trim() && files.length === 0) || drafting) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/org-dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: paste.trim() || undefined, attachments: files }),
      });
      const data = (await res.json()) as { dna?: OrgDna; error?: string };
      if (!res.ok || !data.dna) throw new Error(data.error ?? "ร่างไม่สำเร็จ");
      const ai = data.dna;
      // Fill only empty fields — never clobber what the user already wrote. Keep
      // a block's citation only when we actually used the AI's text for it.
      setDna((prev) => {
        const keep = {
          decisionRights: Boolean(prev.decisionRights?.trim()),
          information: Boolean(prev.information?.trim()),
          motivators: Boolean(prev.motivators?.trim()),
          structure: Boolean(prev.structure?.trim()),
        };
        const next: Omit<OrgDna, "versions"> = {
          decisionRights: keep.decisionRights ? prev.decisionRights : ai.decisionRights,
          information: keep.information ? prev.information : ai.information,
          motivators: keep.motivators ? prev.motivators : ai.motivators,
          structure: keep.structure ? prev.structure : ai.structure,
          archetype: prev.archetype ?? ai.archetype ?? null,
          notes: prev.notes?.trim() ? prev.notes : ai.notes,
          sources: ai.sources || prev.sources,
          cites: {
            decisionRights: keep.decisionRights ? prev.cites?.decisionRights : ai.cites?.decisionRights,
            information: keep.information ? prev.cites?.information : ai.cites?.information,
            motivators: keep.motivators ? prev.cites?.motivators : ai.cites?.motivators,
            structure: keep.structure ? prev.cites?.structure : ai.cites?.structure,
          },
        };
        // Keep this draft as a version the user can revisit/restore.
        const versions = [makeVersion(next, "ai"), ...(prev.versions ?? [])].slice(0, MAX_VERSIONS);
        return { ...next, versions };
      });
      toast.success("AI ร่าง Org DNA — เก็บเป็นเวอร์ชันให้แล้ว", {
        description: "ตรวจและแก้ได้ · กด “ประวัติเวอร์ชัน” เพื่อย้อนดู/กู้คืน · คลิก 📎 ดูที่มา",
      });
    } catch (e) {
      toast.error("ร่าง Org DNA ไม่สำเร็จ", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setDrafting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateOrgDna(orgId, dna),
        updateOrgMeta(orgId, { name, color, icon }),
      ]);
      toast.success("บันทึก workspace แล้ว");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const restore = (v: OrgDnaVersion) => {
    setDna((prev) => {
      // Snapshot the current state first so a restore is itself undoable.
      const current = makeVersion(snapshotOf(prev), "manual");
      const versions = [current, ...(prev.versions ?? [])].slice(0, MAX_VERSIONS);
      return { ...v.snapshot, versions };
    });
    setVersionsOpen(false);
    toast.success("กู้คืนเวอร์ชันแล้ว", { description: "อย่าลืมกด “บันทึก Org DNA”" });
  };

  if (loading) {
    return (
      <SettingsShell>
        <div className="grid min-h-[60vh] place-items-center text-chalk-dim">
          <Loader2 className="animate-spin" />
        </div>
      </SettingsShell>
    );
  }
  if (!found) {
    return (
      <SettingsShell>
        <div className="grid min-h-[60vh] place-items-center px-6 text-center">
          <p className="font-display text-lg text-chalk">
            ไม่พบ workspace นี้ หรือคุณไม่มีสิทธิ์เข้าถึง
          </p>
        </div>
      </SettingsShell>
    );
  }

  const pct = Math.round(dnaCompleteness(dna) * 100);

  return (
    <SettingsShell>
      <div className="mx-auto w-full max-w-5xl px-8 py-10">

        <div className="mt-5 flex items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
            style={{ background: `${color}22`, color }}
          >
            <WorkspaceIcon icon={icon} size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-shine">
              ข้อมูล workspace · Org DNA
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent font-display text-xl font-semibold text-chalk outline-none"
              aria-label="ชื่อ workspace"
            />
          </div>
          <button
            onClick={() => void remove()}
            disabled={deleting}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-night-edge px-3 py-1.5 text-xs text-chalk-dim transition hover:border-halt hover:text-halt disabled:opacity-40"
            title="ลบ workspace นี้"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            ลบ workspace
          </button>
        </div>

        {/* Identity: color + icon */}
        <div className="mt-5 rounded-xl border border-night-edge bg-night-panel p-4">
          <ColorIconPicker color={color} icon={icon} onColor={setColor} onIcon={setIcon} />
        </div>

        <p className="mt-5 text-sm leading-relaxed text-chalk-dim">
          ใส่ DNA ขององค์กรเพื่อให้ AI ออกแบบ spec/demo ให้เข้ากับวิธีทำงานจริงของคุณ —
          ทุกช่องไม่บังคับ ใส่เท่าที่มี
        </p>

        {/* Completeness */}
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-chalk/10">
            <div className="h-full rounded-full bg-shine transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-xs text-chalk-dim">{pct}% ครบ</span>
        </div>

        {/* AI draft from freeform */}
        <section className="mt-7 rounded-xl border border-night-edge bg-night-panel p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-shine" />
            <h2 className="font-display text-sm font-semibold">ให้ AI ร่างให้จากข้อมูลที่มี</h2>
          </div>
          <p className="mt-1 text-[13px] text-chalk-dim">
            วางข้อความ หรืออัปโหลดไฟล์ที่มี — คำอธิบายบริษัท เว็บไซต์ โครงสร้างทีม เอกสาร (PDF/รูป/ข้อความ)
            — AI จะสกัดเป็น 4 ฐานรากให้ (เติมเฉพาะช่องที่ยังว่าง)
          </p>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            placeholder="เช่น: เราเป็นเอเจนซีดิจิทัล 30 คน ทีมเล็กตัดสินใจเองได้ ผู้บริหารดูภาพรวม…"
            className="mt-3 w-full resize-y rounded-lg border border-night-edge bg-night px-3 py-2.5 text-[14px] outline-none focus:border-shine"
          />
          {files.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex items-center gap-1 rounded-md border border-night-edge bg-night px-2 py-1 font-mono text-[11px] text-chalk-dim"
                >
                  <Paperclip size={10} className="text-shine" />
                  <span className="max-w-[180px] truncate">{f.name}</span>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="transition hover:text-halt"
                    title="เอาออก"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf,text/*,.md,.json,.csv"
            className="hidden"
            onChange={(e) => void pickFiles(e.target.files)}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-3 py-2 text-sm text-chalk-dim transition hover:border-shine hover:text-chalk"
            >
              <Paperclip size={14} /> แนบไฟล์
            </button>
            <button
              onClick={() => void draft()}
              disabled={(!paste.trim() && files.length === 0) || drafting}
              className="inline-flex items-center gap-2 rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
            >
              {drafting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {drafting ? "กำลังร่าง…" : "ให้ AI ร่าง Org DNA"}
            </button>
          </div>
        </section>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          {dna.sources?.trim() && (
            <button
              onClick={() => setViewer({})}
              className="inline-flex items-center gap-1.5 text-[12px] text-chalk-dim transition hover:text-shine"
            >
              <FileText size={13} /> ดูแหล่งข้อมูลทั้งหมดที่ AI ใช้
            </button>
          )}
          {dna.versions && dna.versions.length > 0 && (
            <button
              onClick={() => setVersionsOpen(true)}
              className="inline-flex items-center gap-1.5 text-[12px] text-chalk-dim transition hover:text-shine"
            >
              <History size={13} /> ประวัติเวอร์ชัน ({dna.versions.length})
            </button>
          )}
        </div>

        {/* 4 building blocks */}
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {DNA_BLOCKS.map((b) => {
            const cite = dna.cites?.[b.key]?.trim();
            return (
              <div key={b.key}>
                <label className="font-display text-sm font-semibold text-chalk">{b.th}</label>
                <p className="mb-1.5 text-[12px] text-chalk-dim">{b.hint}</p>
                <textarea
                  value={dna[b.key] ?? ""}
                  onChange={(e) => setField(b.key, e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-night-edge bg-night-panel px-3 py-2.5 text-[14px] outline-none focus:border-shine"
                />
                {cite && (
                  <button
                    onClick={() => setViewer({ highlight: cite })}
                    title="คลิกดูที่มาในข้อมูลของคุณ"
                    className="mt-1.5 flex w-full items-start gap-1.5 rounded-md border border-night-edge bg-night/50 px-2 py-1.5 text-left text-[11px] text-chalk-dim transition hover:border-shine/50 hover:text-chalk"
                  >
                    <Quote size={11} className="mt-0.5 shrink-0 text-shine" />
                    <span className="line-clamp-2 italic">“{cite}”</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Archetype */}
        <div className="mt-6">
          <label className="font-display text-sm font-semibold text-chalk">รูปแบบองค์กร (Archetype)</label>
          <p className="mb-2 text-[12px] text-chalk-dim">เลือก 1 ใน 7 ที่ใกล้เคียงที่สุด (หรือเว้นไว้)</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ARCHETYPES.map((a) => {
              const active = dna.archetype === a.key;
              return (
                <button
                  key={a.key}
                  onClick={() => setDna((prev) => ({ ...prev, archetype: active ? null : a.key }))}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    active
                      ? "border-shine bg-shine/10"
                      : "border-night-edge bg-night-panel hover:border-shine/50"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${a.healthy ? "bg-go" : "bg-halt"}`} />
                    <span className="font-display text-[13px] font-semibold text-chalk">{a.th}</span>
                    <span className="font-mono text-[10px] text-chalk-dim">{a.en}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-snug text-chalk-dim">{a.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sticky bottom-4 mt-8">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-shine py-3 font-display text-sm font-semibold text-night shadow-lg transition hover:brightness-110 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "กำลังบันทึก…" : "บันทึก Org DNA"}
          </button>
        </div>
      </div>

      {viewer && dna.sources && (
        <SourceViewer
          sources={dna.sources}
          highlight={viewer.highlight}
          onClose={() => setViewer(null)}
        />
      )}

      {versionsOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setVersionsOpen(false);
            }}
          >
            <div className="glass-strong flex max-h-[85vh] w-[min(92vw,36rem)] flex-col rounded-2xl border border-night-edge p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="inline-flex items-center gap-2 font-display text-base font-semibold text-chalk">
                  <History size={16} className="text-shine" /> ประวัติเวอร์ชัน Org DNA
                </h2>
                <button
                  onClick={() => setVersionsOpen(false)}
                  className="rounded-sm p-1 text-chalk-dim transition hover:text-chalk"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mt-1 text-[12px] text-chalk-dim">
                ทุกครั้งที่ AI ร่างหรือคุณกู้คืน จะถูกเก็บเป็นเวอร์ชัน — กดกู้คืนเพื่อย้อนกลับ (เก็บล่าสุด {MAX_VERSIONS})
              </p>
              <div className="scroll-thin mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
                {(dna.versions ?? []).map((v, i) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 rounded-lg border border-night-edge bg-night px-3 py-2.5"
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        v.source === "ai" ? "bg-shine/15 text-shine" : "bg-chalk/10 text-chalk-dim"
                      }`}
                    >
                      {v.source === "ai" ? "AI ร่าง" : "แก้เอง"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-chalk">{versionPreview(v.snapshot)}</p>
                      <p className="font-mono text-[10px] text-chalk-dim">
                        {new Date(v.createdAt).toLocaleString("th-TH")}
                        {i === 0 ? " · ล่าสุด" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => restore(v)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-night-edge px-2.5 py-1.5 text-[12px] text-chalk-dim transition hover:border-shine hover:text-chalk"
                    >
                      <RotateCcw size={12} /> กู้คืน
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </SettingsShell>
  );
}

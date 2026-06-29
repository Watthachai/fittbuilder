"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Dna, Loader2, Save, Sparkles, Trash2 } from "lucide-react";
import { deleteOrg, getOrg, renameOrg, updateOrgDna, dnaCompleteness } from "@/lib/orgs";
import { ARCHETYPES, DNA_BLOCKS } from "@/lib/org-dna";
import { confirm } from "@/lib/confirm";
import { toast } from "@/lib/toast";
import type { OrgDna } from "@/lib/types";

export default function OrgDnaEditor({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(true);
  const [name, setName] = useState("");
  const [dna, setDna] = useState<OrgDna>({});
  const [paste, setPaste] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      setDna(org.dna);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const setField = (key: keyof OrgDna, value: string) =>
    setDna((prev) => ({ ...prev, [key]: value }));

  const draft = async () => {
    if (!paste.trim() || drafting) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/org-dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: paste.trim() }),
      });
      const data = (await res.json()) as { dna?: OrgDna; error?: string };
      if (!res.ok || !data.dna) throw new Error(data.error ?? "ร่างไม่สำเร็จ");
      const ai = data.dna;
      // Fill only empty fields — never clobber what the user already wrote.
      setDna((prev) => ({
        decisionRights: prev.decisionRights?.trim() ? prev.decisionRights : ai.decisionRights,
        information: prev.information?.trim() ? prev.information : ai.information,
        motivators: prev.motivators?.trim() ? prev.motivators : ai.motivators,
        structure: prev.structure?.trim() ? prev.structure : ai.structure,
        archetype: prev.archetype ?? ai.archetype ?? null,
        notes: prev.notes?.trim() ? prev.notes : ai.notes,
      }));
      toast.success("AI ร่าง Org DNA ให้แล้ว", { description: "ตรวจและแก้ได้ตามจริง แล้วกดบันทึก" });
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
      await Promise.all([updateOrgDna(orgId, dna), renameOrg(orgId, name)]);
      toast.success("บันทึก Org DNA แล้ว");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-night text-chalk-dim">
        <Loader2 className="animate-spin" />
      </main>
    );
  }
  if (!found) {
    return (
      <main className="grid min-h-screen place-items-center bg-night px-6 text-center">
        <div>
          <p className="font-display text-lg text-chalk">ไม่พบ workspace นี้ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
          <Link href="/" className="mt-4 inline-block text-sm text-shine hover:underline">
            ← กลับหน้าแรก
          </Link>
        </div>
      </main>
    );
  }

  const pct = Math.round(dnaCompleteness(dna) * 100);

  return (
    <main className="min-h-screen bg-night px-6 py-10 text-chalk">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-chalk-dim transition hover:text-chalk"
        >
          <ArrowLeft size={15} /> กลับหน้าแรก
        </Link>

        <div className="mt-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-shine/10 text-shine">
            <Dna size={22} />
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

        <p className="mt-4 text-sm leading-relaxed text-chalk-dim">
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
            วางอะไรก็ได้ที่มี — คำอธิบายบริษัท เว็บไซต์ โครงสร้างทีม เอกสาร — AI จะสกัดเป็น 4 ฐานราก
            ให้ (เติมเฉพาะช่องที่ยังว่าง)
          </p>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            placeholder="เช่น: เราเป็นเอเจนซีดิจิทัล 30 คน ทีมเล็กตัดสินใจเองได้ ผู้บริหารดูภาพรวม…"
            className="mt-3 w-full resize-y rounded-lg border border-night-edge bg-night px-3 py-2.5 text-[14px] outline-none focus:border-shine"
          />
          <button
            onClick={() => void draft()}
            disabled={!paste.trim() || drafting}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
          >
            {drafting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {drafting ? "กำลังร่าง…" : "ให้ AI ร่าง Org DNA"}
          </button>
        </section>

        {/* 4 building blocks */}
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {DNA_BLOCKS.map((b) => (
            <div key={b.key}>
              <label className="font-display text-sm font-semibold text-chalk">{b.th}</label>
              <p className="mb-1.5 text-[12px] text-chalk-dim">{b.hint}</p>
              <textarea
                value={dna[b.key] ?? ""}
                onChange={(e) => setField(b.key, e.target.value)}
                rows={2}
                className="w-full resize-y rounded-lg border border-night-edge bg-night-panel px-3 py-2.5 text-[14px] outline-none focus:border-shine"
              />
            </div>
          ))}
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
    </main>
  );
}

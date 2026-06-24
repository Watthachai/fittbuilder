"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import SkillIcon from "@/components/studio/SkillIcon";
import { SKILLS } from "@/lib/skills/registry";
import type { SkillTemplateRow } from "@/lib/skills/db-mapper";
import SkillTemplateForm from "./SkillTemplateForm";

type View = { mode: "list" } | { mode: "new" } | { mode: "edit"; row: SkillTemplateRow };

export default function SkillAdmin() {
  const [templates, setTemplates] = useState<SkillTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ mode: "list" });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/skills");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { templates: SkillTemplateRow[] };
      setTemplates(data.templates);
    } catch {
      setError("โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/skills");
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { templates: SkillTemplateRow[] };
        if (!cancelled) setTemplates(data.templates);
      } catch {
        if (!cancelled) setError("โหลดรายการไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function togglePublish(row: SkillTemplateRow) {
    const next = row.status === "published" ? "draft" : "published";
    await fetch(`/api/admin/skills/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    void refresh();
  }

  async function remove(row: SkillTemplateRow) {
    if (!confirm(`ลบ "${row.name}" ถาวร?`)) return;
    await fetch(`/api/admin/skills/${row.id}`, { method: "DELETE" });
    void refresh();
  }

  if (view.mode !== "list") {
    return (
      <main className="min-h-screen bg-night px-6 py-10 text-chalk">
        <div className="mx-auto max-w-4xl stitch">
          <button
            onClick={() => setView({ mode: "list" })}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-chalk-dim transition hover:text-chalk"
          >
            <ArrowLeft size={15} /> กลับ
          </button>
          <SkillTemplateForm
            initial={view.mode === "edit" ? view.row : null}
            onDone={() => {
              setView({ mode: "list" });
              void refresh();
            }}
            onCancel={() => setView({ mode: "list" })}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-night px-6 py-10 text-chalk">
      <div className="mx-auto max-w-5xl stitch">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/" className="text-sm text-chalk-dim transition hover:text-chalk">
              ← FITT Builder
            </Link>
            <h1 className="mt-1 font-display text-2xl font-semibold">Skill Templates (Admin)</h1>
          </div>
          <button
            onClick={() => setView({ mode: "new" })}
            className="inline-flex items-center gap-1.5 rounded-full bg-shine px-4 py-2 font-display text-sm font-semibold text-night transition hover:brightness-110"
          >
            <Plus size={15} /> สร้างใหม่
          </button>
        </div>

        {/* Custom templates */}
        <section className="mt-8">
          <h2 className="font-display text-sm font-semibold text-chalk-dim">Custom</h2>
          {loading ? (
            <p className="mt-3 text-sm text-chalk-dim">กำลังโหลด…</p>
          ) : error ? (
            <p className="mt-3 text-sm text-halt">{error}</p>
          ) : templates.length === 0 ? (
            <p className="mt-3 text-sm text-chalk-dim">ยังไม่มี custom template — กด “สร้างใหม่”</p>
          ) : (
            <div className="mt-3 space-y-2">
              {templates.map((row, i) => (
                <div
                  key={row.id}
                  style={{ "--d": `${i * 0.04}s` } as React.CSSProperties}
                  className="glass stitch-item flex items-center gap-3 rounded-xl p-3"
                >
                  <SkillIcon name={row.icon} size={18} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-medium text-chalk">{row.name}</span>
                      <span className="font-mono text-[11px] text-chalk-dim">/{row.slug}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          row.status === "published"
                            ? "bg-go/15 text-go"
                            : "bg-chalk/10 text-chalk-dim"
                        }`}
                      >
                        {row.status === "published" ? "เผยแพร่แล้ว" : "draft"}
                      </span>
                    </div>
                    <p className="truncate text-xs text-chalk-dim">{row.tagline}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => togglePublish(row)}
                      className="rounded-lg border border-night-edge px-2.5 py-1 text-xs text-chalk-dim transition hover:text-chalk"
                    >
                      {row.status === "published" ? "ถอน" : "เผยแพร่"}
                    </button>
                    <button
                      onClick={() => setView({ mode: "edit", row })}
                      className="rounded-lg border border-night-edge px-2.5 py-1 text-xs text-chalk-dim transition hover:text-chalk"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => remove(row)}
                      className="rounded-lg border border-night-edge px-2.5 py-1 text-xs text-chalk-dim transition hover:text-halt"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Built-in (read-only) */}
        <section className="mt-8">
          <h2 className="font-display text-sm font-semibold text-chalk-dim">Built-in (อ่านอย่างเดียว)</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SKILLS.map((s) => (
              <div
                key={s.id}
                className="glass flex items-center gap-3 rounded-xl p-3"
              >
                <SkillIcon name={s.icon} size={18} />
                <div className="min-w-0">
                  <span className="font-display text-sm font-medium text-chalk">{s.name}</span>
                  <p className="truncate text-xs text-chalk-dim">{s.tagline}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

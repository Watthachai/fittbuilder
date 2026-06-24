"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, Plus, Search, Trash2, X } from "lucide-react";

interface NpmHit {
  name: string;
  version: string;
  description: string;
  npmUrl?: string;
}

interface PackageSearchProps {
  /** Extra (user-installed) deps currently in package.json: name → version range. */
  installed: Record<string, string>;
  /** A run (install) is in progress. */
  busy: boolean;
  onAdd: (name: string, version: string) => void;
  onRemove: (name: string) => void;
  onClose: () => void;
}

export default function PackageSearch({
  installed,
  busy,
  onAdd,
  onRemove,
  onClose,
}: PackageSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NpmHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/npm-search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results?: NpmHit[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "ค้นหาไม่สำเร็จ");
      setResults(data.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ค้นหาไม่สำเร็จ");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const installedNames = Object.keys(installed);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-night/70 p-4 pt-[8vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-night-edge bg-night-panel"
      >
        <div className="flex items-center justify-between border-b border-night-edge px-4 py-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-chalk">ติดตั้ง npm package</h2>
            <p className="font-mono text-[11px] text-chalk-dim">
              ค้นหาแล้วเพิ่มเข้าโปรเจกต์ — ระบบจะติดตั้งใน WebContainer ให้อัตโนมัติ
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm border border-night-edge p-1.5 text-chalk-dim transition hover:text-chalk"
          >
            <X size={14} />
          </button>
        </div>

        <div className="border-b border-night-edge p-3">
          <div className="flex items-center gap-2 rounded-md border border-night-edge bg-night px-3 focus-within:border-shine">
            <Search size={14} className="shrink-0 text-chalk-dim" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void search();
              }}
              placeholder='เช่น "lodash", "dayjs", "recharts"…'
              className="w-full bg-transparent py-2 text-[14px] text-chalk outline-none placeholder:text-chalk-dim/60"
            />
            <button
              onClick={() => void search()}
              disabled={!query.trim() || loading}
              className="shrink-0 rounded-sm bg-shine px-3 py-1 font-display text-xs font-semibold text-night transition hover:bg-shine-soft disabled:opacity-40"
            >
              ค้นหา
            </button>
          </div>
          {installedNames.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-chalk-dim">
                ติดตั้งแล้ว ({installedNames.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {installedNames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-shine/40 bg-shine/10 py-1 pl-2.5 pr-1.5 font-mono text-[11px] text-chalk"
                  >
                    {name}
                    <button
                      onClick={() => onRemove(name)}
                      disabled={busy}
                      title="ลบออก"
                      className="text-chalk-dim transition hover:text-halt disabled:opacity-40"
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-chalk-dim">
              <Loader2 size={16} className="animate-spin" />
              <span className="font-mono text-xs">กำลังค้นหา…</span>
            </div>
          )}
          {error && !loading && (
            <p className="py-10 text-center text-[13px] text-halt">{error}</p>
          )}
          {!loading && !error && results.length === 0 && (
            <p className="py-10 text-center text-[13px] text-chalk-dim">
              พิมพ์ชื่อ package แล้วกดค้นหา
            </p>
          )}
          <div className="space-y-1.5">
            {results.map((hit) => {
              const isInstalled = hit.name in installed;
              return (
                <div
                  key={hit.name}
                  className="flex items-start gap-3 rounded-md border border-night-edge bg-night p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-medium text-chalk">{hit.name}</span>
                      <span className="font-mono text-[10px] text-chalk-dim">{hit.version}</span>
                      {hit.npmUrl && (
                        <a
                          href={hit.npmUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-chalk-dim transition hover:text-shine"
                          title="ดูบน npm"
                        >
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    {hit.description && (
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-chalk-dim">{hit.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onAdd(hit.name, hit.version)}
                    disabled={isInstalled || busy}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-2.5 py-1.5 font-display text-xs font-semibold transition ${
                      isInstalled
                        ? "cursor-default border border-night-edge text-go"
                        : "bg-shine text-night hover:bg-shine-soft disabled:opacity-40"
                    }`}
                  >
                    {isInstalled ? (
                      <>
                        <Check size={12} /> ติดตั้งแล้ว
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> เพิ่ม
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

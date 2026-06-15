"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileCode } from "lucide-react";
import type { ProjectFiles } from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-xs text-chalk-dim">
      กำลังโหลด editor…
    </div>
  ),
});

function languageOf(path: string): string {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".svg")) return "xml";
  return "javascript";
}

interface CodePanelProps {
  files: ProjectFiles | null;
  onEdit: (path: string, contents: string) => void;
}

export default function CodePanel({ files, onEdit }: CodePanelProps) {
  const paths = useMemo(() => (files ? Object.keys(files).sort() : []), [files]);
  const [selected, setSelected] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive the active file: fall back to App.jsx / first file when the
  // selection disappears (e.g. after an undo).
  const active =
    selected && paths.includes(selected)
      ? selected
      : paths.includes("src/App.jsx")
        ? "src/App.jsx"
        : (paths[0] ?? null);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  if (!files || paths.length === 0) {
    return (
      <div className="bg-grid flex flex-1 items-center justify-center">
        <p className="font-display text-sm text-chalk-dim">ยังไม่มีโค้ด — generate ก่อน</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="scroll-thin w-52 shrink-0 overflow-y-auto border-r border-night-edge bg-night-panel py-2">
        <p className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-dim">
          Files · {paths.length}
        </p>
        {paths.map((path) => (
          <button
            key={path}
            onClick={() => setSelected(path)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-[12px] transition ${
              active === path
                ? "border-r-2 border-shine bg-shine/10 text-chalk"
                : "text-chalk-dim hover:text-chalk"
            }`}
          >
            <FileCode size={12} className="shrink-0 opacity-60" />
            <span className="truncate">{path}</span>
          </button>
        ))}
      </aside>
      <div className="min-w-0 flex-1">
        {active && (
          <MonacoEditor
            key={active}
            height="100%"
            theme="vs-dark"
            language={languageOf(active)}
            value={files[active]}
            onChange={(value) => {
              if (value === undefined || !active) return;
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => onEdit(active, value), 600);
            }}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              wordWrap: "on",
              scrollBeyondLastLine: false,
              padding: { top: 12 },
            }}
          />
        )}
      </div>
    </div>
  );
}

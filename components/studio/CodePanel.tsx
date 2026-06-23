"use client";

import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
  FolderOpen,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { buildFileTree, type TreeNode } from "@/lib/file-tree";
import type { ProjectFiles } from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-xs text-chalk-dim">
      กำลังโหลด editor…
    </div>
  ),
});

// Register the AI inline-completion (ghost text) provider once across the app.
let inlineProviderRegistered = false;

const handleEditorMount: OnMount = (editor, monaco) => {
  editor.updateOptions({ inlineSuggest: { enabled: true } });

  // Monaco has no node_modules / type defs in the browser, so SEMANTIC checks
  // ("Cannot find module 'react'", implicit-any JSX) would red-underline code
  // that Vite compiles perfectly. Turn off semantic validation (keep syntax
  // errors), and configure JSX so .tsx parses cleanly. Global + idempotent.
  const compilerOptions = {
    jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    allowJs: true,
    esModuleInterop: true,
  };
  const diagnostics = { noSemanticValidation: true, noSyntaxValidation: false };
  for (const defaults of [
    monaco.languages.typescript.typescriptDefaults,
    monaco.languages.typescript.javascriptDefaults,
  ]) {
    defaults.setCompilerOptions({ ...defaults.getCompilerOptions(), ...compilerOptions });
    defaults.setDiagnosticsOptions(diagnostics);
  }

  if (inlineProviderRegistered) return;
  inlineProviderRegistered = true;
  const provider: Monaco.languages.InlineCompletionsProvider = {
      provideInlineCompletions: async (model, position, _context, token) => {
        await new Promise((resolve) => setTimeout(resolve, 500)); // debounce bursts of typing
        if (token.isCancellationRequested) return { items: [] };
        const prefix = model.getValueInRange(
          new monaco.Range(1, 1, position.lineNumber, position.column)
        );
        const lastLine = model.getLineCount();
        const suffix = model.getValueInRange(
          new monaco.Range(position.lineNumber, position.column, lastLine, model.getLineMaxColumn(lastLine))
        );
        const ctrl = new AbortController();
        token.onCancellationRequested(() => ctrl.abort());
        try {
          const res = await fetch("/api/code-suggestion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({
              prefix: prefix.slice(-6000),
              suffix: suffix.slice(0, 3000),
              language: model.getLanguageId(),
            }),
          });
          if (!res.ok || token.isCancellationRequested) return { items: [] };
          const { suggestion } = (await res.json()) as { suggestion?: string };
          if (!suggestion) return { items: [] };
          return {
            items: [
              {
                insertText: suggestion,
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column
                ),
              },
            ],
          };
        } catch {
          return { items: [] };
        }
      },
      disposeInlineCompletions: () => {},
  };
  monaco.languages.registerInlineCompletionsProvider(
    ["javascript", "typescript", "css", "html", "json"],
    provider
  );
};

function languageOf(path: string): string {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".html") || path.endsWith(".vue")) return "html";
  if (path.endsWith(".svg")) return "xml";
  return "javascript";
}

interface CodePanelProps {
  files: ProjectFiles | null;
  onEdit: (path: string, contents: string) => void;
  /** CRUD return whether project.files actually changed (false = no-op). */
  onCreateFile: (path: string) => boolean;
  onRenameFile: (oldPath: string, newPath: string) => boolean;
  onDeleteFile: (path: string) => boolean;
  /** Attach a file as a reference chip in the chat input (double-click / 📎). */
  onAttachToChat: (path: string) => void;
}

export default function CodePanel({
  files,
  onEdit,
  onCreateFile,
  onRenameFile,
  onDeleteFile,
  onAttachToChat,
}: CodePanelProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const paths = useMemo(() => (files ? Object.keys(files) : []), [files]);

  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active file derived in render so it survives generation/undo/delete without
  // an effect; the active file always shows as a tab even if not explicitly opened.
  const fallback = paths.includes("src/App.tsx") ? "src/App.tsx" : (paths[0] ?? null);
  const activeFile = activePath && files?.[activePath] !== undefined ? activePath : fallback;
  const liveTabs = openTabs.filter((t) => files?.[t] !== undefined);
  const tabs =
    activeFile && !liveTabs.includes(activeFile) ? [activeFile, ...liveTabs] : liveTabs;

  const openFile = (path: string) => {
    setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActivePath(path);
  };

  const closeTab = (path: string) => {
    setOpenTabs((prev) => prev.filter((t) => t !== path));
    if (activePath === path) setActivePath(null);
  };

  const toggleFolder = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const cancelDebounce = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  };

  const submitCreate = () => {
    const path = newName.trim().replace(/^\/+/, "");
    setCreating(false);
    setNewName("");
    if (!path || files?.[path] !== undefined) return;
    if (onCreateFile(path)) openFile(path);
  };

  const submitRename = (oldPath: string) => {
    const next = renameVal.trim().replace(/^\/+/, "");
    setRenaming(null);
    if (!next || next === oldPath || files?.[next] !== undefined) return;
    // Drop any pending debounced edit for the old path so it can't resurrect it.
    cancelDebounce();
    if (!onRenameFile(oldPath, next)) return; // no-op (e.g. scaffold-only file) → no desync
    setOpenTabs((prev) => prev.map((t) => (t === oldPath ? next : t)));
    if (activePath === oldPath) setActivePath(next);
  };

  const remove = (path: string) => {
    if (!window.confirm(`ลบไฟล์ ${path}?`)) return;
    cancelDebounce();
    if (onDeleteFile(path)) closeTab(path);
  };

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode =>
    nodes.map((node) => {
      const pad = { paddingLeft: `${depth * 12 + 8}px` };
      if (node.type === "folder") {
        const isOpen = !collapsed.has(node.path);
        return (
          <div key={`d:${node.path}`}>
            <button
              onClick={() => toggleFolder(node.path)}
              style={pad}
              className="flex w-full items-center gap-1.5 py-1 pr-2 text-left font-mono text-[12px] text-chalk-dim transition hover:text-chalk"
            >
              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {isOpen ? <FolderOpen size={12} className="text-shine/70" /> : <Folder size={12} className="text-shine/70" />}
              <span className="truncate">{node.name}</span>
            </button>
            {isOpen && node.children && renderNodes(node.children, depth + 1)}
          </div>
        );
      }
      const isActive = activeFile === node.path;
      if (renaming === node.path) {
        return (
          <input
            key={`f:${node.path}`}
            autoFocus
            value={renameVal}
            style={pad}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={() => submitRename(node.path)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename(node.path);
              if (e.key === "Escape") setRenaming(null);
            }}
            className="block w-full border border-shine bg-night py-1 pr-2 font-mono text-[12px] text-chalk outline-none"
          />
        );
      }
      return (
        <div
          key={`f:${node.path}`}
          className={`group flex items-center gap-1.5 py-1 pr-1.5 font-mono text-[12px] transition ${
            isActive ? "border-r-2 border-shine bg-shine/10 text-chalk" : "text-chalk-dim hover:text-chalk"
          }`}
          style={pad}
        >
          <button
            onClick={() => openFile(node.path)}
            onDoubleClick={() => onAttachToChat(node.path)}
            title="คลิกเพื่อเปิด · ดับเบิลคลิกเพื่อแนบในแชท"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <FileCode size={12} className="shrink-0 opacity-60" />
            <span className="truncate">{node.name}</span>
          </button>
          <button
            onClick={() => onAttachToChat(node.path)}
            title="แนบไฟล์นี้ในแชท"
            className="hidden shrink-0 text-chalk-dim transition hover:text-shine group-hover:block"
          >
            <Paperclip size={11} />
          </button>
          <button
            onClick={() => {
              setRenaming(node.path);
              setRenameVal(node.path);
            }}
            title="เปลี่ยนชื่อ"
            className="hidden shrink-0 text-chalk-dim transition hover:text-chalk group-hover:block"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={() => remove(node.path)}
            title="ลบ"
            className="hidden shrink-0 text-chalk-dim transition hover:text-halt group-hover:block"
          >
            <Trash2 size={11} />
          </button>
        </div>
      );
    });

  if (!files || paths.length === 0) {
    return (
      <div className="bg-grid flex flex-1 items-center justify-center">
        <p className="font-display text-sm text-chalk-dim">ยังไม่มีโค้ด — กำลังเตรียมเวที…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="scroll-thin flex w-56 shrink-0 flex-col overflow-y-auto border-r border-night-edge bg-night-panel py-1">
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-chalk-dim">
            Files · {paths.length}
          </span>
          <button
            onClick={() => {
              setCreating(true);
              setNewName("");
            }}
            title="ไฟล์ใหม่"
            className="text-chalk-dim transition hover:text-shine"
          >
            <Plus size={13} />
          </button>
        </div>
        {creating && (
          <input
            autoFocus
            value={newName}
            placeholder="src/components/Foo.tsx"
            onChange={(e) => setNewName(e.target.value)}
            onBlur={submitCreate}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
              if (e.key === "Escape") setCreating(false);
            }}
            className="mx-2 mb-1 border border-shine bg-night px-2 py-1 font-mono text-[12px] text-chalk outline-none placeholder:text-chalk-dim/50"
          />
        )}
        <div className="min-h-0 flex-1">{renderNodes(tree, 0)}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {tabs.length > 0 && (
          <div className="scroll-thin flex shrink-0 items-stretch overflow-x-auto border-b border-night-edge bg-night-panel">
            {tabs.map((path) => {
              const isActive = activeFile === path;
              return (
                <div
                  key={path}
                  className={`group flex shrink-0 items-center gap-2 border-r border-night-edge px-3 py-1.5 font-mono text-[11px] transition ${
                    isActive ? "bg-night text-chalk" : "text-chalk-dim hover:text-chalk"
                  }`}
                >
                  <button onClick={() => setActivePath(path)} className="max-w-[160px] truncate">
                    {path.split("/").pop()}
                  </button>
                  <button
                    onClick={() => closeTab(path)}
                    className="shrink-0 text-chalk-dim transition hover:text-chalk"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="min-h-0 flex-1">
          {activeFile && (
            <MonacoEditor
              key={activeFile}
              height="100%"
              theme="vs-dark"
              language={languageOf(activeFile)}
              value={files[activeFile]}
              onMount={handleEditorMount}
              onChange={(value) => {
                if (value === undefined || !activeFile) return;
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => onEdit(activeFile, value), 600);
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
    </div>
  );
}

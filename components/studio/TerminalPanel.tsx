"use client";

import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import type { Terminal } from "@xterm/xterm";
import type { SearchAddon } from "@xterm/addon-search";
import { ChevronDown, ChevronUp, Copy, Download, Search } from "lucide-react";
import { startShell } from "@/lib/webcontainer";

/**
 * Interactive terminal (xterm.js) wired to a jsh shell inside the WebContainer.
 * Run real commands against the live filesystem (ls, npm, node), with clickable
 * links, find-in-terminal, copy-selection, and download-log.
 */
export default function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const logRef = useRef("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const [{ Terminal: Term }, { FitAddon }, { WebLinksAddon }, { SearchAddon: Search }] =
        await Promise.all([
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
          import("@xterm/addon-web-links"),
          import("@xterm/addon-search"),
        ]);
      if (disposed || !el) return;

      const term = new Term({
        convertEol: true,
        cursorBlink: true,
        fontSize: 12,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        theme: { background: "#0d0c09", foreground: "#d6d3c7", cursor: "#64cefb" },
      });
      const fit = new FitAddon();
      const search = new Search();
      term.loadAddon(fit);
      term.loadAddon(new WebLinksAddon());
      term.loadAddon(search);
      term.open(el);
      fit.fit();
      termRef.current = term;
      searchRef.current = search;

      let shell;
      try {
        shell = await startShell({ cols: term.cols, rows: term.rows });
      } catch (error) {
        const message = error instanceof Error ? error.message : "เปิด terminal ไม่ได้";
        term.writeln(`\x1b[31m${message}\x1b[0m`);
        cleanup = () => term.dispose();
        return;
      }
      if (disposed) {
        shell.kill();
        term.dispose();
        return;
      }

      void shell.output.pipeTo(
        new WritableStream({
          write: (data) => {
            term.write(data);
            logRef.current += data;
          },
        })
      );
      const input = shell.input.getWriter();
      const onData = term.onData((data) => void input.write(data));

      const observer = new ResizeObserver(() => {
        try {
          fit.fit();
          shell.resize({ cols: term.cols, rows: term.rows });
        } catch {
          // disposed mid-resize
        }
      });
      observer.observe(el);

      cleanup = () => {
        onData.dispose();
        observer.disconnect();
        try {
          input.releaseLock();
        } catch {
          // already released
        }
        shell.kill();
        term.dispose();
        termRef.current = null;
        searchRef.current = null;
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  const find = (forward: boolean) => {
    if (!query) return;
    if (forward) searchRef.current?.findNext(query);
    else searchRef.current?.findPrevious(query);
  };

  const copySelection = () => {
    const selection = termRef.current?.getSelection();
    if (selection) void navigator.clipboard.writeText(selection).catch(() => {});
  };

  const downloadLog = () => {
    const blob = new Blob([logRef.current], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "terminal.log";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col bg-[#0d0c09]">
      <div className="flex items-center gap-1.5 border-b border-night-edge px-2 py-1">
        <Search size={11} className="shrink-0 text-chalk-dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") find(!e.shiftKey);
          }}
          placeholder="ค้นหาใน terminal…"
          className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-chalk outline-none placeholder:text-chalk-dim/50"
        />
        <button onClick={() => find(false)} title="ก่อนหน้า" className="text-chalk-dim transition hover:text-chalk">
          <ChevronUp size={12} />
        </button>
        <button onClick={() => find(true)} title="ถัดไป" className="text-chalk-dim transition hover:text-chalk">
          <ChevronDown size={12} />
        </button>
        <button onClick={copySelection} title="คัดลอกที่เลือก" className="ml-1 text-chalk-dim transition hover:text-chalk">
          <Copy size={12} />
        </button>
        <button onClick={downloadLog} title="ดาวน์โหลด log" className="text-chalk-dim transition hover:text-chalk">
          <Download size={12} />
        </button>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden p-2" />
    </div>
  );
}

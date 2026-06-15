"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DOC_PATHS, docOnlyFiles, docsFromFiles, hasRunnableApp } from "@/lib/define";
import { mergeFiles } from "@/lib/files";
import { isBuildPhase, nextPhase, phaseDef, type PhaseId } from "@/lib/phases";
import { streamAgent, streamGenerate } from "@/lib/sse";
import {
  appendMessage,
  getProject,
  newMessage,
  saveProject,
  undo as undoProject,
  withHistory,
} from "@/lib/storage";
import type {
  AgentTurn,
  DocKind,
  GenerationPhase,
  ProjectFiles,
  ProjectRecord,
  SpecAnswers,
} from "@/lib/types";
import {
  applyChanges,
  isPreviewSupported,
  runProject,
  warmBoot,
  writeFile,
} from "@/lib/webcontainer";
import ChatPanel from "./ChatPanel";
import CodePanel from "./CodePanel";
import PhaseStepper from "./PhaseStepper";
import PreviewPanel from "./PreviewPanel";
import SpecFlow, { type SpecResult } from "./SpecFlow";
import StatusBar from "./StatusBar";
import TopBar from "./TopBar";

const MAX_TERMINAL_LINES = 400;

export interface SpecPayload {
  brd?: string;
  prd?: string;
  presetId?: string;
  presetAnswers?: SpecAnswers;
}

type LastAction =
  | { kind: "generate"; prompt: string; spec?: SpecPayload }
  | { kind: "agent"; text: string | null };

/** Is the current phase's exit gate satisfied? */
function gateSatisfied(project: ProjectRecord): boolean {
  const docs = docsFromFiles(project.files);
  switch (project.phase) {
    case "define":
      return Boolean(docs.brd);
    case "plan":
      return Boolean(docs.prd);
    case "build":
      return hasRunnableApp(project.files);
    case "verify":
      return Boolean(docs.verify);
    case "review":
      return Boolean(docs.review);
    case "ship":
      return true;
    default: {
      const _never: never = project.phase;
      return Boolean(_never);
    }
  }
}

export default function Studio({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [streamedChars, setStreamedChars] = useState(0);
  const [view, setView] = useState<"preview" | "code">("preview");
  const [specOpen, setSpecOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(400);
  const [previewSupported, setPreviewSupported] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const lastActionRef = useRef<LastAction | null>(null);
  const projectRef = useRef<ProjectRecord | null>(null);

  const busy = phase === "generating" || phase === "installing" || phase === "starting";

  const pushTerminal = useCallback((line: string) => {
    setTerminal((prev) => [...prev.slice(-MAX_TERMINAL_LINES), line]);
  }, []);

  const persist = useCallback((next: ProjectRecord) => {
    const saved = saveProject(next);
    projectRef.current = saved; // keep the ref in sync synchronously for chained calls
    setProject(saved);
    return saved;
  }, []);

  const runCallbacks = useCallback(
    () => ({
      onPhase: (p: GenerationPhase) => {
        setPhase(p);
        if (p === "ready") setErrorMessage(null);
      },
      onTerminal: pushTerminal,
      onServerReady: (url: string) => {
        setPreviewUrl(url);
        setPreviewKey((k) => k + 1);
      },
      onError: (message: string) => {
        setErrorMessage(message);
        setPhase("error");
        pushTerminal(`✖ ${message}`);
      },
    }),
    [pushTerminal]
  );

  /** Boot (or re-boot) the preview from a full file set. */
  const boot = useCallback(
    async (files: ProjectFiles) => {
      if (!isPreviewSupported()) {
        setPreviewSupported(false);
        setView("code");
        setPhase("idle");
        return;
      }
      await runProject(files, runCallbacks());
    },
    [runCallbacks]
  );

  /**
   * Conversational phase turn (define/plan/verify/review/ship). `userText` is
   * null for the kickoff message (the agent greets / starts its work).
   */
  const runAgent = useCallback(
    async (userText: string | null, base?: ProjectRecord) => {
      const current = base ?? projectRef.current;
      if (!current) return;
      lastActionRef.current = { kind: "agent", text: userText };

      let working = current;
      if (userText) {
        working = persist(appendMessage(working, newMessage("user", userText, working.phase)));
      }

      setErrorMessage(null);
      setStreamedChars(0);
      setPhase("generating");

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        let turn: AgentTurn | null = null;
        for await (const event of streamAgent(
          {
            phase: working.phase,
            // Each agent only sees its own phase's turns, not the whole journey.
            messages: working.messages
              .filter((m) => m.phase === working.phase)
              .map(({ role, content }) => ({ role, content })),
            docs: docsFromFiles(working.files),
          },
          controller.signal
        )) {
          if (event.type === "delta") {
            setStreamedChars((n) => n + event.content.length);
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            turn = event.turn;
          }
        }
        if (!turn) throw new Error("ไม่ได้รับคำตอบจาก AI");

        const docEntries = Object.entries(turn.docs) as [DocKind, string][];
        if (docEntries.length > 0) {
          const files = { ...(working.files ?? {}) };
          for (const [kind, contents] of docEntries) {
            files[DOC_PATHS[kind]] = contents;
          }
          working = { ...working, files };
          setView("code");
          pushTerminal(`📄 อัปเดต ${docEntries.map(([kind]) => DOC_PATHS[kind]).join(", ")}`);
        }
        working = appendMessage(working, newMessage("assistant", turn.reply, working.phase));
        persist(working);
        setPhase("idle");
      } catch (error) {
        if (controller.signal.aborted) {
          pushTerminal("✋ ยกเลิกแล้ว");
          setPhase("idle");
          return;
        }
        const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
        setErrorMessage(message);
        setPhase("error");
        pushTerminal(`✖ ${message}`);
      } finally {
        abortRef.current = null;
      }
    },
    [persist, pushTerminal]
  );

  const generate = useCallback(
    async (prompt: string, spec?: SpecPayload, base?: ProjectRecord) => {
      const current = base ?? projectRef.current;
      if (!current || !prompt.trim()) return;

      lastActionRef.current = { kind: "generate", prompt, spec };
      const runnable = hasRunnableApp(current.files);
      const isIteration = runnable && !spec;

      let working = appendMessage(current, newMessage("user", prompt, current.phase));
      working = persist(working);

      setErrorMessage(null);
      setStreamedChars(0);
      setPhase("generating");
      pushTerminal(`▸ ${isIteration ? "iteration" : "generate"}: ${prompt.slice(0, 80)}`);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let result: import("@/lib/types").GenerationResult | null = null;
        for await (const event of streamGenerate(
          {
            prompt,
            iterationMode: isIteration,
            previousFiles: isIteration ? current.files : undefined,
            ...spec,
          },
          controller.signal
        )) {
          if (event.type === "delta") {
            setStreamedChars((n) => n + event.content.length);
          } else if (event.type === "status") {
            pushTerminal(`… ${event.message}`);
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            result = event.result;
          }
        }
        if (!result) throw new Error("ไม่ได้รับผลลัพธ์จาก AI");

        // Phase documents (docs/*.md) ride along into every fresh build so they
        // end up mounted in the WebContainer, the zip, and share links.
        const nextFiles = isIteration
          ? mergeFiles(current.files!, result.files, result.deleted)
          : { ...docOnlyFiles(current.files), ...result.files };

        working = withHistory(working, nextFiles);
        working = appendMessage(working, newMessage("assistant", result.note, current.phase));
        persist(working);
        setView("preview");

        if (isIteration && previewUrl) {
          await applyChanges(nextFiles, result.files, result.deleted, runCallbacks());
        } else {
          await boot(nextFiles);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          pushTerminal("✋ ยกเลิกแล้ว");
          setPhase(runnable ? "ready" : "idle");
          return;
        }
        const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
        setErrorMessage(message);
        setPhase("error");
        pushTerminal(`✖ ${message}`);
      } finally {
        abortRef.current = null;
      }
    },
    [boot, persist, previewUrl, pushTerminal, runCallbacks]
  );

  /** Build phase auto-kickoff: generate the demo from the approved BRD/PRD. */
  const buildFromDocs = useCallback(
    (base?: ProjectRecord) => {
      const proj = base ?? projectRef.current;
      const docs = docsFromFiles(proj?.files ?? null);
      void generate(
        "สร้าง web demo ตามเอกสาร BRD/PRD ที่แนบมา ให้ครบทุกหน้าจอและตรง design direction ที่ระบุ",
        { brd: docs.brd?.slice(0, 50_000), prd: docs.prd?.slice(0, 50_000) },
        proj ?? undefined
      );
    },
    [generate]
  );

  /** Approve the current phase and move to the next, kicking off its agent. */
  const advancePhase = useCallback(() => {
    const current = projectRef.current;
    if (!current || busy) return;
    const next = nextPhase(current.phase);
    if (!next || !gateSatisfied(current)) return;

    const approvedPhases = Array.from(
      new Set([...(current.approvedPhases ?? []), current.phase])
    );
    const working = persist({ ...current, phase: next, approvedPhases });
    pushTerminal(`✓ อนุมัติเฟส ${phaseDef(current.phase).user} → ${phaseDef(next).user}`);

    // Auto-kick the next agent only the first time we enter that phase.
    if (isBuildPhase(next)) {
      if (!hasRunnableApp(working.files)) buildFromDocs(working);
    } else if (!working.messages.some((m) => m.phase === next)) {
      void runAgent(null, working);
    }
  }, [busy, buildFromDocs, persist, pushTerminal, runAgent]);

  /** Jump back to an earlier (already-reached) phase. */
  const navigatePhase = useCallback(
    (target: PhaseId) => {
      const current = projectRef.current;
      if (!current || busy || target === current.phase) return;
      const working = persist({ ...current, phase: target });
      if (isBuildPhase(target) && hasRunnableApp(working.files)) setView("preview");
      else if (working.files) setView("code");
    },
    [busy, persist]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    const last = lastActionRef.current;
    if (!last) return;
    if (last.kind === "generate") void generate(last.prompt, last.spec);
    else void runAgent(last.text);
  }, [generate, runAgent]);

  const fixWithAi = useCallback(() => {
    const recentErrors = terminal.slice(-12).join("\n").slice(0, 400);
    void generate(`แก้ error นี้ให้หน่อย:\n${recentErrors}`);
  }, [generate, terminal]);

  const handleUndo = useCallback(() => {
    const current = projectRef.current;
    if (!current || busy) return;
    const reverted = undoProject(current);
    if (!reverted) return;
    const saved = persist(reverted);
    pushTerminal("↩ undo — ย้อนกลับ 1 ขั้น");
    if (hasRunnableApp(saved.files)) void boot(saved.files!);
  }, [boot, busy, persist, pushTerminal]);

  /** Monaco edits: persist + hot-write into the container. */
  const handleFileEdit = useCallback(
    (path: string, contents: string) => {
      const current = projectRef.current;
      if (!current?.files) return;
      persist({ ...current, files: { ...current.files, [path]: contents } });
      if (previewSupported && hasRunnableApp(current.files)) {
        void writeFile(path, contents).catch(() => {
          // Container not booted yet — persisted copy is the source of truth.
        });
      }
    },
    [persist, previewSupported]
  );

  const handleSpecComplete = useCallback(
    (spec: SpecResult) => {
      setSpecOpen(false);
      const base = projectRef.current;
      if (!base) return;
      // Capture the pasted BRD/PRD as project docs, then jump straight to Build.
      const files = { ...(base.files ?? {}) };
      if (spec.brd) files[DOC_PATHS.brd] = spec.brd;
      if (spec.prd) files[DOC_PATHS.prd] = spec.prd;
      const working = persist({ ...base, files, phase: "build" });
      void generate(
        spec.prompt,
        {
          brd: spec.brd,
          prd: spec.prd,
          presetId: spec.presetId,
          presetAnswers: spec.answers,
        },
        working
      );
    },
    [generate, persist]
  );

  // Load the project and consume any pending action from the landing page.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const loaded = getProject(projectId);
      if (!loaded) {
        setNotFound(true);
        return;
      }
      setPreviewSupported(isPreviewSupported());
      // Boot the container while the user is still typing/answering so the
      // first build skips the boot wait.
      warmBoot();

      const { pendingPrompt, pendingSpec } = loaded;
      if (pendingPrompt || pendingSpec) {
        const cleared = saveProject({
          ...loaded,
          pendingPrompt: undefined,
          pendingSpec: undefined,
        });
        setProject(cleared);
        projectRef.current = cleared;
        if (pendingPrompt) {
          void generate(pendingPrompt, undefined, cleared); // express build
        } else {
          setSpecOpen(true);
        }
      } else {
        setProject(loaded);
        projectRef.current = loaded;
        if (hasRunnableApp(loaded.files)) {
          void boot(loaded.files!);
        } else {
          if (loaded.files) setView("code");
          // Conversational phase with no turns yet → the agent opens it.
          if (
            !isBuildPhase(loaded.phase) &&
            !loaded.messages.some((m) => m.phase === loaded.phase)
          ) {
            void runAgent(null, loaded);
          }
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Keyboard: Escape cancels generation, Cmd/Ctrl+Z undoes (PRD §7.3).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && busy) {
        cancel();
        return;
      }
      const target = event.target as HTMLElement;
      const inEditor =
        target.tagName === "TEXTAREA" ||
        target.tagName === "INPUT" ||
        target.closest(".monaco-editor");
      if ((event.metaKey || event.ctrlKey) && event.key === "z" && !inEditor) {
        event.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, cancel, handleUndo]);

  // Resizable divider.
  const dragging = useRef(false);
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      setLeftWidth(Math.min(640, Math.max(320, event.clientX)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  if (notFound) {
    return (
      <div className="bg-grid flex min-h-screen flex-col items-center justify-center gap-4 text-chalk">
        <p className="font-display text-2xl font-semibold">ไม่พบโปรเจกต์นี้</p>
        <Link
          href="/"
          className="rounded-sm bg-shine px-5 py-2 font-display font-medium text-black transition hover:bg-shine-soft"
        >
          กลับหน้าแรก
        </Link>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-grid flex min-h-screen items-center justify-center">
        <span className="font-mono text-sm text-chalk-dim">กำลังโหลดสตูดิโอ…</span>
      </div>
    );
  }

  const hasApp = hasRunnableApp(project.files);
  const inBuild = isBuildPhase(project.phase);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-night text-chalk">
      <TopBar
        project={project}
        view={view}
        busy={busy}
        canUndo={project.history.length > 0}
        shippable={hasApp}
        onRename={(name) => persist({ ...project, name: name.trim() || "Untitled" })}
        onViewChange={setView}
        onUndo={handleUndo}
        onOpenSpec={() => setSpecOpen(true)}
      />

      <PhaseStepper
        phase={project.phase}
        busy={busy}
        canAdvance={gateSatisfied(project)}
        onAdvance={advancePhase}
        onNavigate={navigatePhase}
      />

      <div className="flex min-h-0 flex-1">
        <div style={{ width: leftWidth }} className="flex shrink-0 flex-col border-r border-night-edge">
          <ChatPanel
            messages={project.messages}
            busy={busy}
            phase={phase}
            workflowPhase={project.phase}
            agentName={phaseDef(project.phase).name}
            streamedChars={streamedChars}
            hasApp={hasApp}
            onSubmit={(text) => (inBuild ? void generate(text) : void runAgent(text))}
            onCancel={cancel}
          />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          onPointerDown={() => {
            dragging.current = true;
            document.body.style.cursor = "col-resize";
          }}
          className="w-1 shrink-0 cursor-col-resize bg-night-edge transition hover:bg-shine"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {view === "preview" ? (
            <PreviewPanel
              url={previewUrl}
              previewKey={previewKey}
              phase={phase}
              supported={previewSupported}
              hasFiles={hasApp}
              onRefresh={() => setPreviewKey((k) => k + 1)}
            />
          ) : (
            <CodePanel files={project.files} onEdit={handleFileEdit} />
          )}
        </div>
      </div>

      <StatusBar
        phase={phase}
        errorMessage={errorMessage}
        terminal={terminal}
        onRetry={retry}
        onFixWithAi={fixWithAi}
        canFix={hasApp}
      />

      {specOpen && (
        <SpecFlow onClose={() => setSpecOpen(false)} onComplete={handleSpecComplete} />
      )}
    </div>
  );
}

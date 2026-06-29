"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DOC_PATHS, docOnlyFiles, docsFromFiles, hasRunnableApp } from "@/lib/define";
import { computeChanges, sanitizeFiles } from "@/lib/files";
import { isBuildPhase, nextPhase, phaseDef, type PhaseId } from "@/lib/phases";
import { type DesignOption, designStyleDirective, fetchDesignOptions } from "@/lib/design";
import { extraDepsOf, packageJsonWithDeps, SCAFFOLD_FILES, VITE_CONFIG } from "@/lib/scaffold";
import { takePendingAction } from "@/lib/pending-action";
import { encodeShareUrl } from "@/lib/share";
import { streamAgent, streamGenerate } from "@/lib/sse";
import {
  appendMessage,
  approvePhase,
  type ApprovalState,
  getAccess,
  getApprovalState,
  getProject,
  newMessage,
  saveProject,
  undo as undoProject,
  withHistory,
} from "@/lib/storage";
import type {
  AgentTurn,
  ChatAttachmentInput,
  DocKind,
  GenerationPhase,
  LiveMessage,
  OrgDna,
  ProjectFiles,
  ProjectRecord,
  SpecAnswers,
} from "@/lib/types";
import { getOrg } from "@/lib/orgs";
import {
  isPreviewSupported,
  prepareWorkdir,
  readSource,
  removeFile,
  runProject,
  warmBoot,
  writeFile,
} from "@/lib/webcontainer";
import {
  beginGeneration,
  endGeneration,
  isGenerating,
  subscribeGenerations,
} from "@/lib/generation/registry";
import { createClient } from "@/lib/supabase/client";
import { emitSystemLog } from "@/lib/team-chat-bus";
import { toast } from "@/lib/toast";
import { confirm } from "@/lib/confirm";
import ChatPanel from "./ChatPanel";
import LiveCursors from "./LiveCursors";
import CodePanel from "./CodePanel";
import DesignPicker from "./DesignPicker";
import DocPreviewModal from "./DocPreviewModal";
import PackageSearch from "./PackageSearch";
import PhaseStepper from "./PhaseStepper";
import PreviewPanel from "./PreviewPanel";
import ShareModal from "./ShareModal";
import SkillPicker from "./SkillPicker";
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

/** The markdown doc(s) each phase produces (build emits code, not a doc). Define
 *  produces both IDEA and BRD — the preview shows both as tabs. */
const DOC_KINDS_BY_PHASE: Partial<Record<PhaseId, DocKind[]>> = {
  define: ["idea", "brd"],
  plan: ["prd"],
  verify: ["verify"],
  review: ["review"],
  ship: ["ship"],
};

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
  const [view, setView] = useState<"preview" | "code">("preview");
  const [previewPhase, setPreviewPhase] = useState<PhaseId | null>(null);
  const [approval, setApproval] = useState<ApprovalState | null>(null);
  const [specOpen, setSpecOpen] = useState(false);
  const [packagesOpen, setPackagesOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(400);
  const [previewSupported, setPreviewSupported] = useState(true);
  const [chatStreaming, setChatStreaming] = useState(false);
  // The in-progress assistant turn (thinking/text/actions), rendered live and
  // committed to project.messages once at done. React state only — not persisted
  // per token. liveRef mirrors it so the streaming loop can read the latest.
  const [live, setLive] = useState<LiveMessage | null>(null);
  // Design-preview picker (first build only): while fetching, designBusy; once
  // ready, designOptions render in the canvas; pendingDesignPrompt holds the
  // build request until the user picks a direction or skips.
  const [designOptions, setDesignOptions] = useState<DesignOption[] | null>(null);
  const [designBusy, setDesignBusy] = useState(false);
  const pendingDesignPromptRef = useRef<string | null>(null);
  // File paths attached as reference chips for the next chat message (double-click
  // a file in the tree). Folded into the message text on submit, then cleared.
  const [attachedPaths, setAttachedPaths] = useState<string[]>([]);

  const attachFile = useCallback((path: string) => {
    setAttachedPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
  }, []);
  const removeAttachment = useCallback((path: string) => {
    setAttachedPaths((prev) => prev.filter((p) => p !== path));
  }, []);

  const [readOnly, setReadOnly] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [orgDna, setOrgDna] = useState<OrgDna | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [detectedSkillId, setDetectedSkillId] = useState<string | null>(null);
  const [detectingSkill, setDetectingSkill] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  // Set true when THIS studio instance unmounts. A detached generation keeps
  // streaming + persisting to storage (so it finishes in the background) but
  // must never touch the shared WebContainer again — that container now belongs
  // to whatever the user navigated to. Per-instance, never reset, which avoids
  // any race with a future studio that re-opens the same project.
  const detachedRef = useRef(false);
  const lastActionRef = useRef<LastAction | null>(null);
  const projectRef = useRef<ProjectRecord | null>(null);
  const liveRef = useRef<LiveMessage | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skillCheckedRef = useRef<string | null>(null);
  // Realtime fan-out so collaborators see each other's turns live. The channel
  // is ephemeral pub/sub (no DB schema); clientId tags our own broadcasts so we
  // ignore them; streamingRef mirrors chatStreaming so an incoming update never
  // clobbers our own in-flight turn (the closure would otherwise read it stale).
  const rtChannelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const clientIdRef = useRef("");
  const streamingRef = useRef(false);
  const rtReloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // AI-chat presence: who else is typing/running the AI in this project right now.
  const nameRef = useRef("");
  const aiPeerTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastAiTypingSent = useRef(0);
  const [aiPeers, setAiPeers] = useState<Map<string, { name: string; mode: "typing" | "working" }>>(
    new Map()
  );

  // Show the domain SkillPicker once per project at the start of Define when no
  // skill is chosen yet, and auto-detect from the prompt / first message.
  useEffect(() => {
    if (!project || readOnly) return;
    if (project.skillId || project.phase !== "define") return;
    if (skillCheckedRef.current === project.id) return;
    skillCheckedRef.current = project.id;
    const text = (project.messages.find((m) => m.role === "user")?.content ?? "").trim();
    let cancelled = false;
    (async () => {
      if (!cancelled) setSkillPickerOpen(true);
      if (!text) return;
      if (!cancelled) setDetectingSkill(true);
      try {
        const res = await fetch("/api/detect-skill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = (await res.json().catch(() => null)) as { skillId?: string | null } | null;
        if (!cancelled) setDetectedSkillId(data?.skillId ?? null);
      } catch {
        if (!cancelled) setDetectedSkillId(null);
      } finally {
        if (!cancelled) setDetectingSkill(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, readOnly]);

  const setLiveBoth = useCallback((value: LiveMessage | null) => {
    liveRef.current = value;
    setLive(value);
  }, []);

  const appendLive = useCallback(
    (patch: (prev: LiveMessage) => LiveMessage) => {
      const base = liveRef.current ?? { thinking: "", content: "", actions: [] };
      const next = patch(base);
      liveRef.current = next;
      setLive(next);
    },
    []
  );

  // `phase` tracks the WebContainer (install/run); `chatStreaming` tracks a
  // conversational agent turn. Both can run at once — the live scaffold installs
  // while the Define interview streams — so they are kept as separate signals.
  const wcBusy = phase === "generating" || phase === "installing" || phase === "starting";
  const busy = wcBusy || chatStreaming;

  const pushTerminal = useCallback((line: string) => {
    setTerminal((prev) => [...prev.slice(-MAX_TERMINAL_LINES), line]);
  }, []);

  const persist = useCallback((next: ProjectRecord) => {
    const local = { ...next, updatedAt: new Date().toISOString() };
    projectRef.current = local; // synchronous for chained calls
    setProject(local);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      saveProject(local)
        .then(() => {
          setSaveState("saved");
          // Tell collaborators a new turn landed so their idle views pull it in.
          rtChannelRef.current?.send({
            type: "broadcast",
            event: "updated",
            payload: { from: clientIdRef.current },
          });
        })
        .catch((e) => {
          console.error("[studio] save failed:", e);
          setSaveState("idle");
          toast.error("บันทึกไม่สำเร็จ", {
            description: "การเปลี่ยนแปลงล่าสุดอาจยังไม่ถูกบันทึก — เช็กการเชื่อมต่อแล้วลองอีกครั้ง",
          });
        });
    }, 800);
    return local;
  }, []);

  const runCallbacks = useCallback(
    () => ({
      // Note: does NOT clear errorMessage on "ready" — the scaffold's WebContainer
      // reaching ready must not wipe a concurrent chat-agent error during Define.
      // Errors are cleared at the start of the next action (generate/runAgent/undo).
      onPhase: setPhase,
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
      // Sanitize CSS on the way in so a project cached with the crash-inducing
      // `@import "tailwindcss"` self-heals on next boot. vite.config.js is
      // canonical (never authored by the AI) — always boot the current version so
      // older projects pick up the live-cursor forwarder plugin.
      await runProject(
        { ...sanitizeFiles(files), "vite.config.js": VITE_CONFIG },
        runCallbacks()
      );
    },
    [runCallbacks]
  );

  /**
   * Bring the live Vite scaffold up on session open. Warm-up failures stay
   * soft (terminal only) — they must not paint a build-style error over the
   * interview; the real Build surfaces install errors when they actually matter.
   */
  const bootScaffold = useCallback(async () => {
    if (!isPreviewSupported()) {
      setPreviewSupported(false);
      setView("code");
      return;
    }
    setView("preview");
    await runProject(SCAFFOLD_FILES, {
      ...runCallbacks(),
      onError: (message) => {
        setPhase("idle");
        pushTerminal(`⚠ เตรียม preview ไม่สำเร็จ: ${message}`);
      },
    });
  }, [runCallbacks, pushTerminal]);

  /**
   * Conversational phase turn (define/plan/verify/review/ship). `userText` is
   * null for the kickoff message (the agent greets / starts its work).
   */
  const runAgent = useCallback(
    async (
      userText: string | null,
      base?: ProjectRecord,
      express?: boolean,
      attachments?: ChatAttachmentInput[]
    ): Promise<ProjectRecord | null> => {
      const current = base ?? projectRef.current;
      if (!current) return null;
      lastActionRef.current = { kind: "agent", text: userText };

      let working = current;
      if (userText) {
        working = persist(appendMessage(working, newMessage("user", userText, working.phase)));
      }

      setErrorMessage(null);
      setChatStreaming(true);
      setLiveBoth({ thinking: "", content: "", actions: [] });
      beginGeneration(projectId, current.name);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        let turn: AgentTurn | null = null;
        let thoughtStart: number | null = null;
        let thoughtLogged = false;
        for await (const event of streamAgent(
          {
            phase: working.phase,
            // Each agent only sees its own phase's turns, not the whole journey.
            messages: working.messages
              .filter((m) => m.phase === working.phase)
              .map(({ role, content }) => ({ role, content })),
            docs: docsFromFiles(working.files),
            skillId: working.skillId,
            express,
            projectId,
            attachments,
          },
          controller.signal
        )) {
          if (event.type === "thought") {
            if (thoughtStart === null) thoughtStart = Date.now();
            appendLive((p) => ({ ...p, thinking: p.thinking + event.content }));
            continue;
          }
          if (thoughtStart !== null && !thoughtLogged) {
            const secs = Math.max(1, Math.round((Date.now() - thoughtStart) / 1000));
            appendLive((p) => ({
              ...p,
              actions: [...p.actions, { icon: "thought", label: `คิดเป็นเวลา ${secs} วินาที` }],
            }));
            thoughtLogged = true;
          }
          if (event.type === "text") {
            appendLive((p) => ({ ...p, content: p.content + event.content }));
          } else if (event.type === "action") {
            appendLive((p) => ({ ...p, actions: [...p.actions, { icon: event.icon, label: event.label }] }));
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
        const assistantMsg = newMessage("assistant", turn.reply, working.phase);
        if (turn.ask) assistantMsg.ask = turn.ask;
        if (turn.citations?.length) assistantMsg.citations = turn.citations;
        if (docEntries.length > 0) assistantMsg.hasDoc = true;
        const snap = liveRef.current;
        if (snap?.thinking.trim()) assistantMsg.thinking = snap.thinking.trim();
        if (snap?.actions.length) assistantMsg.actions = snap.actions;
        working = appendMessage(working, assistantMsg);
        return persist(working);
      } catch (error) {
        if (controller.signal.aborted) {
          pushTerminal("✋ ยกเลิกแล้ว");
          return null;
        }
        const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
        setErrorMessage(message);
        pushTerminal(`✖ ${message}`);
        toast.error("AI สะดุด", { description: message });
        return null;
      } finally {
        if (detachedRef.current && projectRef.current) {
          await saveProject(projectRef.current).catch(() => {});
        }
        endGeneration(projectId);
        setChatStreaming(false);
        setLiveBoth(null);
        abortRef.current = null;
      }
    },
    [appendLive, persist, pushTerminal, setLiveBoth, projectId]
  );

  const generate = useCallback(
    async (
      prompt: string,
      spec?: SpecPayload,
      base?: ProjectRecord,
      attachments?: ChatAttachmentInput[]
    ) => {
      const current = base ?? projectRef.current;
      if (!current || !prompt.trim()) return;

      lastActionRef.current = { kind: "generate", prompt, spec };
      const runnable = hasRunnableApp(current.files);
      const isIteration = runnable && !spec;

      let working = appendMessage(current, newMessage("user", prompt, current.phase));
      // Snapshot the pre-generation files into history NOW (not only at the end)
      // so a turn interrupted by navigating away is still undoable — paired with
      // the abort-path save below, partial work survives leaving the studio.
      working = persist(withHistory(working, current.files ?? {}));
      beginGeneration(projectId, current.name);

      // liveContainer = a dev server is already running (scaffold/app), so we can
      // write each file into it as it streams and let Vite HMR show the build.
      const liveContainer = previewSupported && Boolean(previewUrl);

      setErrorMessage(null);
      setChatStreaming(true);
      setLiveBoth({ thinking: "", content: "", actions: [] });
      if (!liveContainer) setPhase("generating"); // no server yet → overlay until we boot
      setView("preview");
      pushTerminal(`▸ ${isIteration ? "iteration" : "generate"}: ${prompt.slice(0, 80)}`);

      // Phase docs (+ the existing app on iteration) ride along; streamed files
      // are layered on top so the result lands in zip/share too.
      const files: ProjectFiles = isIteration
        ? { ...(current.files ?? {}) }
        : { ...docOnlyFiles(current.files) };

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        let note = "";
        let deleted: string[] = [];
        let depsAdded = false;
        let thoughtStart: number | null = null;
        let thoughtLogged = false;
        for await (const event of streamGenerate(
          {
            prompt,
            iterationMode: isIteration,
            previousFiles: isIteration ? current.files : undefined,
            skillId: current.skillId,
            projectId,
            attachments,
            ...spec,
          },
          controller.signal
        )) {
          if (event.type === "thought") {
            if (thoughtStart === null) thoughtStart = Date.now();
            appendLive((p) => ({ ...p, thinking: p.thinking + event.content }));
            continue;
          }
          // First non-thought event → the model finished thinking: log the duration once.
          if (thoughtStart !== null && !thoughtLogged) {
            const secs = Math.max(1, Math.round((Date.now() - thoughtStart) / 1000));
            appendLive((p) => ({
              ...p,
              actions: [...p.actions, { icon: "thought", label: `คิดเป็นเวลา ${secs} วินาที` }],
            }));
            thoughtLogged = true;
          }
          if (event.type === "status") {
            pushTerminal(`… ${event.message}`);
          } else if (event.type === "file") {
            files[event.path] = event.content;
            pushTerminal(`📝 ${event.path}`);
            appendLive((p) => ({ ...p, actions: [...p.actions, { icon: "file", label: event.path }] }));
            if (liveContainer && !detachedRef.current)
              void writeFile(event.path, event.content).catch(() => {});
          } else if (event.type === "delete") {
            delete files[event.path];
            if (liveContainer && !detachedRef.current)
              void removeFile(event.path).catch(() => {});
          } else if (event.type === "deps") {
            depsAdded = true;
            pushTerminal(`+ ติดตั้ง: ${event.packages.join(", ")}`);
            appendLive((p) => ({ ...p, actions: [...p.actions, { icon: "deps", label: event.packages.join(", ") }] }));
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else if (event.type === "done") {
            note = event.note;
            deleted = event.deleted;
          }
        }
        for (const path of deleted) delete files[path];

        const changes = computeChanges(current.files, files);
        // History was already snapshotted at the start of the turn, so just set
        // the final files here (don't push a second history entry).
        working = { ...working, files };
        const assistantMsg = newMessage("assistant", note || "สร้างเรียบร้อยแล้ว", current.phase);
        const snap = liveRef.current;
        if (snap?.thinking.trim()) assistantMsg.thinking = snap.thinking.trim();
        if (snap?.actions.length) assistantMsg.actions = snap.actions;
        if (changes.length) assistantMsg.changes = changes;
        working = appendMessage(working, assistantMsg);
        persist(working);

        // Detached (user navigated away): files are already persisted above —
        // skip all container work, it belongs to the foreground project now.
        if (!detachedRef.current) {
          if (depsAdded) {
            // package.json changed (new npm packages) → re-mount + reinstall so
            // the generated code that imports them actually runs.
            await boot(files);
          } else if (liveContainer) {
            setPhase("ready"); // files already streamed into the running server (HMR)
          } else {
            await boot(files); // first run with no server → boot it now
          }
        }
      } catch (error) {
        if (controller.signal.aborted) {
          // Aborted = the user navigated away / switched project mid-stream.
          // Persist what streamed so far so the work isn't lost (the pre-gen
          // state is in history for undo). This runs even as Studio unmounts
          // because the async loop and saveProject aren't tied to React.
          void saveProject({
            ...working,
            files: { ...files },
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
          pushTerminal("✋ ยกเลิกแล้ว");
          setPhase(runnable || liveContainer ? "ready" : "idle");
          return;
        }
        const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
        setErrorMessage(message);
        if (!liveContainer) setPhase("error");
        pushTerminal(`✖ ${message}`);
        toast.error("สร้างไม่สำเร็จ", { description: message });
      } finally {
        // If this ran detached (in the background), flush the final state now so
        // a studio re-opening this project reads the result, not a stale save.
        if (detachedRef.current && projectRef.current) {
          await saveProject(projectRef.current).catch(() => {});
        }
        endGeneration(projectId);
        setChatStreaming(false);
        setLiveBoth(null);
        abortRef.current = null;
      }
    },
    [appendLive, boot, persist, previewSupported, previewUrl, pushTerminal, setLiveBoth, projectId]
  );

  /** Resume the build after the user picks a design (or skips → no directive). */
  const resolveDesign = useCallback(
    (option: DesignOption | null) => {
      const prompt = pendingDesignPromptRef.current;
      pendingDesignPromptRef.current = null;
      setDesignOptions(null);
      setDesignBusy(false);
      if (!prompt) return;
      void generate(option ? `${prompt}\n\n${designStyleDirective(option)}` : prompt);
    },
    [generate]
  );

  /**
   * Build-phase chat submit. The FIRST build (no app yet) detours through the
   * design-preview picker; once an app exists, every message is a direct
   * iteration. If fetching options fails, fall back to a plain build.
   */
  const handleBuildSubmit = useCallback(
    (text: string, attachments?: ChatAttachmentInput[]) => {
      const firstBuild = !hasRunnableApp(projectRef.current?.files ?? null) && previewSupported;
      if (!firstBuild) {
        void generate(text, undefined, undefined, attachments);
        return;
      }
      setErrorMessage(null);
      pendingDesignPromptRef.current = text;
      setDesignOptions(null);
      setDesignBusy(true);
      setView("preview");
      void fetchDesignOptions({ prompt: text })
        .then((options) => {
          // Ignore a stale result if the user already moved on.
          if (pendingDesignPromptRef.current !== text) return;
          setDesignOptions(options);
          setDesignBusy(false);
        })
        .catch(() => {
          if (pendingDesignPromptRef.current !== text) return;
          resolveDesign(null); // graceful fallback: build with no directive
        });
    },
    [generate, previewSupported, resolveDesign]
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

  /**
   * Rework: regenerate the whole app from the CURRENT BRD/PRD (after the user
   * went back and edited them). Full rebuild (not an iteration) so the app
   * matches the spec again; the previous app rides into history for Undo. Always
   * lands in Build with Define/Plan marked approved.
   */
  const rebuildFromDocs = useCallback(async () => {
    const current = projectRef.current;
    if (!current || busy || readOnly) return;
    const docs = docsFromFiles(current.files);
    if (!docs.brd || !docs.prd) return;
    const ok = await confirm({
      title: "สร้างเว็บใหม่จาก BRD/PRD ปัจจุบัน?",
      message: "โค้ดที่มีอยู่จะถูกแทนที่ทั้งหมด (ย้อนกลับได้ด้วย Undo)",
      confirmLabel: "สร้างใหม่",
      danger: true,
    });
    if (!ok) return;
    const working = persist({
      ...current,
      phase: "build",
      approvedPhases: Array.from(
        new Set([...(current.approvedPhases ?? []), "define" as PhaseId, "plan" as PhaseId])
      ),
    });
    buildFromDocs(working);
  }, [busy, readOnly, persist, buildFromDocs]);

  /**
   * Express auto-pilot: the brief is complete, so walk the full flow without the
   * interview — Define→BRD, Plan→PRD (each emitted in one shot), then Build from
   * the docs. Stops (leaving the user in control) if a phase fails to produce its
   * doc. The prompt rides in as the first chat message so the user sees it.
   */
  const runExpressPipeline = useCallback(
    async (prompt: string, base: ProjectRecord) => {
      pushTerminal("⚡ Express: สร้าง BRD จาก brief…");
      let rec = await runAgent(prompt, { ...base, phase: "define" }, true);
      if (!rec || !docsFromFiles(rec.files).brd) return;

      rec = persist({
        ...rec,
        phase: "plan",
        approvedPhases: Array.from(new Set([...(rec.approvedPhases ?? []), "define" as PhaseId])),
      });
      pushTerminal("⚡ Express: สร้าง PRD จาก BRD…");
      rec = await runAgent(null, rec, true);
      if (!rec || !docsFromFiles(rec.files).prd) return;

      rec = persist({
        ...rec,
        phase: "build",
        approvedPhases: Array.from(new Set([...(rec.approvedPhases ?? []), "plan" as PhaseId])),
      });
      pushTerminal("⚡ Express: build จาก BRD/PRD…");
      buildFromDocs(rec);
    },
    [runAgent, persist, buildFromDocs, pushTerminal]
  );

  /** Approve the current phase and move to the next, kicking off its agent. */
  const advancePhase = useCallback(() => {
    const current = projectRef.current;
    if (!current) return;
    // Only the worker that owns THIS phase blocks advance: a background scaffold
    // install (wcBusy) must not stop the user approving a finished BRD/PRD.
    const wcWorking = phase === "generating" || phase === "installing" || phase === "starting";
    const blocked = isBuildPhase(current.phase) ? wcWorking || chatStreaming : chatStreaming;
    if (blocked) return;
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
  }, [phase, chatStreaming, buildFromDocs, persist, pushTerminal, runAgent]);

  /** Re-read who has approved the current phase (count is shown in the stepper). */
  const refreshApproval = useCallback(async () => {
    const current = projectRef.current;
    if (!current) return;
    try {
      setApproval(await getApprovalState(projectId, current.phase));
    } catch (e) {
      console.error("[studio] refreshApproval:", e);
    }
  }, [projectId]);

  /**
   * "อนุมัติ & ไปต่อ". Solo (only the owner) → advance immediately. Shared project →
   * record THIS user's approval; the phase advances only once every member (owner
   * + all invited members, any role) has approved. The session that lands the
   * final approval performs the advance; others converge on focus/poll.
   */
  const handleApprove = useCallback(async () => {
    const current = projectRef.current;
    if (!current || readOnly || !gateSatisfied(current)) return;
    const state = approval ?? (await getApprovalState(projectId, current.phase));
    if (state.approvers.length <= 1) {
      advancePhase();
      return;
    }
    await approvePhase(projectId, current.phase);
    // Log who approved this phase into the team chat (best-effort, live to all).
    const { data: { user } } = await createClient().auth.getUser();
    const meta = user?.user_metadata ?? {};
    const who = (meta.full_name ?? meta.name ?? user?.email ?? "สมาชิก") as string;
    emitSystemLog(projectId, `${who} อนุมัติขั้น “${phaseDef(current.phase).user}” แล้ว`);
    const fresh = await getApprovalState(projectId, current.phase);
    setApproval(fresh);
    const done = fresh.approvers.every((a) => fresh.approved.includes(a));
    if (done) {
      advancePhase();
      toast.success("อนุมัติครบทุกคนแล้ว", { description: "ไปต่อขั้นถัดไปได้เลย" });
    } else {
      const left = fresh.approvers.length - fresh.approved.length;
      toast.success("บันทึกการอนุมัติของคุณแล้ว", {
        description: `รออีก ${left} คนอนุมัติก่อนไปต่อ`,
      });
    }
  }, [approval, projectId, readOnly, advancePhase]);

  /**
   * Click a completed step → preview that phase's document in a modal. This does
   * NOT move the workflow back (that confused the flow — the user could re-approve
   * and "advance" again). To change a doc, edit it in the Code tab, then use the
   * "สร้างใหม่จากเอกสาร" rework button. Build has no doc → peek at the running app.
   */
  const previewPhaseDoc = useCallback((target: PhaseId) => {
    if (isBuildPhase(target)) {
      if (hasRunnableApp(projectRef.current?.files ?? null)) setView("preview");
      return;
    }
    setPreviewPhase(target);
  }, []);

  /**
   * Revise a phase's doc from the preview modal: the comment goes into the chat
   * and that phase's agent regenerates the doc (express, one shot). Revising the
   * BRD also regenerates the PRD afterward (chained) since the spec follows the
   * brief. The app is left for the explicit "สร้างใหม่จากเอกสาร" rebuild.
   */
  const reviseDoc = useCallback(
    async (target: PhaseId, comment: string) => {
      const current = projectRef.current;
      if (!current || busy || readOnly || !comment.trim()) return;
      setPreviewPhase(null); // the revision streams in the chat behind the modal
      let rec: ProjectRecord | null = persist({ ...current, phase: target });
      rec = await runAgent(comment.trim(), rec, true);
      if (!rec) return;
      if (target === "define" && docsFromFiles(rec.files).brd) {
        rec = persist({
          ...rec,
          phase: "plan",
          approvedPhases: Array.from(
            new Set([...(rec.approvedPhases ?? []), "define" as PhaseId])
          ),
        });
        await runAgent(null, rec, true); // regenerate PRD from the revised BRD
      }
    },
    [busy, readOnly, persist, runAgent]
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
    if (!current || busy || readOnly) return;
    const reverted = undoProject(current);
    if (!reverted) return;
    const saved = persist(reverted);
    setErrorMessage(null);
    pushTerminal("↩ undo — ย้อนกลับ 1 ขั้น");
    if (hasRunnableApp(saved.files)) void boot(saved.files!);
  }, [boot, busy, persist, pushTerminal, readOnly]);

  /**
   * Pull the live container's source files into project.files so the Code panel
   * mirrors real container state (e.g. a package installed from the Shell). Only
   * once a real app exists — before that the ephemeral scaffold is the source.
   */
  const syncFromContainer = useCallback(async () => {
    const current = projectRef.current;
    // Skip while a generate/agent stream is in flight — it would overwrite the
    // freshly-streamed project.files with partial container state.
    if (abortRef.current) return;
    if (!current || !previewSupported || !hasRunnableApp(current.files)) return;
    try {
      const source = await readSource();
      if (Object.keys(source).length > 0) {
        persist({ ...current, files: { ...current.files, ...source } });
      }
    } catch {
      // Container not readable — keep the last known files.
    }
  }, [persist, previewSupported]);

  /** Monaco edits: persist (real-app files + docs) and hot-write into the container. */
  const handleFileEdit = useCallback(
    (path: string, contents: string) => {
      const current = projectRef.current;
      if (!current) return;
      // Editing a scaffold file before a real build must NOT persist into
      // project.files — that would add package.json and trip the build gate.
      const scaffoldOnly = !hasRunnableApp(current.files) && path in SCAFFOLD_FILES;
      if (!scaffoldOnly) {
        persist({ ...current, files: { ...(current.files ?? {}), [path]: contents } });
      }
      if (previewSupported) {
        void writeFile(path, contents).catch(() => {
          // Container not booted yet — persisted/scaffold copy is the source of truth.
        });
      }
    },
    [persist, previewSupported]
  );

  // File-tree CRUD: mutate project.files and mirror into the live container.
  // Each returns whether it actually changed project.files so CodePanel only
  // updates its tabs/active state on a real change (scaffold-only files pre-build
  // aren't in project.files, so these no-op and return false — no desync).
  const handleCreateFile = useCallback(
    (path: string): boolean => {
      const current = projectRef.current;
      if (!current || current.files?.[path] !== undefined) return false;
      persist({ ...current, files: { ...(current.files ?? {}), [path]: "" } });
      if (previewSupported) void writeFile(path, "").catch(() => {});
      return true;
    },
    [persist, previewSupported]
  );

  const handleRenameFile = useCallback(
    (oldPath: string, newPath: string): boolean => {
      const current = projectRef.current;
      const contents = current?.files?.[oldPath];
      if (!current?.files || contents === undefined || current.files[newPath] !== undefined) {
        return false;
      }
      const files = { ...current.files };
      delete files[oldPath];
      files[newPath] = contents;
      persist({ ...current, files });
      if (previewSupported) {
        void writeFile(newPath, contents).catch(() => {});
        void removeFile(oldPath).catch(() => {});
      }
      return true;
    },
    [persist, previewSupported]
  );

  const handleDeleteFile = useCallback(
    (path: string): boolean => {
      const current = projectRef.current;
      if (!current?.files || current.files[path] === undefined) return false;
      const files = { ...current.files };
      delete files[path];
      persist({ ...current, files });
      if (previewSupported) void removeFile(path).catch(() => {});
      return true;
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

  /** Rewrite package.json's extra deps and reinstall in the container. */
  const applyDeps = useCallback(
    (extra: Record<string, string>, note: string) => {
      const current = projectRef.current;
      if (!current?.files?.["package.json"] || busy) return;
      const files = { ...current.files, "package.json": packageJsonWithDeps(extra) };
      const saved = persist(withHistory(current, files));
      pushTerminal(note);
      void boot(saved.files!); // package.json changed → WebContainer reinstalls
    },
    [boot, busy, persist, pushTerminal]
  );

  const addPackage = useCallback(
    (name: string, version: string) => {
      const current = projectRef.current;
      if (!current?.files?.["package.json"]) return;
      const range = /^[\^~]/.test(version) ? version : `^${version}`;
      applyDeps(
        { ...extraDepsOf(current.files["package.json"]), [name]: range },
        `+ npm install ${name}@${range}`
      );
    },
    [applyDeps]
  );

  const removePackage = useCallback(
    (name: string) => {
      const current = projectRef.current;
      if (!current?.files?.["package.json"]) return;
      const extra = extraDepsOf(current.files["package.json"]);
      delete extra[name];
      applyDeps(extra, `- ลบ ${name}`);
    },
    [applyDeps]
  );

  // Load the project and consume any pending action from the landing page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await getProject(projectId);
      if (cancelled) return;
      if (!loaded) {
        setNotFound(true);
        return;
      }

      projectRef.current = loaded;
      setProject(loaded);

      // Determine role-based access (owner vs. member/viewer).
      const access = await getAccess(projectId);
      if (cancelled) return;
      setIsOwner(access?.access === "owner");
      setReadOnly(access?.role === "viewer");

      setPreviewSupported(isPreviewSupported());
      // Wipe a previous project's files from the shared workdir before booting
      // anything — the container is a module singleton that survives SPA
      // navigation between projects, so files would otherwise bleed across them.
      await prepareWorkdir(projectId);
      if (cancelled) return;
      // Boot the container while the user is still typing/answering so the
      // first build skips the boot wait.
      warmBoot();

      const pending = takePendingAction(projectId);
      if (pending) {
        if (pending.kind === "express") {
          // Brief is complete → auto-pilot the whole flow (BRD→PRD→build).
          // Suppress the domain picker; the skill was already chosen at launch.
          skillCheckedRef.current = projectId;
          void bootScaffold(); // warm the preview so the final build HMRs in
          void runExpressPipeline(pending.prompt, loaded);
        } else {
          setSpecOpen(true);
        }
      } else {
        if (hasRunnableApp(loaded.files)) {
          void boot(loaded.files!); // returning to an already-built app
        } else {
          // No real app yet → bring the live Vite scaffold up right away so
          // the WebContainer (code + preview) is "open" from the first question,
          // and its npm install warms the cache while the user is interviewed.
          void bootScaffold();
          // Conversational phase with no turns yet → the agent opens it.
          if (
            !isBuildPhase(loaded.phase) &&
            !loaded.messages.some((m) => m.phase === loaded.phase)
          ) {
            void runAgent(null, loaded);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Don't abort an in-flight generate/agent — let it finish in the background
      // (the registry keeps it visible site-wide and it persists on done). Mark
      // this instance detached so its loop stops writing to the shared container,
      // which is what the old abort guarded against on an SPA project switch.
      detachedRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // A generation is running in the BACKGROUND for this project when the registry
  // has it but THIS instance isn't the one streaming (it was started by a prior,
  // now-detached studio instance). Derive it from the registry (no effect needed).
  const projectGenerating = useSyncExternalStore(
    subscribeGenerations,
    () => isGenerating(projectId),
    () => false,
  );
  const bgActive = projectGenerating && !chatStreaming;

  // When that background turn finishes, pull the result into this view (no manual
  // refresh). setState lives in the async callback, not the effect body.
  const wasBgRef = useRef(false);
  useEffect(() => {
    if (wasBgRef.current && !projectGenerating) {
      void getProject(projectId).then((p) => {
        if (!p) return;
        projectRef.current = p;
        setProject(p);
        if (hasRunnableApp(p.files) && !detachedRef.current) void boot(p.files!);
      });
    }
    wasBgRef.current = bgActive;
  }, [projectGenerating, bgActive, projectId, boot]);

  // Load the project's workspace Org DNA so the chat can render source citations.
  useEffect(() => {
    const orgId = project?.orgId;
    let cancelled = false;
    void (async () => {
      const o = orgId ? await getOrg(orgId) : null;
      if (!cancelled) setOrgDna(o?.dna ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.orgId]);

  // Mirror chatStreaming into a ref so the realtime handler's closure reads the
  // live value (it subscribes once, keyed on projectId, not on every turn).
  // Also tells peers when we're running the AI, with a heartbeat so a long turn
  // keeps the "X กำลังให้ AI ทำงาน" indicator alive and it self-clears if we vanish.
  useEffect(() => {
    streamingRef.current = chatStreaming;
    const announce = (active: boolean) =>
      rtChannelRef.current?.send({
        type: "broadcast",
        event: "ai-working",
        payload: { from: clientIdRef.current, name: nameRef.current, active },
      });
    if (!chatStreaming) return;
    announce(true);
    const heartbeat = setInterval(() => announce(true), 20_000);
    return () => {
      clearInterval(heartbeat);
      announce(false);
    };
  }, [chatStreaming]);

  // Broadcast our own typing in the AI chat (throttled). Passed to ChatPanel.
  const broadcastAiTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastAiTypingSent.current < 1500) return;
    lastAiTypingSent.current = now;
    rtChannelRef.current?.send({
      type: "broadcast",
      event: "ai-typing",
      payload: { from: clientIdRef.current, name: nameRef.current },
    });
  }, []);

  // Realtime collaboration: when a collaborator's turn lands, they broadcast on
  // this project's channel; idle viewers pull the new messages + files in. Reload
  // is debounced and guarded so it never clobbers our own in-flight or unsaved
  // work. We deliberately don't reboot the preview here — a silent file refresh
  // beats yanking the running demo out from under whoever's looking at it.
  useEffect(() => {
    if (!clientIdRef.current) {
      clientIdRef.current =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `c-${Math.random().toString(36).slice(2)}`;
    }
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata ?? {};
      nameRef.current = (meta.full_name ?? meta.name ?? user?.email ?? "เพื่อนร่วมทีม") as string;
    });

    const timers = aiPeerTimers.current;
    const markPeer = (id: string, name: string, mode: "typing" | "working") => {
      const ex = timers.get(id);
      if (ex) clearTimeout(ex);
      setAiPeers((prev) => new Map(prev).set(id, { name, mode }));
      timers.set(
        id,
        setTimeout(
          () => {
            setAiPeers((prev) => {
              const m = new Map(prev);
              m.delete(id);
              return m;
            });
            timers.delete(id);
          },
          mode === "working" ? 45_000 : 3_000
        )
      );
    };
    const clearPeer = (id: string) => {
      const ex = timers.get(id);
      if (ex) clearTimeout(ex);
      timers.delete(id);
      setAiPeers((prev) => {
        const m = new Map(prev);
        m.delete(id);
        return m;
      });
    };

    const channel = supabase.channel(`rt:project:${projectId}`);
    rtChannelRef.current = channel;
    channel
      .on("broadcast", { event: "updated" }, ({ payload }) => {
        if (!payload || payload.from === clientIdRef.current) return; // our own
        if (rtReloadTimer.current) clearTimeout(rtReloadTimer.current);
        rtReloadTimer.current = setTimeout(() => {
          // Re-checked at fire time: state can change during the debounce.
          if (streamingRef.current || abortRef.current || saveTimer.current) return;
          void getProject(projectId).then((p) => {
            if (!p) return;
            projectRef.current = p;
            setProject(p);
          });
        }, 400);
      })
      .on("broadcast", { event: "ai-typing" }, ({ payload }) => {
        if (!payload || payload.from === clientIdRef.current) return;
        markPeer(payload.from, payload.name, "typing");
      })
      .on("broadcast", { event: "ai-working" }, ({ payload }) => {
        if (!payload || payload.from === clientIdRef.current) return;
        if (payload.active) markPeer(payload.from, payload.name, "working");
        else clearPeer(payload.from);
      })
      .subscribe();
    return () => {
      if (rtReloadTimer.current) clearTimeout(rtReloadTimer.current);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      void supabase.removeChannel(channel);
      rtChannelRef.current = null;
    };
  }, [projectId]);

  // Multi-party approval, sans real-time (Spec 2): refresh the approval tally on
  // phase change, on window focus, and — for shared projects — every 12s, so
  // members see each other's approvals. On focus, also reload the project if
  // another member advanced the phase (skipped while this session is working).
  useEffect(() => {
    if (!projectRef.current) return;
    void refreshApproval();
    const multi = (approval?.approvers.length ?? 0) > 1;
    const onFocus = () => {
      void refreshApproval();
      // Pull in another member's phase advance — but never clobber active work.
      if (abortRef.current || saveTimer.current) return;
      void getProject(projectId).then((loaded) => {
        const cur = projectRef.current;
        if (loaded && cur && loaded.phase !== cur.phase) {
          projectRef.current = loaded;
          setProject(loaded);
        }
      });
    };
    window.addEventListener("focus", onFocus);
    const timer = multi ? setInterval(() => void refreshApproval(), 12_000) : null;
    return () => {
      window.removeEventListener("focus", onFocus);
      if (timer) clearInterval(timer);
    };
  }, [project?.phase, approval?.approvers.length, projectId, refreshApproval]);

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
        <p className="font-display text-2xl font-semibold">ไม่พบโปรเจกต์ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
        <Link
          href="/"
          className="rounded-sm bg-shine px-5 py-2 font-display font-medium text-night transition hover:bg-shine-soft"
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
  // Rework is available once an app exists alongside its BRD/PRD: the user can go
  // back, edit the docs, then regenerate the app from them.
  const reworkDocs = docsFromFiles(project.files);
  const canRework = !readOnly && hasApp && Boolean(reworkDocs.brd && reworkDocs.prd);
  // Doc-preview modal: resolve the clicked phase's doc + revise handler.
  const previewDocs = previewPhase
    ? (DOC_KINDS_BY_PHASE[previewPhase] ?? []).flatMap((kind) => {
        const content = reworkDocs[kind];
        return content
          ? [{ kind, label: kind.toUpperCase(), path: DOC_PATHS[kind], content }]
          : [];
      })
    : [];
  // Multi-party approval summary for the stepper (null = solo project).
  const approvalSummary =
    approval && approval.approvers.length > 1
      ? {
          approved: approval.approvers.filter((a) => approval.approved.includes(a)).length,
          total: approval.approvers.length,
          mine: approval.approved.includes(approval.me),
        }
      : null;

  // Open the running demo in its own tab. The raw WebContainer preview URL only
  // works inside the tab that booted it (opening it standalone shows StackBlitz's
  // "Connect to Project" screen), so we open the portable /share link instead —
  // it re-boots a fresh container in the new tab. Open the blank tab first, then
  // redirect after the async encode, so the popup blocker treats it as a gesture.
  const handlePopOut = async () => {
    if (!project.files) return;
    const tab = window.open("", "_blank");
    if (!tab) return;
    const shareUrl = await encodeShareUrl({ name: project.name, files: project.files });
    tab.location.href = shareUrl;
  };
  // Input/advance are gated by the worker that owns the current phase: build →
  // the WebContainer; conversational → the chat agent (so a background scaffold
  // install never disables the interview or the approve button).
  // readOnly viewers see all controls disabled.
  const phaseBusy = readOnly || (inBuild ? wcBusy || chatStreaming : chatStreaming);
  const streamingNow = chatStreaming;
  // Code tab: show the real app once built; before that, show the live scaffold
  // (what's actually running in the container) merged with any phase docs.
  const displayFiles =
    hasApp || !previewSupported
      ? project.files
      : { ...SCAFFOLD_FILES, ...(project.files ?? {}) };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-night text-chalk">
      <LiveCursors projectId={projectId} />
      {bgActive && (
        <div className="pointer-events-none fixed left-1/2 top-3 z-[60] -translate-x-1/2">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-chalk shadow-lg">
            <span className="loader-dot h-1.5 w-1.5 rounded-full bg-shine" />
            กำลังสร้างเบื้องหลัง… จะอัปเดตให้เมื่อเสร็จ
          </span>
        </div>
      )}
      <TopBar
        project={project}
        view={view}
        busy={busy}
        readOnly={readOnly}
        saveState={saveState}
        canUndo={!readOnly && project.history.length > 0}
        shippable={hasApp}
        onRename={(name) => { if (!readOnly) persist({ ...project, name: name.trim() || "Untitled" }); }}
        onViewChange={(next) => {
          setView(next);
          if (next === "code") void syncFromContainer(); // reflect Shell-side changes
        }}
        onUndo={handleUndo}
        onOpenSpec={() => { if (!readOnly) setSpecOpen(true); }}
        onOpenPackages={() => {
          if (!readOnly) {
            void syncFromContainer();
            setPackagesOpen(true);
          }
        }}
        onTeamShare={isOwner ? () => setShareOpen(true) : undefined}
      />

      <PhaseStepper
        phase={project.phase}
        busy={phaseBusy}
        canAdvance={!readOnly && gateSatisfied(project)}
        canRework={canRework}
        approval={approvalSummary}
        onAdvance={readOnly ? () => {} : () => void handleApprove()}
        onPreview={previewPhaseDoc}
        onRework={rebuildFromDocs}
      />

      <div className="flex min-h-0 flex-1">
        <div style={{ width: leftWidth }} className="flex shrink-0 flex-col border-r border-night-edge">
          {skillPickerOpen && !readOnly && (
            <div className="border-b border-night-edge p-3">
              <SkillPicker
                detectedId={detectedSkillId}
                busy={detectingSkill}
                onSelect={(skillId) => {
                  const cur = projectRef.current;
                  if (cur) persist({ ...cur, skillId });
                  setSkillPickerOpen(false);
                }}
                onSkip={() => setSkillPickerOpen(false)}
              />
            </div>
          )}
          <ChatPanel
            messages={project.messages}
            busy={phaseBusy}
            streaming={streamingNow}
            workflowPhase={project.phase}
            agentName={phaseDef(project.phase).name}
            live={live}
            hasApp={hasApp}
            attachments={attachedPaths}
            onRemoveAttachment={removeAttachment}
            onSubmit={(text, media) => {
              const note = attachedPaths.length
                ? `\n\n📎 อ้างอิงไฟล์: ${attachedPaths.join(", ")}`
                : "";
              // Record what was attached in the transcript so it's visible later.
              const mediaNote = media.length
                ? `\n\n🖼️ แนบ: ${media.map((m) => m.name).join(", ")}`
                : "";
              const full = `${text}${note}${mediaNote}`;
              setAttachedPaths([]);
              if (inBuild) handleBuildSubmit(full, media);
              else void runAgent(full, undefined, undefined, media);
            }}
            onCancel={cancel}
            onViewDoc={previewPhaseDoc}
            readOnly={readOnly}
            peers={[...aiPeers.values()]}
            onTyping={broadcastAiTyping}
            orgDna={orgDna}
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
          <div className="flex min-h-0 flex-1 flex-col">
            {view === "preview" && designBusy ? (
              <div className="bg-grid flex min-h-0 flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/cat_playing_animation.svg" alt="" className="loader-float w-44 opacity-90" draggable={false} />
                  <p className="font-display text-[15px] text-chalk">กำลังออกแบบดีไซน์ให้เลือก…</p>
                  <div className="flex items-center gap-1.5">
                    <span className="loader-dot h-1.5 w-1.5 rounded-full bg-shine" style={{ animationDelay: "0ms" }} />
                    <span className="loader-dot h-1.5 w-1.5 rounded-full bg-shine" style={{ animationDelay: "150ms" }} />
                    <span className="loader-dot h-1.5 w-1.5 rounded-full bg-shine" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            ) : view === "preview" && designOptions ? (
              <DesignPicker
                options={designOptions}
                onSelect={(option) => resolveDesign(option)}
                onSkip={() => resolveDesign(null)}
              />
            ) : view === "preview" ? (
              <PreviewPanel
                url={previewUrl}
                previewKey={previewKey}
                phase={phase}
                supported={previewSupported}
                onRefresh={() => setPreviewKey((k) => k + 1)}
                onPopOut={handlePopOut}
              />
            ) : (
              <CodePanel
                files={displayFiles}
                onEdit={readOnly ? () => {} : handleFileEdit}
                onCreateFile={readOnly ? () => false : handleCreateFile}
                onRenameFile={readOnly ? () => false : handleRenameFile}
                onDeleteFile={readOnly ? () => false : handleDeleteFile}
                onAttachToChat={attachFile}
              />
            )}
          </div>

          {/* Terminal/status docked under the preview, not under the chat. */}
          <StatusBar
            phase={phase}
            errorMessage={errorMessage}
            terminal={terminal}
            onRetry={retry}
            onFixWithAi={fixWithAi}
            canFix={hasApp}
          />
        </div>
      </div>

      {specOpen && (
        <SpecFlow onClose={() => setSpecOpen(false)} onComplete={handleSpecComplete} />
      )}

      {packagesOpen && (
        <PackageSearch
          installed={extraDepsOf(project.files?.["package.json"])}
          busy={busy}
          onAdd={addPackage}
          onRemove={removePackage}
          onClose={() => setPackagesOpen(false)}
        />
      )}

      {shareOpen && (
        <ShareModal
          projectId={project.id}
          projectName={project.name}
          onClose={() => setShareOpen(false)}
        />
      )}

      {previewPhase && (
        <DocPreviewModal
          title={`${phaseDef(previewPhase).user} — ${phaseDef(previewPhase).name}`}
          docs={previewDocs}
          hint={
            previewPhase === "define"
              ? "คอมเมนต์จะส่งเข้าแชท แล้ว AI จะ gen BRD ใหม่ และ gen PRD ตามให้อัตโนมัติ"
              : undefined
          }
          busy={busy || readOnly}
          onRevise={(comment) => reviseDoc(previewPhase, comment)}
          onClose={() => setPreviewPhase(null)}
        />
      )}

    </div>
  );
}

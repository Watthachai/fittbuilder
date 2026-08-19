"use client";

import Link from "next/link";
import {
  activeVersionOf,
  parkedVersions,
  switchVersion,
  VERSION_LABEL,
  type VersionKey,
} from "@/lib/versions";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DOC_PATHS, docOnlyFiles, docsFromFiles, hasRunnableApp } from "@/lib/define";
import { REORGANIZE_PROMPT } from "@/lib/code-health";
import { commitRevision, revisionFiles } from "@/lib/revisions";
import { buildPremiumContext, premiumOptionsFor } from "@/lib/skills/premium";
import { getSkill } from "@/lib/skills/registry";
import { screenIndexEntries } from "@/lib/screen-index";
import PremiumPicker from "@/components/studio/PremiumPicker";
import DraftRecovery from "@/components/studio/DraftRecovery";
import type { PremiumOption } from "@/lib/skills/types";
import { buildMissingFilesPrompt, missingImports } from "@/lib/import-check";
import { buildScreenIndexPrompt } from "@/lib/screen-index";
import { listShots, uploadShot } from "@/lib/shots";
import { buildWandPrompt, parseLoc, type WandTarget } from "@/lib/wand";
import { patchClassName, patchText } from "@/lib/wand-patch";
import { computeChanges, deriveProductName, sanitizeFiles } from "@/lib/files";
import { isBuildPhase, nextPhase, phaseDef, type PhaseId } from "@/lib/phases";
import { type DesignOption, designStyleDirective, fetchDesignOptions } from "@/lib/design";
import {
  extraDepsOf,
  packageJsonWithDeps,
  SCAFFOLD_FILES,
  VITE_CONFIG,
  withRequiredScaffold,
} from "@/lib/scaffold";
import { takePendingAction, takePendingAttachments } from "@/lib/pending-action";
import { encodeShareUrl } from "@/lib/share";
import { streamAgent, streamGenerate } from "@/lib/sse";
import {
  appendMessage,
  approvePhase,
  type ApprovalState,
  getAccess,
  getApprovalState,
  getProject,
  getProjectPhase,
  newMessage,
  saveProject,
  setProjectOrg,
  setProjectRunner,
  clearDraft,
  loadDraft,
  isDraftLive,
  DRAFT_STALE_MS,
  type GenerationDraft,
  undo as undoProject,
  withHistory,
} from "@/lib/storage";
import type {
  AgentTurn,
  ChatAttachmentInput,
  DocKind,
  GenerationPhase,
  LiveMessage,
  OrgRecord,
  ProjectFiles,
  ProjectRecord,
  RunnerSend,
  SpecAnswers,
} from "@/lib/types";
import { FITTCORE_TAG, type GatewayIngestResult } from "@/lib/fittcore";
import { captureDnaFromText, type DnaCapture } from "@/lib/dna-capture";
import { appendDnaBlock } from "@/lib/org-dna";
import { getOrg, updateOrgDna } from "@/lib/orgs";
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
import { currentUser } from "@/lib/current-user";
import { emitSystemLog } from "@/lib/team-chat-bus";
import { toast } from "@/lib/toast";
import { confirm } from "@/lib/confirm";
import ChatPanel from "./ChatPanel";
import LiveCursors from "./LiveCursors";
import CodePanel from "./CodePanel";
import DesignPicker from "./DesignPicker";
import DocPreviewModal from "./DocPreviewModal";
import PackageSearch from "./PackageSearch";
import ApprovalModal from "./ApprovalModal";
import OrgDnaPanel from "./OrgDnaPanel";
import PhaseStepper from "./PhaseStepper";
import PreviewPanel from "./PreviewPanel";
import ShareModal from "./ShareModal";
import SkillPicker from "./SkillPicker";
import WandComposer from "./WandComposer";
import HistoryPanel from "./HistoryPanel";
import ScreenInventory from "./ScreenInventory";
import SpecFlow, { type SpecResult } from "./SpecFlow";
import StatusBar from "./StatusBar";
import TopBar from "./TopBar";

const MAX_TERMINAL_LINES = 400;
// Cap the reasoning text persisted per assistant message — it's a collapsed
// nicety, but uncapped it bloats every autosave payload and the DB row for the
// life of the project (long sessions were reaching multi-MB records).
const THINKING_STORE_LIMIT = 20_000;


export interface SpecPayload {
  brd?: string;
  prd?: string;
  presetId?: string;
  presetAnswers?: SpecAnswers;
}

type LastAction =
  | { kind: "generate"; prompt: string; spec?: SpecPayload }
  | { kind: "agent"; text: string | null };

/** Names assigned automatically at project creation (see createProject callers in
 *  LaunchPad): a placeholder, the spec/define labels, or the raw prompt prefix.
 *  These may be replaced by the generated product name; a user-chosen name is not. */
const AUTO_NAMES = new Set(["", "Untitled", "Spec-to-Demo", "Define Session"]);
function isAutoName(name: string): boolean {
  return AUTO_NAMES.has(name.trim());
}

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

/**
 * Pictures the user attached, as storage keys — so the transcript can show the
 * picture instead of the words "แนบ: image.png". Only images: a CSV thumbnail
 * would be noise, and its contents already reached the model.
 */
function mediaOf(attachments?: ChatAttachmentInput[]): { path: string; name: string }[] | undefined {
  const pics = (attachments ?? [])
    .filter((a) => a.path && a.mimeType.startsWith("image/"))
    .map((a) => ({ path: a.path!, name: a.name }));
  return pics.length ? pics : undefined;
}

export default function Studio({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [view, setView] = useState<"preview" | "code" | "history">("preview");
  // Bumped whenever a checkpoint lands, so an open History tab refetches.
  const [revisionTick, setRevisionTick] = useState(0);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [myName, setMyName] = useState("");
  const [screensOpen, setScreensOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recCount, setRecCount] = useState(0);
  const [recLast, setRecLast] = useState<string | null>(null);
  const recIndex = useRef(0);

  /**
   * Receive captures WHILE RECORDING.
   *
   * This has to live here, not in the inventory panel: recording closes that
   * panel so the preview is reachable, which unmounted the only listener and
   * dropped every screenshot the demo posted. The studio outlives the panel.
   */
  useEffect(() => {
    if (!recording) return;
    let alive = true;
    void listShots(projectId).then((existing) => {
      if (alive) recIndex.current = existing.length ? Math.max(...existing.map((s2) => s2.index)) + 1 : 0;
    });
    const onMessage = (e: MessageEvent) => {
      const d = e.data as
        | { __fittShot?: boolean; name?: string; parent?: string | null; from?: string | null; via?: string | null; dataUrl?: string }
        | null;
      if (!d?.__fittShot || !d.dataUrl) return;
      const name = d.name ?? "หน้าจอ";
      void uploadShot(projectId, {
        name,
        parent: d.parent ?? null,
        from: d.from ?? null,
        via: d.via ?? null,
        index: recIndex.current++,
        dataUrl: d.dataUrl,
      })
        .then(() => {
          if (!alive) return;
          setRecCount((c) => c + 1);
          setRecLast(name);
        })
        .catch((err) =>
          toast.error("เก็บรูปไม่สำเร็จ", {
            description: err instanceof Error ? err.message : undefined,
          })
        );
    };
    window.addEventListener("message", onMessage);
    return () => {
      alive = false;
      window.removeEventListener("message", onMessage);
    };
  }, [recording, projectId]);
  // Channel into the preview iframe, handed over by PreviewPanel (it owns the ref).
  const previewBridge = useRef<((msg: Record<string, unknown>) => void) | null>(null);
  const toPreview = useCallback((msg: Record<string, unknown>) => {
    previewBridge.current?.(msg);
  }, []);
  const takeBridge = useCallback((send: (msg: Record<string, unknown>) => void) => {
    previewBridge.current = send;
  }, []);
  const [wandOn, setWandOn] = useState(false);
  const [wandBusy, setWandBusy] = useState(false);
  const [wandTarget, setWandTarget] = useState<{
    target: WandTarget;
    anchor: { x: number; y: number; w: number; h: number };
  } | null>(null);
  // Counters, not booleans: each bump is one message to the iframe (clear the
  // selection / re-measure after a patch changed the element's size).
  const [wandNudge, setWandNudge] = useState({ clear: 0, repaint: 0 });
  const [previewPhase, setPreviewPhase] = useState<PhaseId | null>(null);
  const [approval, setApproval] = useState<ApprovalState | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
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
  const [switchingVersion, setSwitchingVersion] = useState(false);
  /** Offered right after a Premium version is seeded — see PremiumPicker. */
  const [premiumOffer, setPremiumOffer] = useState<PremiumOption[]>([]);
  /** An interrupted generation's output, waiting to be taken or thrown away. */
  const [draft, setDraft] = useState<GenerationDraft | null>(null);
  /**
   * A turn running somewhere else — another tab, another machine, or this same
   * project reopened while the server is still working.
   *
   * The in-memory registry cannot see those (it lives on globalThis, so it knows
   * only about turns THIS page started), which left a studio that said "busy"
   * and then showed nothing at all happening. The draft's heartbeat can see
   * them, so this polls it while one is alive and reports how far it has got.
   */
  const [remoteProgress, setRemoteProgress] = useState<number | null>(null);
  /**
   * Which tier version is being edited.
   *
   * Its own state, NOT derived from `project` — the record travels through
   * autosave paths that rebuild it from older copies, and a stale one would flip
   * the studio to the other version mid-edit. Read from the DB on load, moved
   * only by changeVersion.
   */
  const [activeVersion, setActiveVersion] = useState<VersionKey>("standard");
  const [isOwner, setIsOwner] = useState(false);
  const [org, setOrg] = useState<OrgRecord | null>(null);
  // Living Org DNA: a pending capture the AI noticed in the last message (one at a
  // time — a newer capture replaces it), and whether the confirm→write is in flight.
  const [dnaCapture, setDnaCapture] = useState<DnaCapture | null>(null);
  const [dnaSaving, setDnaSaving] = useState(false);
  const [dnaOpen, setDnaOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [detectedSkillId, setDetectedSkillId] = useState<string | null>(null);
  const [detectingSkill, setDetectingSkill] = useState(false);
  // First runtime error reported from inside the demo iframe (error bridge in
  // vite.config's transformIndexHtml). Kept until the next generation/reload —
  // the first error is the root cause, later ones are usually cascades.
  const [previewRuntimeError, setPreviewRuntimeError] = useState<{
    message: string;
    stack: string;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Generation "epoch", bumped on every unmount / project switch (the [projectId]
  // effect cleanup below). A generate/agent loop snapshots the epoch when it
  // starts and re-compares at each WebContainer checkpoint: if it changed, this
  // loop is detached (the user navigated away) and must stop touching the shared
  // container — a detached generation keeps streaming + persisting to storage so
  // it finishes in the background, it just can't write to a container that now
  // belongs to whatever the user navigated to.
  //
  // Why an epoch and not a boolean: React StrictMode runs effects setup→cleanup
  // →setup on mount in dev, so a boolean set true in cleanup would latch true on
  // the very first mount and silently block EVERY live preview update for the
  // whole session. Bumping a counter instead just advances the epoch harmlessly;
  // loops started afterwards snapshot the new value and stay attached.
  const epochRef = useRef(0);
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
  const avatarRef = useRef<string | null>(null);
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
      // The detect-skill fetch may still be in flight; its `finally` reset is
      // guarded by `cancelled`, so if a project change interrupts detection
      // (common with long prompts), detectingSkill would latch `true` forever —
      // freezing the picker on the spinner branch, which has no "ข้าม" button.
      setDetectingSkill(false);
    };
  }, [project, readOnly]);

  // Error bridge receiver: the demo iframe posts runtime errors (broken
  /**
   * A file dropped outside a drop zone must do nothing.
   *
   * The browser's default is to NAVIGATE to the dropped file, which replaces
   * the studio with an image and takes the in-flight turn with it. Both events
   * have to be prevented: without dragover, no drop event fires at all and the
   * browser handles it itself. The composers' own handlers run first (React
   * listens at the root, below window), so their drops still work.
   */
  useEffect(() => {
    const swallow = (e: DragEvent) => {
      if (!Array.from(e.dataTransfer?.types ?? []).includes("Files")) return;
      e.preventDefault();
    };
    window.addEventListener("dragover", swallow);
    window.addEventListener("drop", swallow);
    return () => {
      window.removeEventListener("dragover", swallow);
      window.removeEventListener("drop", swallow);
    };
  }, []);

  // imports, React crashes) that are otherwise invisible outside its console.
  // Keep the FIRST report (root cause); suppress while a stream is applying
  // files (mid-stream module graphs are legitimately inconsistent) — the
  // post-generation iframe reload re-reports anything that truly persists.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data as {
        __fittPreviewError?: boolean;
        message?: string;
        stack?: string;
      } | null;
      if (!d || d.__fittPreviewError !== true) return;
      if (streamingRef.current) return;
      setPreviewRuntimeError((prev) => prev ?? { message: d.message ?? "", stack: d.stack ?? "" });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
      saveTimer.current = null; // fired → no longer pending (so unmount won't re-save)
      saveProject(local)
        .then(() => {
          setSaveState("saved");
          // Tell collaborators a new turn landed so their idle views pull it in.
          // The version rides along: a project row carries files + 10 history
          // snapshots + every turn's diffs (5 MB on a real one), so the receiver
          // must be able to decide whether a download is warranted WITHOUT
          // doing the download. Without this, two people editing bounced full
          // rows off each other until Postgres stopped answering.
          rtChannelRef.current?.send({
            type: "broadcast",
            event: "updated",
            payload: {
              from: clientIdRef.current,
              name: nameRef.current,
              updatedAt: local.updatedAt,
            },
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
        // Fresh server + fresh document — a still-broken app re-reports itself.
        setPreviewRuntimeError(null);
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
      // withRequiredScaffold fills plumbing the model never writes (index.html
      // above all) — without it a build that emitted package.json but no
      // index.html booted a dev server with nothing to serve at "/".
      await runProject(
        { ...sanitizeFiles(withRequiredScaffold(files)), "vite.config.js": VITE_CONFIG },
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
      const myEpoch = epochRef.current;
      lastActionRef.current = { kind: "agent", text: userText };

      let working = current;
      if (userText) {
        working = persist(
          appendMessage(working, {
            ...newMessage("user", userText, working.phase),
            media: mediaOf(attachments),
            author: { name: nameRef.current, avatar: avatarRef.current },
          })
        );
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
        if (snap?.thinking.trim())
          assistantMsg.thinking = snap.thinking.trim().slice(0, THINKING_STORE_LIMIT);
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
        if (myEpoch !== epochRef.current && projectRef.current) {
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
      /**
       * One turn at a time — the precondition every entry point funnels through.
       *
       * Two overlapping runs each hold their own `working` snapshot of the
       * project, taken before the other started. Whichever finishes LAST wins,
       * and it persists a message list and a file set that never saw the other:
       * the second wand's chat message vanished, the first edit was reverted,
       * and the first run's `finally` cleared chatStreaming and abortRef while
       * the second was still streaming — so the studio looked idle and the live
       * turn could no longer be cancelled. Exactly the reported "แชทหายไปแล้ว
       * ไม่ทำงานอะไรเลย".
       *
       * Not a queue: an iteration prompt is built from the CURRENT files, and a
       * wand cast additionally carries a file:line that the running turn can
       * invalidate. A queued cast would edit the wrong line and say nothing.
       */
      if (abortRef.current) {
        toast.info("กำลังแก้ไขอยู่ครับ", {
          description: "รอรอบนี้เสร็จก่อน หรือกด “หยุด” เพื่อยกเลิกรอบที่กำลังทำอยู่",
        });
        return;
      }

      lastActionRef.current = { kind: "generate", prompt, spec };
      const runnable = hasRunnableApp(current.files);
      const isIteration = runnable && !spec;

      let working = appendMessage(current, {
        ...newMessage("user", prompt, current.phase),
        media: mediaOf(attachments),
        author: { name: nameRef.current, avatar: avatarRef.current },
      });
      // Snapshot the pre-generation files into history NOW (not only at the end)
      // so a turn interrupted by navigating away is still undoable — paired with
      // the abort-path save below, partial work survives leaving the studio.
      working = persist(withHistory(working, current.files ?? {}));
      beginGeneration(projectId, current.name);

      // liveContainer = a dev server is already running (scaffold/app), so we can
      // write each file into it as it streams and let Vite HMR show the build.
      const liveContainer = previewSupported && Boolean(previewUrl);
      const myEpoch = epochRef.current;

      setErrorMessage(null);
      setPreviewRuntimeError(null);
      setChatStreaming(true);
      setLiveBoth({ thinking: "", content: "", actions: [] });
      if (!liveContainer) setPhase("generating"); // no server yet → overlay until we boot
      setView("preview");
      pushTerminal(`▸ ${isIteration ? "iteration" : "generate"}: ${prompt.slice(0, 80)}`);

      // Phase docs (+ the existing app on iteration) ride along; streamed files
      // are layered on top so the result lands in zip/share too.
      const streamed: ProjectFiles = isIteration
        ? { ...(current.files ?? {}) }
        : { ...docOnlyFiles(current.files) };

      const controller = new AbortController();
      abortRef.current = controller;
      // Did this turn stream any write/delete into the live container? Decides
      // whether a cancel must reboot the container back to the saved state.
      let wroteLive = false;
      /**
       * The DRAFT is written by the SERVER now, not here (/api/generate parks
       * what it produces as it goes). One writer, and the right one: the server
       * keeps generating after this tab is gone, so it is the only party that
       * still knows what the finished turn contains.
       *
       * What is left here is the clear — the browser is the only party that can
       * say "I have saved the real files, the parked copy is no longer needed".
       * The server awaits its final park before sending `done`, so by the time
       * this runs the complete set is already on disk and clearing is safe.
       */

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
            streamed[event.path] = event.content;
            pushTerminal(`📝 ${event.path}`);
            appendLive((p) => ({ ...p, actions: [...p.actions, { icon: "file", label: event.path }] }));
            if (liveContainer && myEpoch === epochRef.current) {
              wroteLive = true;
              void writeFile(event.path, event.content).catch(() => {});
            }
          } else if (event.type === "delete") {
            delete streamed[event.path];
            if (liveContainer && myEpoch === epochRef.current) {
              wroteLive = true;
              void removeFile(event.path).catch(() => {});
            }
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
        for (const path of deleted) delete streamed[path];
        // Mirror done-event deletes into the live container too — otherwise
        // ghost files linger there and the Code-panel container sync
        // (readSource merge) resurrects files the model intentionally removed.
        if (liveContainer && myEpoch === epochRef.current)
          for (const path of deleted) void removeFile(path).catch(() => {});

        // Store the plumbing as well as run it: the Code panel, the zip export
        // and the next boot all read project.files, and a set without
        // index.html is a broken project everywhere, not only in the preview.
        const files = withRequiredScaffold(streamed);
        const changes = computeChanges(current.files, files);
        // History was already snapshotted at the start of the turn, so just set
        // the final files here (don't push a second history entry).
        working = { ...working, files };
        // On the FIRST build (no app existed yet), title the project with the
        // generated product name (from the demo's <title>, e.g. "ExpenseFlow")
        // instead of the raw prompt — but never rename an already-titled project.
        if (!runnable && isAutoName(current.name)) {
          const productName = deriveProductName(files);
          if (productName) working = { ...working, name: productName };
        }
        const assistantMsg = newMessage("assistant", note || "สร้างเรียบร้อยแล้ว", current.phase);
        const snap = liveRef.current;
        if (snap?.thinking.trim())
          assistantMsg.thinking = snap.thinking.trim().slice(0, THINKING_STORE_LIMIT);
        if (snap?.actions.length) assistantMsg.actions = snap.actions;
        if (changes.length) assistantMsg.changes = changes;
        // Checkpoint the result so the chat bubble can offer a rollback. Fire
        // and forget: a failed checkpoint must never cost the user the build.
        if (changes.length) {
          const label = prompt.trim().slice(0, 80);
          void commitRevision({ projectId, files, label, kind: "ai" }).then((sha) => {
            setRevisionTick((t) => t + 1);
            if (!sha) return;
            const withSha = projectRef.current;
            if (!withSha) return;
            persist({
              ...withSha,
              messages: withSha.messages.map((m) =>
                m.id === assistantMsg.id ? { ...m, revision: { sha, label } } : m
              ),
            });
          });
        }
        working = appendMessage(working, assistantMsg);
        persist(working);
        // The complete set is saved — the partial has nothing left to protect.
        void clearDraft(projectId).catch(() => {});

        // Detached (user navigated away): files are already persisted above —
        // skip all container work, it belongs to the foreground project now.
        if (myEpoch === epochRef.current) {
          if (depsAdded) {
            // package.json changed (new npm packages) → re-mount + reinstall so
            // the generated code that imports them actually runs.
            await boot(files);
          } else if (liveContainer) {
            setPhase("ready"); // files already streamed into the running server (HMR)
            // Reload the iframe so the finished app re-evaluates from a clean
            // document — error reports were suppressed mid-stream, so this
            // reload is what re-reports any error that truly persists.
            setPreviewRuntimeError(null);
            setPreviewKey((k) => k + 1);
          } else {
            await boot(files); // first run with no server → boot it now
          }
        }
      } catch (error) {
        if (controller.signal.aborted) {
          // Cancelled mid-stream: keep the PRE-generation files as the saved
          // truth — a half-streamed file set must never become project.files
          // (hasRunnableApp only checks package.json, so a partial set would
          // boot to a permanent white screen; the pre-gen snapshot is already
          // in history for undo).
          void saveProject({ ...working, updatedAt: new Date().toISOString() }).catch(() => {});
          // Cancelling is a decision, not a crash: the user does not want this
          // half-turn offered back to them next time they open the project.
          void clearDraft(projectId).catch(() => {});
          pushTerminal("✋ ยกเลิกแล้ว");
          if (wroteLive && myEpoch === epochRef.current) {
            // Partial files were streamed into the live container — reboot it
            // back to the saved state (scaffold when no app existed yet).
            if (runnable) void boot(current.files!);
            else void bootScaffold();
          } else {
            setPhase(runnable || liveContainer ? "ready" : "idle");
          }
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
        if (myEpoch !== epochRef.current && projectRef.current) {
          await saveProject(projectRef.current).catch(() => {});
        }
        endGeneration(projectId);
        setChatStreaming(false);
        setLiveBoth(null);
        abortRef.current = null;
      }
    },
    [appendLive, boot, bootScaffold, persist, previewSupported, previewUrl, pushTerminal, setLiveBoth, projectId]
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
    (base?: ProjectRecord, attachments?: ChatAttachmentInput[]) => {
      const proj = base ?? projectRef.current;
      const docs = docsFromFiles(proj?.files ?? null);
      // Attachments (e.g. a LaunchPad-uploaded Excel→CSV) ride into the build
      // turn itself, so the demo uses the REAL columns/sample rows — not just
      // whatever the BRD summarized.
      const dataHint = attachments?.length
        ? " ผู้ใช้แนบไฟล์ข้อมูลจริงมาด้วย — ใช้โครงสร้างคอลัมน์จริงทั้งหมดและข้อมูลตัวอย่างจริงจากไฟล์ในตาราง/กราฟของ demo"
        : "";
      void generate(
        `สร้าง web demo ตามเอกสาร BRD/PRD ที่แนบมา ให้ครบทุกหน้าจอและตรง design direction ที่ระบุ${dataHint}`,
        { brd: docs.brd?.slice(0, 50_000), prd: docs.prd?.slice(0, 50_000) },
        proj ?? undefined,
        attachments
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
    async (prompt: string, base: ProjectRecord, attachments?: ChatAttachmentInput[]) => {
      pushTerminal("⚡ Express: สร้าง BRD จาก brief…");
      // Attachments (LaunchPad uploads) inform the BRD interview turn — the
      // build then works from the BRD/PRD as usual.
      let rec = await runAgent(prompt, { ...base, phase: "define" }, true, attachments);
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
      buildFromDocs(rec, attachments);
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
  const requestApprove = useCallback(async () => {
    const current = projectRef.current;
    if (!current || readOnly || !gateSatisfied(current)) return;
    // Always open the confirm modal — even solo — so the user sees the approval
    // roster before advancing. confirmApproval handles solo vs shared.
    const state = approval ?? (await getApprovalState(projectId, current.phase));
    setApproval(state);
    setApproveOpen(true);
  }, [approval, projectId, readOnly]);

  /** Confirm from the modal. Solo → advance straight away; shared → record THIS
   *  user's approval and advance once every member has approved. */
  const confirmApproval = useCallback(async () => {
    const current = projectRef.current;
    if (!current || readOnly || !gateSatisfied(current)) return;
    const state = approval ?? (await getApprovalState(projectId, current.phase));
    // Announce the approval in the team chat — parity for solo + shared, so the
    // activity ("who approved") is visible to everyone in the room.
    const user = await currentUser();
    const who = user?.name ?? user?.email ?? "สมาชิก";
    emitSystemLog(projectId, `✅ ${who} อนุมัติขั้น “${phaseDef(current.phase).user}” แล้ว`);
    // Solo (only the owner approves) → no multi-party gate; just advance.
    if (state.approvers.length <= 1) {
      setApproveOpen(false);
      advancePhase();
      return;
    }
    await approvePhase(projectId, current.phase);
    const fresh = await getApprovalState(projectId, current.phase);
    setApproval(fresh);
    setApproveOpen(false);
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
   * Preview a phase's document in a modal (Build has no doc → peek at the running
   * app). Used by the chat's "ดูเอกสาร" and as the "just look" branch of a step click.
   */
  const previewPhaseDoc = useCallback((target: PhaseId) => {
    if (isBuildPhase(target)) {
      if (hasRunnableApp(projectRef.current?.files ?? null)) setView("preview");
      return;
    }
    setPreviewPhase(target);
  }, []);

  /**
   * Click a completed step in the stepper: offer to either jump BACK to that
   * phase (to rework it — nothing downstream is deleted) or just peek at its doc.
   * This is the escape hatch when a later phase is stuck. The active phase and
   * read-only viewers only ever preview.
   */
  const handleStepClick = useCallback(
    async (target: PhaseId) => {
      const current = projectRef.current;
      if (!current) return;
      if (target === current.phase || readOnly) {
        previewPhaseDoc(target);
        return;
      }
      const back = await confirm({
        title: `เฟส ${phaseDef(target).user}`,
        message:
          "ย้อนกลับมาที่เฟสนี้เพื่อแก้ไขไหม? เอกสาร/โค้ดของเฟสถัดไปยังอยู่ครบ — เลือก “แค่ดูเอกสาร” ถ้าอยากดูเฉยๆ",
        confirmLabel: "ย้อนกลับมาเฟสนี้",
        cancelLabel: "แค่ดูเอกสาร",
      });
      if (!back) {
        previewPhaseDoc(target);
        return;
      }
      persist({ ...current, phase: target });
      setApproval(null);
      setPreviewPhase(null);
      pushTerminal(`↩ ย้อนกลับไปเฟส ${phaseDef(target).user}`);
    },
    [readOnly, previewPhaseDoc, persist, pushTerminal]
  );

  /**
   * Force the current review phase's agent to (re)emit its report doc — the
   * escape hatch for Verify/Review when the auto-run didn't produce docs/*.md so
   * the approve gate stays shut. Express = one shot, no back-and-forth.
   */
  const generatePhaseDoc = useCallback(() => {
    const current = projectRef.current;
    if (!current || readOnly || chatStreaming) return;
    void runAgent(null, current, true);
  }, [readOnly, chatStreaming, runAgent]);

  /** A hand-off to the Code Runner succeeded — persist it (durable "sent" chip)
   *  and reflect it in the live project state so the TopBar chip shows at once. */
  const handleRunnerSent = useCallback(
    (result: GatewayIngestResult) => {
      const current = projectRef.current;
      if (!current) return;
      const runner: RunnerSend = {
        jobId: result.jobId,
        state: result.state,
        duplicate: result.duplicate,
        tag: FITTCORE_TAG,
        sentAt: new Date().toISOString(),
      };
      const next = { ...current, runnerLast: runner };
      projectRef.current = next;
      setProject(next);
      void setProjectRunner(projectId, runner).catch((e) =>
        console.error("[studio] persist runner send failed:", e)
      );
    },
    [projectId]
  );

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

  /** Feed the iframe-reported runtime error (message + stack) into an AI fix
   *  turn — the model gets the real error instead of guessing from a white
   *  screen or the user's "จอขาวครับ". */
  const fixPreviewError = useCallback(() => {
    const err = previewRuntimeError;
    if (!err) return;
    setPreviewRuntimeError(null);
    void generate(
      `ช่วยแก้ error นี้ใน demo:\n\n${err.message}${err.stack ? `\n\nstack:\n${err.stack.slice(0, 1500)}` : ""}`
    );
  }, [generate, previewRuntimeError]);

  /** Split an oversized file set into the standard layout (Code panel banner). */
  const reorganizeCode = useCallback(() => {
    void generate(REORGANIZE_PROMPT);
  }, [generate]);

  /* ——— Wand: point at an element in the demo and edit exactly it ——— */

  /** Drop the selection (and its glow inside the iframe), stay in wand mode. */
  const closeWandTarget = useCallback(() => {
    setWandTarget(null);
    setWandNudge((n) => ({ ...n, clear: n.clear + 1 }));
  }, []);

  const exitWand = useCallback(() => {
    setWandOn(false);
    setWandTarget(null);
  }, []);

  const handleWandPick = useCallback(
    (target: WandTarget, anchor: { x: number; y: number; w: number; h: number }) =>
      setWandTarget({ target, anchor }),
    []
  );

  /** Deterministic source patch — no model call, straight to HMR. */
  const applyWandPatch = useCallback(
    (patch: (source: string) => string | null, label: string): boolean => {
      const current = projectRef.current;
      const picked = wandTarget?.target;
      if (!current || !picked || readOnly) return false;
      // A deterministic patch written mid-stream is silently thrown away: the
      // running turn ends by persisting its own snapshot of the files.
      if (abortRef.current) {
        toast.info("กำลังแก้ไขอยู่ครับ", { description: "รอรอบนี้เสร็จก่อนค่อยปรับนะครับ" });
        return false;
      }
      const { path } = parseLoc(picked.loc);
      const source = current.files?.[path];
      if (source === undefined) return false;
      const next = patch(source);
      if (next === null || next === source) return false;
      // Same snapshot-then-write path a generation takes, so Undo covers it too.
      const saved = persist(withHistory(current, { ...current.files, [path]: next }));
      pushTerminal(`⚡ ${label} · ${path}`);
      if (previewSupported) void writeFile(path, next).catch(() => {});
      setWandNudge((n) => ({ ...n, repaint: n.repaint + 1 }));
      void commitRevision({
        projectId,
        files: saved.files ?? {},
        label,
        kind: "quick",
        targetLoc: picked.loc,
      }).then(() => setRevisionTick((t) => t + 1));
      return Boolean(saved);
    },
    [persist, previewSupported, projectId, pushTerminal, readOnly, wandTarget]
  );

  const castWand = useCallback(
    (instruction: string, attachments?: ChatAttachmentInput[]) => {
      const picked = wandTarget?.target;
      if (!picked) return;
      // Refuse here as well as in generate(), so the selection survives: the
      // .finally() below clears the target, and letting a refused cast run it
      // would make the user pick the element again for nothing.
      if (abortRef.current) {
        toast.info("กำลังแก้ไขอยู่ครับ", {
          description: "รอรอบนี้เสร็จก่อน หรือกด “หยุด” เพื่อยกเลิกรอบที่กำลังทำอยู่",
        });
        return;
      }
      setWandBusy(true);
      void generate(buildWandPrompt(picked, instruction), undefined, undefined, attachments).finally(
        () => {
          setWandBusy(false);
          // A finished cast leaves wand mode. It used to drop only the
          // selection, so the crosshair and the pick overlay stayed on and the
          // demo could not simply be used again. Leaving is also the honest
          // state: the model may have moved or rewritten the element, and the
          // file:line the wand selects by is no longer guaranteed to point at
          // it. Quick actions deliberately do NOT exit — those are meant to be
          // repeated on the same element.
          exitWand();
        }
      );
    },
    [exitWand, generate, wandTarget]
  );

  /**
   * Retrofit the hidden screen index into a project generated before the
   * contract existed — one iteration turn, no visible change to the demo, and
   * the capture walk goes from "guess the menus" to "click the declared doors".
   */
  const addScreenIndex = useCallback(() => {
    setScreensOpen(false);
    void generate(buildScreenIndexPrompt(projectRef.current?.files ?? null));
  }, [generate]);

  /** Create the files the app imports but never got (white-screen root cause). */
  const createMissingFiles = useCallback(() => {
    const missing = missingImports(projectRef.current?.files ?? null);
    if (missing.length === 0) return;
    void generate(buildMissingFilesPrompt(missing));
  }, [generate]);

  const handleUndo = useCallback(async () => {
    const current = projectRef.current;
    if (!current || busy || readOnly) return;
    // The stack lives in the database (migration 0032), so stepping back is a
    // round trip now — one that carries the single version being restored
    // instead of the ten the project row used to hand over on every open.
    const reverted = await undoProject(current).catch((e) => {
      console.error("[studio] undo failed:", e);
      toast.error("ย้อนกลับไม่สำเร็จ", { description: "ลองใหม่อีกครั้ง" });
      return null;
    });
    if (!reverted) return;
    const saved = persist(reverted);
    setErrorMessage(null);
    setPreviewRuntimeError(null);
    pushTerminal("↩ undo — ย้อนกลับ 1 ขั้น");
    if (hasRunnableApp(saved.files)) void boot(saved.files!);
  }, [boot, busy, persist, pushTerminal, readOnly]);

  /**
   * Take an interrupted turn's output into the project.
   *
   * MERGED over the current files, not swapped in for them: the draft holds what
   * that TURN wrote, and on an iteration the model re-sends only what it
   * changed. Replacing would delete every file the turn happened not to touch.
   * Applying it on top is exactly what the turn would have done.
   */
  const applyDraft = useCallback(
    (d: GenerationDraft, note: string) => {
      const current = projectRef.current;
      if (!current) return;
      // Through the scaffold guard: a set cut mid-stream can be missing
      // index.html, which every consumer of project.files assumes.
      const files = withRequiredScaffold({ ...(current.files ?? {}), ...d.files });
      const changes = computeChanges(current.files, files);
      setDraft(null);
      void clearDraft(projectId).catch(() => {});

      // Everything a turn normally leaves behind, which work arriving this way
      // used to skip entirely: the reply in the chat, and a checkpoint in the
      // version history. Without them a build that landed in the background was
      // invisible — no bubble saying it happened, and nothing to roll back to.
      const reply = newMessage("assistant", note, current.phase);
      if (changes.length) {
        reply.changes = changes;
        // Rebuild the action history from what actually changed. This page never
        // saw the stream — the turn ran on the server — so the live chips do not
        // exist here, and a bubble with no record of what the AI touched is a
        // turn the user cannot audit after a refresh. Derived from the diff, so
        // it states what happened rather than guessing at it.
        reply.actions = [
          { icon: "thought", label: "ทำต่อจนจบบนเซิร์ฟเวอร์ ระหว่างที่ปิดหน้าจอ" },
          ...changes.map((c) => ({ icon: "file", label: c.path })),
        ];
      }
      // withHistory so Undo covers this — work arriving on its own must not be
      // a one-way door.
      const saved = persist(appendMessage(withHistory(current, files), reply));
      pushTerminal(note);

      if (changes.length) {
        const label = d.prompt.trim().slice(0, 80) || note;
        void commitRevision({ projectId, files, label, kind: "ai" }).then((sha) => {
          setRevisionTick((t) => t + 1);
          if (!sha) return;
          const withSha = projectRef.current;
          if (!withSha) return;
          persist({
            ...withSha,
            messages: withSha.messages.map((m) =>
              m.id === reply.id ? { ...m, revision: { sha, label } } : m
            ),
          });
        });
      }
      if (hasRunnableApp(saved.files)) void boot(saved.files!);
    },
    [boot, persist, projectId, pushTerminal]
  );

  // Poll only while something is actually running, and stop the moment it is
  // not: a studio sitting idle must not talk to the database on a timer.
  useEffect(() => {
    if (chatStreaming || readOnly) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const d = await loadDraft(projectId).catch(() => null);
      if (stop) return;
      if (d && isDraftLive(d) && !d.complete) {
        setRemoteProgress(Object.keys(d.files).length);
        timer = setTimeout(() => void tick(), 4_000);
        return;
      }
      setRemoteProgress(null);
      // A turn that just finished elsewhere leaves a complete draft — hand it to
      // the same path that takes background work, so it lands here too.
      if (d && !isDraftLive(d)) setDraft(d);
      else timer = setTimeout(() => void tick(), 15_000);
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [projectId, chatStreaming, readOnly]);

  /**
   * A turn that finished on the server while nobody was watching is not a
   * recovery — it is the answer to something the user asked for. Someone who
   * sent a prompt and closed the tab should come back to the result, the way any
   * background job works, not to a dialog asking whether they would like it.
   *
   * Only the genuinely interrupted case (server stopped mid-turn, `complete`
   * false) still asks — see DraftRecovery.
   */
  useEffect(() => {
    if (!draft?.complete || busy || readOnly) return;
    void (async () => {
      applyDraft(draft, `✓ งานที่สั่งไว้ทำเสร็จแล้ว (${Object.keys(draft.files).length} ไฟล์)`);
      toast.success("งานที่สั่งไว้ทำเสร็จแล้ว", {
        description: "ทำต่อจนจบให้ตอนที่ปิดหน้าจอไป — กด Undo ย้อนได้ถ้าไม่เอา",
      });
    })();
  }, [draft, busy, readOnly, applyDraft]);

  /**
   * Restore the files at `sha`. Appends a NEW checkpoint rather than deleting
   * history (a revert, not a reset) — so you can always come back forward.
   */
  const rollbackTo = useCallback(
    async (sha: string) => {
      const current = projectRef.current;
      if (!current || busy || readOnly) return;
      const snap = await revisionFiles(projectId, sha);
      if (!snap) {
        toast.error("ย้อนกลับไม่ได้", { description: "เวอร์ชันนี้ถูกลบออกจากประวัติแล้ว" });
        return;
      }
      const ok = await confirm({
        title: `ย้อนกลับไปเวอร์ชัน ${sha}?`,
        message: `ไฟล์ทั้งหมดจะกลับไปเป็นตอน “${snap.label}” — เวอร์ชันปัจจุบันยังอยู่ในประวัติ กลับมาได้ตลอด`,
        confirmLabel: "ย้อนกลับ",
      });
      if (!ok) return;
      const saved = persist(withHistory(current, snap.files));
      setErrorMessage(null);
      setPreviewRuntimeError(null);
      pushTerminal(`⎇ ย้อนกลับไป ${sha} · ${snap.label}`);
      void commitRevision({
        projectId,
        files: snap.files,
        label: `ย้อนกลับไป ${sha}`,
        kind: "restore",
      }).then(() => setRevisionTick((t) => t + 1));
      if (hasRunnableApp(saved.files)) void boot(saved.files!);
    },
    [boot, busy, persist, projectId, pushTerminal, readOnly]
  );

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

      // Which tier version this project is pointed at. Read straight from the
      // row rather than carried on the record — see the activeVersion comment.
      const version = await activeVersionOf(projectId).catch(() => "standard" as VersionKey);
      if (cancelled) return;
      setActiveVersion(version);

      // Determine role-based access (owner vs. member/viewer).
      const access = await getAccess(projectId);
      if (cancelled) return;
      setIsOwner(access?.access === "owner");
      setReadOnly(access?.role === "viewer");

      // Did a previous turn die with its tab? Offer back what it produced —
      // never apply it silently, because a half-streamed set is not a runnable
      // project (see saveDraft).
      //
      // A draft whose heartbeat is still moving belongs to a turn running RIGHT
      // NOW, in another tab or a teammate's browser. Offering that one back
      // would put two writers on one project, so wait out the stale window and
      // look again: if it went quiet the turn died and the work is ours to
      // offer. If it is still beating, someone is working — leave them alone.
      void loadDraft(projectId).then((d) => {
        if (cancelled || !d) return;
        if (!isDraftLive(d)) {
          setDraft(d);
          return;
        }
        setTimeout(() => {
          void loadDraft(projectId).then((again) => {
            if (!cancelled && again && !isDraftLive(again)) setDraft(again);
          });
        }, DRAFT_STALE_MS);
      });

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
          // Files attached on the LaunchPad ride IndexedDB (too big for
          // sessionStorage) — fetch them before kicking off the pipeline.
          void takePendingAttachments(projectId).then((attachments) =>
            runExpressPipeline(pending.prompt, loaded, attachments ?? undefined)
          );
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
      // Flush a pending debounced save before leaving. Without this, navigating
      // away within the 800ms debounce window (e.g. right after a build finishes)
      // clears the timer and silently drops the last change. saveProject isn't
      // tied to React, so it completes even as the studio unmounts.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        if (projectRef.current) void saveProject(projectRef.current).catch(() => {});
      }
      // Don't abort an in-flight generate/agent — let it finish in the background
      // (the registry keeps it visible site-wide and it persists on done). Bump
      // the epoch so any loop started under THIS view detaches and stops writing
      // to the shared container — what the old abort guarded against on an SPA
      // project switch. (StrictMode's dev setup→cleanup→setup just advances the
      // epoch; a boolean here would latch and block every preview update.)
      epochRef.current += 1;
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
    const myEpoch = epochRef.current;
    if (wasBgRef.current && !projectGenerating) {
      void getProject(projectId).then((p) => {
        if (!p) return;
        projectRef.current = p;
        setProject(p);
        if (hasRunnableApp(p.files) && myEpoch === epochRef.current) void boot(p.files!);
      });
    }
    wasBgRef.current = bgActive;
  }, [projectGenerating, bgActive, projectId, boot]);

  // Load the project's workspace (Org DNA) — drives the chat citations and the
  // in-studio Org DNA panel. Reloads whenever the project's workspace changes.
  useEffect(() => {
    const orgId = project?.orgId;
    let cancelled = false;
    void (async () => {
      const o = orgId ? await getOrg(orgId) : null;
      if (!cancelled) {
        setOrg(o);
        // Drop any pending capture from the previous workspace so a stale chip
        // never crosses projects/orgs (a fresh capture arrives on the next turn).
        setDnaCapture(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.orgId]);

  /** Confirm a pending Living Org DNA capture: append it to its block (versioned),
   *  persist to the org, and reflect it locally. Guarded by dnaSaving. */
  const addDnaCapture = useCallback(async () => {
    if (!dnaCapture || !org) return;
    setDnaSaving(true);
    try {
      const next = appendDnaBlock(org.dna, dnaCapture.block, dnaCapture.snippet);
      await updateOrgDna(org.id, next);
      setOrg({ ...org, dna: next });
      toast.success("เพิ่มเข้า Org DNA แล้ว");
      setDnaCapture(null);
    } catch (e) {
      toast.error("เพิ่มไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setDnaSaving(false);
    }
  }, [dnaCapture, org]);

  /** Attach/switch/detach this project's workspace from the Org DNA panel. Writes
   *  org_id directly (autosave omits it) so the next AI turn picks up the DNA. */
  const attachWorkspace = useCallback(
    async (orgId: string | null) => {
      const current = projectRef.current;
      if (!current) return;
      const next = { ...current, orgId, updatedAt: new Date().toISOString() };
      projectRef.current = next;
      setProject(next);
      try {
        await setProjectOrg(projectId, orgId);
        toast.success(
          orgId ? "ผูก workspace แล้ว — AI จะอ้างอิง Org DNA" : "เอาออกจาก workspace แล้ว"
        );
      } catch (e) {
        toast.error("อัปเดต workspace ไม่สำเร็จ", {
          description: e instanceof Error ? e.message : undefined,
        });
      }
    },
    [projectId]
  );

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
    void currentUser().then((user) => {
      nameRef.current = user?.name ?? user?.email ?? "เพื่อนร่วมทีม";
      // Same source the account chip and presence dots use, so it's the face
      // teammates already recognise.
      setMyAvatar(user?.avatar ?? null);
      setMyName(nameRef.current);
      avatarRef.current = user?.avatar ?? null;
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
        // Nothing newer than what we hold → nothing to fetch. Cheap string
        // compare instead of a multi-megabyte round trip.
        const theirs = payload.updatedAt as string | undefined;
        if (theirs && projectRef.current && theirs <= projectRef.current.updatedAt) return;
        if (rtReloadTimer.current) clearTimeout(rtReloadTimer.current);
        const who = (payload.name as string) || "เพื่อนร่วมทีม";
        rtReloadTimer.current = setTimeout(() => {
          // Re-checked at fire time: state can change during the debounce.
          if (streamingRef.current || abortRef.current || saveTimer.current) return;
          void getProject(projectId).then((p) => {
            if (!p) return;
            // Only surface the sync when it actually brings in a newer version —
            // so the collaborator's edit doesn't change the screen silently.
            const changed = p.updatedAt !== projectRef.current?.updatedAt;
            projectRef.current = p;
            setProject(p);
            if (changed) toast.info(`🔄 ${who} อัปเดตโปรเจกต์`, { description: "ดึงเวอร์ชันล่าสุดเข้ามาให้แล้ว" });
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
      // Two small columns, not the whole project: this ran on every tab focus
      // and downloaded files + history + every turn's diffs to compare one
      // short string.
      void getProjectPhase(projectId).then((remote) => {
        const cur = projectRef.current;
        if (!remote || !cur || remote.phase === cur.phase) return;
        void getProject(projectId).then((loaded) => {
          if (!loaded) return;
          projectRef.current = loaded;
          setProject(loaded);
        });
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
        void handleUndo();
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
  // Imports with no file behind them — the cause of the "จอขาว" the compile
  // error only hints at. Derived, never stored: it must follow project.files.
  const missingFiles = hasApp ? missingImports(project.files) : [];
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

  /**
   * Switch which sellable version the studio is editing.
   *
   * Standard and Premium are two BUILDS of one project: the active one lives in
   * `project.files` and the other is parked in its own table, so everything
   * downstream (export, Code Runner, quotation, preview) keeps working on
   * `files` with no idea versions exist.
   *
   * The files on screen are handed to the switch and parked as the outgoing
   * version — switching mid-edit must not be a way to lose work — and the
   * preview is rebooted afterwards because the file set under it has entirely
   * changed.
   */
  const changeVersion = async (next: VersionKey) => {
    if (!project || readOnly || switchingVersion || next === activeVersion) return;
    setSwitchingVersion(true);
    try {
      // Seeded = the version being LEFT had nothing parked before this switch,
      // so the one being entered is starting from a copy of it. Asked before the
      // switch, because after it the outgoing version is always parked.
      const seeded = !(await parkedVersions(project.id)).includes(next);
      // One transaction: files, pointer and both version rows move together, or
      // none of them do. It also writes `files`, so no save follows it — a save
      // here would only send the same megabytes back a second time.
      const { files, shadowed } = await switchVersion(
        project.id,
        activeVersion,
        next,
        project.files ?? {}
      );
      setProject({ ...project, files, updatedAt: new Date().toISOString() });
      setActiveVersion(next);

      // Premium replaces these files, and the base versions of them have changed
      // since it did — so the newer base edits are not in what is now on screen.
      // Keeping the overlay is right; not saying so is not. A dialog rather than
      // a toast because it is a decision with consequences either way, and the
      // AI wrote both sides so it is also the thing that can reconcile them.
      if (shadowed.length) {
        const merge = await confirm({
          title: `${shadowed.length} ไฟล์ของ Premium ทับเวอร์ชันที่ฐานแก้ใหม่ไว้`,
          message: `${shadowed.join(" · ")}\n\nไฟล์เหล่านี้ Premium เขียนทับไว้เอง การแก้ไขล่าสุดที่ทำในเวอร์ชันปกติจึงยังไม่อยู่ในนี้ — ให้ AI นำมารวมให้ไหม (ฟีเจอร์ Premium ยังอยู่ครบ)`,
          confirmLabel: "ให้ AI รวมให้",
        });
        if (merge) {
          void generate(
            [
              "ไฟล์เหล่านี้ในเวอร์ชัน Premium ถูกเขียนทับไว้ ทำให้การแก้ไขล่าสุดที่ทำในเวอร์ชันปกติหายไป:",
              ...shadowed.map((f) => `- ${f}`),
              "",
              "ช่วยนำการแก้ไขจากเวอร์ชันปกติกลับมาใส่ โดยยังคงฟีเจอร์ของ Premium ไว้ครบ",
            ].join("\n")
          );
          return;
        }
      }

      toast.success(`สลับไปเวอร์ชัน${VERSION_LABEL[next]}แล้ว`, {
        description: seeded
          ? "เริ่มจากไฟล์ชุดเดิม — งานที่ทำต่อจากนี้จะไม่ไปกระทบอีกเวอร์ชัน"
          : "Export ตอนนี้จะได้ zip ของเวอร์ชันนี้",
      });
      // A version that was just seeded is a copy of the one it came from — it is
      // not worth more money until something is built into it. Offer what this
      // domain actually sells instead of leaving an empty chat box to guess at.
      if (next === "premium" && seeded) {
        setPremiumOffer(
          premiumOptionsFor(getSkill(project.skillId), [
            ...screenIndexEntries(files).map((e) => e.name),
            ...Object.keys(files),
          ])
        );
      }
      await boot(files);
    } catch (e) {
      toast.error("สลับเวอร์ชันไม่สำเร็จ", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSwitchingVersion(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-night text-chalk">
      <LiveCursors projectId={projectId} />
      {screensOpen && (
        <ScreenInventory
          projectId={projectId}
          projectName={project.name}
          orgId={project.orgId ?? null}
          files={project.files}
          toPreview={toPreview}
          onAddScreenIndex={readOnly || busy ? undefined : addScreenIndex}
          readOnly={readOnly}
          ready={Boolean(previewUrl) && phase === "ready"}
          recording={recording}
          onStartRecording={() => {
            // Recording needs the preview reachable, so this panel gets out of
            // the way and a slim bar takes over until the user stops.
            setScreensOpen(false);
            setRecCount(0);
            setRecLast(null);
            setRecording(true);
            setView("preview");
            toPreview({ __fittRecord: true });
          }}
          onClose={() => setScreensOpen(false)}
        />
      )}
      {recording && (
        <div className="fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4">
          <div className="glass flex items-center gap-3 rounded-full py-2 pl-4 pr-2 shadow-glass">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-halt opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-halt" />
            </span>
            <span className="text-[13px] text-chalk">
              กำลังอัด · <b className="text-shine">เก็บแล้ว {recCount} หน้า</b>
              {recLast && <span className="text-chalk-dim"> — ล่าสุด: {recLast}</span>}
            </span>
            <button
              onClick={() => {
                setRecording(false);
                toPreview({ __fittRecord: false });
                setScreensOpen(true);
              }}
              className="shrink-0 rounded-full bg-shine px-3 py-1 font-display text-[12px] font-semibold text-night transition hover:brightness-110"
            >
              หยุดอัด
            </button>
          </div>
        </div>
      )}
      {/* Unmounted while its own cast runs: the instruction is already sent, so
          a card with an empty box that cannot be typed in only competes with
          the rainbow wave for attention. During a spell the wave IS the UI. */}
      {wandTarget && !readOnly && !wandBusy && (
        <WandComposer
          target={wandTarget.target}
          anchor={wandTarget.anchor}
          // Any other turn — chat, fix-error, reorganize, add-index — locks the
          // wand too: they all write the same files through the same one-at-a-
          // time path, and only this composer used to look available anyway.
          locked={chatStreaming}
          onQuickClass={(action) =>
            applyWandPatch(
              (source) => patchClassName(source, wandTarget.target.loc, action),
              action.label
            )
          }
          onQuickText={(text) =>
            applyWandPatch((source) => patchText(source, wandTarget.target.loc, text), "แก้ข้อความ")
          }
          onCast={castWand}
          onClose={closeWandTarget}
        />
      )}
      {(bgActive || remoteProgress !== null) && (
        <div className="pointer-events-none fixed left-1/2 top-3 z-[60] -translate-x-1/2">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-chalk shadow-lg">
            <span className="loader-dot h-1.5 w-1.5 rounded-full bg-shine" />
            {remoteProgress !== null
              ? `กำลังสร้างอยู่… เขียนไปแล้ว ${remoteProgress} ไฟล์ · จะลงให้เมื่อเสร็จ`
              : "กำลังสร้างเบื้องหลัง… จะอัปเดตให้เมื่อเสร็จ"}
          </span>
        </div>
      )}
      <TopBar
        project={project}
        org={org}
        activeVersion={activeVersion}
        onOpenDna={() => setDnaOpen(true)}
        view={view}
        busy={busy}
        readOnly={readOnly}
        saveState={saveState}
        canUndo={!readOnly && project.historyCount > 0}
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
        onOpenScreens={() => {
          // Capture drives the live iframe, so the preview has to be on screen.
          setView("preview");
          setScreensOpen(true);
        }}
        onTeamShare={isOwner ? () => setShareOpen(true) : undefined}
        onRunnerSent={readOnly ? undefined : handleRunnerSent}
      />

      <PhaseStepper
        phase={project.phase}
        version={project.files ? activeVersion : undefined}
        onVersionChange={readOnly ? undefined : changeVersion}
        switching={switchingVersion}
        busy={phaseBusy}
        canAdvance={!readOnly && gateSatisfied(project)}
        canRework={canRework}
        approval={approvalSummary}
        onAdvance={readOnly ? () => {} : () => void requestApprove()}
        onStep={handleStepClick}
        onGenerateDoc={generatePhaseDoc}
        onRework={rebuildFromDocs}
      />

      <div className="flex min-h-0 flex-1">
        <div style={{ width: leftWidth }} className="flex shrink-0 flex-col border-r border-night-edge">
          {skillPickerOpen && !readOnly && project.phase === "define" && !project.skillId && (
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
            projectId={project.id}
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
              // Only name what the bubble can't show: pictures render as
              // thumbnails, so listing them again is noise. Documents (and any
              // picture whose upload failed) still get a line.
              const unshown = media.filter((m) => !m.path || !m.mimeType.startsWith("image/"));
              const mediaNote = unshown.length
                ? `\n\n🖼️ แนบ: ${unshown.map((m) => m.name).join(", ")}`
                : "";
              const full = `${text}${note}${mediaNote}`;
              setAttachedPaths([]);
              if (inBuild) handleBuildSubmit(full, media);
              else void runAgent(full, undefined, undefined, media);
              // Living Org DNA: fire-and-forget classification of the user's own
              // message. Only when the project has a workspace and the message is
              // substantive; never awaited so it can't block or disrupt the turn.
              if (org && full.trim().length >= 12) {
                void captureDnaFromText(full)
                  .then((c) => {
                    if (c) setDnaCapture(c);
                  })
                  .catch(() => {});
              }
            }}
            onCancel={cancel}
            onViewDoc={previewPhaseDoc}
            myAvatar={myAvatar}
            myName={myName}
            readOnly={readOnly}
            peers={[...aiPeers.values()]}
            onTyping={broadcastAiTyping}
            orgDna={org?.dna ?? null}
            dnaCapture={dnaCapture}
            onDnaAdd={() => void addDnaCapture()}
            onDnaDismiss={() => setDnaCapture(null)}
            dnaSaving={dnaSaving}
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
                runtimeError={previewRuntimeError}
                onFixError={readOnly ? undefined : fixPreviewError}
                onDismissError={() => setPreviewRuntimeError(null)}
                onRefresh={() => {
                  // Fresh document — a still-broken app re-reports itself.
                  setPreviewRuntimeError(null);
                  setPreviewKey((k) => k + 1);
                }}
                onPopOut={handlePopOut}
                wandOn={wandOn}
                wandBusy={wandBusy}
                onToggleWand={
                  readOnly
                    ? undefined
                    : () =>
                        setWandOn((v) => {
                          if (v) setWandTarget(null);
                          return !v;
                        })
                }
                onWandPick={readOnly ? undefined : handleWandPick}
                onWandExit={exitWand}
                wandNudge={wandNudge}
                missingFiles={missingFiles}
                onCreateMissingFiles={readOnly ? undefined : createMissingFiles}
                onBridge={takeBridge}
              />
            ) : view === "history" ? (
              <HistoryPanel
                projectId={projectId}
                refreshKey={revisionTick}
                onRollback={readOnly ? undefined : rollbackTo}
                currentFiles={project.files}
              />
            ) : (
              <CodePanel
                files={displayFiles}
                onEdit={readOnly ? () => {} : handleFileEdit}
                onCreateFile={readOnly ? () => false : handleCreateFile}
                onRenameFile={readOnly ? () => false : handleRenameFile}
                onDeleteFile={readOnly ? () => false : handleDeleteFile}
                onAttachToChat={attachFile}
                onReorganize={readOnly || busy ? undefined : reorganizeCode}
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

      <DraftRecovery
        draft={draft?.complete ? null : draft}
        onDiscard={() => {
          setDraft(null);
          void clearDraft(projectId).catch(() => {});
        }}
        onRecover={() => {
          if (draft) applyDraft(draft, `↺ กู้คืนไฟล์จากรอบที่ค้างไว้ (${Object.keys(draft.files).length} ไฟล์)`);
        }}
      />

      <PremiumPicker
        // Remounted per offer so a previous selection never carries over into
        // the next project's picker.
        key={premiumOffer.length ? "premium-open" : "premium-closed"}
        open={premiumOffer.length > 0}
        options={premiumOffer}
        onClose={() => setPremiumOffer([])}
        onBuild={(chosen) => {
          setPremiumOffer([]);
          void generate(buildPremiumContext(chosen));
        }}
      />

      <ApprovalModal
        key={approveOpen ? `approve-${project.phase}` : "approve-closed"}
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        projectId={projectId}
        phase={project.phase}
        phaseLabel={phaseDef(project.phase).user}
        onConfirm={confirmApproval}
      />

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

      {dnaOpen && (
        <OrgDnaPanel
          org={org}
          canAttach={isOwner}
          onAttach={(id) => void attachWorkspace(id)}
          onClose={() => setDnaOpen(false)}
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

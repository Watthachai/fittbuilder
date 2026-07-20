"use client";

import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { toFileSystemTree } from "./files";
import { idbGet, idbSet } from "./idb";
import type { GenerationPhase, ProjectFiles } from "./types";

/**
 * WebContainer singleton + project lifecycle (PRD F-003).
 * boot() once per browser session; each run mounts files, installs and
 * starts the Vite dev server (`vite --host`), reporting progress through
 * callbacks. (Next.js can't run reliably in WebContainer — see lib/scaffold.ts.)
 *
 * Runs are serialized (runChain) so the live scaffold's install and a later
 * Build never touch the container filesystem concurrently.
 */

export class BrowserUnsupportedError extends Error {
  constructor() {
    super(
      "เบราว์เซอร์นี้ยังไม่รองรับ live preview (ต้องการ cross-origin isolation) — แนะนำ Chrome หรือ Edge เวอร์ชันล่าสุด"
    );
    this.name = "BrowserUnsupportedError";
  }
}

// The boot promise lives on globalThis, NOT a module-level let: Next.js dev
// HMR/Fast Refresh re-evaluates this module, which would reset a module-level
// reference to null while the WebContainer is still alive in the page — and
// WebContainer.boot() may be called only ONCE per page, so the next call would
// throw "Only a single WebContainer instance can be booted". globalThis survives
// module re-evaluation, so boot() runs exactly once.
type WCGlobal = { __fittContainer?: Promise<WebContainer> | null };
const wcGlobal = globalThis as WCGlobal;

let currentDevProcess: WebContainerProcess | null = null;
let currentRunId = 0;
let installedPackageJson: string | null = null;
/** The project whose files currently occupy the shared workdir. */
let mountedProjectId: string | null = null;
/** Serializes runs so two npm installs never touch the FS at once. */
let runChain: Promise<void> = Promise.resolve();
/** Aborts the in-flight run's server-ready wait when a newer run supersedes it. */
let abortCurrentReady: (() => void) | null = null;

export function isPreviewSupported(): boolean {
  return typeof window !== "undefined" && window.crossOriginIsolated === true;
}

async function getContainer(): Promise<WebContainer> {
  if (!isPreviewSupported()) throw new BrowserUnsupportedError();
  if (!wcGlobal.__fittContainer) {
    const booting = import("@webcontainer/api").then(({ WebContainer }) =>
      WebContainer.boot({ workdirName: "fitt-builder" })
    );
    wcGlobal.__fittContainer = booting;
    // If boot rejects, clear the cache so a later attempt can retry — UNLESS an
    // instance is already booted (the API gives no handle to it, so retrying
    // would just loop on the same error).
    booting.catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("single WebContainer")) wcGlobal.__fittContainer = null;
    });
  }
  return wcGlobal.__fittContainer;
}

/** The booted container promise if one exists, else null (never triggers a boot). */
function peekContainer(): Promise<WebContainer> | null {
  return wcGlobal.__fittContainer ?? null;
}

/**
 * Boot the container ahead of time (studio open) so the first generation
 * skips the boot wait. Fire-and-forget; runProject reuses the same promise.
 */
export function warmBoot(): void {
  if (!isPreviewSupported()) return;
  void getContainer().catch(() => {
    // Boot failures surface properly on the first real run (getContainer's own
    // catch already cleared the cache where a retry makes sense).
  });
}

/**
 * Files kept across a project switch. node_modules + package.json stay so the
 * install cache (installedPackageJson) holds and the next project skips install.
 */
const KEEP_ON_RESET = new Set(["node_modules", "package.json", ".npmrc"]);

/**
 * Clear the shared workdir of the previous project's source files. The
 * container has a single workdir and mount() only overlays (never deletes), so
 * without this a project would inherit files another project authored.
 */
async function resetWorkdir(): Promise<void> {
  const booted = peekContainer();
  if (!booted) return;
  const wc = await booted.catch(() => null);
  if (!wc) return;
  abortCurrentReady?.();
  if (currentDevProcess) {
    currentDevProcess.kill();
    currentDevProcess = null;
  }
  try {
    const entries = await wc.fs.readdir(".", { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => !KEEP_ON_RESET.has(entry.name))
        .map((entry) => wc.fs.rm(entry.name, { recursive: true, force: true }).catch(() => {}))
    );
  } catch {
    // Best effort — the next mount overlays the new project's files anyway.
  }
  runChain = Promise.resolve();
}

/**
 * Call before booting a project. When switching to a different project, wipes
 * the previous project's source files first so nothing bleeds across projects
 * (SPA navigation keeps this module's container alive between studio sessions).
 */
export async function prepareWorkdir(projectId: string): Promise<void> {
  if (mountedProjectId !== null && mountedProjectId !== projectId) {
    // Supersede any in-flight run and let the chain settle before wiping, so a
    // build still installing for the old project can't race the file removal.
    currentRunId++;
    abortCurrentReady?.();
    await runChain.catch(() => {});
    await resetWorkdir();
  }
  mountedProjectId = projectId;
}

/** Persisted node_modules snapshot (IndexedDB), keyed by the package.json it was built from. */
// v3: exclude node_modules/.vite from the snapshot. The export runs right after
// server-ready — racing Vite's dep optimizer, which is still writing .vite/deps
// as the first page loads. A snapshot frozen mid-write keeps a metadata file
// whose hash still matches after restore, so Vite trusts the half-written cache
// and serves truncated chunks → permanent white screen that reloads can't fix
// (every reload restores the same poisoned snapshot). The key bump also retires
// any poisoned v2 snapshots users already have.
const NM_CACHE_KEY = "node_modules_snapshot_v3";
interface NmSnapshot {
  pkgJson: string;
  snapshot: Uint8Array;
}

/**
 * Restore node_modules from the IndexedDB snapshot when the project's
 * package.json matches — lets a fresh container (after a page reload) skip the
 * whole `npm install`. Returns false on any miss/failure (caller installs).
 */
async function restoreNodeModules(wc: WebContainer, pkgJson: string): Promise<boolean> {
  const cached = await idbGet<NmSnapshot>(NM_CACHE_KEY);
  if (!cached || cached.pkgJson !== pkgJson || !cached.snapshot) return false;
  try {
    await wc.mount(cached.snapshot, { mountPoint: "node_modules" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Snapshot node_modules into IndexedDB so the next reload can skip install.
 * Called ONLY after the dev server has actually started, so we never cache an
 * incomplete/broken node_modules.
 */
async function cacheNodeModules(wc: WebContainer, pkgJson: string): Promise<void> {
  try {
    const snapshot = await wc.export("node_modules", {
      format: "binary",
      excludes: [".vite", ".vite/**"],
    });
    await idbSet(NM_CACHE_KEY, { pkgJson, snapshot } satisfies NmSnapshot);
  } catch {
    // Snapshot too large / export failed — next run just reinstalls.
  }
}

/** Drop the persisted snapshot (e.g. after it turned out to be broken). */
async function invalidateSnapshot(): Promise<void> {
  await idbSet(NM_CACHE_KEY, null);
}

/** Delete node_modules so the next install is clean (recovery from corruption). */
async function cleanNodeModules(wc: WebContainer): Promise<void> {
  try {
    await wc.fs.rm("node_modules", { recursive: true, force: true });
  } catch {
    // already gone
  }
}

/** Run `npm install`; sets the in-memory cache key on success. Returns true/false/"superseded". */
async function runInstall(
  wc: WebContainer,
  pkgJson: string,
  cb: RunCallbacks,
  runId: number
): Promise<boolean | "superseded"> {
  cb.onPhase("installing");
  cb.onTerminal("$ npm install");
  const install = await wc.spawn("npm", ["install"]);
  pipeToTerminal(install, cb.onTerminal);
  const exitCode = await install.exit;
  // Record the cache key even if superseded — install finished and the
  // package.json is shared, so a queued run can skip it.
  if (exitCode === 0) installedPackageJson = pkgJson;
  if (runId !== currentRunId) return "superseded";
  return exitCode === 0;
}

/**
 * Start `npm run dev` and wait for the server. Resolves to the preview URL,
 * null if the dev server failed/timed out (caller recovers), or "superseded".
 */
async function startDev(
  wc: WebContainer,
  cb: RunCallbacks,
  runId: number
): Promise<string | null | "superseded"> {
  cb.onPhase("starting");
  cb.onTerminal("$ npm run dev");
  const dev = await wc.spawn("npm", ["run", "dev"]);
  currentDevProcess = dev;
  pipeToTerminal(dev, cb.onTerminal);

  const SUPERSEDED = " superseded";
  const result = await new Promise<string>((resolve) => {
    let settled = false;
    const done = (value: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      abortCurrentReady = null;
      resolve(value);
    };
    const timer = setTimeout(() => done(""), SERVER_READY_TIMEOUT_MS); // "" = failed
    const unsubscribe = wc.on("server-ready", (_port, url) => done(url));
    abortCurrentReady = () => done(SUPERSEDED);
    // dev process dying before server-ready (e.g. `vite: command not found`).
    void dev.exit.then(() => done(""));
  });

  if (result === SUPERSEDED || runId !== currentRunId) return "superseded";
  return result === "" ? null : result;
}

export interface RunCallbacks {
  onPhase: (phase: GenerationPhase) => void;
  onTerminal: (line: string) => void;
  onServerReady: (url: string) => void;
  onError: (message: string) => void;
}

/** The runId that already consumed its one automatic dev-server restart. */
let autoRestartedRunId = -1;

/**
 * After server-ready, watch for the dev process dying UNEXPECTEDLY (container
 * OOM after long sessions, vite crash). Without this the exit goes unnoticed:
 * the status bar keeps saying "พร้อม" while the iframe points at a dead server
 * (white screen). Intentional kills (reboot/reset/supersede) null or replace
 * currentDevProcess first, so the watcher no-ops for them. One automatic
 * restart per run; a second death surfaces as a real error.
 */
function watchDevExit(wc: WebContainer, cb: RunCallbacks, runId: number): void {
  const dev = currentDevProcess;
  if (!dev) return;
  void dev.exit.then(async (code) => {
    if (currentDevProcess !== dev || runId !== currentRunId) return;
    currentDevProcess = null;
    cb.onTerminal(`⚠ dev server หยุดทำงานเอง (exit ${code})`);
    if (autoRestartedRunId === runId) {
      cb.onError("dev server หยุดทำงานซ้ำ — กรุณาโหลดหน้าใหม่");
      return;
    }
    autoRestartedRunId = runId;
    cb.onTerminal("รีสตาร์ต dev server อัตโนมัติ…");
    const url = await startDev(wc, cb, runId);
    if (url === "superseded") return;
    if (url === null) {
      cb.onError("รีสตาร์ต dev server ไม่สำเร็จ — กรุณาโหลดหน้าใหม่");
      return;
    }
    cb.onServerReady(url);
    cb.onPhase("ready");
    watchDevExit(wc, cb, runId); // second death hits the guard above → error
  });
}

// Generous ceiling for npm install + Vite cold start inside WebContainer.
const SERVER_READY_TIMEOUT_MS = 120_000;

function pipeToTerminal(
  process: WebContainerProcess,
  onTerminal: (line: string) => void
): void {
  void process.output.pipeTo(
    new WritableStream<string>({
      write(chunk) {
        // Strip ANSI escape sequences for a readable terminal log.
        const clean = chunk.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").trimEnd();
        if (clean) onTerminal(clean);
      },
    })
  );
}

/**
 * Mount a full project and boot its dev server. Runs are serialized: a new
 * call claims the latest runId synchronously, then queues behind any in-flight
 * run so filesystem/install steps never overlap. A run whose id is no longer
 * current bails at the next checkpoint.
 */
export function runProject(files: ProjectFiles, cb: RunCallbacks): Promise<void> {
  const runId = ++currentRunId;
  // Stop the in-flight run from sitting on its server-ready wait so this run
  // can take over promptly instead of queueing behind a slow scaffold compile.
  abortCurrentReady?.();
  const run = runChain.then(() => execRun(runId, files, cb));
  runChain = run.catch(() => {});
  return run;
}

async function execRun(runId: number, files: ProjectFiles, cb: RunCallbacks): Promise<void> {
  if (runId !== currentRunId) return; // superseded while queued
  try {
    const wc = await getContainer();
    if (runId !== currentRunId) return;

    if (currentDevProcess) {
      currentDevProcess.kill();
      currentDevProcess = null;
    }

    await wc.mount(toFileSystemTree(files) as Parameters<typeof wc.mount>[0]);
    if (runId !== currentRunId) return;

    const pkgJson = files["package.json"];
    let installedFresh = false; // only snapshot a node_modules we actually installed

    // npm install — skipped when package.json is unchanged (in-memory cache),
    // or restored from a persisted snapshot so it survives a page reload.
    if (installedPackageJson !== pkgJson) {
      if (await restoreNodeModules(wc, pkgJson)) {
        if (runId !== currentRunId) return;
        installedPackageJson = pkgJson;
        cb.onTerminal("✓ กู้ node_modules จากแคช (ข้าม npm install)");
      } else {
        const ok = await runInstall(wc, pkgJson, cb, runId);
        if (ok === "superseded") return;
        if (!ok) {
          cb.onError("npm install ล้มเหลว");
          return;
        }
        installedFresh = true;
      }
    }

    // Start the dev server. If it fails (e.g. a restored/corrupt node_modules is
    // missing vite), wipe node_modules + the bad snapshot and reinstall once.
    let url = await startDev(wc, cb, runId);
    if (url === "superseded") return;
    if (url === null) {
      cb.onTerminal("⚠ dev server เริ่มไม่ได้ — ล้าง node_modules แล้วติดตั้งใหม่…");
      await invalidateSnapshot();
      await cleanNodeModules(wc);
      installedPackageJson = null;
      if (runId !== currentRunId) return;
      const ok = await runInstall(wc, pkgJson, cb, runId);
      if (ok === "superseded") return;
      if (!ok) {
        cb.onError("npm install ล้มเหลว");
        return;
      }
      installedFresh = true;
      url = await startDev(wc, cb, runId);
      if (url === "superseded") return;
      if (url === null) {
        cb.onError("เปิด dev server ไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
    }

    if (runId !== currentRunId) return;
    cb.onServerReady(url);
    cb.onPhase("ready");
    watchDevExit(wc, cb, runId);
    // Snapshot only a proven-good node_modules (dev server actually started).
    if (installedFresh) void cacheNodeModules(wc, pkgJson);
  } catch (error) {
    if (runId !== currentRunId) return;
    cb.onError(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการรัน preview");
  }
}

/**
 * Apply an iteration: write only changed files (Vite HMR picks them up).
 * Falls back to a full restart when package.json changed.
 */
export async function applyChanges(
  allFiles: ProjectFiles,
  changed: ProjectFiles,
  deleted: string[] | undefined,
  cb: RunCallbacks
): Promise<void> {
  if ("package.json" in changed) {
    await runProject(allFiles, cb);
    return;
  }
  try {
    const wc = await getContainer();
    for (const path of deleted ?? []) {
      try {
        await wc.fs.rm(path, { recursive: true });
        cb.onTerminal(`ลบไฟล์ ${path}`);
      } catch {
        // Already absent — nothing to do.
      }
    }
    for (const [path, contents] of Object.entries(changed)) {
      const dir = path.split("/").slice(0, -1).join("/");
      if (dir) await wc.fs.mkdir(dir, { recursive: true });
      await wc.fs.writeFile(path, contents);
      cb.onTerminal(`อัปเดต ${path}`);
    }
    cb.onPhase("ready");
  } catch (error) {
    cb.onError(error instanceof Error ? error.message : "อัปเดตไฟล์ไม่สำเร็จ");
  }
}

/** Write a single file (Monaco edits / incremental generation) without phase changes. */
export async function writeFile(path: string, contents: string): Promise<void> {
  const wc = await getContainer();
  const dir = path.split("/").slice(0, -1).join("/");
  if (dir) await wc.fs.mkdir(dir, { recursive: true });
  await wc.fs.writeFile(path, contents);
}

/** Remove a single file (incremental generation deletes). */
export async function removeFile(path: string): Promise<void> {
  const wc = await getContainer();
  await wc.fs.rm(path, { recursive: true, force: true });
}

/**
 * Read the project's source files from the live container (excludes
 * node_modules) so the Code panel can mirror real container state — e.g. a
 * package the user installed from the interactive Shell.
 */
export async function readSource(): Promise<ProjectFiles> {
  const wc = await getContainer();
  const tree = (await wc.export(".", {
    format: "json",
    excludes: ["node_modules", "node_modules/**", ".git", ".git/**", ".npmrc", ".vite"],
  })) as Record<string, unknown>;
  const files: ProjectFiles = {};
  const walk = (node: Record<string, unknown>, prefix: string) => {
    for (const [name, raw] of Object.entries(node)) {
      if (name === "node_modules" || name === ".git" || name === ".npmrc" || name === ".vite") continue;
      const path = prefix ? `${prefix}/${name}` : name;
      const entry = raw as { file?: { contents?: unknown }; directory?: Record<string, unknown> };
      if (entry?.file && typeof entry.file.contents === "string") {
        files[path] = entry.file.contents;
      } else if (entry?.directory) {
        walk(entry.directory, path);
      }
    }
  };
  walk(tree, "");
  return files;
}

/**
 * Spawn an interactive shell (jsh) in the container — backs the Terminal panel
 * so the user can run real commands (ls, npm, node) against the live filesystem.
 */
export async function startShell(dims: {
  cols: number;
  rows: number;
}): Promise<WebContainerProcess> {
  const wc = await getContainer();
  return wc.spawn("jsh", { terminal: dims });
}

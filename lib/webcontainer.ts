"use client";

import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { toFileSystemTree } from "./files";
import type { GenerationPhase, ProjectFiles } from "./types";

/**
 * WebContainer singleton + project lifecycle (PRD F-003).
 * boot() once per browser session; each run mounts files, installs and
 * starts the Vite dev server, reporting progress through callbacks.
 */

export class BrowserUnsupportedError extends Error {
  constructor() {
    super(
      "เบราว์เซอร์นี้ยังไม่รองรับ live preview (ต้องการ cross-origin isolation) — แนะนำ Chrome หรือ Edge เวอร์ชันล่าสุด"
    );
    this.name = "BrowserUnsupportedError";
  }
}

let containerPromise: Promise<WebContainer> | null = null;
let currentDevProcess: WebContainerProcess | null = null;
let currentRunId = 0;
let installedPackageJson: string | null = null;

export function isPreviewSupported(): boolean {
  return typeof window !== "undefined" && window.crossOriginIsolated === true;
}

async function getContainer(): Promise<WebContainer> {
  if (!isPreviewSupported()) throw new BrowserUnsupportedError();
  if (!containerPromise) {
    containerPromise = import("@webcontainer/api").then(({ WebContainer }) =>
      WebContainer.boot({ workdirName: "fitt-builder" })
    );
  }
  return containerPromise;
}

/**
 * Boot the container ahead of time (studio open) so the first generation
 * skips the boot wait. Fire-and-forget; runProject reuses the same promise.
 */
export function warmBoot(): void {
  if (!isPreviewSupported()) return;
  void getContainer().catch(() => {
    // Boot failures surface properly on the first real run.
    containerPromise = null;
  });
}

export interface RunCallbacks {
  onPhase: (phase: GenerationPhase) => void;
  onTerminal: (line: string) => void;
  onServerReady: (url: string) => void;
  onError: (message: string) => void;
}

const SERVER_READY_TIMEOUT_MS = 60_000;

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

/** Mount a full project and boot its dev server. */
export async function runProject(files: ProjectFiles, cb: RunCallbacks): Promise<void> {
  const runId = ++currentRunId;
  try {
    const wc = await getContainer();
    if (runId !== currentRunId) return;

    if (currentDevProcess) {
      currentDevProcess.kill();
      currentDevProcess = null;
    }

    await wc.mount(toFileSystemTree(files) as Parameters<typeof wc.mount>[0]);
    if (runId !== currentRunId) return;

    // npm install — skipped when package.json is unchanged (cached node_modules).
    if (installedPackageJson !== files["package.json"]) {
      cb.onPhase("installing");
      cb.onTerminal("$ npm install");
      const install = await wc.spawn("npm", ["install"]);
      pipeToTerminal(install, cb.onTerminal);
      const exitCode = await install.exit;
      if (runId !== currentRunId) return;
      if (exitCode !== 0) {
        cb.onError(`npm install ล้มเหลว (exit code ${exitCode})`);
        return;
      }
      installedPackageJson = files["package.json"];
    }

    cb.onPhase("starting");
    cb.onTerminal("$ npm run dev");

    const ready = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("เปิด dev server ไม่สำเร็จภายใน 60 วินาที")),
        SERVER_READY_TIMEOUT_MS
      );
      const unsubscribe = wc.on("server-ready", (_port, url) => {
        clearTimeout(timer);
        unsubscribe();
        resolve(url);
      });
    });

    const dev = await wc.spawn("npm", ["run", "dev"]);
    currentDevProcess = dev;
    pipeToTerminal(dev, cb.onTerminal);

    const url = await ready;
    if (runId !== currentRunId) return;
    cb.onServerReady(url);
    cb.onPhase("ready");
  } catch (error) {
    if (runId !== currentRunId) return;
    cb.onError(error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการรัน preview");
  }
}

/**
 * Apply an iteration: write only changed files (Vite hot-reloads).
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

/** Write a single file (Monaco edits) without phase changes. */
export async function writeFile(path: string, contents: string): Promise<void> {
  const wc = await getContainer();
  const dir = path.split("/").slice(0, -1).join("/");
  if (dir) await wc.fs.mkdir(dir, { recursive: true });
  await wc.fs.writeFile(path, contents);
}

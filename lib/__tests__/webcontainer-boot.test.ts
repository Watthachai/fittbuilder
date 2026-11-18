import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boot = vi.fn();
vi.mock("@webcontainer/api", () => ({ WebContainer: { boot } }));

const callbacks = () => ({ onPhase: vi.fn(), onTerminal: vi.fn(), onServerReady: vi.fn(), onError: vi.fn() });
const FILES = { "package.json": "{}" };

/**
 * The preview runtime (StackBlitz) marks its one instance taken as soon as a
 * boot starts and keeps it taken when that boot fails, so every later boot in
 * the same page fails with "Unable to create more instances" — checked against
 * the live runtime on 2026-11-18. A customer on a 4 GB laptop saw only that
 * message, over and over, while the failure that caused it was never shown.
 */
describe("a preview that could not start", () => {
  beforeEach(() => {
    vi.resetModules();
    boot.mockReset();
    delete (globalThis as { __fittContainer?: unknown }).__fittContainer;
    vi.stubGlobal("window", { crossOriginIsolated: true });
    vi.stubGlobal("location", { origin: "https://fitt-builder.test" });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reports the first failure to every later run and never boots again", async () => {
    boot.mockRejectedValueOnce(new Error("Failed to fetch")).mockRejectedValue(new Error("Unable to create more instances"));
    const { runProject } = await import("@/lib/webcontainer");
    const first = callbacks();
    const second = callbacks();
    await runProject(FILES, first);
    await runProject(FILES, second);
    expect(boot).toHaveBeenCalledTimes(1);
    for (const cb of [first, second]) {
      expect(cb.onError).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch"), "boot");
    }
  });

  it("tells the studio when warming the preview up fails", async () => {
    boot.mockRejectedValueOnce(new Error("Failed to fetch"));
    const { warmBoot } = await import("@/lib/webcontainer");
    const onError = vi.fn();
    warmBoot(onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringContaining("Failed to fetch")));
  });

  it("tells a failure after the start apart, so a retry stays possible", async () => {
    boot.mockResolvedValue({ mount: vi.fn().mockRejectedValue(new Error("disk full")) });
    const { runProject } = await import("@/lib/webcontainer");
    const cb = callbacks();
    await runProject(FILES, cb);
    expect(cb.onError).toHaveBeenCalledWith("disk full", "run");
  });
});

import { describe, expect, it } from "vitest";
import { pendingProjects, needsTeam } from "@/lib/deploy/pending";
import type { DeliveryRow, DeployEventRow } from "@/lib/deploy/types";

const cloud = (id: string): DeliveryRow => ({ project_id: id, target: "cloud", admin_email: "a@x.test", updated_at: "2026-10-18T00:00:00Z" });
let clock = 0;
const ev = (id: string, stage: DeployEventRow["stage"], build_no: number | null = 3): DeployEventRow => ({
  project_id: id, env: "uat", stage, build_no, digest: null, url: null, message: "", at: new Date(Date.UTC(2026, 9, 18, 0, 0, clock++)).toISOString(),
});

describe("pendingProjects", () => {
  it("waits for a cloud project with no UAT yet, or one still on its way", () => {
    expect(pendingProjects([cloud("a")], [])).toEqual(["a"]);
    expect(pendingProjects([cloud("a")], [ev("a", "registering")])).toEqual(["a"]);
    expect(pendingProjects([cloud("a")], [ev("a", "waiting_image", null)])).toEqual(["a"]);
  });

  it("stops once the newest event is ready", () => {
    expect(pendingProjects([cloud("a")], [ev("a", "failed"), ev("a", "ready")])).toEqual([]);
  });

  it("retries a failure until the same build has failed three times in a row", () => {
    expect(pendingProjects([cloud("a")], [ev("a", "failed"), ev("a", "failed")])).toEqual(["a"]);
    const three = [ev("a", "failed"), ev("a", "deploying"), ev("a", "failed"), ev("a", "failed")];
    expect(pendingProjects([cloud("a")], three)).toEqual([]);
    expect(needsTeam(three)).toBe(true);
    expect(pendingProjects([cloud("a")], [...three, ev("a", "failed", 4)])).toEqual(["a"]);
    expect(needsTeam([...three, ev("a", "failed", 4)])).toBe(false);
  });

  it("never lists a local project, and reads only UAT events", () => {
    expect(pendingProjects([{ ...cloud("a"), target: "local", admin_email: "" }], [])).toEqual([]);
    expect(pendingProjects([cloud("a")], [{ ...ev("a", "ready"), env: "production" }])).toEqual(["a"]);
  });
});

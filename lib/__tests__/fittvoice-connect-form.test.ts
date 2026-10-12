import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * A new Builder account has no workspace — there is no default one — so a
 * FITT Voice user who signed up from the consent page met "no workspace" and
 * no way on, not even back to FITT Voice. They can make one right there now,
 * and declining is always offered.
 */
vi.mock("@/app/v1/integrations/fittvoice/connect/actions", () => ({
  approveConnection: async () => null,
  denyConnection: async () => {},
  createWorkspace: async () => null,
}));

const { default: ConnectForm } = await import("@/app/v1/integrations/fittvoice/connect/ConnectForm");

const form = (workspaces: { id: string; name: string; role: "OWNER" | "ADMIN" | "MEMBER" }[]) =>
  renderToStaticMarkup(createElement(ConnectForm, { fields: { client_id: "fittvoice-sandbox" }, workspaces, clientName: "FITT Voice" }));

describe("the consent form", () => {
  it("offers to make a workspace when the account has none, and still lets them decline", () => {
    const html = form([]);
    expect(html).toContain("สร้าง workspace");
    expect(html).toContain('name="workspace_name"');
    expect(html).toContain("ไม่อนุญาต");
  });

  it("lists the workspaces there are, and does not offer to make one", () => {
    const html = form([{ id: "o1", name: "ทีมขาย", role: "OWNER" }]);
    expect(html).toContain("ทีมขาย");
    expect(html).not.toContain('name="workspace_name"');
    expect(html).toContain("ไม่อนุญาต");
  });
});

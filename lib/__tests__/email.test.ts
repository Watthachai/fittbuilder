import { expect, test } from "vitest";
import { buildInvitePayload, buildPartnerWelcomePayload } from "@/lib/email";

test("maps role and project into DMAIL variables", () => {
  const p = buildInvitePayload({
    to: "a@b.com", projectName: "Shop Demo", role: "editor",
    inviteLink: "https://app/join/x", senderName: "Watt",
  });
  expect(p.templateId).toBe("4b72b137-4124-4b4a-982b-a7b38d723547");
  expect(p.to).toEqual([{ email: "a@b.com", name: "a@b.com" }]);
  expect(p.variables.companyName).toBe("Shop Demo");
  expect(p.variables.roleText).toBe("Editor");
  expect(p.variables.branchName).toBe("-");
  expect(p.variables.invitationLink).toBe("https://app/join/x");
  expect(p.variables.senderName).toBe("Watt");
  expect(p.variables.year).toBe(new Date().getFullYear().toString());
  expect(buildInvitePayload({ to: "a@b.com", projectName: "X", role: "viewer", inviteLink: "l", senderName: "s" }).variables.roleText).toBe("Viewer");
});

test("a partner welcome names the email to sign in with and links to sign-in", () => {
  const p = buildPartnerWelcomePayload({
    to: "owner@partner.co.th", loginLink: "https://app/login", senderName: "ทีม FITT Builder",
  });
  expect(p.templateId).toBe("4b72b137-4124-4b4a-982b-a7b38d723547");
  expect(p.to).toEqual([{ email: "owner@partner.co.th", name: "owner@partner.co.th" }]);
  expect(p.subject).toContain("owner@partner.co.th");
  expect(p.variables.companyName).toBe("FITT Builder");
  expect(p.variables.roleText).toBe("Partner");
  expect(p.variables.invitationLink).toBe("https://app/login");
  expect(p.variables.senderName).toBe("ทีม FITT Builder");
});

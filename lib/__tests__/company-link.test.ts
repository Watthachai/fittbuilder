import { describe, expect, it } from "vitest";
import { companyHome, spentLinkView } from "../company-link";

describe("a company link somebody has already taken", () => {
  it("tells the person holding its role that they are in, not to ask for another", () => {
    expect(spentLinkView("approver", { signedIn: true, role: "approver" })).toBe("holds");
    expect(spentLinkView("approver", { signedIn: true, role: "admin" })).toBe("holds");
  });

  // Everyone on the company's email domain joins as staff by themselves, so being
  // in the company does not mean this link gave them anything.
  it("tells staff with a lesser role that it is gone, since they still need a link", () => {
    expect(spentLinkView("approver", { signedIn: true, role: "member" })).toBe("used");
    expect(spentLinkView("approver", { signedIn: true, role: "reviewer" })).toBe("used");
  });

  it("tells someone outside the company that it is gone", () => {
    expect(spentLinkView("approver", { signedIn: true, role: null })).toBe("used");
  });

  it("asks someone not signed in to sign in first: it may be theirs", () => {
    expect(spentLinkView("approver", { signedIn: false, role: null })).toBe("sign-in");
  });
});

describe("where a person of the company works", () => {
  it("sends those who decide on documents to the documents", () => {
    expect(companyHome("approver")).toEqual({ href: "/approvals", label: "ไปหน้าอนุมัติเอกสาร" });
    expect(companyHome("reviewer")).toEqual({ href: "/approvals", label: "ไปหน้าอนุมัติเอกสาร" });
  });

  it("sends everyone else to the company", () => {
    expect(companyHome("admin")).toEqual({ href: "/company", label: "ไปหน้าบริษัท" });
    expect(companyHome("member")).toEqual({ href: "/company", label: "ไปหน้าบริษัท" });
  });
});

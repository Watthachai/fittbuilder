import { describe, expect, it } from "vitest";
import {
  buildScreenIndexPrompt,
  hasScreenIndex,
  screenIndexCoverage,
  screenIndexEntries,
  screenSources,
} from "../screen-index";

const APP = `export default function App() {
  return (
    <div>
      <Sidebar />
      <div data-fitt-index style={{ display: "none" }}>
        <button data-fitt-screen="เข้าสู่ระบบ" onClick={() => setUser(null)} />
        <button data-fitt-screen="เอกสารทั้งหมด" onClick={() => { setUser(ADMIN); setPage("docs"); }} />
      </div>
    </div>
  );
}
`;

const PAGE = `export default function DocsPage() {
  return (
    <div data-fitt-index style={{ display: "none" }}>
      <button data-fitt-screen="สร้าง Report ทั้งหมด" data-fitt-modal onClick={() => setReport(true)} />
    </div>
  );
}
`;

describe("hasScreenIndex", () => {
  it("is true once any source file declares the container", () => {
    expect(hasScreenIndex({ "src/App.tsx": APP })).toBe(true);
  });

  it("is false for a project generated before the contract", () => {
    expect(hasScreenIndex({ "src/App.tsx": "export default () => <div />;" })).toBe(false);
    expect(hasScreenIndex(null)).toBe(false);
  });

  // The marker appearing in a README or a data fixture is not a door.
  it("only counts .tsx/.jsx sources", () => {
    expect(hasScreenIndex({ "README.md": "ใส่ data-fitt-index ใน App.tsx" })).toBe(false);
  });
});

describe("screenIndexEntries", () => {
  it("reads screens and modals across files, keeping them apart", () => {
    expect(screenIndexEntries({ "src/App.tsx": APP, "src/pages/DocsPage.tsx": PAGE })).toEqual([
      { name: "เข้าสู่ระบบ", modal: false },
      { name: "เอกสารทั้งหมด", modal: false },
      { name: "สร้าง Report ทั้งหมด", modal: true },
    ]);
  });

  // The model writes attributes in whatever order it likes; the whole tag is
  // matched so the modal flag is found on either side of the name.
  it("finds data-fitt-modal written before the name", () => {
    const src = `<button data-fitt-modal data-fitt-screen="เพิ่มผู้ใช้งาน" onClick={open} />`;
    expect(screenIndexEntries({ "src/pages/UsersPage.tsx": src })).toEqual([
      { name: "เพิ่มผู้ใช้งาน", modal: true },
    ]);
  });

  it("ignores a button that carries no name", () => {
    expect(screenIndexEntries({ "src/App.tsx": `<button onClick={x} />` })).toEqual([]);
  });

  it("returns nothing for a project without an index", () => {
    expect(screenIndexEntries({ "src/App.tsx": "const A = 1;" })).toEqual([]);
    expect(screenIndexEntries(null)).toEqual([]);
  });
});

/**
 * A real reported project: the index looked fine and the capture still came
 * back short. The file tree says how short — which is the whole point of
 * grading the index instead of trusting it.
 */
const ETAX: Record<string, string> = {
  "src/App.tsx": APP,
  "src/pages/LoginPage.tsx": "",
  "src/pages/CompanySelectionPage.tsx": "",
  "src/pages/EtaxDocumentsPage.tsx": "",
  "src/pages/EtaxCreatePage.tsx": "",
  "src/components/users/InviteUserModal.tsx": "",
  "src/components/users/SetRoleModal.tsx": "",
  "src/components/etax/create/EtaxCreateModals.tsx": "",
  "src/components/etax/detail/EtaxDetailHeader.tsx": "",
  "src/hooks/useEtaxAppState.ts": "",
};

describe("screenSources", () => {
  it("reads the screens and modals off the file tree", () => {
    const src = screenSources(ETAX);
    expect(src.pages).toEqual([
      "src/pages/CompanySelectionPage.tsx",
      "src/pages/EtaxCreatePage.tsx",
      "src/pages/EtaxDocumentsPage.tsx",
      "src/pages/LoginPage.tsx",
    ]);
    // Plural file names count too — XxxModals.tsx holds several.
    expect(src.modals).toEqual([
      "src/components/etax/create/EtaxCreateModals.tsx",
      "src/components/users/InviteUserModal.tsx",
      "src/components/users/SetRoleModal.tsx",
    ]);
  });

  it("does not mistake an ordinary component for a modal", () => {
    expect(screenSources(ETAX).modals).not.toContain(
      "src/components/etax/detail/EtaxDetailHeader.tsx"
    );
  });
});

describe("screenIndexCoverage", () => {
  it("counts the shortfall, so a partial index cannot pass as complete", () => {
    const c = screenIndexCoverage(ETAX);
    expect(c.present).toBe(true);
    expect(c.screens).toBe(2); // App declares เข้าสู่ระบบ + เอกสารทั้งหมด
    expect(c.expectedScreens).toBe(4);
    expect(c.modals).toBe(0);
    expect(c.expectedModals).toBe(3);
    expect(c.short).toBe(true);
  });

  it("is not short once every file has a door", () => {
    const c = screenIndexCoverage({
      "src/pages/OrdersPage.tsx": `<div data-fitt-index><button data-fitt-screen="ออเดอร์" /></div>`,
      "src/components/orders/NewOrderModal.tsx": "",
      "src/components/orders/OrderList.tsx": `<div data-fitt-index><button data-fitt-screen="เพิ่มออเดอร์" data-fitt-modal /></div>`,
    });
    expect(c.short).toBe(false);
  });

  it("reports a project with no index at all", () => {
    expect(screenIndexCoverage({ "src/pages/A.tsx": "" })).toMatchObject({
      present: false,
      screens: 0,
      expectedScreens: 1,
      short: true,
    });
  });
});

describe("buildScreenIndexPrompt", () => {
  it("hands the model the file checklist it will be graded against", () => {
    const p = buildScreenIndexPrompt(ETAX);
    expect(p).toContain("src/pages/EtaxCreatePage.tsx");
    expect(p).toContain("src/components/etax/create/EtaxCreateModals.tsx");
    // and tells it what is already there, so existing doors are not rewritten
    expect(p).toContain("ประกาศไว้แล้ว 2 หน้าจอ");
  });

  it("still works before any files exist", () => {
    expect(buildScreenIndexPrompt(null)).toContain("data-fitt-index");
  });
});

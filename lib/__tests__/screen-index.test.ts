import { describe, expect, it } from "vitest";
import { hasScreenIndex, screenIndexEntries } from "../screen-index";

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

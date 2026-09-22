import type { ProjectFiles } from "@/lib/types";
import type { Composition, MissingEntity, Module, QuoteLine } from "./types";
import { FAMILY_ORDER } from "./types";
import { UI_SOURCE } from "./sources";

/**
 * The app shell: navigation plus one route per selected module.
 *
 * The composer owns this file and modules never ship one. The only merge this
 * codebase had before was "later wins" over a flat path map, so two modules that
 * both wrote `src/App.tsx` would have left exactly one of them in the project with
 * no error to notice. Generating it here means the collision cannot be expressed.
 */
function shellFor(selected: Module[]): string {
  const imports = selected
    .map((m) => `import ${screenName(m)} from "./modules/${m.id}/screen";`)
    .join("\n");
  const entries = selected
    .map(
      (m) =>
        `  { id: "${m.id}", label: ${JSON.stringify(m.name)}, code: ${JSON.stringify(m.sapCode ?? "")},` +
        ` sections: ${JSON.stringify(m.keyFeatures)}, Screen: ${screenName(m)} },`
    )
    .join("\n");
  return `import { useState } from "react";
${imports}

const MODULES = [
${entries}
];

/**
 * Sidebar first, capability second — the shape of the system this was built from.
 * A screen renders one capability and is told which, so the navigation is the only
 * place that decides and a module can never disagree with the menu about what it
 * contains.
 */
export default function App() {
  const [moduleId, setModuleId] = useState(MODULES[0].id);
  const [section, setSection] = useState(MODULES[0].sections[0]);
  const current = MODULES.find((m) => m.id === moduleId);
  const Current = current.Screen;

  const open = (m) => {
    setModuleId(m.id);
    setSection(m.sections[0]);
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-600 text-[13px] font-bold text-white">
            F
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-slate-900">
              บจก. ตัวอย่างอุตสาหกรรม
            </span>
            <span className="block text-[11.5px] text-slate-500">ระบบบริหารทรัพยากรองค์กร</span>
          </span>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {MODULES.map((m) => (
            <div key={m.id}>
              <button
                onClick={() => open(m)}
                className={
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition " +
                  (m.id === moduleId
                    ? "font-medium text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900")
                }
              >
                <span className="min-w-0 truncate">{m.label}</span>
                <span className="shrink-0 text-[10.5px] text-slate-300">{m.code}</span>
              </button>

              {m.id === moduleId && (
                <ul className="mb-1 ml-2.5 border-l border-slate-200 pl-2">
                  {m.sections.map((s) => (
                    <li key={s}>
                      <button
                        onClick={() => setSection(s)}
                        className={
                          "block w-full rounded-md px-2 py-1.5 text-left text-[12.5px] transition " +
                          (s === section
                            ? "bg-sky-50 font-medium text-sky-700"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")
                        }
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-3">
          <p className="text-[13px] font-medium text-slate-900">{current.label}</p>
          <p className="text-[11.5px] text-slate-500">{section}</p>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <Current section={section} />
        </main>
      </div>
    </div>
  );
}
`;
}

/** A module id turned into a component identifier: `pa` → `PaScreen`. */
function screenName(m: Module): string {
  return `${m.id.charAt(0).toUpperCase()}${m.id.slice(1)}Screen`;
}

/**
 * Order the selection by data flow: a module comes after the ones it reads from.
 *
 * The picker is a grid of checkboxes, so click order is not a design decision and
 * must not reach the output — the same selection has to compose byte-identically
 * every time or a rebuild looks like a change. Sorting by dependency rather than
 * by name also gives the navigation an order a person would have chosen: personnel
 * records before payroll, because payroll reads what personnel owns. Ties are
 * broken by id, which is arbitrary but stable.
 */
function inDataFlowOrder(selected: Module[]): Module[] {
  // Family first so the nav reads as whole businesses, id second so the order is
  // stable. Data flow still wins: the readiness check below can only pick a module
  // whose needs are already met.
  const remaining = [...selected].sort(
    (a, b) =>
      FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) ||
      a.id.localeCompare(b.id)
  );
  const placed: Module[] = [];
  const satisfied = new Set<string>();
  while (remaining.length > 0) {
    const ready = remaining.findIndex((m) =>
      m.needs.every((e) => satisfied.has(e) || !remaining.some((o) => o.provides.includes(e)))
    );
    // A cycle leaves nothing ready; take the first so the function always returns.
    const next = remaining.splice(ready === -1 ? 0 : ready, 1)[0];
    for (const e of next.provides) satisfied.add(e);
    placed.push(next);
  }
  return placed;
}

/**
 * Scope, written for the document that reaches the production build.
 *
 * Naming who owns an entity is the point: without it a production build is free to
 * give payroll its own employee table, and the two screens drift apart on the first
 * edit that touches either one.
 */
function prdSectionFor(selected: Module[]): string {
  const owner = new Map<string, Module>();
  for (const m of selected) for (const e of m.provides) owner.set(e, m);

  const lines = selected.map((m) => {
    const reads = m.needs
      .map((e) => {
        const from = owner.get(e);
        return from ? `อ่าน \`${e}\` จาก${from.name}` : `อ่าน \`${e}\` (ยังไม่มีโมดูลที่เป็นเจ้าของ)`;
      })
      .join(" · ");
    const owns = m.provides.length > 0 ? `เป็นเจ้าของ \`${m.provides.join("`, `")}\`` : "";
    const rel = [owns, reads].filter(Boolean).join(" · ");
    return `### ${m.name}\n\n${m.pitch}\n\nขอบเขตงาน: ${m.build}\n\n${rel}`;
  });

  return `## โมดูลที่อยู่ในขอบเขต\n\n${lines.join("\n\n")}`;
}

/**
 * A module owns exactly one directory and may write nothing else.
 *
 * Throwing is right here because a module with a stray path is a mistake by
 * whoever authored the module, not by whoever selected it — and the failure it
 * would otherwise cause is invisible: the shell would be silently replaced and the
 * other modules would look like they had never been chosen.
 */
function assertOwnTerritory(m: Module): void {
  const dir = `src/modules/${m.id}/`;
  const stray = Object.keys(m.files).filter((path) => !path.startsWith(dir));
  if (stray.length > 0) {
    throw new Error(
      `โมดูล "${m.id}" เขียนไฟล์นอกอาณาเขตของตัวเอง: ${stray.join(", ")} — ` +
        `ไฟล์ของโมดูลต้องอยู่ใต้ ${dir} เท่านั้น ส่วนไฟล์ร่วมเป็นของตัวประกอบ`
    );
  }
}

/**
 * Turn a selection of modules into everything downstream needs from it.
 *
 * One pure function is the whole seam: modules in, answers out, no IO and no
 * React, so every composition rule is provable without mounting anything.
 */
export function composeModules(picked: Module[]): Composition {
  const selected = inDataFlowOrder(picked);
  const owned = new Set(selected.flatMap((m) => m.provides));
  const missing: MissingEntity[] = [];
  for (const m of selected) {
    for (const entity of m.needs) {
      if (!owned.has(entity)) missing.push({ moduleId: m.id, entity });
    }
  }

  const files: ProjectFiles = {};
  for (const m of selected) {
    assertOwnTerritory(m);
    Object.assign(files, m.files);
  }
  // Composer-owned, like the shell: shared by every screen, owned by no module.
  files["src/modules/ui.tsx"] = UI_SOURCE;
  files["src/App.tsx"] = shellFor(selected);

  const quoteLines: QuoteLine[] = selected.map((m) => ({
    moduleId: m.id,
    name: m.name,
    effortDays: m.effortDays,
    maPerMonth: m.maPerMonth,
  }));

  return {
    files,
    missing,
    prdSection: prdSectionFor(selected),
    quoteLines,
    totalEffortDays: quoteLines.reduce((n, l) => n + l.effortDays, 0),
    totalMaPerMonth: quoteLines.reduce((n, l) => n + l.maPerMonth, 0),
  };
}

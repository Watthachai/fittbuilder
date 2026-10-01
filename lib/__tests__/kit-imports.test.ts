import { describe, expect, it } from "vitest";
import { fixKitImports } from "../kit-imports";
import { KIT_SOURCES } from "../modules/sources";

/**
 * A generated page that imports a kit piece from the wrong kit file never loads:
 * "The requested module '/src/components/ui/ui.tsx' does not provide an export
 * named 'DetailModal'". The name exists — in kit.tsx — so the import is moved
 * there instead of the build failing.
 */
describe("fixKitImports", () => {
  it("moves a name imported from the wrong kit file to the file that exports it", () => {
    const page = `import { useState } from "react";
import { Card, DetailModal, PageHead } from "../components/ui/ui";
import { DataTable } from "../components/ui/kit";

export default function StaffPage() {}
`;
    expect(fixKitImports("src/pages/StaffPage.tsx", page, KIT_SOURCES)).toBe(`import { useState } from "react";
import { Card, PageHead } from "../components/ui/ui";
import { DetailModal } from "../components/ui/kit";
import { DataTable } from "../components/ui/kit";

export default function StaffPage() {}
`);
  });

  it("replaces the whole import when none of its names belong to that file", () => {
    const part = `import { FormModal, Field, notify } from "../ui/ui";\n`;
    expect(fixKitImports("src/components/leave/LeaveForm.tsx", part, KIT_SOURCES)).toBe(
      `import { FormModal, Field, notify } from "../ui/kit";\n`
    );
  });

  it("keeps aliases and type-only imports as they were written", () => {
    const page = `import type { Column, Tone } from "../components/ui/kit";
import { Badge, ConfirmDialog as Confirm, type Step } from "../components/ui/ui";
`;
    expect(fixKitImports("src/pages/A.tsx", page, KIT_SOURCES)).toBe(`import type { Column } from "../components/ui/kit";
import type { Tone } from "../components/ui/ui";
import { Badge } from "../components/ui/ui";
import { ConfirmDialog as Confirm, type Step } from "../components/ui/kit";
`);
  });

  it("drops a duplicate that the right file already provides", () => {
    const page = `import { Card, DetailModal } from "../components/ui/ui";
import { DetailModal, DataTable } from "../components/ui/kit";
`;
    expect(fixKitImports("src/pages/A.tsx", page, KIT_SOURCES)).toBe(`import { Card } from "../components/ui/ui";
import { DetailModal, DataTable } from "../components/ui/kit";
`);
  });

  it("leaves correct files, unknown names and non-kit imports untouched", () => {
    const page = `import { Card } from "../components/ui/ui";
import { Shell } from "./components/ui/shell";
import { NotAThing } from "../components/ui/ui";
import { Card as Other } from "../components/Card";
`;
    expect(fixKitImports("src/pages/A.tsx", page, KIT_SOURCES)).toBe(page);
  });

  it("does nothing in a project that has no kit", () => {
    const page = `import { DetailModal } from "../components/ui/ui";\n`;
    expect(fixKitImports("src/pages/A.tsx", page, {})).toBe(page);
  });
});

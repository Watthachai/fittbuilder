import { describe, expect, it } from "vitest";
import { appendDnaBlock } from "@/lib/org-dna";
import type { OrgDna } from "@/lib/types";

describe("appendDnaBlock", () => {
  it("appends to an empty block and records a version", () => {
    const out = appendDnaBlock({}, "decisionRights", "อนุมัติงบผ่าน 3 กรรมการ");
    expect(out.decisionRights).toBe("อนุมัติงบผ่าน 3 กรรมการ");
    expect(out.versions).toHaveLength(1);
    expect(out.versions![0].source).toBe("ai");
    expect(out.versions![0].snapshot.decisionRights).toBe("อนุมัติงบผ่าน 3 กรรมการ");
  });

  it("newline-joins when the block already has text and prepends the version", () => {
    const base: OrgDna = { information: "ข้อมูลอยู่ในไซโล", versions: [] };
    const out = appendDnaBlock(base, "information", "มี DataX เป็นศูนย์กลาง");
    expect(out.information).toBe("ข้อมูลอยู่ในไซโล\nมี DataX เป็นศูนย์กลาง");
    expect(out.versions).toHaveLength(1);
  });

  it("caps versions at MAX_DNA_VERSIONS (12)", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `v${i}`, createdAt: "2026-01-01T00:00:00Z", source: "ai" as const, snapshot: {},
    }));
    const out = appendDnaBlock({ versions: many }, "structure", "แยกเป็นบริษัทลูก");
    expect(out.versions).toHaveLength(12);
    expect(out.versions![0].snapshot.structure).toBe("แยกเป็นบริษัทลูก");
    expect(out.versions!.some((v) => v.id === "v11")).toBe(false);
  });
});

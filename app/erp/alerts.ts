import { MODULES } from "@/lib/modules/registry";
import type { Module } from "@/lib/modules/types";
import { upcoming } from "@/demo/modules/pa/data";
import { LEAVES, empName } from "@/demo/modules/tm/data";
import { MATERIALS } from "@/demo/modules/mm/data";
import { payables } from "@/demo/modules/fi/data";

export type Alert = {
  id: string;
  moduleId: string;
  title: string;
  detail: string;
  tone: "warn" | "bad" | "info";
  href: string;
};

/**
 * The bell reads the same data the screens do.
 *
 * A notification centre seeded with invented messages is set dressing — it says
 * nothing about the system and goes stale the moment the data moves. These are
 * derived, so clearing the underlying condition clears the alert.
 */
export function alertsFor(allowed: Module[]): Alert[] {
  const can = (id: string) => allowed.some((m) => m.id === id);
  const out: Alert[] = [];

  if (can("pa")) {
    for (const u of upcoming(60).filter((x) => x.tone !== "info").slice(0, 4)) {
      out.push({
        id: `pa-${u.employeeId}-${u.kind}`,
        moduleId: "pa",
        title: u.kind,
        detail: `${u.name} · อีก ${u.inDays} วัน (${u.date})`,
        tone: u.tone,
        href: "/erp/pa/2",
      });
    }
  }

  if (can("tm")) {
    const waiting = LEAVES.filter((l) => l.status === "รออนุมัติ");
    if (waiting.length > 0) {
      out.push({
        id: "tm-leaves",
        moduleId: "tm",
        title: "ใบลารออนุมัติ",
        detail: `${waiting.length} รายการ · ${waiting.slice(0, 2).map((l) => empName(l.employeeId)).join(", ")}`,
        tone: "warn",
        href: "/erp/tm/3",
      });
    }
  }

  if (can("mm")) {
    const low = MATERIALS.filter((m) => m.stock < m.reorder);
    if (low.length > 0) {
      out.push({
        id: "mm-stock",
        moduleId: "mm",
        title: "วัสดุต่ำกว่าจุดสั่งซื้อ",
        detail: `${low.length} รายการ · ${low.slice(0, 2).map((m) => m.name).join(", ")}`,
        tone: "warn",
        href: "/erp/mm/4",
      });
    }
  }

  if (can("fi")) {
    const late = payables().filter((p) => p.overdueDays > 0);
    if (late.length > 0) {
      out.push({
        id: "fi-payables",
        moduleId: "fi",
        title: "เจ้าหนี้เลยกำหนดชำระ",
        detail: `${late.length} ใบ · ${late[0].vendorName}`,
        tone: "bad",
        href: "/erp/fi/2",
      });
    }
  }

  return out;
}

export const moduleName = (id: string) => MODULES.find((m) => m.id === id)?.name ?? id;

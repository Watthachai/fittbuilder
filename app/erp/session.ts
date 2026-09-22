import type { ModuleFamily } from "@/lib/modules/types";

/**
 * Who is signed in decides which parts of the system open.
 *
 * A demo where every login sees everything teaches a buyer nothing: the first
 * question anyone asks about an ERP is "what will my payroll clerk be able to
 * open?". The unit of permission is the module — the same unit the marketplace
 * prices — not the family, because one family is one system and the whole point
 * of a system is that different people see different parts of it. Personnel and
 * payroll live in the same HR system; the HR officer opens the first and not the
 * second, and typing the URL by hand does not get them there either.
 */
export type RoleId = "admin" | "hr" | "payroll" | "ops" | "acct";

export interface Role {
  id: RoleId;
  name: string;
  title: string;
  email: string;
  /** Module ids this account may open. Everything else shows locked. */
  modules: string[];
}

export const ROLES: Role[] = [
  {
    id: "admin",
    name: "สมชาย รักดี",
    title: "ผู้ดูแลระบบ",
    email: "admin@demo.co.th",
    modules: ["pa", "om", "tm", "py", "mm", "pp", "sd", "wm", "fi", "co"],
  },
  {
    id: "hr",
    name: "กมลวรรณ ใจงาม",
    title: "ฝ่ายบุคคล",
    email: "hr@demo.co.th",
    // The HR system minus payroll: the same screens, one part withheld.
    modules: ["pa", "om", "tm"],
  },
  {
    id: "payroll",
    name: "ปรียา แก้วใส",
    title: "ฝ่ายเงินเดือน",
    email: "payroll@demo.co.th",
    // Payroll reads the register and the time data it pays from, and nothing else.
    modules: ["py", "pa", "tm"],
  },
  {
    id: "ops",
    name: "ธีรศักดิ์ พูลทรัพย์",
    title: "ฝ่ายปฏิบัติการ",
    email: "ops@demo.co.th",
    modules: ["mm", "pp", "sd", "wm"],
  },
  {
    id: "acct",
    name: "วิภาดา ศรีสุข",
    title: "ฝ่ายบัญชี",
    email: "acct@demo.co.th",
    modules: ["fi", "co", "mm", "sd"],
  },
];

/** Whether an account may open a module. The one question every gate asks. */
export const mayOpen = (role: Role, moduleId: string) => role.modules.includes(moduleId);

export const roleById = (id: string): Role | undefined => ROLES.find((r) => r.id === id);

/** Anything at all, as long as it is something — this is a demo, not a vault. */
export const DEMO_PASSWORD_HINT = "รหัสผ่านอะไรก็ได้";

const KEY = "fitt-erp-session";

export function readSession(): Role | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const id = window.localStorage.getItem(KEY);
    return id ? roleById(id) : undefined;
  } catch {
    return undefined;
  }
}

export function writeSession(id: RoleId) {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // A blocked store means the session lasts this tab. Nothing else breaks.
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Same as above: the in-memory state has already been cleared by the caller.
  }
}

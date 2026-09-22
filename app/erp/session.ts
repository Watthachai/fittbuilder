import type { ModuleFamily } from "@/lib/modules/types";

/**
 * Who is signed in decides what the sidebar contains.
 *
 * A demo where every login sees everything teaches a buyer nothing: the first
 * question anyone asks about an ERP is "what will my warehouse staff be able to
 * open?". So the role is the access rule, not decoration — a sales account has no
 * route to payroll, and typing the URL by hand does not get you one either.
 */
export type RoleId = "admin" | "hr" | "ops" | "acct";

export interface Role {
  id: RoleId;
  name: string;
  title: string;
  email: string;
  families: ModuleFamily[];
}

export const ROLES: Role[] = [
  {
    id: "admin",
    name: "สมชาย รักดี",
    title: "ผู้ดูแลระบบ",
    email: "admin@demo.co.th",
    families: ["hr", "logistics", "finance"],
  },
  {
    id: "hr",
    name: "กมลวรรณ ใจงาม",
    title: "ฝ่ายบุคคล",
    email: "hr@demo.co.th",
    families: ["hr"],
  },
  {
    id: "ops",
    name: "ธีรศักดิ์ พูลทรัพย์",
    title: "ฝ่ายปฏิบัติการ",
    email: "ops@demo.co.th",
    families: ["logistics"],
  },
  {
    id: "acct",
    name: "วิภาดา ศรีสุข",
    title: "ฝ่ายบัญชี",
    email: "acct@demo.co.th",
    families: ["logistics", "finance"],
  },
];

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

export type ChangeType = "feature" | "fix" | "improvement";

export interface ChangelogItem {
  type: ChangeType;
  text: string;
}

export interface ChangelogEntry {
  /** Semantic version (MAJOR.MINOR.PATCH). */
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  items: ChangelogItem[];
}

/** Badge label + theme class per change type (used by the /changelog page). */
export const CHANGE_BADGE: Record<ChangeType, { label: string; className: string }> = {
  feature: { label: "ใหม่", className: "bg-shine/15 text-shine" },
  fix: { label: "แก้ไข", className: "bg-halt/15 text-halt" },
  improvement: { label: "ปรับปรุง", className: "bg-go/15 text-go" },
};

// Newest first. SemVer: fix → PATCH, feature → MINOR, breaking → MAJOR.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.7.0",
    date: "2026-06-23",
    title: "แอดมินสร้าง Skill Template เองได้",
    items: [
      { type: "feature", text: "แอดมินสร้าง/แก้ไขโดเมนใหม่เองได้ที่ /admin/skills (ฟอร์มครบ + ตัวสร้างคำถาม)" },
      { type: "feature", text: 'โดเมนที่ "เผยแพร่" แล้วจะโผล่ให้ผู้ใช้เลือกใน dropdown และระบบเดาโดเมนอัตโนมัติ' },
      { type: "improvement", text: "เพิ่มโดเมนเฉพาะทางได้โดยไม่ต้อง deploy โค้ดใหม่" },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-06-22",
    title: "AI Skill Templates เฉพาะโดเมน + ลูกเล่นใหม่",
    items: [
      { type: "feature", text: 'เลือก "ประเภท" ของ demo ได้ (ERP, CRM, E-commerce, Dashboard, ระบบจอง, Landing) — AI สวมบทผู้เชี่ยวชาญโดเมนนั้น' },
      { type: "feature", text: "ERP ลึกพิเศษ: ถามเรื่อง PR→PO→GR→อนุมัติ และใส่ข้อมูลตัวอย่างสมจริงลงใน demo" },
      { type: "feature", text: "AI เดาโดเมนจากสิ่งที่พิมพ์ให้อัตโนมัติ + เมนู dropdown เลือกเองได้" },
      { type: "improvement", text: "พิมพ์ prompt ได้ยาวขึ้นถึง 10,000 ตัวอักษร" },
      { type: "improvement", text: 'หน้าแรกมีอนิเมชันเลื่อนเข้าแบบลื่นๆ และเมนู "+" รวมตัวเลือก' },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-22",
    title: "บัญชีผู้ใช้ + เก็บงานบนคลาวด์ + แชร์ทีม",
    items: [
      { type: "feature", text: "เข้าสู่ระบบด้วย Google หรือ magic link + เมนูบัญชีผู้ใช้ พร้อมปุ่มออกจากระบบ" },
      { type: "feature", text: "โปรเจกต์เก็บบนคลาวด์ เปิดต่อข้ามเครื่อง/อุปกรณ์ได้" },
      { type: "feature", text: 'หน้า "ผลงานของฉัน" แยกเป็น งานของฉัน และ แชร์กับฉัน' },
      { type: "feature", text: "แชร์โปรเจกต์ให้ทีมด้วยลิงก์ หรือเชิญทางอีเมล (viewer/editor) — ส่งอีเมลเชิญจริง" },
      { type: "feature", text: 'หน้า "มีอะไรใหม่" พร้อมจุดแจ้งเตือนเมื่อมีอัปเดตใหม่' },
    ],
  },
];

export function latestVersion(): string {
  return CHANGELOG[0].version;
}

export function isChangelogUnseen(lastSeen: string | null): boolean {
  return lastSeen !== latestVersion();
}

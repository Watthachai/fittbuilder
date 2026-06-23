export interface ChangelogEntry {
  /** Semantic version (MAJOR.MINOR.PATCH). */
  version: string;
  date: string;   // YYYY-MM-DD
  title: string;
  body: string;   // markdown
}

// Newest first. SemVer: fix → PATCH, feature → MINOR, breaking → MAJOR.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.6.0",
    date: "2026-06-22",
    title: "AI Skill Templates เฉพาะโดเมน + ลูกเล่นใหม่",
    body: [
      "- เลือก \"ประเภท\" ของ demo ได้ (ERP, CRM, E-commerce, Dashboard, ระบบจอง, Landing) — AI สวมบทผู้เชี่ยวชาญโดเมนนั้น",
      "- ERP ลึกพิเศษ: ถามเรื่อง PR→PO→GR→อนุมัติ และใส่ข้อมูลตัวอย่างสมจริงลงใน demo",
      "- AI เดาโดเมนจากสิ่งที่พิมพ์ให้อัตโนมัติ + เมนู dropdown เลือกเองได้",
      "- พิมพ์ prompt ได้ยาวขึ้นถึง 10,000 ตัวอักษร",
      "- หน้าแรกมีอนิเมชันเลื่อนเข้าแบบลื่นๆ และเมนู \"+\" รวมตัวเลือก",
    ].join("\n"),
  },
  {
    version: "0.5.0",
    date: "2026-06-22",
    title: "บัญชีผู้ใช้ + เก็บงานบนคลาวด์ + แชร์ทีม",
    body: [
      "- เข้าสู่ระบบด้วย Google หรือ magic link + เมนูบัญชีผู้ใช้ พร้อมปุ่มออกจากระบบ",
      "- โปรเจกต์เก็บบนคลาวด์ เปิดต่อข้ามเครื่อง/อุปกรณ์ได้",
      "- หน้า \"ผลงานของฉัน\" แยกเป็น งานของฉัน และ แชร์กับฉัน",
      "- แชร์โปรเจกต์ให้ทีมด้วยลิงก์ หรือเชิญทางอีเมล (viewer/editor) — ส่งอีเมลเชิญจริง",
      "- หน้า \"มีอะไรใหม่\" พร้อมจุดแจ้งเตือนเมื่อมีอัปเดตใหม่",
    ].join("\n"),
  },
];

export function latestVersion(): string {
  return CHANGELOG[0].version;
}

export function isChangelogUnseen(lastSeen: string | null): boolean {
  return lastSeen !== latestVersion();
}

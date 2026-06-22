export interface ChangelogEntry {
  version: string;
  date: string;   // YYYY-MM-DD
  title: string;
  body: string;   // markdown
}

// Newest first.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2026.06.22",
    date: "2026-06-22",
    title: "บัญชีผู้ใช้ + เก็บงานบนคลาวด์ + แชร์ทีม",
    body: [
      "- เข้าสู่ระบบด้วย Google หรือ magic link",
      "- เมนูบัญชีผู้ใช้ (รูปโปรไฟล์ + ชื่อ) พร้อมปุ่มออกจากระบบ",
      "- โปรเจกต์เก็บบนคลาวด์ เปิดต่อข้ามเครื่อง/อุปกรณ์ได้",
      "- หน้า \"ผลงานของฉัน\" แยกเป็น งานของฉัน และ แชร์กับฉัน",
      "- แชร์โปรเจกต์ให้ทีมด้วยลิงก์ หรือเชิญทางอีเมล (สิทธิ์ viewer/editor) — ส่งอีเมลเชิญจริง",
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

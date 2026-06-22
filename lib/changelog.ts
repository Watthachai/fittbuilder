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
      "- โปรเจกต์เก็บบนคลาวด์ เปิดข้ามเครื่องได้",
      "- แชร์โปรเจกต์ให้ทีมด้วยลิงก์หรืออีเมล (viewer/editor)",
    ].join("\n"),
  },
];

export function latestVersion(): string {
  return CHANGELOG[0].version;
}

export function isChangelogUnseen(lastSeen: string | null): boolean {
  return lastSeen !== latestVersion();
}

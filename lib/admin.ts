/**
 * Admin gating via the ADMIN_EMAILS env (comma-separated). Each entry is either a
 * full email (exact, case-insensitive match) or a "@domain" suffix that matches any
 * email at that domain. Server-only — never gate the UI on this alone.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  if (!target) return false;
  const entries = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return entries.some((entry) =>
    entry.startsWith("@") ? target.endsWith(entry) : target === entry
  );
}

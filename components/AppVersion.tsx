import { latestVersion } from "@/lib/changelog";

/**
 * The version this page was built from, beside the wordmark on every screen —
 * so "ตอนนี้เวอร์ชันไหน" needs no trip to the changelog, and a report or a
 * screenshot says which build it came from (case #7). Opens the changelog in a
 * new tab: someone mid-build should not lose the studio to read it.
 */
export default function AppVersion({ className = "" }: { className?: string }) {
  return (
    <a
      href="/changelog"
      target="_blank"
      rel="noreferrer"
      title="มีอะไรใหม่ · changelog"
      className={`shrink-0 font-mono text-[11px] text-chalk/45 transition hover:text-chalk/80 ${className}`}
    >
      v{latestVersion()}
    </a>
  );
}

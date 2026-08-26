"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/current-user";
import { CHANGE_BADGE, CHANGELOG, latestVersion } from "@/lib/changelog";

export default function ChangelogPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await currentUser();
      if (user) {
        await supabase
          .from("fittbuilder_profiles")
          .update({ last_seen_changelog: latestVersion() })
          .eq("id", user.id);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-night text-chalk px-6 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Back — the page is reached from a "what's new" nudge and from a
            direct link, so offer both: history when there is any, home as the
            floor so the button never dead-ends. */}
        <button
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          className="mb-8 inline-flex items-center gap-1.5 rounded-full border border-chalk/15 px-3 py-1.5 text-[13px] text-chalk/70 transition hover:border-shine/60 hover:text-chalk"
        >
          <ArrowLeft size={14} /> ย้อนกลับ
        </button>

        <h1 className="mb-8 text-3xl font-semibold">มีอะไรใหม่</h1>

        {/* Timeline: one continuous line down the left, a dot per release. */}
        <div className="relative space-y-10 border-l border-chalk/15 pl-7">
          {CHANGELOG.map((e, idx) => (
            <article key={e.version} className="relative">
              {/* The dot sits on the line (line is 1px at left:-1px from pl-7). */}
              <span
                className={`absolute -left-[33px] top-1.5 size-3 rounded-full border-2 border-night ${
                  idx === 0 ? "bg-shine" : "bg-chalk/30"
                }`}
                aria-hidden="true"
              />
              <div className="flex items-center gap-2 text-sm text-chalk/50">
                <span>{e.date}</span>
                <span className="text-chalk/25">·</span>
                <span className="font-mono">v{e.version}</span>
                {idx === 0 && (
                  <span className="rounded-full bg-shine/15 px-2 py-0.5 text-[11px] font-medium text-shine">
                    ล่าสุด
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-xl font-medium">{e.title}</h2>
              <ul className="mt-3 space-y-2">
                {e.items.map((item, i) => {
                  const badge = CHANGE_BADGE[item.type];
                  return (
                    <li key={i} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-[15px] leading-relaxed text-chalk/80">{item.text}</span>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

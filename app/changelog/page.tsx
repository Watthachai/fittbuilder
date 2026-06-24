"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CHANGE_BADGE, CHANGELOG, latestVersion } from "@/lib/changelog";

export default function ChangelogPage() {
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("fittbuilder_profiles")
          .update({ last_seen_changelog: latestVersion() })
          .eq("id", user.id);
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-night text-chalk px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-10">
        <h1 className="text-3xl font-semibold">มีอะไรใหม่</h1>
        {CHANGELOG.map((e) => (
          <article key={e.version} className="space-y-3 border-b border-chalk/10 pb-8">
            <div className="text-sm text-chalk/50">{e.date} · v{e.version}</div>
            <h2 className="text-xl font-medium">{e.title}</h2>
            <ul className="space-y-2">
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
    </main>
  );
}

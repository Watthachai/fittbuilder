"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { CHANGELOG, latestVersion } from "@/lib/changelog";
import Markdown from "@/components/studio/Markdown";

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
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-10">
        <h1 className="text-3xl font-semibold">มีอะไรใหม่</h1>
        {CHANGELOG.map((e) => (
          <article key={e.version} className="space-y-2 border-b border-white/10 pb-8">
            <div className="text-sm text-white/50">{e.date} · v{e.version}</div>
            <h2 className="text-xl font-medium">{e.title}</h2>
            <Markdown>{e.body}</Markdown>
          </article>
        ))}
      </div>
    </main>
  );
}

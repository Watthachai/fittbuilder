"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { joinProject } from "./actions";

/**
 * Accept button for a signed-in invitee. The server action does the join and
 * redirects into the project; on failure it returns a message we surface here.
 */
export default function AcceptInvite({ token }: { token: string }) {
  const [error, action, pending] = useActionState(joinProject, null);

  return (
    <form action={action} className="mt-7">
      <input type="hidden" name="token" value={token} />
      <button
        disabled={pending}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-shine py-3 font-display text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
      >
        {pending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-night/30 border-t-night" />
        ) : null}
        {pending ? "กำลังเข้าร่วม…" : "ตอบรับคำเชิญ"}
        {!pending && (
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        )}
      </button>
      {error && <p className="mt-3 text-center text-sm text-halt">{error}</p>}
    </form>
  );
}

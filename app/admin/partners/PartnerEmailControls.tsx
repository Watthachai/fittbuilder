"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { addPartnerEmail, removePartnerEmail, resendPartnerEmail, type PartnerNotice } from "./actions";

/**
 * The buttons of /admin/partners. Each is a form posting to a server action;
 * the page re-renders from the database after it, so none of them keeps state
 * beyond the message of the last attempt.
 */

function Notice({ notice, className }: { notice: PartnerNotice; className: string }) {
  if (!notice) return null;
  return <p className={`${className} ${notice.tone === "ok" ? "text-go" : "text-halt"}`}>{notice.text}</p>;
}

export function AddPartnerEmail() {
  const [notice, action, pending] = useActionState(addPartnerEmail, null);
  return (
    <form action={action}>
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-night-edge bg-night px-3 focus-within:border-shine">
          <Mail size={13} className="shrink-0 text-chalk-dim" />
          <input
            type="email"
            name="email"
            required
            placeholder="email@company.com"
            className="min-w-0 flex-1 bg-transparent py-2 font-mono text-xs text-chalk outline-none placeholder:text-chalk-dim/50"
          />
        </div>
        <button
          disabled={pending}
          className="rounded-lg bg-shine px-3 py-2 font-display text-xs font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
        >
          {pending ? "กำลังเพิ่ม…" : "เพิ่ม Partner"}
        </button>
      </div>
      <Notice notice={notice} className="mt-2 text-xs" />
    </form>
  );
}

/** On a request's row: puts the email it was sent from on the list and marks the request won. */
export function GrantLeadButton({ email, leadId }: { email: string; leadId: string }) {
  const [notice, action, pending] = useActionState(addPartnerEmail, null);
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="lead_id" value={leadId} />
      <button
        disabled={pending}
        className="whitespace-nowrap rounded-lg border border-shine/50 px-2.5 py-1 font-display text-[12px] font-medium text-shine transition hover:bg-shine/10 disabled:opacity-40"
      >
        {pending ? "กำลังให้สิทธิ์…" : "ให้สิทธิ์ Partner"}
      </button>
      <Notice notice={notice} className="mt-1 text-[11px]" />
    </form>
  );
}

export function RemovePartnerEmail({ email }: { email: string }) {
  const [notice, action, pending] = useActionState(removePartnerEmail, null);
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <button
        disabled={pending}
        className="whitespace-nowrap rounded-lg px-2 py-1 text-[12px] text-chalk-dim transition hover:bg-halt/10 hover:text-halt disabled:opacity-40"
      >
        {pending ? "กำลังยกเลิก…" : "ยกเลิกสิทธิ์"}
      </button>
      <Notice notice={notice} className="mt-1 text-[11px]" />
    </form>
  );
}

/** On a partner's row: mail the sign-in link again, for one who cannot find the first. */
export function ResendPartnerEmail({ email }: { email: string }) {
  const [notice, action, pending] = useActionState(resendPartnerEmail, null);
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <button
        disabled={pending}
        className="whitespace-nowrap rounded-lg px-2 py-1 text-[12px] text-chalk-dim transition hover:bg-shine/10 hover:text-shine disabled:opacity-40"
      >
        {pending ? "กำลังส่ง…" : "ส่งอีเมลอีกครั้ง"}
      </button>
      <Notice notice={notice} className="mt-1 text-[11px]" />
    </form>
  );
}

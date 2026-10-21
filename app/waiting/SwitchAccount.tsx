"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Sign out and go back to the sign-in screen, to come back as the invited email. */
export default function SwitchAccount() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function switchAccount() {
    setBusy(true);
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={switchAccount}
      disabled={busy}
      className="inline-flex flex-1 items-center justify-center rounded-xl bg-shine py-3 font-display text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
    >
      {busy ? "กำลังออก…" : "เข้าด้วยอีเมลอื่น"}
    </button>
  );
}

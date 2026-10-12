"use client";

import { useActionState, useState } from "react";
import { Check, Plus } from "lucide-react";
import type { ConnectionRole } from "@/lib/fittvoice/connect";
import { approveConnection, createWorkspace, denyConnection } from "./actions";

const ROLE_LABEL: Record<ConnectionRole, string> = { OWNER: "เจ้าของ", ADMIN: "ผู้ดูแล", MEMBER: "สมาชิก" };

/**
 * Pick the workspace FITT Voice may send into, then allow or decline. With one
 * workspace it is picked already; with several the person chooses, and the
 * allow button says why it waits rather than sitting grey. An account with no
 * workspace — every new one — makes its first here and carries on.
 */
export default function ConnectForm({
  fields,
  workspaces,
  clientName,
}: {
  fields: Record<string, string>;
  workspaces: { id: string; name: string; role: ConnectionRole }[];
  clientName: string;
}) {
  const [error, approve, pending] = useActionState(approveConnection, null);
  const [list, setList] = useState(workspaces);
  const [orgId, setOrgId] = useState(workspaces.length === 1 ? workspaces[0].id : "");
  const [made, make, making] = useActionState(
    async (prev: Awaited<ReturnType<typeof createWorkspace>> | null, formData: FormData) => {
      const result = await createWorkspace(prev, formData);
      if ("workspace" in result) {
        setList([{ ...result.workspace, role: "OWNER" }]);
        setOrgId(result.workspace.id);
      }
      return result;
    },
    null
  );

  if (list.length === 0) {
    return (
      <div className="mt-6 text-left">
        <form action={make}>
          <p className="text-sm leading-relaxed text-chalk">
            บัญชีนี้ยังไม่มี workspace — สร้างก่อน แล้ว {clientName} จะส่งงานเข้า workspace นี้
          </p>
          <div className="mt-3 flex gap-2">
            <input
              name="workspace_name"
              required
              maxLength={80}
              placeholder="ชื่อ workspace เช่น ทีมขาย"
              aria-label="ชื่อ workspace"
              className="min-w-0 flex-1 rounded-xl border border-night-edge bg-night px-3.5 py-2.5 text-sm text-chalk outline-none transition focus:border-shine"
            />
            <button
              type="submit"
              disabled={making}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-shine px-4 font-display text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
            >
              <Plus size={14} /> สร้าง workspace
            </button>
          </div>
          {made && "error" in made && <p className="mt-2 text-sm text-halt">{made.error}</p>}
        </form>
        <form action={denyConnection}>
          {Object.entries(fields).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <button
            type="submit"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-chalk/15 bg-chalk/[0.03] py-3 font-display text-sm font-medium text-chalk transition hover:border-chalk/30 hover:bg-chalk/[0.06]"
          >
            ไม่อนุญาต
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={approve} className="mt-6 text-left">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <fieldset>
        <legend className="font-display text-sm font-medium text-chalk">ส่งงานเข้า workspace ไหน</legend>
        <div className="mt-2.5 flex flex-col gap-2">
          {list.map((w) => (
            <label
              key={w.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
                orgId === w.id ? "border-shine/70 bg-shine/[0.06]" : "border-night-edge hover:border-chalk/25"
              }`}
            >
              <input
                type="radio"
                name="org_id"
                value={w.id}
                checked={orgId === w.id}
                onChange={() => setOrgId(w.id)}
                className="sr-only"
              />
              <span
                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                  orgId === w.id ? "border-shine bg-shine text-night" : "border-chalk/30"
                }`}
              >
                {orgId === w.id && <Check size={10} strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-chalk">{w.name}</span>
              <span className="shrink-0 text-xs text-chalk-dim">{ROLE_LABEL[w.role]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={!orgId || pending}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-shine py-3 font-display text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
      >
        {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-night/30 border-t-night" />}
        {pending ? "กำลังเชื่อม…" : `อนุญาตให้ ${clientName} เชื่อม`}
      </button>
      {!orgId && <p className="mt-2 text-center text-xs text-chalk-dim">เลือก workspace ก่อน แล้วปุ่มนี้จะกดได้</p>}
      <button
        type="submit"
        formAction={denyConnection}
        formNoValidate
        disabled={pending}
        className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-chalk/15 bg-chalk/[0.03] py-3 font-display text-sm font-medium text-chalk transition hover:border-chalk/30 hover:bg-chalk/[0.06] disabled:opacity-50"
      >
        ไม่อนุญาต
      </button>
      {error && <p className="mt-3 text-center text-sm text-halt">{error}</p>}
    </form>
  );
}

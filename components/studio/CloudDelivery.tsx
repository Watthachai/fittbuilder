"use client";

import { useCallback, useEffect, useState } from "react";
import { Cloud, Copy, ExternalLink, HardDrive, KeyRound, Loader2, Save } from "lucide-react";
import { toast } from "@/lib/toast";

/**
 * "ส่งแบบ local หรือ cloud" in the export dialog. Local delivers files and an
 * image to install at the customer's; cloud makes Code Runner put the app on UAT
 * in GCP by itself. The choice belongs to the project and stays for the next
 * export; switching to cloud later needs no new build. Below it, what Code
 * Runner's deploy side last did, the UAT link, and the first administrator's
 * password, shown once.
 */

export type DeliveryTarget = "local" | "cloud";
export interface DeliveryChoice {
  target: DeliveryTarget;
  admin_email: string;
}
type Stage = "waiting_image" | "registering" | "deploying" | "ready" | "failed";
interface DeployEvent {
  env: "uat" | "production";
  stage: Stage;
  build_no: number | null;
  url: string | null;
  message: string;
  at: string;
}
interface CloudState extends DeliveryChoice {
  events: { uat: DeployEvent | null; production: DeployEvent | null };
  needs_team: boolean;
  password_waiting: { uat: boolean; production: boolean };
}

const STAGE: Record<Stage, string> = {
  waiting_image: "รอ image จาก build",
  registering: "กำลังเตรียมฐานข้อมูล",
  deploying: "กำลังขึ้นระบบ",
  ready: "พร้อมใช้",
  failed: "ล้มเหลว",
};
const ENV_LABEL = { uat: "UAT", production: "Production" } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Saves the project's choice. Returns an error message, or null when saved. */
export async function saveDelivery(projectId: string, choice: DeliveryChoice): Promise<string | null> {
  if (choice.target === "cloud" && !EMAIL.test(choice.admin_email.trim())) return "ส่งแบบ cloud ต้องกรอกอีเมลผู้ดูแลคนแรกให้ถูกต้อง";
  try {
    const res = await fetch(`/api/projects/${projectId}/cloud`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(choice),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return data.error ?? `บันทึกวิธีส่งไม่สำเร็จ (HTTP ${res.status})`;
  } catch {
    return "บันทึกวิธีส่งไม่สำเร็จ ลองใหม่อีกครั้ง";
  }
}

export default function CloudDelivery({
  projectId,
  value,
  onChange,
  editable,
}: {
  projectId: string;
  value: DeliveryChoice;
  onChange: (next: DeliveryChoice) => void;
  /** False after the build was sent: the choice is shown, not changed, here. */
  editable: boolean;
}) {
  const [state, setState] = useState<CloudState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState<{ env: "uat" | "production"; value: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/cloud`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as CloudState;
      setState(data);
      return data;
    } catch {
      return null;
    }
  }, [projectId]);

  // First load: the dialog starts from what the project chose last time.
  useEffect(() => {
    let alive = true;
    void refresh().then((data) => {
      if (!alive) return;
      if (data) onChange({ target: data.target, admin_email: data.admin_email });
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
    // onChange is the parent's setter; loading once per project is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // While something is on its way, look again every 15 seconds.
  const busy = [state?.events.uat, state?.events.production].some((e) => e && e.stage !== "ready" && e.stage !== "failed");
  useEffect(() => {
    if (!busy && !(state?.target === "cloud" && !state.events.uat)) return;
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [busy, state?.target, state?.events.uat, refresh]);

  const saveOnly = async () => {
    setSaving(true);
    const error = await saveDelivery(projectId, value);
    setSaving(false);
    if (error) return toast.error(error);
    toast.success(value.target === "cloud" ? "บันทึกแล้ว — ถ้ามี build อยู่แล้ว ระบบจะขึ้น UAT ให้ภายใน 5 นาที" : "บันทึกแล้ว — ส่งแบบ local");
    void refresh();
  };

  const reveal = async (env: "uat" | "production") => {
    const res = await fetch(`/api/projects/${projectId}/cloud/initial-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ env }),
    });
    const data = (await res.json().catch(() => ({}))) as { password?: string; error?: string };
    if (!res.ok || !data.password) {
      toast.error(data.error ?? "แสดงรหัสผ่านไม่สำเร็จ");
    } else {
      setPassword({ env, value: data.password });
    }
    void refresh();
  };

  const choice = (target: DeliveryTarget, icon: React.ReactNode, title: string, note: string) => (
    <button
      type="button"
      disabled={!editable || !loaded}
      onClick={() => onChange({ ...value, target })}
      className={`flex flex-1 items-start gap-2 rounded-lg border px-3 py-2 text-left transition disabled:cursor-default ${
        value.target === target ? "border-shine bg-shine/[0.06]" : "border-night-edge bg-night hover:border-chalk-dim"
      }`}
      aria-pressed={value.target === target}
    >
      <span className={`mt-0.5 ${value.target === target ? "text-shine" : "text-chalk-dim"}`}>{icon}</span>
      <span>
        <span className="block font-display text-xs font-semibold text-chalk">{title}</span>
        <span className="block text-[11px] text-chalk-dim">{note}</span>
      </span>
    </button>
  );

  return (
    <div className="mb-4 rounded-lg border border-night-edge bg-night-panel p-3">
      <p className="mb-2 font-display text-xs font-semibold text-chalk-dim">ส่งแบบ</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {choice("local", <HardDrive size={14} />, "local", "ได้ไฟล์และ image ไปติดตั้งที่เครื่องลูกค้า")}
        {choice("cloud", <Cloud size={14} />, "cloud", "ขึ้น UAT บน GCP ให้ (สิงคโปร์)")}
      </div>

      {value.target === "cloud" ? (
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] text-chalk-dim">อีเมลผู้ดูแลคนแรก (ใช้ล็อกอินครั้งแรกในแอป)</span>
          <input
            type="email"
            value={value.admin_email}
            disabled={!editable}
            onChange={(e) => onChange({ ...value, admin_email: e.target.value })}
            placeholder="admin@customer.co.th"
            className="w-full rounded-lg border border-night-edge bg-night px-3 py-1.5 text-[13px] text-chalk outline-none focus:border-shine disabled:opacity-70"
          />
        </label>
      ) : null}

      {editable && loaded && (value.target !== (state?.target ?? "local") || value.admin_email.trim().toLowerCase() !== (state?.admin_email ?? "")) ? (
        <button
          type="button"
          onClick={() => void saveOnly()}
          disabled={saving}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-3 py-1.5 text-[12px] text-chalk-dim transition hover:border-shine hover:text-chalk disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} บันทึกโดยไม่ build ใหม่
        </button>
      ) : null}

      {state && (state.events.uat || state.events.production || state.target === "cloud") ? (
        <div className="mt-3 space-y-2 border-t border-night-edge pt-3">
          {(["uat", "production"] as const).map((env) => {
            const e = state.events[env];
            if (!e && env === "production") return null;
            return (
              <div key={env} className="text-[12px]">
                <p className="text-chalk">
                  <span className="font-mono text-[11px] text-chalk-dim">{ENV_LABEL[env]}</span>{" "}
                  {e ? (
                    <>
                      <span className={e.stage === "failed" ? "text-halt" : e.stage === "ready" ? "text-go" : "text-chalk"}>{STAGE[e.stage]}</span>
                      {e.build_no !== null ? <span className="text-chalk-dim"> · build #{e.build_no}</span> : null}
                      <span className="text-chalk-dim"> · {new Date(e.at).toLocaleString("th-TH")}</span>
                    </>
                  ) : (
                    <span className="text-chalk-dim">ยังไม่ขึ้น — จะเริ่มเมื่อมี image จาก build</span>
                  )}
                </p>
                {e?.stage === "ready" && e.url ? (
                  <a href={e.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-shine hover:underline">
                    {e.url} <ExternalLink size={11} />
                  </a>
                ) : null}
                {e?.stage === "failed" ? (
                  <p className="mt-0.5 whitespace-pre-wrap text-[11px] text-chalk-dim">
                    {e.message}
                    {env === "uat" ? (state.needs_team ? "\nต้องให้ทีมดู: ระบบหยุดลองแล้ว" : "\nระบบจะลองใหม่เองใน 5 นาที") : ""}
                  </p>
                ) : null}
                {state.password_waiting[env] ? (
                  <button
                    type="button"
                    onClick={() => void reveal(env)}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1 text-[11px] text-chalk-dim transition hover:border-shine hover:text-chalk"
                  >
                    <KeyRound size={12} /> แสดงรหัสผ่านครั้งแรก
                  </button>
                ) : null}
                {password?.env === env ? (
                  <div className="mt-1 rounded-lg border border-shine/40 bg-shine/[0.06] px-3 py-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all font-mono text-[12px] text-chalk">{password.value}</code>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(password.value).then(() => toast.success("คัดลอกแล้ว"))}
                        className="text-chalk-dim hover:text-chalk"
                        aria-label="คัดลอกรหัสผ่าน"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-chalk-dim">แสดงครั้งเดียว ส่งต่อทางช่องทางลับ · ผู้ดูแลควรเปลี่ยนรหัสหลังล็อกอินครั้งแรก</p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

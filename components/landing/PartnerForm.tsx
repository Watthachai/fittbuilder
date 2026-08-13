"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

/**
 * The application form.
 *
 * Five fields, three of them required — an enquiry form that asks for a company
 * size, a budget range and a timeline is a qualification form, and people close
 * those. What we need to call someone back is a name, a company and a way to
 * reach them; the rest is a conversation.
 */
export default function PartnerForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/partner-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(data.get("name") ?? ""),
          company: String(data.get("company") ?? ""),
          email: String(data.get("email") ?? ""),
          phone: String(data.get("phone") ?? ""),
          note: String(data.get("note") ?? ""),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง");
        return;
      }
      setSent(true);
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-3xl border border-go/40 bg-go/10 p-8 text-center backdrop-blur-xl">
        <CheckCircle2 size={30} className="mx-auto text-go" />
        <h3 className="mt-3 font-display text-xl font-semibold text-chalk">ได้รับเรื่องแล้ว</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-chalk/70">
          ทีมงานจะติดต่อกลับภายใน 2 วันทำการ เพื่อคุยเรื่องขอบเขตงานและเงื่อนไขที่เหมาะกับบริษัทคุณ
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-chalk/12 bg-chalk/[0.06] p-6 backdrop-blur-xl sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <L label="ชื่อผู้ติดต่อ" required>
          <input name="name" required maxLength={120} className={field} placeholder="ชื่อ–นามสกุล" />
        </L>
        <L label="บริษัท" required>
          <input
            name="company"
            required
            maxLength={160}
            className={field}
            placeholder="ชื่อบริษัท / ทีม"
          />
        </L>
        <L label="อีเมล" required>
          <input
            name="email"
            type="email"
            required
            maxLength={160}
            className={field}
            placeholder="you@company.com"
          />
        </L>
        <L label="เบอร์โทร">
          <input name="phone" maxLength={40} className={field} placeholder="08x-xxx-xxxx" />
        </L>
        <div className="sm:col-span-2">
          <L label="เล่าให้ฟังหน่อย">
            <textarea
              name="note"
              rows={4}
              maxLength={2000}
              className={field}
              placeholder="ตอนนี้รับงานแบบไหนอยู่ ลูกค้าเป็นใคร อยากใช้ FITT Builder กับงานไหน"
            />
          </L>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-halt/40 bg-halt/10 px-4 py-2.5 text-sm text-halt">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-shine px-6 py-3.5 font-display text-[15px] font-semibold text-night transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {busy ? "กำลังส่ง…" : "สมัครเป็น Partner"}
      </button>
      <p className="mt-3 text-center font-mono text-[12px] text-chalk/45">
        ไม่มีค่าสมัคร · ไม่ผูกมัด · เราจะติดต่อกลับเพื่อคุยรายละเอียดก่อนเสมอ
      </p>
    </form>
  );
}

const field =
  "w-full rounded-xl border border-chalk/15 bg-night/60 px-4 py-2.5 text-[15px] text-chalk outline-none transition placeholder:text-chalk/30 focus:border-shine/60";

function L({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-display text-[13px] text-chalk/70">
        {label}
        {required && <span className="text-shine"> *</span>}
      </span>
      {children}
    </label>
  );
}

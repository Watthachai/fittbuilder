"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Building2, Download, Loader2, Save, Trash2, Upload } from "lucide-react";
import { getOrg, updateOrgBrand, updateOrgDocCode, uploadOrgLogo } from "@/lib/orgs";
import { loadUserBrand, saveUserBrand, uploadUserLogo } from "@/lib/user-brand";
import { useFileDrop } from "@/lib/useFileDrop";
import DropOverlay from "@/components/ui/DropOverlay";
import { toast } from "@/lib/toast";
import { brandFromOrg, DEFAULT_ACCENT, safeAccent, type QuoteBrand } from "@/lib/quote";
import { Field, inputCls } from "./QuoteFields";

/**
 * The letterhead: who is sending this quotation.
 *
 * The document owns its own copy of the brand — see QuoteBrand in lib/quote.ts —
 * so the two directions are separate, explicit buttons rather than a background
 * sync. "ดึงจาก workspace" pulls the company's current identity in; "บันทึกเป็น
 * ค่าเริ่มต้น" pushes this document's back out. Nothing moves on its own, because
 * the alternative is a quotation someone already sent changing its own header.
 */
export default function QuoteBrandBar({
  brand,
  orgId,
  readOnly,
  onChange,
}: {
  brand: QuoteBrand;
  /** The workspace this project belongs to — null when it belongs to none. */
  orgId: string | null;
  readOnly: boolean;
  onChange: (patch: Partial<QuoteBrand>) => void;
}) {
  const [busy, setBusy] = useState<"pull" | "push" | "upload" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // The workspace's document-number prefix (the "12605" in SQP12605-0002).
  // Loaded and saved here rather than passed as a prop — it is a workspace
  // setting, and this is the one place the letterhead is edited.
  const [docCode, setDocCode] = useState("");
  const [docCodeLoaded, setDocCodeLoaded] = useState(false);
  useEffect(() => {
    if (!orgId) return;
    let alive = true;
    void getOrg(orgId)
      .then((org) => {
        if (alive && org) {
          setDocCode(org.docCode);
          setDocCodeLoaded(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [orgId]);

  const saveDocCode = async () => {
    if (!orgId || readOnly || !docCodeLoaded) return;
    try {
      await updateOrgDocCode(orgId, docCode);
    } catch (e) {
      toast.error("บันทึกรหัสเอกสารไม่สำเร็จ", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file || readOnly) return;
    if (!file.type.startsWith("image/")) {
      toast.error("ต้องเป็นไฟล์รูปภาพ", { description: "รองรับ PNG · JPG · WebP" });
      return;
    }
    setBusy("upload");
    try {
      // A workspace project stores its logo under the workspace; a personal
      // project under the person. Same bucket, different owner.
      onChange({ logoUrl: orgId ? await uploadOrgLogo(orgId, file) : await uploadUserLogo(file) });
      toast.success("อัปโหลดโลโก้แล้ว", {
        description: "กด “บันทึกเป็นค่าเริ่มต้น” ถ้าอยากให้ใบเสนอราคาใบถัดไปใช้โลโก้นี้ด้วย",
      });
    } catch (e) {
      // The storage policy gates the letterhead on being an ADMIN of the
      // workspace, not merely a member (migration 0029) — a company's identity
      // on a document a customer signs is not something any member may change.
      // That is the right rule, but it surfaces as "new row violates row-level
      // security policy", which tells the person nothing about what to do.
      const raw = e instanceof Error ? e.message : "";
      const denied = /row-level security|violates|not authorized|403/i.test(raw);
      toast.error(denied ? "คุณไม่มีสิทธิ์เปลี่ยนโลโก้ของ workspace นี้" : "อัปโหลดโลโก้ไม่สำเร็จ", {
        description: denied
          ? "โลโก้บนหัวกระดาษแก้ได้เฉพาะเจ้าของ workspace หรือสมาชิกระดับแอดมิน — ขอสิทธิ์แอดมิน หรือให้เจ้าของอัปโหลดให้ครั้งเดียว แล้วทุกใบจะใช้ร่วมกัน"
          : raw || undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const { dragging, dropHandlers } = useFileDrop((files) => void upload(files[0]));

  /** Copy the workspace's — or, without one, the person's — identity into this document. */
  const pull = async () => {
    if (readOnly) return;
    setBusy("pull");
    try {
      if (orgId) {
        const org = await getOrg(orgId);
        if (!org) {
          toast.error("อ่านข้อมูล workspace ไม่ได้");
          return;
        }
        // White-label is granted to the workspace, so `poweredBy` is derived
        // there — never typed into a document by whoever is editing it.
        onChange(brandFromOrg(org.brand, org.isPartner));
        toast.success(
          org.isPartner ? "ดึงข้อมูลบริษัทแล้ว — พิมพ์ในนามบริษัทคุณ" : "ดึงข้อมูลบริษัทแล้ว"
        );
        return;
      }
      const mine = await loadUserBrand();
      if (!mine) {
        toast.info("ยังไม่มีค่าเริ่มต้นของคุณ", {
          description: "กรอกหัวกระดาษแล้วกด “บันทึกเป็นค่าเริ่มต้น” หนึ่งครั้ง โปรเจกต์ถัดไปจะขึ้นให้เอง",
        });
        return;
      }
      // poweredBy is not stored in a personal default (it is workspace-derived)
      // — the document keeps whatever it already carries.
      onChange(mine);
      toast.success("ดึงค่าเริ่มต้นของคุณแล้ว");
    } catch (e) {
      toast.error("ดึงข้อมูลไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  /** Make this document's letterhead the workspace's — or the person's — default. */
  const push = async () => {
    if (readOnly) return;
    setBusy("push");
    try {
      const fields = {
        logoUrl: brand.logoUrl,
        name: brand.name,
        taxId: brand.taxId,
        address: brand.address,
        contact: brand.contact,
        tagline: brand.tagline,
        accent: brand.accent,
      };
      if (orgId) await updateOrgBrand(orgId, fields);
      else await saveUserBrand(fields);
      toast.success(
        orgId ? "บันทึกเป็นข้อมูลบริษัทของ workspace แล้ว" : "บันทึกเป็นค่าเริ่มต้นของคุณแล้ว",
        { description: "ใบเสนอราคาและข้อเสนอที่สร้างใหม่จะขึ้นหัวกระดาษนี้ให้เอง ทุกโปรเจกต์" }
      );
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative rounded-xl border border-night-edge p-3.5" {...dropHandlers}>
      {dragging && <DropOverlay label="วางไฟล์โลโก้ที่นี่" />}

      <div className="flex items-center gap-2">
        <Building2 size={13} className="text-shine" />
        <h3 className="font-display text-[14px] text-chalk">หัวกระดาษ — บริษัทผู้เสนอราคา</h3>
        {!brand.poweredBy && (
          <span className="inline-flex items-center gap-1 rounded-full border border-go/50 bg-go/10 px-2 py-0.5 font-mono text-[11.5px] text-go">
            <BadgeCheck size={10} /> Partner
          </span>
        )}
        {!readOnly && (
          <div className="ml-auto flex gap-1.5">
            {/* "ดึง" is the secondary action — outlined accent so it reads as a
                button but yields to Save. */}
            <button
              onClick={() => void pull()}
              disabled={busy !== null}
              title={
                orgId
                  ? "ดึงชื่อบริษัท ที่อยู่ เลขผู้เสียภาษี และโลโก้ที่บันทึกไว้ที่ workspace มาใส่ใบนี้"
                  : "ดึงหัวกระดาษที่คุณเคยบันทึกเป็นค่าเริ่มต้นมาใส่ใบนี้"
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-shine/50 bg-shine/[0.06] px-2.5 py-1.5 font-display text-[12.5px] font-medium text-shine transition hover:bg-shine/15 disabled:opacity-40"
            >
              {busy === "pull" ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
              {orgId ? "ดึงจาก workspace" : "ดึงค่าเริ่มต้นของฉัน"}
            </button>
            {/* "บันทึกเป็นค่าเริ่มต้น" is the one someone sets up once and every
                new project reuses — the primary action, so it gets the filled
                accent that says "press me". */}
            <button
              onClick={() => void push()}
              disabled={busy !== null}
              title={
                orgId
                  ? "ทำให้หัวกระดาษนี้เป็นค่าเริ่มต้นของ workspace — ใบเสนอราคาใบถัดไปจะขึ้นให้เอง"
                  : "ทำให้หัวกระดาษนี้เป็นค่าเริ่มต้นของคุณ — โปรเจกต์ใหม่ทุกโปรเจกต์จะขึ้นให้เอง"
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-shine px-3 py-1.5 font-display text-[12.5px] font-semibold text-night transition hover:brightness-110 disabled:opacity-40"
            >
              {busy === "push" ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              บันทึกเป็นค่าเริ่มต้น
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-3.5">
        {/* Logo */}
        <div className="shrink-0">
          <div className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-xl border border-night-edge bg-night">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="โลโก้" className="max-h-full max-w-full object-contain" />
            ) : (
              <Building2 size={22} className="text-chalk-dim/40" />
            )}
          </div>
          {!readOnly && (
            <div className="mt-1.5 flex justify-center gap-1">
              <button
                onClick={() => fileInput.current?.click()}
                disabled={busy !== null}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-display text-[11.5px] text-chalk-dim transition hover:text-shine disabled:opacity-40"
              >
                {busy === "upload" ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <Upload size={10} />
                )}
                อัปโหลด
              </button>
              {brand.logoUrl && (
                <button
                  onClick={() => onChange({ logoUrl: "" })}
                  aria-label="เอาโลโก้ออก"
                  className="rounded-md px-1 py-0.5 text-chalk-dim transition hover:text-halt"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              // Clear it, or picking the same file twice in a row fires nothing.
              e.target.value = "";
            }}
          />
        </div>

        <div className="grid min-w-0 flex-1 gap-2.5 sm:grid-cols-2">
          <Field label="ชื่อบริษัท (ตามที่จดทะเบียน)">
            <input
              value={brand.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="บริษัท ฟิตต์ จำกัด"
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
          <Field label="เลขประจำตัวผู้เสียภาษี">
            <input
              value={brand.taxId}
              onChange={(e) => onChange({ taxId: e.target.value })}
              placeholder="0-0000-00000-00-0"
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
          <Field label="ที่อยู่">
            <textarea
              value={brand.address}
              onChange={(e) => onChange({ address: e.target.value })}
              rows={2}
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
          <Field label="ติดต่อ (โทร / อีเมล / เว็บไซต์)">
            <textarea
              value={brand.contact}
              onChange={(e) => onChange({ contact: e.target.value })}
              rows={2}
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
          <Field label="สโลแกน (พิมพ์ท้ายกระดาษ)">
            <input
              value={brand.tagline}
              onChange={(e) => onChange({ tagline: e.target.value })}
              placeholder="เช่น Upgrade Your Business"
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
          {/*
            The one colour on the printed page. A brand field, not a constant —
            a partner's quotation should not carry our accent any more than it
            should carry our name.
          */}
          <Field label="สีประจำเอกสาร (เส้นและหัวข้อ)">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={safeAccent(brand.accent)}
                onChange={(e) => onChange({ accent: e.target.value })}
                disabled={readOnly}
                aria-label="สีประจำเอกสาร"
                className="h-[30px] w-10 shrink-0 cursor-pointer rounded-lg border border-night-edge bg-night disabled:opacity-50"
              />
              <input
                value={brand.accent}
                onChange={(e) => onChange({ accent: e.target.value })}
                placeholder={DEFAULT_ACCENT}
                className={`${inputCls} font-mono`}
                disabled={readOnly}
              />
            </div>
          </Field>
        </div>
      </div>

      {orgId && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-night-edge bg-night/40 px-3 py-2">
          <span className="font-display text-[12px] text-chalk-dim">รหัสเลขที่เอกสาร</span>
          <input
            value={docCode}
            onChange={(e) => setDocCode(e.target.value)}
            onBlur={() => void saveDocCode()}
            placeholder="เช่น 12605"
            disabled={readOnly || !docCodeLoaded}
            className="w-28 rounded-md border border-night-edge bg-night px-2 py-1 font-mono text-[13px] text-chalk outline-none focus:border-shine/60 disabled:opacity-50"
          />
          <span className="font-mono text-[11.5px] text-chalk-dim">
            เลขที่จะออกเป็น <span className="text-shine">SQP{docCode.trim() || "…"}-0001</span> ·
            ข้อเสนอเป็น <span className="text-shine">PRP{docCode.trim() || "…"}-…</span> — ออกเลขอัตโนมัติตอนพิมพ์ครั้งแรก นับต่อกันทั้ง workspace
          </span>
        </div>
      )}

      {!orgId && (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-chalk-dim">
          กรอกครั้งเดียวแล้วกด “บันทึกเป็นค่าเริ่มต้น” — โปรเจกต์ใหม่ทุกโปรเจกต์จะขึ้นหัวกระดาษนี้ให้เอง
          (โปรเจกต์ที่ผูก workspace ใช้ข้อมูลบริษัทของ workspace แทน)
        </p>
      )}
    </div>
  );
}

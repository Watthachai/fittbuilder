"use client";

import { useRef, useState } from "react";
import { BadgeCheck, Building2, Download, Loader2, Save, Trash2, Upload } from "lucide-react";
import { getOrg, updateOrgBrand, uploadOrgLogo } from "@/lib/orgs";
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

  const upload = async (file: File | undefined) => {
    if (!file || readOnly) return;
    if (!orgId) {
      toast.info("ผูกโปรเจกต์กับ workspace ก่อน", {
        description: "โลโก้เก็บไว้ที่ workspace เพื่อให้ใบเสนอราคาทุกใบใช้ร่วมกันได้",
      });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("ต้องเป็นไฟล์รูปภาพ", { description: "รองรับ PNG · JPG · WebP" });
      return;
    }
    setBusy("upload");
    try {
      onChange({ logoUrl: await uploadOrgLogo(orgId, file) });
      toast.success("อัปโหลดโลโก้แล้ว", {
        description: "กด “บันทึกเป็นค่าเริ่มต้น” ถ้าอยากให้ใบเสนอราคาใบถัดไปใช้โลโก้นี้ด้วย",
      });
    } catch (e) {
      toast.error("อัปโหลดโลโก้ไม่สำเร็จ", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const { dragging, dropHandlers } = useFileDrop((files) => void upload(files[0]));

  /** Copy the workspace's current company identity into this document. */
  const pull = async () => {
    if (!orgId || readOnly) return;
    setBusy("pull");
    try {
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
    } catch (e) {
      toast.error("ดึงข้อมูลไม่สำเร็จ", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  /** Make this document's letterhead the workspace's default. */
  const push = async () => {
    if (!orgId || readOnly) return;
    setBusy("push");
    try {
      await updateOrgBrand(orgId, {
        logoUrl: brand.logoUrl,
        name: brand.name,
        taxId: brand.taxId,
        address: brand.address,
        contact: brand.contact,
        tagline: brand.tagline,
        accent: brand.accent,
      });
      toast.success("บันทึกเป็นข้อมูลบริษัทของ workspace แล้ว", {
        description: "ใบเสนอราคาที่สร้างใหม่จะขึ้นหัวกระดาษนี้ให้เอง",
      });
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
        <h3 className="font-display text-[12px] text-chalk">หัวกระดาษ — บริษัทผู้เสนอราคา</h3>
        {!brand.poweredBy && (
          <span className="inline-flex items-center gap-1 rounded-full border border-go/50 bg-go/10 px-2 py-0.5 font-mono text-[10px] text-go">
            <BadgeCheck size={10} /> Partner
          </span>
        )}
        {!readOnly && orgId && (
          <div className="ml-auto flex gap-1.5">
            <button
              onClick={() => void pull()}
              disabled={busy !== null}
              title="ดึงชื่อบริษัท ที่อยู่ เลขผู้เสียภาษี และโลโก้ที่บันทึกไว้ที่ workspace มาใส่ใบนี้"
              className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1 font-display text-[11px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk disabled:opacity-40"
            >
              {busy === "pull" ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
              ดึงจาก workspace
            </button>
            <button
              onClick={() => void push()}
              disabled={busy !== null}
              title="ทำให้หัวกระดาษนี้เป็นค่าเริ่มต้นของ workspace — ใบเสนอราคาใบถัดไปจะขึ้นให้เอง"
              className="inline-flex items-center gap-1.5 rounded-lg border border-night-edge px-2.5 py-1 font-display text-[11px] text-chalk-dim transition hover:border-shine/60 hover:text-chalk disabled:opacity-40"
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
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-display text-[10px] text-chalk-dim transition hover:text-shine disabled:opacity-40"
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

      {brand.poweredBy && (
        <p className="mt-2.5 text-[10px] leading-relaxed text-chalk-dim">
          ใบเสนอราคาจะมีข้อความ “Powered by FITT Builder” ท้ายกระดาษ — เปิดเป็น Partner แล้วจะเอาออกให้
          {orgId ? " (กด “ดึงจาก workspace” หลังได้สิทธิ์ Partner)" : ""}
        </p>
      )}
      {!orgId && (
        <p className="mt-2.5 text-[10px] leading-relaxed text-chalk-dim">
          โปรเจกต์นี้ยังไม่ได้ผูกกับ workspace — กรอกหัวกระดาษที่นี่ได้ แต่อัปโหลดโลโก้และบันทึกเป็น
          ค่าเริ่มต้นยังทำไม่ได้
        </p>
      )}
    </div>
  );
}

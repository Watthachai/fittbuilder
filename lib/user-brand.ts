"use client";

import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/current-user";
import type { Json } from "@/lib/db/types";
import type { QuoteBrand } from "@/lib/quote";

/**
 * The personal default letterhead — the workspace brand's sibling for projects
 * that belong to no workspace (migration 0040).
 *
 * Set once, it seeds every new quotation and proposal the user creates.
 * Documents copy it at birth and own their copy, exactly as they do the org
 * brand: changing the default never rewrites a sheet already sent.
 */

const TABLE = "fittbuilder_user_brand";
const LOGO_BUCKET = "org-brand";

/**
 * `poweredBy` is NOT part of a personal default: it is derived from workspace
 * partner status, and a stored copy would let an old value shadow the truth.
 */
export type UserBrand = Omit<QuoteBrand, "poweredBy">;

export async function loadUserBrand(): Promise<UserBrand | null> {
  const supabase = createClient();
  const user = await currentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select("brand")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  const b = (data.brand ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    logoUrl: str(b.logoUrl),
    name: str(b.name),
    taxId: str(b.taxId),
    address: str(b.address),
    contact: str(b.contact),
    tagline: str(b.tagline),
    accent: str(b.accent),
  };
}

export async function saveUserBrand(brand: UserBrand): Promise<void> {
  const supabase = createClient();
  const user = await currentUser();
  if (!user) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: user.id, brand: brand as unknown as Json }, { onConflict: "user_id" });
  if (error) throw error;
}

/**
 * Personal logo, same public bucket as workspace logos — the first path
 * segment is the uploader's own user id, which is what the storage policy
 * checks (0040 explains why it must be a bare uuid).
 */
export async function uploadUserLogo(file: File): Promise<string> {
  return uploadUserImage(file, "logo");
}

/**
 * Any personal image that needs a public, permanent URL — template slots use
 * this to turn a file on disk into something generated code can reference.
 * Bucket rules (0029): png/jpeg/webp only, 2MB cap — surfaced here as a clear
 * message instead of a storage error code.
 */
export async function uploadUserImage(file: File, prefix = "img"): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
    throw new Error("รองรับเฉพาะ PNG · JPG · WebP");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("ไฟล์ใหญ่เกิน 2MB — ย่อรูปก่อนอัปโหลด");
  }
  const supabase = createClient();
  const user = await currentUser();
  if (!user) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user.id}/${prefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}

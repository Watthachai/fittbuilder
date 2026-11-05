"use client";

import { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, ChevronDown, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import type { ApprovalDocKind } from "@/lib/doc-approval";
import { editionName, keptLabel, matchingEdition, type DocEdition } from "@/lib/doc-editions";
import { listEditions, saveEdition } from "@/lib/doc-editions-store";
import { toast } from "@/lib/toast";
import type { VersionKey } from "@/lib/versions";

const when = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

const reason = (e: unknown) => ({ description: e instanceof Error ? e.message : undefined });

/**
 * Keep the document as an edition and go back to one later (lib/doc-editions).
 *
 * Going back asks nothing first because it loses nothing: the work open now is
 * kept as an edition of its own unless one already says the same. Approval needs
 * no step here either. It compares the open document with what was approved, so
 * going back to the approved edition reads as approved and anything else does not.
 *
 * For people who can edit the document; a read-only panel does not show it.
 * @param read reads a stored document; must be stable between renders.
 * @param onRestore puts the edition's content on the open document.
 */
export function DocEditions<T extends object>({
  projectId,
  kind,
  version,
  doc,
  read,
  onRestore,
}: {
  projectId: string;
  kind: ApprovalDocKind;
  version: VersionKey;
  doc: T;
  read: (payload: unknown) => T | null;
  onRestore: (saved: T) => void;
}) {
  const [editions, setEditions] = useState<DocEdition[] | null>(null);
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  // Read again on opening: someone else on the document may have kept one.
  useEffect(() => {
    let alive = true;
    listEditions(projectId, kind, version)
      .then((found) => {
        if (alive) setEditions(found);
      })
      .catch((e) => toast.error("โหลดรายการฉบับไม่สำเร็จ", reason(e)));
    return () => {
      alive = false;
    };
  }, [projectId, kind, version, open]);

  // Only while the list shows: this reads every edition, and doc changes on each keystroke.
  const current = useMemo(
    () => (open && editions ? matchingEdition(doc, editions, read) : null),
    [open, doc, editions, read]
  );

  const keep = async () => {
    setBusy(true);
    try {
      const saved = await saveEdition(projectId, kind, version, doc, label.trim());
      setEditions((list) => [saved, ...(list ?? [])]);
      setLabel("");
      setNaming(false);
      setOpen(true);
      toast.success(`บันทึกเป็น ${editionName(saved)} แล้ว`);
    } catch (e) {
      toast.error("บันทึกฉบับไม่สำเร็จ", reason(e));
    } finally {
      setBusy(false);
    }
  };

  const goBack = async (edition: DocEdition) => {
    const saved = read(edition.payload);
    if (!saved) {
      toast.error(`เปิด v${edition.number} ไม่ได้`, { description: "ข้อมูลของฉบับนี้อ่านไม่ได้" });
      return;
    }
    setBusy(true);
    try {
      const list = editions ?? [];
      // Kept first and replaced after: if keeping fails, the open document stays as it is.
      const kept = matchingEdition(doc, list, read)
        ? null
        : await saveEdition(projectId, kind, version, doc, keptLabel(edition.number));
      if (kept) setEditions([kept, ...list]);
      onRestore(saved);
      toast.success(`ดึง ${editionName(edition)} กลับมาแล้ว`, {
        description: kept ? `งานที่เปิดอยู่เก็บไว้เป็น v${kept.number}` : undefined,
      });
    } catch (e) {
      toast.error("ดึงฉบับกลับไม่สำเร็จ", reason(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-night-edge p-2.5">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-1 text-left text-[0.78125rem] text-chalk-dim transition hover:text-chalk"
        >
          {open ? <ChevronDown size={13} className="shrink-0" /> : <ChevronRight size={13} className="shrink-0" />}
          <span>ฉบับที่บันทึกไว้{editions?.length ? ` (${editions.length})` : ""}</span>
        </button>
        <button
          onClick={() => setNaming((v) => !v)}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-night-edge px-2 py-1 font-display text-[0.78125rem] text-chalk transition hover:border-shine/60 disabled:opacity-50"
        >
          <BookmarkPlus size={12} /> บันทึกเป็นฉบับ
        </button>
      </div>

      {naming && (
        // Its own coedit row: this field shows on one screen only, and counted
        // among the panel's fields it would shift where the others see this person.
        <form
          data-coedit-row="doc-edition-name"
          onSubmit={(e) => {
            e.preventDefault();
            void keep();
          }}
          className="mt-2 flex gap-1.5"
        >
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
            placeholder="ตั้งชื่อ เช่น ราคาก่อนต่อรอง (ไม่บังคับ)"
            aria-label="ชื่อฉบับ"
            className="min-w-0 flex-1 rounded-md border border-night-edge bg-night px-2 py-1.5 text-[0.78125rem] text-chalk placeholder:text-chalk-dim"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-shine px-2.5 py-1 font-display text-[0.78125rem] font-semibold text-night transition hover:brightness-110 disabled:opacity-60"
          >
            {busy && <Loader2 size={12} className="animate-spin" />} บันทึก
          </button>
        </form>
      )}

      {open && editions?.length === 0 && (
        <p className="mt-2 text-[0.6875rem] leading-relaxed text-chalk-dim">
          ยังไม่มีฉบับที่บันทึกไว้ บันทึกเอกสารตอนนี้เก็บไว้ แล้วแก้ต่อได้เลย จะดึงกลับมาทำต่อเมื่อไรก็ได้
        </p>
      )}
      {open && editions !== null && editions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {editions.map((edition) => (
            <li key={edition.id} className="rounded-md border border-night-edge px-2 py-1.5">
              <p className="break-words text-[0.78125rem] text-chalk">{editionName(edition)}</p>
              <p className="text-[0.6875rem] text-chalk-dim">
                {edition.savedByName} · {when(edition.savedAt)}
              </p>
              {current?.id === edition.id ? (
                <p className="mt-1 text-[0.6875rem] text-go">ตรงกับเอกสารตอนนี้</p>
              ) : (
                <button
                  onClick={() => void goBack(edition)}
                  disabled={busy}
                  className="mt-1 inline-flex items-center gap-1 text-[0.6875rem] text-shine transition hover:underline disabled:opacity-50"
                >
                  <RotateCcw size={11} /> ดึงกลับมาทำต่อ
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

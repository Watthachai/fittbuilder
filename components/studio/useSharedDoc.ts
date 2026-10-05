"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusEvent } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/current-user";
import { applyOps, diffDoc, type Op } from "@/lib/co-edit";
import { toast } from "@/lib/toast";
import { colorFor } from "./LiveCursors";

/** Someone else with the same document open, and the field they are in. */
export interface CoEditor {
  id: string;
  name: string;
  color: string;
  /** Key of the focused field (see fieldKey), or null when they are only looking. */
  field: string | null;
}

/** How long an edit waits before it is written — typing in a form, not pressing Save. */
const SAVE_MS = 600;
/** Edits that land together travel together. */
const SEND_MS = 80;
/**
 * A reload after an edit that could not be applied waits for its author's save
 * to land — the edit is sent at once, the document behind it SAVE_MS later.
 */
const RESYNC_MS = SAVE_MS + 600;

/**
 * One document that several people edit at the same time.
 *
 * The quotation and the proposal used to load once and save their whole copy:
 * with two people on one, the last to type overwrote the other, and neither saw
 * the other's work until they reopened it. Here every local edit is sent to the
 * others as the fields it changed (lib/co-edit), applied there on arrival, and
 * saved as before. Both copies hold every edit, so either one's save is the
 * whole truth.
 *
 * A screen that missed edits — its connection dropped, or an edit names a line
 * it has never seen — reloads the saved document instead of carrying on from a
 * copy that has drifted.
 */
export function useSharedDoc<T>({
  channel: name,
  readOnly,
  save,
  reload,
  saveError,
}: {
  /** Unique per document, e.g. `quote:<project>:<version>`. */
  channel: string;
  readOnly: boolean;
  save: (doc: T) => Promise<void>;
  /** The saved document, or null when none is saved yet. */
  reload: () => Promise<T | null>;
  /** Toast title when a save fails. */
  saveError: string;
}) {
  const [doc, setDocState] = useState<T | null>(null);
  const [editors, setEditors] = useState<CoEditor[]>([]);
  const docRef = useRef<T | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outbox = useRef<Op[]>([]);
  // The latest callbacks, read when a timer fires rather than when it was set.
  const saveRef = useRef(save);
  const reloadRef = useRef(reload);
  const saveErrorRef = useRef(saveError);
  useEffect(() => {
    saveRef.current = save;
    reloadRef.current = reload;
    saveErrorRef.current = saveError;
  });
  const [me] = useState(() => {
    const id = crypto.randomUUID();
    return { id, color: colorFor(id) };
  });
  const presence = useRef<CoEditor>({ id: me.id, name: "ผู้ใช้", color: me.color, field: null });

  const put = useCallback((next: T | null) => {
    docRef.current = next;
    setDocState(next);
  }, []);

  const send = useCallback(() => {
    sendTimer.current = null;
    const ops = outbox.current;
    outbox.current = [];
    if (ops.length) void channelRef.current?.send({ type: "broadcast", event: "ops", payload: { from: me.id, ops } });
  }, [me.id]);

  const resync = useCallback(() => {
    if (resyncTimer.current) clearTimeout(resyncTimer.current);
    resyncTimer.current = setTimeout(() => {
      resyncTimer.current = null;
      void reloadRef.current().then((saved) => {
        // An edit of ours still waiting to be written is newer than what is saved.
        if (saved && !saveTimer.current) put(saved);
      });
    }, RESYNC_MS);
  }, [put]);

  /** Write a pending edit now — leaving, or switching to another document. */
  const flushSave = useCallback(() => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!docRef.current) return;
    void saveRef.current(docRef.current).catch((e) =>
      toast.error(saveErrorRef.current, { description: e instanceof Error ? e.message : undefined })
    );
  }, []);

  /** Change the document here, tell the others, and save shortly after. */
  const edit = useCallback(
    (patch: (d: T) => T) => {
      const prev = docRef.current;
      if (readOnly || !prev) return;
      const next = patch(prev);
      const ops = diffDoc(prev, next);
      if (ops.length === 0) return;
      put(next);
      outbox.current.push(...ops);
      sendTimer.current ??= setTimeout(send, SEND_MS);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Saves the document as it is when the timer fires — with the others'
      // edits that arrived meanwhile.
      saveTimer.current = setTimeout(flushSave, SAVE_MS);
    },
    [readOnly, put, send, flushSave]
  );

  const track = useCallback((field: string | null) => {
    presence.current = { ...presence.current, field };
    void channelRef.current?.track(presence.current);
  }, []);

  useEffect(() => {
    // A new document (the other tier) starts empty until the panel loads it, so
    // nothing typed in between can land on the previous one's copy.
    put(null);
    const supabase = createClient();
    const channel = supabase.channel(`doc:${name}`, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    });
    channelRef.current = channel;
    let joined = false;
    channel
      .on("broadcast", { event: "ops" }, ({ payload }) => {
        const current = docRef.current;
        if (!current || !payload || payload.from === me.id) return;
        const { doc: next, complete } = applyOps(current, payload.ops as Op[]);
        put(next);
        if (!complete) resync();
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<CoEditor>();
        setEditors(
          Object.entries(state)
            .filter(([key]) => key !== me.id)
            .flatMap(([, metas]) => (metas.length ? [metas[metas.length - 1]] : []))
            .map(({ id, name: who, color, field }) => ({ id, name: who, color, field }))
        );
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void currentUser().then((user) => {
          presence.current = { ...presence.current, name: user?.name ?? user?.email ?? "ผู้ใช้" };
          void channel.track(presence.current);
        });
        // Back after a drop: whatever was sent meanwhile never arrived.
        if (joined) resync();
        joined = true;
      });
    return () => {
      // Leaving this document — closed, or switched to the other tier. What is
      // still waiting goes out now, while the channel and the save still belong
      // to it: a save that fired after the switch would write this tier's copy
      // into the next tier's row.
      if (sendTimer.current) {
        clearTimeout(sendTimer.current);
        send();
      }
      flushSave();
      if (resyncTimer.current) clearTimeout(resyncTimer.current);
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [name, me.id, put, resync, send, flushSave]);

  /** Spread on the panel's scrolling root: reports which field this person is in. */
  const focusProps = {
    onFocus: (e: FocusEvent<HTMLElement>) => track(fieldKey(e.currentTarget, e.target)),
    onBlur: (e: FocusEvent<HTMLElement>) => {
      if (!e.relatedTarget || !e.currentTarget.contains(e.relatedTarget as Node)) track(null);
    },
  };

  /** Seed the first copy — the panel decides what a fresh document looks like. */
  const load = put;

  return { doc, load, edit, editors, focusProps };
}

/* ------------------------------------------------------------ field keys */

const FIELDS = "input, textarea, select";
const ROW = "[data-coedit-row]";

/**
 * Where a field is, in terms both screens agree on.
 *
 * Inside a line marked data-coedit-row (a quotation row, a proposal point) it is
 * that line's id plus the field's place within it, so a line added above does
 * not shift it. Elsewhere it is the field's place among the panel's own fields —
 * the same on both screens, because both render the same document.
 */
export function fieldKey(root: HTMLElement, el: EventTarget): string | null {
  if (!(el instanceof Element) || !el.matches(FIELDS) || !root.contains(el)) return null;
  const row = el.closest<HTMLElement>(ROW);
  const scope = row && root.contains(row) ? row : root;
  const index = fieldsIn(scope, scope === root).indexOf(el);
  return index < 0 ? null : `${scope === root ? "" : row!.dataset.coeditRow}:${index}`;
}

/** The field a key names on this screen, if it is showing. */
export function fieldAt(root: HTMLElement, key: string): Element | null {
  const cut = key.lastIndexOf(":");
  const rowId = key.slice(0, cut);
  const scope = rowId ? root.querySelector(`[data-coedit-row="${CSS.escape(rowId)}"]`) : root;
  if (!scope) return null;
  return fieldsIn(scope, !rowId)[Number(key.slice(cut + 1))] ?? null;
}

function fieldsIn(scope: Element, outsideRows: boolean): Element[] {
  const all = Array.from(scope.querySelectorAll(FIELDS));
  return outsideRows ? all.filter((f) => !f.closest(ROW)) : all;
}

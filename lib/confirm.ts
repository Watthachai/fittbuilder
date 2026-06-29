"use client";

/**
 * App-wide confirm/prompt modals — replaces native window.confirm/prompt with our
 * own on-brand dialog. Imperative like the toast store: `await confirm({...})`
 * returns a boolean, `await promptText({...})` returns the entered string or null.
 * <ConfirmHost/> renders the active dialog and settles the promise.
 */
interface BaseOpts {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
interface PromptOpts extends BaseOpts {
  label?: string;
  placeholder?: string;
  defaultValue?: string;
}

export type Dialog =
  | ({ id: string; kind: "confirm"; resolve: (v: boolean) => void } & BaseOpts)
  | ({ id: string; kind: "prompt"; resolve: (v: string | null) => void } & PromptOpts);

let current: Dialog | null = null;
let counter = 0;
const listeners = new Set<(d: Dialog | null) => void>();

function emit() {
  for (const l of listeners) l(current);
}

export function subscribeDialog(fn: (d: Dialog | null) => void): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export function confirm(opts: BaseOpts): Promise<boolean> {
  return new Promise((resolve) => {
    current = { kind: "confirm", id: `dlg-${++counter}`, ...opts, resolve };
    emit();
  });
}

export function promptText(opts: PromptOpts): Promise<string | null> {
  return new Promise((resolve) => {
    current = { kind: "prompt", id: `dlg-${++counter}`, ...opts, resolve };
    emit();
  });
}

/** Settle the active dialog (called by ConfirmHost). */
export function settleDialog(value: boolean | string | null): void {
  if (!current) return;
  const d = current;
  current = null;
  emit();
  (d.resolve as (v: unknown) => void)(value);
}

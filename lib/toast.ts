"use client";

/**
 * Tiny app-wide toast store — no dependency, framework-agnostic. Client code calls
 * `toast.success(...)` etc.; <Toaster/> subscribes and renders. Auto-dismiss and
 * the exit animation are driven from here via a `leaving` flag so the UI stays
 * declarative. One transport for every "tell the user what happened" moment.
 */
export type ToastType = "success" | "error" | "info" | "warning" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  /** ms before auto-dismiss; 0 = sticky (e.g. loading until updated). */
  duration: number;
  leaving?: boolean;
}

export interface ToastOptions {
  description?: string;
  duration?: number;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3500,
  info: 3500,
  warning: 4500,
  error: 6000,
  loading: 0,
};
const EXIT_MS = 200;

let toasts: Toast[] = [];
let counter = 0;
const listeners = new Set<(t: Toast[]) => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribeToasts(fn: (t: Toast[]) => void): () => void {
  listeners.add(fn);
  fn(toasts);
  return () => listeners.delete(fn);
}

function scheduleAutoDismiss(id: string, duration: number) {
  if (duration <= 0) return;
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  timers.set(id, setTimeout(() => dismiss(id), duration));
}

function add(type: ToastType, title: string, opts?: ToastOptions): string {
  const id = `toast-${++counter}`;
  const duration = opts?.duration ?? DEFAULT_DURATION[type];
  toasts = [...toasts, { id, type, title, description: opts?.description, duration }];
  emit();
  scheduleAutoDismiss(id, duration);
  return id;
}

export function dismiss(id: string): void {
  const t = toasts.find((x) => x.id === id);
  if (!t || t.leaving) return;
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  timers.delete(id);
  toasts = toasts.map((x) => (x.id === id ? { ...x, leaving: true } : x));
  emit();
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== id);
    emit();
  }, EXIT_MS);
}

function update(
  id: string,
  patch: { type?: ToastType; title?: string; description?: string; duration?: number }
): void {
  const t = toasts.find((x) => x.id === id);
  if (!t) return;
  const duration = patch.duration ?? (patch.type ? DEFAULT_DURATION[patch.type] : t.duration);
  toasts = toasts.map((x) => (x.id === id ? { ...x, ...patch, duration, leaving: false } : x));
  emit();
  scheduleAutoDismiss(id, duration);
}

export const toast = {
  success: (title: string, opts?: ToastOptions) => add("success", title, opts),
  error: (title: string, opts?: ToastOptions) => add("error", title, opts),
  info: (title: string, opts?: ToastOptions) => add("info", title, opts),
  warning: (title: string, opts?: ToastOptions) => add("warning", title, opts),
  loading: (title: string, opts?: ToastOptions) => add("loading", title, opts),
  update,
  dismiss,
  /** Show a loading toast, then resolve it to success/error around a promise. */
  async promise<T>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((value: T) => string);
      error: string | ((err: unknown) => string);
    }
  ): Promise<T> {
    const id = add("loading", msgs.loading);
    try {
      const value = await promise;
      update(id, {
        type: "success",
        title: typeof msgs.success === "function" ? msgs.success(value) : msgs.success,
      });
      return value;
    } catch (err) {
      update(id, {
        type: "error",
        title: typeof msgs.error === "function" ? msgs.error(err) : msgs.error,
      });
      throw err;
    }
  },
};

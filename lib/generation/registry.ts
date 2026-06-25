"use client";

/**
 * Global registry of in-flight generations, keyed by projectId. Lives on
 * globalThis (like the WebContainer singleton) so it survives SPA navigation and
 * Fast-Refresh module reloads — that's what lets a generation keep running after
 * its studio unmounts, and lets a global indicator show which projects are busy.
 */

export interface ActiveGeneration {
  projectId: string;
  name: string;
}

interface RegistryGlobal {
  __fittGenRegistry?: {
    active: Map<string, ActiveGeneration>;
    listeners: Set<() => void>;
  };
}

const g = globalThis as RegistryGlobal;
const store = (g.__fittGenRegistry ??= {
  active: new Map(),
  listeners: new Set(),
});

function emit(): void {
  for (const l of store.listeners) l();
}

export function beginGeneration(projectId: string, name: string): void {
  store.active.set(projectId, { projectId, name });
  emit();
}

export function endGeneration(projectId: string): void {
  if (store.active.delete(projectId)) emit();
}

export function isGenerating(projectId: string): boolean {
  return store.active.has(projectId);
}

export function subscribeGenerations(cb: () => void): () => void {
  store.listeners.add(cb);
  return () => {
    store.listeners.delete(cb);
  };
}

// useSyncExternalStore requires a stable snapshot reference when nothing changed,
// so cache the array and only rebuild it when the active set actually differs.
let cachedKeys: string[] = [];
let cachedSnapshot: ActiveGeneration[] = [];

export function getActiveGenerations(): ActiveGeneration[] {
  const keys = [...store.active.keys()];
  const same =
    keys.length === cachedKeys.length &&
    keys.every((k, i) => k === cachedKeys[i]);
  if (same) return cachedSnapshot;
  cachedKeys = keys;
  cachedSnapshot = [...store.active.values()];
  return cachedSnapshot;
}

export const EMPTY_GENERATIONS: ActiveGeneration[] = [];

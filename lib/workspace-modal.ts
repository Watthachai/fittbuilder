"use client";

import type { OrgRecord } from "@/lib/types";

/**
 * Imperative create-workspace modal (like the confirm store). `await
 * openCreateWorkspace()` opens the rich modal and resolves with the created
 * OrgRecord, or null if cancelled. <CreateWorkspaceHost/> renders it.
 */
let resolver: ((org: OrgRecord | null) => void) | null = null;
const listeners = new Set<(open: boolean) => void>();

function emit() {
  for (const l of listeners) l(resolver !== null);
}

export function subscribeCreateWorkspace(fn: (open: boolean) => void): () => void {
  listeners.add(fn);
  fn(resolver !== null);
  return () => listeners.delete(fn);
}

export function openCreateWorkspace(): Promise<OrgRecord | null> {
  return new Promise((resolve) => {
    resolver = resolve;
    emit();
  });
}

export function resolveCreateWorkspace(org: OrgRecord | null): void {
  const r = resolver;
  resolver = null;
  emit();
  r?.(org);
}

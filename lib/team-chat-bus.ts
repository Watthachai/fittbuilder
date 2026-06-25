"use client";

/**
 * Tiny in-tab bus so non-chat code (e.g. the approval flow in Studio) can drop an
 * activity log into the team chat without owning the realtime channel. The mounted
 * TeamChat is the single writer: it persists the system message and broadcasts it
 * to the room, keeping one transport (Broadcast) and one channel owner.
 */
type Listener = (body: string) => void;

const listeners = new Map<string, Set<Listener>>();

export function onSystemLog(projectId: string, fn: Listener): () => void {
  const set = listeners.get(projectId) ?? new Set<Listener>();
  set.add(fn);
  listeners.set(projectId, set);
  return () => {
    set.delete(fn);
    if (set.size === 0) listeners.delete(projectId);
  };
}

export function emitSystemLog(projectId: string, body: string): void {
  listeners.get(projectId)?.forEach((fn) => fn(body));
}

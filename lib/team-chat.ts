"use client";

import { createClient } from "@/lib/supabase/client";
import type { TeamChatAttachment, TeamChatMessage } from "@/lib/types";

const BUCKET = "project-chat";
const SIGNED_URL_TTL = 60 * 60; // 1h — re-signed every time the room loads

interface ChatRow {
  id: string;
  user_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  kind: string;
  body: string;
  attachments: unknown;
  created_at: string;
}

/** Sign every attachment path in one round-trip so private files can render. */
async function withSignedUrls(
  supabase: ReturnType<typeof createClient>,
  messages: TeamChatMessage[]
): Promise<TeamChatMessage[]> {
  const paths = messages.flatMap((m) => m.attachments.map((a) => a.path));
  if (paths.length === 0) return messages;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
  const urlByPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return messages.map((m) => ({
    ...m,
    attachments: m.attachments.map((a) => ({ ...a, url: urlByPath.get(a.path) ?? undefined })),
  }));
}

function rowToMessage(r: ChatRow): TeamChatMessage {
  return {
    id: r.id,
    kind: r.kind === "system" ? "system" : "message",
    userId: r.user_id,
    authorName: r.author_name,
    authorAvatar: r.author_avatar,
    body: r.body,
    attachments: Array.isArray(r.attachments) ? (r.attachments as TeamChatAttachment[]) : [],
    createdAt: r.created_at,
  };
}

/** Full room history, oldest → newest, with fresh signed URLs for attachments. */
export async function loadMessages(projectId: string): Promise<TeamChatMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_project_chat")
    .select("id, user_id, author_name, author_avatar, kind, body, attachments, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const messages = (data ?? []).map((r) => rowToMessage(r as ChatRow));
  return withSignedUrls(supabase, messages);
}

/** Upload one file to the project's chat bucket; returns its attachment record. */
export async function uploadAttachment(
  projectId: string,
  file: File
): Promise<TeamChatAttachment> {
  const supabase = createClient();
  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${projectId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return { path, name: file.name, type: file.type, size: file.size };
}

/** Post a person's message. Author name/avatar are stamped from the session's
 *  user_metadata (profiles_select_own hides them from other readers otherwise). */
export async function sendMessage(
  projectId: string,
  body: string,
  attachments: TeamChatAttachment[]
): Promise<TeamChatMessage> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  const meta = user.user_metadata ?? {};
  const authorName = (meta.full_name ?? meta.name ?? user.email ?? "ผู้ใช้") as string;
  const authorAvatar = (meta.avatar_url ?? meta.picture ?? null) as string | null;

  // Strip the transient signed `url` before persisting — only the path is stored.
  const stored = attachments.map(({ path, name, type, size }) => ({ path, name, type, size }));

  const { data, error } = await supabase
    .from("fittbuilder_project_chat")
    .insert({
      project_id: projectId,
      user_id: user.id,
      author_name: authorName,
      author_avatar: authorAvatar,
      kind: "message",
      body,
      attachments: stored,
    })
    .select("id, user_id, author_name, author_avatar, kind, body, attachments, created_at")
    .single();
  if (error) throw error;
  const [message] = await withSignedUrls(supabase, [rowToMessage(data as ChatRow)]);
  return message;
}

/** Append an unattributed activity log (e.g. "X อนุมัติ Plan") and return the row
 *  so the caller can broadcast it to the room. */
export async function sendSystemMessage(
  projectId: string,
  body: string
): Promise<TeamChatMessage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fittbuilder_project_chat")
    .insert({ project_id: projectId, user_id: null, kind: "system", body, attachments: [] })
    .select("id, user_id, author_name, author_avatar, kind, body, attachments, created_at")
    .single();
  if (error) throw error;
  return rowToMessage(data as ChatRow);
}

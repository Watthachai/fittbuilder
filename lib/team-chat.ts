"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  TeamChatAttachment,
  TeamChatMessage,
  TeamChatReaction,
  TeamChatReplyRef,
} from "@/lib/types";

const BUCKET = "project-chat";
const SIGNED_URL_TTL = 60 * 60; // 1h — re-signed every time the room loads
const SELECT =
  "id, user_id, author_name, author_avatar, kind, body, attachments, reply_to, reply_author, reply_excerpt, created_at";

interface ChatRow {
  id: string;
  user_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  kind: string;
  body: string;
  attachments: unknown;
  reply_to: string | null;
  reply_author: string | null;
  reply_excerpt: string | null;
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
    replyTo: r.reply_to
      ? { id: r.reply_to, author: r.reply_author ?? "", excerpt: r.reply_excerpt ?? "" }
      : null,
    reactions: [],
    createdAt: r.created_at,
  };
}

/** Fold reaction rows into per-message emoji tallies. */
function groupReactions(
  rows: { message_id: string; user_id: string; emoji: string }[]
): Map<string, TeamChatReaction[]> {
  const byMessage = new Map<string, Map<string, string[]>>();
  for (const r of rows) {
    const emojis = byMessage.get(r.message_id) ?? new Map<string, string[]>();
    const users = emojis.get(r.emoji) ?? [];
    users.push(r.user_id);
    emojis.set(r.emoji, users);
    byMessage.set(r.message_id, emojis);
  }
  const out = new Map<string, TeamChatReaction[]>();
  for (const [messageId, emojis] of byMessage) {
    out.set(
      messageId,
      [...emojis.entries()].map(([emoji, userIds]) => ({ emoji, userIds }))
    );
  }
  return out;
}

/** Full room history, oldest → newest, with signed attachment URLs + reactions. */
export async function loadMessages(projectId: string): Promise<TeamChatMessage[]> {
  const supabase = createClient();
  const [{ data, error }, { data: reactionRows }] = await Promise.all([
    supabase
      .from("fittbuilder_project_chat")
      .select(SELECT)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
    supabase
      .from("fittbuilder_chat_reactions")
      .select("message_id, user_id, emoji")
      .eq("project_id", projectId),
  ]);
  if (error) throw error;
  const reactionsByMessage = groupReactions(reactionRows ?? []);
  const messages = (data ?? []).map((r) => {
    const m = rowToMessage(r as ChatRow);
    m.reactions = reactionsByMessage.get(m.id) ?? [];
    return m;
  });
  return withSignedUrls(supabase, messages);
}

/** One reusable file from the project's chat bucket (any past upload). */
export interface ProjectChatFile {
  path: string;
  /** Display name (the random upload prefix stripped). */
  name: string;
  size: number | null;
  createdAt: string | null;
}

/**
 * Every file ever uploaded under this project — team-chat attachments AND
 * AI-chat attachments (ChatPanel mirrors them here) — newest first. Backs the
 * "ใช้ไฟล์เดิม" picker so people re-attach without re-uploading. Gated by the
 * bucket's per-project read policy, so only members see the list.
 */
export async function listProjectFiles(projectId: string): Promise<ProjectChatFile[]> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(projectId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw error;
  return (data ?? [])
    .filter((e) => e.id) // folders come back with a null id
    .map((e) => ({
      path: `${projectId}/${e.name}`,
      name: e.name.replace(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
        ""
      ),
      size: (e.metadata as { size?: number } | null)?.size ?? null,
      createdAt: e.created_at ?? null,
    }));
}

/** Download a bucket file back into a browser File (for re-attaching to the AI —
 *  fileToAttachment re-runs conversions like xlsx→CSV on the way in). */
export async function downloadProjectFile(f: ProjectChatFile): Promise<File> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(f.path);
  if (error || !data) throw error ?? new Error("ดาวน์โหลดไฟล์ไม่สำเร็จ");
  return new File([data], f.name, { type: data.type || "application/octet-stream" });
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
  attachments: TeamChatAttachment[],
  replyTo?: TeamChatReplyRef | null
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
      reply_to: replyTo?.id ?? null,
      reply_author: replyTo?.author ?? null,
      reply_excerpt: replyTo?.excerpt ?? null,
    })
    .select(SELECT)
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
    .select(SELECT)
    .single();
  if (error) throw error;
  return rowToMessage(data as ChatRow);
}

/** Toggle the current user's emoji reaction on a message. Returns the resulting
 *  op + the reacting user id so the caller can update + broadcast. */
export async function toggleReaction(
  projectId: string,
  messageId: string,
  emoji: string
): Promise<{ op: "add" | "remove"; userId: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { data: existing } = await supabase
    .from("fittbuilder_chat_reactions")
    .select("emoji")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("fittbuilder_chat_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", user.id)
      .eq("emoji", emoji);
    if (error) throw error;
    return { op: "remove", userId: user.id };
  }

  const { error } = await supabase
    .from("fittbuilder_chat_reactions")
    .insert({ message_id: messageId, project_id: projectId, user_id: user.id, emoji });
  if (error) throw error;
  return { op: "add", userId: user.id };
}

/** Delete a message (RLS: author, or project owner). */
export async function deleteMessage(messageId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("fittbuilder_project_chat")
    .delete()
    .eq("id", messageId);
  if (error) throw error;
}

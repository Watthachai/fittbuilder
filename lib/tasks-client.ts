"use client";

/** Ask /api/split-tasks to break a many-item request into tasks (lib/tasks). */
export async function splitTasks(
  prompt: string,
  projectId: string
): Promise<{ title: string; detail: string }[]> {
  const res = await fetch("/api/split-tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, projectId }),
  });
  const data = (await res.json()) as { tasks?: { title: string; detail: string }[]; error?: string };
  if (!res.ok || !data.tasks) throw new Error(data.error ?? `แตกงานไม่สำเร็จ (${res.status})`);
  return data.tasks;
}

import type { ChatAttachmentInput } from "@/lib/types";

/** Max size for a single uploaded attachment (routes cap the base64 payload separately). */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/** Read a browser File into the base64 ChatAttachmentInput the AI routes accept. */
export async function fileToAttachment(file: File): Promise<ChatAttachmentInput> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    data: dataUrl.split(",")[1] ?? "",
  };
}

import type { OrgInviteRole, ShareRole } from "@/lib/types";

const DMAIL_API_URL =
  "https://dmailservicebackend-sandbox-1095128507689.asia-southeast1.run.app/api/v1/mail/send";
const INVITATION_TEMPLATE_ID = "4b72b137-4124-4b4a-982b-a7b38d723547";

export interface InviteEmailArgs {
  to: string;
  projectName: string;
  role: ShareRole;
  inviteLink: string;
  senderName: string;
}

export interface DmailPayload {
  templateId: string;
  to: { email: string; name: string }[];
  subject: string;
  variables: Record<string, string>;
}

export function buildInvitePayload(args: InviteEmailArgs): DmailPayload {
  const roleText = args.role === "editor" ? "Editor" : "Viewer";
  return {
    templateId: INVITATION_TEMPLATE_ID,
    to: [{ email: args.to, name: args.to }],
    subject: `คำเชิญร่วมโปรเจกต์ ${args.projectName} — FITT Builder`,
    variables: {
      name: args.to,
      companyName: args.projectName,
      branchName: "-",
      roleText,
      invitationLink: args.inviteLink,
      senderName: args.senderName,
      year: new Date().getFullYear().toString(),
    },
  };
}

export async function sendProjectInviteEmail(args: InviteEmailArgs): Promise<{ success: boolean }> {
  const apiKey = process.env.DMAIL_API_KEY;
  if (!apiKey) {
    console.error("[email] DMAIL_API_KEY not set — skipping invite email");
    return { success: false };
  }
  const res = await fetch(DMAIL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify(buildInvitePayload(args)),
  });
  if (!res.ok) throw new Error(`DMAIL error ${res.status}: ${await res.text()}`);
  return { success: true };
}

export interface OrgInviteEmailArgs {
  to: string;
  orgName: string;
  role: OrgInviteRole;
  inviteLink: string;
  senderName: string;
}

export function buildOrgInvitePayload(args: OrgInviteEmailArgs): DmailPayload {
  const roleText = args.role === "admin" ? "Admin" : "Member";
  return {
    templateId: INVITATION_TEMPLATE_ID,
    to: [{ email: args.to, name: args.to }],
    subject: `คำเชิญร่วม workspace ${args.orgName} — FITT Builder`,
    variables: {
      name: args.to,
      companyName: args.orgName,
      branchName: "-",
      roleText,
      invitationLink: args.inviteLink,
      senderName: args.senderName,
      year: new Date().getFullYear().toString(),
    },
  };
}

export async function sendOrgInviteEmail(args: OrgInviteEmailArgs): Promise<{ success: boolean }> {
  const apiKey = process.env.DMAIL_API_KEY;
  if (!apiKey) {
    console.error("[email] DMAIL_API_KEY not set — skipping org invite email");
    return { success: false };
  }
  const res = await fetch(DMAIL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify(buildOrgInvitePayload(args)),
  });
  if (!res.ok) throw new Error(`DMAIL error ${res.status}: ${await res.text()}`);
  return { success: true };
}

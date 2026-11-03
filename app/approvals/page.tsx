import SettingsShell from "@/components/settings/SettingsShell";
import ApprovalsView from "@/components/approvals/ApprovalsView";

export const metadata = { title: "อนุมัติเอกสาร" };

/** Quotations and proposals waiting on the signed-in approver (migration 0063). */
export default function ApprovalsPage() {
  return (
    <SettingsShell>
      <ApprovalsView />
    </SettingsShell>
  );
}

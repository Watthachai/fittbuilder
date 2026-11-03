import SettingsShell from "@/components/settings/SettingsShell";
import CompanyView from "@/components/company/CompanyView";

export const metadata = { title: "บริษัท" };

/** The signed-in person's company: its people and who approves (migration 0065). */
export default function CompanyPage() {
  return (
    <SettingsShell>
      <CompanyView />
    </SettingsShell>
  );
}

import SettingsShell from "@/components/settings/SettingsShell";
import CasesView from "@/components/cases/CasesView";

export const metadata = { title: "แจ้งเคส / ติดตามปัญหา" };

/** Every case the viewer may see; ?id= opens one (the link a report dialog hands out). */
export default async function CasesPage(props: PageProps<"/cases">) {
  const { id } = await props.searchParams;
  return (
    <SettingsShell>
      <CasesView initialId={typeof id === "string" ? id : null} />
    </SettingsShell>
  );
}

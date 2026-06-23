import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-server";
import SkillAdmin from "@/components/admin/SkillAdmin";

export const metadata = { title: "Admin · Skill Templates" };

export default async function AdminSkillsPage() {
  const user = await getAdminUser();
  if (!user) redirect("/");
  return <SkillAdmin />;
}

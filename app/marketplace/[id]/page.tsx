import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SystemDetail from "@/components/marketplace/SystemDetail";
import { FAMILIES, getModule } from "@/lib/modules/registry";
import { FAMILY_ORDER } from "@/lib/modules/types";
import type { ModuleFamily } from "@/lib/modules/types";

const isFamily = (id: string): id is ModuleFamily => (FAMILY_ORDER as string[]).includes(id);

export function generateStaticParams() {
  return FAMILIES.map((f) => ({ id: f.id }));
}

export async function generateMetadata(props: PageProps<"/marketplace/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const system = FAMILIES.find((f) => f.id === id);
  if (!system) return { title: "ไม่พบระบบ" };
  return { title: `ระบบ${system.name} · มาร์เก็ตเพลส`, description: system.blurb };
}

export default async function SystemListingPage(props: PageProps<"/marketplace/[id]">) {
  const { id } = await props.params;
  // A module id from an old link lands on the system the module is part of.
  const module = getModule(id);
  if (module) redirect(`/marketplace/${module.family}`);
  if (!isFamily(id)) redirect("/marketplace");
  return <SystemDetail family={id} />;
}

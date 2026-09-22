import type { Metadata } from "next";
import ModuleDetail from "@/components/marketplace/ModuleDetail";
import { MODULES, getModule } from "@/lib/modules/registry";

export function generateStaticParams() {
  return MODULES.map((m) => ({ id: m.id }));
}

export async function generateMetadata(props: PageProps<"/marketplace/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const m = getModule(id);
  if (!m) return { title: "ไม่พบโมดูล" };
  return { title: `${m.name} · มาร์เก็ตเพลสโมดูล`, description: m.pitch };
}

export default async function ModuleListingPage(props: PageProps<"/marketplace/[id]">) {
  const { id } = await props.params;
  return <ModuleDetail id={id} />;
}

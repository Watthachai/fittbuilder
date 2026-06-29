import OrgDnaEditor from "@/components/org/OrgDnaEditor";

export const metadata = { title: "Org DNA" };

export default async function OrgPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrgDnaEditor orgId={id} />;
}

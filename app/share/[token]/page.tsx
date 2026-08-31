import type { Metadata } from "next";
import ShareViewer from "@/components/share/ShareViewer";

export const metadata: Metadata = {
  title: "Demo ที่แชร์มา",
};

export default async function SharedDemoPage(props: PageProps<"/share/[token]">) {
  const { token } = await props.params;
  return <ShareViewer token={token} />;
}

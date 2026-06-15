import type { Metadata } from "next";
import ShareViewer from "@/components/share/ShareViewer";

export const metadata: Metadata = {
  title: "Demo ที่แชร์มา",
};

export default function SharePage() {
  return <ShareViewer />;
}

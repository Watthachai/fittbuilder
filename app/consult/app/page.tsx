import { Suspense } from "react";
import type { Metadata } from "next";
import ConsultShell from "@/components/consult/ConsultShell";

export const metadata: Metadata = {
  title: "FITT Consult — ที่ปรึกษาธุรกิจจากข้อมูลจริงขององค์กร",
  description:
    "วิเคราะห์เสียงลูกค้าเป็น Pain Point และตรวจสุขภาพธุรกิจ 5 ด้าน จากข้อมูลจริงของทีมคุณ",
};

/** The working Consult app — the shell reads ?org= via useSearchParams, so it
 *  mounts under Suspense per the App Router contract. */
export default function ConsultAppPage() {
  return (
    <Suspense>
      <ConsultShell />
    </Suspense>
  );
}

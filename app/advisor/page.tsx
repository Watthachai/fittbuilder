import { Suspense } from "react";
import type { Metadata } from "next";
import AdvisorShell from "@/components/advisor/AdvisorShell";

export const metadata: Metadata = {
  title: "FITT Advisor — ที่ปรึกษาธุรกิจจากข้อมูลจริงขององค์กร",
  description:
    "วิเคราะห์เสียงลูกค้าเป็น Pain Point และตรวจสุขภาพธุรกิจ 5 ด้าน จากข้อมูลจริงของทีมคุณ",
};

/** FITT Advisor module — the shell reads ?org= via useSearchParams, so it
 *  mounts under Suspense per the App Router contract. */
export default function AdvisorPage() {
  return (
    <Suspense>
      <AdvisorShell />
    </Suspense>
  );
}

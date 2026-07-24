import type { Metadata } from "next";
import { Fustat, Outfit } from "next/font/google";
import ConsultLanding from "@/components/consult/ConsultLanding";

// The Consult landing is a deliberate light-theme island (per its design
// blueprint): Outfit for display, Fustat for the brand mark — loaded here and
// exposed as CSS variables so the client component stays font-agnostic.
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
});
const fustat = Fustat({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-fustat",
});

export const metadata: Metadata = {
  title: "FITT Consult — Your All-in-One Business Consult",
  description:
    "ที่ปรึกษาธุรกิจ AI จากข้อมูลจริงขององค์กร — หา Pain Point จากเสียงลูกค้า และตรวจสุขภาพธุรกิจ 5 ด้าน พร้อมที่มาอ้างอิงทุกข้อสรุป",
};

export default function ConsultLandingPage() {
  return (
    <div className={`${outfit.variable} ${fustat.variable}`}>
      <ConsultLanding />
    </div>
  );
}

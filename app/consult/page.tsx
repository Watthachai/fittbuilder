import type { Metadata } from "next";
import localFont from "next/font/local";
import ConsultLanding from "@/components/consult/ConsultLanding";

// The Consult landing is a deliberate light-theme island (per its design
// blueprint): Outfit for display, Fustat for the brand mark — loaded here and
// exposed as CSS variables so the client component stays font-agnostic.
// Both are the Google Fonts latin files (variable, OFL) kept in the repo: the
// production build fetching them from Google failed with "next/font/google
// queries have exactly one entry" — Outfit twice on 2026-10-30, Fustat on
// 2026-11-03 — while the same commits built on sandbox.
const outfit = localFont({
  src: "./fonts/outfit-latin.woff2",
  weight: "100 900",
  variable: "--font-outfit",
});
const fustat = localFont({
  src: "./fonts/fustat-latin.woff2",
  weight: "200 800",
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

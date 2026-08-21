import type { ShowcaseTile } from "@/components/landing/ShowcaseMarquee";

/**
 * The demo screens shown on the landing page.
 *
 * Every entry is a real capture taken by the screen inventory from a demo that
 * was running in the browser — cropped to its top band, where the navigation
 * and hero sit, and re-encoded as webp (the whole set is ~230KB).
 *
 * Only systems with INVENTED brands belong here. Two thirds of the captures on
 * hand come from named companies, and putting one of those on a public page
 * announces a client relationship that nobody agreed to. Adding a system is a
 * decision about permission first and layout second.
 *
 * Interleaved on purpose: split into two rows in order, each row would be a
 * single system's palette end to end.
 */
export const SHOWCASE: ShowcaseTile[] = [
  { src: "/showcase/pace-00.webp", system: "Pace", screen: "หน้าหลัก" },
  { src: "/showcase/kroma-00.webp", system: "KROMA", screen: "แคตตาล็อกสินค้า" },
  { src: "/showcase/pace-02.webp", system: "Pace", screen: "การวิ่งทั้งหมด" },
  { src: "/showcase/kroma-06.webp", system: "KROMA", screen: "สรุปยอดขาย (KPI)" },
  { src: "/showcase/pace-04.webp", system: "Pace", screen: "สถิติวิเคราะห์" },
  { src: "/showcase/kroma-03.webp", system: "KROMA", screen: "หน้าชำระเงิน" },
  { src: "/showcase/pace-06.webp", system: "Pace", screen: "โปรไฟล์" },
  { src: "/showcase/kroma-01.webp", system: "KROMA", screen: "รายละเอียดสินค้า" },
  { src: "/showcase/pace-03.webp", system: "Pace", screen: "รายละเอียดการวิ่ง" },
  { src: "/showcase/kroma-05.webp", system: "KROMA", screen: "ประวัติและสถานะคำสั่งซื้อ" },
  { src: "/showcase/pace-05.webp", system: "Pace", screen: "ตารางซ้อม" },
  { src: "/showcase/kroma-02.webp", system: "KROMA", screen: "ตะกร้าสินค้า" },
  { src: "/showcase/pace-01.webp", system: "Pace", screen: "บันทึกการวิ่ง" },
  { src: "/showcase/kroma-04.webp", system: "KROMA", screen: "ยืนยันคำสั่งซื้อ" },
];

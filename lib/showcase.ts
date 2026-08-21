import type { ShowcaseTile } from "@/components/landing/ShowcaseMarquee";

/**
 * The demo screens shown on the landing page.
 *
 * Every entry is a real capture taken by the screen inventory from a demo that
 * was running in the browser — cropped to its top band, where the navigation and
 * hero sit, and re-encoded as webp.
 *
 * Sign-in screens are left out too — a centred form on an empty page says
 * nothing about what the system does.
 *
 * Only TOP-LEVEL screens are here, never modals: a modal is a cropped dialog
 * over a dimmed page and reads as noise at thumbnail size.
 *
 * Several of these carry real client and company names, and four of the systems
 * were built by other people on the team rather than by us. Publishing them on a
 * public page is a decision about permission before it is a decision about
 * layout — it was made explicitly, and adding a system means making it again.
 *
 * Dealt round-robin across systems on purpose: grouped by project, two screens
 * of the same app end up side by side and read as one wide image.
 */
export const SHOWCASE: ShowcaseTile[] = [
  { src: "/showcase/chokpranee-0.webp", system: "Chokpranee Fabric", screen: "ภาพรวมคลัง (Dashboard)" },
  { src: "/showcase/jaserp-0.webp", system: "JAS Sofa ERP", screen: "Dashboard ภาพรวม" },
  { src: "/showcase/ar-0.webp", system: "AR Outstanding", screen: "ภาพรวมยอดหนี้" },
  { src: "/showcase/jaspos-0.webp", system: "JAS Sofa POS", screen: "Dashboard" },
  { src: "/showcase/kroma-0.webp", system: "KROMA", screen: "แคตตาล็อกสินค้า" },
  { src: "/showcase/pace-0.webp", system: "Pace", screen: "หน้าหลัก" },
  { src: "/showcase/stock-0.webp", system: "Centralized Inventory", screen: "แดชบอร์ดสรุปยอด" },
  { src: "/showcase/booking-0.webp", system: "Booking", screen: "ปฏิทินห้องประชุม" },
  { src: "/showcase/chokpranee-1.webp", system: "Chokpranee Fabric", screen: "รหัสสินค้า (Product SKU)" },
  { src: "/showcase/auditflow-1.webp", system: "Audit Flow", screen: "เลือกบริษัท" },
  { src: "/showcase/jaserp-1.webp", system: "JAS Sofa ERP", screen: "จัดการลูกค้า (Customers)" },
  { src: "/showcase/dreamplus-1.webp", system: "Dream Plus 8", screen: "แดชบอร์ดสรุปผลผู้บริหาร" },
  { src: "/showcase/ar-1.webp", system: "AR Outstanding", screen: "วิเคราะห์ช่วงอายุหนี้" },
  { src: "/showcase/jaspos-1.webp", system: "JAS Sofa POS", screen: "Custom Sofa Configurator" },
  { src: "/showcase/kroma-1.webp", system: "KROMA", screen: "หน้าชำระเงิน" },
  { src: "/showcase/pace-1.webp", system: "Pace", screen: "การวิ่งทั้งหมด" },
  { src: "/showcase/stock-1.webp", system: "Centralized Inventory", screen: "สต็อกกลาง & ซิงค์ช่องทาง" },
  { src: "/showcase/booking-1.webp", system: "Booking", screen: "อนุมัติการจอง" },
  { src: "/showcase/chokpranee-2.webp", system: "Chokpranee Fabric", screen: "สต็อกม้วนผ้า (Roll Inventory)" },
  { src: "/showcase/auditflow-2.webp", system: "Audit Flow", screen: "คำขออนุมัติ e-Tax" },
  { src: "/showcase/jaserp-2.webp", system: "JAS Sofa ERP", screen: "ใบเสนอราคา / SO (MTO)" },
  { src: "/showcase/dreamplus-2.webp", system: "Dream Plus 8", screen: "ศูนย์เอกสาร AI (Document Inbox)" },
  { src: "/showcase/ar-2.webp", system: "AR Outstanding", screen: "รายชื่อลูกหนี้" },
  { src: "/showcase/jaspos-2.webp", system: "JAS Sofa POS", screen: "Sales Order & Deposit" },
  { src: "/showcase/kroma-2.webp", system: "KROMA", screen: "ยืนยันคำสั่งซื้อ" },
  { src: "/showcase/pace-2.webp", system: "Pace", screen: "รายละเอียดการวิ่ง" },
  { src: "/showcase/stock-2.webp", system: "Centralized Inventory", screen: "รับสินค้าเข้าคลัง (Inbound)" },
  { src: "/showcase/booking-2.webp", system: "Booking", screen: "การจองของฉัน" },
  { src: "/showcase/chokpranee-3.webp", system: "Chokpranee Fabric", screen: "บันทึก รับเข้า/จ่ายออก" },
  { src: "/showcase/auditflow-3.webp", system: "Audit Flow", screen: "เอกสารทั้งหมด" },
  { src: "/showcase/jaserp-3.webp", system: "JAS Sofa ERP", screen: "บันทึกเงินมัดจำ (Deposits)" },
  { src: "/showcase/dreamplus-3.webp", system: "Dream Plus 8", screen: "คลังสินค้าอัจฉริยะ (Inventory)" },
  { src: "/showcase/ar-3.webp", system: "AR Outstanding", screen: "ใบแจ้งหนี้" },
  { src: "/showcase/jaspos-3.webp", system: "JAS Sofa POS", screen: "Production & QC Tracking" },
  { src: "/showcase/kroma-3.webp", system: "KROMA", screen: "ประวัติและสถานะคำสั่งซื้อ" },
  { src: "/showcase/pace-3.webp", system: "Pace", screen: "สถิติวิเคราะห์" },
  { src: "/showcase/stock-3.webp", system: "Centralized Inventory", screen: "ปรับปรุงสต็อก (Adjustment)" },
];

import type { SkillTemplate } from "./types";

export const BOOKING: SkillTemplate = {
  id: "booking",
  name: "ระบบจอง",
  nameEn: "Booking",
  tagline: "นัดหมาย · ห้องพัก · ตั๋ว · โต๊ะ",
  icon: "CalendarCheck",
  keywords: ["booking", "appointment", "reservation", "schedule", "calendar", "จอง", "นัดหมาย", "ห้องพัก", "ตั๋ว", "คิว"],
  persona:
    "คุณคือผู้เชี่ยวชาญระบบจอง/scheduling ที่คิดเป็น availability, slot และ confirmation ถามประเภทการจอง, flow และ role ให้ชัดเพื่อกัน double-booking",
  questionBank: [
    { id: "bookingType", label: "ประเภทการจอง?", type: "single", options: ["Appointment", "Room/Hotel", "Event ticket", "Restaurant table"], why: "ประเภทกำหนด resource และ field ของการจอง" },
    { id: "flow", label: "Flow การจอง?", type: "single", options: ["Calendar pick → form → confirm", "List → detail → book"], why: "flow กำหนดลำดับหน้าจอ" },
    { id: "roles", label: "Roles?", type: "multi", options: ["Customer", "Staff", "Admin"], why: "แยกมุมมองผู้จองกับผู้ดูแลตาราง" },
  ],
  domainKnowledge:
    "## Booking\nentities: Resource (ห้อง/โต๊ะ/ช่าง/รอบ), Slot (วันเวลา + availability), Booking (resource, customer, สถานะ), Customer.\nflow: เลือก resource/วันเวลา → ฟอร์ม → ยืนยัน. กัน double-booking. KPI: occupancy, การจองวันนี้.",
  buildGuidance:
    "## Build\nหน้าจอ: Calendar/slot picker (slot ว่าง/เต็มสีต่างกัน), ฟอร์มจอง, หน้ายืนยัน, มุม Admin = ตารางการจองทั้งหมด + สถานะ. badge: ว่าง/เต็ม/ยกเลิก.",
  seedData:
    "## Seed\nResources 4-6 (ห้อง/โต๊ะ). Slots ของสัปดาห์นี้ (บางช่องเต็ม). Bookings 8-10 รายการหลายสถานะ (ยืนยัน/รอ/ยกเลิก) + ชื่อลูกค้า.",
};

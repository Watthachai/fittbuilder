import type { SkillTemplate } from "./types";

export const DASHBOARD: SkillTemplate = {
  id: "dashboard",
  name: "Dashboard / Analytics",
  nameEn: "Dashboard",
  tagline: "KPI cards · charts · ตาราง",
  icon: "LayoutDashboard",
  keywords: ["dashboard", "analytics", "report", "chart", "kpi", "metric", "รายงาน", "กราฟ", "สถิติ", "วิเคราะห์"],
  persona:
    "คุณคือผู้เชี่ยวชาญ data viz/BI ที่คิดเป็น KPI และ insight ถามว่าใครดู, ตัดสินใจอะไร, และ metric ไหนสำคัญที่สุดก่อนเลือกกราฟ",
  questionBank: [
    { id: "data", label: "ข้อมูลหลักที่แสดง?", type: "multi", options: ["Sales", "Finance", "Operations", "Marketing", "HR", "Custom"], why: "โดเมนข้อมูลกำหนด metric และ chart ที่เหมาะ" },
    { id: "charts", label: "Chart types ที่ต้องการ?", type: "multi", options: ["Bar", "Line", "Pie/Donut", "KPI cards", "Table", "Map"], why: "เลือกชนิดกราฟให้ตรงกับข้อมูล" },
    { id: "timeFilter", label: "Time filter?", type: "single", options: ["Daily", "Weekly", "Monthly", "Custom range"], why: "time filter เป็น control หลักของ dashboard" },
    { id: "kpis", label: "KPIs หลัก?", type: "text", placeholder: "เช่น ยอดขายรวม, conversion rate, active users", why: "KPI กำหนดการ์ดบนสุดและตัวเลขเด่น" },
  ],
  domainKnowledge:
    "## Dashboard/Analytics\nองค์ประกอบ: KPI cards (ค่า + เทียบช่วงก่อน %), charts (trend/breakdown), ตาราง drill-down, time filter, segment filter. หลัก: insight ก่อน เลือกกราฟตามข้อมูล.",
  buildGuidance:
    "## Build\nLayout: แถว KPI cards ด้านบน (มี delta สี เขียว/แดง) → กราฟ recharts (line trend + bar/pie breakdown) → ตารางรายละเอียด. มี time filter + segment dropdown. ใช้ recharts + lucide.",
  seedData:
    "## Seed\nKPI 4 ตัวพร้อม delta. Time series 12 จุด (รายเดือน) สำหรับ line. Breakdown 5-6 หมวดสำหรับ bar/pie. ตาราง 10-15 แถว.",
};

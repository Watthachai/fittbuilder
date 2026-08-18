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
  premiumOptions: [
    { id: "anomaly", name: "จับตัวเลขผิดปกติเองแล้วเตือน", pitch: "แดชบอร์ดที่ต้องมีคนนั่งจ้องถึงจะรู้ว่าผิดปกติ คือแดชบอร์ดที่ไม่มีใครเปิด", requires: [], effortDays: 3, build: "เทียบกับค่าปกติของช่วงเดียวกัน → ชูตัวที่หลุดกรอบขึ้นบนสุดพร้อมบอกว่าหลุดไปเท่าไหร่และตั้งแต่เมื่อไหร่" },
    { id: "forecast", name: "เส้นแนวโน้มล่วงหน้า", pitch: "ตัวเลขเดือนนี้บอกว่าเกิดอะไรไปแล้ว ไม่ได้บอกว่าจะจบเดือนที่เท่าไหร่", requires: ["chart"], effortDays: 3, build: "คาดการณ์จากแนวโน้มย้อนหลังพร้อมช่วงความเชื่อมั่น และเทียบกับเป้าที่ตั้งไว้" },
    { id: "askdata", name: "ถามเป็นภาษาคน ตอบจากข้อมูลจริง", pitch: "คำถามที่ผู้บริหารอยากรู้ ไม่เคยตรงกับกราฟที่มีอยู่พอดี", requires: [], effortDays: 4, build: "ช่องถามที่ตอบจากข้อมูลในเดโมเท่านั้น พร้อมกราฟประกอบคำตอบและบอกว่าอ้างอิงจากตัวเลขชุดไหน" },
    { id: "schedreport", name: "ส่งสรุปเข้าอีเมล/LINE ตามเวลา", pitch: "คนที่ต้องเห็นตัวเลขที่สุดคือคนที่ไม่เปิดระบบ", requires: [], effortDays: 2, build: "ตั้งเวลาและผู้รับ + ตัวอย่างสรุปที่จะถูกส่ง + ประวัติการส่ง" },
  ],
};

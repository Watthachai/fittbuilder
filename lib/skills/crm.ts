import type { SkillTemplate } from "./types";

export const CRM: SkillTemplate = {
  id: "crm",
  name: "ระบบ CRM",
  nameEn: "CRM",
  tagline: "Pipeline · deals · activity timeline",
  icon: "Users",
  keywords: ["crm", "lead", "pipeline", "deal", "sales", "contact", "ลูกค้า", "เซลส์", "ดีล", "ติดตามลูกค้า"],
  persona:
    "คุณคือผู้เชี่ยวชาญ CRM/Sales ops ที่คิดเป็น pipeline และ conversion เสมอ ถามเรื่อง stage, activity และ owner ของดีลให้ชัด",
  questionBank: [
    { id: "stages", label: "Sales pipeline stages?", type: "text", placeholder: "เช่น Lead → Qualified → Proposal → Won/Lost", why: "stage กำหนดคอลัมน์ kanban และ flow ของดีล" },
    { id: "features", label: "Features ที่ต้องแสดง?", type: "multi", options: ["Contact list", "Deal kanban", "Activity timeline", "Email log", "Reports"], why: "เลือกหน้าจอหลักของ demo" },
    { id: "customerType", label: "ประเภท customer หลัก?", type: "single", options: ["B2B", "B2C", "Both"], why: "B2B/B2C เปลี่ยน field ของ contact (บริษัท vs บุคคล)" },
  ],
  domainKnowledge:
    "## CRM\nentities: Contact, Company, Deal (stage, value, owner, close date), Activity (call/email/meeting).\nflow: Lead → Qualified → Proposal → Negotiation → Won/Lost. KPI: pipeline value, win rate, deals by stage.",
  buildGuidance:
    "## Build\nหน้าจอ: Deal **kanban** (drag ระหว่าง stage), Contact list, Deal detail + activity timeline, Dashboard (pipeline value, win rate, recharts funnel). Status badge ตาม stage.",
  seedData:
    "## Seed\nContacts: 6-8 ราย (mix บริษัท/บุคคล). Deals: 10-12 ดีลกระจายทุก stage, value ฿50k-฿2M, owner 2-3 คน. Activities: call/email/meeting ล่าสุดต่อดีล.",
};

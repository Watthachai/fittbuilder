/** Spec-to-Demo preset definitions (PRD §9.4). */

export type QuestionType = "single" | "multi" | "text";

export interface PresetQuestion {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
  placeholder?: string;
}

export interface Preset {
  id: string;
  name: string;
  nameEn: string;
  tagline: string;
  keywords: string[];
  questions: PresetQuestion[];
}

export const PRESETS: Preset[] = [
  {
    id: "erp",
    name: "ระบบ ERP",
    nameEn: "ERP",
    tagline: "Finance, คลังสินค้า, จัดซื้อ, อนุมัติ",
    keywords: [
      "erp", "purchase order", "procurement", "inventory", "warehouse",
      "จัดซื้อ", "คลังสินค้า", "ใบขอซื้อ", "อนุมัติ", "บัญชี", "การผลิต",
    ],
    questions: [
      {
        id: "modules",
        label: "โมดูลหลักที่ต้องการใน demo?",
        type: "multi",
        options: ["Finance", "HR", "คลังสินค้า", "จัดซื้อ (PR→PO)", "การผลิต", "รายงาน"],
      },
      {
        id: "roles",
        label: "User roles ใน system?",
        type: "multi",
        options: ["Admin", "Manager", "พนักงาน", "CFO", "Auditor"],
      },
      {
        id: "workflow",
        label: "Workflow หลักที่ต้องเห็น?",
        type: "single",
        options: ["PR→PO→GR→Invoice", "Leave→Approval", "Stock in/out", "Custom"],
      },
      {
        id: "kpis",
        label: "KPI หลักบน dashboard?",
        type: "text",
        placeholder: "เช่น ยอดสั่งซื้อค้างอนุมัติ, มูลค่าสต็อกคงเหลือ",
      },
    ],
  },
  {
    id: "crm",
    name: "ระบบ CRM",
    nameEn: "CRM",
    tagline: "Pipeline, deals, activity timeline",
    keywords: [
      "crm", "lead", "pipeline", "deal", "sales", "contact",
      "ลูกค้า", "เซลส์", "ดีล", "ติดตามลูกค้า",
    ],
    questions: [
      {
        id: "stages",
        label: "Sales pipeline stages?",
        type: "text",
        placeholder: "เช่น Lead → Qualified → Proposal → Won/Lost",
      },
      {
        id: "features",
        label: "Features ที่ต้องแสดง?",
        type: "multi",
        options: ["Contact list", "Deal kanban", "Activity timeline", "Email log", "Reports"],
      },
      {
        id: "customerType",
        label: "ประเภท customer หลัก?",
        type: "single",
        options: ["B2B", "B2C", "Both"],
      },
    ],
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    nameEn: "E-commerce",
    tagline: "ร้านค้า, ตะกร้า, checkout",
    keywords: [
      "ecommerce", "e-commerce", "shop", "cart", "checkout", "product",
      "ร้านค้า", "สินค้า", "ตะกร้า", "สั่งซื้อ", "ขายของ",
    ],
    questions: [
      {
        id: "productType",
        label: "ประเภทสินค้า?",
        type: "single",
        options: ["Physical", "Digital", "Service"],
      },
      {
        id: "pages",
        label: "หน้าหลักที่ต้องการ?",
        type: "multi",
        options: ["Homepage", "Product listing", "Product detail", "Cart", "Checkout", "Order tracking"],
      },
      {
        id: "style",
        label: "สไตล์?",
        type: "single",
        options: ["Minimal", "Luxury/Premium", "Marketplace", "ตาม brand guideline ใน PRD"],
      },
    ],
  },
  {
    id: "dashboard",
    name: "Dashboard / Analytics",
    nameEn: "Dashboard",
    tagline: "KPI cards, charts, ตาราง",
    keywords: [
      "dashboard", "analytics", "report", "chart", "kpi", "metric",
      "รายงาน", "กราฟ", "สถิติ", "วิเคราะห์",
    ],
    questions: [
      {
        id: "data",
        label: "ข้อมูลหลักที่แสดง?",
        type: "multi",
        options: ["Sales", "Finance", "Operations", "Marketing", "HR", "Custom"],
      },
      {
        id: "charts",
        label: "Chart types ที่ต้องการ?",
        type: "multi",
        options: ["Bar", "Line", "Pie/Donut", "KPI cards", "Table", "Map"],
      },
      {
        id: "timeFilter",
        label: "Time filter?",
        type: "single",
        options: ["Daily", "Weekly", "Monthly", "Custom range"],
      },
      {
        id: "kpis",
        label: "KPIs หลัก?",
        type: "text",
        placeholder: "เช่น ยอดขายรวม, conversion rate, active users",
      },
    ],
  },
  {
    id: "booking",
    name: "ระบบจอง",
    nameEn: "Booking",
    tagline: "นัดหมาย, ห้องพัก, ตั๋ว, โต๊ะ",
    keywords: [
      "booking", "appointment", "reservation", "schedule", "calendar",
      "จอง", "นัดหมาย", "ห้องพัก", "ตั๋ว", "คิว",
    ],
    questions: [
      {
        id: "bookingType",
        label: "ประเภทการจอง?",
        type: "single",
        options: ["Appointment", "Room/Hotel", "Event ticket", "Restaurant table"],
      },
      {
        id: "flow",
        label: "Flow การจอง?",
        type: "single",
        options: ["Calendar pick → form → confirm", "List → detail → book"],
      },
      {
        id: "roles",
        label: "Roles?",
        type: "multi",
        options: ["Customer", "Staff", "Admin"],
      },
    ],
  },
  {
    id: "landing",
    name: "Landing Page",
    nameEn: "Landing",
    tagline: "Hero, pricing, testimonials, CTA",
    keywords: [
      "landing", "marketing", "campaign", "hero", "cta", "conversion",
      "แลนดิ้ง", "โปรโมท", "แคมเปญ", "เปิดตัว",
    ],
    questions: [
      {
        id: "goal",
        label: "เป้าหมายหลักของ page?",
        type: "single",
        options: ["Lead gen", "Product launch", "Event reg", "App download"],
      },
      {
        id: "sections",
        label: "Sections ที่ต้องการ?",
        type: "multi",
        options: ["Hero", "Features", "Pricing", "Testimonials", "FAQ", "CTA", "Footer"],
      },
      {
        id: "style",
        label: "สไตล์?",
        type: "single",
        options: ["Minimal/Clean", "Bold/Startup", "Corporate", "Creative"],
      },
    ],
  },
];

export const PRESET_IDS = PRESETS.map((p) => p.id);

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Keyword-scoring fallback when the model can't classify a document. */
export function detectPresetByKeywords(text: string): { presetId: string; score: number } {
  const lower = text.toLowerCase();
  let best = { presetId: "landing", score: 0 };
  for (const preset of PRESETS) {
    let score = 0;
    for (const kw of preset.keywords) {
      if (lower.includes(kw.toLowerCase())) score += 1;
    }
    if (score > best.score) best = { presetId: preset.id, score };
  }
  return best;
}

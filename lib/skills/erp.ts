import type { SkillTemplate } from "./types";

/**
 * ERP — the flagship deep template. Persona, question bank, domain knowledge,
 * build guidance and seed data are written to make the interview and the demo
 * read like a real enterprise ERP (procure-to-pay focused).
 */
export const ERP: SkillTemplate = {
  id: "erp",
  name: "ระบบ ERP",
  nameEn: "ERP",
  tagline: "Finance · คลังสินค้า · จัดซื้อ · อนุมัติ — procure-to-pay ครบวงจร",
  icon: "Factory",
  keywords: [
    "erp", "purchase order", "procurement", "inventory", "warehouse", "po", "pr",
    "goods receipt", "supplier", "vendor", "approval", "stock",
    "จัดซื้อ", "คลังสินค้า", "ใบขอซื้อ", "ใบสั่งซื้อ", "อนุมัติ", "บัญชี",
    "การผลิต", "สต็อก", "ซัพพลายเออร์", "ผู้ขาย", "รับสินค้า", "เบิกจ่าย",
  ],

  persona: [
    "คุณคือที่ปรึกษา ERP ระดับ enterprise ที่เคย implement SAP, Oracle และ Odoo ให้องค์กรขนาดกลาง-ใหญ่",
    "คุณคิดเป็นกระบวนการ procure-to-pay (PR → PO → GR → Invoice → Payment) และ order-to-cash เสมอ",
    "คุณรู้ว่า ERP ที่ดีต้องมี master data ที่สะอาด, approval matrix ที่ชัด, และ audit trail ที่ตรวจสอบได้",
    "เวลาสัมภาษณ์ คุณถามด้วยศัพท์โดเมนจริง (PR, PO, GRN, 3-way match, reorder point) และไม่ปล่อยให้คำตอบคลุมเครือ",
    "คุณเสนอ best practice เชิงรุก เช่น แนะนำ approval ตามวงเงิน, การตัดสต็อกแบบ FIFO, การแยกสิทธิ์ตาม role",
  ].join("\n"),

  questionBank: [
    {
      id: "modules",
      label: "โมดูลหลักที่ต้องการใน demo? (เลือกได้หลายอัน)",
      type: "multi",
      options: ["Finance/บัญชี", "Inventory/คลังสินค้า", "Procurement/จัดซื้อ", "Manufacturing/การผลิต", "HR", "Sales/ขาย"],
      why: "ERP เป็น suite — ต้องรู้ขอบเขตโมดูลเพื่อไม่สร้างเกินหรือขาด",
    },
    {
      id: "p2p_flow",
      label: "Workflow จัดซื้อหลักที่ต้องเห็นใน demo?",
      type: "single",
      options: ["PR → PO → GR → Invoice → Payment (เต็มวงจร)", "PO → GR → Invoice", "PR → PO เท่านั้น", "อื่นๆ (ระบุ)"],
      why: "procure-to-pay คือหัวใจ ERP — flow กำหนดหน้าจอและสถานะเอกสารทั้งหมด",
    },
    {
      id: "roles",
      label: "User roles ในระบบ?",
      type: "multi",
      options: ["Requester/ผู้ขอซื้อ", "Approver/ผู้อนุมัติ", "Buyer/ฝ่ายจัดซื้อ", "Warehouse/คลัง", "Finance/บัญชี", "CFO", "Auditor"],
      why: "ERP ต้องแยกสิทธิ์ตาม role — กำหนดว่าใครเห็น/ทำอะไรได้ และ role switcher ใน demo",
    },
    {
      id: "approval",
      label: "เกณฑ์การอนุมัติ (approval matrix)?",
      type: "single",
      options: [
        "ตามวงเงิน (เช่น < 50k หัวหน้า, < 500k ผจก., เกินนั้น CFO)",
        "อนุมัติชั้นเดียว",
        "อนุมัติตามแผนก/ศูนย์ต้นทุน",
        "ยังไม่กำหนด — ขอคำแนะนำ",
      ],
      why: "approval matrix คือสิ่งที่ทำให้ ERP ต่างจาก to-do list — กำหนด logic การ route เอกสาร",
    },
    {
      id: "entities",
      label: "Master data หลักที่ระบบจัดการ?",
      type: "multi",
      options: ["สินค้า/วัตถุดิบ (Item)", "ซัพพลายเออร์ (Supplier)", "ลูกค้า (Customer)", "คลัง/location", "ผังบัญชี (CoA)"],
      why: "master data สะอาดคือรากฐาน ERP — กำหนด entity + ฟิลด์ที่ต้องมี",
    },
    {
      id: "doc_numbering",
      label: "รูปแบบเลขที่เอกสาร?",
      type: "single",
      options: ["มี prefix + running (เช่น PO-2026-0001)", "running ธรรมดา", "ยังไม่กำหนด"],
      why: "เลขที่เอกสารแบบมีระบบทำให้ demo ดูเป็น ERP จริง (ไม่ใช่ id สุ่ม)",
    },
    {
      id: "currency",
      label: "ต้องรองรับหลายสกุลเงินไหม?",
      type: "single",
      options: ["THB อย่างเดียว", "หลายสกุล (THB/USD/...)"],
      why: "multi-currency เปลี่ยนการแสดงราคา/รวมยอด และ field ในเอกสาร",
    },
    {
      id: "kpis",
      label: "KPI หลักบน dashboard?",
      type: "text",
      placeholder: "เช่น ยอด PR รออนุมัติ, มูลค่าสต็อกคงเหลือ, PO เกินกำหนดส่ง, spend ต่อ supplier",
      why: "ผู้บริหาร ERP ดู dashboard ก่อน — KPI กำหนด chart + การ์ดบนหน้าแรก",
    },
  ],

  domainKnowledge: `## ERP Domain Knowledge (procure-to-pay focus)

**โมดูลมาตรฐาน**
- Finance: GL, AP/AR, ผังบัญชี (CoA), งบประมาณ
- Inventory: รับ/จ่าย/โอนสต็อก, reorder point, valuation (FIFO/Average)
- Procurement: PR (ใบขอซื้อ) → PO (ใบสั่งซื้อ) → GR/GRN (รับของ) → Invoice → Payment
- Manufacturing: BOM, work order, MRP (ถ้าเลือก)

**Procure-to-Pay flow (หัวใจ)**
1. Requester สร้าง **PR** (รายการ + จำนวน + ศูนย์ต้นทุน)
2. **Approver** อนุมัติตาม approval matrix (ตามวงเงิน)
3. Buyer แปลง PR เป็น **PO** ส่งให้ supplier
4. Warehouse รับของ → ออก **GR/GRN** (อาจรับบางส่วน)
5. Finance ทำ **3-way match** (PO ↔ GR ↔ Invoice) แล้วตั้งหนี้/จ่าย

**Roles & สิทธิ์**
Requester (สร้าง PR), Approver (อนุมัติ), Buyer (ออก PO), Warehouse (GR/สต็อก),
Finance (invoice/payment), CFO (อนุมัติวงเงินสูง), Auditor (อ่านอย่างเดียว + audit trail)

**Core entities + ฟิลด์สำคัญ**
- Item: SKU, ชื่อ, หน่วย (UoM), ราคา, reorder point, คลังที่เก็บ
- Supplier: รหัส, ชื่อ, ผู้ติดต่อ, เครดิตเทอม, สกุลเงิน
- PR/PO: เลขที่เอกสาร, วันที่, ผู้ขอ/ผู้ขาย, line items (item × qty × price), สถานะ, ยอดรวม
- GRN: อ้าง PO, รับจริงเท่าไร, สถานะ (รับครบ/รับบางส่วน)
- Invoice: อ้าง PO/GRN, ยอด, สถานะการจ่าย

**ศัพท์:** PR=Purchase Requisition, PO=Purchase Order, GR/GRN=Goods Receipt (Note),
3-way match=จับคู่ PO/GR/Invoice, AP=เจ้าหนี้, reorder point=จุดสั่งซื้อซ้ำ`,

  buildGuidance: `## ERP Build Guidance

**หน้าจอที่ควรมี (multi-screen, ใช้ sidebar nav)**
1. **Dashboard** — KPI cards (PR รออนุมัติ, มูลค่าสต็อก, PO เกินกำหนด, spend เดือนนี้) + recharts (bar: spend ต่อ supplier, line: แนวโน้มจัดซื้อ)
2. **PR list** — ตาราง + filter ตามสถานะ + ปุ่มสร้าง PR
3. **PO create/detail** — ฟอร์ม header + **line items แบบตาราง** (เพิ่ม/ลบแถว, คำนวณยอดรวมอัตโนมัติ)
4. **Approval inbox** — รายการรออนุมัติของฉัน + ปุ่มอนุมัติ/ตีกลับ (แสดง approval matrix)
5. **Goods Receipt** — รับของอ้าง PO (รับครบ/บางส่วน)
6. **Stock levels** — ตารางสต็อก + แจ้งเตือนต่ำกว่า reorder point (badge สีแดง)
7. **Supplier list** — master data

**UI patterns**
- **Role switcher** มุมบน (สลับเป็น Requester/Approver/Buyer/...) เพื่อโชว์สิทธิ์ต่างกัน
- **Status badges** สีตามสถานะ (Draft เทา, Pending Approval เหลือง, Approved เขียว, Rejected แดง)
- เลขที่เอกสารมี prefix + running (PO-2026-0001)
- ตารางแน่น, ตัวเลขจัดชิดขวา, มี currency format (฿1,250,000)
- ใช้ recharts สำหรับกราฟ, lucide-react สำหรับไอคอน`,

  seedData: `## ERP Seed Data (ใส่ลง demo ให้ดูสมจริง)

**Suppliers**
- SUP-001 บจก. สยามวัสดุ — เครดิต 30 วัน — THB
- SUP-002 Thai Steel Co. — เครดิต 45 วัน — THB
- SUP-003 Global Components Ltd. — เครดิต 60 วัน — USD

**Items**
- ITM-1001 เหล็กเส้น SD40 12mm — หน่วย: เส้น — ฿185 — reorder 200 — คงเหลือ 140 (ต่ำกว่า reorder!)
- ITM-1002 ปูนซีเมนต์ปอร์ตแลนด์ — หน่วย: ถุง — ฿155 — reorder 500 — คงเหลือ 1,240
- ITM-2001 มอเตอร์ 3 เฟส 5HP — หน่วย: ตัว — ฿8,900 — reorder 10 — คงเหลือ 6 (ต่ำกว่า reorder!)
- ITM-3001 น็อตสแตนเลส M8 — หน่วย: กล่อง — ฿320 — reorder 50 — คงเหลือ 88

**Purchase Orders**
- PO-2026-0001 → SUP-001 — 3 รายการ — ฿128,500 — สถานะ: Approved (รอรับของ)
- PO-2026-0002 → SUP-002 — 1 รายการ — ฿445,000 — สถานะ: Pending Approval (เกินวงเงิน ผจก.)
- PO-2026-0003 → SUP-003 — 5 รายการ — $12,400 — สถานะ: Approved (รับบางส่วน 3/5)

**Purchase Requisitions รออนุมัติ**
- PR-2026-0011 ฝ่ายผลิต — ฿62,000 — รอ Approver
- PR-2026-0012 ฝ่ายซ่อมบำรุง — ฿510,000 — รอ CFO (เกิน 500k)

**KPIs (ตัวอย่างค่าบน dashboard)**
- PR รออนุมัติ: 2 รายการ (฿572,000)
- มูลค่าสต็อกคงเหลือ: ฿2.4M
- PO เกินกำหนดส่ง: 1
- Spend เดือนนี้: ฿1.02M`,

  designHints:
    "โทน enterprise/จริงจัง: พื้นขาว/เทาอ่อน, sidebar เข้ม, accent น้ำเงิน, ตารางแน่นอ่านง่าย, ตัวเลขเด่น",
};

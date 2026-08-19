import type { SkillTemplate } from "./types";

export const ECOMMERCE: SkillTemplate = {
  id: "ecommerce",
  name: "E-commerce",
  nameEn: "E-commerce",
  tagline: "ร้านค้า · ตะกร้า · checkout",
  icon: "ShoppingCart",
  keywords: ["ecommerce", "e-commerce", "shop", "cart", "checkout", "product", "ร้านค้า", "สินค้า", "ตะกร้า", "สั่งซื้อ", "ขายของ"],
  persona:
    "คุณคือผู้เชี่ยวชาญ e-commerce ที่คิดเป็น conversion funnel (ดูสินค้า → ตะกร้า → checkout) และ merchandising ถามเรื่องประเภทสินค้า, หน้าจอ และสไตล์ให้ชัด",
  questionBank: [
    { id: "productType", label: "ประเภทสินค้า?", type: "single", options: ["Physical", "Digital", "Service"], why: "ประเภทสินค้าเปลี่ยน field (น้ำหนัก/สต็อก vs ดาวน์โหลด) และ flow checkout" },
    { id: "pages", label: "หน้าหลักที่ต้องการ?", type: "multi", options: ["Homepage", "Product listing", "Product detail", "Cart", "Checkout", "Order tracking"], why: "เลือกหน้าจอใน demo" },
    { id: "style", label: "สไตล์?", type: "single", options: ["Minimal", "Luxury/Premium", "Marketplace", "ตาม brand guideline ใน PRD"], why: "สไตล์กำหนด design direction ของร้าน" },
  ],
  domainKnowledge:
    "## E-commerce\nentities: Product (ชื่อ, ราคา, รูป, สต็อก, หมวด), Cart, Order (items, total, สถานะ), Customer.\nflow: listing → detail → add to cart → checkout → order confirm. KPI: ยอดขาย, AOV, conversion.",
  buildGuidance:
    "## Build\nหน้าจอ: Product grid + filter, Product detail (gallery + add to cart), Cart drawer, Checkout (form + สรุปยอด), Order confirmation. ใช้รูป placeholder สวยๆ, badge ลดราคา/หมด, ตะกร้า state คงค่า.",
  seedData:
    "## Seed\nProducts: 8-12 รายการมีรูป+ราคา+หมวด (บางตัวลดราคา/หมดสต็อก). Cart ตัวอย่าง 2-3 ชิ้น. Orders: 4-5 ออเดอร์หลายสถานะ (รอชำระ/กำลังส่ง/สำเร็จ).",
  premiumOptions: [
    { id: "viewer3d", name: "หมุนดูสินค้า 3 มิติ เปลี่ยนสี/วัสดุได้", pitch: "ลูกค้าเฟอร์นิเจอร์ กระเบื้อง หรือครัว ไม่กดซื้อเพราะนึกภาพของจริงไม่ออก — ให้เขาหมุนดูรอบตัวและสลับผ้า/สีเองจนมั่นใจ", requires: ["product", "detail"], effortDays: 5, build: "three.js turntable ใน useEffect + dispose ตอน cleanup, สลับวัสดุแบบ realtime, ปุ่มมุมกล้องสำเร็จรูป, auto-turntable ปิดได้" },
    { id: "advisor", name: "ผู้ช่วยเลือกของ", pitch: "คนซื้อไม่รู้ว่ารุ่นไหนเหมาะกับตัวเอง เลยออกจากเว็บไปถามที่อื่น — ให้ถามเป็นภาษาคนแล้วระบบคัดรุ่นที่ใช่ให้พร้อมเหตุผล", requires: ["product"], effortDays: 3, build: "แผงแชทข้างสินค้า ถามกลับเรื่องขนาด/งบ/การใช้งาน แล้วกรองรายการจริงในระบบพร้อมบอกเหตุผลที่เลือก" },
    { id: "bundle", name: "จัดชุดขายพ่วงอัตโนมัติ", pitch: "ยอดต่อบิลไม่โต เพราะไม่มีใครเสนอของที่ใช้คู่กัน — ระบบเสนอชุดที่เข้ากันพร้อมส่วนลดรวม", requires: ["cart"], effortDays: 2, build: "คำนวณของที่มักซื้อคู่กันจาก seed order แล้วเสนอเป็นชุดในหน้า detail และในตะกร้า" },
    { id: "abandoned", name: "ตามตะกร้าที่ถูกทิ้ง", pitch: "ของที่ใส่ตะกร้าแล้วหายไปคือยอดขายที่จับต้องได้ที่สุดที่ยังไม่ได้เก็บ", requires: ["cart"], effortDays: 2, build: "หน้าจอรวมตะกร้าค้างพร้อมอายุและมูลค่า + ร่างข้อความติดตามที่กดคัดลอกได้" },
  ],
};

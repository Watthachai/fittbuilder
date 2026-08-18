import type { SkillTemplate } from "./types";

export const LANDING: SkillTemplate = {
  id: "landing",
  name: "Landing Page",
  nameEn: "Landing",
  tagline: "Hero · pricing · testimonials · CTA",
  icon: "Rocket",
  keywords: ["landing", "marketing", "campaign", "hero", "cta", "conversion", "แลนดิ้ง", "โปรโมท", "แคมเปญ", "เปิดตัว"],
  persona:
    "คุณคือผู้เชี่ยวชาญ conversion/landing page ที่คิดเป็น message hierarchy และ CTA ถามเป้าหมาย, sections และสไตล์เพื่อให้หน้า convert",
  questionBank: [
    { id: "goal", label: "เป้าหมายหลักของ page?", type: "single", options: ["Lead gen", "Product launch", "Event reg", "App download"], why: "เป้าหมายกำหนด CTA และ section ที่ต้องเน้น" },
    { id: "sections", label: "Sections ที่ต้องการ?", type: "multi", options: ["Hero", "Features", "Pricing", "Testimonials", "FAQ", "CTA", "Footer"], why: "เลือกบล็อกเนื้อหาของหน้า" },
    { id: "style", label: "สไตล์?", type: "single", options: ["Minimal/Clean", "Bold/Startup", "Corporate", "Creative"], why: "สไตล์กำหนด design direction" },
  ],
  domainKnowledge:
    "## Landing Page\nโครง: Hero (headline + subhead + CTA), Features/benefits, Social proof (logos/testimonials), Pricing, FAQ, Final CTA, Footer. หลัก: 1 เป้าหมายชัด, CTA ซ้ำ, message hierarchy.",
  buildGuidance:
    "## Build\nหน้าเดียว scroll: Hero เด่น (gradient/รูป), grid features มีไอคอน (lucide), pricing cards (เน้น tier กลาง), testimonials, FAQ accordion, CTA band, footer. responsive, smooth scroll.",
  seedData:
    "## Seed\nHeadline + subhead. 3-6 features (ไอคอน+ข้อความ). 3 pricing tiers (ราคา+feature list). 2-3 testimonials (ชื่อ+บริษัท+คำพูด). 4-5 FAQ.",
  premiumOptions: [
    { id: "abtest", name: "ทำสองเวอร์ชันแล้ววัดว่าอันไหนดีกว่า", pitch: "พาดหัวที่ทีมชอบที่สุด กับพาดหัวที่คนกดมากที่สุด มักไม่ใช่อันเดียวกัน", requires: [], effortDays: 3, build: "สลับเวอร์ชันให้ผู้เข้าชมแบบสุ่ม + หน้าสรุปผลที่บอกว่าอันไหนชนะและมั่นใจแค่ไหน" },
    { id: "leadrouting", name: "ฟอร์มส่งเข้า CRM/LINE ทันที", pitch: "คนกรอกฟอร์มตอนสนใจที่สุด แต่กว่าจะมีคนติดต่อกลับคือวันรุ่งขึ้น", requires: ["form"], effortDays: 2, build: "ส่งต่อทันทีที่กรอก + หน้าจอรวม lead พร้อมสถานะติดตาม และแจ้งเตือนคนที่รับผิดชอบ" },
    { id: "personalize", name: "เปลี่ยนพาดหัวตามที่มาของผู้เข้าชม", pitch: "คนที่มาจากโฆษณาเรื่องราคา กับคนที่มาจากรีวิว ไม่ได้อยากอ่านประโยคเดียวกัน", requires: [], effortDays: 3, build: "จับ query/ที่มา แล้วสลับพาดหัวและภาพหลักตามกลุ่ม พร้อมหน้าตั้งค่าว่ากลุ่มไหนเห็นอะไร" },
  ],
};

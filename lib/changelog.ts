export type ChangeType = "feature" | "fix" | "improvement";

export interface ChangelogItem {
  type: ChangeType;
  text: string;
}

export interface ChangelogEntry {
  /** Semantic version (MAJOR.MINOR.PATCH). */
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  items: ChangelogItem[];
}

/** Badge label + theme class per change type (used by the /changelog page). */
export const CHANGE_BADGE: Record<ChangeType, { label: string; className: string }> = {
  feature: { label: "ใหม่", className: "bg-shine/15 text-shine" },
  fix: { label: "แก้ไข", className: "bg-halt/15 text-halt" },
  improvement: { label: "ปรับปรุง", className: "bg-go/15 text-go" },
};

// Newest first. SemVer: fix → PATCH, feature → MINOR, breaking → MAJOR.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.13.0",
    date: "2026-06-25",
    title: "เห็นเคอร์เซอร์ของเพื่อนร่วมทีมแบบเรียลไทม์",
    items: [
      { type: "feature", text: "Live cursors: เห็นเมาส์ของเพื่อนร่วมทีมเลื่อนแบบเรียลไทม์ทั่ว Studio พร้อมชื่อและสีประจำตัว — รวมถึงบนตัว prototype ที่กำลังรันด้วย" },
    ],
  },
  {
    version: "0.12.1",
    date: "2026-06-25",
    title: "แก้หน้าแชร์ทีมโหลดสมาชิก/คำเชิญไม่ขึ้น",
    items: [
      { type: "fix", text: "แก้หน้า “เชิญทีม” ที่ขึ้น “โหลดข้อมูลไม่สำเร็จ” และไม่แสดงสมาชิก/คำเชิญทั้งที่มีอยู่ — ตอนนี้ดึงรายชื่อสมาชิกพร้อมอีเมลได้ถูกต้อง" },
    ],
  },
  {
    version: "0.12.0",
    date: "2026-06-25",
    title: "แจ้งเตือนทั่วระบบ + ลากวางไฟล์ + แชททีมแบบ messenger",
    items: [
      { type: "feature", text: "ระบบแจ้งเตือน (toast) สวยๆ ทั่วทั้งเว็บ — บอกสำเร็จ/กำลังทำ/ผิดพลาด พร้อมรายละเอียดเข้าใจง่าย แทนที่จะเงียบไป" },
      { type: "feature", text: "ลากรูปหรือไฟล์มาวางในแชต AI และห้องแชททีมได้เลย มีอนิเมชันบอกจุดวาง และ skeleton ระหว่างรูปกำลังโหลด" },
      { type: "feature", text: "ห้องแชททีมแบบ messenger: ตอบกลับข้อความ (reply), กดรีแอกชันอีโมจิ และลบข้อความของตัวเองได้ — เห็นกันแบบเรียลไทม์" },
    ],
  },
  {
    version: "0.11.0",
    date: "2026-06-25",
    title: "แชต AI อ่านรูป/ไฟล์ได้ + เห็นว่าใครกำลังคุยกับ AI",
    items: [
      { type: "feature", text: "แนบรูปภาพหรือไฟล์ในแชต AI ได้ เช่น แคปหน้าจอ prototype แล้วบอกให้แก้ตรงนี้ AI จะอ่านประกอบแล้วทำให้เข้ากับโปรเจกต์ปัจจุบัน" },
      { type: "feature", text: "เมื่อแนบไฟล์อ้างอิง AI จะสรุปว่ามันเกี่ยวกับโปรเจกต์อย่างไร และเสนอว่าจะเพิ่มเนื้อหานั้นลงใน BRD/PRD ให้ไหม" },
      { type: "feature", text: "เห็นความเคลื่อนไหวในแชต AI แบบเรียลไทม์ — ใครกำลังพิมพ์ หรือกำลังสั่ง AI ทำงานอยู่" },
      { type: "improvement", text: "ขยายห้องแชททีมให้ใหญ่และยาวขึ้น อ่านง่ายขึ้น" },
    ],
  },
  {
    version: "0.10.0",
    date: "2026-06-25",
    title: "ห้องแชททีม + สิทธิ์ผู้ชม/ผู้แก้ไข + บันทึกการอนุมัติ",
    items: [
      { type: "feature", text: "ห้องแชททีมประจำโปรเจกต์: คุยกับทีมได้แยกจากแชท AI ส่งรูปและไฟล์เอกสารให้กันได้ พร้อมแจ้งเตือนข้อความที่ยังไม่ได้อ่าน" },
      { type: "feature", text: "ตัวบอก “กำลังพิมพ์…” ในห้องแชททีม เห็นแบบเรียลไทม์ว่าใครกำลังพิมพ์อยู่" },
      { type: "feature", text: "บันทึกกิจกรรมในห้องแชท: ขึ้น log ให้เห็นว่าใครอนุมัติขั้นไหนแล้ว (Define / Plan / Build / Verify / Review)" },
      { type: "improvement", text: "แยกสิทธิ์ชัดเจน — ผู้ชม (viewer) ดูอย่างเดียว ไม่เห็นช่องสั่งงาน AI ส่วนผู้แก้ไข (editor) ร่วมสร้างและอนุมัติได้ เจ้าของเปลี่ยนสิทธิ์สมาชิกได้จากหน้าแชร์" },
      { type: "fix", text: "แก้การอนุมัติค้าง: เดิมนับผู้ชมเป็นผู้อนุมัติด้วยทั้งที่กดอนุมัติไม่ได้ ทำให้ติดที่ “อนุมัติ 1/2” ตลอด — ตอนนี้ผู้แก้ไขและเจ้าของเท่านั้นที่นับเป็นผู้อนุมัติ" },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-06-25",
    title: "ทำงานร่วมกันแบบเรียลไทม์ + สร้างเบื้องหลัง + ส่งออกโปรเจกต์",
    items: [
      { type: "feature", text: "ทำงานร่วมกันแบบเรียลไทม์: เห็นข้อความและการแก้ไขของเพื่อนร่วมทีมทันที พร้อมรูปโปรไฟล์บอกว่าใครกำลังออนไลน์ดูโปรเจกต์นี้อยู่" },
      { type: "feature", text: "สร้างเบื้องหลัง: สั่งสร้างแล้วสลับไปหน้าอื่นได้เลย งานเดินต่อเบื้องหลัง มีตัวบอกสถานะทั่วทั้งเว็บ และดึงผลลัพธ์กลับมาให้อัตโนมัติเมื่อเสร็จ" },
      { type: "feature", text: 'ปุ่ม Export ใน Studio: ดาวน์โหลดโค้ดทั้งหมดเป็นไฟล์ .zip หรือส่งออกเป็นสเปกสำหรับ FITTCORE V2' },
      { type: "feature", text: "หน้าตอบรับคำเชิญ: เปิดลิงก์เชิญแล้วเข้าโปรเจกต์ได้เลย ถ้ายังไม่ล็อกอินระบบจะพากลับมาที่คำเชิญต่อให้อัตโนมัติ ไม่ต้องวางลิงก์ใหม่" },
      { type: "improvement", text: "ดีไซน์ Liquid Glass ใหม่ทั้งระบบ — เมนู ป็อปอัป และไซด์บาร์เบลอพื้นหลังสวยและสม่ำเสมอกันทุกที่" },
      { type: "improvement", text: "หน้าเข้าสู่ระบบโฉมใหม่แบบ split-screen พร้อมตัวอย่างเล่าเรื่อง FITT: พิมพ์ไอเดีย → ได้เว็บจริง" },
      { type: "improvement", text: "Preview ดูเต็มจอได้ + ปุ่มโหลดใหม่เมื่อเบราว์เซอร์ยังไม่พร้อมแสดง live preview, เมนู ⋯ ในไซด์บาร์ (แชร์/ทำสำเนา/ลบ) และเมนูบัญชีผู้ใช้แบบใหม่" },
      { type: "improvement", text: 'อนิเมชันซูมเข้า "จอคอมพิวเตอร์" ก่อนเข้า Studio และรูปแมวน่ารักระหว่างรอโหลดโค้ด' },
      { type: "improvement", text: "อัปเกรดเป็นโมเดล gemini-3.5-flash + เข้าสู่ระบบด้วย Google เลือกบัญชีได้ทุกครั้ง" },
      { type: "fix", text: "แก้พื้นหลังไม่เบลอในเมนู/ป็อปอัปหลายจุด และลิงก์เชิญ/หลังล็อกอินเด้งไป 0.0.0.0 (ใช้ที่อยู่จริงเบื้องหลังพร็อกซี)" },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-06-24",
    title: "ธีม Light/Dark + AI ช่วยสร้าง Skill + รายงานการใช้ AI",
    items: [
      { type: "feature", text: "ธีม Light/Dark ทั้งระบบ (เริ่มต้นตามเครื่อง) สลับได้จากปุ่มกระจกลอยมุมขวาล่างทุกหน้า" },
      { type: "feature", text: "AI ช่วยสร้าง Skill Template: ใส่ URL หรือเปิด Web search ให้ค้นมาอ้างอิง → เห็น thinking + รายงาน แล้วเติมฟอร์มให้อัตโนมัติ" },
      { type: "feature", text: "หน้ารายงานการใช้ AI (admin): ดู token + ค่าใช้จ่ายประมาณการ แยกตาม chat / ผู้ใช้ / ชนิดการเรียก" },
      { type: "feature", text: "Express: พิมพ์ prompt ครบ → สร้าง BRD → PRD → build ให้อัตโนมัติ" },
      { type: "feature", text: "อนุมัติหลายคน: โปรเจกต์ที่แชร์ ทุกคนต้องกดอนุมัติก่อนถึงจะไปเฟสถัดไป" },
      { type: "feature", text: 'ดู/แก้เอกสารจากปุ่ม "ดูเอกสาร" ในแชท (แท็บ IDEA/BRD) + ปุ่ม "สร้างใหม่จากเอกสาร"' },
      { type: "improvement", text: "ดีไซน์ใหม่แนว glass + อนิเมชันเลื่อนเข้าทุกหน้า (Google Stitch style)" },
      { type: "fix", text: "แก้บั๊กสร้างโปรเจกต์ไม่ได้ (RLS), คลิปพื้นหลังกระตุก, prompt หายตอนเปลี่ยนหน้า, แชทยาวเกินล้นจอ และโค้ดขีดแดงทั้งที่รันได้" },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-06-23",
    title: "แอดมินสร้าง Skill Template เองได้",
    items: [
      { type: "feature", text: "แอดมินสร้าง/แก้ไขโดเมนใหม่เองได้ที่ /admin/skills (ฟอร์มครบ + ตัวสร้างคำถาม)" },
      { type: "feature", text: 'โดเมนที่ "เผยแพร่" แล้วจะโผล่ให้ผู้ใช้เลือกใน dropdown และระบบเดาโดเมนอัตโนมัติ' },
      { type: "improvement", text: "เพิ่มโดเมนเฉพาะทางได้โดยไม่ต้อง deploy โค้ดใหม่" },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-06-22",
    title: "AI Skill Templates เฉพาะโดเมน + ลูกเล่นใหม่",
    items: [
      { type: "feature", text: 'เลือก "ประเภท" ของ demo ได้ (ERP, CRM, E-commerce, Dashboard, ระบบจอง, Landing) — AI สวมบทผู้เชี่ยวชาญโดเมนนั้น' },
      { type: "feature", text: "ERP ลึกพิเศษ: ถามเรื่อง PR→PO→GR→อนุมัติ และใส่ข้อมูลตัวอย่างสมจริงลงใน demo" },
      { type: "feature", text: "AI เดาโดเมนจากสิ่งที่พิมพ์ให้อัตโนมัติ + เมนู dropdown เลือกเองได้" },
      { type: "improvement", text: "พิมพ์ prompt ได้ยาวขึ้นถึง 10,000 ตัวอักษร" },
      { type: "improvement", text: 'หน้าแรกมีอนิเมชันเลื่อนเข้าแบบลื่นๆ และเมนู "+" รวมตัวเลือก' },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-22",
    title: "บัญชีผู้ใช้ + เก็บงานบนคลาวด์ + แชร์ทีม",
    items: [
      { type: "feature", text: "เข้าสู่ระบบด้วย Google หรือ magic link + เมนูบัญชีผู้ใช้ พร้อมปุ่มออกจากระบบ" },
      { type: "feature", text: "โปรเจกต์เก็บบนคลาวด์ เปิดต่อข้ามเครื่อง/อุปกรณ์ได้" },
      { type: "feature", text: 'หน้า "ผลงานของฉัน" แยกเป็น งานของฉัน และ แชร์กับฉัน' },
      { type: "feature", text: "แชร์โปรเจกต์ให้ทีมด้วยลิงก์ หรือเชิญทางอีเมล (viewer/editor) — ส่งอีเมลเชิญจริง" },
      { type: "feature", text: 'หน้า "มีอะไรใหม่" พร้อมจุดแจ้งเตือนเมื่อมีอัปเดตใหม่' },
    ],
  },
];

export function latestVersion(): string {
  return CHANGELOG[0].version;
}

export function isChangelogUnseen(lastSeen: string | null): boolean {
  return lastSeen !== latestVersion();
}

/**
 * คู่มือการใช้งาน — the guide at /guide, kept as data beside the changelog.
 *
 * Pictures live under public/guide/ as plain screenshots; the numbered badges
 * are drawn by the page from `marks`, never baked into the file. A screen that
 * changes is therefore one new screenshot and, at most, a few moved marks — and
 * the words stay here, next to everything else a release touches.
 *
 * A changelog entry names the section it changed (`ChangelogEntry.guide`), so
 * updating a feature and updating its page in the guide are the same edit.
 */

/** The lucide icons the guide may show — the same ones the screens use. */
export type GuideIcon =
  | "ArrowRight"
  | "BadgeCheck"
  | "Bell"
  | "BookOpen"
  | "BookmarkPlus"
  | "Building2"
  | "Camera"
  | "Check"
  | "ClipboardList"
  | "Code"
  | "Columns2"
  | "Dna"
  | "Ellipsis"
  | "ExternalLink"
  | "Eye"
  | "FileDown"
  | "FileText"
  | "Flag"
  | "FlaskConical"
  | "Forward"
  | "GitCompare"
  | "Hammer"
  | "History"
  | "ImagePlus"
  | "LifeBuoy"
  | "ListChecks"
  | "LogOut"
  | "Maximize2"
  | "MessageSquare"
  | "Mic"
  | "Monitor"
  | "Moon"
  | "Package"
  | "Paperclip"
  | "Printer"
  | "Radio"
  | "Rocket"
  | "RotateCcw"
  | "RotateCw"
  | "ScanLine"
  | "Search"
  | "SearchCheck"
  | "Send"
  | "Share2"
  | "Shield"
  | "ShieldCheck"
  | "Smartphone"
  | "Sparkles"
  | "Square"
  | "Store"
  | "Sun"
  | "Tablet"
  | "Undo2"
  | "User"
  | "Users"
  | "WandSparkles"
  | "Zap";

/** A button as the screen shows it: its icon and its words. */
export interface GuideChip {
  icon?: GuideIcon;
  label: string;
}

/** Text, or text with buttons in it. */
export type Rich = string | readonly (string | GuideChip)[];

export interface GuideStep {
  title: string;
  text: string;
}

/** A numbered badge: its number and its centre, in % of the picture. */
export interface GuideMark {
  n: number;
  x: number;
  y: number;
}

export interface GuideFigure {
  /** Under public/guide/. */
  src: string;
  width: number;
  height: number;
  caption: string;
  marks: readonly GuideMark[];
  /** What each badge points at, by its number. */
  legend: readonly { n: number; text: Rich }[];
  /** "side" puts a narrow picture beside its legend instead of above it. */
  layout: "wide" | "side";
}

export interface GuideIconItem {
  icon: GuideIcon;
  label: string;
  text: string;
}

export type GuideBlock =
  | { kind: "steps"; steps: readonly GuideStep[] }
  | { kind: "text"; text: Rich }
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: readonly Rich[] }
  | { kind: "figure"; figure: GuideFigure }
  | { kind: "tip"; title: string; text: Rich }
  | { kind: "features"; items: readonly GuideIconItem[] }
  | { kind: "icons"; groups: readonly { title: string; items: readonly GuideIconItem[] }[] }
  | { kind: "faq"; items: readonly { q: string; a: Rich }[] };

export type GuideRole = "everyone" | "builder" | "documents" | "approval" | "company" | "help";

export const GUIDE_ROLES: readonly { id: GuideRole; title: string; who: string }[] = [
  { id: "everyone", title: "ทุกคน", who: "เริ่มต้นใช้งาน ใช้ได้กับทุกบทบาท" },
  { id: "builder", title: "คนทำเดโม", who: "สร้างและปรับเดโมกับ AI" },
  { id: "documents", title: "คนทำเอกสาร", who: "คลังหน้าจอ ใบเสนอราคา ข้อเสนอโครงการ" },
  { id: "approval", title: "ส่งอนุมัติ", who: "ผู้จัดทำ ผู้ตรวจ และผู้อนุมัติ" },
  { id: "company", title: "ผู้ดูแลบริษัท", who: "คนในบริษัทและบทบาทของแต่ละคน" },
  { id: "help", title: "ช่วยเหลือ", who: "เมื่อพบปัญหา และคำถามที่พบบ่อย" },
];

export interface GuideSection {
  /** The anchor: /guide#<id>. */
  id: string;
  role: GuideRole;
  title: string;
  intro?: Rich;
  blocks: readonly GuideBlock[];
}

const chip = (label: string, icon?: GuideIcon): GuideChip => (icon ? { icon, label } : { label });

export const GUIDE: readonly GuideSection[] = [
  // ─── ทุกคน ────────────────────────────────────────────────────────────────
  {
    id: "overview",
    role: "everyone",
    title: "ภาพรวมการทำงาน",
    intro: "งานหนึ่งโปรเจกต์ใน FITT Builder มีเส้นทางหลักดังนี้ แต่ละขั้นมีหัวข้ออธิบายอยู่ในคู่มือนี้",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "เข้าสู่ระบบ และตั้ง workspace", text: "ใช้อีเมลที่ได้รับสิทธิ์" },
          { title: "เริ่มโปรเจกต์", text: "พิมพ์ความต้องการของลูกค้า" },
          { title: "ร่างเอกสาร BRD / PRD", text: "AI สัมภาษณ์และเขียนให้" },
          { title: "สร้างและปรับเดโม", text: "สั่งผ่านแชท หรือชี้แก้ด้วย Wand" },
          { title: "เก็บภาพหน้าจอ", text: "ใช้ทำเอกสารขาย" },
          { title: "ทำใบเสนอราคา แล้วส่งอนุมัติ", text: "พิมพ์ส่งลูกค้าหลังอนุมัติ" },
        ],
      },
      { kind: "heading", text: "สิ่งที่ทำได้ใน FITT Builder" },
      {
        kind: "features",
        items: [
          { icon: "Sparkles", label: "สร้างเดโมด้วย AI", text: "จากความต้องการที่พิมพ์เป็นภาษาไทย" },
          { icon: "FileText", label: "เอกสาร BRD / PRD", text: "AI สัมภาษณ์และเขียนให้" },
          { icon: "WandSparkles", label: "แก้ไขได้ง่าย", text: "สั่งผ่านแชท หรือชี้แก้ด้วย Wand" },
          { icon: "Camera", label: "คลังหน้าจอ", text: "เก็บภาพทุกหน้าพร้อมผัง Flow" },
          { icon: "Building2", label: "ข้อเสนอและใบเสนอราคา", text: "ในนามบริษัทของคุณ พิมพ์เป็น PDF หรือ Word" },
          { icon: "BadgeCheck", label: "อนุมัติก่อนส่งลูกค้า", text: "ผู้ตรวจและผู้อนุมัติของบริษัทดูก่อนทุกฉบับ" },
          { icon: "Users", label: "ทำงานเป็นทีม", text: "แชร์เดโม เชิญเพื่อนร่วมทีม และแชทในโปรเจกต์" },
        ],
      },
      { kind: "heading", text: "ใครทำอะไร" },
      {
        kind: "features",
        items: [
          { icon: "Hammer", label: "คนทำเดโม", text: "สร้างโปรเจกต์ คุยกับ AI และปรับเดโมจนพร้อมนำเสนอ" },
          { icon: "FileText", label: "คนทำเอกสาร", text: "เก็บภาพหน้าจอ ทำใบเสนอราคาและข้อเสนอโครงการ แล้วส่งขออนุมัติ" },
          { icon: "SearchCheck", label: "ผู้ตรวจ", text: "ตรวจเอกสารก่อน แล้วส่งต่อให้ผู้อนุมัติ หรือส่งกลับให้แก้" },
          { icon: "BadgeCheck", label: "ผู้อนุมัติ", text: "อนุมัติเอกสารก่อนส่งถึงลูกค้า" },
          { icon: "Building2", label: "ผู้ดูแลบริษัท", text: "เชิญคนเข้าบริษัท และกำหนดว่าใครเป็นผู้ตรวจหรือผู้อนุมัติ" },
        ],
      },
      { kind: "text", text: "คนเดียวอาจมีหลายบทบาทได้ เช่น ทำเดโมและทำเอกสารเอง แล้วส่งให้หัวหน้าอนุมัติ" },
      {
        kind: "tip",
        title: "อ่านภาพในคู่มือ",
        text: "ตัวเลขสีส้มบนภาพหน้าจอมีคำอธิบายอยู่ใต้ภาพ และปุ่มในระบบแสดงเป็นป้ายพร้อมไอคอนแบบเดียวกับที่เห็นบนหน้าจอ",
      },
      {
        kind: "tip",
        title: "เกร็ดเล็กน้อย",
        text: "ระบบบันทึกงานให้อัตโนมัติทุกครั้งที่มีการเปลี่ยนแปลง และทุกการแก้ไขสามารถย้อนกลับได้ จึงทดลองใช้งานได้อย่างสบายใจ",
      },
    ],
  },
  {
    id: "icons",
    role: "everyone",
    title: "ไอคอนที่ใช้บ่อย",
    intro: "ไอคอนต่อไปนี้เป็นชุดเดียวกับที่แสดงบนหน้าจอ FITT Builder",
    blocks: [
      {
        kind: "icons",
        groups: [
          {
            title: "แถบด้านบนของหน้าทำงาน",
            items: [
              { icon: "Eye", label: "Preview", text: "ดูเดโม" },
              { icon: "Code", label: "Code", text: "ดูไฟล์โค้ด" },
              { icon: "History", label: "History", text: "ประวัติเวอร์ชัน" },
              { icon: "Undo2", label: "Undo", text: "ย้อนการเปลี่ยนแปลงล่าสุด" },
              { icon: "MessageSquare", label: "แชท", text: "ห้องแชทของทีม" },
              { icon: "Camera", label: "คลังหน้าจอ", text: "ภาพหน้าจอ ผัง Flow และเอกสารขาย" },
              { icon: "Ellipsis", label: "เพิ่มเติม", text: "เมนูแชร์ เชิญทีม และอื่น ๆ" },
              { icon: "Bell", label: "การแจ้งเตือน", text: "คำตอบจากทีม FITT" },
            ],
          },
          {
            title: "แถบเฟสงาน",
            items: [
              { icon: "FileText", label: "Define", text: "สัมภาษณ์และเขียน BRD" },
              { icon: "ClipboardList", label: "Plan", text: "เขียน PRD" },
              { icon: "Hammer", label: "Build", text: "สร้างเดโม" },
              { icon: "FlaskConical", label: "Verify", text: "ตรวจว่าใช้งานได้" },
              { icon: "ShieldCheck", label: "Review", text: "ตรวจคุณภาพ" },
              { icon: "Rocket", label: "Ship", text: "สรุปการส่งมอบ" },
              { icon: "Check", label: "ผ่านแล้ว", text: "เฟสที่อนุมัติแล้ว" },
              { icon: "Sparkles", label: "Premium", text: "เวอร์ชันขายเพิ่ม" },
              { icon: "RotateCcw", label: "สร้างใหม่จากเอกสาร", text: "สร้างเดโมใหม่จาก BRD/PRD" },
              { icon: "ArrowRight", label: "อนุมัติ & ไปต่อ", text: "ไปเฟสถัดไป" },
            ],
          },
          {
            title: "แถบเดโม",
            items: [
              { icon: "Smartphone", label: "มือถือ", text: "ดูในขนาดมือถือ" },
              { icon: "Tablet", label: "แท็บเล็ต", text: "ดูในขนาดแท็บเล็ต" },
              { icon: "Monitor", label: "จอคอม", text: "ดูในขนาดจอคอมพิวเตอร์" },
              { icon: "WandSparkles", label: "Wand", text: "ชี้แล้วแก้ตรงจุด" },
              { icon: "RotateCw", label: "โหลดใหม่", text: "เปิดเดโมใหม่อีกครั้ง" },
              { icon: "Maximize2", label: "เต็มจอ", text: "ดูเดโมเต็มหน้าจอ" },
              { icon: "ExternalLink", label: "แท็บใหม่", text: "เปิดเดโมในแท็บใหม่" },
            ],
          },
          {
            title: "แชทกับ AI",
            items: [
              { icon: "ImagePlus", label: "แนบรูป", text: "แนบรูปตัวอย่าง" },
              { icon: "History", label: "ใช้ไฟล์เดิม", text: "เลือกไฟล์ที่เคยแนบ" },
              { icon: "Send", label: "ส่ง / แก้ไข", text: "ส่งคำสั่งให้ AI" },
              { icon: "Square", label: "หยุด", text: "หยุดงานที่กำลังทำ (Esc)" },
              { icon: "GitCompare", label: "ดูการเปลี่ยนแปลง", text: "ดูไฟล์ที่ถูกแก้" },
              { icon: "Flag", label: "แจ้งปัญหา", text: "ส่งเรื่องให้ทีม FITT" },
            ],
          },
          {
            title: "คลังหน้าจอ",
            items: [
              { icon: "ListChecks", label: "แคปทุกหน้า", text: "เก็บภาพทุกหน้าที่เดโมประกาศไว้" },
              { icon: "Radio", label: "อัดการใช้งาน", text: "เก็บภาพขณะใช้งานจริง" },
              { icon: "ScanLine", label: "สแกน", text: "ให้ระบบเดินเก็บภาพเอง" },
              { icon: "Camera", label: "แคปหน้านี้", text: "เก็บภาพหน้าที่เปิดอยู่" },
            ],
          },
          {
            title: "เอกสารและการอนุมัติ",
            items: [
              { icon: "Eye", label: "ดูตัวอย่างเอกสาร", text: "ดูหน้าตาก่อนส่ง มีลายน้ำ “ตัวอย่าง”" },
              { icon: "FileText", label: "ดูแบบแบ่งหน้า A4", text: "เห็นหน้ากระดาษจริงก่อนอนุมัติ" },
              { icon: "Send", label: "ส่งอนุมัติ", text: "ส่งเอกสารให้ผู้ตรวจหรือผู้อนุมัติ" },
              { icon: "SearchCheck", label: "ผู้ตรวจ", text: "ตรวจก่อนถึงผู้อนุมัติ" },
              { icon: "Forward", label: "ส่งต่อให้ผู้อนุมัติ", text: "ผู้ตรวจตรวจเสร็จแล้ว" },
              { icon: "Undo2", label: "ส่งกลับให้แก้", text: "พร้อมหมายเหตุถึงคนส่ง" },
              { icon: "BadgeCheck", label: "อนุมัติแล้ว", text: "พิมพ์และบันทึกได้" },
              { icon: "Printer", label: "พิมพ์ / บันทึกเป็น PDF", text: "ใช้ได้หลังอนุมัติ" },
              { icon: "FileDown", label: "บันทึกเป็น Word", text: "เปิดแก้ต่อใน Word หรือ Google Docs" },
              { icon: "Building2", label: "บริษัทและผู้อนุมัติ", text: "คนในบริษัทและบทบาท" },
            ],
          },
          {
            title: "แชร์ ทีม และบัญชี",
            items: [
              { icon: "Share2", label: "คัดลอกลิงก์แชร์", text: "ส่งเดโมให้ลูกค้าดู" },
              { icon: "Users", label: "เชิญทีม", text: "เชิญเพื่อนร่วมทีมเข้าโปรเจกต์" },
              { icon: "Dna", label: "Org DNA", text: "ข้อมูลบริษัทสำหรับ AI" },
              { icon: "LifeBuoy", label: "แจ้งเคส", text: "ติดตามเรื่องที่แจ้งทีม" },
              { icon: "Paperclip", label: "แนบไฟล์", text: "แนบไฟล์ตอนเริ่มโปรเจกต์" },
              { icon: "LogOut", label: "ออกจากระบบ", text: "ออกจากบัญชี" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sign-in",
    role: "everyone",
    title: "เข้าสู่ระบบครั้งแรก",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "เปิดเว็บ FITT Builder", text: "fitt-builder.fittbsa.com" },
          { title: "เข้าสู่ระบบ", text: "ด้วย Google หรือลิงก์ทางอีเมล" },
          { title: "อ่านหน้าต่างต้อนรับ", text: "แนะนำ 3 ขั้นตอนแรก" },
          { title: "เลือก workspace", text: "ดูหัวข้อ “Workspace และเพื่อนร่วมทีม”" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/login.jpg",
          width: 1200,
          height: 980,
          caption: "หน้าเข้าสู่ระบบ",
          layout: "side",
          marks: [
            { n: 1, x: 17, y: 58.6 },
            { n: 2, x: 17, y: 77.6 },
            { n: 3, x: 17, y: 89.6 },
          ],
          legend: [
            { n: 1, text: "เข้าสู่ระบบด้วยบัญชี Google" },
            { n: 2, text: "หรือกรอกอีเมลที่ได้รับสิทธิ์" },
            { n: 3, text: "กด “ส่งลิงก์เข้าสู่ระบบ” แล้วเปิดลิงก์ในอีเมล" },
          ],
        },
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/welcome.jpg",
          width: 1016,
          height: 854,
          caption: "หน้าต่างต้อนรับที่ Partner จะเห็นในครั้งแรก",
          layout: "side",
          marks: [
            { n: 1, x: 4, y: 11.1 },
            { n: 2, x: 4, y: 28.7 },
            { n: 3, x: 4.5, y: 86.3 },
          ],
          legend: [
            { n: 1, text: "ยืนยันว่าบัญชีนี้ได้รับสิทธิ์ Partner แล้ว" },
            { n: 2, text: "3 ขั้นตอนที่แนะนำให้ทำก่อน" },
            { n: 3, text: "กด “เข้าใจแล้ว” หน้าต่างนี้จะไม่แสดงอีก" },
          ],
        },
      },
      {
        kind: "tip",
        title: "ใช้อีเมลเดียวกับที่ได้รับสิทธิ์",
        text: "FITT Builder เปิดให้ทีมงานและ Partner ที่ได้รับสิทธิ์เท่านั้น หากเข้าสู่ระบบด้วยอีเมลอื่น ระบบจะแสดงหน้า “บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน” ซึ่งบอกอีเมลที่กำลังใช้อยู่ และมีปุ่ม “เข้าด้วยอีเมลอื่น” ให้เปลี่ยนบัญชีได้ทันที",
      },
    ],
  },

  {
    id: "account",
    role: "everyone",
    title: "เมนูบัญชี",
    intro: "กดชื่อของคุณที่มุมขวาบนของหน้าแรก เพื่อเปิดเมนูบัญชี ทุกการตั้งค่าส่วนตัวอยู่ที่นี่",
    blocks: [
      {
        kind: "figure",
        figure: {
          src: "/guide/account-menu.jpg",
          width: 718,
          height: 1124,
          caption: "เมนูบัญชี (ชื่อและอีเมลในภาพเป็นตัวอย่าง)",
          layout: "side",
          marks: [
            { n: 1, x: 5.5, y: 15.5 },
            { n: 2, x: 5.5, y: 26.5 },
            { n: 3, x: 5.5, y: 41.5 },
            { n: 4, x: 5.5, y: 56.5 },
            { n: 5, x: 5.5, y: 66.8 },
            { n: 6, x: 5.5, y: 76 },
            { n: 7, x: 5.5, y: 85.4 },
            { n: 8, x: 5.5, y: 94.6 },
          ],
          legend: [
            { n: 1, text: "ชื่อและอีเมลที่ใช้เข้าสู่ระบบ" },
            { n: 2, text: "ป้ายบริษัท บอกว่าคุณอยู่บริษัทไหนและมีบทบาทอะไร หรือบอกว่ายังไม่อยู่ในบริษัท กดเพื่อเปิดหน้าบริษัท" },
            { n: 3, text: "ธีม: ตามเครื่อง / สว่าง / มืด" },
            { n: 4, text: "ขนาดตัวอักษร ปรับได้ตั้งแต่ 90% ถึง 140% ครั้งละ 10%" },
            { n: 5, text: [chip("คู่มือการใช้งาน", "BookOpen"), " เปิดคู่มือนี้ในแท็บใหม่"] },
            { n: 6, text: [chip("แจ้งเคส / ติดตามปัญหา", "LifeBuoy"), " เรื่องที่แจ้งทีมไว้ และคำตอบจากทีม"] },
            { n: 7, text: [chip("Org DNA (workspace)", "Dna"), " เปิดหน้า Org DNA ของ workspace"] },
            { n: 8, text: [chip("ออกจากระบบ", "LogOut")] },
          ],
        },
      },
      {
        kind: "tip",
        title: "ตัวอักษรเล็กไป",
        text: "ปรับขนาดตัวอักษรได้ที่ข้อ 4 ทุกหน้าจะขยายตาม และระบบจำค่าไว้ในเบราว์เซอร์เครื่องนี้",
      },
    ],
  },
  {
    id: "my-work",
    role: "everyone",
    title: "ผลงานของฉัน",
    intro: ["กด “ผลงานของฉัน” ที่มุมขวาบนของหน้าแรก เพื่อเปิดรายการโปรเจกต์ทั้งหมด"],
    blocks: [
      {
        kind: "figure",
        figure: {
          src: "/guide/my-work.jpg",
          width: 632,
          height: 1260,
          caption: "รายการผลงาน",
          layout: "side",
          marks: [
            { n: 1, x: 3.5, y: 10.3 },
            { n: 2, x: 3.5, y: 18.2 },
            { n: 3, x: 3.5, y: 25.8 },
            { n: 4, x: 3.5, y: 33 },
            { n: 5, x: 72, y: 40.3 },
            { n: 6, x: 84, y: 46.5 },
          ],
          legend: [
            { n: 1, text: "“ของฉัน” โปรเจกต์ที่คุณสร้าง · “แชร์กับฉัน” โปรเจกต์ที่มีคนเชิญคุณเข้าไป" },
            { n: 2, text: "ค้นหาโปรเจกต์จากชื่อ" },
            { n: 3, text: "“ตั้งค่า Org DNA ของคุณ” ข้อมูลบริษัทลูกค้าของ workspace" },
            { n: 4, text: [chip("เทียบโปรเจกต์หลายตัว", "Columns2"), " เปิดเดโมหลายตัวในหน้าเดียว เช่น เวอร์ชันปกติกับ Premium"] },
            { n: 5, text: "โปรเจกต์แบ่งเป็นกลุ่มตาม workspace พร้อมจำนวน กดเพื่อพับหรือกาง" },
            { n: 6, text: [chip("", "Ellipsis"), " เมนูของโปรเจกต์: แชร์ ทำสำเนา หรือลบ"] },
          ],
        },
      },
      {
        kind: "tip",
        title: "ลบแล้วกู้คืนไม่ได้",
        text: "การลบโปรเจกต์เป็นการลบถาวร กรุณาตรวจชื่อโปรเจกต์ให้แน่ใจก่อนยืนยัน",
      },
    ],
  },

  // ─── คนทำเดโม ─────────────────────────────────────────────────────────────
  {
    id: "workspace",
    role: "builder",
    title: "Workspace และเพื่อนร่วมทีม",
    intro: "Workspace คือพื้นที่ของลูกค้าแต่ละราย โปรเจกต์ เอกสาร และ Org DNA ของลูกค้ารายนั้นอยู่รวมกันในนี้ แนะนำให้สร้างโปรเจกต์ของลูกค้าใน workspace เสมอ ไม่ใช้ “ส่วนตัว”",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "สร้าง workspace", text: "ตั้งชื่อ สี และไอคอน" },
          { title: "เลือก workspace", text: "ทุกครั้งก่อนเริ่มโปรเจกต์" },
          { title: "เชิญเพื่อนร่วมทีม", text: "เพื่อนต้องได้รับสิทธิ์ใช้งานด้วย" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/home-prompt.jpg",
          width: 1326,
          height: 896,
          caption: "กล่องพิมพ์บนหน้าแรก",
          layout: "wide",
          marks: [
            { n: 1, x: 2, y: 6 },
            { n: 2, x: 3.6, y: 31.4 },
            { n: 3, x: 11.3, y: 42.7 },
            { n: 4, x: 16, y: 42.7 },
            { n: 5, x: 76.5, y: 43.8 },
            { n: 6, x: 3, y: 80.6 },
            { n: 7, x: 50.5, y: 80.7 },
          ],
          legend: [
            { n: 1, text: "ช่องเลือก workspace (ค่าเริ่มต้นคือ “ส่วนตัว”)" },
            { n: 2, text: "“สร้าง workspace ใหม่” ตั้งชื่อ สี และไอคอน แล้วกด “สร้าง”" },
            { n: 3, text: [chip("", "Paperclip"), " แนบไฟล์ประกอบ เช่น เอกสารความต้องการ"] },
            { n: 4, text: "“เลือกประเภท (Auto)” ปล่อยให้ระบบเลือกประเภทงานให้ได้" },
            { n: 5, text: "“สร้างเลย” เริ่มโปรเจกต์" },
            { n: 6, text: "เริ่มจากเทมเพลตดีไซน์" },
            { n: 7, text: "เริ่มจากมาร์เก็ตเพลสระบบ (หัวข้อ “เริ่มโปรเจกต์ใหม่”)" },
          ],
        },
      },
      { kind: "heading", text: "เชิญเพื่อนร่วมทีมเข้า workspace" },
      {
        kind: "steps",
        steps: [
          { title: "ขอสิทธิ์ใช้งานให้เพื่อน", text: "ส่งอีเมลเพื่อนให้ทีม FITT" },
          { title: "เปิดหน้า Org DNA", text: "เมนูบัญชีมุมขวาบน" },
          { title: "กรอกอีเมลและเลือกสิทธิ์", text: "สมาชิก หรือ ผู้ดูแล" },
          { title: "กด “เชิญ”", text: "เพื่อนรับคำเชิญทางอีเมล" },
        ],
      },
      {
        kind: "text",
        text: ["เปิดเมนูบัญชีมุมขวาบน แล้วเลือก ", chip("Org DNA (workspace)", "Dna"), " จากนั้นเลื่อนลงไปที่ส่วน “สมาชิก workspace”"],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/workspace-members.jpg",
          width: 1568,
          height: 462,
          caption: "ส่วนสมาชิก workspace (ชื่อและอีเมลในภาพเป็นตัวอย่าง)",
          layout: "wide",
          marks: [
            { n: 1, x: 1.5, y: 26.3 },
            { n: 2, x: 87.6, y: 26.3 },
            { n: 3, x: 96.5, y: 15.4 },
            { n: 4, x: 92, y: 42.7 },
            { n: 5, x: 88, y: 60.3 },
          ],
          legend: [
            { n: 1, text: "กรอกอีเมลของเพื่อนร่วมทีม" },
            { n: 2, text: "เลือกสิทธิ์ “สมาชิก” หรือ “ผู้ดูแล”" },
            { n: 3, text: "กด “เชิญ”" },
            { n: 4, text: "เจ้าของ workspace" },
            { n: 5, text: "เปลี่ยนสิทธิ์หรือนำสมาชิกออกได้" },
          ],
        },
      },
      {
        kind: "tip",
        title: "ก่อนเชิญ",
        text: "เพื่อนร่วมทีมต้องได้รับสิทธิ์ใช้งาน FITT Builder ก่อนจึงจะเปิดงานได้ กรุณาส่งอีเมลของเพื่อนร่วมทีมให้ทีม FITT เพิ่มสิทธิ์ก่อน",
      },
    ],
  },
  {
    id: "org-dna",
    role: "builder",
    title: "Org DNA",
    intro: "Org DNA คือข้อมูลของบริษัทลูกค้าที่ AI ใช้อ้างอิงเมื่อออกแบบเอกสารและสร้างระบบให้โปรเจกต์ใน workspace ช่วยให้งานออกมาตรงกับวิธีทำงานของลูกค้ามากขึ้น ทุกช่องไม่บังคับ ใส่เท่าที่มีได้",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "เปิดหน้า Org DNA", text: "เมนูบัญชี → Org DNA" },
          { title: "ให้ AI ร่าง", text: "จากข้อความหรือไฟล์ของบริษัท" },
          { title: "ปั้นผู้เชี่ยวชาญ", text: "ผู้ช่วย AI ประจำ workspace" },
          { title: "บันทึก Org DNA", text: "ปุ่มที่แถบด้านล่าง" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/org-dna.jpg",
          width: 1568,
          height: 745,
          caption: "หน้า Org DNA ของ workspace",
          layout: "wide",
          marks: [
            { n: 1, x: 1.5, y: 13.8 },
            { n: 2, x: 1.5, y: 49.7 },
            { n: 3, x: 2, y: 72.2 },
            { n: 4, x: 20.5, y: 88.3 },
          ],
          legend: [
            { n: 1, text: "ผู้เชี่ยวชาญประจำองค์กรที่ใช้งานอยู่" },
            { n: 2, text: "ใส่บรีฟเพิ่มเติมแล้วกด “สร้างใหม่ทับ” เพื่อปรับให้เจาะจงขึ้น" },
            { n: 3, text: "ความครบถ้วนของ Org DNA" },
            { n: 4, text: "“ให้ AI ร่างจากข้อมูลที่มี” วางข้อความหรืออัปโหลดไฟล์ เช่น คำอธิบายบริษัท เว็บไซต์ หรือเสียงจากลูกค้า" },
          ],
        },
      },
      {
        kind: "tip",
        title: "เมื่อตั้งค่าแล้ว",
        text: ["ในหน้าทำงานของโปรเจกต์จะมีป้าย ", chip("Org DNA", "Dna"), " ที่แถบด้านบน แสดงว่า AI กำลังอ้างอิงข้อมูลบริษัทของลูกค้า"],
      },
    ],
  },
  {
    id: "new-project",
    role: "builder",
    title: "เริ่มโปรเจกต์ใหม่",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "เลือก workspace", text: "ช่องมุมซ้ายบนของกล่องพิมพ์" },
          { title: "พิมพ์ความต้องการ", text: "เล่าแบบภาษาพูดได้เลย" },
          { title: "แนบไฟล์ (ถ้ามี)", text: "เอกสารหรือรูปตัวอย่าง" },
          { title: "กด “สร้างเลย”", text: "ระบบเริ่มที่เฟส Define" },
        ],
      },
      {
        kind: "text",
        text: "พิมพ์เป็นภาษาไทยหรือภาษาอังกฤษก็ได้ เล่าเหมือนกำลังอธิบายให้เพื่อนร่วมงานฟัง ไม่จำเป็นต้องใช้ศัพท์เทคนิค หากต้องการเริ่มจากของสำเร็จรูป เลือกได้ 2 แบบ",
      },
      {
        kind: "bullets",
        items: [
          "เริ่มจากเทมเพลตดีไซน์ — เลือกลุคสำเร็จรูป แล้วนำรูปของลูกค้ามาวางตามโครง",
          "มาร์เก็ตเพลสระบบ — ระบบสำเร็จรูปที่ทดลองใช้งานได้ก่อนตัดสินใจ",
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/marketplace.jpg",
          width: 1568,
          height: 729,
          caption: "มาร์เก็ตเพลสระบบ",
          layout: "wide",
          marks: [
            { n: 1, x: 1.4, y: 25.7 },
            { n: 2, x: 2.4, y: 88.3 },
            { n: 3, x: 35.5, y: 88.3 },
            { n: 4, x: 73.5, y: 25.7 },
            { n: 5, x: 74, y: 60.1 },
          ],
          legend: [
            { n: 1, text: "ระบบสำเร็จรูป พร้อมจำนวนวันพัฒนาและค่าดูแลรายเดือนโดยประมาณ" },
            { n: 2, text: "“ลองใช้ทั้งระบบ” ทดลองใช้งานก่อน" },
            { n: 3, text: "เพิ่มระบบเข้าขอบเขตงาน" },
            { n: 4, text: "ขอบเขตที่เลือก สรุปเวลาและค่าดูแล" },
            { n: 5, text: "“สร้างโปรเจกต์จากขอบเขตนี้” ระบบจะคัดลอกเข้าโปรเจกต์ใหม่ให้แก้ไขต่อได้ทันที" },
          ],
        },
      },
    ],
  },
  {
    id: "fitt-voice",
    role: "builder",
    title: "สรุปการประชุมจาก FITT Voice",
    intro:
      "คนที่ใช้ FITT Voice ส่งสรุปการประชุมที่ตรวจแล้วเข้ามาได้ จะสร้างเป็นโปรเจกต์ใหม่ หรือเพิ่มเข้าโปรเจกต์ที่มีอยู่แล้วก็ได้",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "เชื่อมบัญชีใน FITT Voice", text: "เลือก workspace ที่จะส่งเข้า" },
          { title: "ตรวจสรุปการประชุม", text: "ยืนยันฉบับที่จะส่ง" },
          { title: "เลือกปลายทาง", text: "โปรเจกต์ใหม่ หรือโปรเจกต์เดิม" },
          { title: "เปิดใน FITT Builder", text: "ปุ่ม FITT Voice บนแถบด้านบน" },
        ],
      },
      {
        kind: "bullets",
        items: [
          "แต่ละการประชุมเป็นรายการแยกในโปรเจกต์ ส่งฉบับแก้ของการประชุมเดิม จะแทนเฉพาะการประชุมนั้น",
          "หลายคนส่งเข้าโปรเจกต์เดียวกันได้ ด้วยบัญชีของตัวเอง คนที่แก้โปรเจกต์ได้ (เจ้าของ ผู้แก้ไข และสมาชิก workspace) ส่งได้ ส่วนผู้อนุมัติและผู้ดูอย่างเดียวส่งไม่ได้",
          "การประชุมหนึ่งอยู่ได้ในโปรเจกต์เดียว ถ้าโปรเจกต์นั้นถูกลบ ส่งการประชุมนั้นไปที่อื่นได้",
          ["กด ", chip("FITT Voice · 3 การประชุม", "Mic"), " เพื่อดูทุกการประชุม เลือกการประชุมทางซ้าย อ่านสรุปทางขวา"],
        ],
      },
      {
        kind: "tip",
        title: "ข้อมูลไม่เปลี่ยนเอกสารเอง",
        text: "การรับสรุปไม่สร้างหรือแก้ BRD, ข้อเสนอโครงการ, ใบเสนอราคา และชื่อโปรเจกต์ AI ในเฟส Define และ Plan อ่านทุกการประชุมได้ และจะถามก่อนร่างเอกสาร สั่งในแชทเมื่อพร้อม",
      },
      {
        kind: "tip",
        title: "AI ไม่เติมข้อมูลเอง",
        text: "ถ้าการประชุมคุยคนละเรื่อง AI จะถามก่อนว่าจะใช้การประชุมไหน เรื่องที่ยังไม่ตัดสินใจจะอยู่ในหัวข้อคำถามค้าง ส่วนข้อมูลที่สรุปไม่ได้บอกจะเขียนว่า “รอระบุ” ควรตอบให้ครบก่อนกดอนุมัติ",
      },
    ],
  },
  {
    id: "studio",
    role: "builder",
    title: "หน้าทำงานของโปรเจกต์",
    blocks: [
      {
        kind: "figure",
        figure: {
          src: "/guide/studio.jpg",
          width: 1501,
          height: 812,
          caption: "หน้าทำงานของโปรเจกต์ (ภาพจากโปรเจกต์ตัวอย่าง ข้อมูลในเดโมเป็นข้อมูลสมมติ)",
          layout: "wide",
          marks: [
            { n: 1, x: 13.6, y: 2.9 },
            { n: 2, x: 45.8, y: 2.9 },
            { n: 3, x: 69.6, y: 2.9 },
            { n: 4, x: 1.2, y: 12.1 },
            { n: 5, x: 91.2, y: 9.5 },
            { n: 6, x: 2, y: 16.8 },
            { n: 7, x: 2, y: 87.8 },
            { n: 8, x: 27.9, y: 15.7 },
            { n: 9, x: 86, y: 15.7 },
            { n: 10, x: 97.4, y: 39.7 },
            { n: 11, x: 82.9, y: 97.4 },
          ],
          legend: [
            { n: 1, text: "ชื่อโปรเจกต์ (กดเพื่อเปลี่ยนชื่อ) และสถานะการบันทึกอัตโนมัติ" },
            { n: 2, text: [chip("Preview", "Eye"), " ", chip("Code", "Code"), " ", chip("History", "History"), " สลับมุมมอง"] },
            { n: 3, text: [chip("Undo", "Undo2"), " ", chip("แชท", "MessageSquare"), " ", chip("คลังหน้าจอ", "Camera"), " ", chip("", "Ellipsis")] },
            { n: 4, text: "แถบเฟสงาน Define → Ship (หัวข้อ “ขั้นตอนงาน 6 เฟส”)" },
            { n: 5, text: [chip("อนุมัติ & ไปต่อ", "ArrowRight"), " ไปเฟสถัดไป"] },
            { n: 6, text: "คำตอบและสรุปงานจาก AI" },
            { n: 7, text: "ช่องสั่งงาน AI (หัวข้อ “สั่งงาน AI ผ่านแชท”)" },
            { n: 8, text: [chip("", "Smartphone"), " ", chip("", "Tablet"), " ", chip("", "Monitor"), " เปลี่ยนขนาดหน้าจอเดโม"] },
            { n: 9, text: [chip("Wand", "WandSparkles"), " ชี้แล้วแก้ตรงจุด (หัวข้อ “แก้ตรงจุดด้วย Wand”)"] },
            { n: 10, text: "เดโมที่กดใช้งานได้จริง" },
            { n: 11, text: [chip("แจ้งปัญหา", "Flag"), " ส่งเรื่องให้ทีม FITT"] },
          ],
        },
      },
      {
        kind: "tip",
        title: "ทำงานพร้อมกันได้",
        text: "เพื่อนร่วมทีมที่เปิดโปรเจกต์เดียวกันจะเห็นงานล่าสุดเสมอ เพราะระบบบันทึกให้อัตโนมัติ",
      },
    ],
  },
  {
    id: "phases",
    role: "builder",
    title: "ขั้นตอนงาน 6 เฟส",
    intro: "ทุกโปรเจกต์เดินตามลำดับเดียวกัน และแต่ละเฟสมีผู้ช่วย AI ประจำ",
    blocks: [
      {
        kind: "features",
        items: [
          { icon: "FileText", label: "Define", text: "AI ถามทีละคำถาม แล้วเขียน BRD" },
          { icon: "ClipboardList", label: "Plan", text: "แปลง BRD เป็น PRD สำหรับทีมพัฒนา" },
          { icon: "Hammer", label: "Build", text: "สร้างเดโมที่กดใช้งานได้" },
          { icon: "FlaskConical", label: "Verify", text: "ตรวจว่าแต่ละหน้าจอใช้งานได้จริง" },
          { icon: "ShieldCheck", label: "Review", text: "ตรวจความอ่านง่าย ความปลอดภัย และความเร็ว" },
          { icon: "Rocket", label: "Ship", text: "สรุปการส่งมอบและแชร์ลิงก์" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/phase-bar.jpg",
          width: 1568,
          height: 105,
          caption: "แถบเฟส: Define และ Plan อนุมัติแล้ว ขณะนี้อยู่ที่ Build",
          layout: "wide",
          marks: [],
          legend: [],
        },
      },
      { kind: "heading", text: "ในเฟส Define" },
      {
        kind: "text",
        text: "AI จะถามทีละคำถามเพื่อเก็บความต้องการ สามารถกดเลือกคำตอบ (บางข้อเลือกได้หลายข้อ) พิมพ์คำตอบเอง หรือกด “ข้าม” ได้",
      },
      { kind: "heading", text: "การอนุมัติเฟส" },
      {
        kind: "text",
        text: [
          "เมื่อทำเฟสปัจจุบันเสร็จ กรุณากด ",
          chip("อนุมัติ & ไปต่อ", "ArrowRight"),
          " หากโปรเจกต์มีหลายคน เฟสจะไปต่อเมื่อทุกคนอนุมัติครบ (การอนุมัติเฟสเป็นคนละเรื่องกับการอนุมัติเอกสาร ซึ่งอยู่ในหมวด “ส่งอนุมัติ”)",
        ],
      },
      { kind: "heading", text: "ปุ่มที่ใช้ในเฟส Build" },
      {
        kind: "bullets",
        items: [
          [chip("อัปเดตเอกสารจากของจริง", "FileText"), " ให้ AI อ่านเดโมที่สร้างแล้ว และปรับ BRD/PRD ให้ตรง (แก้เฉพาะเอกสาร) ตัวเลขบนปุ่มคือจำนวนหน้าจอที่เอกสารยังไม่ได้กล่าวถึง"],
          [chip("สร้างใหม่จากเอกสาร", "RotateCcw"), " สร้างเดโมใหม่ทั้งหมดจาก BRD/PRD ปัจจุบัน และย้อนกลับได้ด้วย Undo"],
          ["“ปกติ / ", chip("Premium", "Sparkles"), "” สลับดูเวอร์ชันปกติกับเวอร์ชัน Premium (หัวข้อ “เวอร์ชัน Premium”)"],
        ],
      },
    ],
  },
  {
    id: "chat",
    role: "builder",
    title: "สั่งงาน AI ผ่านแชท",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "พิมพ์สิ่งที่อยากได้", text: "บอกหน้า ส่วน และผลที่ต้องการ" },
          { title: "AI แก้ให้", text: "เดโมทางขวาอัปเดตทันที" },
          { title: "ตรวจผลงาน", text: "กดดูการเปลี่ยนแปลงได้" },
          { title: "ไม่ถูกใจ?", text: "กด Undo แล้วสั่งใหม่" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/chat.jpg",
          width: 800,
          height: 1366,
          caption: "แชทกับ AI",
          layout: "side",
          marks: [
            { n: 1, x: 3.8, y: 4.3 },
            { n: 2, x: 56.9, y: 73.4 },
            { n: 3, x: 75.8, y: 77.6 },
            { n: 4, x: 3.1, y: 83.8 },
            { n: 5, x: 5.7, y: 91.1 },
            { n: 6, x: 13.2, y: 91 },
            { n: 7, x: 75.3, y: 94.9 },
          ],
          legend: [
            { n: 1, text: "คำตอบของ AI สรุปว่าแก้อะไรไปบ้าง" },
            { n: 2, text: [chip("ดูการเปลี่ยนแปลง", "GitCompare"), " ดูไฟล์ที่ถูกแก้"] },
            { n: 3, text: [chip("แจ้งปัญหา", "Flag"), " เมื่อคำตอบผิดปกติ"] },
            { n: 4, text: "ช่องพิมพ์คำสั่ง เช่น “เปลี่ยนสีปุ่มเป็นน้ำเงิน”" },
            { n: 5, text: [chip("", "ImagePlus"), " แนบรูปตัวอย่าง"] },
            { n: 6, text: [chip("", "History"), " เลือกไฟล์ที่เคยแนบไว้"] },
            { n: 7, text: [chip("แก้ไข", "Send"), " ส่งคำสั่ง"] },
          ],
        },
      },
      { kind: "heading", text: "เคล็ดลับให้ได้ผลดี" },
      {
        kind: "bullets",
        items: [
          "ระบุให้ชัดว่าหน้าไหน ส่วนไหน และอยากได้แบบใด",
          "สั่งทีละเรื่อง จะตรวจผลได้ง่ายกว่า",
          "งานใหญ่ ระบบจะแบ่งเป็นรายการงานและทำต่อจนครบ ไม่จำเป็นต้องส่งซ้ำ",
          "หากเดโมแสดง “แอปมี error” สามารถกด “ให้ AI แก้เลย” ที่แถบแจ้งเตือนได้",
        ],
      },
    ],
  },
  {
    id: "wand",
    role: "builder",
    title: "แก้ตรงจุดด้วย Wand",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "เปิด Wand", text: "ปุ่มบนแถบเดโม" },
          { title: "ชี้และคลิก", text: "จุดที่ต้องการแก้จะมีกรอบสีฟ้า" },
          { title: "เลือกวิธีแก้", text: "ปรับเร็ว หรือ เสก" },
          { title: "ยืนยัน", text: "กด Esc เมื่อต้องการออก" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/wand-mode.jpg",
          width: 1568,
          height: 689,
          caption: "โหมด Wand",
          layout: "wide",
          marks: [
            { n: 1, x: 81, y: 3.5 },
            { n: 2, x: 32, y: 12.3 },
            { n: 3, x: 46, y: 68.4 },
            { n: 4, x: 91.5, y: 12.3 },
          ],
          legend: [
            { n: 1, text: [chip("Wand", "WandSparkles"), " เปิดหรือปิดโหมด Wand"] },
            { n: 2, text: "แถบแสดงว่ากำลังอยู่ในโหมด Wand" },
            { n: 3, text: "จุดที่ชี้อยู่ จะมีกรอบสีฟ้าและชื่อส่วนประกอบ" },
            { n: 4, text: "“ออก (Esc)” ออกจากโหมด Wand" },
          ],
        },
      },
      { kind: "heading", text: "หน้าต่าง Wand เมื่อคลิกเลือกจุดที่ต้องการแก้" },
      {
        kind: "figure",
        figure: {
          src: "/guide/wand-panel.jpg",
          width: 720,
          height: 890,
          caption: "หน้าต่าง Wand",
          layout: "side",
          marks: [
            { n: 1, x: 4.6, y: 13.7 },
            { n: 2, x: 29.1, y: 13.7 },
            { n: 3, x: 66.1, y: 25.7 },
            { n: 4, x: 66.1, y: 48.6 },
            { n: 5, x: 4.2, y: 85 },
            { n: 6, x: 84.2, y: 78.5 },
          ],
          legend: [
            { n: 1, text: [chip("ปรับเร็ว", "Zap"), " ปรับทันที ไม่ใช้โควตา AI"] },
            { n: 2, text: [chip("เสก", "Sparkles"), " พิมพ์บอก AI ให้แก้เฉพาะจุดนี้"] },
            { n: 3, text: "เปลี่ยนสีพื้นหลังและสีตัวอักษร" },
            { n: 4, text: "ปรับขนาดตัวอักษร ระยะห่าง และความมน" },
            { n: 5, text: "แก้ข้อความได้โดยตรง" },
            { n: 6, text: "กดยืนยันเพื่อบันทึกข้อความ" },
          ],
        },
      },
      {
        kind: "tip",
        title: "ย้อนกลับได้เสมอ",
        text: "ทุกการแก้ด้วย Wand ย้อนกลับได้ด้วยปุ่ม Undo",
      },
    ],
  },
  {
    id: "history",
    role: "builder",
    title: "ประวัติเวอร์ชันและการย้อนกลับ",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "เปิด History", text: "ปุ่มบนแถบด้านบน" },
          { title: "เลือกจุดที่ต้องการ", text: "บอกคำสั่งและเวลา" },
          { title: "ดูการเปลี่ยนแปลง", text: "ตรวจว่าแก้อะไรไป" },
          { title: "ย้อนกลับมาที่นี่", text: "คืนเดโม ณ จุดนั้น" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/history.jpg",
          width: 1568,
          height: 689,
          caption: "แท็บ History",
          layout: "wide",
          marks: [
            { n: 1, x: 22, y: 11.3 },
            { n: 2, x: 16.8, y: 22.8 },
            { n: 3, x: 27.1, y: 44.1 },
            { n: 4, x: 91, y: 2.9 },
          ],
          legend: [
            { n: 1, text: "รหัสเวอร์ชัน ผู้แก้ (AI หรือสมาชิก) และวันที่" },
            { n: 2, text: [chip("ดูการเปลี่ยนแปลง", "GitCompare"), " ดูรายละเอียดที่แก้"] },
            { n: 3, text: [chip("ย้อนกลับมาที่นี่", "RotateCcw"), " คืนเดโมเป็นสภาพ ณ จุดนั้น"] },
            { n: 4, text: "ระบบเก็บไว้ 30 จุดล่าสุด" },
          ],
        },
      },
      {
        kind: "tip",
        title: "ย้อนทีละขั้น",
        text: ["ปุ่ม ", chip("Undo", "Undo2"), " ที่แถบด้านบน (หรือ Cmd/Ctrl+Z) ใช้ย้อนการเปลี่ยนแปลงล่าสุดทีละขั้น"],
      },
    ],
  },
  {
    id: "premium",
    role: "builder",
    title: "เวอร์ชัน Premium",
    intro: "เวอร์ชัน Premium ใช้นำเสนอฟีเจอร์เพิ่มเติมให้ลูกค้า โดยเวอร์ชันปกติยังอยู่ครบไม่ถูกแก้ไข ฟีเจอร์ที่เลือกจะถูกสร้างเพิ่มในเวอร์ชัน Premium เท่านั้น",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "กด “Premium”", text: "ที่แถบเฟส" },
          { title: "ให้ AI แนะนำ", text: "ฟีเจอร์ที่เหมาะกับระบบ" },
          { title: "เลือกฟีเจอร์", text: "พร้อมจำนวนวันโดยประมาณ" },
          { title: "สร้างเวอร์ชัน Premium", text: "สลับดูกับเวอร์ชันปกติได้" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/premium.jpg",
          width: 1131,
          height: 1064,
          caption: "หน้าต่างเลือกฟีเจอร์ Premium",
          layout: "side",
          marks: [
            { n: 1, x: 35.5, y: 19 },
            { n: 2, x: 4.3, y: 31.5 },
            { n: 3, x: 85.1, y: 31.6 },
            { n: 4, x: 59.5, y: 93.7 },
            { n: 5, x: 70.6, y: 93.7 },
          ],
          legend: [
            { n: 1, text: [chip("ให้ AI ดูโปรเจกต์นี้แล้วแนะนำ", "WandSparkles")] },
            { n: 2, text: "ติ๊กเลือกฟีเจอร์ที่ต้องการเสนอ" },
            { n: 3, text: "จำนวนวันโดยประมาณ สำหรับใบเสนอราคา" },
            { n: 4, text: "“ไว้ทีหลัง” ปิดหน้าต่างโดยยังไม่สร้าง" },
            { n: 5, text: "“สร้างเวอร์ชัน Premium”" },
          ],
        },
      },
      {
        kind: "tip",
        title: "คลังหน้าจอแยกกัน",
        text: "เวอร์ชันปกติและเวอร์ชัน Premium มีคลังหน้าจอของตัวเอง จึงออกใบเสนอราคาแยกกันได้",
      },
    ],
  },
  {
    id: "share",
    role: "builder",
    title: "แชร์เดโมและทำงานร่วมกับทีม",
    blocks: [
      { kind: "heading", text: "ส่งเดโมให้ลูกค้าดู" },
      {
        kind: "steps",
        steps: [
          { title: "เปิดเมนูเพิ่มเติม", text: "ปุ่ม … บนแถบด้านบน" },
          { title: "คัดลอกลิงก์แชร์", text: "ระบบคัดลอกลิงก์ให้" },
          { title: "ส่งลิงก์ให้ลูกค้า", text: "ทางอีเมลหรือแชท" },
          { title: "ลูกค้าเปิดดูเดโม", text: "ไม่ต้องมีบัญชี FITT Builder" },
        ],
      },
      {
        kind: "text",
        text: "ลิงก์แชร์เป็นภาพของเดโม ณ เวลาที่คัดลอก หากแก้ไขเพิ่มเติมแล้วต้องการให้ลูกค้าเห็นเวอร์ชันล่าสุด กรุณาคัดลอกลิงก์ใหม่อีกครั้ง",
      },
      { kind: "heading", text: "เชิญเพื่อนร่วมทีมเข้าโปรเจกต์" },
      {
        kind: "figure",
        figure: {
          src: "/guide/share-menu.jpg",
          width: 470,
          height: 272,
          caption: "เมนู … บนแถบด้านบน",
          layout: "side",
          marks: [
            { n: 1, x: 75, y: 15 },
            { n: 2, x: 82.9, y: 38.6 },
            { n: 3, x: 56, y: 61.8 },
            { n: 4, x: 39, y: 86 },
          ],
          legend: [
            { n: 1, text: [chip("สร้างจากเอกสาร (Spec)", "FileText")] },
            { n: 2, text: [chip("ค้นหา/ติดตั้ง npm package", "Package"), " (สำหรับนักพัฒนา)"] },
            { n: 3, text: [chip("คัดลอกลิงก์แชร์", "Share2")] },
            { n: 4, text: [chip("เชิญทีม", "Users")] },
          ],
        },
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/share-invite.jpg",
          width: 1040,
          height: 706,
          caption: "หน้าต่างเชิญทีม",
          layout: "side",
          marks: [
            { n: 1, x: 34, y: 27.6 },
            { n: 2, x: 49, y: 27.7 },
            { n: 3, x: 3.1, y: 58.8 },
            { n: 4, x: 70.4, y: 58.8 },
            { n: 5, x: 86, y: 58.8 },
            { n: 6, x: 16.9, y: 83.3 },
          ],
          legend: [
            { n: 1, text: "สิทธิ์ของลิงก์เชิญ: Viewer หรือ Editor" },
            { n: 2, text: "“สร้างลิงก์” เชิญ" },
            { n: 3, text: "อีเมลของเพื่อนร่วมทีม" },
            { n: 4, text: "สิทธิ์ของผู้ได้รับเชิญ" },
            { n: 5, text: "“เชิญ”" },
            { n: 6, text: "รายชื่อสมาชิกในโปรเจกต์" },
          ],
        },
      },
      {
        kind: "tip",
        title: "เรื่องสิทธิ์",
        text: "Editor ร่วมสร้างและอนุมัติเฟสได้ ส่วน Viewer ดูได้อย่างเดียว ผู้ที่ได้รับเชิญต้องได้รับสิทธิ์ใช้งาน FITT Builder ด้วยจึงจะเปิดหน้าทำงานได้ หากต้องการให้ลูกค้าดูงาน แนะนำให้ใช้ลิงก์แชร์แทน",
      },
      { kind: "heading", text: "ห้องแชททีม" },
      {
        kind: "steps",
        steps: [
          { title: "กดปุ่ม “แชท”", text: "บนแถบด้านบน" },
          { title: "พิมพ์ข้อความ", text: "แนบรูปหรือไฟล์ได้" },
          { title: "แท็กและตอบกลับ", text: "พร้อมกดรีแอกชัน" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/team-chat.jpg",
          width: 939,
          height: 1288,
          caption: "ห้องแชททีม (ชื่อในภาพเป็นตัวอย่าง)",
          layout: "side",
          marks: [
            { n: 1, x: 24.4, y: 12.8 },
            { n: 2, x: 7, y: 89.7 },
            { n: 3, x: 41.8, y: 93.9 },
            { n: 4, x: 81.4, y: 93.9 },
          ],
          legend: [
            { n: 1, text: "การอนุมัติเฟสจะแสดงในห้องนี้ให้ทุกคนเห็น" },
            { n: 2, text: [chip("", "Paperclip"), " แนบรูปหรือไฟล์เอกสาร"] },
            { n: 3, text: "ช่องพิมพ์ข้อความถึงทีม" },
            { n: 4, text: [chip("ส่ง", "Send")] },
          ],
        },
      },
      {
        kind: "bullets",
        items: [
          "สามารถแท็กสมาชิก ตอบกลับข้อความ และกดรีแอกชันได้",
          "หลายคนเปิดโปรเจกต์พร้อมกันได้ และจะเห็นว่าใครกำลังอยู่ในโปรเจกต์",
        ],
      },
    ],
  },

  // ─── คนทำเอกสาร ───────────────────────────────────────────────────────────
  {
    id: "screens",
    role: "documents",
    title: "คลังหน้าจอและผัง Flow",
    intro: "คลังหน้าจอจะเก็บภาพทุกหน้าจอและหน้าต่างย่อย (modal) ของเดโม เพื่อใช้ทำใบเสนอราคาและข้อเสนอโครงการ",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "เปิดคลังหน้าจอ", text: "ปุ่มบนแถบด้านบน" },
          { title: "เก็บภาพ", text: "แคปทุกหน้า หรือสแกน" },
          { title: "ตรวจในแกลเลอรี", text: "เติมหน้าที่ขาดได้" },
          { title: "ดูผัง Flow", text: "เส้นทางการใช้งาน" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/screens-gallery.jpg",
          width: 1518,
          height: 784,
          caption: "แท็บแกลเลอรี",
          layout: "wide",
          marks: [
            { n: 1, x: 1.5, y: 8.7 },
            { n: 2, x: 11.8, y: 8.7 },
            { n: 3, x: 22, y: 8.8 },
            { n: 4, x: 30.8, y: 8.7 },
            { n: 5, x: 41.6, y: 8.7 },
            { n: 6, x: 50.9, y: 8.7 },
            { n: 7, x: 71.4, y: 4.2 },
            { n: 8, x: 1.7, y: 19.7 },
            { n: 9, x: 1.2, y: 50.3 },
          ],
          legend: [
            { n: 1, text: [chip("แคปทุกหน้า", "ListChecks"), " เก็บภาพตามรายการหน้าจอของเดโม (แนะนำ)"] },
            { n: 2, text: [chip("ตรวจดัชนีอีกครั้ง", "Sparkles"), " ให้ระบบตรวจรายการหน้าจอใหม่"] },
            { n: 3, text: [chip("อัดการใช้งาน", "Radio"), " ใช้เดโมตามปกติ ระบบเก็บทุกหน้าที่เปลี่ยน"] },
            { n: 4, text: [chip("สแกนต่อจากหน้านี้", "ScanLine"), " สำหรับเดโมที่ต้องเข้าสู่ระบบก่อน"] },
            { n: 5, text: [chip("สแกนอัตโนมัติ", "ScanLine"), " ให้ระบบเดินเก็บภาพเอง"] },
            { n: 6, text: [chip("แคปหน้านี้", "Camera"), " เก็บภาพหน้าที่เปิดอยู่"] },
            { n: 7, text: "แท็บ แกลเลอรี · ผัง Flow · ใบเสนอราคา · ข้อเสนอโครงการ" },
            { n: 8, text: "ภาพแต่ละหน้าจอ กดเพื่อดูขนาดเต็ม" },
            { n: 9, text: "หน้าต่างย่อยของหน้านั้น" },
          ],
        },
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/screens-flow.jpg",
          width: 1518,
          height: 470,
          caption: "แท็บผัง Flow: เส้นเชื่อมแสดงว่ากดปุ่มใดแล้วไปหน้าใด สามารถลากเพื่อเลื่อน และใช้ Ctrl/⌘ + ล้อเมาส์เพื่อซูม",
          layout: "wide",
          marks: [],
          legend: [],
        },
      },
    ],
  },
  {
    id: "quotation",
    role: "documents",
    title: "ใบเสนอราคา",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "ตั้งหัวกระดาษ", text: "ครั้งเดียวใช้ได้ทุกโปรเจกต์" },
          { title: "ตรวจรายการ", text: "ขนาดงานและจำนวนวัน" },
          { title: "ตั้งราคาและงวดชำระ", text: "ราคาต่อวัน ส่วนลด VAT งวด" },
          { title: "ส่งอนุมัติ", text: "ผู้ตรวจและผู้อนุมัติของบริษัท" },
          { title: "พิมพ์ / บันทึก", text: "PDF หรือ Word หลังอนุมัติ" },
        ],
      },
      {
        kind: "text",
        text: ["เปิด ", chip("คลังหน้าจอ", "Camera"), " แล้วเลือกแท็บ “ใบเสนอราคา” ระบบจะตั้งรายการให้จากหน้าจอที่เก็บไว้ และสามารถปรับได้ทุกส่วน"],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/quote-letterhead.jpg",
          width: 1518,
          height: 520,
          caption: "หัวกระดาษในนามบริษัทของคุณ (ข้อมูลในภาพเป็นตัวอย่าง)",
          layout: "wide",
          marks: [
            { n: 1, x: 2, y: 41.8 },
            { n: 2, x: 9.3, y: 50 },
            { n: 3, x: 53.5, y: 85.5 },
            { n: 4, x: 75.5, y: 35.2 },
            { n: 5, x: 97.8, y: 35.3 },
          ],
          legend: [
            { n: 1, text: "อัปโหลดโลโก้บริษัท" },
            { n: 2, text: "ชื่อบริษัท เลขผู้เสียภาษี ที่อยู่ และช่องทางติดต่อ" },
            { n: 3, text: "สีประจำเอกสาร" },
            { n: 4, text: "“ดึงค่าเริ่มต้นของฉัน” นำหัวกระดาษที่บันทึกไว้มาใช้" },
            { n: 5, text: "“บันทึกเป็นค่าเริ่มต้น” โปรเจกต์ถัดไปจะใช้หัวกระดาษนี้ให้อัตโนมัติ" },
          ],
        },
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/quote-items.jpg",
          width: 1568,
          height: 430,
          caption: "รายการงานในใบเสนอราคา",
          layout: "wide",
          marks: [
            { n: 1, x: 68, y: 2.3 },
            { n: 2, x: 79.5, y: 2.4 },
            { n: 3, x: 92, y: 2.4 },
            { n: 4, x: 1.2, y: 20.5 },
            { n: 5, x: 65.6, y: 57.5 },
            { n: 6, x: 82.1, y: 57.5 },
          ],
          legend: [
            { n: 1, text: "“เขียนรายละเอียดด้วย AI”" },
            { n: 2, text: "“ให้ AI ช่วยตั้งราคา”" },
            { n: 3, text: "“สร้างรายการจากโมดูล” สรุปเป็นโมดูลแทนรายหน้าจอ" },
            { n: 4, text: "แจ้งเตือนเมื่อเลือกเสนอเป็นราคาเดียว" },
            { n: 5, text: "ขนาดงาน เล็ก / กลาง / ใหญ่ / กำหนดเอง" },
            { n: 6, text: "จำนวนวันที่ระบบคำนวณให้" },
          ],
        },
      },
      {
        kind: "tip",
        title: "ป้าย Partner",
        text: "โปรเจกต์ใน workspace ของ Partner จะแสดงป้าย Partner ที่หัวกระดาษ และเอกสารที่พิมพ์ออกมาจะเป็นในนามบริษัทของคุณ",
      },
    ],
  },
  {
    id: "quotation-pricing",
    role: "documents",
    title: "ราคา งวดชำระ และเงื่อนไข",
    blocks: [
      {
        kind: "figure",
        figure: {
          src: "/guide/quote-pricing.jpg",
          width: 1568,
          height: 664,
          caption: "ส่วนราคาและสรุปยอด",
          layout: "wide",
          marks: [
            { n: 1, x: 26, y: 5.1 },
            { n: 2, x: 1.2, y: 35.6 },
            { n: 3, x: 25.2, y: 35.6 },
            { n: 4, x: 49.7, y: 35.6 },
            { n: 5, x: 1.2, y: 62.7 },
            { n: 6, x: 74, y: 48.6 },
            { n: 7, x: 74, y: 57.8 },
            { n: 8, x: 74, y: 81.2 },
            { n: 9, x: 74, y: 95.7 },
          ],
          legend: [
            { n: 1, text: "“เสนอเป็นราคาเดียว” พิมพ์บรรทัดเดียวพร้อมราคาเดียว" },
            { n: 2, text: "ราคาต่อวัน" },
            { n: 3, text: "ส่วนลด เป็น % หรือบาท" },
            { n: 4, text: "VAT (ใส่ 0 หากไม่คิด)" },
            { n: 5, text: "ราคาตลาด/วัน และประโยคเทียบราคา (ใส่ 0 หากไม่ต้องการเทียบ)" },
            { n: 6, text: "สรุปยอดรวมทั้งสิ้น" },
            { n: 7, text: "“แบบใบปะหน้า + รายละเอียด” หน้าแรกสรุปต่อโมดูล" },
            { n: 8, text: "แสดงที่มาของราคา และแนบภาพหน้าจอท้ายเอกสาร" },
            { n: 9, text: "“พิมพ์ / บันทึกเป็น PDF” กดได้หลังเอกสารผ่านการอนุมัติ (หัวข้อ “หลังอนุมัติ: พิมพ์และบันทึก”)" },
          ],
        },
      },
      { kind: "heading", text: "ค่า Subscription รายปี" },
      {
        kind: "figure",
        figure: {
          src: "/guide/subscription-toggle.jpg",
          width: 638,
          height: 404,
          caption: "สรุปยอดและสวิตช์ค่า Subscription รายปี",
          layout: "side",
          marks: [
            { n: 1, x: 42, y: 9 },
            { n: 2, x: 2.5, y: 62 },
          ],
          legend: [
            { n: 1, text: "สรุปยอด: แรงงานรวม ราคาก่อนภาษี VAT และรวมทั้งสิ้น" },
            { n: 2, text: "เปิดสวิตช์ “แสดงค่า Subscription รายปี” เพื่อพิมพ์บรรทัดค่าต่อปีไว้ใต้รายการ (รวมทุกรายการด้านบน) งานที่จ่ายครั้งเดียวปิดสวิตช์นี้ไว้ได้" },
          ],
        },
      },
      { kind: "heading", text: "งวดชำระ" },
      {
        kind: "figure",
        figure: {
          src: "/guide/payment-table.jpg",
          width: 1568,
          height: 232,
          caption: "ตารางงวดชำระ",
          layout: "wide",
          marks: [
            { n: 1, x: 79, y: 6.5 },
            { n: 2, x: 22.6, y: 20.5 },
            { n: 3, x: 22.3, y: 58.5 },
            { n: 4, x: 72.6, y: 59.7 },
            { n: 5, x: 7.6, y: 93 },
          ],
          legend: [
            { n: 1, text: "แบบสำเร็จรูป: UAT 60/40 · ลงนาม 60/40 · งวดเท่ากัน (ใส่จำนวนงวดได้)" },
            { n: 2, text: "“หัวข้อตารางในเอกสาร” คลิกที่หัวตารางเพื่อแก้ชื่อ เว้นว่างไว้จะใช้ชื่อเดิม" },
            { n: 3, text: "เงื่อนไขการชำระของแต่ละงวด แก้ข้อความได้ บรรทัดเล็กใต้เงื่อนไข เช่น “ชำระภายใน 30 วันนับจากวันที่ถึงกำหนด” ก็แก้ได้ ลบข้อความจนว่าง เอกสารจะเว้นว่างตรงนั้น กด “คืนค่าข้อความ” เพื่อกลับไปข้อความที่ระบบตั้งให้ โดย % และจำนวนวันไม่เปลี่ยน" },
            { n: 4, text: "สัดส่วน % และจำนวนวันที่ต้องชำระ ยอดก่อนภาษี VAT และรวม คำนวณให้เอง" },
            { n: 5, text: "“เพิ่มงวด”" },
          ],
        },
      },
      {
        kind: "text",
        text: "เปิดหรือปิด “แสดงสัดส่วน % ของแต่ละงวด” ได้ตามที่ลูกค้าต้องการ",
      },
      { kind: "heading", text: "เงื่อนไขการส่งมอบและตรวจรับ" },
      {
        kind: "text",
        text: "ข้อสัญญาสร้างจากตัวเลขในใบนี้ให้อัตโนมัติ เมื่อแก้งวดชำระ ข้อสัญญาจะปรับตามให้ และยังแก้ข้อความแต่ละข้อ ลบข้อ หรือเพิ่มข้อได้ตามต้องการ เลือกได้ด้วยว่าครบกำหนดตรวจรับแล้วลูกค้าไม่แจ้งข้อบกพร่อง ให้ถือว่าตรวจรับแล้วหรือไม่",
      },
      { kind: "heading", text: "ค่าบำรุงรักษาระบบ (MA)" },
      {
        kind: "text",
        text: "คิดแยกจากราคาพัฒนา ไม่รวมในยอดรวมทั้งสิ้น และพิมพ์เป็นตารางของตัวเองท้ายใบเสนอราคา",
      },
      { kind: "heading", text: "ดูตัวอย่างก่อนส่ง" },
      {
        kind: "text",
        text: [
          "กด ",
          chip("ดูตัวอย่างเอกสาร", "Eye"),
          " เพื่อดูหน้าตาเหมือนใบที่พิมพ์ ระหว่างที่ยังไม่อนุมัติจะมีลายน้ำ “ตัวอย่าง · ยังไม่อนุมัติ” และกด ",
          chip("ดูแบบแบ่งหน้า A4", "FileText"),
          " เพื่อดูว่าตัดหน้ากระดาษตรงไหน (ลายน้ำจะติดไปทุกหน้า)",
        ],
      },
      {
        kind: "tip",
        title: "เลขที่เอกสาร",
        text: "โปรเจกต์ใน workspace จะได้เลขที่ใบเสนอราคาต่อเนื่องของ workspace ให้อัตโนมัติ",
      },
    ],
  },
  {
    id: "proposal",
    role: "documents",
    title: "ข้อเสนอโครงการ",
    intro: [
      "ข้อเสนอโครงการเป็นเอกสารเล่าเรื่องให้ลูกค้า ประกอบด้วยปัญหาของลูกค้า สิ่งที่ระบบทำให้ ผลที่ได้ และภาพการใช้งานจริง ใช้หัวกระดาษชุดเดียวกับใบเสนอราคา เปิดได้จาก ",
      chip("คลังหน้าจอ", "Camera"),
      " แท็บ “ข้อเสนอโครงการ”",
    ],
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "ตรวจปัญหาและผลลัพธ์", text: "แก้ได้ทุกช่อง" },
          { title: "แตกเป็นโมดูล", text: "ด้วย AI" },
          { title: "เลือกภาพหน้าจอ", text: "เปิดหรือปิดได้" },
          { title: "ส่งอนุมัติ", text: "เหมือนใบเสนอราคา" },
          { title: "พิมพ์ / บันทึก", text: "PDF หรือ Word" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/proposal-story.jpg",
          width: 1568,
          height: 600,
          caption: "ปัญหา → สิ่งที่ระบบทำให้ → ผลที่ได้",
          layout: "wide",
          marks: [
            { n: 1, x: 34.5, y: 21.6 },
            { n: 2, x: 64.5, y: 21.6 },
            { n: 3, x: 94.5, y: 21.6 },
            { n: 4, x: 98.5, y: 34.4 },
            { n: 5, x: 9.5, y: 91.2 },
          ],
          legend: [
            { n: 1, text: "ปัญหาของลูกค้า" },
            { n: 2, text: "สิ่งที่ระบบทำให้" },
            { n: 3, text: "ผลที่ลูกค้าจะได้รับ" },
            { n: 4, text: "ลบข้อ" },
            { n: 5, text: "“เพิ่มข้อ” และระบุสิ่งที่ไม่รวมในเฟสนี้" },
          ],
        },
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/proposal-modules.jpg",
          width: 1568,
          height: 430,
          caption: "โมดูลของระบบ และการใช้งานจริงพร้อมภาพ",
          layout: "wide",
          marks: [
            { n: 1, x: 86, y: 20.9 },
            { n: 2, x: 22, y: 45.9 },
            { n: 3, x: 16.5, y: 61.4 },
            { n: 4, x: 12.1, y: 79.4 },
          ],
          legend: [
            { n: 1, text: "“แตกเป็นโมดูลด้วย AI” แบ่งระบบตามฝ่ายที่ใช้" },
            { n: 2, text: "เปิดหรือปิดส่วนการใช้งานจริง" },
            { n: 3, text: "เปิดหรือปิดภาพหน้าจอ (ปิดแล้วเอกสารจะสั้นลง)" },
            { n: 4, text: "คำอธิบายแต่ละหน้าจอ: ทำอะไร วิธีใช้ ผลลัพธ์" },
          ],
        },
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/proposal-print.jpg",
          width: 1568,
          height: 522,
          caption: "ส่วนท้ายของข้อเสนอโครงการ",
          layout: "wide",
          marks: [
            { n: 1, x: 15.5, y: 18.5 },
            { n: 2, x: 15.5, y: 52.4 },
            { n: 3, x: 41, y: 70.6 },
            { n: 4, x: 41, y: 86 },
          ],
          legend: [
            { n: 1, text: "“อ้างถึงใบเสนอราคา” พิมพ์เลขที่ใบเสนอราคาและหัวข้อราคาให้อ้างอิงกัน" },
            { n: 2, text: "“ฉบับย่อ (2–3 หน้า)” สำหรับส่งเบื้องต้น" },
            { n: 3, text: "“พิมพ์ / บันทึกเป็น PDF” ส่งคู่กับใบเสนอราคาเป็นชุดเดียว (หลังอนุมัติ)" },
            { n: 4, text: "“บันทึกเป็น Word (.docx)” เปิดแก้ไขต่อใน Word หรือ Google Docs" },
          ],
        },
      },
      {
        kind: "tip",
        title: "แนะนำ",
        text: "ร่างข้อเสนอโครงการด้วย AI หลังจากเก็บภาพหน้าจอครบแล้ว เพราะ AI จะอ่านคำอธิบายของแต่ละหน้าจอประกอบด้วย ทำให้ได้ผลที่ตรงกับระบบมากขึ้น",
      },
    ],
  },

  {
    id: "doc-editions",
    role: "documents",
    title: "เก็บเอกสารเป็นฉบับและดึงกลับมาทำต่อ",
    intro: "ใบเสนอราคาและข้อเสนอโครงการบันทึกให้อัตโนมัติและบันทึกทับของเดิมเสมอ หากต้องการเก็บฉบับหนึ่งไว้แล้วลองแก้เป็นอีกแบบ เช่น เก็บราคาเดิมไว้ก่อนต่อรองกับลูกค้า ให้บันทึกเป็นฉบับไว้ก่อนแก้",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "บันทึกเป็นฉบับ", text: "ระบบตั้งเลข v1, v2 ให้ และตั้งชื่อเพิ่มได้" },
          { title: "แก้เอกสารต่อ", text: "ฉบับที่บันทึกไว้ไม่เปลี่ยนตาม" },
          { title: "ดึงกลับมาทำต่อ", text: "เลือกฉบับจากรายการ" },
        ],
      },
      {
        kind: "text",
        text: ["ปุ่ม ", chip("บันทึกเป็นฉบับ", "BookmarkPlus"), " และรายการ “ฉบับที่บันทึกไว้” อยู่เหนือสถานะการอนุมัติของเอกสาร เวอร์ชันปกติและเวอร์ชัน Premium มีรายการแยกกัน"],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/doc-editions.jpg",
          width: 644,
          height: 796,
          caption: "รายการฉบับด้านขวาของเอกสาร (ชื่อในภาพเป็นตัวอย่าง)",
          layout: "side",
          marks: [
            { n: 1, x: 56, y: 6.3 },
            { n: 2, x: 8.9, y: 21.1 },
            { n: 3, x: 46, y: 45 },
            { n: 4, x: 43.5, y: 63.6 },
            { n: 5, x: 5.6, y: 79.4 },
          ],
          legend: [
            { n: 1, text: [chip("บันทึกเป็นฉบับ", "BookmarkPlus"), " เก็บเอกสารตอนนี้ไว้ ตั้งชื่อเพิ่มได้"] },
            { n: 2, text: "ฉบับที่ระบบเก็บให้เองก่อนดึงฉบับอื่นกลับ" },
            { n: 3, text: "“ตรงกับเอกสารตอนนี้” ฉบับที่เนื้อหาตรงกับงานที่เปิดอยู่" },
            { n: 4, text: "“ดึงกลับมาทำต่อ” นำฉบับนั้นกลับมาเป็นเอกสารที่แก้อยู่" },
            { n: 5, text: "สถานะการอนุมัติเปลี่ยนตามเนื้อหาของเอกสาร" },
          ],
        },
      },
      {
        kind: "bullets",
        items: [
          "ก่อนดึงฉบับกลับ ระบบจะเก็บงานที่เปิดอยู่เป็นฉบับใหม่ให้ก่อน งานจึงไม่หาย",
          "เลขที่เอกสารคงเดิมทุกฉบับ และเลข v1, v2 ไม่พิมพ์ลงในเอกสาร",
          "ฉบับที่บันทึกไว้แก้ไขหรือลบไม่ได้",
        ],
      },
      {
        kind: "tip",
        title: "บันทึกเป็นฉบับไม่ต้องขออนุมัติ",
        text: "การอนุมัติใช้ตอนจะพิมพ์หรือบันทึกไฟล์ Word เท่านั้น หากดึงกลับมาแล้วเนื้อหาตรงกับฉบับที่อนุมัติล่าสุด จะพิมพ์ได้เลย ถ้าไม่ตรงต้องส่งอนุมัติใหม่ก่อนพิมพ์",
      },
    ],
  },

  // ─── ส่งอนุมัติ ───────────────────────────────────────────────────────────
  {
    id: "approval-flow",
    role: "approval",
    title: "การอนุมัติเอกสารทำงานอย่างไร",
    intro: "ใบเสนอราคาและข้อเสนอโครงการของโปรเจกต์ใน workspace ต้องผ่านการอนุมัติของบริษัทก่อน จึงจะพิมพ์หรือบันทึกส่งลูกค้าได้ โปรเจกต์ส่วนตัวไม่ต้องอนุมัติ",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "ผู้จัดทำส่งอนุมัติ", text: "เลือกผู้อนุมัติ (และผู้ตรวจ ถ้ามี)" },
          { title: "ผู้ตรวจตรวจก่อน", text: "ส่งต่อ หรือส่งกลับให้แก้ (ไม่บังคับ)" },
          { title: "ผู้อนุมัติตัดสิน", text: "อนุมัติ หรือส่งกลับให้แก้" },
          { title: "ผู้จัดทำพิมพ์ส่งลูกค้า", text: "PDF หรือ Word" },
        ],
      },
      {
        kind: "features",
        items: [
          { icon: "FileText", label: "ผู้จัดทำ", text: "คนที่ทำเอกสาร กด “ส่งอนุมัติ” และพิมพ์หลังอนุมัติ" },
          { icon: "SearchCheck", label: "ผู้ตรวจ", text: "อ่านก่อนถึงผู้อนุมัติ ตรวจแล้วส่งต่อ หรือส่งกลับให้แก้ อนุมัติเองไม่ได้" },
          { icon: "BadgeCheck", label: "ผู้อนุมัติ", text: "ตัดสินว่าเอกสารส่งถึงลูกค้าได้หรือไม่ เจ้าของและผู้ดูแลของ workspace ก็อนุมัติได้" },
          { icon: "Shield", label: "ผู้ดูแลบริษัท", text: "อนุมัติได้เหมือนผู้อนุมัติ และจัดการคนในบริษัท" },
        ],
      },
      {
        kind: "tip",
        title: "อนุมัติแล้วแก้ไม่ได้โดยไม่รู้ตัว",
        text: "ระบบเก็บสำเนาเอกสารฉบับที่ผู้อนุมัติอ่านไว้ หากแก้ตัวเลขหรือข้อความใด ๆ หลังอนุมัติ เอกสารจะกลับเป็น “แก้ไขหลังอนุมัติแล้ว” และต้องส่งอนุมัติใหม่ก่อนพิมพ์",
      },
      {
        kind: "tip",
        title: "การแจ้งเตือน",
        text: "ระบบส่งอีเมลถึงคนที่ต้องทำขั้นถัดไปให้เอง ผู้ตรวจหรือผู้อนุมัติได้รับเมื่อมีเอกสารรอ คนส่งได้รับเมื่อผู้ตรวจส่งต่อ เมื่ออนุมัติแล้ว และเมื่อถูกส่งกลับพร้อมเหตุผล ถ้าเปิด FITT Builder อยู่จะเห็นข้อความเด้งขึ้น ส่วนกระดิ่งและเมนู “อนุมัติเอกสาร” บอกจำนวนเอกสารที่รอคุณ",
      },
    ],
  },
  {
    id: "send-approval",
    role: "approval",
    title: "ผู้จัดทำ: ส่งขออนุมัติ",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "เปิดเอกสาร", text: "คลังหน้าจอ → ใบเสนอราคา หรือ ข้อเสนอโครงการ" },
          { title: "ดูตัวอย่างเอกสาร", text: "ตรวจหน้าตาก่อนส่ง" },
          { title: "เลือกผู้ตรวจและผู้อนุมัติ", text: "ผู้ตรวจไม่บังคับ" },
          { title: "กด “ส่งอนุมัติ”", text: "ระบบส่งอีเมลแจ้งเขาให้เอง" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/send-approval.jpg",
          width: 638,
          height: 572,
          caption: "แผงอนุมัติด้านขวาของเอกสาร (ชื่อในภาพเป็นตัวอย่าง)",
          layout: "side",
          marks: [
            { n: 1, x: 5, y: 9.5 },
            { n: 2, x: 8, y: 23 },
            { n: 3, x: 34.5, y: 23 },
            { n: 4, x: 8, y: 43.5 },
            { n: 5, x: 8, y: 64.5 },
            { n: 6, x: 5, y: 84 },
          ],
          legend: [
            { n: 1, text: "สถานะของเอกสาร เช่น “ยังไม่ได้ส่งอนุมัติ” หรือ “แก้ไขหลังอนุมัติแล้ว”" },
            { n: 2, text: [chip("ส่งอนุมัติ", "Send"), " เปิดรายชื่อให้เลือก"] },
            { n: 3, text: [chip("อนุมัติเอง", "BadgeCheck"), " แสดงเฉพาะเจ้าของหรือผู้ดูแลของ workspace นี้ อนุมัติเอกสารได้ทันที"] },
            { n: 4, text: "“ให้ใครตรวจก่อน” เลือกผู้ตรวจ หรือเลือก “ไม่ต้องตรวจ — ส่งถึงผู้อนุมัติเลย”" },
            { n: 5, text: "“ผู้อนุมัติ” คนที่อนุมัติได้ ป้ายด้านขวาบอกเหตุผล เช่น เจ้าของ ผู้ดูแล ผู้อนุมัติ หรือผู้ดูแลบริษัท" },
            { n: 6, text: [chip("ดูตัวอย่างเอกสาร", "Eye"), " ดูหน้าตาเหมือนใบที่พิมพ์"] },
          ],
        },
      },
      { kind: "heading", text: "ดูตัวอย่างก่อนส่ง" },
      {
        kind: "figure",
        figure: {
          src: "/guide/doc-preview.jpg",
          width: 1054,
          height: 1148,
          caption: "ดูตัวอย่างเอกสาร: ลายน้ำ “ตัวอย่าง · ยังไม่อนุมัติ” อยู่ทุกหน้าจนกว่าจะอนุมัติ",
          layout: "side",
          marks: [],
          legend: [],
        },
      },
      {
        kind: "text",
        text: [
          "ในหน้าดูตัวอย่าง กด ",
          chip("ดูแบบแบ่งหน้า A4", "FileText"),
          " เพื่อเปิดหน้าต่างพิมพ์ของเบราว์เซอร์ ดูได้ว่าตัดหน้ากระดาษตรงไหน มีข้อความล้นหน้าหรือไม่ ทุกหน้ามีลายน้ำ และยังไม่ออกเลขที่เอกสาร",
        ],
      },
      { kind: "heading", text: "หลังส่งอนุมัติ" },
      {
        kind: "figure",
        figure: {
          src: "/guide/approval-pending.jpg",
          width: 644,
          height: 510,
          caption: "รออนุมัติ",
          layout: "side",
          marks: [
            { n: 1, x: 7, y: 40.5 },
            { n: 2, x: 9.5, y: 57.5 },
            { n: 3, x: 6, y: 80 },
          ],
          legend: [
            { n: 1, text: "รออนุมัติจากใคร และส่งเมื่อไร ถ้ามีผู้ตรวจ จะเป็น “รอตรวจโดย … แล้วจะส่งต่อให้ … อนุมัติ” แล้วเปลี่ยนเป็น “ตรวจแล้วโดย … · รออนุมัติจาก …”" },
            { n: 2, text: "“ส่งให้คนอื่นแทน” เปลี่ยนผู้อนุมัติ" },
            { n: 3, text: "ปุ่มพิมพ์ยังกดไม่ได้จนกว่าจะอนุมัติ" },
          ],
        },
      },
      {
        kind: "tip",
        title: "ถูกส่งกลับให้แก้",
        text: "แผงอนุมัติจะแสดงหมายเหตุของผู้ตรวจหรือผู้อนุมัติ แก้เอกสารตามนั้น แล้วกด “ส่งอนุมัติ” อีกครั้ง",
      },
    ],
  },
  {
    id: "review",
    role: "approval",
    title: "ผู้ตรวจ: ตรวจแล้วส่งต่อ",
    intro: "ผู้ตรวจอ่านเอกสารก่อนถึงผู้อนุมัติ ใช้เมื่อบริษัทต้องการให้อีกคนดูราคาและเงื่อนไขก่อน",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "เปิด “อนุมัติเอกสาร”", text: "เมนูด้านซ้าย หัวข้อ “เอกสาร”" },
          { title: "เลือกเอกสาร “รอตรวจ”", text: "อยู่ใน “รอคุณตรวจหรืออนุมัติ”" },
          { title: "อ่านเอกสาร", text: "เปิดโปรเจกต์ดูได้อย่างเดียว" },
          { title: "ส่งต่อหรือส่งกลับ", text: "ใส่หมายเหตุให้คนถัดไป" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/review-desk.jpg",
          width: 1568,
          height: 255,
          caption: "หน้าอนุมัติเอกสารของผู้ตรวจ (ชื่อในภาพเป็นตัวอย่าง)",
          layout: "wide",
          marks: [
            { n: 1, x: 23, y: 60 },
            { n: 2, x: 27.8, y: 37.5 },
            { n: 3, x: 27.8, y: 57 },
            { n: 4, x: 27.8, y: 82 },
            { n: 5, x: 52.3, y: 82 },
            { n: 6, x: 86.3, y: 9 },
          ],
          legend: [
            { n: 1, text: "เอกสารที่ส่งมาให้คุณตรวจ ป้าย “รอตรวจ”" },
            { n: 2, text: "บอกว่าคุณเป็นผู้ตรวจ และใครจะเป็นผู้อนุมัติต่อ" },
            { n: 3, text: "หมายเหตุถึงผู้อนุมัติ (ต้องใส่เมื่อส่งกลับให้แก้)" },
            { n: 4, text: [chip("ตรวจแล้ว ส่งต่อให้ผู้อนุมัติ", "Forward")] },
            { n: 5, text: [chip("ส่งกลับให้แก้", "Undo2"), " เอกสารกลับไปที่ผู้จัดทำพร้อมหมายเหตุ"] },
            { n: 6, text: "“เปิดโปรเจกต์ (ดูอย่างเดียว)” ดูเดโมและหน้าจอประกอบ" },
          ],
        },
      },
      {
        kind: "tip",
        title: "ได้รับลิงก์เชิญเป็นผู้ตรวจ",
        text: "เปิดลิงก์ เข้าสู่ระบบด้วยอีเมลของคุณ แล้วกดตอบรับ ระบบจะพาไปหน้า “อนุมัติเอกสาร” ให้เลย ลิงก์ใช้ได้ครั้งเดียว ครั้งต่อไปเปิดหน้านี้จากเมนูได้เลย",
      },
    ],
  },
  {
    id: "approve",
    role: "approval",
    title: "ผู้อนุมัติ: อนุมัติหรือส่งกลับ",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "เปิด “อนุมัติเอกสาร”", text: "เมนูด้านซ้าย หัวข้อ “เอกสาร”" },
          { title: "เลือกเอกสาร", text: "ในหัวข้อ “รอคุณอนุมัติ”" },
          { title: "อ่านให้ครบ", text: "รวมความเห็นของผู้ตรวจ" },
          { title: "อนุมัติ หรือส่งกลับ", text: "ส่งกลับต้องใส่เหตุผล" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/approvals.jpg",
          width: 1547,
          height: 784,
          caption: "หน้าอนุมัติเอกสาร (ข้อมูลในภาพเป็นตัวอย่าง)",
          layout: "wide",
          marks: [
            { n: 1, x: 8.8, y: 15.8 },
            { n: 2, x: 10.3, y: 26.5 },
            { n: 3, x: 27.3, y: 4.6 },
            { n: 4, x: 27.3, y: 11.9 },
            { n: 5, x: 27.3, y: 22 },
            { n: 6, x: 86, y: 4.2 },
          ],
          legend: [
            { n: 1, text: "“รอคุณอนุมัติ” เอกสารที่รอคุณตัดสิน" },
            { n: 2, text: "“ที่คุณดำเนินการล่าสุด” เอกสารที่อนุมัติหรือส่งกลับไปแล้ว" },
            { n: 3, text: "ชนิดเอกสาร ชื่อโปรเจกต์ เวอร์ชัน และวันที่ส่ง" },
            { n: 4, text: "ผลการตัดสิน" },
            { n: 5, text: "เอกสารฉบับที่ส่งมา หน้าตาเหมือนใบที่ลูกค้าจะได้รับ" },
            { n: 6, text: "“เปิดโปรเจกต์ (ดูอย่างเดียว)”" },
          ],
        },
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/approver-desk.jpg",
          width: 1568,
          height: 309,
          caption: "เมื่อเอกสารผ่านผู้ตรวจมาแล้ว (ชื่อในภาพเป็นตัวอย่าง)",
          layout: "wide",
          marks: [
            { n: 1, x: 22.5, y: 52 },
            { n: 2, x: 27.8, y: 29.5 },
            { n: 3, x: 27.8, y: 65 },
            { n: 4, x: 27.8, y: 87.5 },
            { n: 5, x: 45, y: 87.5 },
          ],
          legend: [
            { n: 1, text: "ป้าย “ตรวจแล้ว” ผู้ตรวจส่งต่อมาให้คุณ" },
            { n: 2, text: [chip("ตรวจแล้วโดย …", "SearchCheck"), " ชื่อผู้ตรวจ วันที่ และหมายเหตุ"] },
            { n: 3, text: "หมายเหตุ (ต้องใส่เมื่อส่งกลับให้แก้)" },
            { n: 4, text: [chip("อนุมัติ", "BadgeCheck")] },
            { n: 5, text: [chip("ส่งกลับให้แก้", "Undo2")] },
          ],
        },
      },
      {
        kind: "tip",
        title: "ได้รับลิงก์เชิญเป็นผู้อนุมัติ",
        text: "เปิดลิงก์ เข้าสู่ระบบด้วยอีเมลของคุณ แล้วกดตอบรับ ลิงก์ใช้ได้ครั้งเดียว ครั้งต่อไปเปิด “อนุมัติเอกสาร” จากเมนูได้เลย ถ้าเปิดลิงก์เดิมซ้ำ ระบบจะบอกว่าคุณอยู่ในบริษัทแล้ว และมีปุ่มพาไปหน้านั้น",
      },
    ],
  },
  {
    id: "after-approval",
    role: "approval",
    title: "หลังอนุมัติ: พิมพ์และบันทึก",
    blocks: [
      {
        kind: "figure",
        figure: {
          src: "/guide/approval-approved.jpg",
          width: 644,
          height: 360,
          caption: "อนุมัติแล้ว (ชื่อในภาพเป็นตัวอย่าง)",
          layout: "side",
          marks: [
            { n: 1, x: 7, y: 16 },
            { n: 2, x: 6, y: 56 },
            { n: 3, x: 6, y: 94 },
          ],
          legend: [
            { n: 1, text: "อนุมัติแล้วโดยใคร และเมื่อไร (ถ้ามีผู้ตรวจ จะต่อท้ายด้วย “ตรวจโดย …”)" },
            { n: 2, text: [chip("พิมพ์ / บันทึกเป็น PDF", "Printer"), " ในหน้าต่างพิมพ์ เลือกปลายทางเป็น “Save as PDF”"] },
            { n: 3, text: [chip("บันทึกเป็น Word (.docx)", "FileDown"), " เปิดแก้ต่อใน Word หรือ Google Docs"] },
          ],
        },
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/approval-changed.jpg",
          width: 644,
          height: 510,
          caption: "แก้เอกสารหลังอนุมัติ",
          layout: "side",
          marks: [
            { n: 1, x: 7, y: 40.5 },
            { n: 2, x: 9.5, y: 58 },
          ],
          legend: [
            { n: 1, text: "“แก้ไขหลังอนุมัติแล้ว — ต้องส่งอนุมัติใหม่ก่อนพิมพ์” ปุ่มพิมพ์จะกดไม่ได้อีกครั้ง" },
            { n: 2, text: [chip("ส่งอนุมัติ", "Send"), " ส่งฉบับที่แก้ไปให้อนุมัติใหม่"] },
          ],
        },
      },
      {
        kind: "tip",
        title: "แก้ย้อนกลับเป็นฉบับเดิม",
        text: "หากแก้แล้วเปลี่ยนใจ ใส่ค่ากลับให้ตรงกับฉบับที่อนุมัติ สถานะจะกลับเป็น “อนุมัติแล้ว” โดยไม่ต้องส่งใหม่",
      },
    ],
  },

  // ─── ผู้ดูแลบริษัท ────────────────────────────────────────────────────────
  {
    id: "company",
    role: "company",
    title: "บริษัทและบทบาท",
    intro: "หน้า “บริษัทและผู้อนุมัติ” กำหนดว่าใครในบริษัททำอะไรได้ เปิดจากเมนูด้านซ้าย หัวข้อ “เอกสาร” หรือกดป้ายบริษัทในเมนูบัญชี",
    blocks: [
      {
        kind: "features",
        items: [
          { icon: "User", label: "พนักงาน", text: "ทำงานใน workspace ของตัวเองและที่ได้รับเชิญ ส่งเอกสารขออนุมัติได้" },
          { icon: "SearchCheck", label: "ผู้ตรวจ", text: "ตรวจเอกสารก่อนถึงผู้อนุมัติ และเปิดดู workspace ของคนในบริษัทได้อย่างเดียว" },
          { icon: "BadgeCheck", label: "ผู้อนุมัติ", text: "อนุมัติเอกสารได้ทุก workspace ของคนในบริษัท และเปิดดูได้อย่างเดียว" },
          { icon: "Shield", label: "ผู้ดูแลบริษัท", text: "ทำได้เหมือนผู้อนุมัติ และเชิญคน เปลี่ยนบทบาท หรือนำคนออกจากบริษัท" },
        ],
      },
      {
        kind: "steps",
        steps: [
          { title: "เปิด “บริษัทและผู้อนุมัติ”", text: "เมนูด้านซ้าย หัวข้อ “เอกสาร”" },
          { title: "เลือกบทบาท", text: "แล้วกด “สร้างลิงก์เชิญ”" },
          { title: "ส่งลิงก์ทางแชตส่วนตัว", text: "ใช้ได้ครั้งเดียว ภายใน 7 วัน" },
          { title: "ปรับบทบาทได้ตลอด", text: "ที่รายชื่อ “คนในบริษัท”" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/company.jpg",
          width: 957,
          height: 1232,
          caption: "หน้าบริษัทและผู้อนุมัติ (ชื่อและอีเมลในภาพเป็นตัวอย่าง)",
          layout: "side",
          marks: [
            { n: 1, x: 2.5, y: 21.5 },
            { n: 2, x: 17.2, y: 21.5 },
            { n: 3, x: 81, y: 29.4 },
            { n: 4, x: 2, y: 36.5 },
            { n: 5, x: 75.8, y: 56.4 },
            { n: 6, x: 97.4, y: 56.4 },
          ],
          legend: [
            { n: 1, text: "บทบาทที่คนรับลิงก์จะได้: ผู้อนุมัติ · ผู้ตรวจ · พนักงาน · ผู้ดูแลบริษัท" },
            { n: 2, text: [chip("สร้างลิงก์เชิญ")] },
            { n: 3, text: "ลิงก์ที่สร้างไว้และวันหมดอายุ กด “ลิงก์” เพื่อคัดลอก หรือกดถังขยะเพื่อยกเลิก" },
            { n: 4, text: "จำนวนคนในบริษัท คนที่อนุมัติได้ และผู้ตรวจ" },
            { n: 5, text: "เปลี่ยนบทบาทของแต่ละคน" },
            { n: 6, text: "นำคนออกจากบริษัท" },
          ],
        },
      },
      {
        kind: "tip",
        title: "อีเมลโดเมนของบริษัท",
        text: "คนที่เข้าสู่ระบบด้วยอีเมลโดเมนของบริษัทจะเข้าบริษัทให้เอง ไม่ต้องส่งลิงก์ ผู้ดูแลเปลี่ยนบทบาทให้ได้ที่รายชื่อ “คนในบริษัท” ส่วนคนที่อยู่ในบริษัทแล้ว ถ้ากดลิงก์เชิญอีกครั้งจะได้บทบาทใหม่แทน",
      },
    ],
  },
  {
    id: "company-workspaces",
    role: "company",
    title: "ดู workspace ของคนในบริษัท",
    intro: "ผู้ดูแลบริษัท ผู้อนุมัติ และผู้ตรวจ เปิดดู workspace และโปรเจกต์ของทุกคนในบริษัทได้ เพื่อดูงานประกอบการตรวจเอกสาร แต่บันทึกหรือลบไม่ได้",
    blocks: [
      {
        kind: "figure",
        figure: {
          src: "/guide/sidebar.jpg",
          width: 468,
          height: 1568,
          caption: "แถบด้านซ้ายของหน้าตั้งค่า (ชื่อในภาพเป็นตัวอย่าง)",
          layout: "side",
          marks: [
            { n: 1, x: 95.5, y: 12.5 },
            { n: 2, x: 95.5, y: 19.6 },
            { n: 3, x: 95.5, y: 29.2 },
            { n: 4, x: 95.5, y: 44 },
            { n: 5, x: 95.5, y: 53.9 },
            { n: 6, x: 95.5, y: 82.4 },
            { n: 7, x: 95.5, y: 97 },
          ],
          legend: [
            { n: 1, text: "บัญชีของคุณ" },
            { n: 2, text: "ป้ายบริษัทและบทบาทของคุณ" },
            { n: 3, text: "“Workspace ของฉัน” เฉพาะ workspace ที่คุณสร้างหรือได้รับเชิญ" },
            { n: 4, text: "“สร้าง workspace ใหม่”" },
            { n: 5, text: "“<ชื่อบริษัท> · ดูอย่างเดียว” workspace ของคนในบริษัท แยกตามชื่อเจ้าของ พร้อมจำนวน กดชื่อเพื่อกางดู" },
            { n: 6, text: "“อนุมัติเอกสาร” และ “บริษัทและผู้อนุมัติ”" },
            { n: 7, text: "“แจ้งเคส / ติดตามปัญหา”" },
          ],
        },
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/org-readonly.jpg",
          width: 1568,
          height: 632,
          caption: "workspace ของคนอื่นในบริษัท เปิดดูได้อย่างเดียว (ชื่อในภาพเป็นตัวอย่าง)",
          layout: "wide",
          marks: [
            { n: 1, x: 0.9, y: 17.6 },
            { n: 2, x: 1.2, y: 59.5 },
            { n: 3, x: 1.2, y: 82.6 },
          ],
          legend: [
            { n: 1, text: "ป้าย “ดูอย่างเดียว” บอกว่า workspace นี้เป็นของใคร ไม่มีปุ่มบันทึกหรือลบ" },
            { n: 2, text: "“งานที่ทำให้องค์กรนี้” โปรเจกต์ของลูกค้ารายนี้ แยกเป็นโมดูลพร้อมราคา" },
            { n: 3, text: "สมาชิกของ workspace" },
          ],
        },
      },
    ],
  },

  // ─── ช่วยเหลือ ────────────────────────────────────────────────────────────
  {
    id: "problems",
    role: "help",
    title: "เมื่อพบปัญหา",
    blocks: [
      {
        kind: "steps",
        steps: [
          { title: "ลองให้ AI แก้", text: "ปุ่ม “ให้ AI แก้เลย”" },
          { title: "ยังไม่หาย", text: "กด “แจ้งปัญหา”" },
          { title: "เล่ารายละเอียด", text: "ระบบแนบล็อกให้" },
          { title: "ส่งให้ทีม", text: "ทีม FITT ตอบกลับ" },
          { title: "ติดตามเรื่อง", text: "เมนู “แจ้งเคส”" },
        ],
      },
      {
        kind: "figure",
        figure: {
          src: "/guide/report.jpg",
          width: 1008,
          height: 1191,
          caption: "หน้าต่างรายงานปัญหาให้ทีม",
          layout: "side",
          marks: [
            { n: 1, x: 85, y: 15.7 },
            { n: 2, x: 11.1, y: 21.4 },
            { n: 3, x: 24, y: 32.8 },
            { n: 4, x: 15.9, y: 54 },
            { n: 5, x: 34, y: 60.9 },
            { n: 6, x: 78.7, y: 95.6 },
          ],
          legend: [
            { n: 1, text: "ประเภทปัญหา" },
            { n: 2, text: "หัวข้อ" },
            { n: 3, text: "เล่าให้ทีมฟังว่ากำลังทำอะไรอยู่ (ไม่บังคับ)" },
            { n: 4, text: [chip("แนบรูป", "ImagePlus")] },
            { n: 5, text: "ข้อมูลที่ระบบแนบให้อัตโนมัติ เช่น ข้อความ error และล็อกล่าสุด" },
            { n: 6, text: [chip("ส่งให้ทีม", "Send")] },
          ],
        },
      },
      { kind: "heading", text: "เปิดหน้าต่างนี้ได้จาก" },
      {
        kind: "bullets",
        items: [
          [chip("แจ้งปัญหา", "Flag"), " ใต้คำตอบของ AI"],
          [chip("รายงาน", "Flag"), " บนแถบแจ้งเตือนของเดโม"],
          [chip("แจ้งปัญหา", "Flag"), " บนแถบด้านล่างของสตูดิโอ"],
        ],
      },
      {
        kind: "tip",
        title: "ติดตามเรื่อง",
        text: ["ดูได้ที่เมนูบัญชี → ", chip("แจ้งเคส / ติดตามปัญหา", "LifeBuoy"), " เมื่อทีมตอบกลับ จะมีตัวเลขขึ้นที่ปุ่มบัญชีมุมขวาบน"],
      },
    ],
  },
  {
    id: "faq",
    role: "help",
    title: "การส่งออกงาน และคำถามที่พบบ่อย",
    blocks: [
      {
        kind: "tip",
        title: "การส่งออกโค้ดหรือนำระบบไปใช้งานจริง",
        text: "เมื่อลูกค้าตกลงและต้องการใช้งานระบบจริง กรุณาติดต่อทีม FITT ก่อนทุกครั้ง ทีมจะดูแลการส่งออกโค้ด การพัฒนาต่อ และการขึ้นระบบให้",
      },
      {
        kind: "faq",
        items: [
          {
            q: "เข้าสู่ระบบแล้วพบหน้า “บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน”",
            a: "กรุณาตรวจอีเมลที่แสดงบนหน้านั้น หากไม่ใช่อีเมลที่ได้รับสิทธิ์ สามารถกด “เข้าด้วยอีเมลอื่น” ได้ทันที",
          },
          {
            q: "ป้าย Partner ไม่แสดงที่หัวกระดาษ",
            a: "โปรเจกต์ต้องอยู่ใน workspace ของคุณ ไม่ใช่ “ส่วนตัว” แนะนำให้เลือก workspace ก่อนเริ่มโปรเจกต์ทุกครั้ง",
          },
          {
            q: "ต้องการให้เพื่อนร่วมทีมใช้งานด้วย",
            a: "กรุณาส่งอีเมลของเพื่อนร่วมทีมให้ทีม FITT เพิ่มสิทธิ์ จากนั้นจึงเชิญเข้า workspace หรือโปรเจกต์",
          },
          {
            q: "ต้องการให้ลูกค้าดูเดโม",
            a: "แนะนำให้ใช้ “คัดลอกลิงก์แชร์” ลูกค้าเปิดดูได้โดยไม่ต้องมีบัญชี และไม่ต้องเชิญเข้าโปรเจกต์",
          },
          {
            q: "AI แก้แล้วผลยังไม่ตรงใจ",
            a: "สามารถกด Undo หรือย้อนกลับใน History แล้วสั่งใหม่ให้ชัดเจนขึ้น หรือใช้ Wand ชี้แก้ตรงจุดได้",
          },
          {
            q: "ใบเสนอราคายังไม่มีรายการ",
            a: "กรุณาเก็บภาพหน้าจอในคลังหน้าจอก่อน (“แคปทุกหน้า” หรือ “สแกนอัตโนมัติ”) รายการจะสร้างจากหน้าจอที่เก็บไว้",
          },
          {
            q: "เอกสาร BRD/PRD ไม่ตรงกับเดโมที่แก้ไปแล้ว",
            a: "สามารถกด “อัปเดตเอกสารจากของจริง” ในเฟส Build ได้",
          },
          {
            q: "ปุ่ม “พิมพ์ / บันทึกเป็น PDF” กดไม่ได้",
            a: "เอกสารของโปรเจกต์ใน workspace ต้องผ่านการอนุมัติก่อน กรุณากด “ส่งอนุมัติ” แล้วรอผู้อนุมัติ (หมวด “ส่งอนุมัติ”) หากเพิ่งแก้เอกสารหลังอนุมัติ ต้องส่งอนุมัติใหม่อีกครั้ง",
          },
          {
            q: "ไม่พบชื่อผู้อนุมัติในรายการตอนส่งอนุมัติ",
            a: "ผู้อนุมัติต้องอยู่ในบริษัทเดียวกันในบทบาท “ผู้อนุมัติ” หรือ “ผู้ดูแลบริษัท” กรุณาให้ผู้ดูแลบริษัทส่งลิงก์เชิญจากหน้า “บริษัทและผู้อนุมัติ”",
          },
          {
            q: "ไม่แน่ใจว่าตอนนี้อยู่บริษัทไหน",
            a: "เปิดเมนูบัญชีมุมขวาบน ใต้ชื่อของคุณจะมีป้ายบอกชื่อบริษัทและบทบาท หรือบอกว่ายังไม่อยู่ในบริษัท",
          },
        ],
      },
      { kind: "text", text: "ขอบคุณที่เลือกใช้ FITT Builder หากมีข้อสงสัยเพิ่มเติม สามารถแจ้งทีม FITT ได้ทุกเมื่อ" },
    ],
  },
];

/** The section by its anchor — a changelog entry's `guide` must name one. */
export function guideSection(id: string): GuideSection | undefined {
  return GUIDE.find((section) => section.id === id);
}

import { z } from "zod";

/**
 * A project broken into the modules it is sold as.
 *
 * A demo is captured screen by screen, and a quotation seeded from that has a
 * line per screen — sixty lines for First Chapter. What the customer accepted
 * (SQP-0002) was the sales team's own regrouping: a line per module, under it
 * each part with three or four lines on what it does. The key points of the
 * proposal, not every detail of every screen.
 *
 * The grouping lives on the proposal, beside the screen manual it is drawn
 * from: the proposal owns what was built, and the quotation and the workspace
 * page both read the modules from here rather than each keeping a list.
 */

/** One part of a module: what the customer sees as one capability. */
export interface ModulePart {
  id: string;
  /** "Dashboard ฝ่ายประเมินราคา" — the paper numbers it (1.1), so the name carries no number. */
  name: string;
  /** Three or four lines on what it does, without the dash the paper adds. */
  points: string[];
  /** The screens it covers, by name. A modal goes with the screen it opens from. */
  screens: string[];
}

export interface ProposalModule {
  id: string;
  /** "Module: Sales Management (งานขาย)" — as the buyer reads it on the quotation. */
  name: string;
  parts: ModulePart[];
}

export const MODULES_SYSTEM = `คุณคือที่ปรึกษาฝ่ายขายที่สรุป "ขอบเขตงาน" ของระบบที่สร้างเสร็จแล้ว เพื่อลงใบเสนอราคา

เป้าหมาย: แตกระบบออกเป็นโมดูลตามฝ่ายหรืองานที่ใช้ แต่ละโมดูลมีระบบย่อย และแต่ละระบบย่อยสรุปเป็นข้อสั้นๆ — สรุปเฉพาะหัวข้อสำคัญ ไม่ดึงรายละเอียดทุกอย่างมา

กติกา
- โมดูล = ฝ่ายที่ใช้งาน ไม่ใช่ประเภทของฟีเจอร์ เช่น งานขาย งานจัดซื้อ งานบุคคล ปกติ 1-4 โมดูล ระบบเล็กมีโมดูลเดียวได้
- เครื่องมือ AI ข้อมูลอ้างอิง รายงาน และการตั้งค่า ให้เป็นระบบย่อยในโมดูลของฝ่ายที่ใช้มันมากที่สุด ห้ามแยกเป็นโมดูลของตัวเอง
- ชื่อโมดูลใช้รูปแบบ "Module: <ชื่ออังกฤษ> (<ชื่อไทย>)"
- ระบบย่อย = ความสามารถหนึ่งที่ผู้ใช้เห็นเป็นเรื่องเดียว มักครอบคลุม 1-4 หน้าจอ ชื่อภาษาไทย ตามด้วยชื่ออังกฤษในวงเล็บถ้ามี ห้ามใส่เลขนำหน้า ระบบใส่ให้เอง
- ข้อสรุปของแต่ละระบบย่อย 3-4 ข้อ ข้อละหนึ่งบรรทัด ไม่เกินราว 90 ตัวอักษร ขึ้นต้นด้วยคำกริยา เช่น แสดง… จัดเก็บ… คำนวณ… ติดตาม… ห้ามใส่ "-" หรือเลขนำหน้า
- ทุกหน้าจอในรายการต้องอยู่ในระบบย่อยใดระบบย่อยหนึ่ง พอดีหนึ่งที่ ใช้ชื่อหน้าตรงตัวอักษร หน้าต่างย่อยไม่ต้องใส่ จะตามหน้าของมันไปเอง
- เขียนภาษาธุรกิจ ห้ามชื่อไฟล์ ชื่อคอมโพเนนต์ หรือศัพท์โปรแกรมเมอร์ ห้ามใส่ราคา
- อ้างได้เฉพาะสิ่งที่อยู่ในข้อมูลที่ให้มา ห้ามเพิ่มความสามารถที่ระบบไม่มี

ตัวอย่างที่ลูกค้ายอมรับ (ดูรูปแบบ ไม่ใช่เนื้อหา)
Module: Sales Management (งานขาย)
  ระบบย่อย: Dashboard ฝ่ายประเมินราคา
    แสดงภาพรวมยอดเสนอขาย ต้นทุน และอัตรากำไร (Gross Margin)
    ติดตามสถานะโครงการ BOQ และใบเสนอราคา
    แสดงงานค้างและแจ้งเตือนรายการที่ต้องดำเนินการเร่งด่วน
  ระบบย่อย: ระบบบริหารจัดการโครงการ (Project Management)
    จัดเก็บข้อมูลโครงการ ลูกค้า และผู้รับผิดชอบ
    ติดตามสถานะและเชื่อมโยงข้อมูลกับ BOQ และใบเสนอราคา
    แสดงต้นทุน ราคาขาย และอัตรากำไรของแต่ละโครงการ

ตอบเป็น JSON เท่านั้น:
{
  "modules": [
    {
      "name": "Module: ...",
      "parts": [
        { "name": "...", "points": ["...", "..."], "screens": ["<ชื่อหน้าตามรายการ ตรงตัวอักษร>"] }
      ]
    }
  ]
}`;

const CHAR_BUDGET = 6_000;

const clip = (s: string, n: number): string => (s.length <= n ? s : s.slice(0, n) + "\n…(ตัดทอน)");

export function buildModulesUser(input: {
  projectName: string;
  /** The proposal's "before" paragraph. */
  context: string;
  /** What the proposal says the system does for them, one line each. */
  features: string[];
  /** Every top-level screen: what it does (from the proposal's manual), and its modals. */
  screens: { name: string; does: string; modals: string[] }[];
  brd: string;
  prd: string;
}): string {
  const screens = input.screens
    .map((s) => {
      const does = s.does ? ` — ${s.does}` : "";
      const modals = s.modals.length ? ` (หน้าต่างย่อย: ${s.modals.join(", ")})` : "";
      return `- ${s.name}${does}${modals}`;
    })
    .join("\n");
  return [
    `ชื่อระบบ: ${input.projectName || "(ไม่ระบุ)"}`,
    input.context ? `\nสภาพการทำงานเดิม\n${input.context}` : "",
    input.features.length ? `\nสิ่งที่ระบบทำให้ (จากข้อเสนอโครงการ)\n${input.features.map((f) => `- ${f}`).join("\n")}` : "",
    input.brd ? `\n--- BRD ---\n${clip(input.brd, CHAR_BUDGET)}` : "",
    input.prd ? `\n--- PRD ---\n${clip(input.prd, CHAR_BUDGET)}` : "",
    `\n--- หน้าจอทั้งหมดในระบบ (${input.screens.length} หน้า) ---\n${screens}`,
    "\nแตกเป็นโมดูลตามกติกา ใส่ทุกหน้าจอ ตอบ JSON อย่างเดียว",
  ]
    .filter(Boolean)
    .join("\n");
}

const draftSchema = z.object({
  modules: z.array(
    z.object({
      name: z.string().catch(""),
      parts: z
        .array(
          z.object({
            name: z.string().catch(""),
            points: z.array(z.string()).catch([]),
            screens: z.array(z.string()).catch([]),
          })
        )
        .catch([]),
    })
  ),
});

/** "1.1 ", "- ", "• " — the paper numbers and dashes; the model's own go. */
const bare = (s: string): string => s.replace(/^\s*(?:[-•*]|\d+(?:\.\d+)*[.)]?)\s+/, "").trim();

/**
 * Read the model's grouping, keeping what can be printed.
 *
 * A screen is placed once and only if the project has it: a name the model
 * invented would put a capability on the quotation the system does not have,
 * and a screen in two parts would be priced twice. Parts with nothing to say
 * and modules with no parts are dropped. Null when nothing is left, so the
 * caller says so instead of replacing the grouping with emptiness.
 */
export function parseModulesDraft(raw: string, screenNames: string[]): ProposalModule[] | null {
  let parsed: z.infer<typeof draftSchema>;
  try {
    parsed = draftSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
  const known = new Set(screenNames.map((n) => n.trim()));
  const placed = new Set<string>();
  const stamp = Date.now().toString(36);
  const modules = parsed.modules
    .map((m, i): ProposalModule => ({
      id: `mod-${i}-${stamp}`,
      name: m.name.trim(),
      parts: m.parts
        .map((p, j): ModulePart => ({
          id: `part-${i}-${j}-${stamp}`,
          name: bare(p.name),
          points: p.points.map(bare).filter(Boolean),
          screens: p.screens
            .map((s) => s.trim())
            .filter((s) => {
              if (!known.has(s) || placed.has(s)) return false;
              placed.add(s);
              return true;
            }),
        }))
        .filter((p) => p.name && (p.points.length > 0 || p.screens.length > 0)),
    }))
    .filter((m) => m.name && m.parts.length > 0);
  return modules.length > 0 ? modules : null;
}

/** Screens no part covers — shown beside the grouping so none leaves the scope unseen. */
export function unplacedScreens(modules: ProposalModule[], screenNames: string[]): string[] {
  const placed = new Set(modules.flatMap((m) => m.parts.flatMap((p) => p.screens.map((s) => s.trim()))));
  return screenNames.filter((n) => !placed.has(n.trim()));
}

/**
 * A module as its quotation line's detail: each part numbered under the
 * module's own number, its lines dashed beneath, a blank line between parts —
 * the layout of SQP-0002.
 */
export function moduleNote(module: ProposalModule, number: number): string {
  return module.parts
    .map((p, j) => [
      `${number}.${j + 1} ${p.name.trim()}`,
      // Blank lines are what an edit leaves mid-typing, not points.
      ...p.points.map((pt) => pt.trim()).filter(Boolean).map((pt) => `- ${pt}`),
    ].join("\n"))
    .join("\n\n");
}

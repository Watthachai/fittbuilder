/**
 * Design templates: a curated look the user fills in, not a prompt they write.
 *
 * Each template is two halves. The RECIPE is the mechanics that make the look
 * — scroll rigs, layer stacks, reveal masks — written as binding build
 * instructions and never edited by the user. The SLOTS are what the user
 * brings: which images, in which roles, described concretely enough to go
 * hunting with ("sky, full frame, nothing prominent in it"). The gallery form
 * renders the slots; composeTemplateBrief() welds both halves into one brief
 * that rides the ordinary express-build path, so templates get the whole
 * brief-passthrough contract for free.
 *
 * Everything here is pure and in code, like lib/skills — a template earns its
 * place by being finished, not configured.
 */

export interface TemplateSlot {
  id: string;
  /** Field label, e.g. "SKY — ฉากหลังไกลสุด". */
  label: string;
  /** What to go find: the concrete description of a fitting value. */
  hint: string;
  kind: "text" | "textarea" | "image";
  required: boolean;
  placeholder?: string;
}

export interface DesignTemplate {
  id: string;
  name: string;
  emoji: string;
  /** One sentence of what the finished page feels like. */
  tagline: string;
  slots: TemplateSlot[];
  /** The mechanics — travels into the brief verbatim, after the slot values. */
  recipe: string;
}

/** Slot ids the form must not submit without. */
export function missingRequired(t: DesignTemplate, values: Record<string, string>): string[] {
  return t.slots.filter((s) => s.required && !values[s.id]?.trim()).map((s) => s.id);
}

/**
 * Weld the filled slots and the recipe into one brief.
 *
 * Filled values are listed first under their labels — the model reads the
 * subject before the machinery. Empty optional slots are stated as absent
 * rather than dropped: "ไม่มีรูปช่องนี้" is an instruction (degrade the way the
 * recipe says), where silence would invite inventing a URL.
 */
export function composeTemplateBrief(
  t: DesignTemplate,
  values: Record<string, string>
): string {
  const lines: string[] = [`สร้างเว็บตามเทมเพลต "${t.name}" — ข้อมูลที่กรอกมา:`, ""];
  for (const slot of t.slots) {
    const v = values[slot.id]?.trim();
    if (v) {
      lines.push(`### ${slot.label}`, v, "");
    } else if (slot.kind === "image") {
      lines.push(`### ${slot.label}`, "(ไม่มีรูปช่องนี้ — ใช้ทางเลือกที่สเปคด้านล่างกำหนด)", "");
    }
    // An empty optional text slot simply doesn't exist — nothing to degrade.
  }
  lines.push("---", "", t.recipe);
  return lines.join("\n");
}

/* ───────────────────────── Cinematic Scroll (แบบ Mostar) ───────────────────────── */

const CINEMATIC_RECIPE = `## สเปคบังคับ — Cinematic Scroll Story

คอมโพเนนต์แยกไฟล์: StageLayers.tsx (ฉากซ้อนชั้น) · SightsSlider.tsx (การ์ดไฮไลต์) ·
StoryPanels.tsx (เนื้อเรื่อง) · SightModal.tsx (รายละเอียดการ์ด) — ประกอบใน App.tsx

### Scroll rig
- ราง: section.cinema-scroll { position:relative; height:calc(100vh + 3700px) }
- เวที: div.stage { position:sticky; top:0; height:100vh; min-height:620px; overflow:hidden; isolation:isolate }
- ทุกชั้นในเวทีเป็น position:absolute — ลำดับใน DOM คือลำดับการวาด
- อ่าน scroll ใน requestAnimationFrame เดียว แปลงเป็น progress 0→1 แล้วเขียนเป็น CSS custom
  properties บน :root (เช่น --back-y, --title-scale, --sights-enter-x) ให้ CSS ขยับผ่าน
  transform:translate3d(...) — ห้าม set style รายชิ้นใน JS

### ไทม์ไลน์ 5 องก์ (จาก progress ของราง)
1. 0–15% เปิดฉาก: SKY นิ่งเต็มจอ · MID scale(.78) mix-blend-mode:screen opacity:.72 ·
   HERO กว้าง ~67vw กลางล่าง · ชื่อใหญ่กลางจอ clamp(72px,14vw,210px) serif ทับฉาก
2. 15–35% แยกชั้น (parallax): MID ลอยขึ้นเร็ว · HERO ขยับช้า + scale เพิ่มเล็กน้อย ·
   ชื่อใหญ่จางแล้วหดขึ้น · ฉากหลังเริ่ม blur(var(--blur-px))
3. 35–60% การ์ดเข้า: SightsSlider ทั้งแถวไหลจาก translate3d(420vw,…) เข้ามาจอด —
   ใช้ visibility + translate ไม่ใช่ opacity · ปุ่ม ←/→ ค่อยจางเข้าหลังจอด
4. 60–80% เปิดม่าน: SPLIT-LEFT ไถลออกซ้าย SPLIT-RIGHT ไถลออกขวา (จาก -50% กลางจอ)
   เผย CLOSE-UP fade + scale 1.06→1 · ถ้าไม่มีรูป SPLIT/CLOSE-UP ให้ข้ามองก์นี้ทั้งองก์
5. 80–100% เนื้อเรื่อง: สองแผ่นเลื่อนขึ้นทีละแผ่น (translateY calc(-50% + 58px) → -50%
   พร้อม opacity) · พื้นฉากมืดลงด้วย div.shade ไล่เฉดสามช่วง

### การ์ด (SightsSlider)
- ราง display:flex gap:clamp(16px,1.15vw,24px) เลื่อนด้วย transform +
  transition 640ms cubic-bezier(0.22,1,0.36,1)
- การ์ด: flex:0 0 clamp(360px,19.4vw,430px); height:220px; border-radius:24px;
  พื้นกระดาษสว่าง ตัวหนังสือเข้ม border บางโปร่ง box-shadow นุ่มลึก
- ใน: kicker ตัวเล็ก uppercase บนซ้าย → ชื่อ font-weight:800 ล่าง → คำอธิบาย clamp 2 บรรทัด
- คลิกเปิด SightModal (เรื่องเต็ม + ปุ่มปิด) · การ์ดทุกใบ tabindex="0" role="button" มี aria-label
- ปุ่ม prev/next เป็นปุ่มจริง มี aria-label

### Header ลอย
grid: minmax(260px,1fr) auto minmax(260px,1fr); padding:32px — โลโก้ serif ซ้าย ·
เมนูกลาง font-size:20px + text-shadow:0 2px 16px rgba(0,0,0,.2) · ปุ่มภาษาแบบขวา —
ตัวหนังสือสีกระดาษ โปร่งบนฉาก ไม่มีพื้นหลัง

### เก็บงาน (ข้อบังคับ)
- ฟอนต์: display serif (Google Fonts เช่น Playfair Display) คู่ Inter
- prefers-reduced-motion: ปิด parallax ทั้งหมด เหลือหน้าเลื่อนปกติที่อ่านครบ
- img ฉากทุกใบ alt="" · will-change เฉพาะชั้นที่ขยับ · ห้าม animate top/left
- มือถือ: parallax ลดครึ่ง การ์ดกว้าง min(84vw,360px)
- รูปที่เป็นรูปถ่ายธรรมดา (ไม่ใช่ PNG ตัดขอบ): ครอบ mask-image ไล่เฉดขอบล่าง
  (linear-gradient to top, transparent 0 → black 22%) ให้จมเข้าฉากเนียนๆ
- รูปใดโหลดไม่สำเร็จ → ชั้นนั้นเป็นสีพื้นไล่เฉดแทน ห้ามเป็นกรอบแตก
- ใต้ฉากต่อ section ปกติ: กริดรูป/รายละเอียดเพิ่ม + footer สั้น โทนเดียวกัน`;

/* ───────────────────────── Spotlight Reveal (แบบ Lithos) ───────────────────────── */

const SPOTLIGHT_RECIPE = `## สเปคบังคับ — Spotlight Reveal Hero

### โครง
หน้าเดียว hero เต็มจอ (height:100dvh, พื้นดำ) + section เนื้อหาต่อด้านล่าง
เลเยอร์ตามลำดับ z: รูปฐาน (z-10, bg-cover กลางจอ) → RevealLayer (z-30) → ตัวหนังสือ (z-50)

### กลไกไฟฉาย (หัวใจ — ห้ามลดทอน)
- SPOTLIGHT_R = 260 · ติดตามเมาส์แบบหน่วง: เก็บ raw จาก mousemove แล้ว lerp ใน
  requestAnimationFrame (smooth += (raw - smooth) * 0.1) — cleanup ทั้งคู่ตอน unmount
- RevealLayer(image, cursorX, cursorY): canvas ซ่อนขนาดเท่าจอ วาด radial gradient
  ที่ตำแหน่งเมาส์ รัศมี 0→260 จุดหยุด: 0→1, .4→1, .6→.75, .75→.4, .88→.12, 1→0
  แล้ว toDataURL() ใช้เป็น maskImage/webkitMaskImage (maskSize:100% 100%) บน div
  ที่มีรูปเผยเป็นพื้นหลัง — รูปที่สองจึงเห็นเฉพาะในวงไฟนุ่มๆ ที่ตามเมาส์
- จอสัมผัส (ไม่มีเมาส์): วงไฟวนเองช้าๆ ตามเส้นทางรีๆ กลางจอ

### ตัวหนังสือบนฉาก
- หัวเรื่องสองบรรทัดกลางบน (top:14%): บรรทัดแรก serif italic
  text-5xl→md:text-8xl letter-spacing:-0.05em · บรรทัดสอง sans ตัวปกติ -0.08em
- ย่อหน้าเล็กซ้ายล่าง (ซ่อนบนมือถือ) + บล็อกขวาล่าง: ย่อหน้า + ปุ่ม CTA พื้นสี accent
  rounded-full hover:scale-[1.03] active:scale-95 hover:shadow-lg
- nav ลอยบนสุด: โลโก้+ชื่อแบรนด์ซ้าย · pill กลาง (bg-white/20 backdrop-blur-md
  border-white/30 rounded-full) เมนู 4-5 ปุ่ม · ปุ่มสมัครขวาพื้นขาว

### อนิเมชันตอนโหลด
keyframes: heroReveal (opacity 0→1, translateY 28px→0, blur 12px→0, 1.1s) ·
heroFadeUp (1s) · heroZoom (scale 1.12→1, 1.8s บนรูปฐาน) — ทั้งหมด
cubic-bezier(0.16,1,0.3,1) ไล่ delay ตามลำดับอ่าน · prefers-reduced-motion: ปิดหมด

### เก็บงาน
ฟอนต์ Inter + serif display จาก Google Fonts · รูปโหลดพังให้พื้นไล่เฉดแทน ·
ใต้ hero ต่อ section แนะนำจุดเด่น 3 ข้อ + footer สั้น โทนเดียวกัน`;

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: "cinematic-scroll",
    name: "Cinematic Scroll",
    emoji: "🎬",
    tagline: "เลื่อนแล้วฉากแยกชั้น การ์ดไหลเข้า ม่านเปิด — แบบหน้า Mostar",
    slots: [
      {
        id: "subject",
        label: "เรื่อง / ชื่อแบรนด์",
        hint: "เมือง สินค้า หรือแบรนด์ที่หน้าเว็บนี้เล่า",
        kind: "text",
        required: true,
        placeholder: "เช่น เชียงใหม่ · แบรนด์กาแฟ AROMA",
      },
      {
        id: "heroWord",
        label: "คำใหญ่กลางจอ",
        hint: "คำเดียวสั้นๆ ที่จะขึ้นตัวมหึมาทับฉาก",
        kind: "text",
        required: true,
        placeholder: "เช่น CHIANG MAI",
      },
      {
        id: "tagline",
        label: "แท็กไลน์ 1 ประโยค",
        hint: "ประโยคเปิดใต้ฉากแรก — ภาษาที่พิมพ์ตรงนี้คือภาษาของทั้งหน้า",
        kind: "textarea",
        required: false,
      },
      {
        id: "imgSky",
        label: "รูป SKY — ฉากหลังไกลสุด",
        hint: "ท้องฟ้า/บรรยากาศ เต็มเฟรม ไม่มีวัตถุเด่น — วาง URL รูปจากเว็บไหนก็ได้",
        kind: "image",
        required: true,
        placeholder: "https://…",
      },
      {
        id: "imgMid",
        label: "รูป MID — ชั้นกลาง",
        hint: "เมือง/ภูเขา/กลุ่มอาคารมองไกล จะลอยแยกชั้นตอนเลื่อน",
        kind: "image",
        required: true,
        placeholder: "https://…",
      },
      {
        id: "imgHero",
        label: "รูป HERO — พระเอกหน้าสุด",
        hint: "สิ่งที่เป็นหน้าตาของเรื่อง (สะพาน/ตึก/สินค้า) — PNG ตัดขอบโปร่งใสจะสวยสุด รูปถ่ายธรรมดาก็ได้",
        kind: "image",
        required: true,
        placeholder: "https://…",
      },
      {
        id: "imgSplitL",
        label: "รูป SPLIT ซ้าย (ไม่บังคับ)",
        hint: "ครึ่งซ้ายของฉากที่จะเปิดออกเหมือนม่าน — เว้นได้ ระบบจะข้ามองก์ม่าน",
        kind: "image",
        required: false,
        placeholder: "https://…",
      },
      {
        id: "imgSplitR",
        label: "รูป SPLIT ขวา (ไม่บังคับ)",
        hint: "ครึ่งขวาของฉากเดียวกัน",
        kind: "image",
        required: false,
        placeholder: "https://…",
      },
      {
        id: "imgClose",
        label: "รูป CLOSE-UP (ไม่บังคับ)",
        hint: "ภาพระยะใกล้ โผล่หลังม่านเปิด",
        kind: "image",
        required: false,
        placeholder: "https://…",
      },
      {
        id: "cards",
        label: "การ์ดไฮไลต์ 4–6 ใบ",
        hint: "บรรทัดละใบ รูปแบบ: หมวด | ชื่อ | คำอธิบายสั้น",
        kind: "textarea",
        required: false,
        placeholder: "Old Bridge | Stari Most | สะพานหินโค้งข้าม Neretva\nViewpoint | …",
      },
      {
        id: "story",
        label: "เนื้อเรื่องปิดท้าย 2 แผ่น",
        hint: "แผ่นละย่อหน้า: หัวเรื่อง 1 ประโยค + เนื้อ 2-3 ประโยค + ตัวเลข/ข้อเท็จจริงถ้ามี",
        kind: "textarea",
        required: false,
      },
    ],
    recipe: CINEMATIC_RECIPE,
  },
  {
    id: "spotlight-hero",
    name: "Spotlight Reveal",
    emoji: "🔦",
    tagline: "วงไฟตามเมาส์เผยภาพที่สองซ่อนอยู่ใต้ภาพแรก — hero มืดหรูมาก",
    slots: [
      {
        id: "brand",
        label: "ชื่อแบรนด์",
        hint: "ขึ้นเป็นโลโก้ตัวหนังสือมุมซ้ายบน",
        kind: "text",
        required: true,
        placeholder: "เช่น Lithos",
      },
      {
        id: "headline",
        label: "หัวเรื่อง 2 บรรทัด",
        hint: "บรรทัดแรกจะเป็นตัว serif เอียง บรรทัดสองตัวปกติ — พิมพ์สองบรรทัด",
        kind: "textarea",
        required: true,
        placeholder: "Layers hold\ntales of time",
      },
      {
        id: "imgBase",
        label: "รูปฐาน — เห็นตลอดเวลา",
        hint: "ภาพบรรยากาศมืดๆ เต็มจอ — วาง URL จากเว็บไหนก็ได้",
        kind: "image",
        required: true,
        placeholder: "https://…",
      },
      {
        id: "imgReveal",
        label: "รูปเผย — เห็นเฉพาะในวงไฟ",
        hint: "ภาพเดียวกันคนละเวอร์ชัน (กลางคืน/เอกซเรย์/ลายเส้น) จะดูขลังสุด — มุมเดียวกับรูปฐานยิ่งดี",
        kind: "image",
        required: true,
        placeholder: "https://…",
      },
      {
        id: "accent",
        label: "สีปุ่ม (ไม่บังคับ)",
        hint: "hex หนึ่งค่า เช่น #e8702a — เว้นไว้ให้ AI เลือกจากรูป",
        kind: "text",
        required: false,
        placeholder: "#e8702a",
      },
      {
        id: "cta",
        label: "ข้อความปุ่ม + เมนู (ไม่บังคับ)",
        hint: "บรรทัดแรก: ข้อความปุ่มหลัก · บรรทัดต่อไป: ชื่อเมนู 4-5 คำ",
        kind: "textarea",
        required: false,
        placeholder: "Start Digging\nCourse, Field Guides, Geology, Plans",
      },
    ],
    recipe: SPOTLIGHT_RECIPE,
  },
];

export function getDesignTemplate(id: string): DesignTemplate | undefined {
  return DESIGN_TEMPLATES.find((t) => t.id === id);
}

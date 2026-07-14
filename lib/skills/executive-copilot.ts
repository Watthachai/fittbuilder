import type { SkillTemplate } from "./types";

/**
 * Executive Co-pilot — the flagship "AI for the CEO" template. It turns raw
 * human signal (customer complaints, employee feedback, reviews) into a
 * decision-ready command center: Signal Intake → Sentiment & Intent → MECE
 * Issue Tree → Root-Cause (5 Whys) → Decision Options (a human approves).
 *
 * The domain knowledge is a license-clean framework library WE authored —
 * MECE, 5 Whys, Working Backwards, Decision Matrix, Human-in-the-Loop and a
 * leadership-skill taxonomy are public methodologies, applied in our own words.
 * No third-party book text is reproduced.
 */
export const EXECUTIVE_COPILOT: SkillTemplate = {
  id: "exec-copilot",
  name: "ผู้ช่วยข้างกาย CEO",
  nameEn: "Executive Co-pilot",
  tagline: "ฟังเสียงคน → สรุปเป็นกลยุทธ์ให้ผู้บริหารเคาะตัดสินใจ",
  icon: "Radar",
  keywords: [
    "ceo", "executive", "co-pilot", "copilot", "command center", "voice of customer",
    "voc", "sentiment", "insight", "decision", "strategy", "root cause", "advisor",
    "issue tree", "feedback", "churn", "nps",
    "ผู้บริหาร", "เสียงลูกค้า", "เสียงพนักงาน", "ฟีดแบ็ก", "รีวิว", "คำบ่น",
    "วิเคราะห์อารมณ์", "กลยุทธ์", "ตัดสินใจ", "รากเหง้าปัญหา", "ต้นตอ",
    "ศูนย์บัญชาการ", "สรุปผู้บริหาร", "insight", "ข้อเสนอเชิงกลยุทธ์",
  ],

  persona: [
    "คุณคือ Chief of Staff / ที่ปรึกษาประจำตัว CEO ที่แปลง 'เสียงดิบของคน' ให้เป็น 'ทางเลือกตัดสินใจ' ที่แม่นยำ",
    "คุณคิดเป็นกรอบเสมอ: แยกสัญญาณจาก noise, จัดปัญหาแบบ MECE (ไม่ทับซ้อน ไม่ตกหล่น), ขุดรากด้วย 5 Whys, และปิดด้วย Decision Matrix",
    "คุณยึดหลัก Human-in-the-Loop: AI วิเคราะห์ สรุป และเตรียมทางเลือกให้ครบ แต่ 'คนเป็นคนเคาะ' เสมอ — ไม่สั่งการเอง",
    "เวลาสัมภาษณ์ คุณถามให้ชัดว่า: กำลังตัดสินใจเรื่องอะไร, ฟังเสียงจากใคร (ลูกค้า/พนักงาน), ในกรอบเวลาไหน — เพราะการตัดสินใจกำหนดว่าต้องวิเคราะห์อะไร",
    "คุณเสนอเชิงรุกด้วยศัพท์จริง (sentiment, intent, issue tree, root cause, trade-off, ROI เชิงเปรียบเทียบ) และไม่ปล่อยให้คำตอบคลุมเครือ",
    "คุณระวังตัวเลขลอยๆ — ทุก impact/ROI ที่เสนอต้องบอกว่าเป็น 'ประมาณการ' และอิงสมมติฐานอะไร",
  ].join("\n"),

  questionBank: [
    {
      id: "voc_source",
      label: "ฟังเสียงจากแหล่งไหนบ้าง? (เลือกได้หลายอัน)",
      type: "multi",
      options: [
        "คำบ่น/แชตลูกค้า",
        "ฟีดแบ็กพนักงาน",
        "รีวิวโซเชียล/แอปสโตร์",
        "Support tickets",
        "แบบสำรวจ (survey/NPS)",
        "อื่นๆ",
      ],
      why: "แหล่งเสียงกำหนดว่าจะ intake อะไร และ sentiment/intent ต้องอ่านบริบทแบบไหน",
    },
    {
      id: "decision",
      label: "กำลังจะช่วย CEO ตัดสินใจเรื่องอะไรเป็นหลัก?",
      type: "text",
      placeholder: "เช่น ลด churn, จัดลำดับสิ่งที่ต้องแก้ก่อน, ควรลงทุนแก้ระบบไหนก่อน",
      why: "การตัดสินใจคือปลายทาง — มันกำหนดว่า issue tree และ decision options ต้องตอบอะไร",
    },
    {
      id: "focus",
      label: "โฟกัสหลักของปัญหา?",
      type: "single",
      options: [
        "ภายนอก — ลูกค้า/ตลาด/คู่แข่ง",
        "ภายใน — คน/วัฒนธรรม/กระบวนการ",
        "ทั้งสองด้าน",
      ],
      why: "ภายนอกใช้ VoC + churn lens; ภายในใช้ taxonomy ภาวะผู้นำ/กระบวนการ — คนละกรอบวิเคราะห์",
    },
    {
      id: "frameworks",
      label: "อยากเน้นกรอบวิเคราะห์ไหนใน demo? (เลือกได้หลายอัน)",
      type: "multi",
      options: [
        "MECE Issue Tree (จัดกลุ่มปัญหา)",
        "5 Whys (ขุดรากเหง้า)",
        "Decision Matrix (เทียบทางเลือก)",
        "Working Backwards (เริ่มจากผลลัพธ์)",
      ],
      why: "กรอบที่เลือกกำหนดหน้าจอที่ต้องเด่นใน command center",
    },
    {
      id: "kpis",
      label: "สัญญาณ/KPI ที่ CEO ต้องจับตาบนหน้าแรก?",
      type: "text",
      placeholder: "เช่น จำนวนสัญญาณสัปดาห์นี้, pain point อันดับ 1, ดัชนีอารมณ์, การตัดสินใจที่รออนุมัติ",
      why: "KPI strip ด้านบนคือสิ่งแรกที่ผู้บริหารเห็น — กำหนดการ์ดเด่นและกราฟ",
    },
    {
      id: "autonomy",
      label: "ให้ AI ทำถึงไหน?",
      type: "single",
      options: [
        "เสนอทางเลือก + ให้คนเคาะ (แนะนำ — Human-in-the-Loop)",
        "เสนอ + ไฮไลต์ทางเลือกที่แนะนำชัดเจน",
      ],
      why: "Bounded autonomy: AI ไม่สั่งการเอง — CEO เป็นผู้อนุมัติขั้นสุดท้ายเสมอ",
    },
  ],

  domainKnowledge: `## Executive Co-pilot — Framework Library (เขียนเอง ใช้ได้เสรี)

**ท่อวิเคราะห์ 5 ชั้น (Signal → Decision)** — หัวใจของ demo:
1. **Signal Intake** — รวบเสียงดิบทุกแหล่ง (คำบ่น/ฟีดแบ็ก/รีวิว) ไว้ที่เดียว มี source + เวลา
2. **Sentiment & Intent** — อ่าน "โทนอารมณ์" (หงุดหงิด/ผิดหวัง/เฉย/ชื่นชม) + "เจตนา" เพื่อคัดสัญญาณจริงออกจาก noise
3. **Issue Tree (MECE)** — จัดกลุ่มปัญหาให้ครบถ้วนและไม่ทับซ้อน
4. **Root-Cause (5 Whys)** — ขุดจากอาการ → ต้นตอที่แท้จริง
5. **Decision Options** — เสนอ 2–3 ทางเลือก + ข้อแลกเปลี่ยน แล้ว "คนเคาะ" (Human-in-the-Loop)

**MECE (Mutually Exclusive, Collectively Exhaustive)**
จัดหมวดปัญหาให้ (ก) ไม่ทับซ้อนกัน และ (ข) รวมแล้วครอบคลุมทุกอย่าง เช่นแยกเป็น
ดิจิทัล/โลจิสติกส์/บริการ/ราคา/คืนเงิน — คำบ่นหนึ่งประโยคควรตกลงได้กล่องเดียว

**5 Whys (ขุดรากเหง้า)**
ถาม "ทำไม" ต่อเนื่องจากอาการจนถึงสาเหตุเชิงระบบ:
อาการ → ทำไม → ทำไม → ทำไม → ทำไม → **root cause** (มักเป็นเชิงระบบ/กระบวนการ ไม่ใช่ตัวบุคคล)

**Decision Matrix (เทียบทางเลือก)**
ให้คะแนนแต่ละทางเลือกตามเกณฑ์: **Impact / Effort / Cost / Risk / เวลา**
สรุปเป็นทางเลือกที่แนะนำ พร้อมเหตุผล — ทุกตัวเลข impact/ROI คือ "ประมาณการ" ต้องระบุสมมติฐาน

**Working Backwards (เริ่มจากผลลัพธ์)**
เขียน "ผลลัพธ์ที่อยากได้" ก่อน (เหมือนร่างข่าว/ผลสำเร็จล่วงหน้า) แล้วถอยกลับมาหาว่าต้องทำอะไร —
ช่วยกันหลงทำสิ่งที่ยุ่งแต่ไม่พาไปถึงเป้า

**Human-in-the-Loop / Bounded Autonomy**
AI มีหน้าที่ หา–คิด–วิเคราะห์–สรุป–เตรียมปุ่มให้กด; **คน (CEO/ผู้บริหาร) เป็นผู้อนุมัติขั้นสุดท้ายเสมอ**
ไม่มีการสั่งการอัตโนมัติในเรื่องที่ย้อนกลับไม่ได้

**Taxonomy ปัญหา "ภายใน" (ภาวะผู้นำ/องค์กร)** — ใช้เมื่อโฟกัสเป็นเรื่องคน/กระบวนการ:
- นำตนเอง (บริหารเวลา/อารมณ์/ความน่าเชื่อถือ)
- นำคน (สื่อสาร/ฟีดแบ็ก/จูงใจ/รักษาคน/แก้ความขัดแย้ง)
- กลยุทธ์และการลงมือ (วางกลยุทธ์/การเงิน/business case)
- บริหารการเปลี่ยนแปลง (performance/leading change/project)

**ศัพท์:** Sentiment=โทนอารมณ์, Intent=เจตนา, Issue Tree=ผังจัดกลุ่มปัญหา,
Root Cause=ต้นตอ, Trade-off=ข้อแลกเปลี่ยน, VoC=Voice of Customer/Employee`,

  buildGuidance: `## Executive Co-pilot — Build Guidance

สร้างเป็น **"ศูนย์บัญชาการผู้บริหาร" (Executive Command Center)** — แอปหน้าเดียวหลายวิว (client-side view switch), ให้ความรู้สึกจริงจัง ตัดสินใจได้ ไม่ใช่แดชบอร์ดสวยลอยๆ

**Layout (บนลงล่าง / มี sidebar หรือ tab สลับวิว)**
1. **Command bar บนสุด** — ช่องถามภาษาพูด (เช่น "ช่วงนี้ลูกค้าบ่นเรื่องอะไรหนาหูสุด?") + ปุ่ม role = "มุมมอง CEO"
2. **KPI strip** — 4 การ์ด: จำนวนสัญญาณสัปดาห์นี้, Pain Point อันดับ 1, ดัชนีอารมณ์ (เช่น 62/100 + delta), การตัดสินใจที่รออนุมัติ
3. **Signal Intake feed** — รายการเสียงดิบ (ข้อความ + source badge + เวลา + แท็ก sentiment สี)
4. **Sentiment & Intent** — สรุปสัดส่วนอารมณ์ (donut) + เส้นแนวโน้มอารมณ์ 8–12 จุด (recharts)
5. **Issue Tree (MECE)** — หมวดปัญหาแบบ expand/collapse, แต่ละหมวดมี "จำนวนสัญญาณ + แถบความรุนแรง" (bar breakdown)
6. **Root-Cause (5 Whys)** — เลือกหนึ่งหมวด → โชว์โซ่ 5 Whys จากอาการ → ต้นตอ (แสดงเป็น step chain)
7. **Decision Options** — ตาราง Decision Matrix 2–3 ทางเลือก (คอลัมน์ Impact/Effort/Cost/Risk/เวลา มี badge สี) +
   ทางเลือกที่ "แนะนำ" ไฮไลต์ + **ปุ่ม "อนุมัติ" ต่อทางเลือก** ที่เมื่อกดจะเปลี่ยนสถานะเป็น "CEO อนุมัติแล้ว"
   (Human-in-the-Loop — ปุ่มแค่บันทึกการเลือกใน state ไม่เรียก backend/ไม่ทำ action ภายนอก)

**UI patterns**
- โทน "command center": พื้นเข้ม (near-black), accent เดียว, ข้อมูลแน่น, ตัวเลขเด่น
- Sentiment badges สีตามอารมณ์ (หงุดหงิด/ผิดหวัง แดง-ส้ม, เฉย เทา, ชื่นชม เขียว)
- Severity แถบสี (critical แดง, high ส้ม, medium เหลือง, low เทา)
- ทุก impact/ROI มีคำว่า "ประมาณการ" กำกับ — ห้ามโชว์ตัวเลขราวกับเป็นข้อเท็จจริง
- ใช้ recharts (donut อารมณ์ + line แนวโน้ม + bar breakdown ปัญหา) และ lucide-react (ไอคอน)
- ทุกปุ่มต้องทำงานจริง: ถาม command bar แล้ว filter feed ได้, expand issue tree ได้, กดอนุมัติแล้วสถานะเปลี่ยน`,

  seedData: `## Executive Co-pilot — Seed Data (ตัวอย่างธุรกิจค้าปลีกออนไลน์ + แอป — ใส่ค่าจริงลง demo)

**Signal Intake (เสียงดิบ)**
- [ลูกค้า · แชต · 2 ชม.ที่แล้ว · หงุดหงิด] "แอปช้ามากตอนเย็น กดเข้า product แล้วค้าง"
- [ลูกค้า · รีวิวแอป · เมื่อวาน · ผิดหวัง] "สั่งของ 5 วันยังไม่ถึง ติดตามพัสดุก็ไม่อัปเดต"
- [ลูกค้า · support · วันนี้ · โกรธ] "ขอคืนเงินตั้งแต่สัปดาห์ที่แล้ว ยังเงียบ"
- [พนักงาน · ฟีดแบ็ก · 3 วันก่อน · ท้อ] "ตอบลูกค้าไม่ทันเพราะต้องสลับ 4 ระบบ"
- [ลูกค้า · โซเชียล · วันนี้ · เปรียบเทียบ] "เจ้าอื่นถูกกว่า 10% ส่งฟรีด้วย"
- [ลูกค้า · แชต · ชื่นชม] "แอดมินคนล่าสุดช่วยดีมาก แก้ให้จบในสายเดียว"

**Sentiment (สรุป)** — หงุดหงิด/โกรธ 41% · ผิดหวัง 27% · เฉย 18% · ชื่นชม 14% · ดัชนีอารมณ์ 58/100 (−6 จากสัปดาห์ก่อน)

**Issue Tree (MECE) + จำนวนสัญญาณ/ความรุนแรง**
- ประสบการณ์ดิจิทัล (แอป/เว็บ) — 128 สัญญาณ — critical (แอปช้า/ค้างช่วง peak)
- โลจิสติกส์/จัดส่ง — 74 — high (ส่งช้า, ติดตามพัสดุไม่อัปเดต)
- บริการลูกค้า — 61 — high (ตอบช้า, แก้ไม่จบ)
- ราคา/โปรโมชัน — 39 — medium (แพงกว่าคู่แข่ง)
- คืนเงิน/คืนของ — 33 — high (ขั้นตอนช้า/ยุ่งยาก)

**Root-Cause (5 Whys) — หมวด "แอปช้าช่วง peak"**
1. ลูกค้าบ่นแอปช้าตอนเย็น → 2. หน้า product โหลด >8 วินาทีช่วง 18:00–21:00 →
3. API สินค้า timeout เพราะ query หนัก → 4. ฐานข้อมูล read โหลดพุ่งตอน peak ไม่มีตัวช่วย →
5. **Root cause: ไม่มี caching layer + ไม่มี read replica** สำหรับ catalog ที่อ่านหนัก

**Decision Options (Decision Matrix — ตัวเลขเป็นประมาณการ)**
- **ทางเลือก A — เพิ่ม read replica + CDN cache สำหรับ catalog**
  Impact สูง · Effort กลาง · Cost กลาง · Risk ต่ำ · เวลา 4–6 สัปดาห์ — แก้ที่ราก
- **ทางเลือก B — cache ชั่วคราว + graceful degradation ช่วง peak** ⭐ แนะนำเริ่มก่อน
  Impact กลาง · Effort ต่ำ · Cost ต่ำ · Risk ต่ำ · เวลา 1 สัปดาห์ — บรรเทาเร็วระหว่างทำ A
- **ทางเลือก C — ย้าย catalog ไป edge/serverless ทั้งหมด**
  Impact สูงมาก · Effort สูง · Cost สูง · Risk กลาง · เวลา 8–12 สัปดาห์ — เกินความจำเป็นตอนนี้
- **สรุปแนะนำ:** ทำ B ทันที (ลดคำบ่นเร็ว) แล้วตาม A เพื่อแก้ราก — C พักไว้ · **สถานะ: รอ CEO อนุมัติ**

**KPI strip (หน้าแรก)**
- สัญญาณสัปดาห์นี้: 335 (+12%)
- Pain point อันดับ 1: แอปช้าช่วง peak (128)
- ดัชนีอารมณ์: 58/100 (−6)
- การตัดสินใจรออนุมัติ: 1`,

  designHints:
    "โทน command center: พื้น near-black, accent เดียว (ฟ้าคมๆ), การ์ดข้อมูลแน่น, KPI strip เด่นด้านบน, sentiment/severity ใช้สีสื่อความหมาย, ตัวเลขตัวใหญ่ชัด, ให้ความรู้สึก 'ศูนย์บัญชาการที่ตัดสินใจได้' — จริงจัง มีอำนาจ แต่สะอาด",
};

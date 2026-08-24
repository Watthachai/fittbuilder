# TEMPLATE — Cinematic Scroll Story (แบบ Mostar)

หน้าเดียวที่เล่าเรื่องด้วยการเลื่อน: จอแรกเป็นฉากภาพซ้อนหลายชั้น เลื่อนลงแล้วฉากขยับแยกชั้นกัน
การ์ดสถานที่ไหลเข้ามาจากขวา ภาพคู่เปิดออกเหมือนม่าน แล้วจบด้วยเนื้อเรื่องทีละแผ่น
เอาไปใช้กับเมืองอื่น สินค้า งานอีเวนต์ หรือแบรนด์ได้ — เปลี่ยนแค่ส่วน "กรอกก่อนใช้" ข้างล่างนี้ แล้ววางทั้งไฟล์ลงช่องแชท

---

## ✏️ กรอกก่อนใช้ (แก้เฉพาะส่วนนี้ ที่เหลือคงไว้)

**เรื่อง/สถานที่:** `Mostar` → เปลี่ยนเป็นของคุณ เช่น `เชียงใหม่`, `แบรนด์กาแฟ AROMA`
**ชื่อใหญ่กลางจอ (คำเดียวสั้นๆ):** `MOSTAR` → เช่น `CHIANG MAI`
**แท็กไลน์ 1 ประโยค:** `A stone arch, emerald water, and a compact old city…` → ของคุณ
**ภาษา copy ทั้งหน้า:** ไทย / อังกฤษ (เลือกหนึ่ง)

**โทนสี 3 ค่า:**
- `--bg` พื้นฉาก (ตอนภาพยังไม่โหลด): `#0b1110`
- `--paper` สีตัวหนังสือบนฉาก: `#fdf1e1`
- `--ink` สีตัวหนังสือบนการ์ด: `#111411`

**รูปภาพ (วาง URL ตรงๆ ได้จากเว็บไหนก็ได้):**

| บทบาท | URL ของคุณ | ลักษณะรูปที่เหมาะ |
|---|---|---|
| SKY — ฉากหลังไกลสุด | `https://…` | ท้องฟ้า/บรรยากาศ เต็มจอ ไม่มีวัตถุเด่น |
| MID — ชั้นกลาง | `https://…` | เมือง/ภูเขา/กลุ่มอาคาร มองไกล |
| HERO — พระเอกหน้าสุด | `https://…` | สิ่งที่เป็น "หน้าตา" ของเรื่อง (สะพาน/ตึก/สินค้า) ยิ่งเป็น PNG ตัดขอบโปร่งใสยิ่งสวย |
| SPLIT-LEFT | `https://…` | ครึ่งซ้ายของฉากที่จะ "เปิดม่าน" |
| SPLIT-RIGHT | `https://…` | ครึ่งขวาของฉากเดียวกัน |
| CLOSE-UP | `https://…` | ภาพระยะใกล้ โผล่ตอนท้ายเรื่อง |

> ไม่มี PNG ตัดขอบ? ใช้รูปถ่ายธรรมดาได้ทุกช่อง — ระบุไว้ท้าย template แล้วว่าให้ชดเชยด้วย
> mask ไล่เฉดแทน · มีรูปไม่ครบ 6? ใส่ขั้นต่ำ 3 (SKY, MID, HERO) แล้วตัดฉาก splitframe ออก

**การ์ดไฮไลต์ 4–6 ใบ** (ไหลเข้ามาระหว่างเลื่อน):

| # | kicker (หมวด ตัวพิมพ์เล็กๆ) | ชื่อ | คำอธิบาย ≤ 2 บรรทัด |
|---|---|---|---|
| 1 | `Old Bridge` | `Stari Most` | `The stone arch over the Neretva…` |
| 2 | … | … | … |

**เนื้อเรื่องปิดท้าย 2 แผ่น** (แผ่นละ: หัวเรื่อง 1 ประโยค + เนื้อ 2-3 ประโยค + ตัวเลข/ข้อเท็จจริง 2 คู่):
- แผ่น 1: `The bridge is the city's compass.` + facts เช่น `1566 — Original bridge completed`
- แผ่น 2: …

**เมนูบน 4 ลิงก์:** `Intro · Bridge · Bazaar · Routes` → ของคุณ

---

## กลไกที่ต้องสร้าง (ห้ามลดทอน — นี่คือหัวใจของ template)

สแตค: React + Vite + Tailwind ตามมาตรฐานระบบ · คอมโพเนนต์แยกไฟล์:
`StageLayers.tsx` (ฉากซ้อนชั้น) · `SightsSlider.tsx` (การ์ดไฮไลต์) · `StoryPanels.tsx` (เนื้อเรื่อง) ·
`SightModal.tsx` (รายละเอียดการ์ด) — ประกอบใน `App.tsx`

### 1) Scroll rig — หน้ายาว ฉากติดจอ

- ราง: `section.cinema-scroll { position: relative; height: calc(100vh + 3700px) }`
- เวที: `div.stage { position: sticky; top: 0; height: 100vh; min-height: 620px; overflow: hidden; isolation: isolate }`
- ทุกอย่างในเวทีเป็น `position: absolute` ซ้อนกันตาม z-index — **ลำดับใน DOM คือ ลำดับการวาด**
- อ่านตำแหน่งเลื่อนใน `requestAnimationFrame` เดียว แปลงเป็น progress 0→1 แล้วเขียนเป็น
  **CSS custom properties บน `:root`** (เช่น `--back-y`, `--title-scale`, `--sights-enter-x`)
  ให้ CSS เป็นคนขยับผ่าน `transform: translate3d(...)` — ห้าม set style ทีละ element ใน JS

### 2) ไทม์ไลน์ 5 องก์ (แบ่งช่วงจาก progress ของราง 3700px)

| องก์ | ช่วง | เกิดอะไร |
|---|---|---|
| 1 เปิดฉาก | 0–15% | เห็นฉากเต็ม: SKY นิ่ง, MID `scale(0.78)` `mix-blend-mode: screen` `opacity .72`, HERO เต็มกว้าง ~67vw กลางล่าง, ชื่อใหญ่ `hero-title` ทับกลางจอ |
| 2 แยกชั้น | 15–35% | เลื่อนแล้วชั้นขยับไม่เท่ากัน (parallax): MID ลอยขึ้นเร็ว, HERO ขยับช้า + `scale` เพิ่มเล็กน้อย, ชื่อใหญ่จางแล้วหดขึ้น, ฉากหลังเริ่ม `blur(var(--blur-px))` |
| 3 การ์ดเข้า | 35–60% | `SightsSlider` ทั้งแถวไหลจาก `translate3d(420vw,…)` เข้ามาจอด — โผล่ด้วย **visibility + translate ไม่ใช่ opacity** · ปุ่ม ←/→ จางเข้ามาหลังจอดแล้ว (`--sights-controls-opacity`) |
| 4 เปิดม่าน | 60–80% | SPLIT-LEFT ไถลออกซ้าย SPLIT-RIGHT ไถลออกขวา (จาก `-50%` กลางจอ) เผย CLOSE-UP ที่ fade + `scale 1.06→1` ขึ้นมาแทน |
| 5 เนื้อเรื่อง | 80–100% | `StoryPanels` สองแผ่นเลื่อนขึ้นทีละแผ่น (`--panel2-y`, `--panel3-y` จาก `calc(-50% + 58px)` → `-50%` พร้อม opacity) พื้นฉากมืดลงด้วย `div.shade` ไล่เฉดสามช่วง |

### 3) SightsSlider — การ์ดกระดาษบนฉาก

- ราง `display:flex; gap:clamp(16px,1.15vw,24px)` เลื่อนด้วย `transform` +
  `transition: transform 640ms cubic-bezier(0.22,1,0.36,1)`
- การ์ด: `flex: 0 0 clamp(360px,19.4vw,430px); height:220px; border-radius:24px;
  background:var(--paper); color:var(--ink); border:1px solid rgba(253,241,225,.42);
  box-shadow:0 18px 52px rgba(2,47,64,.12)` — ข้างใน: kicker ตัวเล็ก uppercase บนซ้าย →
  ไอคอน/รูปเล็กมุมขวาบน → ชื่อ `font-weight:800` ล่าง → คำอธิบาย clamp 2 บรรทัด
- คลิกการ์ดเปิด `SightModal` (ภาพ + เรื่องเต็ม + ปุ่มปิด) · ทุกการ์ด `tabindex="0" role="button"` มี `aria-label`
- ปุ่ม prev/next เป็นปุ่มจริง มี `aria-label` · ลูกศรคีย์บอร์ดใช้ได้

### 4) Header ลอย

`display:grid; grid-template-columns: minmax(260px,1fr) auto minmax(260px,1fr); padding:32px` —
โลโก้ซ้าย (serif) · เมนูกลาง 4 ลิงก์ `font-size:20px` + `text-shadow: 0 2px 16px rgba(0,0,0,.2)` ·
ปุ่มสลับภาษาขวา — ทั้งหมดสี `var(--paper)` โปร่งบนฉาก ไม่มีพื้นหลัง

### 5) ฟอนต์

Display serif (เช่น Playfair Display จาก Google Fonts) สำหรับโลโก้/ชื่อใหญ่/หัวเรื่อง ·
Inter สำหรับเนื้อความ · ชื่อใหญ่กลางจอ `clamp(72px, 14vw, 210px)` `letter-spacing` ติดลบเล็กน้อย

### 6) เก็บงานให้เนี้ยบ (ข้อบังคับ)

- `prefers-reduced-motion: reduce` → ปิด parallax ทั้งหมด เหลือหน้าเลื่อนปกติที่อ่านครบทุกเนื้อหา
- ทุก `img` ฉากมี `alt=""` (เป็นภาพตกแต่ง) — แต่การ์ด/โมดัลมี alt จริง
- `will-change: transform, opacity, filter` เฉพาะชั้นที่ขยับ · ห้าม animate `top/left`
- มือถือ: ฉากยังทำงาน (ลด parallax ลงครึ่งหนึ่ง) การ์ดกว้าง `min(84vw, 360px)`
- ถ้ารูปใดโหลดไม่สำเร็จ ให้ชั้นนั้นเป็นสีพื้นไล่เฉดจาก `--bg` แทน — ห้ามเป็นกรอบแตก

### 7) เมื่อรูปไม่ใช่ PNG ตัดขอบ

HERO/MID ที่เป็นรูปถ่ายสี่เหลี่ยม: ครอบด้วย
`mask-image: linear-gradient(to top, transparent 0, black 22%)` (และ `-webkit-mask-image`)
ให้ขอบล่างจางเนียนเข้าฉาก + เพิ่ม `filter: drop-shadow` เบาๆ — ได้ความลึกใกล้เคียงกันโดยไม่ต้องไดคัท

---

## หน้าที่สอง (ต่อท้ายฉาก ถ้าต้องการ)

ใต้ cinema-scroll ต่อ section ปกติ: กริดรูป 6 ใบพร้อมคำบรรยาย · แผนที่/เส้นทาง · footer สั้น —
โทนเดียวกัน ใช้ `--paper` บนพื้น `--bg`

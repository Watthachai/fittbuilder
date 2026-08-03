# Wand — แก้เดโมด้วยการชี้ แทนการพิมพ์บอก

**เป้าหมาย:** ผู้ใช้ชี้ element บนพรีวิว → กรอบเรืองแสงจับอัตโนมัติ → สั่งแก้ตรงจุดนั้น (ด้วย AI หรือปรับค่าตรงๆ) → ทุกครั้งที่แก้ได้ checkpoint ที่ย้อนกลับได้จากในแชท

## ทำไมต้องทำ
- 70% ของคำสั่งแก้จริงคือ "เปลี่ยนสี/ข้อความ/ระยะห่างตรงนี้" ซึ่งการพิมพ์อธิบายว่า *"ตรงนี้"* คือส่วนที่ยากที่สุดสำหรับคนไม่เขียนโค้ด — ชี้เอาง่ายกว่าและไม่กำกวม
- ต่อยอดจาก v0.44.0 ที่แตกไฟล์เป็น ≤200 บรรทัด: รู้ไฟล์+บรรทัดที่จะแก้ = โมเดลเขียนทับไฟล์เล็กไฟล์เดียว เร็วและพังยาก

## ข้อจำกัดจริงที่กำหนดสถาปัตยกรรม
1. **พรีวิวเป็น iframe cross-origin** (`webcontainer-api.io`) — หน้า studio อ่าน DOM ข้างในไม่ได้ ทุกอย่างต้องคุยผ่าน `postMessage` (pattern เดิม: `__fittCursor`, `__fittPreviewError`)
2. **WebContainer ไม่มี git** (รัน native binary ไม่ได้) — versioning ต้องอยู่ชั้นเรา ไม่ใช่ใน container
3. **แหล่งความจริงของไฟล์คือ Supabase** (`project.files`) container เป็นแค่ที่รัน

## กลไกหลัก: `data-fitt-loc`
`vite.config.js` เป็นไฟล์ canonical ที่ AI ไม่เคยเขียนเอง → ใส่ Babel plugin ประทับที่มาลงทุก host element ตอน dev:

```
<button data-fitt-loc="src/components/orders/OrderTable.tsx:64:8">
```

- **auto-snap ได้ฟรี**: wand ไล่ขึ้น parent จนเจอ element ที่มี attribute นี้ ⇒ snap เฉพาะสิ่งที่ AI แก้ได้จริง
- ไม่ต้องแตะ React fiber, ไม่ต้องใช้ AI เดาโครงสร้าง
- ใส่เฉพาะตอน `vite serve` — `vite build` ไม่มี attribute นี้ โค้ดที่ export ออกไปสะอาด

## โปรโตคอล iframe ↔ studio
| ทิศทาง | ข้อความ |
|---|---|
| studio → iframe | `{__fittWand: true/false}` เปิด/ปิดโหมด |
| studio → iframe | `{__fittWandBusy: true/false}` กรอบเต้นระหว่าง AI ทำงาน |
| iframe → studio | `{__fittWandPick, loc, rect, tag, text, className}` |
| iframe → studio | `{__fittWandCancel}` (กด Esc ในพรีวิว) |

`rect` เป็นสัดส่วน 0..1 ของ viewport ใน iframe — studio map กลับเป็นพิกัดจริงด้วยสูตรเดียวกับ `LiveCursors`

## โหมดของ composer
| โหมด | ใช้เมื่อ | กลไก | ต้นทุน |
|---|---|---|---|
| ⚡ ปรับเร็ว | สี · ขนาดตัวอักษร · ระยะห่าง · ข้อความ | patch `className`/text ที่ไฟล์+บรรทัดตรงๆ ไม่เรียกโมเดล เห็นผลผ่าน HMR | 0 token · <1 วิ |
| 🪄 เสก | อะไรที่ต้องคิด | prompt เจาะจงไฟล์+บรรทัด เข้า pipeline เดิม | ปกติ |

## Revisions (แทนที่ history เดิม)
เดิม: `project.history` = อาเรย์ snapshot 10 ชั้นใน jsonb, undo = `pop()` — ไม่มี id กระโดดไม่ได้

ใหม่: ตาราง `fittbuilder_project_revisions` — `sha` = 7 ตัวแรกของ `SHA-256(canonical JSON ของ path→content)` (deterministic, content-addressed)
- ทุกเทิร์นที่ไฟล์เปลี่ยน → สร้าง revision ใหม่ (parent = ตัวก่อนหน้า) เก็บ 20 ตัวล่าสุดต่อโปรเจกต์
- แชทแสดงชิป `เวอร์ชัน N · a1b2c3d` — ไม่โชว์ hash เปล่าๆ เพราะผู้ใช้เราไม่ใช่ dev
- ย้อนกลับ = เขียนไฟล์ชุดนั้นกลับ + สร้าง revision **ใหม่** ที่ชี้ parent เป็นตัวที่ย้อนมา (แบบ `git revert` ไม่ใช่ `reset` — ย้อนแล้วย้อนกลับได้อีก)
- ปุ่ม Undo เดิมยังอยู่ แต่หมายถึง "ไป revision ก่อนหน้า" (กลไกเดียว สอง affordance)

**จุดที่ hash คุ้มค่าจริง:** ส่งไป FITT Code Runner แล้วผูก `Idempotency-Key` กับ revision sha ⇒ ตอบได้ว่า build บนระบบจริงมาจากต้นแบบเวอร์ชันไหน ใครเสก เมื่อไหร่ (audit trail ข้ามระบบ — คู่แข่งไม่มีเพราะเขาจบที่ prototype)

## เฟส
| เฟส | ขอบเขต |
|---|---|
| **1** | babel plugin + wand overlay + composer โหมดเสก + prompt เจาะจง |
| **2** | โหมดปรับเร็ว (patch className/text ตรงๆ ไม่เรียกโมเดล) |
| **3** | revisions + ชิปในแชท + rollback + Undo ใช้กลไกเดียวกัน + ผูก sha เข้า Code Runner |

## ไม่ทำ (ตัดออกโดยตั้งใจ)
- mini-screenshot ก่อน/หลัง — canvas ข้าม origin ถูก taint, html2canvas หนักและเพี้ยนกับ Tailwind CDN
- git จริงใน container — ต้องลง isomorphic-git เพิ่ม ไม่คุ้ม เราไม่ต้องการ object database
- เลือกหลาย element พร้อมกัน — รอ v2 หลังเห็นการใช้งานจริง

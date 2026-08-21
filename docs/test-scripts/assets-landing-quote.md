# Test script — ตัวกลาง Asset · หน้าแรกใหม่ · ข้อสัญญาแก้ไขได้ (21 สิงหาคม 2569)

คู่กับ `docs/jira/2026-08-21-assets-landing-quote.md` · commits `a714770` … `f4f0eea` · deploy `fa24154`

เอกสารนี้บอกว่า **อะไรพิสูจน์แล้ว อะไรยัง** และให้เกณฑ์ผ่านที่วัดได้ ไม่ใช่ "ดูแล้วโอเค"

---

## กฎข้อเดียวที่สำคัญที่สุดของเอกสารนี้

> **วัดที่จุดที่อาการเกิด ไม่ใช่จุดที่วัดสะดวก**

รอบนี้เสียเวลาไปหนึ่ง commit เต็มๆ เพราะทดสอบเรื่อง COEP บนหน้า studio แทนที่จะเป็นหน้าพรีวิว สองหน้านั้นตั้งค่าคนละแบบ:

| หน้า | COEP | ใช้ทดสอบอะไรได้ |
|---|---|---|
| Studio `localhost:3000` | `credentialless` | UI ของสตูดิโอเท่านั้น |
| **พรีวิว `*.webcontainer-api.io`** | **`require-corp`** | **ทุกอย่างที่เกี่ยวกับ asset ของเดโม** |

ยืนยันด้วย:
```bash
curl -sI https://<preview-host>/ | grep -i cross-origin-embedder-policy
# ต้องได้: require-corp
```

---

## ความเสี่ยง → เคสทดสอบ

| # | ความเสี่ยง | เคส | เกณฑ์ผ่าน | สถานะ |
|---|---|---|---|---|
| R1 | ไฟล์แนบไม่นับเป็น brief | แนบ `.md` ที่มีสเปค + พิมพ์ประโยคสั้น | BRD สะท้อนเนื้อในไฟล์ | ✅ ผ่าน |
| R2 | ไฟล์ยาวถูกตัดเงียบ | แนบไฟล์เกิน 100,000 ตัว | มีหมายเหตุในข้อความ + toast เตือน | ✅ ผ่าน (unit + xlsx จริง) |
| R3 | รายงานว่ารูป/PDF ถูกตัด | ส่ง attachment ที่เป็นรูป | `wasTruncated` = false เสมอ | ✅ ผ่าน (unit) |
| R4 | เทิร์นแก้ไขไม่รู้กฎ | grep prompt | มี `RUNTIME_RULES` ไม่มี `PROJECT_RULES` | ✅ ผ่าน (unit) |
| R5 | ตัวกลางกลายเป็น SSRF | ยิง 9 เคสโจมตี | ทุกเคสถูกปฏิเสธด้วย status ที่ถูกต้อง | ✅ ผ่าน (live) |
| R6 | DNS rebinding | ตรวจว่าต่อไปที่ IP ที่ resolve แล้ว | โค้ดส่ง `host: target.address` + `servername` | ⚠️ พิสูจน์โดยโครงสร้าง + unit ของ `resolvePublicTarget` |
| R7 | redirect ไปหา private | ตาม redirect แล้วตรวจใหม่ทุกขั้น | hop ที่ชี้ private → `blocked` | ⚠️ พิสูจน์การ**ตามต่อ**แล้ว แต่เคส redirect→private ยัง**ไม่ได้ทดสอบ end-to-end** |
| R8 | เอา URL ที่ใช้ได้อยู่แล้วไปวิ่งผ่านตัวกลาง | ไฟล์จริงของ Mostar | ไอคอน CloudFront (มี ACAO) ไม่ถูกแตะ | ✅ ผ่าน |
| R9 | `xmlns` / `<a href>` ถูกนับเป็น asset | ไฟล์จริงที่มี SVG | `w3.org` ไม่ติด · `preloader.svg` ไม่ถูกแก้ | ✅ ผ่าน |
| R10 | URL ที่เป็นคำนำหน้ากันพังตอนแทนที่ | `…/a.png` กับ `…/a.png?v=2` | ตัวยาวไม่เหลือหางลอย | ✅ ผ่าน (unit) |
| R11 | หน้าแรกพังในโหมดสว่าง | สลับธีม | สีอ่านได้ทั้งสองโหมด | ✅ ผ่าน (ดูจริง) |
| R12 | การ์ดซ้อนตัดหัวข้อ | สแกน scroll ทั้งส่วน | 0 เฟรมที่ขอบการ์ดตัดผ่านหัวข้อ | ✅ ผ่าน (77 ตำแหน่ง) |
| R13 | แก้ข้อสัญญาแล้วข้ออื่นค้าง | แก้ข้อ 1 แล้วเปลี่ยนงวด | ข้อ 2 อัปเดตตามตาราง | ✅ ผ่าน (unit) |
| R14 | ใบเสนอราคาเก่าเปิดไม่ได้ | round-trip เอกสารที่ไม่มีฟิลด์ใหม่ | `parseDoc` ไม่คืน null | ✅ ผ่าน (unit) |
| R15 | ตัวกลางไม่ทำงานบน Cloud Run | ตั้ง `PUBLIC_SITE_URL` แล้ว deploy | รูปจากโฮสต์ที่ไม่ส่ง header ขึ้นบน UAT | ❌ **ยังไม่ได้ทดสอบ** |

---

## วิธีรัน

### A. เทสต์อัตโนมัติ (ฟรี ไม่ยิงเน็ต ยกเว้น DNS)

```bash
npx vitest run lib/__tests__/asset-check.test.ts \
                lib/__tests__/attachments.test.ts \
                lib/__tests__/quote-clauses.test.ts \
                lib/__tests__/brief-context.test.ts
```

**เกณฑ์ผ่าน:** ทั้งหมดผ่าน · ชุดเต็ม `npx vitest run` = 357/357

### B. Gate เต็ม ก่อน commit ทุกครั้ง

```bash
npx tsc --noEmit && npm run lint && npx vitest run && npm run build
```

### C. ยิงตัวกลางด้วยของจริง (ต้องมี dev server)

```bash
B=http://localhost:3000/api/asset
enc() { python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$1"; }
probe() { printf "%-42s → %s\n" "$2" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$B?url=$(enc "$1")")"; }

# ต้องได้ 200
probe "https://raft-blast-61784561.figma.site/_assets/v11/16b5007d9c93971e26ffe4e0e3e37946f6bd538c.png" "figma PNG"
probe "https://dcym8fthxf5uu.cloudfront.net/fonts/247a073c-29f5-4a89-aa3a-741020f346fc/OggText-Medium.woff2" "ฟอนต์ woff2"

# ต้องได้ 400
for u in "http://169.254.169.254/latest/meta-data/" "http://127.0.0.1:3000/api/me" \
         "http://10.0.0.1/x.png" "http://[::ffff:169.254.169.254]/x" \
         "file:///etc/passwd" "https://example.com:22/x"; do probe "$u" "$u"; done

# ต้องได้ 415
probe "https://example.com/" "HTML"
```

**เกณฑ์ผ่าน:** 200 · 200 · 400×6 · 415 — **ผลจริง 2026-08-21: ตรงทุกเคส**

ตรวจ header ของ response ที่สำเร็จด้วย:
```bash
curl -sI "$B?url=$(enc '…figma PNG…')" | grep -iE "cross-origin-resource-policy|access-control-allow-origin|x-content-type-options"
```
**เกณฑ์ผ่าน:** `cross-origin` · `*` · `nosniff` ครบสามตัว

### D. ขับ UI จริง — เคสที่จับบั๊กได้จริงทุกครั้ง

**อย่าทดสอบเรื่อง asset ด้วยการสร้างเทิร์นแก้ไขบนโปรเจกต์เก่า** — เทิร์นแก้ไขส่งเฉพาะไฟล์ที่เปลี่ยน ตัวตรวจจึงเห็นแค่ไฟล์นั้น และคอนเทนเนอร์อาจถือไฟล์เก่าอยู่ (ดู "ที่ยังพิสูจน์ไม่ได้")

**สร้างโปรเจกต์ใหม่แทน:**

1. `npm run dev` → เปิด `http://localhost:3000`
2. วาง prompt ที่มี URL รูปจากโฮสต์ที่ไม่ส่ง header เช่น
   `สร้างหน้าเว็บหน้าเดียว พื้นหลังดำ ใส่รูปนี้เต็มจอ ไม่ต้องมีแอนิเมชัน รูป: https://raft-blast-61784561.figma.site/_assets/v11/16b5007d9c93971e26ffe4e0e3e37946f6bd538c.png`
3. รอ build เสร็จ
4. ตรวจสามอย่าง:

| ตรวจ | เกณฑ์ผ่าน |
|---|---|
| ข้อความท้ายคำตอบ | มี "📡 ส่ง N ไฟล์ผ่านตัวกลางให้แล้ว" |
| `dev.log` | มี `GET /api/asset?url=…` ที่ได้ **200** |
| พรีวิว | เห็นรูปจริง ไม่ใช่ไอคอนรูปพัง |

**ผลจริง 2026-08-21:** ข้อ 1 และ 2 ผ่าน · ข้อ 3 ยังไม่ผ่าน — ดูหัวข้อถัดไป

### E. หน้าแรก

1. เปิด `/` → เลื่อนลง
2. แถบผลงานสองแถวต้องไถ่**สวนทางกัน**ตาม scroll (ไม่ใช่วนเอง)
3. เลื่อนถึงส่วน Partner → การ์ดต้องซ้อนขึ้นเป็นสำรับ **ไม่มีหัวข้อไหนถูกตัดครึ่ง**
4. กดสวิตช์ "ในนามเรา" → โลโก้เปลี่ยน บรรทัด Powered by เลิกถูกขีดฆ่า
5. สลับธีมสว่าง/มืด → อ่านได้ทั้งคู่

สแกนอัตโนมัติสำหรับข้อ 3 (รันใน console ของหน้าแรก):
```js
const sec = document.getElementById('partner');
let sliced = 0;
for (let y = sec.offsetTop - 200; y < sec.offsetTop + sec.offsetHeight; y += 20) {
  window.scrollTo(0, y); await new Promise(r => requestAnimationFrame(r));
  const c = [...sec.querySelectorAll('article')].map(a => ({
    top: a.getBoundingClientRect().top,
    titleBottom: a.querySelector('h3').getBoundingClientRect().bottom }));
  for (let i = 0; i < c.length - 1; i++)
    if (c[i+1].top > c[i].top && c[i+1].top < c[i].titleBottom - 2) sliced++;
}
sliced;   // เกณฑ์ผ่าน: 0
```

### F. ใบเสนอราคา

1. เปิดใบเสนอราคา → เปิดบล็อกเงื่อนไขตรวจรับ
2. แก้ข้อ 1 เป็นข้อความของตัวเอง → ต้องขึ้นป้าย "แก้เอง" + ปุ่มคืนค่าอัตโนมัติ
3. เปลี่ยนงวดชำระเป็น 30/70 → **ข้อ 2 ต้องอัปเดตเป็น 30% เอง** (ข้อ 1 ไม่เปลี่ยน)
4. กดคืนค่าอัตโนมัติที่ข้อ 1 → กลับไปตามตัวเลข ป้ายหาย
5. กด "+ เพิ่มข้อสัญญา" พิมพ์ข้อความ → ⌘P ตรวจว่าขึ้นบนกระดาษต่อท้าย
6. เปิด**ใบเก่า**ที่สร้างก่อนวันนี้ → ต้องเปิดได้ ราคาเดิมครบ

---

## สิ่งที่พิสูจน์แล้ว

- ตัวกลางปลอดภัยตามที่ออกแบบ — 9 เคสโจมตียิงจริงกับ route ที่รันอยู่
- ตัวตรวจแยก asset ออกจากลิงก์และ namespace ได้ — ทดสอบกับ**ไฟล์จริงของผู้ใช้** ไม่ใช่ข้อมูลสมมติ
- ไฟล์ที่ต้นทางส่ง header ครบไม่ถูกแตะ
- ข้อสัญญาที่ไม่ได้แก้ยังตามตัวเลข ข้อที่แก้ไม่ตาม — และใบเก่าเปิดได้
- หน้าแรกทำงานทั้งสองธีม การ์ดไม่ตัดหัวข้อสักเฟรม

## สิ่งที่ยังพิสูจน์ไม่ได้

| | ทำไม |
|---|---|
| **รูปขึ้นจริงในพรีวิวของโปรเจกต์เดิม** | โค้ดในฐานข้อมูลถูกต้องทุกอย่าง แต่พรีวิวยังโชว์ของเก่าและ**ไม่ยิงมาที่ `/api/asset` เลย** console มี `[FS] [ERROR] invalid mount point` ตอน `restoreNodeModules` — ไฟล์ที่แก้ไม่ได้ลงคอนเทนเนอร์ **เป็นบั๊กคนละเรื่อง** และต้องแยกไปสอบสวนต่างหาก |
| **redirect → private address** | ต้องมี redirector สาธารณะที่เชื่อถือได้ชี้ไป `169.254.169.254` ซึ่งหาไม่ได้ · พิสูจน์แล้วว่า**ตาม redirect จริงและตรวจชนิดที่ปลายทาง** ส่วนการตรวจ address ทุก hop พิสูจน์ผ่าน unit ของ `resolvePublicTarget` (10 เคส) + โครงสร้างลูป 3 บรรทัด |
| **DNS rebinding จริง** | ต้องคุม DNS เอง · พิสูจน์ว่าโค้ดต่อไปที่ `target.address` พร้อม `servername` แทนชื่อโฮสต์ |
| **ทุกอย่างบน Cloud Run** | `PUBLIC_SITE_URL` ยังไม่ได้ตั้งใน trigger — ตัวกลางจึงยังปิดตัวเองบน dev/prod |
| **ภาพหน้าแรกโหลดเร็วพอบนเน็ตจริง** | 876 KB ทดสอบบน localhost เท่านั้น |

## สิ่งที่รู้แล้วว่าทำไม่ได้

- **`@tailwind base;` ใน `index.css`** ตามที่บาง spec สั่ง — โปรเจกต์ที่ generate ใช้ Tailwind ผ่าน CDN เขียน build-time directive แล้ว dev server พัง เป็นข้อจำกัดของ runtime ไม่ใช่บั๊ก
- **ไอคอนแบรนด์จาก lucide-react** — ถูกถอดออกตั้งแต่ v1 ต้องวาดเป็น inline SVG
- **โฮสต์ที่ไม่ส่ง CORS/CORP** — แก้ที่โค้ดไม่ได้ ต้องผ่านตัวกลางหรือย้ายโฮสต์

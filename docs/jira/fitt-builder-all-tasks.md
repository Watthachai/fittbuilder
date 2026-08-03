# FITT Builder — Jira backlog ทั้งหมด (v0.5.0 → v0.44.1)

| | |
|---|---|
| ช่วงงาน | 2026-06-22 → 2026-07-30 |
| Releases | 74 เวอร์ชัน |
| Issues | 13 Epic + 74 Story/Bug/Task |
| Commits | 266 |
| สถานะ | ทุก issue ในไฟล์นี้ = **Done** และขึ้น production แล้ว (`main` = `c21d93f`) |
| แหล่งอ้างอิง | `lib/changelog.ts` (แสดงที่หน้า `/changelog`) + git history |

**วิธีใช้:** ก๊อปบล็อก CSV ข้างล่างทั้งก้อน → Jira → *Filters → Import issues from CSV* → map คอลัมน์ตามชื่อ (Epic ต้อง import ก่อน แล้วค่อย import issue ที่เหลือ ถ้าโปรเจกต์คุณเป็น team-managed ให้ใช้คอลัมน์ `Parent` แทน `Epic Link`) · ส่วน "รายละเอียดรายเอปิก" ด้านล่างไว้อ่าน/สร้างมือ

---

## 1) CSV — ก๊อปทั้งก้อนไปวางได้เลย

```csv
Issue Type,Summary,Epic Link,Status,Priority,Labels,Fix Version,Start Date,Description
Epic,"E1 Studio & Codegen — สร้าง/แก้ demo ด้วย AI",,Done,High,codegen,,2026-06-22,"เครื่องยนต์หลัก: prompt สร้างโค้ด, การแก้ไขซ้ำ, โครงสร้างไฟล์, ติดตั้งไลบรารี, โหมด Express"
Epic,"E2 Preview & WebContainer",,Done,High,preview,,2026-06-29,"พรีวิวสดใน WebContainer: จอขาว, error bridge, การติดตั้ง package, สถานะการโหลด"
Epic,"E3 Phase Flow & Docs (Define→Ship)",,Done,Medium,phases,,2026-07-01,"เฟสการทำงาน 6 ขั้น, เอกสาร BRD/PRD/Verify/Review, การอนุมัติหลายคน"
Epic,"E4 Domain Skills & Org DNA",,Done,High,skills;org-dna,,2026-06-22,"ผู้เชี่ยวชาญเฉพาะโดเมน, specialist ประจำ workspace, Org DNA 4 ฐานราก + citation"
Epic,"E5 FITT Consult (ที่ปรึกษาธุรกิจ)",,Done,High,consult,,2026-07-14,"Pain Point Radar → Business Health Check → แยกเป็นระบบ FITT Consult"
Epic,"E6 Workspace, Members & Sharing",,Done,High,workspace,,2026-06-29,"workspace, สมาชิก, คำเชิญ, สิทธิ์ viewer/editor, ลิงก์แชร์"
Epic,"E7 Collaboration & Team Chat",,Done,High,collab,,2026-06-25,"เรียลไทม์: presence, live cursor, ห้องแชททีม, แท็ก @, การแจ้งเตือน"
Epic,"E8 Projects & LaunchPad",,Done,Medium,projects,,2026-06-29,"หน้าแรก/กล่องไอเดีย, ผลงานของฉัน, การแนบไฟล์, คลังไฟล์, การบันทึกงาน"
Epic,"E9 Auth & Account",,Done,Medium,auth,,2026-06-22,"เข้าสู่ระบบ Google/magic link, เมนูบัญชี, redirect ข้าม environment"
Epic,"E10 Admin, Usage & Quota",,Done,Medium,admin,,2026-06-23,"หน้าแอดมิน, รายงานการใช้ AI + ค่าใช้จ่าย, โควตาแพลนฟรี"
Epic,"E11 Integration — FITT Code Runner",,Done,Medium,integration,,2026-06-30,"ส่งงานเข้า Code Runner ผ่าน Gateway /v1/ingest + สถานะ build"
Epic,"E12 Design System & Brand",,Done,Medium,design,,2026-06-24,"ธีม light/dark, liquid glass, loader, โลโก้, การจัดวาง TopBar"
Epic,"E13 Platform & Release",,Done,Medium,platform,,2026-07-13,"โมเดล AI, rate limit, การ deploy UAT/prod, ประสิทธิภาพระบบ"
Bug,"[PROD] สั่งแก้แล้ว AI บอกว่าเรียบร้อย แต่ของจริงไม่เปลี่ยน","E1 Studio & Codegen — สร้าง/แก้ demo ด้วย AI",Done,Highest,codegen;incident,v0.44.1,2026-07-30,"อาการ: สั่งแก้แล้วแชทขึ้น JSON ดิบ + ข้อความว่าเรียบร้อย แต่หน้าจอไม่เปลี่ยน สั่งซ้ำกี่รอบก็เหมือนเดิม · สาเหตุ: persona ฝั่ง Build ยังสั่งให้ตอบเป็น JSON แบบเก่า ขัดกับรูปแบบจริง (บล็อกไฟล์) พอเปลี่ยนโมเดลใหม่มันเชื่อคำสั่งเก่า ระบบจึงหาไฟล์ไม่เจอและไม่เขียนอะไรเลย · แก้: ล้างคำสั่งเก่าทุกจุด + ห้ามตอบ JSON เด็ดขาด + กู้ไฟล์อัตโนมัติถ้าโมเดลยังหลุด (commit c21d93f)"
Story,"โค้ดที่ AI เขียนแตกเป็นโครงสร้างจริง ไม่กองใน App.tsx ไฟล์เดียว","E1 Studio & Codegen — สร้าง/แก้ demo ด้วย AI",Done,High,codegen;prompt,v0.44.0,2026-07-30,"AI สร้างโครงสร้างแบบโปรเจกต์จริง: src/pages (1 ไฟล์ = 1 หน้าจอ) · components/ui + layout + โฟลเดอร์ฟีเจอร์ · hooks · data · lib/format.ts · types.ts — App.tsx เหลือแค่ shell ≤120 บรรทัด ทุกไฟล์ ≤200 บรรทัด · ต้นตอ: เส้นทาง 'แก้ไข' ไม่เคยได้รับกฎโครงสร้างเลย ไฟล์จึงบวมถึง 2600+ บรรทัดจนถูกตัดกลางไฟล์แล้วพังทั้งแอป · เพิ่มแถบเตือน + ปุ่มจัดโครงสร้างใหม่ในแท็บ Code (commit 72d7bfb)"
Story,"AI ติดตั้งไลบรารีที่แนะนำเองได้อย่างเชื่อถือได้","E1 Studio & Codegen — สร้าง/แก้ demo ด้วย AI",Done,Medium,codegen;prompt,v0.44.0,2026-07-30,"ขยายชุดไลบรารีที่ยืนยันแล้วเป็น 6 ตัว: lucide-react recharts framer-motion date-fns clsx sonner · ห้าม AI บอกผู้ใช้ให้ไปรัน npm install เอง · แก้บั๊กแพ็กเกจที่ติดตั้งแล้วถูกสั่งซ้ำจนเวอร์ชันถูกเขียนทับเป็น latest และ container reinstall ใหม่โดยไม่จำเป็น (commit 3755639)"
Task,"ไฟล์ที่แนบตอน 'สร้างเลย' ไปถึงขั้นตอน build ตรงๆ","E1 Studio & Codegen — สร้าง/แก้ demo ด้วย AI",Done,Medium,codegen;attachments,v0.40.1,2026-07-22,"เดิมไฟล์แนบถูกอ่านแค่ตอนร่าง BRD ทำให้ demo ได้ข้อมูลเท่าที่เอกสารสรุป · ตอนนี้ตัวสร้าง demo เห็นไฟล์ตัวจริง เช่น Excel 40 คอลัมน์ → ตาราง/กราฟใช้คอลัมน์จริงครบ"
Story,"AI ถามกลับเมื่อคำสั่งกำกวม (แทนที่จะเดา)","E1 Studio & Codegen — สร้าง/แก้ demo ด้วย AI",Done,Medium,codegen;ux,v0.36.0,2026-07-17,"คำสั่งกำกวมเช่น 'หน้านี้ไม่สวยเลย' → AI ถามกลับ 1-3 ข้อพร้อมตัวเลือกให้กด แทนที่จะเดาแล้วสร้างผิด · คำสั่งชัดเจนยังทำให้ทันทีไม่ถามกวน · ปิดโควตาแพลนฟรีชั่วคราวสำหรับการใช้งานภายใน"
Task,"ย้าย Action History ขึ้นก่อนคำตอบ + กัน stream ค้างตอนออกกลางคัน","E1 Studio & Codegen — สร้าง/แก้ demo ด้วย AI",Done,Medium,codegen;ux,v0.18.9,2026-06-30,"เรียงลำดับในแชทตามที่เกิดจริง (คิด → ลงมือทำ → สรุป) · แก้ /api/generate โยน error 'Controller is already closed' เมื่อผู้ใช้ออก/ยกเลิกกลางคัน"
Task,"บอกชัดว่าพิมพ์คำตอบเองได้เมื่อ AI ให้เลือกตัวเลือก","E1 Studio & Codegen — สร้าง/แก้ demo ด้วย AI",Done,Low,ux,v0.18.5,2026-06-29,"เพิ่มข้อความ 'ไม่มีตัวเลือกที่ตรง? พิมพ์คำตอบเองในช่องด้านล่างได้เลย' (พิมพ์เองได้อยู่แล้วแต่เดิมไม่ชัด)"
Story,"ยกเครื่องปัญหา 'จอขาว' — ตรวจจับ กู้คืน และบอกสาเหตุได้เอง","E2 Preview & WebContainer",Done,Highest,preview;incident,v0.37.0,2026-07-20,"Error ในตัว demo เคยเงียบใน console ของ iframe → เพิ่ม error bridge ส่งกลับมาแสดงเป็นแถบพร้อมปุ่ม 'ให้ AI แก้เลย' ที่ส่ง error+stack จริงเข้าไป · แก้แคช node_modules ที่เก็บ .vite พังติดไปด้วยจนรีเฟรชกี่ครั้งก็จอขาว · เพิ่ม error boundary ทั้งเว็บ · กด 'ยกเลิก' กลาง generate ไม่ทับไฟล์จริงด้วยชุดครึ่งๆ อีก · dev server ตายแล้วรีสตาร์ตเอง · แชทยาวลื่นขึ้น (memoize markdown + จำกัดขนาด thinking)"
Bug,"พรีวิวไม่อัปเดตหลัง Build (WebContainer ค้างหน้า scaffold)","E2 Preview & WebContainer",Done,High,preview,v0.18.8,2026-06-30,"ธง detached ของฟีเจอร์ generate-เบื้องหลังถูกตั้งครั้งเดียวไม่รีเซ็ต เจอ React StrictMode เลยค้างเป็น true ตั้งแต่เปิดหน้า ไฟล์ที่สตรีมจึงไม่ถูกเขียนลง container · เปลี่ยนมาใช้ระบบ epoch ต่อรอบการสร้าง"
Story,"แก้ flow เฟสตัน: ย้อนกลับได้ + ปุ่มสร้างรายงาน Verify/Review","E3 Phase Flow & Docs (Define→Ship)",Done,High,phases,v0.21.0,2026-07-01,"ย้อนกลับเฟสที่ผ่านแล้วได้ (เลือก 'ย้อนกลับมาแก้' หรือ 'แค่ดูเอกสาร') · เฟส Verify/Review มีปุ่มสั่งสร้างรายงานถ้ายังไม่มี (เดิมปุ่มอนุมัติค้างเทาไปต่อไม่ได้) · modal ผู้อนุมัติเด้งทุกครั้งแม้โปรเจกต์คนเดียว · tooltip บอกเหตุผลที่กดอนุมัติไม่ได้"
Task,"อนุมัติเฟส: เด้ง modal ยืนยัน + เห็นใครอนุมัติแล้วก่อนกดจริง","E3 Phase Flow & Docs (Define→Ship)",Done,Medium,phases,v0.20.1,2026-07-01,"โปรเจกต์ที่แชร์หลายคน: กดอนุมัติแล้วเห็นรายชื่อว่าใครอนุมัติ (✓) / ยังไม่อนุมัติ (⏳) ก่อนยืนยันจริง รวมทุกอย่างไว้ที่เดียวแทนป็อปอัปเดิม"
Story,"ดูได้ว่าใครอนุมัติเฟสแล้ว + TopBar ไม่แตกบนจอแคบ","E3 Phase Flow & Docs (Define→Ship)",Done,Medium,phases;design,v0.20.0,2026-07-01,"เพิ่มปุ่ม 'ผู้อนุมัติ' แสดงรายชื่อผู้อนุมัติ/ยังไม่อนุมัติ (เดิมเห็นแค่ X/Y) · TopBar รองรับจอแคบ ปุ่มรองยุบเหลือไอคอน"
Story,"ผู้เชี่ยวชาญเรือธง: ผู้ช่วยข้างกาย CEO (Executive Co-pilot)","E4 Domain Skills & Org DNA",Done,High,skills,v0.31.0,2026-07-14,"เลือก skill แล้วสร้างได้เดโม 'ศูนย์บัญชาการผู้บริหาร': รับเสียงดิบ → วิเคราะห์อารมณ์/เจตนา → จัดกลุ่ม MECE → 5 Whys → Decision Matrix โดย CEO เป็นคนเคาะ · ผูก Org DNA อัตโนมัติ + Framework Library ที่เรียบเรียงเอง"
Bug,"ปั้นผู้เชี่ยวชาญ: ซ่อน JSON ดิบออกจากผลการค้นคว้า","E4 Domain Skills & Org DNA",Done,Low,skills,v0.31.1,2026-07-14,"ช่อง 'ผลการค้นคว้า' เคยโชว์บล็อก JSON สำหรับเครื่องอ่านต่อท้ายรายงาน — ตัดออกเหลือเฉพาะรายงานภาษาไทย"
Task,"ร่างผู้เชี่ยวชาญที่ยังไม่บันทึกไม่หายแล้ว","E4 Domain Skills & Org DNA",Done,Medium,skills,v0.30.2,2026-07-14,"ร่างที่ AI สร้างแต่ยังไม่กดบันทึกถูกเก็บอัตโนมัติต่อ workspace — ออกจากหน้า/รีเฟรชแล้วกลับมายังอยู่ พร้อมปุ่มล้างร่าง"
Story,"Living Org DNA — AI จับข้อมูลองค์กรจากแชทมาเก็บได้ในคลิกเดียว","E4 Domain Skills & Org DNA",Done,High,org-dna,v0.30.0,2026-07-14,"ระหว่างคุยใน Studio ถ้ามีการเผยข้อมูลองค์กร (อำนาจตัดสินใจ/โครงสร้าง/แรงจูงใจ/ข้อมูลข่าวสาร) AI ขึ้นชิปเสนอ 'เพิ่มเข้า Org DNA' — กดยืนยันครั้งเดียวบันทึกเข้าบล็อกที่ถูกหมวดพร้อมเก็บเวอร์ชัน · ไม่บันทึกจนกว่าจะกดยืนยัน"
Story,"AI Domain Skill Studio — workspace ปั้นผู้เชี่ยวชาญของตัวเองจาก Org DNA","E4 Domain Skills & Org DNA",Done,High,skills;org-dna,v0.29.0,2026-07-14,"แต่ละ workspace สร้าง specialist เฉพาะของตัวเองจาก Org DNA (persona/ความรู้/ชุดคำถาม) — เดโมทุกอันใน workspace นั้นถูกขับเคลื่อนโดยผู้เชี่ยวชาญนี้อัตโนมัติ พร้อมชิปแสดงบน TopBar"
Bug,"พาเนลเลือกโดเมนค้างที่หน้า Build (กดข้ามไม่หาย)","E4 Domain Skills & Org DNA",Done,High,skills,v0.36.1,2026-07-20,"พาเนลผูกกับสวิตช์ลอยๆ ที่ไม่ผูกกับเฟส เปิดตอน Define แล้วไปต่อ Build ก็ไม่ปิด · ผูกกับเฟส Define เท่านั้น + เคลียร์สถานะ 'กำลังวิเคราะห์โดเมน' ที่ค้างถาวรเมื่อเปลี่ยนโปรเจกต์ระหว่างวิเคราะห์"
Bug,"คลิกอ้างอิง Org DNA แล้วไฮไลต์ตรงจุด (แบบ NotebookLM)","E4 Domain Skills & Org DNA",Done,Medium,org-dna,v0.18.7,2026-06-29,"เดิมจับคู่ข้อความแบบตรงตัวเป๊ะจึงไม่เจอ แล้วโชว์ raw ทั้งก้อนเหมือนกันทุก tag · เปลี่ยนเป็นจับคู่ยืดหยุ่น (ไม่สนช่องว่าง/ตัวพิมพ์) ไฮไลต์ได้หลายช่วง"
Task,"AI ไม่ถามซ้ำสิ่งที่ Org DNA รู้แล้ว","E4 Domain Skills & Org DNA",Done,Medium,org-dna;ux,v0.18.6,2026-06-29,"มี Org DNA แล้ว AI ข้ามคำถามพื้นฐาน (เช่น 'ธุรกิจทำเกี่ยวกับอะไร') ไปถามรายละเอียดของระบบที่จะสร้างเลย · เพิ่มไอคอนแมวเคลื่อนไหวตอน AI ทำงาน"
Story,"ปุ่ม Org DNA ใน Studio — ดู/ผูก DNA ของ workspace ได้เลย","E4 Domain Skills & Org DNA",Done,Medium,org-dna,v0.18.0,2026-06-29,"เปิดดู 4 ฐานราก + archetype + ความครบ % และคลิก 📎 ดูที่มาในข้อมูลต้นฉบับ · ผูก/เปลี่ยน/เอา workspace ออกจากใน Studio ได้ทันที"
Story,"เก็บประวัติเวอร์ชัน Org DNA","E4 Domain Skills & Org DNA",Done,Medium,org-dna,v0.16.2,2026-06-29,"ทุกครั้งที่ AI ร่าง Org DNA เก็บเป็นเวอร์ชัน — ดูย้อนหลังและกู้คืนได้ (การกู้คืนก็ย้อนกลับได้อีก)"
Story,"แชต AI อ้างอิง Org DNA ได้ (ชิป + ไฮไลต์ต้นฉบับ)","E4 Domain Skills & Org DNA",Done,Medium,org-dna,v0.16.1,2026-06-29,"มีชิป 'อ้างอิง Org DNA' ใต้ข้อความ บอกว่าใช้ด้านไหน (Decision Rights/Structure/…) คลิกเปิดดูข้อความต้นฉบับพร้อมไฮไลต์"
Story,"Org DNA อ้างอิงแหล่งข้อมูลได้ (แบบ NotebookLM)","E4 Domain Skills & Org DNA",Done,High,org-dna,v0.16.0,2026-06-29,"เก็บข้อมูลดิบที่ผู้ใช้ให้ไว้เป็นแหล่งอ้างอิง — แต่ละฐานรากแสดง 📎 ว่าสกัดมาจากข้อความไหน คลิกดูต้นฉบับพร้อมไฮไลต์ · ตอน generate พ่วงที่มาให้ AI ด้วย"
Story,"Workspaces + Org DNA — สร้างให้เข้ากับองค์กรของคุณ","E4 Domain Skills & Org DNA",Done,Highest,org-dna;workspace,v0.14.0,2026-06-29,"จัดกลุ่มโปรเจกต์เป็น workspace + ใส่ DNA องค์กร (4 ฐานราก + archetype 1 ใน 7) ให้ AI ออกแบบ spec/demo ตามวิธีทำงานจริง · มีตัวช่วย AI ร่างจากข้อมูล freeform + แถบความครบถ้วน · เลือก workspace ได้จากกล่อง brief · AI ใส่รูป/วิดีโอตาม URL ใน brief ได้แล้ว"
Story,"แอดมินสร้าง Skill Template เองได้","E4 Domain Skills & Org DNA",Done,Medium,skills;admin,v0.7.0,2026-06-23,"สร้าง/แก้โดเมนใหม่ที่ /admin/skills (ฟอร์มครบ + ตัวสร้างคำถาม) · โดเมนที่เผยแพร่แล้วโผล่ใน dropdown และระบบเดาโดเมนอัตโนมัติ · เพิ่มโดเมนได้โดยไม่ต้อง deploy ใหม่"
Story,"AI Skill Templates เฉพาะโดเมน (ERP/CRM/E-commerce/Dashboard/จอง/Landing)","E4 Domain Skills & Org DNA",Done,High,skills,v0.6.0,2026-06-22,"เลือกประเภทของ demo แล้ว AI สวมบทผู้เชี่ยวชาญโดเมนนั้น · ERP ลึกพิเศษ (PR→PO→GR→อนุมัติ + ข้อมูลตัวอย่างสมจริง) · AI เดาโดเมนอัตโนมัติ · prompt ยาวได้ถึง 10000 ตัวอักษร"
Story,"FITT Consult — ที่ปรึกษาธุรกิจแยกเป็นระบบของตัวเอง + ตรวจสุขภาพ 5 ด้าน","E5 FITT Consult (ที่ปรึกษาธุรกิจ)",Done,High,consult,v0.43.0,2026-07-24,"ระบบใหม่: landing /consult (ธีมขาว liquid-glass) + แอป /consult/app — วางข้อมูลจริง (ข้อความ/ไฟล์ รวม Excel) แล้วเลือกเลนส์ 'หา Pain Point' หรือ 'ตรวจสุขภาพธุรกิจ' · Health Check 5 ด้าน: กระแสเงินสด · โครงสร้างกำไรแยกส่วนลด · ยอดขาย · หนี้สิน-ลูกหนี้ · คนและพลังองค์กร พร้อมคะแนน สถานะ และอ้างอิงที่มา · เก็บผลเป็นประวัติของทีมทุกครั้ง เทียบรอบก่อนได้ · alpha เห็นเฉพาะ admin"
Story,"ผล Pain Point เป็นของกลาง — ทั้งทีมเห็นเหมือนกัน","E5 FITT Consult (ที่ปรึกษาธุรกิจ)",Done,Medium,consult,v0.34.0,2026-07-15,"ผลวิเคราะห์ล่าสุดเก็บเข้า workspace (ไม่ใช่แค่เครื่องเดียว) — สมาชิกทุกคนเห็นผลเดียวกันพร้อมเวลาอัปเดต · ใครกดวิเคราะห์ใหม่ก็ทับให้ทุกคน"
Bug,"ผล Pain Point ที่เก็บไว้เดิมทำหน้าค้าง","E5 FITT Consult (ที่ปรึกษาธุรกิจ)",Done,High,consult,v0.33.2,2026-07-14,"ผลที่เก็บก่อนอัปเดต (ยังไม่มีรายการ pain point/ที่มา) ทำให้หน้า workspace error ตอนโหลด — normalize ข้อมูลเก่าตอนกู้คืน ไม่ต้องวิเคราะห์ใหม่"
Story,"Pain Point อ้างอิงที่มาได้ (คลิกดูจากข้อมูลจริง)","E5 FITT Consult (ที่ปรึกษาธุรกิจ)",Done,Medium,consult,v0.33.1,2026-07-14,"แต่ละ Pain Point มีโควตข้อความจริงจากข้อมูลที่ให้มา คลิกเปิดดูที่มาพร้อมไฮไลต์ (ใช้ตัวดูแหล่งข้อมูลเดียวกับ Org DNA) · มีป้ายระดับความรุนแรง วิกฤต/สูง/กลาง/ต่ำ"
Task,"แหล่งข้อมูลเดียว: ร่าง Org DNA + หา Pain Point จากที่เดียว","E5 FITT Consult (ที่ปรึกษาธุรกิจ)",Done,Medium,consult;org-dna,v0.33.0,2026-07-14,"ยุบให้เหลือกล่องข้อมูลเดียวแล้วเลือกได้ทั้ง 'ร่าง Org DNA' และ 'หา Pain Point' ไม่ต้องวางข้อมูลซ้ำสองที่ · ผลแสดงเป็น Markdown อ่านง่าย + การ์ดอนุมัติ Human-in-the-Loop"
Task,"Pain Point Radar: อัปโหลดไฟล์เป็นเสียงได้","E5 FITT Consult (ที่ปรึกษาธุรกิจ)",Done,Medium,consult,v0.32.1,2026-07-14,"รับ input ได้เหมือนกล่องร่าง Org DNA — วางข้อความหรืออัปโหลดไฟล์ (PDF/รูป/เอกสาร เช่น export tickets, รีวิว, ผลสำรวจ) สูงสุด 5 ไฟล์"
Story,"Pain Point Radar — เรดาร์ปัญหาองค์กร (สไลซ์แรกของ Advisor)","E5 FITT Consult (ที่ปรึกษาธุรกิจ)",Done,High,consult,v0.32.0,2026-07-14,"วางเสียงจริง (คำบ่นลูกค้า/ฟีดแบ็กพนักงาน/รีวิว) แล้ว AI วิเคราะห์: อ่านอารมณ์ → จัดกลุ่ม MECE → 5 Whys → เสนอทางเลือกให้คนเคาะ ผูกกับ Org DNA · ผลเป็นบทสรุปผู้บริหาร ไม่มี JSON ดิบ · ทุกตัวเลขกำกับ 'ประมาณการ'"
Story,"เชิญทีมเข้า workspace — สมาชิกเห็นทุกโปรเจกต์ร่วมกัน","E6 Workspace, Members & Sharing",Done,High,workspace,v0.23.0,2026-07-13,"แผง 'สมาชิก workspace' เชิญด้วยอีเมล (ผู้ดูแล/สมาชิก) — คนที่เข้าร่วมเห็นและทำงานกับทุกโปรเจกต์ใน workspace อัตโนมัติ ไม่ต้องแชร์ทีละโปรเจกต์ พร้อมแชร์ Org DNA · ลิงก์คำเชิญแสดงชื่อ workspace + บทบาทก่อนตอบรับ · ผู้ดูแลเปลี่ยนบทบาท/เอาออก/ยกเลิกคำเชิญได้"
Story,"กล่องคำเชิญในแอป — กดรับได้เลยไม่ต้องรออีเมล","E6 Workspace, Members & Sharing",Done,High,workspace;invites,v0.28.0,2026-07-14,"มีตัวเลขแจ้งเตือนบนชิปบัญชี + การ์ด 'คำเชิญ' ในเมนูบัญชี พร้อมปุ่มเข้าร่วม — กดแล้วพาไปโปรเจกต์/workspace นั้นทันที (สำคัญมากตอนอีเมลยังส่งไม่ได้)"
Bug,"workspace 'พื้นที่ของฉัน' ซ้ำโผล่มาเอง + โปรเจกต์ย้ายเข้า org เอง","E6 Workspace, Members & Sharing",Done,High,workspace,v0.27.1,2026-07-13,"ต้นตอ: migration 0012 สร้าง workspace ใหม่ + กวาดโปรเจกต์เข้า org ทุกครั้งที่รัน · แก้ให้สร้าง default เฉพาะคนที่ยังไม่มี workspace และไม่ย้ายโปรเจกต์อัตโนมัติอีก"
Task,"เก็บกวาด workspace 'พื้นที่ของฉัน' ซ้ำที่ค้างอยู่","E6 Workspace, Members & Sharing",Done,Medium,workspace;cleanup,v0.27.2,2026-07-14,"ลบเฉพาะอันที่ว่างจริง (ไม่มีโปรเจกต์/สมาชิก/คำเชิญ และไม่ใช่อันเก่าสุด) — ไม่มีข้อมูลสูญ"
Story,"ลิงก์แชร์สาธารณะหมดอายุใน 30 วัน (แพลนฟรี)","E6 Workspace, Members & Sharing",Done,Medium,sharing,v0.25.0,2026-07-13,"ลิงก์ 'ใครมีลิงก์ก็เข้าได้' ของแพลนฟรีหมดอายุใน 30 วัน (คำเชิญอีเมล 14 วันเหมือนเดิม) · หน้าต่างแชร์บอกวันหมดอายุ + ปุ่มต่ออายุ 30 วันโดยไม่เปลี่ยนลิงก์เดิม"
Story,"สร้าง workspace แบบมีตัวตน + อัปโหลดไฟล์ร่าง Org DNA","E6 Workspace, Members & Sharing",Done,Medium,workspace,v0.15.0,2026-06-29,"Modal สร้าง workspace: ตั้งชื่อ + เลือกสี/ไอคอน แสดงใน dropdown และหน้า workspace · หน้า Org DNA อัปโหลดไฟล์ (PDF/รูป/เอกสาร) ให้ AI อ่านแล้วร่างให้ · แก้สี/ไอคอน/ชื่อได้ภายหลัง"
Bug,"หน้าเชิญทีมโหลดสมาชิก/คำเชิญไม่ขึ้น","E6 Workspace, Members & Sharing",Done,High,sharing,v0.12.1,2026-06-25,"หน้า 'เชิญทีม' ขึ้น 'โหลดข้อมูลไม่สำเร็จ' และไม่แสดงสมาชิก/คำเชิญทั้งที่มีอยู่ — แก้การดึงรายชื่อสมาชิกพร้อมอีเมล"
Story,"แชททีมเด้งให้เห็น + แท็กเพื่อนด้วย @","E7 Collaboration & Team Chat",Done,High,collab;chat,v0.40.0,2026-07-22,"พิมพ์ @ เพื่อแท็กสมาชิก มีรายชื่อขึ้นให้เลือก (ลูกศร/Enter หรือคลิก) ชื่อที่ถูกแท็กไฮไลต์สีฟ้า คนที่ถูกแท็กได้แจ้งเตือนพิเศษ 📣 · ปุ่มแชทเรืองแสงจนกว่าจะเปิดอ่าน + เอฟเฟกต์ particle 1 ครั้ง + toast แสดงชื่อผู้ส่ง (เคารพ reduced-motion)"
Bug,"@tag ไม่ขึ้นรายชื่อ + ลิงก์ GIF/รูปไม่แสดงเป็นรูป","E7 Collaboration & Team Chat",Done,High,collab;chat,v0.41.1,2026-07-22,"เพื่อนที่เข้ามาแค่อนุมัติขั้น (ยังไม่เคยพิมพ์) ไม่อยู่ทั้งในสมาชิกโปรเจกต์และประวัติแชท จึงไม่ขึ้นในรายชื่อ @ — ดึงจาก workspace roster มารวม และถ้ารายชื่อว่างจะบอกตรงๆ · วางลิงก์รูป/GIF แล้วแสดงเป็นรูปจริง คลิกดูเต็มจอได้"
Task,"เห็นชัดขึ้นเมื่อเพื่อนร่วมทีมแก้โปรเจกต์แบบเรียลไทม์","E7 Collaboration & Team Chat",Done,Medium,collab,v0.27.0,2026-07-13,"เดิมจอเปลี่ยนเองเงียบๆ ไม่รู้ว่าใครแก้ — เพิ่มข้อความ '🔄 <ชื่อ> อัปเดตโปรเจกต์' ทำงานร่วมกับ presence และ live cursor"
Task,"แจ้งการอนุมัติ + การส่งไป Code Runner ในห้องแชททีม","E7 Collaboration & Team Chat",Done,Medium,collab;phases,v0.21.1,2026-07-01,"โพสต์ '✅ <ชื่อ> อนุมัติขั้น …' ทุกครั้งรวมถึงโปรเจกต์คนเดียว (เดิมเฉพาะที่แชร์) · โพสต์ '🚀 ส่ง build ไป Code Runner — build #N · branch …' เป็นหลักฐานร่วมกัน"
Story,"เห็นเคอร์เซอร์ของเพื่อนร่วมทีมแบบเรียลไทม์","E7 Collaboration & Team Chat",Done,Medium,collab,v0.13.0,2026-06-25,"Live cursors ทั่ว Studio พร้อมชื่อและสีประจำตัว — รวมถึงบนตัว prototype ที่กำลังรัน"
Story,"แจ้งเตือนทั่วระบบ + ลากวางไฟล์ + แชททีมแบบ messenger","E7 Collaboration & Team Chat",Done,High,collab;ux,v0.12.0,2026-06-25,"ระบบ toast ทั่วเว็บ (สำเร็จ/กำลังทำ/ผิดพลาด) · ลากรูป/ไฟล์มาวางในแชต AI และห้องแชททีม พร้อมอนิเมชันจุดวางและ skeleton · แชททีม: reply, รีแอกชันอีโมจิ, ลบข้อความตัวเอง แบบเรียลไทม์"
Story,"แชต AI อ่านรูป/ไฟล์ได้ + เห็นว่าใครกำลังคุยกับ AI","E7 Collaboration & Team Chat",Done,High,collab;attachments,v0.11.0,2026-06-25,"แนบรูป/ไฟล์ในแชต AI เช่นแคปหน้าจอ prototype แล้วบอกให้แก้ตรงนี้ · AI สรุปว่าไฟล์เกี่ยวกับโปรเจกต์อย่างไรและเสนอเพิ่มลง BRD/PRD · เห็นว่าใครกำลังพิมพ์/สั่ง AI แบบเรียลไทม์"
Story,"ห้องแชททีม + สิทธิ์ผู้ชม/ผู้แก้ไข + บันทึกการอนุมัติ","E7 Collaboration & Team Chat",Done,High,collab;chat,v0.10.0,2026-06-25,"ห้องแชทประจำโปรเจกต์แยกจากแชท AI ส่งรูป/ไฟล์ได้ พร้อมแจ้งเตือนที่ยังไม่อ่าน · ตัวบอก 'กำลังพิมพ์…' · log การอนุมัติแต่ละเฟส · แยกสิทธิ์ viewer/editor · แก้การอนุมัติค้างที่นับ viewer เป็นผู้อนุมัติ"
Story,"ทำงานร่วมกันแบบเรียลไทม์ + สร้างเบื้องหลัง + ส่งออกโปรเจกต์","E7 Collaboration & Team Chat",Done,Highest,collab;export,v0.9.0,2026-06-25,"เห็นข้อความ/การแก้ไขของเพื่อนทันที + presence · สร้างเบื้องหลังแล้วสลับหน้าได้ งานเดินต่อและดึงผลกลับอัตโนมัติ · ปุ่ม Export เป็น .zip หรือสเปกสำหรับ FITTCORE V2 · หน้าตอบรับคำเชิญ · ดีไซน์ Liquid Glass + หน้า login split-screen · อัปเกรดเป็น gemini-3.5-flash"
Story,"คลังไฟล์ของโปรเจกต์ — เลือกไฟล์เดิมจากแชทมาใช้ซ้ำ","E8 Projects & LaunchPad",Done,Medium,projects;attachments,v0.41.0,2026-07-22,"ปุ่ม 🕘 ข้างปุ่มแนบไฟล์ — เปิดดูไฟล์ทั้งหมดที่เคยแนบในโปรเจกต์ (ทั้งของ AI และห้องแชททีม) แล้วคลิกใช้ซ้ำได้ทันที · ไฟล์ที่แนบถูกเก็บเข้าคลังอัตโนมัติ (เดิมหายหลังส่ง) สิทธิ์ตามสมาชิกโปรเจกต์"
Bug,"แนบไฟล์ Excel แล้ว AI อ่านข้อมูลได้จริง","E8 Projects & LaunchPad",Done,High,attachments,v0.39.0,2026-07-22,"โมเดลอ่าน .xlsx แบบ binary ไม่ได้ — ระบบแปลงเป็นตาราง CSV อัตโนมัติตั้งแต่ตอนแนบทุกจุด (แชท/กล่องหน้าแรก/Org DNA) สูงสุด 1000 แถวต่อชีต รองรับหลายชีต สูตรใช้ค่าผลลัพธ์ · .xls บอกวิธีแก้ชัดๆ แทนที่จะเงียบ"
Story,"แนบไฟล์ตั้งแต่หน้าแรก · default workspace · รู้ว่าใครสร้างโปรเจกต์ที่แชร์","E8 Projects & LaunchPad",Done,High,projects,v0.38.0,2026-07-22,"กล่องไอเดียหน้าแรกแนบไฟล์ได้ (📎 รูป/PDF/เอกสาร ≤5 ไฟล์ ไฟล์ละ ≤4MB) ใช้ประกอบการทำ BRD ตั้งแต่ 'สร้างเลย' · ปุ่ม ★ ตั้ง workspace เป็นค่าเริ่มต้น · รายการ 'แชร์กับฉัน' แสดงชื่อคนสร้าง (เดิมมีแค่วันที่)"
Bug,"ออกจากหน้า Builder เร็วๆ หลัง gen แล้วงานหาย","E8 Projects & LaunchPad",Done,Highest,projects;data-loss,v0.35.2,2026-07-16,"การบันทึกอัตโนมัติหน่วง 800ms — ออกจากหน้าในช่วงนั้นพอดีทำให้ตัวจับเวลาถูกยกเลิกโดยไม่ได้บันทึก ไฟล์ที่เพิ่งสร้างหาย · ตอนนี้ flush การบันทึกที่ค้างก่อนออกจากหน้าทุกครั้ง"
Bug,"เลือก 'ส่วนตัว' ตอนสร้างโปรเจกต์ได้","E8 Projects & LaunchPad",Done,Medium,projects,v0.15.2,2026-06-29,"dropdown workspace มีตัวเลือก 'ส่วนตัว (ไม่ใช้ workspace)' และเป็นค่าเริ่มต้น — โปรเจกต์ใหม่ไม่ถูกยัดเข้า workspace อัตโนมัติอีก"
Task,"ผลงานจัดเป็นโฟลเดอร์ตาม workspace","E8 Projects & LaunchPad",Done,Medium,projects,v0.15.1,2026-06-29,"ไซด์บาร์จัดกลุ่มเป็นโฟลเดอร์: 'ส่วนตัว' + โฟลเดอร์ของแต่ละ workspace (มีสี/ไอคอน) พับ-กางได้"
Bug,"ล็อกอินจาก localhost/UAT เด้งไป production","E9 Auth & Account",Done,Highest,auth,v0.30.1,2026-07-14,"เดิมส่ง URL ปลายทางแบบมี ?next= ซึ่งไม่ตรง allow-list ของ Supabase ทุก environment จึงเด้งกลับ production · เปลี่ยนเป็น callback URL แบบตรงเป๊ะแล้วพา next ผ่าน cookie ชั่วคราว (พร้อมกัน open-redirect)"
Story,"บัญชีผู้ใช้ + เก็บงานบนคลาวด์ + แชร์ทีม","E9 Auth & Account",Done,Highest,auth;sharing,v0.5.0,2026-06-22,"เข้าสู่ระบบด้วย Google หรือ magic link + เมนูบัญชี · โปรเจกต์เก็บบนคลาวด์ เปิดต่อข้ามเครื่องได้ · หน้า 'ผลงานของฉัน' แยกงานของฉัน/แชร์กับฉัน · แชร์ด้วยลิงก์หรือเชิญทางอีเมล (viewer/editor) ส่งอีเมลจริง · หน้า 'มีอะไรใหม่'"
Story,"โควตาสร้างเดโมแพลนฟรี 5 ครั้ง/เดือน","E10 Admin, Usage & Quota",Done,Medium,quota,v0.24.0,2026-07-13,"เช็คโควตาก่อนเรียก AI ถ้าครบจะบอกชัดว่ารีเซ็ตต้นเดือนหน้า (นับเฉพาะ kind=generate ต่อผู้ใช้ต่อเดือน) · ชิป 'เหลือ N/5' บนแถบบน เปลี่ยนสีเหลือง/แดงเมื่อใกล้หมด"
Story,"แดชบอร์ดการใช้ AI: กราฟ + อันดับผู้ใช้พร้อมรูปโปรไฟล์","E10 Admin, Usage & Quota",Done,Medium,admin,v0.17.0,2026-06-29,"กราฟ tokens รายวัน 14 วัน, แท่งแยกตามชนิดการเรียก, อันดับผู้ใช้ที่ใช้สูงสุดพร้อมรูปโปรไฟล์และค่าใช้จ่าย"
Bug,"กราฟ tokens รายวันไม่ขึ้น + sidebar แสดงแค่ workspace แรก","E10 Admin, Usage & Quota",Done,Medium,admin,v0.17.1,2026-06-29,"แท่งกราฟสูง 0 เพราะคอลัมน์ไม่มีความสูงอ้างอิง · Sidebar หน้าตั้งค่าแสดง workspace ทั้งหมดให้สลับ Org DNA ได้ พร้อมปุ่มสร้างใหม่"
Task,"รวมหน้าตั้งค่าไว้ที่เดียว + หน้าต่างแหล่งข้อมูลอ่านง่ายขึ้น","E10 Admin, Usage & Quota",Done,Low,admin;ux,v0.16.3,2026-06-29,"Org DNA / จัดการ Skill / รายงานการใช้ AI ย้ายมาอยู่ใต้ sidebar เดียวกัน · หน้าต่าง citation ใหญ่ขึ้นและเลื่อนไปยังข้อความที่อ้างอิงอัตโนมัติ"
Task,"หน้าตั้งค่าเต็มจอ + sidebar ค้างที่เดิม","E10 Admin, Usage & Quota",Done,Low,admin;ux,v0.16.4,2026-06-29,"Sidebar ค้างตาม viewport ปุ่ม 'กลับหน้าแรก' เห็นตลอด · เนื้อหา/ตารางเต็มความกว้าง · รายงานแยกหมวด 'ร่าง Org DNA (AI)' เป็นชนิดของตัวเอง"
Story,"ส่งงานเข้า Code Runner ผ่าน Gateway (/v1/ingest)","E11 Integration — FITT Code Runner",Done,High,integration,v0.35.0,2026-07-15,"เปลี่ยนจากยิงตรงเข้า Runner มาเป็นผ่าน Gateway /v1/ingest แนบ X-API-Key (server-side เท่านั้น) + Idempotency-Key จากแฮชเนื้อ zip (ส่งต้นแบบเดิมซ้ำไม่สร้างงานซ้ำ) · กันพลาดก่อนส่ง: zip ≤25MB, prompts ≤500, BRD/PRD ≤400KB, ตรวจ integrity · จับ error จาก Gateway ให้ชัด"
Story,"ป้ายสถานะถาวร 'ส่ง Code Runner แล้ว · build #N' บน TopBar","E11 Integration — FITT Code Runner",Done,Medium,integration,v0.22.0,2026-07-01,"ชิปเขียว '🚀 Code Runner #N' เก็บลง DB (runner_last) จึงอยู่ถาวรไม่หายเมื่อรีเฟรช และเพื่อนร่วมทีมที่เปิดโปรเจกต์เดียวกันก็เห็น (hover ดู build/branch/เวลา/ช่องทาง)"
Story,"ส่งไป Code Runner เป็น zip + idea/brd/prd แยก + tag alpha-test","E11 Integration — FITT Code Runner",Done,Medium,integration,v0.19.0,2026-06-30,"บีบอัดทั้งโปรเจกต์เป็น zip (base64) ก้อนเดียวแทน array ของไฟล์ · ส่ง idea/brd/prd เป็น field top-level เพื่อให้ CRN ประกอบ build prompt ได้โดยไม่ต้องแตก zip · ติด tag alpha-test + ปุ่มดู body (JSON) ก่อนส่ง"
Task,"โลโก้ใหม่ FITT Builder ทั้งเว็บ","E12 Design System & Brand",Done,Medium,design;brand,v0.42.0,2026-07-22,"ใช้โลโก้ F นีออนทุกจุด — favicon/ไอคอนแท็บ (รวม Apple touch icon), หน้าแรก, login, หน้ารับคำเชิญ, แถบบนสตูดิโอ, เมนูบัญชี"
Task,"จัดแถบบนสตูดิโอให้โล่งขึ้น","E12 Design System & Brand",Done,Low,design,v0.35.1,2026-07-16,"ย้าย action รอง (Spec · npm package · คัดลอกลิงก์แชร์ · เชิญทีม) เข้าเมนู '⋯ เพิ่มเติม' และย่อชิปผู้เชี่ยวชาญที่ยาวให้เหลือไอคอน · คงตัวหลักไว้: Preview/Code · Undo · สถานะ · Export"
Task,"หน้ารอที่มีประโยชน์ + เกลียว DNA เคลื่อนไหว","E12 Design System & Brand",Done,Low,design,v0.18.2,2026-06-29,"หน้า preview ระหว่างรอเปลี่ยนเป็น preloader + การ์ดหมุนบอกว่า FITT ทำอะไรได้บ้าง · เรียกข้อมูลที่เคยใช้ร่าง Org DNA กลับมาให้ในกล่อง (เดิมหายเมื่อปิดหน้า) · ไอคอนเกลียว DNA ชัดขึ้น"
Task,"loader หน้ารอเป็นภาพ 'Building Page' ที่ขยับได้จริง","E12 Design System & Brand",Done,Low,design,v0.18.4,2026-06-29,"ใช้ SMIL ที่ขยับได้ใน <img> ตรงๆ พื้นโปร่งใสกลืนธีมเข้ม ไม่ต้องพึ่ง <object>/script และไม่ติด COEP (แทน v0.18.3 ที่ยังต้องใช้ <object>)"
Task,"badge Org DNA เป็นเกลียว DNA เคลื่อนไหว","E12 Design System & Brand",Done,Low,design,v0.18.1,2026-06-29,"ไอคอนบนปุ่ม Org DNA เป็น double-helix เคลื่อนไหว (CSS ล้วน) สีตาม workspace · ปิดอัตโนมัติเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว"
Task,"Modal ยืนยันของระบบ + ไม่มี workspace เริ่มต้น","E12 Design System & Brand",Done,Medium,design;workspace,v0.14.1,2026-06-29,"เปลี่ยนกล่องยืนยัน/ลบทั้งหมดเป็น modal ของระบบ (ลบโปรเจกต์/ไฟล์/skill/workspace, สร้างเว็บใหม่จากเอกสาร) เลิกใช้ป็อปอัปเบราว์เซอร์ · ลบ workspace หมดแล้วไม่มีอันใหม่โผล่มาเอง"
Story,"ธีม Light/Dark + AI ช่วยสร้าง Skill + รายงานการใช้ AI + Express","E12 Design System & Brand",Done,Highest,design;skills;admin,v0.8.0,2026-06-24,"ธีม Light/Dark ทั้งระบบ (เริ่มต้นตามเครื่อง) สลับได้จากปุ่มกระจกลอย · AI ช่วยสร้าง Skill Template จาก URL หรือ Web search พร้อม thinking + รายงาน · หน้ารายงานการใช้ AI (admin) · โหมด Express: prompt ครบ → BRD → PRD → build อัตโนมัติ · อนุมัติหลายคน · ดู/แก้เอกสารจากในแชท · ดีไซน์ glass + อนิเมชันเลื่อนเข้า · แก้บั๊ก RLS สร้างโปรเจกต์ไม่ได้ และอื่นๆ"
Task,"อัปเกรดโมเดลเป็น gemini-3.6-flash","E13 Platform & Release",Done,Medium,platform;ai,v0.44.0,2026-07-30,"เปลี่ยน default model + ใส่ราคาจริง ($1.50 in / $7.50 out ต่อ 1M — output ถูกลงจาก $9.00) ให้รายงาน admin ไม่ประเมินเกิน + อัป _GEMINI_MODEL ทั้ง cloudbuild sandbox/production + แก้ตาราง env ใน README (commit 3cf1018)"
Task,"รองรับสเกลหลายเซิร์ฟเวอร์: rate limit แบบกระจายศูนย์ (Upstash)","E13 Platform & Release",Done,Medium,platform,v0.26.0,2026-07-13,"rate limiter รองรับ Upstash Redis — deploy หลายเครื่องนับคำขอจากที่เดียวร่วมกัน (เดิมต่างเครื่องต่างนับ จำกัดจริงหลวมกว่าที่ตั้ง) · ไม่ตั้งค่า Upstash ก็ใช้แบบในหน่วยความจำเหมือนเดิมอัตโนมัติ"
```

---

## 2) รายละเอียดรายเอปิก (ไว้อ่าน / สร้างมือ)

### E1 · Studio & Codegen — 6 issues
| Release | Issue | Type |
|---|---|---|
| v0.44.1 | [PROD] สั่งแก้แล้ว AI บอกว่าเรียบร้อย แต่ของจริงไม่เปลี่ยน | Bug · Highest |
| v0.44.0 | โค้ดที่ AI เขียนแตกเป็นโครงสร้างจริง | Story |
| v0.44.0 | AI ติดตั้งไลบรารีที่แนะนำเองได้ | Story |
| v0.40.1 | ไฟล์ที่แนบตอน "สร้างเลย" ไปถึงขั้นตอน build | Task |
| v0.36.0 | AI ถามกลับเมื่อคำสั่งกำกวม | Story |
| v0.18.9 · v0.18.5 | Action History / ข้อความบอกว่าพิมพ์เองได้ | Task |

### E2 · Preview & WebContainer — 2 issues
| Release | Issue | Type |
|---|---|---|
| v0.37.0 | ยกเครื่องปัญหา "จอขาว" (6 สาเหตุในรอบเดียว) | Story · Highest |
| v0.18.8 | พรีวิวค้างหน้า scaffold หลัง Build (StrictMode + ธง detached) | Bug |

### E3 · Phase Flow & Docs — 3 issues
v0.21.0 (ย้อนเฟส + ปุ่มสร้างรายงาน) · v0.20.1 (modal ยืนยันการอนุมัติ) · v0.20.0 (ผู้อนุมัติ + TopBar จอแคบ)

### E4 · Domain Skills & Org DNA — 13 issues
v0.31.0 Executive Co-pilot · v0.31.1 ซ่อน JSON · v0.30.2 ร่างไม่หาย · v0.30.0 Living Org DNA · v0.29.0 Skill Studio · v0.36.1 พาเนลค้าง · v0.18.7 ไฮไลต์อ้างอิง · v0.18.6 ไม่ถามซ้ำ · v0.18.0 ปุ่ม Org DNA ใน Studio · v0.16.2 ประวัติเวอร์ชัน · v0.16.1 ชิปอ้างอิงในแชท · v0.16.0 citation แบบ NotebookLM · v0.14.0 Workspaces + Org DNA · v0.7.0 แอดมินสร้าง Skill · v0.6.0 Skill Templates เฉพาะโดเมน

### E5 · FITT Consult — 7 issues
v0.43.0 แยกเป็นระบบ + Health Check 5 ด้าน · v0.34.0 ผลเป็นของกลาง · v0.33.2 ผลเก่าทำหน้าค้าง · v0.33.1 อ้างอิงที่มา · v0.33.0 แหล่งข้อมูลเดียว · v0.32.1 อัปโหลดไฟล์ · v0.32.0 Pain Point Radar

### E6 · Workspace, Members & Sharing — 7 issues
v0.23.0 เชิญทีมเข้า workspace · v0.28.0 กล่องคำเชิญในแอป · v0.27.1 workspace ซ้ำ · v0.27.2 เก็บกวาด · v0.25.0 ลิงก์หมดอายุ 30 วัน · v0.15.0 สร้าง workspace มีสี/ไอคอน · v0.12.1 หน้าเชิญทีมโหลดไม่ขึ้น

### E7 · Collaboration & Team Chat — 8 issues
v0.40.0 แท็ก @ + แชทเด้ง · v0.41.1 @tag ไม่ขึ้นรายชื่อ/GIF · v0.27.0 แจ้งเมื่อเพื่อนแก้ · v0.21.1 log อนุมัติ/Code Runner · v0.13.0 live cursors · v0.12.0 toast + drag-drop + messenger · v0.11.0 แชท AI อ่านรูป/ไฟล์ · v0.10.0 ห้องแชททีม + สิทธิ์ · v0.9.0 เรียลไทม์ + Export

### E8 · Projects & LaunchPad — 6 issues
v0.41.0 คลังไฟล์ · v0.39.0 Excel → CSV · v0.38.0 แนบไฟล์หน้าแรก + ★ default · v0.35.2 งานหายตอนออกเร็ว · v0.15.2 เลือก "ส่วนตัว" · v0.15.1 โฟลเดอร์ตาม workspace

### E9 · Auth & Account — 2 issues
v0.30.1 redirect ข้าม environment · v0.5.0 บัญชีผู้ใช้ + คลาวด์ + แชร์

### E10 · Admin, Usage & Quota — 5 issues
v0.24.0 โควตา 5 ครั้ง/เดือน · v0.17.0 แดชบอร์ดการใช้ AI · v0.17.1 กราฟไม่ขึ้น · v0.16.3 / v0.16.4 รวมหน้าตั้งค่า

### E11 · Integration — FITT Code Runner — 3 issues
v0.35.0 Gateway /v1/ingest · v0.22.0 ป้ายสถานะถาวร · v0.19.0 zip + tag alpha-test

### E12 · Design System & Brand — 7 issues
v0.42.0 โลโก้ใหม่ · v0.35.1 TopBar โล่ง · v0.18.2 หน้ารอ · v0.18.4 (+v0.18.3) loader SMIL · v0.18.1 badge DNA · v0.14.1 modal ระบบ · v0.8.0 ธีม light/dark + Express + รายงาน

### E13 · Platform & Release — 2 issues
v0.44.0 อัปโมเดล gemini-3.6-flash · v0.26.0 rate limit แบบกระจายศูนย์

---

## 3) Backlog — ยังไม่ได้ทำ (ใส่ Jira เป็น To Do ได้)

```csv
Issue Type,Summary,Epic Link,Status,Priority,Labels,Description
Task,"ย้าย secret ใน Cloud Build trigger ไป Secret Manager","E13 Platform & Release",To Do,High,security,"_GEMINI_API_KEY / _SUPABASE_SERVICE_ROLE_KEY / _FITTCORE_GATEWAY_API_KEY เก็บเป็น substitution ธรรมดา ใครมีสิทธิ์ดู Cloud Build อ่านค่าเต็มได้จาก UI และ build metadata ย้อนหลัง — เปลี่ยนเป็น availableSecrets ใน cloudbuild yaml"
Task,"จำกัดหน้า /consult และ /consult/app ให้ admin เท่านั้น (page gate)","E5 FITT Consult (ที่ปรึกษาธุรกิจ)",To Do,Medium,consult;security,"ตอนนี้ซ่อนแค่เมนู ถ้ารู้ URL ยังเข้าได้ระหว่างช่วง alpha"
Task,"ทดสอบ Business Health Check กับข้อมูลจริงแล้วจูน prompt","E5 FITT Consult (ที่ปรึกษาธุรกิจ)",To Do,High,consult;ai,"ยังไม่เคยรันกับงบการเงินจริงของลูกค้า — คาดว่าต้องปรับเกณฑ์คะแนนและถ้อยคำหลังรันจริงรอบแรก"
Task,"เปลี่ยนวิดีโอโรบอตหน้า /consult เป็นไฟล์ของเราเอง","E12 Design System & Brand",To Do,Low,consult;design,"ตอนนี้ยังใช้ CDN ของ blueprint ที่ลูกค้าให้มา"
Task,"ตัดสินใจเรื่องไฟล์ค้าง ProjectsDrawer.tsx (z-[60] → z-60)","E12 Design System & Brand",To Do,Low,tech-debt,"ยังไม่ commit — z-60 ไม่ใช่ utility มาตรฐานของ Tailwind ถ้าไม่ประกาศ scale ใน @theme เมนูอาจมุดไปหลัง overlay"
Task,"เปิดโควตาแพลนฟรีกลับ (ปิดไว้ชั่วคราวตั้งแต่ v0.36.0)","E10 Admin, Usage & Quota",To Do,Medium,quota,"ปิดไว้ระหว่างใช้งานภายใน เปิดกลับได้ด้วยสวิตช์เดียวเมื่อพร้อมเปิดให้บุคคลภายนอก"
```

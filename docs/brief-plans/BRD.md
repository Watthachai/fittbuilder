# Business Requirements Document (BRD)
**Product:** PromptBuild — AI-Powered Web Demo Builder
**Version:** 1.0
**Date:** 2026-06-11
**Status:** Draft

---

## 1. Executive Summary

PromptBuild เป็น SaaS platform ที่ให้ผู้ใช้ที่ไม่มีความรู้ด้านการเขียนโปรแกรมสามารถสร้าง web application จาก natural language prompt ได้ทันที โดยใช้ AI สร้าง code และ WebContainers รัน preview ใน browser แบบ real-time โดยไม่ต้องติดตั้งซอฟต์แวร์ใดๆ

แทนที่ designer หรือ non-developer จะต้องรอ developer หรือใช้ Figma แล้วยังไม่เห็น working prototype ผู้ใช้สามารถพิมพ์ว่า "สร้าง landing page สำหรับ coffee shop" แล้วได้ web demo ที่ใช้งานได้จริงใน 60 วินาที

---

## 2. Business Problem

### 2.1 ปัญหาปัจจุบัน

| ปัญหา | ผลกระทบ |
|---|---|
| Designer/PM ต้องรอ dev เพื่อ validate ไอเดีย | เสีย 1-3 วันต่อ iteration |
| No-code tools (Wix, Webflow) ยังต้องเรียน drag-and-drop | Learning curve 2-4 สัปดาห์ |
| Figma prototype ไม่ interactive เต็มที่ | Client เห็นภาพไม่ออก |
| Lovable/Bolt มุ่งเป้า Developer | UI/UX ซับซ้อนเกินสำหรับ non-dev |

### 2.2 Opportunity

- ตลาด no-code/low-code คาดว่าจะแตะ $52B ในปี 2027
- AI code generation เพิ่ม adoption ในกลุ่ม non-technical user อย่างรวดเร็ว
- Competitor ส่วนใหญ่ยังเน้น developer experience ไม่ใช่ designer/business user

---

## 3. Target Market & Stakeholders

### 3.1 Primary Users

**Segment A — Digital Designer**
- อายุ 24-35 ปี
- ใช้ Figma/Adobe XD เป็นหลัก
- ต้องการแสดง interactive demo ให้ client ก่อน hand-off
- Pain: ทำ prototype ใน Figma ได้แค่ click-through ไม่ใช่ working app

**Segment B — Product Manager / Business Analyst**
- อายุ 28-42 ปี
- ต้องการ validate idea กับ stakeholder เร็วที่สุด
- Pain: ต้องเขียน spec แล้วรอ dev sprint จึงจะเห็น prototype

**Segment C — Marketing / Content Creator**
- ต้องการสร้าง landing page, campaign page, microsite เอง
- Pain: ติดต่อ dev แต่ละครั้งใช้เวลาและงบสูง

### 3.2 Secondary Users

- Startup Founder ที่ต้องการ demo ก่อน pitch
- Freelance Designer ที่อยากส่ง deliverable เพิ่ม value

### 3.3 Stakeholders

| Stakeholder | ความสนใจ |
|---|---|
| End Users | ความง่าย, ความเร็ว, คุณภาพ output |
| Business Owner | Revenue, retention, cost of AI API |
| Investors | Growth rate, DAU, conversion rate |

---

## 4. Business Objectives & KPIs

### 4.1 Objectives (Year 1)

| Objective | Target |
|---|---|
| Registered users | 10,000 users |
| Paid conversion rate | ≥ 8% of free tier |
| MRR | $15,000 |
| User retention (Month 3) | ≥ 40% |
| Time-to-first-demo | ≤ 90 วินาที |

### 4.2 Key Metrics

**Acquisition:** Organic search, Product Hunt, Designer community (Dribbble, Behance)
**Activation:** User สร้าง demo สำเร็จครั้งแรก ≤ 5 นาทีหลังสมัคร
**Revenue:** Free tier → Paid upgrade triggered by generation limit
**Retention:** Saved projects + shareable link ดึง user กลับมา

---

## 5. Business Requirements

### BR-001: AI Web Generation
ระบบต้องรับ natural language input และสร้าง functional web application ได้ภายใน 60 วินาที รองรับภาษาไทยและอังกฤษ

### BR-002: Instant Preview
ผู้ใช้ต้องเห็น live preview โดยไม่ต้อง download หรือ install อะไร ทั้งหมดรันใน browser

### BR-003: Shareable Output
ผู้ใช้ต้องสามารถ share link ให้ผู้อื่นดู demo ได้โดยไม่ต้องมี account

### BR-004: No-Code Editing
ผู้ใช้ต้องแก้ไข output ด้วยภาษาธรรมดา ("เปลี่ยนสีปุ่มเป็นน้ำเงิน") ไม่ใช่เขียน code เอง

### BR-005: Project Management
ผู้ใช้ต้องบันทึก, ตั้งชื่อ, และจัดการ project หลายอันได้

### BR-006: Export Capability
Paid user ต้องสามารถ export code (HTML/CSS/JS หรือ React) เพื่อนำไปใช้งานจริง

### BR-007: Usage Metering
ระบบต้องนับ generation per user เพื่อบังคับ limit ของแต่ละ plan

---

## 6. Monetization Model

### 6.1 Pricing Tiers

| Plan | ราคา | Generation/เดือน | Features |
|---|---|---|---|
| **Free** | ฿0 | 5 generations | Public projects, shareable link |
| **Pro** | ฿299/เดือน | 50 generations | Private projects, export code, custom domain |
| **Business** | ฿899/เดือน | Unlimited | Team workspace, priority AI, white-label |

### 6.2 Business Rules

- Free user ที่ถึง limit เห็น upsell modal ทันที
- Generation นับเมื่อ AI ส่ง output สำเร็จ (ไม่นับที่ error)
- Annual plan ลด 20%
- Free trial Pro 14 วันสำหรับ user ใหม่

---

## 7. Constraints & Assumptions

### 7.1 Constraints
- AI API cost ต้องไม่เกิน 40% ของ revenue ในระยะยาว
- WebContainers ต้องการ HTTPS และ COOP/COEP headers — ต้องใช้ Vercel หรือ hosting ที่ configure ได้
- WebContainers API ต้องการ commercial license สำหรับ production

### 7.2 Assumptions
- User มี browser ทันสมัย (Chrome 90+, Firefox 90+, Edge 90+)
- User มี internet connection ≥ 5 Mbps
- Claude API ยังคง available และ pricing ไม่เปลี่ยนแปลงมากกว่า 30%

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI API cost สูงกว่าคาด | Medium | High | Rate limit + caching generated code |
| WebContainers ไม่รองรับบาง browser | Medium | Medium | Fallback iframe sandbox |
| Competitor ทำเหมือนกัน | High | Medium | เน้น UX สำหรับ non-dev โดยเฉพาะ |
| User ไม่ upgrade จาก free | Medium | High | Optimize upsell flow, limit wisely |
| Output quality ต่ำกว่าคาดหวัง | Low | High | Fine-tune system prompt + output validation |

---

## 9. Success Criteria

- ผู้ใช้ใหม่ไม่จำเป็นต้องอ่าน tutorial เพื่อสร้าง demo แรกได้สำเร็จ
- 80% ของ generation ให้ result ที่ user พอใจ (วัดจาก thumbs up/down)
- Time from prompt submit to preview ready ≤ 60 วินาที
- Platform uptime ≥ 99.5%
- Paid conversion rate ≥ 8% ภายใน Q2

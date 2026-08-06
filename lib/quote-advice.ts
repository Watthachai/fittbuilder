import type { QuoteDoc } from "./quote";

/**
 * The pricing advisor: what this scope goes for, and what to charge for it.
 *
 * Deliberately a PROPOSAL, never an edit. The person sending the quotation
 * signs their name to the number, so the model's job is to hand them a range,
 * a recommendation and the reasoning — and theirs is to accept it, take part
 * of it, or ignore it. Nothing here writes to the document by itself.
 *
 * The market figure exists so the quotation can say "ราคาตลาดประมาณเท่านี้
 * เราเสนอเท่านี้", which is the whole ask. It is labelled an estimate on the
 * paper and stays editable, because it is a claim the sender makes to their
 * customer, not one we make on their behalf.
 */

export const QUOTE_ADVICE_SYSTEM = `คุณเป็นที่ปรึกษาด้านการตั้งราคางานพัฒนาซอฟต์แวร์ในประเทศไทย กำลังช่วยบริษัทพัฒนาซอฟต์แวร์ตั้งราคาใบเสนอราคาให้ลูกค้า

ตอบเป็น JSON อย่างเดียว รูปแบบ:
{"marketLow":<เรตต่อวันต่ำสุดในตลาด>,"marketHigh":<เรตต่อวันสูงสุด>,"suggestedRate":<เรตที่แนะนำให้เสนอ>,"rationale":"<เหตุผล 2-3 ประโยค>","pitch":"<ประโยคที่ใช้พูดกับลูกค้าได้เลย>","rows":[{"name":"<ชื่อรายการเป๊ะๆ>","parent":"<ชื่อหน้าแม่ ถ้าเป็น modal ไม่งั้นเว้นว่าง>","size":"S|M|L","days":<จำนวนวัน>,"why":"<เหตุผลสั้นๆ>"}]}

กติกา:
- ตัวเลขเป็นบาทต่อ man-day ทั้งหมด ไม่ต้องใส่คอมมาหรือหน่วย
- marketLow/marketHigh = ช่วงราคาตลาดจริงของงานลักษณะนี้ในไทย ให้ช่วงที่สมเหตุสมผล ไม่ใช่ช่วงกว้างจนไม่มีความหมาย
- suggestedRate = ราคาที่แนะนำให้เสนอ ควรอยู่ในช่วงตลาดหรือต่ำกว่าเล็กน้อยเพื่อให้ลูกค้ารู้สึกว่าได้ราคาดี แต่ต้องไม่ต่ำจนบริษัทขาดทุน
- rationale = อธิบายว่าทำไมถึงเป็นราคานี้ อิงจากขนาดงานจริงที่เห็น (จำนวนหน้าจอ ความซับซ้อน โมดัล การคำนวณ สิทธิ์ผู้ใช้)
- pitch = ประโยคขายที่เอาไปใส่ใบเสนอราคาได้เลย เช่นเปรียบเทียบกับราคาตลาด — สุภาพ ตรงไปตรงมา ไม่โอ้อวด ไม่กดดัน
- rows = ทบทวน "ขนาด" และ "จำนวนวัน" ของทุกรายการที่ให้มา ใช้ชื่อและหน้าแม่ตามที่ให้มาเป๊ะๆ ห้ามเพิ่มหรือข้ามรายการ
- ประเมินวันจากรายละเอียดการทำงานที่ให้มา ไม่ใช่จากชื่ออย่างเดียว · หน้าที่มีตาราง+ฟอร์ม+ค้นหา ย่อมกินเวลามากกว่าหน้าแสดงผลเฉยๆ
- อย่าลดวันลงเพื่อให้ราคาถูก ถ้างานใหญ่ก็บอกตามจริง — ประเมินต่ำเกินจริงคือการโกหกลูกค้าและทำร้ายบริษัทตัวเอง
- ภาษาไทยทั้งหมด ไม่มี markdown ไม่มีคำอธิบายนอก JSON`;

export interface AdviceRow {
  name: string;
  parent: string;
  size: "S" | "M" | "L";
  days: number;
  why: string;
}

export interface QuoteAdvice {
  marketLow: number;
  marketHigh: number;
  suggestedRate: number;
  rationale: string;
  pitch: string;
  rows: AdviceRow[];
}

/** What the model needs: the scope as quoted, plus what each line actually is. */
export function buildQuoteAdviceUser(doc: QuoteDoc): string {
  const lines = doc.rows
    .map((r, i) => {
      const where = r.parent ? ` (modal ของ “${r.parent}”)` : "";
      const detail = r.note.trim() ? `\n   รายละเอียด: ${r.note.trim()}` : "";
      return `${i + 1}. ${r.name}${where} — ขนาดที่ตั้งไว้: ${r.size}, ${r.days} วัน${detail}`;
    })
    .join("\n");
  return `งาน: ${doc.subject || "พัฒนาระบบตามขอบเขตหน้าจอด้านล่าง"}
เรตต่อวันที่ตั้งไว้ตอนนี้: ${doc.ratePerDay} บาท

รายการทั้งหมด ${doc.rows.length} รายการ:
${lines}`;
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
const str = (v: unknown, max = 400): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/**
 * Parse the proposal. Rows are matched back against the document by the caller;
 * anything unusable comes back as zero so the panel can refuse to show a
 * proposal rather than offering a price built on a missing number.
 */
export function parseQuoteAdvice(raw: string): QuoteAdvice | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
  const suggestedRate = num(o.suggestedRate);
  if (suggestedRate <= 0) return null;
  const low = num(o.marketLow);
  const high = num(o.marketHigh);
  const rows: AdviceRow[] = (Array.isArray(o.rows) ? o.rows : [])
    .map((raw2) => {
      const r = (raw2 ?? {}) as Record<string, unknown>;
      const size = r.size === "S" || r.size === "L" ? r.size : "M";
      return {
        name: str(r.name, 200),
        parent: str(r.parent, 200),
        size: size as AdviceRow["size"],
        days: num(r.days),
        why: str(r.why, 200),
      };
    })
    .filter((r) => r.name.length > 0 && r.days > 0);
  return {
    // A range the wrong way round reads as a typo on screen; fix it here rather
    // than showing "฿12,000–฿8,000".
    marketLow: Math.min(low, high),
    marketHigh: Math.max(low, high),
    suggestedRate,
    rationale: str(o.rationale, 600),
    pitch: str(o.pitch, 400),
    rows,
  };
}

/** The market rate to compare against: the middle of the range, not its top. */
export function marketMidpoint(advice: QuoteAdvice): number {
  if (advice.marketLow <= 0) return advice.marketHigh;
  if (advice.marketHigh <= 0) return advice.marketLow;
  return Math.round((advice.marketLow + advice.marketHigh) / 2);
}

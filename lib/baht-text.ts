/**
 * An amount in words, as a Thai quotation, tax invoice or cheque writes it under
 * the total: 469,334 → "สี่แสนหกหมื่นเก้าพันสามร้อยสามสิบสี่บาทถ้วน". Matches Excel's
 * BAHTTEXT, which is what a customer's own quotation template uses.
 *
 * The demo kit (demo/modules/kit.tsx) carries the same function for the apps the
 * studio generates; those ship as standalone source and cannot import from here.
 */
const DIGITS = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

/** Below a million, read digit by digit; `tail` says a higher group came first, so a lone 1 is "เอ็ด". */
function readThai(n: number, tail = false): string {
  if (n === 0) return "";
  if (n >= 1_000_000) return readThai(Math.floor(n / 1_000_000)) + "ล้าน" + readThai(n % 1_000_000, true);
  const digits = String(n).split("").map(Number);
  let out = "";
  digits.forEach((d, i) => {
    const place = digits.length - i - 1;
    if (d === 0) return;
    if (place === 1 && d === 1) out += "สิบ";
    else if (place === 1 && d === 2) out += "ยี่สิบ";
    else if (place === 0 && d === 1 && (digits.length > 1 || tail)) out += "เอ็ด";
    else out += DIGITS[d] + PLACES[place];
  });
  return out;
}

export function bahtText(amount: number): string {
  const satangTotal = Math.round(Math.abs(amount) * 100);
  const baht = Math.floor(satangTotal / 100);
  const satang = satangTotal % 100;
  if (baht === 0 && satang === 0) return "ศูนย์บาทถ้วน";
  const bahtPart = baht > 0 ? readThai(baht) + "บาท" : "";
  return (amount < 0 ? "ลบ" : "") + bahtPart + (satang > 0 ? readThai(satang) + "สตางค์" : "ถ้วน");
}

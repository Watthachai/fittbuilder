/**
 * The company the whole demo system belongs to: one name, one address, one tax id.
 *
 * Every module prints under it — a tax invoice from sales, a receipt from
 * accounting, a purchase order from purchasing, a payslip from payroll. The same
 * company on all of them is the first thing an accountant checks. Four modules
 * once each wrote their own, and the receipt carried a different tax id from
 * the invoice it paid.
 */
export const COMPANY = {
  name: "บริษัท ตัวอย่างอุตสาหกรรม จำกัด",
  address: "99/9 อาคารตัวอย่างทาวเวอร์ ชั้น 12 ถนนรัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพมหานคร 10400",
  taxId: "0105561012345",
  branch: "สำนักงานใหญ่",
  phone: "02-123-4567",
  bank: "ธนาคารกสิกรไทย สาขารัชดาภิเษก บัญชีกระแสรายวัน เลขที่ 123-1-23456-7",
};

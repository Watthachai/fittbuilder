/** Seed for personnel records. Kept apart from the module so the screen file
 *  stays readable; both ship into the demo under the module's own directory. */
export const PA_DATA = `export const EMPLOYEES = [
  {
    id: 1, code: "EMP-0001", name: "สมชาย รักดี", nickname: "ชาย",
    position: "หัวหน้าฝ่ายขาย", department: "ฝ่ายขาย", status: "ทำงานอยู่",
    personal: { birthDate: "1985-02-14", nationalId: "1-1023-00456-12-3", phone: "081-234-5678", email: "somchai@example.co.th", address: "88/12 ซ.ลาดพร้าว 41 แขวงจันทรเกษม เขตจตุจักร กรุงเทพฯ 10900" },
    contract: { type: "พนักงานประจำ", startedAt: "2019-03-04", endsAt: null, probationUntil: "2019-06-04", baseSalary: 45000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "1234567890", taxId: "1102300456123", bankName: "กสิกรไทย", bankAccount: "xxx-x-x1234-5", pvdRate: 5 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 5%", "ค่าน้ำมันรถ 3,000/เดือน", "ตรวจสุขภาพประจำปี"],
    events: [
      { date: "2019-03-04", type: "รับเข้าทำงาน", detail: "ตำแหน่ง พนักงานขาย · เงินเดือน 22,000" },
      { date: "2021-01-01", type: "เลื่อนตำแหน่ง", detail: "พนักงานขาย → หัวหน้าฝ่ายขาย" },
      { date: "2021-01-01", type: "ปรับเงินเดือน", detail: "22,000 → 38,000" },
      { date: "2024-04-01", type: "ปรับเงินเดือน", detail: "38,000 → 45,000 (ประเมินประจำปี A)" },
    ],
  },
  {
    id: 2, code: "EMP-0002", name: "วิภาดา ศรีสุข", nickname: "ดา",
    position: "นักบัญชีอาวุโส", department: "ฝ่ายบัญชี", status: "ทำงานอยู่",
    personal: { birthDate: "1990-08-30", nationalId: "3-4011-00912-45-6", phone: "089-876-5432", email: "wipada@example.co.th", address: "45/7 ถ.พระราม 2 แขวงบางมด เขตจอมทอง กรุงเทพฯ 10150" },
    contract: { type: "พนักงานประจำ", startedAt: "2020-07-15", endsAt: null, probationUntil: "2020-10-15", baseSalary: 38000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "2345678901", taxId: "3401100912456", bankName: "ไทยพาณิชย์", bankAccount: "xxx-x-x5678-9", pvdRate: 5 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 5%", "ค่าวิชาชีพบัญชี 2,000/เดือน"],
    events: [
      { date: "2020-07-15", type: "รับเข้าทำงาน", detail: "ตำแหน่ง นักบัญชี · เงินเดือน 28,000" },
      { date: "2023-01-01", type: "เลื่อนตำแหน่ง", detail: "นักบัญชี → นักบัญชีอาวุโส" },
      { date: "2023-01-01", type: "ปรับเงินเดือน", detail: "28,000 → 38,000" },
    ],
  },
  {
    id: 3, code: "EMP-0003", name: "ณัฐพล ทองดี", nickname: "พล",
    position: "พนักงานคลังสินค้า", department: "ฝ่ายคลัง", status: "ทำงานอยู่",
    personal: { birthDate: "1996-11-02", nationalId: "1-5099-00223-88-1", phone: "092-345-6789", email: "nattapon@example.co.th", address: "12 หมู่ 4 ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540" },
    contract: { type: "พนักงานประจำ", startedAt: "2021-01-11", endsAt: null, probationUntil: "2021-04-11", baseSalary: 18000, workDays: "จันทร์–เสาร์" },
    admin: { ssoNumber: "3456789012", taxId: "1509900223881", bankName: "กรุงไทย", bankAccount: "xxx-x-x2468-1", pvdRate: 3 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 3%", "เบี้ยขยัน 800/เดือน"],
    events: [
      { date: "2021-01-11", type: "รับเข้าทำงาน", detail: "ตำแหน่ง พนักงานคลังสินค้า · เงินเดือน 15,000" },
      { date: "2023-04-01", type: "ปรับเงินเดือน", detail: "15,000 → 18,000" },
    ],
  },
  {
    id: 4, code: "EMP-0004", name: "ปรียา แก้วใส", nickname: "ยา",
    position: "เจ้าหน้าที่บุคคล", department: "ฝ่ายบุคคล", status: "ทำงานอยู่",
    personal: { birthDate: "1993-05-19", nationalId: "1-1005-00778-33-9", phone: "086-111-2233", email: "preeya@example.co.th", address: "9/99 คอนโดรัชดา ห้อง 1204 แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400" },
    contract: { type: "พนักงานประจำ", startedAt: "2022-05-02", endsAt: null, probationUntil: "2022-08-02", baseSalary: 25000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "4567890123", taxId: "1100500778339", bankName: "กสิกรไทย", bankAccount: "xxx-x-x3579-2", pvdRate: 5 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 5%"],
    events: [
      { date: "2022-05-02", type: "รับเข้าทำงาน", detail: "ตำแหน่ง เจ้าหน้าที่บุคคล · เงินเดือน 22,000" },
      { date: "2024-01-01", type: "ปรับเงินเดือน", detail: "22,000 → 25,000" },
    ],
  },
  {
    id: 5, code: "EMP-0005", name: "อนุชา มั่นคง", nickname: "ชา",
    position: "ช่างเทคนิค", department: "ฝ่ายผลิต", status: "ทดลองงาน",
    personal: { birthDate: "1999-01-25", nationalId: "1-7208-00334-55-7", phone: "094-555-6677", email: "anucha@example.co.th", address: "56 หมู่ 2 ต.หนองปรือ อ.บางละมุง จ.ชลบุรี 20150" },
    contract: { type: "สัญญาจ้าง 1 ปี", startedAt: "2023-09-18", endsAt: "2026-09-17", probationUntil: "2026-12-18", baseSalary: 21000, workDays: "จันทร์–เสาร์" },
    admin: { ssoNumber: "5678901234", taxId: "1720800334557", bankName: "กรุงเทพ", bankAccount: "xxx-x-x8642-0", pvdRate: 0 },
    benefits: ["ประกันสุขภาพกลุ่ม", "ค่ากะกลางคืน 300/กะ"],
    events: [
      { date: "2023-09-18", type: "รับเข้าทำงาน", detail: "ตำแหน่ง ช่างเทคนิค · สัญญา 1 ปี" },
      { date: "2026-09-18", type: "ต่อสัญญา", detail: "ต่ออีก 1 ปี ถึง 17 ก.ย. 2570" },
    ],
  },
  {
    id: 6, code: "EMP-0006", name: "กมลวรรณ ใจงาม", nickname: "กมล",
    position: "พนักงานขาย", department: "ฝ่ายขาย", status: "ทำงานอยู่",
    personal: { birthDate: "1997-07-07", nationalId: "1-1014-00556-77-2", phone: "083-777-8899", email: "kamonwan@example.co.th", address: "23/5 ซ.อ่อนนุช 17 แขวงสวนหลวง เขตสวนหลวง กรุงเทพฯ 10250" },
    contract: { type: "พนักงานประจำ", startedAt: "2024-02-01", endsAt: null, probationUntil: "2024-05-01", baseSalary: 22000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "6789012345", taxId: "1101400556772", bankName: "กสิกรไทย", bankAccount: "xxx-x-x1357-9", pvdRate: 3 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 3%", "คอมมิชชั่นตามยอดขาย"],
    events: [{ date: "2024-02-01", type: "รับเข้าทำงาน", detail: "ตำแหน่ง พนักงานขาย · เงินเดือน 22,000" }],
  },
  {
    id: 7, code: "EMP-0007", name: "ธีรศักดิ์ พูลทรัพย์", nickname: "ศักดิ์",
    position: "ผู้จัดการคลัง", department: "ฝ่ายคลัง", status: "ทำงานอยู่",
    personal: { birthDate: "1982-12-11", nationalId: "3-1009-00112-90-4", phone: "081-999-1122", email: "teerasak@example.co.th", address: "101/23 หมู่บ้านสีวลี ต.บางรักพัฒนา อ.บางบัวทอง จ.นนทบุรี 11110" },
    contract: { type: "พนักงานประจำ", startedAt: "2018-11-26", endsAt: null, probationUntil: "2019-02-26", baseSalary: 42000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "7890123456", taxId: "3100900112904", bankName: "ไทยพาณิชย์", bankAccount: "xxx-x-x2580-3", pvdRate: 5 },
    benefits: ["ประกันสุขภาพกลุ่ม", "กองทุนสำรองเลี้ยงชีพ 5%", "ค่าน้ำมันรถ 3,000/เดือน", "ประกันชีวิตกลุ่ม"],
    events: [
      { date: "2018-11-26", type: "รับเข้าทำงาน", detail: "ตำแหน่ง หัวหน้าคลัง · เงินเดือน 30,000" },
      { date: "2022-01-01", type: "เลื่อนตำแหน่ง", detail: "หัวหน้าคลัง → ผู้จัดการคลัง" },
      { date: "2022-01-01", type: "ปรับเงินเดือน", detail: "30,000 → 42,000" },
    ],
  },
  {
    id: 8, code: "EMP-0008", name: "สุนิสา เพชรงาม", nickname: "นิ",
    position: "เจ้าหน้าที่จัดซื้อ", department: "ฝ่ายจัดซื้อ", status: "ลาออก",
    personal: { birthDate: "1994-03-08", nationalId: "1-2098-00445-66-8", phone: "087-222-3344", email: "sunisa@example.co.th", address: "78/4 ถ.เพชรเกษม แขวงบางหว้า เขตภาษีเจริญ กรุงเทพฯ 10160" },
    contract: { type: "พนักงานประจำ", startedAt: "2023-04-10", endsAt: "2026-08-31", probationUntil: "2023-07-10", baseSalary: 24000, workDays: "จันทร์–ศุกร์" },
    admin: { ssoNumber: "8901234567", taxId: "1209800445668", bankName: "กรุงไทย", bankAccount: "xxx-x-x9753-1", pvdRate: 3 },
    benefits: ["ประกันสุขภาพกลุ่ม"],
    events: [
      { date: "2023-04-10", type: "รับเข้าทำงาน", detail: "ตำแหน่ง เจ้าหน้าที่จัดซื้อ · เงินเดือน 24,000" },
      { date: "2026-08-31", type: "ลาออก", detail: "ลาออกตามความสมัครใจ · คืนทรัพย์สินครบ" },
    ],
  },
];

export const EVENT_TYPES = ["รับเข้าทำงาน", "ย้ายแผนก", "เลื่อนตำแหน่ง", "ปรับเงินเดือน", "ต่อสัญญา", "ลาออก"];
`;

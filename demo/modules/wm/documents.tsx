import { material } from "../mm/data";
import { PaperFacts, PaperHead, PaperParty, PaperSignatures, PaperTable, thaiDate } from "../mm/documents";
import { Paper } from "../kit";
import { PICKS, WAREHOUSE, bin, storageType } from "./data";
import type { CountSheet } from "./data";

/**
 * The warehouse's two walking documents. Neither carries a price: the pick list
 * is the route a picker walks, in bin order, with a column for what was really
 * there; the count sheet is blind — it names the bin and the item but never the
 * quantity the system expects, or the count only confirms the system.
 */

export function PickListDocument({ docRef }: { docRef: string }) {
  const tasks = PICKS.filter((p) => p.ref === docRef).sort((a, b) => a.bin.localeCompare(b.bin));
  const gi = tasks.find((t) => t.gi)?.gi;
  return (
    <Paper>
      <PaperHead title="ใบหยิบสินค้า" sub="เรียงตามลำดับช่อง เดินรอบเดียว" />
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <PaperParty label="คลัง" name={`${WAREHOUSE.code} ${WAREHOUSE.name}`} lines={["ส่งของที่หยิบแล้วไปพักที่ SHP-01 พื้นที่จ่ายออก"]} />
        <PaperFacts
          rows={[
            ["เอกสารต้นเรื่อง", docRef],
            ["จำนวนงาน", `${tasks.length} รายการ`],
            ["ใบจ่ายสินค้า", gi ?? "—"],
          ]}
        />
      </div>
      <PaperTable
        columns={[
          { header: "ลำดับ", align: "center" },
          { header: "ช่องเก็บ" },
          { header: "งานหยิบ" },
          { header: "รหัส" },
          { header: "รายการ" },
          { header: "ต้องหยิบ", align: "right" },
          { header: "หน่วย" },
          { header: "หยิบได้จริง", align: "right" },
          { header: "ตรวจ", align: "center" },
        ]}
        rows={tasks.map((t, i) => [
          i + 1,
          `${t.bin} · ${storageType(bin(t.bin).type).name}`,
          t.no,
          t.material,
          material(t.material).name,
          t.qty.toLocaleString("th-TH"),
          material(t.material).unit,
          t.status === "รอหยิบ" ? "" : (t.picked ?? t.qty).toLocaleString("th-TH"),
          t.status === "รอหยิบ" ? "☐" : "☑",
        ])}
      />
      <p className="mt-3 leading-relaxed text-slate-600">หยิบได้ไม่ครบให้เขียนจำนวนจริงไว้ ห้ามหยิบจากช่องอื่นแทนโดยไม่แจ้งหัวหน้าคลัง</p>
      <PaperSignatures roles={["ผู้หยิบ", "ผู้ตรวจ", "ผู้รับของ"]} />
    </Paper>
  );
}

export function CountSheetDocument({ sheet }: { sheet: CountSheet }) {
  return (
    <Paper>
      <PaperHead title="ใบตรวจนับสินค้า" sub="นับจริงทุกช่อง ไม่แสดงยอดในระบบ" />
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
        <PaperParty label="รอบนับ" name={sheet.scope} lines={[`${WAREHOUSE.code} ${WAREHOUSE.name}`, `ผู้นับ ${sheet.counter}`]} />
        <PaperFacts rows={[["เลขที่", sheet.no], ["วันที่", thaiDate(sheet.date)], ["จำนวนช่อง", `${sheet.lines.length} ช่อง`]]} />
      </div>
      <PaperTable
        columns={[
          { header: "ลำดับ", align: "center" },
          { header: "ช่องเก็บ" },
          { header: "รหัส" },
          { header: "รายการ" },
          { header: "หน่วย" },
          { header: "จำนวนที่นับได้", align: "right" },
          { header: "หมายเหตุ" },
        ]}
        rows={sheet.lines.map((l, i) => [i + 1, l.bin, l.material, material(l.material).name, material(l.material).unit, "", ""])}
      />
      <PaperSignatures roles={["ผู้นับ", "ผู้ตรวจนับ", "ผู้จัดการคลัง"]} />
    </Paper>
  );
}

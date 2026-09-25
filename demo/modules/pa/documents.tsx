import { useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { FileCheck2, Printer } from "lucide-react";
import {
  COMPANY, LETTER_KINDS, PROBATION_DAYS, TODAY, baht, beYear, employeeOf, isActive, isFixedTerm, isPvdBenefit,
  issueLetter, letterErrors, nextLetterNo, thaiDate,
} from "./data";
import type { Employee, IssuedLetter, LetterKind, PersonnelAction } from "./data";
import { Button, Note } from "../ui";
import { FormModal, Paper, bahtText, money, notify, printDocument, useData } from "../kit";
import { OptionCards, TextInput } from "./parts";

/**
 * The letters HR hands over on paper: employment and salary certificates, the
 * employment contract, and the order that makes an approved transfer or raise
 * official. None of them carries a price list, so each lays out its own page
 * inside Paper, and printDocument() prints that page and nothing around it.
 */

/* ------------------------------------------------------------- the page */

function LetterHead({ right }: { right: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-800 pb-4">
      <div className="min-w-0">
        <p className="text-[16px] font-bold text-slate-900">{COMPANY.name}</p>
        <p className="mt-1 max-w-sm leading-relaxed text-slate-600">{COMPANY.address}</p>
        <p className="text-slate-600">เลขประจำตัวผู้เสียภาษี {COMPANY.taxId} · โทร {COMPANY.phone}</p>
      </div>
      <div className="text-right text-slate-700">{right}</div>
    </div>
  );
}

function Signatures({ lines }: { lines: string[] }) {
  return (
    <div className="mt-14 grid gap-8" style={{ gridTemplateColumns: `repeat(${lines.length}, minmax(0, 1fr))` }}>
      {lines.map((l) => (
        <div key={l} className="text-center">
          <div className="mx-auto h-10 w-44 border-b border-dotted border-slate-500" />
          <p className="mt-1.5 text-slate-500">(.................................................)</p>
          <p className="text-slate-700">{l}</p>
        </div>
      ))}
    </div>
  );
}

const Para = ({ children }: { children: ReactNode }) => (
  <p className="indent-12 leading-[1.9] text-slate-800">{children}</p>
);

/* -------------------------------------------------------- certificates */

export function CertificatePaper({
  e,
  kind,
  purpose,
  no,
  date,
}: {
  e: Employee;
  kind: LetterKind;
  purpose: string;
  no: string;
  date: string;
}) {
  const left = e.separation;
  return (
    <Paper>
      <LetterHead right={<><p>ที่ {no}</p><p className="mt-1">วันที่ {thaiDate(date)}</p></>} />
      <p className="mt-8 text-center text-[16px] font-bold text-slate-900">{kind}</p>
      <div className="mt-6 space-y-3">
        <Para>
          หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า คุณ{e.name} เลขประจำตัวประชาชน {e.personal.nationalId}{" "}
          {left
            ? <>เคยเป็นพนักงานของ{COMPANY.name} ตั้งแต่วันที่ {thaiDate(e.contract.startedAt)} ถึงวันที่ {thaiDate(left.lastDay)}</>
            : <>เป็นพนักงานของ{COMPANY.name} ตั้งแต่วันที่ {thaiDate(e.contract.startedAt)} จนถึงปัจจุบัน</>}{" "}
          ในตำแหน่ง {e.position} สังกัด{e.department} ประเภทการจ้าง {e.contract.type}
        </Para>
        {kind === "หนังสือรับรองเงินเดือน" && (
          <Para>
            ปัจจุบันได้รับเงินเดือนในอัตราเดือนละ {money(e.contract.baseSalary)} บาท ({bahtText(e.contract.baseSalary)})
            ไม่รวมค่าล่วงเวลาและสวัสดิการอื่น
          </Para>
        )}
        <Para>ออกให้ไว้เพื่อ{purpose.trim() || "…………………………"}</Para>
      </div>
      <div className="ml-auto mt-10 w-64 text-center text-slate-700">ขอแสดงความนับถือ</div>
      <div className="ml-auto w-64">
        <Signatures lines={["ผู้จัดการฝ่ายทรัพยากรบุคคล"]} />
      </div>
      <p className="mt-10 text-[11px] text-slate-500">
        หนังสือรับรองนี้ออกตามข้อมูลในทะเบียนพนักงาน ณ วันที่ออก ตรวจสอบได้ที่ฝ่ายทรัพยากรบุคคล โทร {COMPANY.phone}
      </p>
    </Paper>
  );
}

export function CertificateSheet({
  employee,
  preset,
  onClose,
}: {
  employee: Employee | null;
  preset: LetterKind;
  onClose: () => void;
}) {
  return (
    <FormModal
      open={employee !== null}
      size="lg"
      title="ออกหนังสือรับรอง"
      subtitle={employee ? `${employee.name} · ${employee.code} · ได้เลขที่หนังสือเมื่อกดออกและพิมพ์` : undefined}
      onClose={onClose}
    >
      {employee && <CertificateBody key={employee.id} e={employee} preset={preset} onClose={onClose} />}
    </FormModal>
  );
}

const PURPOSES = ["ประกอบการขอสินเชื่อ", "ประกอบการขอวีซ่า", "ประกอบการเปิดบัญชีธนาคาร", "ประกอบการสมัครงาน"];

function CertificateBody({ e, preset, onClose }: { e: Employee; preset: LetterKind; onClose: () => void }) {
  useData();
  const [kind, setKind] = useState<LetterKind>(isActive(e) ? preset : "หนังสือรับรองการทำงาน");
  const [purpose, setPurpose] = useState("");
  const [tried, setTried] = useState(false);
  const [issued, setIssued] = useState<IssuedLetter | null>(null);
  const errors = tried && !issued ? letterErrors(e, kind, purpose) : {};

  const issue = () => {
    setTried(true);
    if (Object.keys(letterErrors(e, kind, purpose)).length > 0) return;
    // The page has to show the number it was issued under before the printer
    // reads it, so the state lands first and the print dialog opens after.
    const letter = issueLetter(e.id, kind, purpose);
    flushSync(() => setIssued(letter));
    notify(`ออก${kind} เลขที่ ${letter.no} แล้ว`);
    printDocument();
  };

  return (
    <div className="space-y-4">
      {issued ? (
        <Note tone="ok">
          ออก{issued.kind} เลขที่ <b>{issued.no}</b> แล้ว บันทึกไว้ในกิจกรรมของแฟ้ม พิมพ์ซ้ำได้โดยใช้เลขเดิม
        </Note>
      ) : (
        <div className="space-y-3">
          <OptionCards
            label="ประเภทหนังสือ"
            options={LETTER_KINDS}
            value={kind}
            onChange={(v) => setKind(v as LetterKind)}
            error={errors.kind}
          />
          <TextInput
            label="นำไปใช้เพื่อ"
            value={purpose}
            onChange={setPurpose}
            list="pa-letter-purposes"
            placeholder="ประกอบการขอสินเชื่อ"
            error={errors.purpose}
          />
          <datalist id="pa-letter-purposes">
            {PURPOSES.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>
      )}

      <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-950">
        <CertificatePaper
          e={e}
          kind={issued?.kind ?? kind}
          purpose={issued?.purpose ?? purpose}
          no={issued?.no ?? nextLetterNo()}
          date={issued?.issuedAt ?? TODAY}
        />
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
        <Button variant="secondary" onClick={onClose}>{issued ? "ปิด" : "ยกเลิก"}</Button>
        {issued ? (
          <Button variant="primary" icon={<Printer size={14} />} onClick={printDocument}>พิมพ์อีกครั้ง</Button>
        ) : (
          <Button variant="primary" icon={<FileCheck2 size={14} />} onClick={issue}>ออกเลขที่และพิมพ์</Button>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- contract */

export function ContractPaper({ e }: { e: Employee }) {
  const benefits = e.benefits.filter((b) => !isPvdBenefit(b));
  return (
    <Paper>
      <LetterHead
        right={<><p>สัญญาเลขที่ {e.code}/{beYear(e.contract.startedAt)}</p><p className="mt-1">ทำที่ สำนักงานใหญ่</p></>}
      />
      <p className="mt-8 text-center text-[16px] font-bold text-slate-900">สัญญาจ้างแรงงาน</p>
      <div className="mt-6 space-y-3">
        <Para>
          สัญญาฉบับนี้ทำขึ้นเมื่อวันที่ {thaiDate(e.contract.startedAt)} ระหว่าง {COMPANY.name} โดยผู้มีอำนาจลงนาม
          ซึ่งต่อไปเรียกว่า “นายจ้าง” ฝ่ายหนึ่ง กับ คุณ{e.name} เลขประจำตัวประชาชน {e.personal.nationalId}
          อยู่บ้านเลขที่ {e.personal.address} ซึ่งต่อไปเรียกว่า “ลูกจ้าง” อีกฝ่ายหนึ่ง ทั้งสองฝ่ายตกลงกันดังต่อไปนี้
        </Para>
        <Para>
          ข้อ 1 นายจ้างตกลงจ้างและลูกจ้างตกลงทำงานในตำแหน่ง {e.position} สังกัด{e.department}
          เริ่มงานตั้งแต่วันที่ {thaiDate(e.contract.startedAt)} ประเภทการจ้าง {e.contract.type}{" "}
          {isFixedTerm(e.contract.type) && e.contract.endsAt
            ? <>มีกำหนดระยะเวลาสิ้นสุดวันที่ {thaiDate(e.contract.endsAt)}</>
            : <>ไม่มีกำหนดระยะเวลา</>}
        </Para>
        <Para>
          ข้อ 2 ลูกจ้างต้องทดลองงานเป็นเวลาไม่เกิน {PROBATION_DAYS} วันนับแต่วันเริ่มงาน หากผลการทดลองงานเป็นที่พอใจ
          นายจ้างจะบรรจุเป็นพนักงานและแจ้งเป็นหนังสือ
        </Para>
        <Para>
          ข้อ 3 นายจ้างตกลงจ่ายค่าจ้างเดือนละ {money(e.contract.baseSalary)} บาท ({bahtText(e.contract.baseSalary)})
          โดยโอนเข้าบัญชีธนาคาร{e.admin.bankName} ของลูกจ้างทุกวันทำงานสุดท้ายของเดือน หักภาษี ณ ที่จ่าย
          และเงินสมทบประกันสังคมตามที่กฎหมายกำหนด
          {e.admin.pvdRate > 0 && <> และเงินสะสมกองทุนสำรองเลี้ยงชีพร้อยละ {e.admin.pvdRate} ของค่าจ้าง</>}
        </Para>
        <Para>
          ข้อ 4 วันทำงานปกติ {e.contract.workDays} เวลาทำงานและวันหยุดเป็นไปตามข้อบังคับเกี่ยวกับการทำงานของนายจ้าง
        </Para>
        {benefits.length > 0 && <Para>ข้อ 5 ลูกจ้างมีสิทธิได้รับสวัสดิการดังนี้ {benefits.join(" · ")}</Para>}
        <Para>
          ข้อ {benefits.length > 0 ? 6 : 5} ฝ่ายใดประสงค์จะเลิกสัญญาต้องบอกกล่าวล่วงหน้าเป็นหนังสือไม่น้อยกว่าหนึ่งงวด
          การจ่ายค่าจ้าง และนายจ้างจะจ่ายค่าชดเชยตามพระราชบัญญัติคุ้มครองแรงงาน พ.ศ. 2541 เมื่อเป็นฝ่ายเลิกจ้าง
          เว้นแต่เป็นกรณีตามมาตรา 119
        </Para>
        <Para>
          สัญญานี้ทำขึ้นเป็นสองฉบับมีข้อความตรงกัน คู่สัญญาได้อ่านและเข้าใจโดยตลอดแล้ว จึงลงลายมือชื่อไว้เป็นสำคัญ
          และต่างเก็บไว้ฝ่ายละหนึ่งฉบับ
        </Para>
      </div>
      <Signatures lines={["นายจ้าง", "ลูกจ้าง"]} />
      <Signatures lines={["พยาน", "พยาน"]} />
    </Paper>
  );
}

export function ContractSheet({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  return (
    <FormModal
      open={employee !== null}
      size="lg"
      title="สัญญาจ้างแรงงาน"
      subtitle={employee ? `${employee.name} · ตามเงื่อนไขการจ้างปัจจุบันในแฟ้ม` : undefined}
      onClose={onClose}
    >
      {employee && (
        <PrintFrame
          onClose={onClose}
          onPrint={() => notify(`ส่งสัญญาจ้างของ ${employee.name} ไปที่เครื่องพิมพ์แล้ว`)}
        >
          <ContractPaper e={employee} />
        </PrintFrame>
      )}
    </FormModal>
  );
}

/* ---------------------------------------------------------------- orders */

const ORDER_TITLE: Record<PersonnelAction["kind"], string> = {
  ย้ายแผนก: "โยกย้ายพนักงาน",
  เลื่อนตำแหน่ง: "แต่งตั้งและเลื่อนตำแหน่งพนักงาน",
  ปรับเงินเดือน: "ปรับอัตราเงินเดือน",
  ตักเตือน: "ตักเตือนเป็นหนังสือ",
};

export const orderTitle = (a: PersonnelAction) => (a.kind === "ตักเตือน" ? "หนังสือเตือน" : "คำสั่งบริษัท") + " · " + ORDER_TITLE[a.kind];

export function OrderPaper({ a }: { a: PersonnelAction }) {
  const e = employeeOf(a.employeeId);
  const signed = a.decidedAt ?? TODAY;
  if (a.kind === "ตักเตือน") {
    return (
      <Paper>
        <LetterHead right={<><p>ที่ {a.id}</p><p className="mt-1">วันที่ {thaiDate(signed)}</p></>} />
        <p className="mt-8 text-center text-[16px] font-bold text-slate-900">หนังสือเตือน</p>
        <div className="mt-6 space-y-3">
          <p><b>เรื่อง</b> ตักเตือนเป็นหนังสือ</p>
          <p><b>เรียน</b> คุณ{e.name} ตำแหน่ง {e.position} สังกัด{e.department} รหัสพนักงาน {e.code}</p>
          <Para>
            ด้วยปรากฏว่าท่านได้กระทำการดังต่อไปนี้ {a.reason} ซึ่งเป็นการฝ่าฝืนข้อบังคับเกี่ยวกับการทำงานของบริษัท
          </Para>
          <Para>
            บริษัทจึงตักเตือนท่านเป็นหนังสือ และขอให้ปฏิบัติตามข้อบังคับโดยเคร่งครัด หากท่านกระทำผิดซ้ำคำเตือนภายในหนึ่งปี
            นับแต่วันที่ได้กระทำผิด บริษัทอาจเลิกจ้างโดยไม่จ่ายค่าชดเชยตามมาตรา 119 (4)
            แห่งพระราชบัญญัติคุ้มครองแรงงาน พ.ศ. 2541
          </Para>
        </div>
        <Signatures lines={["ผู้ออกหนังสือ", "ลูกจ้างผู้รับทราบ", "พยาน"]} />
      </Paper>
    );
  }
  return (
    <Paper>
      <LetterHead right={<><p>คำสั่งที่ {a.id}</p><p className="mt-1">สั่ง ณ วันที่ {thaiDate(signed)}</p></>} />
      <p className="mt-8 text-center text-[16px] font-bold text-slate-900">คำสั่ง{COMPANY.name}</p>
      <p className="mt-1 text-center text-slate-800">เรื่อง {ORDER_TITLE[a.kind]}</p>
      <div className="mt-6 space-y-3">
        <Para>
          ด้วยบริษัทพิจารณาแล้วเห็นสมควร เนื่องจาก{a.reason} จึงมีคำสั่งให้ คุณ{e.name} รหัสพนักงาน {e.code}
        </Para>
        <ul className="ml-12 list-disc space-y-1 pl-5 text-slate-800">
          {a.from.department !== a.to.department && (
            <li>ย้ายจากสังกัด{a.from.department} ไปสังกัด{a.to.department}</li>
          )}
          {a.from.position !== a.to.position && (
            <li>{a.kind === "เลื่อนตำแหน่ง" ? "เลื่อนจาก" : "เปลี่ยนจาก"}ตำแหน่ง {a.from.position} เป็นตำแหน่ง {a.to.position}</li>
          )}
          {a.from.salary !== a.to.salary && (
            <li>
              ปรับเงินเดือนจากเดือนละ {baht(a.from.salary)} บาท เป็นเดือนละ {baht(a.to.salary)} บาท ({bahtText(a.to.salary)})
            </li>
          )}
        </ul>
        <Para>ทั้งนี้ตั้งแต่วันที่ {thaiDate(a.effectiveDate)} เป็นต้นไป</Para>
      </div>
      <div className="ml-auto w-72">
        <Signatures lines={["กรรมการผู้จัดการ"]} />
      </div>
      <p className="mt-10 text-[11px] text-slate-500">สำเนาเรียน ฝ่ายทรัพยากรบุคคล · ฝ่ายบัญชี (เงินเดือน) · ผู้บังคับบัญชาต้นสังกัด</p>
    </Paper>
  );
}

export function OrderSheet({ action, onClose }: { action: PersonnelAction | null; onClose: () => void }) {
  return (
    <FormModal
      open={action !== null}
      size="lg"
      title={action ? orderTitle(action) : ""}
      subtitle={action ? `${action.id} · ${employeeOf(action.employeeId).name}` : undefined}
      onClose={onClose}
    >
      {action && (
        <PrintFrame onClose={onClose} onPrint={() => notify(`ส่ง${orderTitle(action)} ${action.id} ไปที่เครื่องพิมพ์แล้ว`)}>
          <OrderPaper a={action} />
        </PrintFrame>
      )}
    </FormModal>
  );
}

/** The page on a grey desk, and the row that prints it. */
function PrintFrame({ children, onClose, onPrint }: { children: ReactNode; onClose: () => void; onPrint: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-950">{children}</div>
      <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
        <Button variant="secondary" onClick={onClose}>ปิด</Button>
        <Button
          variant="primary"
          icon={<Printer size={14} />}
          onClick={() => {
            printDocument();
            onPrint();
          }}
        >
          พิมพ์
        </Button>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowLeft } from "lucide-react";
import { GUIDE, GUIDE_ROLES } from "@/lib/guide";
import { latestInGuide, latestVersion } from "@/lib/changelog";
import { GuideBlockView, RichText } from "@/components/guide/GuideBlocks";
import styles from "@/components/guide/guide.module.css";

export const metadata: Metadata = { title: "คู่มือการใช้งาน" };

/** Sections in reading order — by role, then as written — each with its number. */
const CHAPTERS = GUIDE_ROLES.map((role) => ({
  role,
  sections: GUIDE.filter((section) => section.role === role.id),
}));
const NUMBER = new Map(CHAPTERS.flatMap((c) => c.sections).map((section, index) => [section.id, index + 1]));

/** What changed lately: listed at the top of the page and marked on their sections. */
const LATEST = latestInGuide(3);
const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  calendar: "gregory",
  timeZone: "UTC",
});

/**
 * คู่มือการใช้งาน — every part of FITT Builder, by who does it, with the
 * screens marked up. Open without an account (like /changelog) so a link to a
 * section can go into a group chat.
 */
export default function GuidePage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <Image src="/logo.png" alt="" width={32} height={32} className={styles.logo} />
          <span>FITT Builder</span>
        </Link>
        <div className={styles.topLinks}>
          <Link href="/changelog">มีอะไรใหม่</Link>
          <Link href="/" className={styles.back}>
            <ArrowLeft size={14} aria-hidden="true" /> กลับไปทำงาน
          </Link>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="guide-title">
        <div>
          <p className={styles.eyebrow}>คู่มือการใช้งาน</p>
          <h1 id="guide-title">ใช้งาน FITT Builder ทีละขั้น</h1>
          <p className={styles.heroText}>
            ตั้งแต่เข้าสู่ระบบครั้งแรก สร้างเดโมที่ลูกค้ากดใช้งานได้จริง ทำใบเสนอราคาและข้อเสนอโครงการ ส่งอนุมัติ
            ไปจนถึงพิมพ์ส่งลูกค้า แบ่งตามบทบาท อ่านเฉพาะส่วนของคุณก่อนก็ได้
          </p>
          <p className={styles.heroMeta}>ตรงกับ FITT Builder v{latestVersion()}</p>
        </div>

        <aside className={styles.latest} aria-labelledby="guide-latest-title">
          <h2 id="guide-latest-title">อัปเดตล่าสุด</h2>
          <ul>
            {LATEST.map((entry) => (
              <li key={entry.version}>
                <a href={`#${entry.guide}`}>
                  <span className={styles.latestMeta}>
                    <span>v{entry.version}</span>
                    <span>{dateFormatter.format(new Date(entry.date))}</span>
                  </span>
                  <span className={styles.latestTitle}>{entry.title}</span>
                  <ArrowDown size={15} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <Link href="/changelog" className={styles.latestAll}>
            ดูทั้งหมดในหน้ามีอะไรใหม่
          </Link>
        </aside>
      </section>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="สารบัญ">
          {CHAPTERS.map(({ role, sections }) => (
            <div key={role.id} className={styles.tocGroup}>
              <a href={`#role-${role.id}`} className={styles.tocRole}>
                {role.title}
              </a>
              <ol>
                {sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>
                      <span>{NUMBER.get(section.id)}</span>
                      {section.title}
                      {LATEST.some((entry) => entry.guide === section.id) && <em className={styles.tocNew}>ใหม่</em>}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </nav>

        <div className={styles.content}>
          {CHAPTERS.map(({ role, sections }) => (
            <div key={role.id} className={styles.chapter}>
              <h2 id={`role-${role.id}`} className={styles.chapterTitle}>
                {role.title}
                <span>{role.who}</span>
              </h2>
              {sections.map((section) => (
                <section key={section.id} id={section.id} className={styles.section} aria-labelledby={`${section.id}-title`}>
                  <div className={styles.sectionHead}>
                    <p className={styles.sectionNumber}>{NUMBER.get(section.id)}</p>
                    <h3 id={`${section.id}-title`}>{section.title}</h3>
                    {LATEST.filter((entry) => entry.guide === section.id).map((entry) => (
                      <p key={entry.version} className={styles.sectionNew}>
                        <strong>ใหม่ใน v{entry.version}</strong>
                        <span>{entry.title}</span>
                      </p>
                    ))}
                  </div>
                  {section.intro && (
                    <p className={styles.intro}>
                      <RichText text={section.intro} />
                    </p>
                  )}
                  {section.blocks.map((block, index) => (
                    <GuideBlockView key={index} block={block} />
                  ))}
                </section>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

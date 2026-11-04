import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GUIDE, GUIDE_ROLES } from "@/lib/guide";
import { latestVersion } from "@/lib/changelog";
import { GuideBlockView, RichText } from "@/components/guide/GuideBlocks";
import styles from "@/components/guide/guide.module.css";

export const metadata: Metadata = { title: "คู่มือการใช้งาน" };

/** Sections in reading order — by role, then as written — each with its number. */
const CHAPTERS = GUIDE_ROLES.map((role) => ({
  role,
  sections: GUIDE.filter((section) => section.role === role.id),
}));
const NUMBER = new Map(CHAPTERS.flatMap((c) => c.sections).map((section, index) => [section.id, index + 1]));

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
        <p className={styles.eyebrow}>คู่มือการใช้งาน</p>
        <h1 id="guide-title">ใช้งาน FITT Builder ทีละขั้น</h1>
        <p className={styles.heroText}>
          ตั้งแต่เข้าสู่ระบบครั้งแรก สร้างเดโมที่ลูกค้ากดใช้งานได้จริง ทำใบเสนอราคาและข้อเสนอโครงการ ส่งอนุมัติ
          ไปจนถึงพิมพ์ส่งลูกค้า แบ่งตามบทบาท อ่านเฉพาะส่วนของคุณก่อนก็ได้
        </p>
        <p className={styles.heroMeta}>ตรงกับ FITT Builder v{latestVersion()}</p>
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
                  <p className={styles.sectionNumber}>{NUMBER.get(section.id)}</p>
                  <h3 id={`${section.id}-title`}>{section.title}</h3>
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

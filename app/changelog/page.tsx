"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/current-user";
import { CHANGE_BADGE, CHANGELOG, latestVersion, type ChangeType } from "@/lib/changelog";
import styles from "./page.module.css";

const PAGE_SIZE = 6;
const MONTHS = [...new Set(CHANGELOG.map((entry) => entry.date.slice(0, 7)))];
const CHANGE_TYPES: ChangeType[] = ["feature", "improvement", "fix"];
const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  calendar: "gregory",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("th-TH", {
  month: "long",
  year: "numeric",
  calendar: "gregory",
  timeZone: "UTC",
});

export default function ChangelogPage() {
  const router = useRouter();
  const [month, setMonth] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeVersion, setActiveVersion] = useState(latestVersion());
  const viewportRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const entries = month === "all"
    ? CHANGELOG
    : CHANGELOG.filter((entry) => entry.date.startsWith(month));
  const visibleEntries = entries.slice(0, visibleCount);
  const activeIndex = visibleEntries.findIndex((entry) => entry.version === activeVersion);

  function resetTimeline(nextMonth: string) {
    setMonth(nextMonth);
    setVisibleCount(PAGE_SIZE);
    viewportRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  function scrollToVersion(version: string) {
    const viewport = viewportRef.current;
    const release = viewport?.querySelector<HTMLElement>(`article[data-version="${version}"]`);
    if (!viewport || !release) return;
    viewport.scrollTo({
      top: viewport.scrollTop + release.getBoundingClientRect().top - viewport.getBoundingClientRect().top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let frame = 0;
    const update = () => {
      // Follow the card crossing the reading position, including cards taller
      // than the viewport, without interrupting native scrolling.
      const releases = Array.from(viewport.querySelectorAll<HTMLElement>("article[data-version]"));
      const readingLine = viewport.getBoundingClientRect().top + Math.min(100, viewport.clientHeight * 0.2);
      let current = releases[0];
      for (const release of releases) {
        if (release.getBoundingClientRect().top <= readingLine) current = release;
      }
      if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2) {
        current = releases.at(-1) ?? current;
      }
      if (current?.dataset.version) setActiveVersion(current.dataset.version);
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    viewport.addEventListener("scroll", scheduleUpdate, { passive: true });
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(viewport);
    scheduleUpdate();
    return () => {
      viewport.removeEventListener("scroll", scheduleUpdate);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [month, visibleCount]);

  useEffect(() => {
    const rail = railRef.current;
    const active = rail?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!rail || !active) return;
    const keepActiveVisible = () => {
      const outer = rail.getBoundingClientRect();
      const inner = active.getBoundingClientRect();
      // Keep the active step visible within its own rail, including when it
      // changes from a vertical timeline to a horizontal mobile strip.
      rail.scrollBy({
        top: inner.top < outer.top ? inner.top - outer.top : Math.max(0, inner.bottom - outer.bottom),
        left: inner.left < outer.left ? inner.left - outer.left : Math.max(0, inner.right - outer.right),
        behavior: "instant",
      });
    };
    const observer = new ResizeObserver(keepActiveVisible);
    observer.observe(rail);
    keepActiveVisible();
    return () => observer.disconnect();
  }, [activeVersion]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const user = await currentUser();
      if (user) {
        await supabase
          .from("fittbuilder_profiles")
          .update({ last_seen_changelog: latestVersion() })
          .eq("id", user.id);
      }
    })();
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.navigation}>
          <Link href="/" className={styles.brand}>
            <Image src="/logo.png" alt="" width={36} height={36} className={styles.logo} />
            <span>FITT Builder</span>
          </Link>
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            className={styles.back}
          >
            <ArrowLeft size={15} aria-hidden="true" /> ย้อนกลับ
          </button>
        </header>

        <section className={styles.hero} aria-labelledby="changelog-title">
          <div className={styles.artwork} aria-hidden="true">
            <span /><span /><span />
          </div>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>FITT BUILDER / CHANGELOG</p>
            <h1 id="changelog-title">ทุกอัปเดต อยู่ที่นี่</h1>
            <p className={styles.intro}>
              รวมฟีเจอร์ใหม่ การปรับปรุง และการแก้ไขใน FITT Builder
              <br className="hidden sm:block" /> ติดตามสิ่งที่เปลี่ยนไปในแต่ละเวอร์ชันได้ที่นี่
            </p>
            <a
              href="#releases"
              className={styles.latestLink}
              onClick={(event) => {
                event.preventDefault();
                resetTimeline("all");
                viewportRef.current?.focus({ preventScroll: true });
              }}
            >
              <span className={styles.liveDot} />
              เวอร์ชันล่าสุด <span className={styles.version}>v{latestVersion()}</span>
              <ArrowDown size={14} aria-hidden="true" />
            </a>
          </div>
        </section>

        <section id="releases" className={styles.releases} aria-labelledby="releases-title">
          <div className={styles.toolbar}>
            <div>
              <h2 id="releases-title">บันทึกการอัปเดต</h2>
              <p>เรียงจากเวอร์ชันใหม่ไปเก่า</p>
            </div>
            <div className={styles.monthFilter}>
              <label htmlFor="release-month" className="sr-only">เลือกเดือนที่อัปเดต</label>
              <select
                id="release-month"
                value={month}
                onChange={(event) => resetTimeline(event.target.value)}
              >
                <option value="all">ทุกเดือน</option>
                {MONTHS.map((value) => (
                  <option key={value} value={value}>
                    {monthFormatter.format(new Date(`${value}-01T00:00:00Z`))}
                  </option>
                ))}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </div>
          </div>

          <div className={styles.timelineLayout}>
            <nav ref={railRef} className={styles.timelineRail} aria-label="ไทม์ไลน์เวอร์ชัน">
              {visibleEntries.map((entry, index) => (
                <button
                  key={entry.version}
                  type="button"
                  className={`${styles.railStep} ${index <= activeIndex ? styles.visitedStep : ""}`}
                  aria-current={entry.version === activeVersion ? "step" : undefined}
                  aria-controls={`version-${entry.version}`}
                  onClick={() => scrollToVersion(entry.version)}
                >
                  <span className={styles.railVersion}>v{entry.version}</span>
                  <time dateTime={entry.date}>{dateFormatter.format(new Date(`${entry.date}T00:00:00Z`))}</time>
                  {entry.version === latestVersion() && <span className={styles.railLatest}>ล่าสุด</span>}
                </button>
              ))}
            </nav>
            <div
              ref={viewportRef}
              className={styles.timelineViewport}
              role="region"
              aria-label="รายละเอียดอัปเดตแต่ละเวอร์ชัน"
              tabIndex={0}
            >
              <div id="release-list">
                {visibleEntries.map((entry) => {
                  const isLatest = entry.version === latestVersion();
                  return (
                    <article
                      key={entry.version}
                      id={`version-${entry.version}`}
                      data-version={entry.version}
                      className={styles.release}
                      aria-labelledby={`release-${entry.version}`}
                    >
                      <div className={styles.card}>
                        <div className={`${styles.cardHeader} ${isLatest ? styles.latestHeader : ""}`}>
                          <div className={styles.releaseMeta}>
                            <p className={styles.version}>เวอร์ชัน {entry.version}</p>
                            <time dateTime={entry.date}>{dateFormatter.format(new Date(`${entry.date}T00:00:00Z`))}</time>
                            {isLatest && <span className={styles.latestBadge}>อัปเดตล่าสุด</span>}
                          </div>
                          <h3 id={`release-${entry.version}`}>{entry.title}</h3>
                        </div>
                        <div className={styles.cardBody}>
                          {CHANGE_TYPES.map((type) => {
                            const items = entry.items.filter((item) => item.type === type);
                            if (!items.length) return null;
                            return (
                              <section key={type} className={styles.changeGroup}>
                                <h4 className={styles.groupTitle}>
                                  <span className={`${styles.categoryDot} ${CHANGE_BADGE[type].className}`} aria-hidden="true" />
                                  {CHANGE_BADGE[type].label}
                                </h4>
                                <ul className={styles.items}>
                                  {items.map((item, index) => <li key={index}>{item.text}</li>)}
                                </ul>
                              </section>
                            );
                          })}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className={styles.more}>
                <p role="status">แสดง {visibleEntries.length} จาก {entries.length} เวอร์ชัน</p>
                {visibleCount < entries.length && (
                  <button
                    type="button"
                    aria-controls="release-list"
                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  >
                    ดูอัปเดตก่อนหน้า <ArrowDown size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
        <footer className={styles.footer}>FITT Builder <span>สร้างและพัฒนาไปด้วยกัน</span></footer>
      </div>
    </main>
  );
}

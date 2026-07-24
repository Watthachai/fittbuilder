"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react";
import Link from "next/link";
import { PanelLeft } from "lucide-react";
import LaunchPad from "./LaunchPad";
import AccountMenu from "@/components/AccountMenu";
import ProjectsDrawer from "@/components/projects/ProjectsDrawer";
import { CHANGELOG } from "@/lib/changelog";

const VERSION = CHANGELOG[0]?.version ?? "0.0.0";

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260530_042513_df96a13b-6155-4f6e-8b93-c9dee66fba08.mp4";

const NAV_LINKS = [
  { label: "วิธีใช้", href: "#how" },
  { label: "Spec-to-Demo", href: "#spec" },
];

const TYPED = "ยินดีที่แวะมา บอกไอเดียมาได้เลย — วันนี้อยากสร้างอะไร?";

/** Reveals `text` one character at a time after `startDelay`. */
function useTypewriter(text: string, speed = 38, startDelay = 600) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let i = 0;
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          if (interval) clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, startDelay]);
  return { displayed, done };
}

export default function MainframeHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevX = useRef<number | null>(null);
  const targetTime = useRef(0);
  const seeking = useRef(false);
  const heroRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  // FITT Advisor is alpha — its nav entry shows only to admins (/api/me hint;
  // real gating stays server-side on the Advisor APIs).
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLaunch, setShowLaunch] = useState(false);
  const [launching, setLaunching] = useState(false);
  const launchingRef = useRef(false);
  const { displayed, done } = useTypewriter(TYPED);

  // "Dive into the machine": on launch, zoom the video deep into the robot's CRT
  // screen and fade to black, then resolve so LaunchPad navigates to the Studio —
  // a portal-into-another-world transition.
  const startZoom = useCallback(
    () =>
      new Promise<void>((resolve) => {
        launchingRef.current = true;
        setLaunching(true);
        const v = videoRef.current;
        if (v) {
          v.style.transition = "transform 1100ms cubic-bezier(0.66, 0, 0.85, 0.2)";
          v.style.transformOrigin = "70% 38%";
          v.style.willChange = "transform";
          requestAnimationFrame(() => {
            if (videoRef.current) videoRef.current.style.transform = "scale(11)";
          });
        }
        // Navigate just as the screen reaches full black for a seamless cut.
        setTimeout(resolve, 950);
      }),
    [],
  );

  // Parallax: hero content drifts up + fades as it scrolls away.
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -90]);

  // Scroll-zoom into the robot's screen: as the page scrolls down toward
  // "ทำงานยังไง?", the fixed video scales up toward its CRT screen; scrolling
  // back up zooms out (scroll-linked, so it reverses automatically).
  const { scrollY } = useScroll();
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
    };
  }, []);
  const videoZoom = useTransform(scrollY, [0, vh * 1.4], [1, 2.3], { clamp: true });
  // Spring-smooth the zoom so it glides instead of tracking scroll 1:1.
  const smoothZoom = useSpring(videoZoom, { stiffness: 90, damping: 24, mass: 0.4 });

  // Apply the zoom IMPERATIVELY instead of via motion's persistent transform.
  // A persistent CSS transform (and the will-change motion adds) pins the video
  // to the GPU-texture compositing path, so every mouse-scrub seek must be
  // re-rasterized — that's what made scrubbing janky. At rest (z≈1, which is the
  // whole hero where scrubbing happens) we leave the video transform-free, so it
  // stays on the fast path exactly like a plain <video>; the zoom only engages
  // once scrolled away from the hero.
  useMotionValueEvent(smoothZoom, "change", (z) => {
    if (launchingRef.current) return; // don't fight the launch zoom
    const v = videoRef.current;
    if (!v) return;
    if (z <= 1.002) {
      v.style.transform = "";
      v.style.transformOrigin = "";
      v.style.willChange = "";
    } else {
      v.style.transformOrigin = "72% 42%";
      v.style.transform = `scale(${z})`;
      v.style.willChange = "transform";
    }
  });

  // Pills/builder appear 400ms after load, independent of the typewriter.
  useEffect(() => {
    const t = setTimeout(() => setShowLaunch(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Admin hint for the alpha Advisor nav entry.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me")
      .then((res) => (res.ok ? (res.json() as Promise<{ isAdmin?: boolean }>) : null))
      .then((data) => {
        if (!cancelled) setIsAdmin(Boolean(data?.isAdmin));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Scrub the (non-autoplaying) video by horizontal mouse movement. Waits for
  // each seek to finish (onSeeked) before issuing the next so the browser doesn't
  // drop intermediate frames (which made it jump between sparse keyframes). The
  // onSeeked handler is attached as an element prop so it binds reliably.
  useEffect(() => {
    const SENSITIVITY = 0.8;
    function onMove(e: MouseEvent) {
      const v = videoRef.current;
      if (!v || !v.duration) return;
      if (prevX.current === null) {
        prevX.current = e.clientX;
        return;
      }
      const delta = e.clientX - prevX.current;
      prevX.current = e.clientX;
      let t = targetTime.current + (delta / window.innerWidth) * SENSITIVITY * v.duration;
      t = Math.max(0, Math.min(v.duration, t));
      targetTime.current = t;
      if (!seeking.current) {
        seeking.current = true;
        v.currentTime = t;
      }
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  function handleSeeked() {
    const v = videoRef.current;
    if (!v) return;
    if (Math.abs(v.currentTime - targetTime.current) > 0.01) {
      v.currentTime = targetTime.current;
    } else {
      seeking.current = false;
    }
  }

  return (
    <>
      {/* Background video — plain <video> (no persistent transform) so mouse-scrub
          seeks stay smooth; zoom is applied imperatively in the effect above. */}
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        aria-hidden
        onSeeked={handleSeeked}
        className="fixed inset-0 z-0 h-full w-full object-cover"
        style={{ objectPosition: "70% center" }}
      />
      <div className="fixed inset-0 z-0 bg-night/55" aria-hidden />

      {/* Navbar — floating glass pill */}
      <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setProjectsOpen(true)}
            aria-label="ผลงานของฉัน"
            className="grid h-9 w-9 place-items-center rounded-full border border-chalk/12 bg-night/40 text-chalk/85 backdrop-blur-xl transition hover:text-chalk"
          >
            <PanelLeft size={17} />
          </button>
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="FITT Builder" className="h-9 w-9 rounded-[10px] sm:h-10 sm:w-10" />
            <span
              className="text-[21px] tracking-tight text-chalk sm:text-[26px]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              FITT Builder
            </span>
            <span
              className="select-none text-[25px] text-chalk sm:text-[30px]"
              style={{ letterSpacing: "-0.02em" }}
            >
              ✳︎
            </span>
          </Link>
          <a
            href="/changelog"
            target="_blank"
            rel="noreferrer"
            title="มีอะไรใหม่ · changelog"
            className="font-mono text-[11px] text-chalk/45 transition hover:text-chalk/80"
          >
            v{VERSION}
          </a>
        </div>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-chalk/12 bg-night/40 px-2 py-1.5 text-[15px] text-chalk/85 backdrop-blur-xl md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-1.5 transition hover:bg-chalk/10 hover:text-chalk"
            >
              {link.label}
            </a>
          ))}
          {isAdmin && (
            <Link
              href="/advisor"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 transition hover:bg-chalk/10 hover:text-chalk"
            >
              FITT Advisor
              <span className="rounded-full bg-shine/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-shine">
                alpha
              </span>
            </Link>
          )}
        </nav>

        <div className="hidden items-center gap-2 rounded-full border border-chalk/12 bg-night/40 py-1 pl-3 pr-1 backdrop-blur-xl md:flex">
          <button
            onClick={() => setProjectsOpen(true)}
            className="text-[15px] text-chalk/85 transition hover:text-chalk"
          >
            ผลงานของฉัน
          </button>
          <AccountMenu />
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="เมนู"
          className="flex flex-col gap-[5px] md:hidden"
        >
          <span
            className={`h-[2px] w-6 bg-chalk transition-all duration-300 ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`}
          />
          <span className={`h-[2px] w-6 bg-chalk transition-all duration-300 ${menuOpen ? "opacity-0" : ""}`} />
          <span
            className={`h-[2px] w-6 bg-chalk transition-all duration-300 ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`}
          />
        </button>
      </header>

      {/* Mobile overlay */}
      <div
        className="fixed inset-0 z-40 flex flex-col justify-center gap-8 px-8 backdrop-blur-sm transition-opacity duration-300 md:hidden"
        style={{
          background: "var(--overlay-dim)",
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? "auto" : "none",
        }}
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={() => setMenuOpen(false)}
            className="text-[32px] font-medium text-chalk"
          >
            {link.label}
          </a>
        ))}
        {isAdmin && (
          <Link
            href="/advisor"
            onClick={() => setMenuOpen(false)}
            className="inline-flex items-center gap-2 text-[32px] font-medium text-chalk"
          >
            FITT Advisor
            <span className="rounded-full bg-shine/15 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-shine">
              alpha
            </span>
          </Link>
        )}
        <button
          onClick={() => {
            setMenuOpen(false);
            setProjectsOpen(true);
          }}
          className="text-left text-[32px] font-medium text-chalk underline underline-offset-2"
        >
          ผลงานของฉัน
        </button>
        {/* Account + admin (Skill Templates / รายงานการใช้ AI) live in this menu. */}
        <div className="mt-2">
          <AccountMenu />
        </div>
      </div>

      <ProjectsDrawer open={projectsOpen} onClose={() => setProjectsOpen(false)} />

      {/* Hero */}
      <section
        ref={heroRef}
        className="relative z-10 flex h-screen flex-col justify-end overflow-hidden px-5 pb-12 sm:px-8 md:justify-center md:px-10 md:pb-0"
        style={{
          fontFamily: "var(--font-body)",
          opacity: launching ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}
      >
        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="relative z-10 w-full max-w-2xl">
          {/* Blurred intro label */}
          <div
            className="pointer-events-none mb-5 select-none text-chalk sm:mb-6"
            style={{
              fontSize: "clamp(18px, 4vw, 26px)",
              lineHeight: 1.3,
              fontWeight: 400,
              filter: "blur(4px)",
            }}
          >
            สวัสดี เราคือ A.R.I.A
            <br />
            ผู้ช่วย AI ของ FITT ที่เปลี่ยน prompt เป็นเว็บจริง
          </div>

          {/* Typewriter */}
          <p
            className="mb-5 text-chalk sm:mb-6"
            style={{
              fontSize: "clamp(18px, 4vw, 26px)",
              lineHeight: 1.35,
              fontWeight: 400,
              minHeight: 54,
            }}
          >
            {displayed}
            {!done && (
              <span className="caret-blink ml-[2px] inline-block h-[1.1em] w-[2px] bg-chalk align-middle" />
            )}
          </p>

          {/* Embedded builder (fade-in + slide-up, 400ms after load) */}
          <div
            style={{
              opacity: showLaunch ? 1 : 0,
              transform: showLaunch ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
            }}
          >
            <LaunchPad onLaunch={startZoom} />
          </div>
        </motion.div>
      </section>

      {/* Fade-to-black as we dive into the screen, covering the cut to Studio. */}
      {launching && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.95, ease: "easeIn" }}
          className="pointer-events-none fixed inset-0 z-[100] bg-night"
        />
      )}
    </>
  );
}

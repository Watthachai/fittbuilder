import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRightToLine, Bell, ChevronsLeft, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Toaster } from "./kit";
import { Avatar, enter } from "./ui";
import type { Tone } from "./ui";

/**
 * The frame a generated back-office app lives in.
 *
 * It is the studio's own HR system's chrome — the light sidebar with its violet
 * pill, the white header with the trail, the search and the bell, the grey page
 * ground — so an app the model writes starts from the frame people already
 * liked instead of one it made up on the spot. Every generated ERP used to
 * invent its own, and they were the first thing that looked wrong.
 *
 * It owns the chrome and nothing else. Which screen is showing is the app's
 * state: the shell is told `active` and reports clicks through `onNavigate`, so
 * App.tsx stays the one place that decides, and the screen index it renders for
 * the studio's capture keeps working.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Things waiting on this screen, shown beside its name. */
  count?: number;
};

/** A run of screens under one heading. The first group usually has none. */
export type NavGroup = { label?: string; items: NavItem[] };

/** One thing waiting on someone. `target` is the screen that deals with it. */
export type Notice = { id: string; title: string; detail?: string; tone?: Tone; target?: string };

const NOTICE_DOT: Record<Tone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-400",
  bad: "bg-rose-500",
  idle: "bg-slate-400",
  info: "bg-sky-500",
  accent: "bg-violet-400",
};

export function Shell({
  brand,
  nav,
  active,
  onNavigate,
  crumb,
  actions,
  notices = [],
  user,
  children,
}: {
  /** The company or product in the sidebar head, with one line under it. */
  brand: { name: string; caption?: string; icon?: LucideIcon };
  nav: NavGroup[];
  /** The id of the screen that is showing. */
  active: string;
  onNavigate: (id: string) => void;
  /** What follows the screen name in the header trail — an open record, a sub-view. */
  crumb?: ReactNode;
  /** Header controls this app needs — a role switcher, a period picker. */
  actions?: ReactNode;
  notices?: Notice[];
  user?: { name: string; role?: string };
  children: ReactNode;
}) {
  // A phone-width preview starts on the rail: a 240px menu leaves a 375px screen
  // too narrow for a table.
  const [rail, setRail] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [bell, setBell] = useState(false);
  const [query, setQuery] = useState("");

  const items = useMemo(() => nav.flatMap((g) => g.items), [nav]);
  const current = items.find((i) => i.id === active);
  const q = query.trim().toLowerCase();
  const hits = q ? items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 6) : [];
  const BrandIcon = brand.icon;

  const go = (id: string) => {
    onNavigate(id);
    setQuery("");
    setBell(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f4f6] text-slate-800 dark:bg-[#0b0b10] dark:text-slate-100">
      <aside
        className={
          "flex shrink-0 flex-col border-r border-slate-200/80 bg-white transition-[width] dark:border-slate-800 dark:bg-slate-900 " +
          (rail ? "w-[60px]" : "w-60")
        }
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4 dark:border-slate-800">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-600 text-[13px] font-bold text-white shadow-sm shadow-violet-600/30">
            {BrandIcon ? <BrandIcon size={16} /> : brand.name.trim().slice(0, 1)}
          </span>
          {!rail && (
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold text-slate-900 dark:text-slate-50">
                {brand.name}
              </span>
              {brand.caption && (
                <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">{brand.caption}</span>
              )}
            </span>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {nav.map((group, gi) => (
            <div key={group.label ?? gi} className={gi === 0 ? "" : "mt-4"}>
              {group.label && !rail && (
                <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const on = item.id === active;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item.id)}
                    title={rail ? item.label : undefined}
                    aria-current={on ? "page" : undefined}
                    className={
                      "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition " +
                      (on
                        ? "font-medium text-white"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100")
                    }
                  >
                    {/* The pill moves between items rather than blinking from one
                        to the next — the one motion the menu has. */}
                    {on && (
                      <motion.span
                        layoutId="shell-active"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                        className="absolute inset-0 rounded-lg bg-violet-600 shadow-sm shadow-violet-600/25"
                      />
                    )}
                    <Icon size={16} className="relative shrink-0" />
                    {!rail && <span className="relative min-w-0 flex-1 truncate">{item.label}</span>}
                    {!rail && item.count ? (
                      <span
                        className={
                          "relative rounded-full px-1.5 text-[10.5px] tabular-nums " +
                          (on ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")
                        }
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-2 dark:border-slate-800">
          <button
            onClick={() => setRail((r) => !r)}
            title={rail ? "ขยายแถบเมนู" : "ยุบแถบเมนู"}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-500 transition hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60"
          >
            <ChevronsLeft size={15} className={"shrink-0 transition " + (rail ? "rotate-180" : "")} />
            {!rail && "ยุบแถบเมนู"}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* On a phone the controls drop to a second row rather than squeezing
            the screen's name down to its first letter. */}
        <header className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-slate-200/80 bg-white px-5 py-2.5 md:flex-nowrap dark:border-slate-800 dark:bg-slate-900">
          <nav aria-label="ตำแหน่งปัจจุบัน" className="flex min-w-0 items-center gap-1 text-[12.5px]">
            <ArrowRightToLine size={14} className="mr-1 shrink-0 text-slate-400" />
            <span
              className={
                crumb
                  ? "shrink-0 text-slate-400 dark:text-slate-500"
                  : "truncate font-medium text-slate-800 dark:text-slate-100"
              }
            >
              {current?.label}
            </span>
            {crumb && (
              <>
                <span className="text-slate-300 dark:text-slate-600">›</span>
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">{crumb}</span>
              </>
            )}
          </nav>

          {/* Search goes to a screen by name — the menu, typed. */}
          <div className="relative mx-auto hidden w-full max-w-sm md:block">
            <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && hits[0]) go(hits[0].id);
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="ค้นหาหน้าจอ…"
              aria-label="ค้นหาหน้าจอ"
              className="w-full rounded-full bg-slate-100 py-2 pl-9 pr-3.5 text-[12.5px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-violet-500/20 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
            />
            {q && (
              <ul className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                {hits.map((i) => {
                  const Icon = i.icon;
                  return (
                    <li key={i.id}>
                      <button
                        onClick={() => go(i.id)}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[12.5px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
                      >
                        <Icon size={14} className="shrink-0 text-slate-400" />
                        {i.label}
                      </button>
                    </li>
                  );
                })}
                {hits.length === 0 && (
                  <li className="px-3.5 py-3 text-[12.5px] text-slate-400 dark:text-slate-500">ไม่มีหน้าจอชื่อนี้</li>
                )}
              </ul>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            {actions}

            <div className="relative">
              <button
                onClick={() => setBell((b) => !b)}
                aria-label={`การแจ้งเตือน ${notices.length} รายการ`}
                className="relative rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-violet-300 hover:text-violet-600 dark:border-slate-800 dark:text-slate-400"
              >
                <Bell size={14} />
                {notices.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-rose-500 text-[9px] font-semibold text-white">
                    {notices.length}
                  </span>
                )}
              </button>
              {bell && <div className="fixed inset-0 z-30" onClick={() => setBell(false)} />}
              <AnimatePresence>
                {bell && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: EASE }}
                    className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
                  >
                    <p className="border-b border-slate-100 px-4 py-2.5 text-[12.5px] font-medium text-slate-800 dark:border-slate-800 dark:text-slate-100">
                      {notices.length > 0 ? `มี ${notices.length} เรื่องที่ต้องจัดการ` : "การแจ้งเตือน"}
                    </p>
                    <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                      {notices.map((n) => (
                        <li key={n.id}>
                          <button
                            onClick={() => (n.target ? go(n.target) : setBell(false))}
                            className="flex w-full gap-2.5 px-4 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                          >
                            <span className={"mt-1.5 size-1.5 shrink-0 rounded-full " + NOTICE_DOT[n.tone ?? "accent"]} />
                            <span className="min-w-0">
                              <span className="block text-[12.5px] text-slate-800 dark:text-slate-100">{n.title}</span>
                              {n.detail && (
                                <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">{n.detail}</span>
                              )}
                            </span>
                          </button>
                        </li>
                      ))}
                      {notices.length === 0 && (
                        <li className="px-4 py-8 text-center text-[12.5px] text-slate-400 dark:text-slate-500">ไม่มีเรื่องค้าง</li>
                      )}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {user && (
              <span className="flex items-center gap-2" title={user.role ? `${user.name} · ${user.role}` : user.name}>
                <Avatar name={user.name} />
                <span className="hidden min-w-0 lg:block">
                  <span className="block truncate text-[12.5px] font-medium leading-tight text-slate-800 dark:text-slate-100">
                    {user.name}
                  </span>
                  {user.role && (
                    <span className="block truncate text-[11px] leading-tight text-slate-500 dark:text-slate-400">{user.role}</span>
                  )}
                </span>
              </span>
            )}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-6">
          {/* Opacity only. While a transform runs it is a containing block for
              every fixed element on the page — a toast, a floating button. */}
          <motion.div
            key={active}
            initial={enter({ opacity: 0 })}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            {children}
          </motion.div>
        </main>
        <Toaster />
      </div>
    </div>
  );
}

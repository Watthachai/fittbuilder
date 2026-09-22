"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Banknote, Bell, Boxes, ChevronRight, ChevronsLeft, Clock, Factory,
  LayoutGrid, Moon, PanelsTopLeft, Search, Ship, Sun, Truck, Users, Warehouse,
} from "lucide-react";
import { FAMILIES, MODULES, modulesOf } from "@/lib/modules/registry";
import { ROLES, DEMO_PASSWORD_HINT, clearSession, readSession, writeSession } from "./session";
import type { Role } from "./session";
import { alertsFor, moduleName } from "./alerts";
import { applyTheme, captureRoot, readTheme } from "./theme";
import type { Theme } from "./theme";
import CommandPalette from "./CommandPalette";
import TakeProject from "./TakeProject";
import TrialSwitcher from "./TrialSwitcher";

const ICONS: Record<string, typeof Users> = {
  pa: Users,
  om: PanelsTopLeft,
  tm: Clock,
  py: Banknote,
  mm: Boxes,
  pp: Factory,
  sd: Ship,
  wm: Warehouse,
  fi: LayoutGrid,
  co: Truck,
};

const RAIL = "fitt-erp-rail";

/**
 * The workspace a buyer walks into: sign in, then a sidebar of the modules that
 * role can open. Nothing is composed and nothing is generated — this is the
 * running system, and the same screens are what a project gets when it is built.
 *
 * The chrome is the part a person touches every minute of an eight-hour day, so
 * it carries what that costs: a rail that collapses on a small laptop, a command
 * palette for people who stopped reading menus, breadcrumbs so nobody is lost
 * three levels down, and a dark mode that is a real theme rather than a filter.
 */
export default function ErpShell({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role | undefined>();
  const [ready, setReady] = useState(false);
  const [rail, setRail] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [palette, setPalette] = useState(false);
  const [bell, setBell] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  /**
   * `?only=` is a trial of one module, arriving from the marketplace.
   *
   * Someone who clicked "ลองใช้" on a listing is evaluating that product, not
   * shopping the whole suite — a sidebar of ten modules answers a question they
   * did not ask and hides the one they did. The parameter narrows what is listed;
   * it is not a permission, which the role already decides.
   */
  const only = params.get("only");

  useEffect(() => {
    setRole(readSession());
    try {
      setRail(window.localStorage.getItem(RAIL) === "1");
    } catch {
      // Not remembering the rail is a smaller problem than not rendering.
    }
    const restore = captureRoot();
    const t = readTheme();
    setTheme(t);
    applyTheme(t);
    setReady(true);
    return restore;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const segments = pathname.split("/").filter(Boolean); // ["erp", id, section?]
  const current = MODULES.find((m) => m.id === segments[1]);
  const sectionAt = segments[2] ? Number(segments[2]) : undefined;

  const licensed = useMemo(
    () => (role ? MODULES.filter((m) => role.families.includes(m.family)) : []),
    [role]
  );
  const trial = only ? licensed.find((m) => m.id === only) : undefined;
  const open = trial ? [trial] : licensed;
  const alerts = useMemo(() => alertsFor(open), [open]);

  /** Every in-shell link keeps the trial, or one click would widen it silently. */
  const keep = (href: string) => (trial ? `${href}?only=${trial.id}` : href);

  // Nothing renders until the stored session has been read, or a signed-in
  // viewer would see the login form flash on every navigation.
  if (!ready) return <div className="min-h-screen bg-slate-100 dark:bg-slate-950" />;

  if (!role) {
    return (
      <SignIn
        theme={theme}
        onTheme={(t) => {
          setTheme(t);
          applyTheme(t);
        }}
        onSignIn={(r) => {
          writeSession(r.id);
          setRole(r);
        }}
      />
    );
  }

  const toggleRail = () => {
    setRail((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(RAIL, next ? "1" : "0");
      } catch {
        // Same as above.
      }
      return next;
    });
  };

  const sectionName = current
    ? sectionAt
      ? current.keyFeatures[sectionAt - 1]
      : current.hasOverview
        ? undefined
        : current.keyFeatures[0]
    : undefined;

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
      <aside
        className={
          "flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] dark:border-slate-800 dark:bg-slate-900 " +
          (rail ? "w-[60px]" : "w-60")
        }
      >
        <Link
          href={keep("/erp")}
          className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-4 dark:border-slate-800"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-600 text-[13px] font-bold text-white">
            F
          </span>
          {!rail && (
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-semibold text-slate-900 dark:text-slate-50">
                บจก. ตัวอย่างอุตสาหกรรม
              </span>
              <span className="block text-[11.5px] text-slate-500 dark:text-slate-400">
                ระบบบริหารทรัพยากรองค์กร
              </span>
            </span>
          )}
        </Link>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {FAMILIES.filter((f) => open.some((m) => m.family === f.id)).map((family) => (
            <div key={family.id} className="mb-4">
              {!rail && (
                <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {family.name}
                </p>
              )}
              {modulesOf(family.id).filter((m) => open.some((o) => o.id === m.id)).map((m) => {
                const on = current?.id === m.id;
                const Icon = ICONS[m.id] ?? LayoutGrid;
                return (
                  <div key={m.id}>
                    <Link
                      href={keep(`/erp/${m.id}`)}
                      title={rail ? m.name : undefined}
                      className={
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition " +
                        (on
                          ? "bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-50"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100")
                      }
                    >
                      <Icon size={16} className="shrink-0" />
                      {!rail && (
                        <>
                          <span className="min-w-0 flex-1 truncate">{m.name}</span>
                          <span className="shrink-0 text-[10.5px] text-slate-300 dark:text-slate-600">
                            {m.sapCode}
                          </span>
                        </>
                      )}
                    </Link>

                    {/* Only the open module lists its capabilities. Ten modules
                        expanded at once is a wall of fifty links nobody reads. */}
                    {on && !rail && (
                      <ul className="mb-1 ml-[18px] border-l border-slate-200 pl-2 dark:border-slate-800">
                        {m.hasOverview && (
                          <SubLink href={keep(`/erp/${m.id}`)} active={!sectionAt} label="ภาพรวม" />
                        )}
                        {m.keyFeatures.map((feature, i) => (
                          <SubLink
                            key={feature}
                            href={keep(`/erp/${m.id}/${i + 1}`)}
                            // Without a dashboard the index route renders the
                            // first capability, so that is what is highlighted.
                            active={sectionAt === i + 1 || (!sectionAt && !m.hasOverview && i === 0)}
                            label={feature}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-2 dark:border-slate-800">
          <button
            onClick={toggleRail}
            className="mb-2 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-500 transition hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60"
            title={rail ? "ขยายแถบเมนู" : "ยุบแถบเมนู"}
          >
            <ChevronsLeft size={15} className={"shrink-0 transition " + (rail ? "rotate-180" : "")} />
            {!rail && "ยุบแถบเมนู"}
          </button>

          <div className={"flex items-center gap-2.5 px-1 " + (rail ? "justify-center" : "")}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-200 text-[12px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {role.name.slice(0, 1)}
            </span>
            {!rail && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                  {role.name}
                </span>
                <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                  {role.title}
                </span>
              </span>
            )}
          </div>
          {!rail && (
            <button
              onClick={() => {
                clearSession();
                setRole(undefined);
                router.push("/erp");
              }}
              className="mt-2 w-full rounded-lg border border-slate-200 py-1.5 text-[12px] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700"
            >
              ออกจากระบบ
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          <nav aria-label="เส้นทาง" className="flex min-w-0 items-center gap-1 text-[12.5px]">
            <Link
              href={keep("/erp")}
              className="shrink-0 text-slate-400 transition hover:text-sky-600 dark:text-slate-500"
            >
              {trial ? "ทดลองใช้" : "หน้าแรก"}
            </Link>
            {current && (
              <>
                <ChevronRight size={13} className="shrink-0 text-slate-300 dark:text-slate-600" />
                <Link
                  href={keep(`/erp/${current.id}`)}
                  className={
                    "shrink-0 transition hover:text-sky-600 " +
                    (sectionName ? "text-slate-400 dark:text-slate-500" : "font-medium text-slate-800 dark:text-slate-100")
                  }
                >
                  {current.name}
                </Link>
              </>
            )}
            {sectionName && (
              <>
                <ChevronRight size={13} className="shrink-0 text-slate-300 dark:text-slate-600" />
                <span className="truncate font-medium text-slate-800 dark:text-slate-100">{sectionName}</span>
              </>
            )}
          </nav>

          <button
            onClick={() => setPalette(true)}
            className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[12px] text-slate-400 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-800 dark:text-slate-500"
          >
            <Search size={13} />
            <span className="hidden sm:inline">ค้นหา</span>
            <kbd className="hidden rounded border border-slate-200 px-1 font-sans text-[10px] sm:inline dark:border-slate-700">
              ⌘K
            </kbd>
          </button>

          <div className="relative">
            <button
              onClick={() => setBell((b) => !b)}
              aria-label={`การแจ้งเตือน ${alerts.length} รายการ`}
              className="relative rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-800 dark:text-slate-400"
            >
              <Bell size={14} />
              {alerts.length > 0 && (
                <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-rose-500 text-[9px] font-semibold text-white">
                  {alerts.length}
                </span>
              )}
            </button>
            {bell && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setBell(false)} />
                <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <p className="border-b border-slate-100 px-4 py-2.5 text-[12.5px] font-medium text-slate-800 dark:border-slate-800 dark:text-slate-100">
                    ต้องจัดการ {alerts.length} เรื่อง
                  </p>
                  <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                    {alerts.map((a) => (
                      <li key={a.id}>
                        <Link
                          href={a.href}
                          onClick={() => setBell(false)}
                          className="flex gap-2.5 px-4 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                        >
                          <span
                            className={
                              "mt-1 size-1.5 shrink-0 rounded-full " +
                              (a.tone === "bad" ? "bg-rose-500" : a.tone === "warn" ? "bg-amber-400" : "bg-sky-400")
                            }
                          />
                          <span className="min-w-0">
                            <span className="block text-[12.5px] text-slate-800 dark:text-slate-100">{a.title}</span>
                            <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                              {a.detail}
                            </span>
                            <span className="block text-[10.5px] text-slate-400 dark:text-slate-500">
                              {moduleName(a.moduleId)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                    {alerts.length === 0 && (
                      <li className="px-4 py-8 text-center text-[12.5px] text-slate-400 dark:text-slate-500">
                        ไม่มีเรื่องค้าง
                      </li>
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => {
              const next: Theme = theme === "dark" ? "light" : "dark";
              setTheme(next);
              applyTheme(next);
            }}
            aria-label={theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-sky-400 hover:text-sky-600 dark:border-slate-800 dark:text-slate-400"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {trial && <TrialSwitcher trial={trial} licensed={licensed} />}
          <TakeProject role={role} only={trial ?? undefined} />
          <Link
            href="/"
            className="hidden shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-600 transition hover:border-sky-400 hover:text-sky-700 lg:block dark:border-slate-800 dark:text-slate-300"
          >
            กลับหน้า FITT Builder
          </Link>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-5">{children}</main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} allowed={open} />
    </div>
  );
}

function SubLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className={
          "block rounded-md px-2 py-1.5 text-[12.5px] transition " +
          (active
            ? "bg-sky-50 font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100")
        }
      >
        {label}
      </Link>
    </li>
  );
}

function SignIn({
  onSignIn,
  theme,
  onTheme,
}: {
  onSignIn: (role: Role) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
}) {
  const [picked, setPicked] = useState(ROLES[0].id);
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const role = ROLES.find((r) => r.id === picked)!;

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-6 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-sky-600 text-base font-bold text-white">
            F
          </span>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            บจก. ตัวอย่างอุตสาหกรรม
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            เข้าสู่ระบบบริหารทรัพยากรองค์กร
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (password.trim()) onSignIn(role);
          }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            เข้าใช้งานในนาม
          </label>
          <div className="mt-1.5 space-y-1.5">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setPicked(r.id)}
                className={
                  "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition " +
                  (r.id === picked
                    ? "border-sky-500 bg-sky-50 dark:bg-sky-500/10"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700")
                }
              >
                <span
                  className={
                    "grid size-4 shrink-0 place-items-center rounded-full border " +
                    (r.id === picked ? "border-sky-600" : "border-slate-300 dark:border-slate-600")
                  }
                >
                  {r.id === picked && <span className="size-2 rounded-full bg-sky-600" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-slate-900 dark:text-slate-100">
                    {r.title}
                  </span>
                  <span className="block truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                    {r.email}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <label htmlFor="pw" className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
            รหัสผ่าน
          </label>
          <input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={DEMO_PASSWORD_HINT}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          {tried && !password.trim() && (
            <p className="mt-1.5 text-[12px] text-rose-600 dark:text-rose-400">กรอกรหัสผ่านก่อนเข้าสู่ระบบ</p>
          )}

          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            เข้าสู่ระบบ
          </button>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
              ระบบตัวอย่าง — เลือกฝ่ายเพื่อดูว่าสิทธิ์นั้นเปิดโมดูลอะไรได้บ้าง
            </p>
            <button
              type="button"
              onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
              aria-label="สลับธีม"
              className="shrink-0 rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:text-sky-600 dark:border-slate-800 dark:text-slate-400"
            >
              {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import type { ProjectFiles } from "./types";
import { PRELOADER_SVG } from "./scaffold-preloader";

/**
 * The demo runtime that lives inside the WebContainer: a Vite + React 18 app.
 *
 * A live scaffold is mounted the moment a studio session opens, so the
 * container (code + preview) is genuinely "open" from the first interview
 * question — and its `npm install` warms the dependency cache while the user
 * answers, so the first real Build skips installation entirely.
 *
 * Why Vite and not Next.js: every Next version that runs in WebContainer is
 * broken. Turbopack has no WASM build (crashes), and the webpack fallback on
 * Next 15.4.8+/15.5.x/16.x throws `Invariant: Expected workUnitAsyncStorage to
 * have a store` on every render (WASM-SWC env bug, vercel/next.js#84026,
 * stackblitz/webcontainer-core#1978 — open as of 2026). Vite is client-side
 * only (no SSR landmines), installs lighter, and starts faster — and a clickable
 * web demo needs nothing Next provides. Tailwind loads via the browser CDN so
 * the install tree stays react + react-dom + vite + the React plugin.
 *
 * TypeScript with ZERO extra dependencies: source is `.tsx`, but @vitejs/plugin-react
 * transpiles TS via its bundled Babel preset and `vite build` does not typecheck,
 * so the install tree (and therefore the cache key — see DEMO_PACKAGE_JSON) is
 * byte-identical to a JS project. tsconfig.json is config-only (no `typescript`
 * package needed at runtime); type errors never block the live preview.
 *
 * Everything is in `dependencies` (not devDependencies): npm inside WebContainer
 * omits devDependencies, so a build tool placed there (e.g. vite) silently never
 * installs → `vite: command not found`. The React plugin is the Babel-based
 * @vitejs/plugin-react (NOT -swc, which needs a native addon WebContainer bans).
 */

/**
 * Canonical package.json. The generator is forced to emit this EXACT string
 * (see app/api/generate/route.ts) so it is byte-identical to the scaffold's —
 * the WebContainer install cache is keyed on the package.json text, so an
 * identical string means Build reuses the scaffold's node_modules.
 */
export const DEMO_PACKAGE_JSON = `{
  "name": "fitt-demo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "vite": "^6.3.5",
    "@vitejs/plugin-react": "^4.3.4"
  }
}`;

/**
 * The Wand overlay, injected into every served page.
 *
 * Selection has to live INSIDE the iframe: the preview is cross-origin, so the
 * studio can neither read the demo's DOM nor hit-test it. This script hit-tests,
 * draws the glow, and posts the pick out; the studio only positions its composer
 * from the normalized rect (same mapping LiveCursors already does).
 *
 * Snapping targets `data-fitt-loc` — the attribute the Babel plugin below stamps
 * on every JSX host element — so the wand can only ever select something that
 * maps back to a real line of source the model can edit.
 */
const WAND_SCRIPT = `(function () {
  if (window.parent === window) return;
  var on = false, hover = null, picked = null, busy = false, box = null, tag = null, dim = null, raf = 0;

  function build() {
    if (box) return;
    var s = document.createElement("style");
    s.textContent =
      "#__fwbox{position:fixed;pointer-events:none;z-index:2147483646;border-radius:8px;overflow:hidden;background:rgba(100,206,251,.06);box-shadow:0 0 0 2px #64cefb,0 0 18px 4px rgba(100,206,251,.5),0 0 44px 10px rgba(147,124,255,.22);transition:top .12s cubic-bezier(.4,0,.2,1),left .12s cubic-bezier(.4,0,.2,1),width .12s cubic-bezier(.4,0,.2,1),height .12s cubic-bezier(.4,0,.2,1)}" +
      "#__fwbox.pick{animation:__fwpulse 1.5s ease-in-out infinite alternate}" +
      "#__fwbox.busy{animation:__fwbusy 1.1s ease-in-out infinite alternate}" +
      // The casting wave: a rainbow sweep that runs across the element being
      // rewritten, so the wait reads as "spell in progress" on the thing itself.
      "#__fwwave{position:absolute;inset:0;opacity:0;transition:opacity .2s;background:linear-gradient(115deg,transparent 18%,rgba(255,86,164,.38) 34%,rgba(100,206,251,.6) 50%,rgba(147,124,255,.55) 64%,rgba(86,255,196,.36) 78%,transparent 92%);background-size:280% 100%}" +
      "#__fwbox.busy #__fwwave{opacity:1;animation:__fwsweep 1.5s linear infinite}" +
      "#__fwtag{position:fixed;pointer-events:none;z-index:2147483647;font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#06121a;background:#64cefb;padding:2px 7px;border-radius:5px;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.45)}" +
      "#__fwtag.busy{background:linear-gradient(90deg,#64cefb,#937cff,#ff56a4,#64cefb);background-size:300% 100%;animation:__fwsweep 2s linear infinite;color:#0a0a0a}" +
      "#__fwdim{position:fixed;inset:0;pointer-events:none;z-index:2147483645;background:rgba(6,8,12,.42)}" +
      "@keyframes __fwpulse{to{box-shadow:0 0 0 2px #64cefb,0 0 30px 8px rgba(100,206,251,.85),0 0 80px 22px rgba(147,124,255,.4)}}" +
      "@keyframes __fwbusy{from{box-shadow:0 0 0 2px #64cefb,0 0 14px 3px rgba(100,206,251,.55)}to{box-shadow:0 0 0 2px #937cff,0 0 36px 12px rgba(147,124,255,.85)}}" +
      "@keyframes __fwsweep{from{background-position:160% 0}to{background-position:-60% 0}}" +
      "@media (prefers-reduced-motion:reduce){#__fwbox{transition:none}#__fwbox.pick,#__fwbox.busy,#__fwbox.busy #__fwwave,#__fwtag.busy{animation:none}}";
    document.head.appendChild(s);
    dim = document.createElement("div"); dim.id = "__fwdim";
    box = document.createElement("div"); box.id = "__fwbox";
    box.appendChild(Object.assign(document.createElement("i"), { id: "__fwwave" }));
    tag = document.createElement("div"); tag.id = "__fwtag";
  }

  /** Nearest ancestor (self included) that maps to a real line of source. */
  function target(el) {
    while (el && el !== document.documentElement) {
      if (el.getAttribute && el.getAttribute("data-fitt-loc")) return el;
      el = el.parentElement;
    }
    return null;
  }

  function paint() {
    var el = picked || hover;
    if (!el || !box.isConnected) return;
    var r = el.getBoundingClientRect();
    box.style.top = r.top - 2 + "px"; box.style.left = r.left - 2 + "px";
    box.style.width = r.width + 4 + "px"; box.style.height = r.height + 4 + "px";
    var above = r.top > 24;
    tag.style.top = (above ? r.top - 24 : r.bottom + 6) + "px";
    tag.style.left = Math.max(4, r.left - 2) + "px";
    tag.textContent = (el.getAttribute("data-fitt-loc") || "").split("/").pop();
  }

  function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; paint(); }); }

  function show(el) {
    build();
    if (!box.isConnected) { document.body.appendChild(dim); document.body.appendChild(box); document.body.appendChild(tag); }
    hover = el; paint();
  }

  function clear() {
    hover = null; picked = null; busy = false;
    if (box && box.isConnected) { box.remove(); tag.remove(); dim.remove(); }
    if (box) { box.className = ""; }
  }

  function describe(el) {
    var r = el.getBoundingClientRect();
    return {
      loc: el.getAttribute("data-fitt-loc"),
      tag: el.tagName.toLowerCase(),
      className: typeof el.className === "string" ? el.className.slice(0, 400) : "",
      text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160),
      rect: {
        x: r.left / innerWidth, y: r.top / innerHeight,
        w: r.width / innerWidth, h: r.height / innerHeight
      }
    };
  }

  addEventListener("message", function (e) {
    var d = e.data;
    if (!d || typeof d !== "object") return;
    if (d.__fittWand !== undefined) {
      on = !!d.__fittWand;
      document.documentElement.style.cursor = on ? "crosshair" : "";
      if (!on) clear();
    }
    if (d.__fittWandBusy !== undefined && box) {
      busy = !!d.__fittWandBusy;
      box.className = busy ? "busy" : picked ? "pick" : "";
      tag.className = busy ? "busy" : "";
      if (busy) tag.textContent = "กำลังเสก…";
      else paint();
    }
    // Composer closed: drop the selection but stay armed for the next pick.
    if (d.__fittWandClear) { picked = null; hover = null; if (box && box.isConnected) { box.remove(); tag.remove(); dim.remove(); } }
    // A quick patch just changed the element's size — re-measure after HMR paints.
    if (d.__fittWandRepaint && picked) setTimeout(paint, 60);
  });

  addEventListener("mousemove", function (e) {
    if (!on || picked) return;
    var el = target(document.elementFromPoint(e.clientX, e.clientY));
    if (!el) return;
    if (el !== hover) show(el); else schedule();
  }, true);

  addEventListener("click", function (e) {
    if (!on || picked) return;
    var el = target(e.target);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    picked = el; show(el); box.className = "pick";
    parent.postMessage(Object.assign({ __fittWandPick: true }, describe(el)), "*");
  }, true);

  // Swallow the interactions the demo would otherwise run while aiming.
  ["mousedown", "mouseup", "submit"].forEach(function (t) {
    addEventListener(t, function (e) { if (on) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  // Esc always LEAVES wand mode (not just the selection) — one predictable way
  // out, whether focus sits in the demo or in the studio.
  addEventListener("keydown", function (e) {
    if (!on || e.key !== "Escape") return;
    e.preventDefault(); e.stopPropagation();
    on = false; document.documentElement.style.cursor = "";
    clear(); parent.postMessage({ __fittWandExit: true }, "*");
  }, true);

  addEventListener("scroll", schedule, true);
  addEventListener("resize", schedule);
})();`;

/**
 * Canonical vite.config.js (forced by the generator on first build). Uses the
 * React plugin so JSX + Fast Refresh work and components need no `import React`.
 */
export const VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Injects the FITT bridge scripts into every served HTML, regardless of the
// generated index.html — this config is canonical (never authored by the AI).
// 1) live-cursor forwarder, so cursors work over the running prototype.
// 2) error reporter: runtime errors inside the demo (broken imports, React
//    crashes) happen in the IFRAME's console, invisible to the studio — this
//    posts them to the parent so a white screen becomes an actionable banner.
const fittBridge = {
  name: "fitt-bridge",
  transformIndexHtml() {
    return [
      {
        tag: "script",
        injectTo: "head",
        children:
          "(function(){if(window.parent===window)return;var p=false,lx=0,ly=0;addEventListener('mousemove',function(e){lx=e.clientX;ly=e.clientY;if(p)return;p=true;requestAnimationFrame(function(){p=false;parent.postMessage({__fittCursor:true,x:lx/innerWidth,y:ly/innerHeight},'*');});});addEventListener('mouseleave',function(){parent.postMessage({__fittCursor:true,leave:true},'*');});})();",
      },
      {
        tag: "script",
        injectTo: "head",
        children:
          "(function(){if(window.parent===window)return;var sent=0;function rpt(kind,message,stack){if(sent>=5)return;sent++;try{parent.postMessage({__fittPreviewError:true,kind:kind,message:String(message||'').slice(0,2000),stack:String(stack||'').slice(0,4000)},'*')}catch(e){}}addEventListener('error',function(e){if(e&&e.error){rpt('error',e.error.message||e.message,e.error.stack||'')}else if(e&&e.message){rpt('error',e.message,(e.filename||'')+(e.lineno?(':'+e.lineno):''))}else{var t=e&&e.target;if(t&&t.tagName==='SCRIPT'){rpt('resource','โหลดสคริปต์ไม่สำเร็จ: '+(t.src||''),'')}}},true);addEventListener('unhandledrejection',function(e){var r=e&&e.reason;rpt('promise',(r&&(r.message||String(r)))||'unhandled rejection',(r&&r.stack)||'')});})();",
      },
      // 3) Wand: point at an element in the running demo and edit exactly it.
      { tag: "script", injectTo: "head", children: ${JSON.stringify(WAND_SCRIPT)} },
    ];
  },
};

// Stamps data-fitt-loc="src/…/File.tsx:line:col" on every JSX host element so a
// click in the preview resolves to an exact line of source. Dev only — the
// exported/built app never carries it.
const fittLoc = ({ types: t }) => ({
  name: "fitt-loc",
  visitor: {
    JSXOpeningElement(path, state) {
      const name = path.node.name;
      // Host elements only (<div>, <button>); a component's own props are its API.
      if (name.type !== "JSXIdentifier" || !/^[a-z]/.test(name.name)) return;
      if (!path.node.loc || !state.filename) return;
      if (path.node.attributes.some((a) => a.type === "JSXAttribute" && a.name.name === "data-fitt-loc")) return;
      const rel = state.filename.split("/src/")[1];
      if (!rel) return;
      const { line, column } = path.node.loc.start;
      path.node.attributes.push(
        t.jsxAttribute(
          t.jsxIdentifier("data-fitt-loc"),
          t.stringLiteral("src/" + rel + ":" + line + ":" + column)
        )
      );
    },
  },
});

export default defineConfig(({ command }) => ({
  plugins: [react(command === "serve" ? { babel: { plugins: [fittLoc] } } : {}), fittBridge],
  server: { host: true },
}));
`;

/**
 * Canonical tsconfig.json (forced by the generator on first build, like
 * vite.config.js). Config-only — no `typescript` package is installed; Vite's
 * esbuild/Babel pipeline reads `jsx`/`target` from here. Kept non-strict and
 * lenient so the generated demo never trips type noise that the user would see.
 */
export const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": ["src"]
}
`;

/** Trim npm install chatter/latency inside the container. */
const NPMRC = `audit=false
fund=false
`;

/**
 * index.html shared in spirit by the scaffold and every generated demo: loads
 * Tailwind (CDN) + the FITT fonts and mounts the React root. The generator is
 * told to reproduce this <head> so the look stays consistent after Build.
 */
const SCAFFOLD_INDEX_HTML = `<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FITT Demo</title>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Anuphan:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      body { font-family: 'Anuphan', 'Inter', system-ui, sans-serif; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const SCAFFOLD_MAIN = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`;

const SCAFFOLD_INDEX_CSS = `:root { color-scheme: dark; }
body { margin: 0; }
`;

/**
 * The live "stage" page shown in the preview while the user is interviewed —
 * not a gimmick, but a calm waiting state: a SMIL-animated "building" loader
 * (served from the scaffold's own /public so it works inside the WebContainer)
 * plus a rotating "what FITT can do" carousel, so the wait teaches the product.
 * The first Build replaces this with the generated demo.
 */
const SCAFFOLD_APP = `import { useEffect, useState } from "react";

const TIPS = [
  ["AI", "พิมพ์ภาษาธรรมดาเพื่อแก้ — เช่น “เปลี่ยนสีปุ่มเป็นน้ำเงิน” แล้ว AI แก้ให้"],
  ["npm", "ต้องใช้ไลบรารีอะไร AI ติดตั้ง npm package ให้อัตโนมัติ"],
  ["</>", "เปิดแท็บ Code เพื่อดู/แก้ไฟล์ทั้งหมดได้เอง แล้วเห็นผลทันที"],
  ["DNA", "ผูก Org DNA เพื่อให้ดีไซน์และ flow เข้ากับองค์กรของคุณ"],
  ["zip", "กด Export เป็น .zip หรือแชร์ลิงก์ให้ทีมเปิดดูได้โดยไม่ต้อง login"],
];

export default function App() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % TIPS.length), 3200);
    return () => clearInterval(id);
  }, []);
  const [tag, tip] = TIPS[i];
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#0a0a0a] px-6 text-center text-white">
      <style>{".tip-fade{animation:tipfade .45s ease}@keyframes tipfade{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}"}</style>

      <div className="flex items-center gap-2 text-xs text-white/70">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#64cefb]" />
        <span className="font-semibold tracking-tight text-white">FITT Builder</span>
        <span className="text-white/40">· Code Viewer + Preview Prototype</span>
      </div>

      {/* SMIL-animated SVG (transparent bg) → plays inside a plain <img>, no
          script and no COEP concerns. */}
      <img
        src="/preloader.svg"
        alt="กำลังเตรียมเวที"
        className="aspect-square w-full max-w-[260px]"
      />

      <div>
        <h1 className="text-2xl font-semibold leading-snug">เวทีของคุณพร้อมแว๊ววว!! · กำลังรอบทสนทนา</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/55">
          ตอบคำถามทางซ้ายเพื่อสร้าง BRD &amp; PRD — พออนุมัติแล้ว AI จะ generate
          demo จริงทับหน้านี้ทันที
        </p>
      </div>

      <div className="flex min-h-[3.25rem] w-full max-w-md items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#64cefb]/15 font-mono text-[11px] font-semibold text-[#64cefb]">
          {tag}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-[#64cefb]">FITT ทำอะไรได้บ้าง</p>
          <p key={i} className="tip-fade text-sm text-white/80">{tip}</p>
        </div>
      </div>
    </main>
  );
}
`;

/** The full file set mounted to boot the live preview on session open. */
export const SCAFFOLD_FILES: ProjectFiles = {
  "package.json": DEMO_PACKAGE_JSON,
  ".npmrc": NPMRC,
  "vite.config.js": VITE_CONFIG,
  "tsconfig.json": TSCONFIG,
  "index.html": SCAFFOLD_INDEX_HTML,
  "src/main.tsx": SCAFFOLD_MAIN,
  "src/App.tsx": SCAFFOLD_APP,
  "src/index.css": SCAFFOLD_INDEX_CSS,
  // Served by Vite at /preloader.svg — the scaffold has its own filesystem, so
  // the asset must live here (it can't reach the FITT app's /public).
  "public/preloader.svg": PRELOADER_SVG,
};

/** Dependency names that belong to the canonical scaffold (not user-added). */
function baseDeps(): Record<string, string> {
  return JSON.parse(DEMO_PACKAGE_JSON).dependencies as Record<string, string>;
}

/** react / react-dom / vite / @vitejs/plugin-react — never re-resolvable by the model. */
export const BASE_DEP_NAMES: ReadonlySet<string> = new Set(Object.keys(baseDeps()));

/**
 * Which <deps> names actually need installing. A declared package that is
 * already present must be dropped, not re-added: re-adding pins it to "latest"
 * (a React-18 demo could jump to a React-19-only major) and rewrites
 * package.json, which invalidates the WebContainer install cache and forces a
 * full reinstall + container reboot for nothing.
 */
export function newPackages(declared: string[], installed: Record<string, string>): string[] {
  return declared.filter((name) => !BASE_DEP_NAMES.has(name) && !(name in installed));
}

/** Extra (user-installed) dependencies beyond the canonical scaffold base. */
export function extraDepsOf(packageJson?: string): Record<string, string> {
  if (!packageJson) return {};
  try {
    const base = baseDeps();
    const deps = (JSON.parse(packageJson).dependencies ?? {}) as Record<
      string,
      unknown
    >;
    const extra: Record<string, string> = {};
    for (const [name, version] of Object.entries(deps)) {
      if (!(name in base) && typeof version === "string") extra[name] = version;
    }
    return extra;
  } catch {
    return {};
  }
}

/**
 * Canonical package.json plus any extra (user-installed npm) dependencies.
 * With no extras it returns the scaffold copy byte-for-byte so the WebContainer
 * install cache still hits; with extras it diverges — a deliberate reinstall.
 */
export function packageJsonWithDeps(extra: Record<string, string>): string {
  if (Object.keys(extra).length === 0) return DEMO_PACKAGE_JSON;
  const pkg = JSON.parse(DEMO_PACKAGE_JSON);
  pkg.dependencies = { ...pkg.dependencies, ...extra };
  return JSON.stringify(pkg, null, 2);
}

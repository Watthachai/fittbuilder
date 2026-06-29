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
 * Canonical vite.config.js (forced by the generator on first build). Uses the
 * React plugin so JSX + Fast Refresh work and components need no `import React`.
 */
export const VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Injects the FITT live-cursor forwarder into every served HTML, regardless of
// the generated index.html — this config is canonical (never authored by the AI),
// so cursors work over the running prototype for every project.
const fittCursorForward = {
  name: "fitt-cursor-forward",
  transformIndexHtml() {
    return [
      {
        tag: "script",
        injectTo: "head",
        children:
          "(function(){if(window.parent===window)return;var p=false,lx=0,ly=0;addEventListener('mousemove',function(e){lx=e.clientX;ly=e.clientY;if(p)return;p=true;requestAnimationFrame(function(){p=false;parent.postMessage({__fittCursor:true,x:lx/innerWidth,y:ly/innerHeight},'*');});});addEventListener('mouseleave',function(){parent.postMessage({__fittCursor:true,leave:true},'*');});})();",
      },
    ];
  },
};

export default defineConfig({
  plugins: [react(), fittCursorForward],
  server: { host: true },
});
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
 * not a gimmick, but a calm waiting state: the anthropomorphic preloader (served
 * from the scaffold's own /public so it works inside the WebContainer) plus a
 * rotating "what FITT can do" carousel, so the wait teaches the product. The
 * first Build replaces this with the generated demo.
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
        <span className="text-white/40">· Vite + React · รันสดในเบราว์เซอร์</span>
      </div>

      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
        {/* <object> (not <img>): this preloader animates via an internal <script>,
            which only runs when the SVG loads as its own document. pointer-events
            off so it stays decorative. */}
        <object
          type="image/svg+xml"
          data="/preloader.svg"
          aria-label="กำลังเตรียมเวที"
          className="pointer-events-none block aspect-[7/4] w-full"
        >
          กำลังเตรียมเวที…
        </object>
      </div>

      <div>
        <h1 className="text-2xl font-semibold leading-snug">เวทีพร้อมแล้ว · กำลังรอบทสนทนา</h1>
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

/** Extra (user-installed) dependencies beyond the canonical scaffold base. */
export function extraDepsOf(packageJson?: string): Record<string, string> {
  if (!packageJson) return {};
  try {
    const base = baseDeps();
    const deps = (JSON.parse(packageJson).dependencies ?? {}) as Record<string, unknown>;
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

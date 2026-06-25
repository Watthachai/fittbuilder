import type { ProjectFiles } from "./types";

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
 * A real, interactive starter page (create-vite style) so the preview shows a
 * running app from the first second — not an empty placeholder. The first Build
 * replaces this with the generated demo.
 */
const SCAFFOLD_APP = `import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-6 text-center text-white">
      <div className="flex items-center gap-2 text-sm">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#64cefb]" />
        <span className="font-semibold tracking-tight">FITT Builder</span>
        <span className="text-white/40">· Vite + React</span>
      </div>
      <h1 className="max-w-xl text-3xl font-semibold leading-snug">
        เวทีพร้อมแล้ว — โปรเจกต์กำลังรันสดในเบราว์เซอร์
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-white/50">
        ตอบคำถามทางซ้ายเพื่อสร้าง BRD &amp; PRD — เมื่ออนุมัติแล้ว AI จะ generate
        demo จริงทับหน้านี้ทันที
      </p>
      <button
        onClick={() => setCount((c) => c + 1)}
        className="rounded-full bg-[#64cefb] px-6 py-2.5 font-medium text-black transition hover:brightness-110"
      >
        ลองกดดูว่ามันรันจริง: {count}
      </button>
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

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
 * Error reporter. Runtime errors inside the demo happen in the IFRAME's console,
 * invisible to the studio — this posts them to the parent so a white screen
 * becomes an actionable banner.
 *
 * The subtle part is compile errors. When Vite fails to transform a module it
 * answers 500 for that request and mounts <vite-error-overlay>, so all the page
 * sees is "script failed to load" — a message that tells the user (and the AI
 * asked to fix it) exactly nothing. The real text — "Failed to resolve import
 * './components/Sidebar' from 'src/App.tsx'" — lives in the overlay's shadow
 * root, so we read it there and hold the vague resource error back in case a
 * compile error is about to explain it properly.
 */
const ERROR_SCRIPT = `(function () {
  if (window.parent === window) return;
  var sent = 0, sawCompile = false;

  function rpt(kind, message, stack) {
    if (sent >= 5) return;
    sent++;
    try {
      parent.postMessage({
        __fittPreviewError: true, kind: kind,
        message: String(message || "").slice(0, 2000),
        stack: String(stack || "").slice(0, 4000)
      }, "*");
    } catch (e) {}
  }

  /** Pull message + file + code frame out of Vite's overlay. */
  function readOverlay(el) {
    try {
      var root = el.shadowRoot;
      if (!root) return null;
      var q = function (sel) {
        var n = root.querySelector(sel);
        return n ? (n.textContent || "").trim() : "";
      };
      var message = q(".message-body") || q(".message");
      if (!message) return null;
      var file = q(".file"), frame = q(".frame"), stack = q(".stack");
      return {
        message: message,
        stack: [file && ("ไฟล์: " + file), frame, stack].filter(Boolean).join("\\n")
      };
    } catch (e) { return null; }
  }

  function scanOverlay(node) {
    if (!node || node.nodeType !== 1) return;
    var el = node.tagName && node.tagName.toLowerCase() === "vite-error-overlay"
      ? node
      : node.querySelector && node.querySelector("vite-error-overlay");
    if (!el) return;
    // The overlay mounts before its shadow content settles — read on the next frame.
    setTimeout(function () {
      var d = readOverlay(el);
      if (!d) return;
      sawCompile = true;
      rpt("compile", d.message, d.stack);
    }, 40);
  }

  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes;
      for (var j = 0; j < added.length; j++) scanOverlay(added[j]);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener("DOMContentLoaded", function () { scanOverlay(document.body); });

  addEventListener("error", function (e) {
    if (e && e.error) { rpt("error", e.error.message || e.message, e.error.stack || ""); return; }
    if (e && e.message) { rpt("error", e.message, (e.filename || "") + (e.lineno ? ":" + e.lineno : "")); return; }
    var t = e && e.target;
    if (t && t.tagName === "SCRIPT") {
      var src = t.src || "";
      // Give the overlay a moment: "failed to load /src/main.tsx" is the symptom,
      // the compile error is the cause and it reads far better.
      setTimeout(function () {
        if (!sawCompile) rpt("resource", "โหลดสคริปต์ไม่สำเร็จ: " + src, "");
      }, 600);
    }
  }, true);

  addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    rpt("promise", (r && (r.message || String(r))) || "unhandled rejection", (r && r.stack) || "");
  });
})();`;

/**
 * Screen capture + auto-walk, for building the screen inventory a quotation is
 * written from.
 *
 * Like everything else here it must run INSIDE the demo: the preview is
 * cross-origin, so the studio can neither read its DOM nor rasterise it (a
 * canvas drawn from a cross-origin frame is tainted). html-to-image serialises
 * the DOM into an SVG foreignObject, so Tailwind styling and recharts SVG come
 * out intact — and it is loaded lazily, only when a capture is actually asked
 * for, so normal previews pay nothing.
 */
const SHOT_SCRIPT = `(function () {
  if (window.parent === window) return;
  var LIB = "https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js";
  var libP = null, stop = false;

  function lib() {
    if (libP) return libP;
    libP = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = LIB;
      s.onload = function () { res(window.htmlToImage); };
      s.onerror = function () { rej(new Error("โหลดตัวแคปหน้าจอไม่สำเร็จ")); };
      document.head.appendChild(s);
    });
    return libP;
  }

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function shoot() {
    return lib().then(function (h) {
      var bg = getComputedStyle(document.body).backgroundColor;
      return h.toPng(document.body, {
        pixelRatio: 1,
        backgroundColor: bg && bg !== "rgba(0, 0, 0, 0)" ? bg : "#ffffff",
        // Never photograph our own overlays (wand frame, label, dim).
        filter: function (n) { return !(n.id && String(n.id).indexOf("__fw") === 0); }
      });
    });
  }

  var norm = function (s) { return String(s || "").replace(/\\s+/g, " ").trim().toLowerCase(); };

  /**
   * Click the DEEPEST visible element whose text matches. Depth matters: a
   * company card or a table row is a <div>, and its text also belongs to every
   * ancestor up to <body> — clicking the outermost match hits the page wrapper
   * and does nothing. React events bubble, so the innermost node works.
   */
  function clickText(text) {
    var want = norm(text);
    if (!want) return false;
    var nodes = document.querySelectorAll("button,a,[role],li,summary,label,tr,td,div,span,p,h1,h2,h3,h4");
    var exact = null, partial = null;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el.offsetParent && getComputedStyle(el).position !== "fixed") continue;
      var t = norm(el.textContent);
      if (!t) continue;
      // Document order runs outer → inner for the same text, so keep the LAST
      // match: that is the innermost element carrying it.
      if (t === want) exact = el;
      else if (t.indexOf(want) !== -1 && t.length <= want.length + 30) partial = el;
    }
    var hit = exact || partial;
    if (!hit) return false;
    hit.click();
    return true;
  }

  /** Cheap fingerprint of the current view — tells "navigated" from "nothing happened". */
  function sig() {
    return norm(document.body.innerText).slice(0, 400) + "|" + location.hash;
  }

  function send(msg) { try { parent.postMessage(msg, "*"); } catch (e) {} }

  async function walk(plan, setup) {
    stop = false;
    var total = 0;
    for (var i = 0; i < plan.length; i++) total += 1 + ((plan[i].subs || []).length);
    var step = 0;

    // Gates first. A demo that opens on sign-in or a company picker goes nowhere
    // until those are cleared, and every later click then lands on the same
    // page. These are entry steps, not screens — they are not photographed.
    for (var g = 0; g < (setup || []).length; g++) {
      var passed = clickText(setup[g]);
      send({
        __fittWalkStep: true, step: 0, total: total, ok: passed,
        name: "ผ่านหน้ากั้น: " + setup[g],
        error: passed ? undefined : "ไม่พบปุ่ม “" + setup[g] + "”"
      });
      await sleep(900);
    }

    var last = "";
    for (var s = 0; s < plan.length; s++) {
      if (stop) break;
      var screen = plan[s];
      step++;
      var before = sig();
      if (screen.navText) clickText(screen.navText);
      await sleep(screen.navText ? 800 : 250);
      // Nothing moved → the click missed, or a gate is still up. Shooting now
      // would file a copy of the previous screen under this screen's name — the
      // exact kind of lie a quotation must not be built on.
      if (screen.navText && sig() === before && sig() === last) {
        send({
          __fittWalkStep: true, step: step, total: total, name: screen.name, ok: false,
          error: "คลิกแล้วหน้าไม่เปลี่ยน — อาจติดหน้ากั้นหรือชื่อปุ่มไม่ตรง"
        });
        continue;
      }
      last = sig();
      try {
        send({ __fittShot: true, name: screen.name, parent: null, dataUrl: await shoot() });
        send({ __fittWalkStep: true, step: step, total: total, name: screen.name, ok: true });
      } catch (e) {
        send({ __fittWalkStep: true, step: step, total: total, name: screen.name, ok: false, error: String(e && e.message || e) });
      }
      var subs = screen.subs || [];
      for (var k = 0; k < subs.length; k++) {
        if (stop) break;
        var sub = subs[k];
        step++;
        var opened = clickText(sub.openBy);
        await sleep(650);
        if (!opened) {
          send({ __fittWalkStep: true, step: step, total: total, name: sub.name, ok: false, error: "ไม่พบปุ่ม “" + sub.openBy + "”" });
          continue;
        }
        try {
          send({ __fittShot: true, name: sub.name, parent: screen.name, dataUrl: await shoot() });
          send({ __fittWalkStep: true, step: step, total: total, name: sub.name, ok: true });
        } catch (e2) {
          send({ __fittWalkStep: true, step: step, total: total, name: sub.name, ok: false, error: String(e2 && e2.message || e2) });
        }
        if (!clickText(sub.closeBy)) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        }
        await sleep(400);
      }
    }
    send({ __fittWalkDone: true });
  }

  addEventListener("message", function (e) {
    var d = e.data;
    if (!d || typeof d !== "object") return;
    if (d.__fittShotOne) {
      shoot()
        .then(function (dataUrl) { send({ __fittShot: true, name: d.name || "หน้าจอ", parent: null, dataUrl: dataUrl }); send({ __fittWalkDone: true }); })
        .catch(function (err) { send({ __fittWalkStep: true, step: 1, total: 1, name: d.name || "หน้าจอ", ok: false, error: String(err && err.message || err) }); send({ __fittWalkDone: true }); });
    }
    if (d.__fittWalk && Array.isArray(d.plan)) void walk(d.plan, d.setup || []);
    if (d.__fittWalkStop) stop = true;
  });
})();`;

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
      // Fully opaque on purpose: while a cast runs, the element is being rewritten
      // and there is nothing useful to read through it — the moving colour IS the
      // progress. Solid stops (no alpha), so nothing shows through.
      //
      // Seamlessness has two hard requirements, and breaking either one puts a
      // visible edge in the middle of the element:
      //   1. the gradient runs at 90deg — a diagonal one cannot tile without a
      //      seam, because at a given y the tile's left and right edges are at
      //      different points along the gradient axis;
      //   2. the first and last stop are the same colour, the tile is a fixed
      //      600px, and the animation travels exactly 600px — one whole tile, so
      //      the loop restarts on an identical frame.
      "#__fwwave{position:absolute;inset:0;opacity:0;transition:opacity .3s;background-image:linear-gradient(90deg,#ff56a4 0%,#ff7ac0 10%,#64cefb 28%,#4aa8ff 42%,#937cff 58%,#56ffc4 76%,#64cefb 90%,#ff56a4 100%);background-size:600px 100%;background-repeat:repeat}" +
      "#__fwbox.busy #__fwwave{opacity:.96;animation:__fwsweep 6s linear infinite}" +
      "#__fwtag{position:fixed;pointer-events:none;z-index:2147483647;font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#06121a;background:#64cefb;padding:2px 7px;border-radius:5px;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.45)}" +
      "#__fwtag.busy{background-image:linear-gradient(90deg,#64cefb 0%,#937cff 33%,#ff56a4 66%,#64cefb 100%);background-size:300px 100%;background-repeat:repeat;animation:__fwtagsweep 4s linear infinite;color:#0a0a0a}" +
      "#__fwdim{position:fixed;inset:0;pointer-events:none;z-index:2147483645;background:rgba(6,8,12,.42)}" +
      "@keyframes __fwpulse{to{box-shadow:0 0 0 2px #64cefb,0 0 30px 8px rgba(100,206,251,.85),0 0 80px 22px rgba(147,124,255,.4)}}" +
      "@keyframes __fwbusy{from{box-shadow:0 0 0 2px #64cefb,0 0 14px 3px rgba(100,206,251,.55)}to{box-shadow:0 0 0 2px #937cff,0 0 36px 12px rgba(147,124,255,.85)}}" +
      "@keyframes __fwsweep{from{background-position:0 0}to{background-position:600px 0}}" +
      "@keyframes __fwtagsweep{from{background-position:0 0}to{background-position:300px 0}}" +
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
      { tag: "script", injectTo: "head", children: ${JSON.stringify(ERROR_SCRIPT)} },
      // 3) Wand: point at an element in the running demo and edit exactly it.
      { tag: "script", injectTo: "head", children: ${JSON.stringify(WAND_SCRIPT)} },
      // 4) Screen capture + auto-walk, for the screen inventory / quotation.
      { tag: "script", injectTo: "head", children: ${JSON.stringify(SHOT_SCRIPT)} },
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

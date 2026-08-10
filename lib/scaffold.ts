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
 * Version of the capture bridge. Bump on every change to SHOT_SCRIPT so a studio
 * tab running against an older container can tell, instead of silently
 * reproducing the bug that was just fixed.
 */
export const SHOT_BRIDGE_VERSION = 18;

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
  // Bumped whenever this script changes. These scripts live in vite.config.js,
  // which is only rewritten when the container mounts — so a studio tab left
  // open keeps running an old copy, and a fix looks like it did nothing. The
  // studio compares this against its own constant and says so.
  var VERSION = ${SHOT_BRIDGE_VERSION};
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

  /**
   * @param clip Frame the VIEWPORT instead of the whole document.
   *
   * A modal is position:fixed, so it sits one viewport tall; the page behind it
   * can be six. Rasterising the whole body then produces a very long image with
   * the dialog as a small box at the top — the modal "ปิดไม่หมด" in the
   * reported gallery. Screens still get the full page, which is what you want
   * to see of a screen.
   */
  function shoot(clip) {
    return lib().then(function (h) {
      var bg = getComputedStyle(document.body).backgroundColor;
      var opts = {
        pixelRatio: 1,
        backgroundColor: bg && bg !== "rgba(0, 0, 0, 0)" ? bg : "#ffffff",
        // Never photograph our own overlays (wand frame, label, dim).
        filter: function (n) { return !(n.id && String(n.id).indexOf("__fw") === 0); }
      };
      if (clip) { opts.width = innerWidth; opts.height = innerHeight; }
      return h.toPng(document.body, opts);
    });
  }

  var norm = function (s) { return String(s || "").replace(/\\s+/g, " ").trim().toLowerCase(); };

  /**
   * Is this element actually on screen?
   *
   * NOT offsetParent. Per CSSOM, offsetParent is null when the element's own
   * computed position is fixed — so "if (!el.offsetParent) skip" silently
   * discarded every fixed layer, which is exactly what a modal backdrop is.
   * fixedLayers() therefore returned an empty array on every page, every
   * hand-rolled dialog was invisible to the detector, and a modal that could
   * not be found could not be closed: it rode along into the next five
   * screenshots. Measure the box instead — it is zero for display:none and for
   * a detached node, and it is correct for fixed.
   */
  function visible(el) {
    if (!el || !el.isConnected) return false;
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    var s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.opacity !== "0";
  }

  /**
   * Click the DEEPEST visible element whose text matches. Depth matters: a
   * company card or a table row is a <div>, and its text also belongs to every
   * ancestor up to <body> — clicking the outermost match hits the page wrapper
   * and does nothing. React events bubble, so the innermost node works.
   */
  function locate(text) {
    var want = norm(text);
    if (!want) return null;
    var nodes = document.querySelectorAll("button,a,[role],li,summary,label,tr,td,div,span,p,h1,h2,h3,h4");
    var exact = null, partial = null;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!visible(el)) continue;
      var t = norm(el.textContent);
      if (!t) continue;
      // Document order runs outer → inner for the same text, so keep the LAST
      // match: that is the innermost element carrying it.
      if (t === want) exact = el;
      else if (t.indexOf(want) !== -1 && t.length <= want.length + 30) partial = el;
    }
    return exact || partial;
  }

  function clickText(text) {
    var hit = locate(text);
    if (!hit) return false;
    // A long sidebar puts later items below the fold; some UIs ignore clicks on
    // what they consider off-screen, and it makes the capture land mid-scroll.
    try { hit.scrollIntoView({ block: "center" }); } catch (e) {}
    hit.click();
    return true;
  }

  // Words that open a gate. Ordered by how strongly they mean "go forward".
  var GATE_WORDS = /(เข้าสู่ระบบ|เข้าใช้งาน|ล็อกอิน|เริ่มใช้งาน|เริ่มต้น|ถัดไป|ต่อไป|ดำเนินการต่อ|ตกลง|ยืนยัน|เลือก|เข้า|log ?in|sign ?in|continue|next|start|enter)/i;
  // Words this app itself uses, supplied by the map. They ADD to the lists
  // above, never replace them: this fallback runs precisely when the map got
  // something wrong, so it must not depend entirely on the map being right.
  var appForward = [], appAvoid = [];
  var listed = function (t, arr) {
    for (var i = 0; i < arr.length; i++) if (arr[i] && t.indexOf(norm(arr[i])) !== -1) return true;
    return false;
  };
  // Never click these while hunting for a way in: they take you further out.
  var LEAVE_WORDS = /(ออกจากระบบ|ล็อกเอาต์|ออกจาก|log ?out|sign ?out|ลบ|delete|remove|รีเซ็ต|reset|ยกเลิก|cancel|ปิด|close|ย้อนกลับ|กลับ|back)/i;
  // Hunting for a way IN must never create or change anything. Clicking
  // "สร้างบริษัท" opened a new-company form and wedged the whole pass — the
  // gate we want says sign in / select / continue, never "make one".
  var MUTATE_WORDS = /(สร้าง|เพิ่ม|บันทึก|ส่ง|แก้ไข|นำเข้า|อัปโหลด|create|add|new|save|submit|upload|import|edit)/i;

  /**
   * Does React have a click handler on this element?
   *
   * Guessing "what looks clickable" from tag and size picked tab strips and a
   * logout button on the reported demo. React stores the element's props on the
   * DOM node under a __reactProps$… key, so we can ask what is ACTUALLY wired
   * instead — precise, and available because the preview always runs in dev.
   */
  function hasClick(el) {
    for (var k in el) {
      if (k.indexOf("__reactProps$") !== 0) continue;
      var p = el[k];
      return !!(p && typeof p.onClick === "function");
    }
    return false;
  }

  /**
   * Find something to click when the demo is sitting behind a gate: a sign-in
   * button, a company card, a welcome step. Only real handlers are considered,
   * never anything that leads out (logout, cancel, delete), and never a wrapper
   * that contains other clickable things — that is the list, not the item.
   */
  function gateCandidate(tried, allowNested) {
    var nodes = document.querySelectorAll("*");
    var best = null, bestScore = -1;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (tried.indexOf(el) !== -1) continue;
      if (el.disabled || !visible(el)) continue;
      if (!hasClick(el)) continue;
      var t = norm(el.textContent);
      if (!t || t.length > 90 || LEAVE_WORDS.test(t) || listed(t, appAvoid)) continue;
      if (MUTATE_WORDS.test(t)) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 20) continue;
      // A card list is clickable AND contains clickable cards — take the card.
      // But a row that wraps its own button would be excluded by that same
      // rule, and on a "pick an account" screen every candidate looks like
      // that, leaving nothing to click at all. So the strict pass runs first
      // and the relaxed one is the second chance.
      if (!allowNested) {
        var inner = el.querySelectorAll("*"), nested = false;
        for (var j = 0; j < inner.length; j++) if (hasClick(inner[j])) { nested = true; break; }
        if (nested) continue;
      }
      var score = 0;
      if (GATE_WORDS.test(t) || listed(t, appForward)) score += 120;
      score += Math.min(r.width * r.height, 90000) / 9000; // a card beats a tab
      if (score > bestScore) { bestScore = score; best = el; }
    }
    return best;
  }

  /**
   * The dialog currently on screen, if any.
   *
   * Structural, not label-based: role="dialog"/aria-modal covers the common
   * case, and a large fixed-position layer covers the hand-rolled ones that
   * generated demos usually produce. This is what lets modals be found without
   * knowing in advance which button opens them.
   */
  /** Every large fixed-position layer on screen right now. */
  function fixedLayers() {
    var out = [], all = document.querySelectorAll("div,section,aside");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!visible(el) || (el.id || "").indexOf("__fw") === 0) continue;
      if (getComputedStyle(el).position !== "fixed") continue;
      var r = el.getBoundingClientRect();
      if (r.width * r.height < innerWidth * innerHeight * 0.1) continue;
      out.push(el);
    }
    return out;
  }

  /**
   * The dialog that just opened.
   *
   * Detected by DIFFERENCE, not by shape: comparing the fixed layers before and
   * after the click catches hand-rolled modals that carry no role="dialog", no
   * aria-modal, no heading tag and no particular z-index — which is most of
   * what a generated demo produces. Requiring any of those meant a modal could
   * visibly open and still not be captured.
   */
  function openDialog(before) {
    var tagged = document.querySelectorAll('[role="dialog"],[aria-modal="true"]');
    for (var i = 0; i < tagged.length; i++) if (visible(tagged[i])) return tagged[i];
    var now = fixedLayers();
    if (before) {
      for (var j = 0; j < now.length; j++) if (before.indexOf(now[j]) === -1) return now[j];
      return null;
    }
    // Recording has no before/after pair to diff, so judge by shape instead:
    // the highest layer that actually contains a title. Taking merely the first
    // fixed layer picked up sticky headers and named modals after them.
    var best = null, bestZ = -1;
    for (var k = 0; k < now.length; k++) {
      var el = now[k];
      if (!el.querySelector("h1,h2,h3,h4,[class*=text-lg],[class*=text-xl],[class*=font-bold],[class*=font-semibold]")) continue;
      var z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
      if (z >= bestZ) { bestZ = z; best = el; }
    }
    return best;
  }

  /** What the dialog calls itself — the name that belongs on the quotation. */
  function dialogName(d, fallback) {
    var h = d.querySelector("h1,h2,h3,h4");
    var t = h ? norm(h.textContent) : "";
    if (!t) {
      // Demos title their modals with a styled div as often as a heading tag.
      var big = d.querySelectorAll("[class*=text-lg],[class*=text-xl],[class*=text-2xl],[class*=font-bold],[class*=font-semibold],strong,b");
      for (var i = 0; i < big.length && !t; i++) {
        var c = norm(big[i].textContent);
        if (c && c.length >= 3 && c.length <= 60) t = c;
      }
    }
    return (t || norm(fallback) || "หน้าต่างย่อย").slice(0, 60);
  }

  var CLOSE_LABEL = /^(ปิด|ยกเลิก|ไม่|ย้อนกลับ|กลับ|close|cancel|dismiss|back|×|✕|✖|x)$/;

  /**
   * Ways out of the dialog, best first.
   *
   * A labelled ยกเลิก/Close comes first; failing that, a small icon-only button
   * near the dialog's top edge — the × that carries no text at all, which is
   * how most generated modals write it.
   */
  function closers(d) {
    var out = [], btns = d.querySelectorAll("button,[role=button],a");
    var dr = d.getBoundingClientRect();
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.disabled || !visible(b)) continue;
      var label = norm(b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent);
      if (CLOSE_LABEL.test(label)) { out.push({ el: b, score: 2 }); continue; }
      if (!label && b.querySelector("svg")) {
        var r = b.getBoundingClientRect();
        if (r.width <= 56 && r.height <= 56 && r.top - dr.top < 90) out.push({ el: b, score: 1 });
      }
    }
    out.sort(function (a, c) { return c.score - a.score; });
    return out;
  }

  function pressEscape() {
    var init = { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true };
    document.dispatchEvent(new KeyboardEvent("keydown", init));
    document.dispatchEvent(new KeyboardEvent("keyup", init));
    var focused = document.activeElement;
    if (focused && focused !== document.body) focused.dispatchEvent(new KeyboardEvent("keydown", init));
  }

  function closeDialog(d) {
    var cs = closers(d);
    if (cs.length) { cs[0].el.click(); return; }
    pressEscape();
    var back = d.parentElement;
    if (back && getComputedStyle(back).position === "fixed") back.click();
  }

  /**
   * A layer that is actually BLOCKING the page — fixed, and covering it.
   *
   * "Fixed and contains a title" also describes a sticky header, which is why
   * naming by shape kept picking headers. Requiring near-full coverage is what
   * separates a modal backdrop from page chrome, and it is the test that has to
   * be right before we can say "the dialog is gone".
   */
  function blockingLayer() {
    var tagged = document.querySelectorAll('[role="dialog"],[aria-modal="true"]');
    for (var i = 0; i < tagged.length; i++) if (visible(tagged[i])) return tagged[i];
    var now = fixedLayers(), best = null, bestZ = -1;
    for (var k = 0; k < now.length; k++) {
      var el = now[k], r = el.getBoundingClientRect();
      if (r.width < innerWidth * 0.8 || r.height < innerHeight * 0.6) continue;
      // A decorative full-screen gradient is fixed and covers the page too.
      // What separates a dialog from wallpaper is that you can act on it.
      if (!el.querySelector("button,[role=button],input,textarea,select")) continue;
      var z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
      if (z >= bestZ) { bestZ = z; best = el; }
    }
    return best;
  }

  /**
   * Close what is on top and PROVE it closed.
   *
   * One fire-and-forget click is what produced the reported gallery: the close
   * silently failed, the modal stayed up, and the next five screens were each
   * photographed through it while their own modal "never opened". So every
   * tactic is followed by a check, and the caller is told when none of them
   * worked instead of walking on with a dialog in the way.
   *
   * @param want Fingerprint to come back to; null means "until nothing blocks".
   */
  async function dismiss(want) {
    var done = function () { return want ? sig() === want : !blockingLayer(); };
    for (var round = 0; round < 3; round++) {
      if (done()) return true;
      var d = blockingLayer() || openDialog(null);
      if (d) {
        var cs = closers(d);
        for (var i = 0; i < cs.length; i++) {
          cs[i].el.click();
          await sleep(380);
          if (done()) return true;
        }
      }
      pressEscape();
      await sleep(380);
      if (done()) return true;
      // The backdrop, clicked in a corner the panel does not cover.
      var corner = document.elementFromPoint(6, 6);
      if (corner && corner !== document.body && getComputedStyle(corner).position === "fixed") {
        corner.click();
        await sleep(380);
      }
    }
    return done();
  }

  // Labels that tend to open something rather than navigate away.
  var OPENER_WORDS = /(สร้าง|เพิ่ม|ดู|รายละเอียด|แก้ไข|ตั้งค่า|รายงาน|พิมพ์|ส่งออก|อัปโหลด|เลือก|จัดการ|new|add|view|detail|edit|report|print|export|upload|open|manage)/i;

  /**
   * Buttons on this screen worth probing for a modal, best first. Menu labels
   * are excluded — clicking those navigates, which is the walk's job, not this.
   */
  function modalProbes(skipLabels) {
    var nodes = document.querySelectorAll("button,[role=button],a,div,span");
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!visible(el) || !hasClick(el)) continue;
      var t = norm(el.textContent);
      if (!t || t.length > 40) continue;
      if (LEAVE_WORDS.test(t) || listed(t, appAvoid)) continue;
      if (skipLabels.indexOf(t) !== -1) continue;
      var inner = el.querySelectorAll("*"), nested = false;
      for (var j = 0; j < inner.length; j++) if (hasClick(inner[j])) { nested = true; break; }
      if (nested) continue;
      out.push({ el: el, t: t, score: OPENER_WORDS.test(t) ? 1 : 0 });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  /**
   * Make a menu item reachable when it is not on screen.
   *
   * A collapsed accordion keeps its children out of the DOM entirely, so
   * "ไม่พบเมนู" usually means "the group holding it is shut", not "it does not
   * exist". Open the named group first; failing that, try the toggles — an
   * element that is clickable, carries an icon and a short label, and is not a
   * way out — re-checking after each until the target appears.
   */
  function revealMenu(want, group) {
    if (!want || locate(want)) return true;
    if (group && clickText(group) && locate(want)) return true;

    var flagged = document.querySelectorAll('[aria-expanded="false"],[data-state="closed"]');
    for (var i = 0; i < flagged.length; i++) {
      flagged[i].click();
      if (locate(want)) return true;
    }

    var nodes = document.querySelectorAll("*"), tries = 0;
    for (var j = 0; j < nodes.length && tries < 8; j++) {
      var el = nodes[j];
      if (!visible(el) || !hasClick(el) || !el.querySelector("svg")) continue;
      var t = norm(el.textContent);
      if (!t || t.length > 40 || t === norm(want) || LEAVE_WORDS.test(t) || listed(t, appAvoid)) continue;
      tries++;
      el.click();
      if (locate(want)) return true;
    }
    return !!locate(want);
  }

  /**
   * Fingerprint of the current view — tells "navigated" from "nothing happened".
   *
   * Hashes the WHOLE visible text. Sampling the first 400 characters read the
   * sidebar, which is identical on every screen of a normal app layout, so real
   * navigation looked like no change at all and every screen was skipped.
   */
  function sig() {
    var t = norm(document.body.innerText);
    var h = 5381;
    for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
    return h + ":" + t.length + "|" + location.hash;
  }

  function send(msg) { try { parent.postMessage(msg, "*"); } catch (e) {} }

  /** Wait for the view to stop changing — a transition, a fetch, a spinner. */
  async function settle(max) {
    var prev = "", same = 0, waited = 0, cap = max || 2600;
    while (waited < cap) {
      await sleep(180);
      waited += 180;
      var now = sig();
      if (now === prev) { if (++same >= 2) return now; }
      else { prev = now; same = 0; }
    }
    return sig();
  }

  /* ——— The screen index: doors the app itself declares ———
   *
   * Everything above tries to DISCOVER how to reach a screen and keeps being
   * wrong on real apps — menus inside shut accordions, role-gated items, a
   * company picker in the way, hand-rolled modals with no role="dialog". The
   * app's author knows all of it, so it leaves one hidden button per screen and
   * per modal and we just click them. Modal entries live in the component that
   * owns the modal, so they exist only while their screen is mounted — which is
   * how a modal gets filed under the right parent without any guessing.
   */
  function indexEntries(modal) {
    var all = document.querySelectorAll("[data-fitt-index] [data-fitt-screen]");
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].hasAttribute("data-fitt-modal") === !!modal) out.push(all[i]);
    }
    return out;
  }

  function indexNames(modal) {
    var els = indexEntries(modal), out = [];
    for (var i = 0; i < els.length; i++) {
      var n = els[i].getAttribute("data-fitt-screen");
      if (n && out.indexOf(n) === -1) out.push(n);
    }
    return out;
  }

  /** Re-found by name every time: React re-renders replace the DOM node. */
  function indexEntry(name, modal) {
    var els = indexEntries(modal);
    for (var i = 0; i < els.length; i++) {
      if (els[i].getAttribute("data-fitt-screen") === name) return els[i];
    }
    return null;
  }

  async function indexWalk() {
    stop = false;
    var screens = indexNames(false);
    if (screens.length === 0) {
      send({
        __fittWalkStep: true, step: 0, total: 0, ok: false, name: "ดัชนีหน้าจอ",
        error: "เดโมนี้ยังไม่มีดัชนีหน้าจอ — กด “เพิ่มดัชนีหน้าจอ” ให้ AI ใส่ให้ก่อน"
      });
      send({ __fittWalkDone: true });
      return;
    }
    var total = screens.length, step = 0;
    // A modal owned by App.tsx (a global "new record" dialog opened from the
    // header) is in the DOM on every screen. Without this it is attempted once
    // per screen: one capture and N-1 lines of "กดแล้วหน้าไม่เปลี่ยน".
    var doneModals = {};

    for (var i = 0; i < screens.length && !stop; i++) {
      var name = screens[i];
      step++;
      var door = indexEntry(name, false);
      if (!door) {
        send({ __fittWalkStep: true, step: step, total: total, name: name, ok: false, error: "ปุ่มดัชนีหายไประหว่างเดิน" });
        continue;
      }
      door.click();
      await settle();
      // Never photograph a screen through a leftover dialog.
      if (blockingLayer()) {
        await dismiss(null);
        door.click();
        await settle(1500);
      }

      var state = sig();
      if (captured[state]) {
        // The door did not move the app. Filing this would put a copy of the
        // previous screen under this screen's name — the one lie a quotation
        // must never carry — so say what is wrong instead.
        send({
          __fittWalkStep: true, step: step, total: total, name: name, ok: false,
          error: "ได้หน้าเดียวกับ “" + captured[state] + "” — onClick ของปุ่มดัชนีหน้านี้ยังตั้ง state ไม่ครบ"
        });
        continue;
      }
      try {
        captured[state] = name;
        send({ __fittShot: true, name: name, parent: null, dataUrl: await shoot() });
        send({ __fittWalkStep: true, step: step, total: total, name: name, ok: true });
      } catch (e) {
        send({ __fittWalkStep: true, step: step, total: total, name: name, ok: false, error: String(e && e.message || e) });
        continue;
      }

      // Modals this screen declares. They are only in the DOM now, while it is
      // mounted, so this list is exactly "the modals of this screen".
      var modals = indexNames(true);
      for (var m = 0; m < modals.length && !stop; m++) {
        var mname = modals[m];
        if (doneModals[mname]) continue;
        doneModals[mname] = true;
        total++;
        step++;
        var mdoor = indexEntry(mname, true);
        if (!mdoor) {
          send({ __fittWalkStep: true, step: step, total: total, name: mname, ok: false, error: "ปุ่มดัชนีของ modal หายไป" });
          continue;
        }
        mdoor.click();
        await settle(2200);
        var mstate = sig();
        if (captured[mstate]) {
          send({
            __fittWalkStep: true, step: step, total: total, name: mname, ok: false,
            error: "กดแล้วหน้าไม่เปลี่ยน — modal อาจไม่ได้เปิดจริง"
          });
        } else {
          try {
            captured[mstate] = mname;
            // Framed to the viewport: a fixed dialog over a six-screen-tall
            // page would otherwise come out as a speck at the top of the image.
            // parent nests it under this screen in the gallery; from/via draw
            // the arrow on the flow map.
            send({ __fittShot: true, name: mname, parent: name, from: name, via: mname, dataUrl: await shoot(true) });
            send({ __fittWalkStep: true, step: step, total: total, name: mname, ok: true });
          } catch (e2) {
            send({ __fittWalkStep: true, step: step, total: total, name: mname, ok: false, error: String(e2 && e2.message || e2) });
          }
        }

        // Prove the screen is back before touching anything else.
        var back0 = await dismiss(state);
        if (!back0) {
          var back = indexEntry(name, false);
          if (back) { back.click(); await settle(1500); }
          back0 = sig() === state || !blockingLayer();
        }
        if (!back0) {
          // Carrying an open dialog into the next screen is what turned one
          // stuck modal into five ruined screenshots. Stop this screen instead.
          send({
            __fittWalkStep: true, step: step, total: total, name: mname, ok: false,
            error: "ปิด modal นี้ไม่ได้ — ข้าม modal ที่เหลือของหน้านี้ไว้ก่อน"
          });
          break;
        }
      }
    }
    send({ __fittWalkDone: true });
  }

  async function walk(plan, setup, words) {
    stop = false;
    appForward = (words && words.forward) || [];
    appAvoid = (words && words.avoid) || [];
    var total = 0;
    for (var i = 0; i < plan.length; i++) total += 1 + ((plan[i].subs || []).length);
    var step = 0;

    // Gates first. A demo that opens on sign-in or a company picker goes nowhere
    // until those are cleared, and every later click then lands on the same
    // page. These are entry steps, not screens — they are not photographed.
    for (var g = 0; g < (setup || []).length; g++) {
      var gate = setup[g];
      var click = typeof gate === "string" ? gate : gate.click;
      var gname = typeof gate === "string" ? gate : (gate.name || click);
      // A sign-in or company-picker screen is a screen the customer is paying
      // for — capture it, then pass through it.
      try {
        send({ __fittShot: true, name: gname, parent: null, dataUrl: await shoot() });
      } catch (e0) { /* a gate we cannot photograph still must be cleared */ }
      var passed = clickText(click);
      send({
        __fittWalkStep: true, step: 0, total: total, ok: passed,
        name: gname,
        error: passed ? undefined : "ไม่พบปุ่ม “" + click + "”"
      });
      await sleep(900);
    }

    // Still boxed in? The map's labels can be wrong, or a gate can need a click
    // nobody predicted — so try to get through on our own rather than
    // photographing the same locked screen once per planned screen.
    var wanted = plan.map(function (p) { return p.navText; }).filter(Boolean);
    var reachable = function () {
      for (var i = 0; i < wanted.length; i++) if (locate(wanted[i])) return true;
      return wanted.length === 0;
    };
    var tried = [];
    for (var a = 0; a < 10 && !reachable() && !stop; a++) {
      var cand = gateCandidate(tried, false) || gateCandidate(tried, true);
      if (!cand) {
        send({
          __fittWalkStep: true, step: 0, total: total, ok: false,
          name: "หาทางเข้าเอง",
          error: "ไม่พบปุ่มที่กดได้บนหน้านี้เลย"
        });
        break;
      }
      tried.push(cand);
      var label = norm(cand.textContent).slice(0, 30) || "(ไม่มีข้อความ)";
      var was = sig(), layersBefore = fixedLayers();
      cand.click();
      await sleep(950);
      var stray = openDialog(layersBefore);
      if (stray) {
        // Opened a dialog instead of going anywhere — close it, or the rest of
        // the pass runs against a blocked screen.
        closeDialog(stray);
        await sleep(400);
        send({
          __fittWalkStep: true, step: 0, total: total, ok: false,
          name: "หาทางเข้าเอง: คลิก “" + label + "”",
          error: "เปิดหน้าต่างซ้อนแทนที่จะเข้าระบบ — ปิดแล้วลองปุ่มอื่น"
        });
        continue;
      }
      send({
        __fittWalkStep: true, step: 0, total: total, ok: sig() !== was,
        name: "หาทางเข้าเอง: คลิก “" + label + "”",
        error: sig() !== was ? undefined : "คลิกแล้วไม่มีอะไรเปลี่ยน"
      });
    }
    // Never start the walk with something covering the app.
    var leftover = openDialog(null);
    if (leftover) { closeDialog(leftover); await sleep(350); }
    if (!reachable()) {
      send({
        __fittWalkStep: true, step: 0, total: total, ok: false,
        name: "เข้าหน้าจอหลักไม่ได้",
        error: "เดโมยังติดหน้ากั้นอยู่ — เข้าไปเองในพรีวิวแล้วใช้ปุ่ม “แคปหน้านี้” ทีละหน้าได้ครับ"
      });
      send({ __fittWalkDone: true });
      return;
    }

    var last = "";
    for (var s = 0; s < plan.length; s++) {
      if (stop) break;
      var screen = plan[s];
      step++;
      var before = sig();
      if (screen.navText) revealMenu(screen.navText, screen.expand);
      var found = screen.navText ? clickText(screen.navText) : true;
      await sleep(screen.navText ? 800 : 250);
      // Two different failures used to share one message. They need different
      // fixes, so they get different words.
      if (screen.navText && !found) {
        send({
          __fittWalkStep: true, step: step, total: total, name: screen.name, ok: false,
          error: "ไม่พบเมนู “" + screen.navText + "” บนหน้านี้ — อาจแสดงเฉพาะบางสิทธิ์ผู้ใช้ หรือชื่อไม่ตรง"
        });
        continue;
      }
      // Some menus only respond after a transition settles — give it one more go
      // before calling it stuck.
      if (screen.navText && sig() === before && sig() === last) {
        await sleep(500);
        clickText(screen.navText);
        await sleep(700);
      }
      // Still nothing → shooting now would file a copy of the previous screen
      // under this screen's name, the exact lie a quotation must not carry.
      if (screen.navText && sig() === before && sig() === last) {
        send({
          __fittWalkStep: true, step: step, total: total, name: screen.name, ok: false,
          error: "กดเมนูแล้วหน้าไม่เปลี่ยน — อาจเป็นหัวข้อกลุ่ม ไม่ใช่หน้าจอจริง"
        });
        continue;
      }
      last = sig();
      if (captured[last]) {
        send({
          __fittWalkStep: true, step: step, total: total, name: screen.name, ok: false,
          error: "หน้าเดียวกับ “" + captured[last] + "” ที่เก็บไปแล้ว"
        });
        continue;
      }
      try {
        captured[sig()] = screen.name;
        send({ __fittShot: true, name: screen.name, parent: null, dataUrl: await shoot() });
        send({ __fittWalkStep: true, step: step, total: total, name: screen.name, ok: true });
      } catch (e) {
        send({ __fittWalkStep: true, step: step, total: total, name: screen.name, ok: false, error: String(e && e.message || e) });
      }
      // Modals the map named. A miss here is not the end — the probe below
      // finds them without needing the label to be right.
      var subs = screen.subs || [], seen = [];
      for (var k = 0; k < subs.length; k++) {
        if (stop) break;
        var sub = subs[k];
        step++;
        var layers0 = fixedLayers();
        if (!clickText(sub.openBy)) {
          send({ __fittWalkStep: true, step: step, total: total, name: sub.name, ok: false, error: "ไม่พบปุ่ม “" + sub.openBy + "” — จะลองหาเอง" });
          continue;
        }
        await sleep(650);
        var d0 = openDialog(layers0);
        var st0 = sig();
        if (captured[st0]) {
          send({ __fittWalkStep: true, step: step, total: total, name: sub.name, ok: false, error: "หน้าเดียวกับที่เก็บไปแล้ว — ไม่ได้เปิดอะไรใหม่" });
          if (d0) closeDialog(d0);
          await sleep(300);
          continue;
        }
        try {
          var nm = d0 ? dialogName(d0, sub.name) : sub.name;
          captured[st0] = nm;
          send({ __fittShot: true, name: nm, parent: screen.name, dataUrl: await shoot(true) });
          send({ __fittWalkStep: true, step: step, total: total, name: nm, ok: true });
          seen.push(norm(nm));
        } catch (e2) {
          send({ __fittWalkStep: true, step: step, total: total, name: sub.name, ok: false, error: String(e2 && e2.message || e2) });
        }
        if (d0) closeDialog(d0); else if (!clickText(sub.closeBy)) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        }
        await sleep(450);
      }

      // Then look for the ones nobody named. Every modal is a screen somebody
      // has to build, so an inventory that lists none of them under-quotes the
      // job — and asking the model to guess which button opens what has proved
      // unreliable. Press the likely buttons and see whether a dialog appears.
      var navLabels = plan.map(function (p2) { return norm(p2.navText); }).filter(Boolean);
      var probes = modalProbes(navLabels).slice(0, 6);
      for (var q = 0; q < probes.length && !stop; q++) {
        var probe = probes[q];
        if (!visible(probe.el)) continue;
        var mark = sig(), layers1 = fixedLayers();
        probe.el.click();
        await sleep(700);
        var dlg = openDialog(layers1);
        if (!dlg) {
          send({
            __fittWalkStep: true, step: step, total: total, ok: false,
            name: "ลองเปิด: “" + probe.t + "”",
            error: sig() !== mark ? "เปลี่ยนหน้าแทนที่จะเปิดหน้าต่าง" : "กดแล้วไม่มีหน้าต่างเปิด"
          });
          // No dialog. If the click navigated instead, walk back to this screen
          // so the rest of the pass still runs from where it should.
          if (sig() !== mark && screen.navText) {
            revealMenu(screen.navText, screen.expand);
            clickText(screen.navText);
            await sleep(700);
          }
          continue;
        }
        var name = dialogName(dlg, probe.t);
        var state = sig();
        if (captured[state]) {
          // Same page we already have: the click revealed a sticky layer or
          // re-rendered the screen, it did not open anything new.
          closeDialog(dlg);
          await sleep(300);
          continue;
        }
        if (seen.indexOf(norm(name)) === -1) {
          seen.push(norm(name));
          captured[state] = name;
          step++;
          try {
            send({ __fittShot: true, name: name, parent: screen.name, dataUrl: await shoot(true) });
            send({ __fittWalkStep: true, step: step, total: total, name: name, ok: true });
          } catch (e3) {
            send({ __fittWalkStep: true, step: step, total: total, name: name, ok: false, error: String(e3 && e3.message || e3) });
          }
        }
        closeDialog(dlg);
        await sleep(450);
      }
    }
    send({ __fittWalkDone: true });
  }

  /* ——— Recording: the user walks, we take notes ———
   *
   * Driving a generated app blind never stopped needing another special case:
   * gates, accordions, role-gated menus, hand-rolled modals. The person using
   * the demo already knows its flow, so the reliable division of labour is
   * theirs to navigate and ours to capture.
   *
   * What triggers a capture is the SCREEN SETTLING, not a click. Clicks miss
   * redirects, keyboard navigation and anything that arrives after data loads,
   * and firing on the click itself photographs the old view or a spinner. So a
   * sampler watches the page: when it changes and then holds still, that is a
   * new state worth keeping — and the label of the last thing clicked is what
   * got us there.
   */
  // Every state photographed this session, keyed by page fingerprint. Shared by
  // the walk and the recorder: a screen already in the inventory must never be
  // filed a second time — as a screen, and least of all as a "modal" of itself.
  var captured = {};
  var rec = false, recPrev = "", lastVia = "", recBusy = false;
  var settleTimer = null, lastSeen = "", stable = 0;
  var seen = {};   // page fingerprint → the name we filed it under

  /** The demo's own name for where we are: active nav item, else a heading. */
  function screenName() {
    var sel = ["[aria-current=page]", "nav [class*=active]", "main h1", "main h2", "h1", "h2"];
    for (var i = 0; i < sel.length; i++) {
      var el = document.querySelector(sel[i]);
      if (el && visible(el)) {
        var t = norm(el.textContent);
        if (t && t.length <= 60) return t;
      }
    }
    return norm(document.title) || "หน้าจอ";
  }

  async function capture(fingerprint) {
    if (recBusy) return;
    recBusy = true;
    try {
      var dlg = openDialog(null);
      var name = dlg ? dialogName(dlg, lastVia) : screenName();
      // Two states can carry the same heading; keep the names distinct so the
      // flow map does not fuse them into one frame. Count every variant of the
      // base name, or the second and third both come out as "(2)".
      var base = name, taken = 0;
      for (var k in captured) {
        var v = captured[k];
        if (v === base || v.indexOf(base + " (") === 0) taken++;
      }
      if (taken) name = base + " (" + (taken + 1) + ")";

      var dataUrl = await shoot(!!dlg);
      seen[fingerprint] = name;
      captured[fingerprint] = name;
      send({
        __fittShot: true, name: name,
        // parent = "a modal of this screen" (the gallery nests it);
        // from = "arrived from this screen" (the flow map draws the arrow).
        parent: dlg ? (recPrev || null) : null,
        from: recPrev || null,
        via: lastVia || null, dataUrl: dataUrl
      });
      send({ __fittRecStep: true, name: name, ok: true, via: lastVia || null });
      recPrev = name;
    } catch (err) {
      send({ __fittRecStep: true, name: lastVia || "หน้าจอ", ok: false, error: String(err && err.message || err) });
    } finally {
      recBusy = false;
      lastVia = "";
    }
  }

  /**
   * Sample the page; capture once it has been still for two ticks. Revisiting a
   * screen is recognised by its fingerprint and does not produce a second
   * frame — that is what filled the map with duplicates of the same screen.
   */
  function sample() {
    if (!rec) return;
    var now = sig();
    if (now !== lastSeen) { lastSeen = now; stable = 0; return; }
    if (stable === -1) return;      // already handled this state
    if (++stable < 2) return;
    stable = -1;
    if (seen[now]) { recPrev = seen[now]; return; }
    if (captured[now]) { seen[now] = captured[now]; recPrev = captured[now]; return; }
    void capture(now);
  }

  addEventListener("click", function (e) {
    if (!rec) return;
    var el = e.target && e.target.closest ? e.target.closest("button,a,[role],li,tr,label,div,span") : null;
    var t = el ? norm(el.textContent).slice(0, 40) : "";
    if (t) lastVia = t;
  }, true);

  addEventListener("message", function (e) {
    var d = e.data;
    if (!d || typeof d !== "object") return;
    if (d.__fittShotPing) { send({ __fittShotPong: true, v: VERSION }); return; }
    if (d.__fittRecord !== undefined) {
      rec = !!d.__fittRecord;
      if (settleTimer) { clearInterval(settleTimer); settleTimer = null; }
      if (rec) {
        recPrev = ""; lastVia = ""; lastSeen = ""; stable = 0; seen = {};
        settleTimer = setInterval(sample, 350);
      }
      return;
    }
    if (d.__fittShotOne) {
      shoot()
        .then(function (dataUrl) { send({ __fittShot: true, name: d.name || "หน้าจอ", parent: null, dataUrl: dataUrl }); send({ __fittWalkDone: true }); })
        .catch(function (err) { send({ __fittWalkStep: true, step: 1, total: 1, name: d.name || "หน้าจอ", ok: false, error: String(err && err.message || err) }); send({ __fittWalkDone: true }); });
    }
    if (d.__fittIndexWalk) void indexWalk();
    if (d.__fittWalk && Array.isArray(d.plan)) void walk(d.plan, d.setup || [], d.words || {});
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
/**
 * Infrastructure the demo cannot run without and the model never writes.
 *
 * The generated app is `src/**` plus package.json. Everything here is plumbing
 * the codegen prompt does not even mention — so it can only arrive from the
 * scaffold, and if the scaffold is not merged in, it never arrives at all.
 *
 * That is exactly what happened: `hasRunnableApp()` returns true as soon as
 * package.json exists, and the studio then boots the project's own files
 * verbatim. A build that produced package.json but no index.html therefore
 * started a dev server with nothing to serve at "/" — Vite answered 404 and the
 * preview was a permanently white page. The dev server said "พร้อม", because
 * from its side everything was.
 *
 * `src/App.tsx`, `src/main.tsx` and `src/index.css` are deliberately NOT here:
 * those are the demo's content, and filling them from the scaffold would paint
 * a placeholder app over a real project's missing file instead of surfacing it.
 */
export const SCAFFOLD_REQUIRED: ProjectFiles = {
  "index.html": SCAFFOLD_INDEX_HTML,
  ".npmrc": NPMRC,
  "tsconfig.json": TSCONFIG,
  "package.json": DEMO_PACKAGE_JSON,
  "public/preloader.svg": PRELOADER_SVG,
};

/**
 * Fill in missing infrastructure. The project's own files always win, so a
 * package.json the model rewrote (new dependencies) or an index.html it
 * customised is never clobbered.
 *
 * A no-op for a project with no source — during Define/Plan the docs are the
 * whole project, and stamping plumbing onto it would make an interview look
 * like a runnable app to `hasRunnableApp()`.
 */
export function withRequiredScaffold(files: ProjectFiles): ProjectFiles {
  const hasSource = Object.keys(files).some((p) => p.startsWith("src/"));
  return hasSource ? { ...SCAFFOLD_REQUIRED, ...files } : files;
}

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

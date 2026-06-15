# FITT Builder — Design System ("midnight studio")

Single source of truth for the product's visual language. Implemented in
`app/globals.css` (tokens + keyframes) and consumed via Tailwind v4 utilities.
The theme was adapted from a reference hero spec (dark video hero, Inter,
animated shiny gradient text) — adaptations for this product are listed at the
bottom.

## Brand

- **Name:** FITT Builder (always two words, "FITT" uppercase)
- **Logo:** a circle outline (2px white border) containing a smaller filled
  white circle, followed by the wordmark "FITT Builder" (font-semibold,
  tracking-tight). See `Logo()` in `app/page.tsx`.
- **Studio shorthand:** `FITT Builder` with "Builder" in the accent color
  (`components/studio/TopBar.tsx`); the brief card label is `FITT-001 · Demo Brief`.
- **Voice:** Thai-first UI copy, English for technical nouns (Prompt, Demo,
  Preview, Export). Tagline pattern: "Prompt in. Demo out."

## Color tokens

Defined as CSS vars in `:root` and mapped to Tailwind via `@theme inline`
(`app/globals.css`). One accent only — no secondary accent color.

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `--night` | `#000000` | `bg-night` / `bg-black` | Page + studio background |
| `--night-panel` | `#0a0a0a` | `bg-night-panel` | Studio panels, modals |
| `--night-edge` | `#2a2a2a` | `border-night-edge` | Studio borders, nav pill border |
| `--chalk` | `#ffffff` | `text-chalk` / `text-white` | Headings, primary text |
| `--chalk-dim` | `#a1a1aa` | `text-chalk-dim` | Secondary text in the studio |
| `--shine` | `#64cefb` | `text-shine` / `bg-shine` | **The** accent: highlights, active states, accent buttons |
| `--shine-soft` | `#9ddffc` | `bg-shine-soft` | Accent hover |
| `--go` | `#34d399` | `text-go` | Success / ready / live |
| `--halt` | `#f87171` | `text-halt` | Errors / destructive |

On marketing surfaces, body text uses white at reduced opacity rather than a
gray token: `text-white/80` for body, `text-white/60`–`/50` for meta lines,
`text-white/35` for placeholders. Hover always resolves to full `text-white`.

Borders on marketing cards: `border-white/10` (rest) → `border-shine/50`
(hover). Card fill: `bg-white/[0.03]`; glass surfaces add `backdrop-blur-sm`
and `bg-white/[0.04]`.

## Typography

| Stack | Fonts | Use |
|---|---|---|
| `font-display`, `font-sans` | **Inter** → **Anuphan** (Thai fallback) | Everything |
| `font-mono` | **IBM Plex Mono** | Counters, labels, terminal, kickers |

Loaded via `next/font` in `app/layout.tsx`. Inter carries Latin; Anuphan
(latin+thai subsets) renders Thai. Never use Inter-only styling tricks on
Thai strings (see "Thai caveat" below).

Scale highlights:

- **Display heading (hero):** `text-5xl sm:text-7xl lg:text-8xl xl:text-9xl`,
  `font-medium`, `leading-[0.85]`, `tracking-tighter`. Line 1 plain white,
  line 2 `.shiny-text`.
- **Section heading:** `text-3xl font-medium tracking-tight`.
- **Kickers / labels:** `font-mono text-[10px]–[12px] uppercase` with wide
  tracking (`tracking-[0.18em]`–`[0.3em]`).
- **Body:** `text-sm` mobile / `text-base` desktop on marketing; `text-[14px]`
  in studio panels.

**Thai caveat:** `leading-[0.85]` + `tracking-tighter` are safe only for
Latin display text — Thai vowel/tone marks above and below the baseline get
clipped. Thai headings use normal leading (`leading-snug` or default).
This is why the hero's big lines are English and the supporting copy is Thai.

## Motion

All CSS-only, defined in `app/globals.css`:

| Class | Behavior |
|---|---|
| `.shiny-text` | Base `#64cefb` text with a white 100° gradient band sweeping left→right, 3s linear infinite (`background-clip: text`) |
| `.rise` + `.rise-1…5` | Staggered fade-up on load, 0.7s `cubic-bezier(0.22, 1, 0.36, 1)` |
| `.progress-sweep` | Indeterminate progress bar sweep, 1.4s |
| `.caret-blink` | Builder caret, 1.1s steps |
| `.marquee-track` | Preset strip, 28s linear, pauses on hover |
| `.live-dot` | Green pulse ring for the "server live" dot |

Interactive transitions: `transition` with default duration; arrows inside
buttons translate on hover (`group-hover:translate-x-0.5`–`x-1`); cards lift
`hover:-translate-y-0.5`–`y-1`.

## Components

### Navigation (marketing)

- Container `max-w-7xl`, logo left.
- Links live in a **rounded-full pill** with `border border-night-edge`,
  `bg-black/30 backdrop-blur-sm`; each link `text-sm text-white/80
  hover:text-white`, last item carries an `ArrowUpRight` icon.
- Pill is `hidden lg:flex`; below `lg` a single compact "ผลงานของฉัน" link
  shows instead (no hamburger — we have only one secondary route, a menu
  would be empty ceremony).

### Buttons

Three kinds, all `rounded-full` on marketing surfaces:

1. **Primary (dark surface):** `bg-white text-black hover:bg-gray-200`,
   `font-semibold`, optional trailing `ArrowRight`.
2. **On-video CTA:** `bg-black text-white ring-1 ring-white/20
   hover:bg-gray-900`, `px-6 py-3` → `md:px-8 md:py-4` (per reference spec).
3. **Secondary / ghost:** `border border-white/20 text-white/80
   hover:border-shine hover:text-shine`.

In the **studio** (dense tool chrome) buttons stay compact with
`rounded-sm`; accent actions use `bg-shine text-black hover:bg-shine-soft` —
**never white text on `bg-shine`** (fails contrast on the light blue).

### Cards

`rounded-2xl border border-white/10 bg-white/[0.03] p-6`; hover
`border-shine/50` + lift. Featured/callout variant: `rounded-3xl
border-shine/30 bg-shine/5`. Highlighted pricing tier: `border-shine
bg-shine/[0.06]` with a `bg-shine text-black` pill badge.

### LaunchPad (prompt brief card)

Glass card `rounded-2xl border-white/15 bg-white/[0.04] backdrop-blur-sm`,
mono header row (`FITT-001 · Demo Brief` + char counter), large transparent
textarea, footer row with primary pill + ghost pill + kbd hint, example
chips as `rounded-full` ghost pills.

### Studio chrome

The builder keeps compact radii (`rounded-sm`/`rounded-md`) and the
`night-panel`/`night-edge` tokens — it is a tool, not a poster. Empty states
use `.bg-grid` (24px faint white grid on black). Scrollbars use
`.scroll-thin`. Status colors: `go` for ready/done, `halt` for errors,
`shine` for in-progress accents.

## Hero (landing) spec

`app/page.tsx`, section structure top→bottom inside an `h-screen` block:

1. **Video background:** full-bleed `<video autoPlay loop muted playsInline>`
   `object-cover`, source:
   `https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4`
   Scrim: `bg-black/45` overlay + bottom `h-40` black gradient so the hero
   melts into the page.
2. **Nav** (above).
3. **Two-column intro row:** left = value proposition (Thai), right =
   right-aligned stat line ("จาก Prompt สู่เว็บจริง ภายใน 60 วินาที !");
   both `text-sm md:text-base text-white/80`, stacked on mobile.
4. **Centered hero:** uppercase kicker (`text-xs md:text-sm text-white/80
   tracking-tight`) → two-line display heading ("Prompt in." white /
   "Demo out." shiny) → on-video CTA anchored to `#launch`.

Everything below the hero sits on plain black: LaunchPad section (`#launch`),
preset marquee (`border-y border-night-edge`), how-it-works (`#how`),
Spec-to-Demo callout (`#spec`), pricing (`#pricing`), footer
(`border-t border-white/10`).

## Layout

- Marketing container: `max-w-7xl` + `px-6`; sections `py-20`/`pb-24`.
- Breakpoints: Tailwind defaults (sm 640 / md 768 / lg 1024 / xl 1280),
  mobile-first.
- Studio: full-viewport split view, resizable chat panel (320–640px),
  36px status bar.

## Adaptations from the reference theme

Documented so nobody "fixes" them back:

- **Fonts:** reference uses Inter only; we add Anuphan behind it because the
  product is Thai-first and Inter has no Thai glyphs.
- **ShinyText:** reference implements it with framer-motion; ours is pure CSS
  (`.shiny-text`) — identical visual, one less dependency.
- **Hero CTA:** "Apply for Next Enrollment" became "เริ่มสร้างเลย — ฟรี"
  anchoring to the LaunchPad, since the prompt box is the product's real CTA.
- **Hamburger:** skipped (single secondary route; a direct link is clearer).
- **Accent:** the reference's `#64CEFB` replaced both legacy accents
  (orange `blaze`, blue `blueprint`) — one accent, one way.

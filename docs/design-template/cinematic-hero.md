# Cinematic hero — the craft bar for generated UI

Reference direction for a dark, video-backed hero with a glass stat card. Written
after a user handed over a pixel-exact spec for one ("Apogee") and asked why our
output did not feel like that.

The answer was not effects. It was two things that spec insisted on and our
prompt never mentioned: **every spacing number is decided, and the first second
is choreographed**. Both are now rules in `lib/prompts.ts` (rule 6). This file is
the worked example behind them — read it when a brief calls for a landing hero,
or when generated UI comes out looking generated and it is not obvious why.

---

## 1. The entrance timeline is the product

A page where everything fades in together reads as a template no matter how good
the palette is. A page where things arrive in the order a person would look at
them reads as designed. Same CSS, different ordering.

| Delay | What arrives |
|---|---|
| 0 | Logo / wordmark |
| 100 | Primary nav |
| 200 | Auth or secondary nav |
| 300 | Headline |
| 500 | Supporting paragraph |
| 700 | Call-to-action row |
| 900 | Hero visual (card, image, chart) |
| 1100 + i×30 | Repeated items inside it, one by one |

The stagger on the last row matters more than it looks: 32 bars sweeping in over
930ms reads as the data arriving; 32 bars appearing at once reads as an image.

Total sequence lands around 2.6s. Longer than that and the page feels slow;
shorter and the order stops being legible.

## 2. Mechanism: CSS, not a library

```css
@keyframes fade-up {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-up { animation: fade-up .8s cubic-bezier(.16, 1, .3, 1) forwards; }
```

```tsx
<div className="opacity-0 animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
```

Three properties make this work and each is load-bearing:

- **`opacity-0` in the markup** — the element is invisible before JS runs, so
  there is no flash of the final state on a slow connection.
- **`forwards`** — the animation holds its end state instead of snapping back.
- **`cubic-bezier(.16, 1, .3, 1)`** — fast out, long settle. The default `ease`
  is what makes an animation feel like a transition rather than an arrival.

No IntersectionObserver for the first screen: the user is already looking at it,
and a scroll trigger there means the hero animates only if they scroll away and
back. No animation library for entrances either — this is eight lines of CSS
against an install that delays the first paint it is supposed to decorate.
`framer-motion` still earns its place on layout transitions and gestures.

Wrap the keyframe rules in `@media (prefers-reduced-motion: no-preference)` so
that anyone who has asked for less motion gets the finished layout immediately.

## 3. Spacing is decided, not eyeballed

The reference spec listed a pixel value for every box. That discipline is what
this section is; the exact numbers below are one good set, not the only one.

| Element | Value |
|---|---|
| Hero CTA button | height 46 → 51px, horizontal padding 20 → 27px |
| Nav pill | height 52px, padding 24px each side, 30px between items |
| Auth pill | 3px padding around 46px inner buttons — the visible gap IS the design |
| Glass card | 20 → 32px on three sides, bottom one step shallower |
| Page gutter | 20 → 32 → 82px across the breakpoints, content capped and centred |

The failure this prevents has a signature: **a button whose label touches its
rounded edge.** It is the single most reliable tell of generated UI, it happens
whenever padding is left to a default, and once seen it cannot be unseen.

## 4. Details that separate shipped from generated

- A mobile menu toggled by `visible/invisible` + opacity, never by conditional
  render — unmounting kills the close transition, so the menu vanishes instead
  of leaving.
- Hamburger and close icons **stacked and cross-faded** with rotate + scale, not
  swapped by mounting one and unmounting the other.
- `document.body.style.overflow = "hidden"` while a full-screen menu is open,
  restored in the effect cleanup.
- Dimming rather than hiding to express state: projected chart bars at 10% white
  beside solid ones; the decimal part of a headline number at 20%. It says
  "this is less certain" without adding a legend.

---
name: frontend-design
description: 'Enforce the Aurora design system for any UI change in frontend/ — components, styling, layout, responsive and accessibility fixes, landing page work. Read DESIGN.md first; the color schema, contrast, motion, and the landing hero recipe all live there.'
when_to_use: 'Trigger on UI work: build a page or component, style this, change colors or spacing, fix responsive layout, work on the hero or landing page, buttons/forms/cards/nav, light-green contrast questions.'
argument-hint: '[component, page, or UI change]'
metadata:
  author: MLHXCOMSATS
  version: "1.1"
---

# Frontend Design (Aurora)

`DESIGN.md` at the project root is the binding source of truth — read it before writing
any UI code. This skill is the procedure for applying it.

## Workflow

1. **Read** `DESIGN.md` (at minimum §2 color, §6 motion, §7 components; §8 for anything
   on the landing page).
2. **Look** at `src/components/` and `src/pages/` — reuse an existing pattern before
   inventing one. The landing reference implementations live in
   `src/components/landing/` (Hero, HeroBackground, MagneticButton, Navbar, Reveal,
   Features, HowItWorks, ForHospitals, Footer).
3. **Build** with Tailwind utilities and the schema tokens from `@theme` in
   `src/main.css`. New token = `@theme` entry + DESIGN.md table, same change.
4. **States pass** — hover, `focus-visible`, disabled, plus loading/empty/error if the
   surface is async.
5. **Check** 360px, 768px, 1280px. No horizontal scroll.
6. **Verify** — run `npm run lint` and `npm run build`. Never start a dev server,
   preview, or browser pass; the change ends at lint + build.

## Token cheat sheet (Tailwind utilities)

| Need | Use |
| --- | --- |
| Page canvas | `bg-white` (always) |
| Headings, primary text | `text-ink` (deep forest `#052e16`) |
| Body copy | `text-body` |
| Quiet / secondary copy | `text-mist` |
| Borders | `border-line`; `border-brand-200` on tints |
| Tinted surfaces | `bg-surface`, `bg-brand-50` |
| Interactive fill (AA) | `bg-brand-700 hover:bg-brand-800 text-white` |
| Links | `text-brand-700` (any size) |
| Large accents (≥24px / ≥18.66px bold) | `text-brand-600` |
| Decorative greens (graphics only) | `brand-300` / `brand-400` / `brand-500` |
| Deep panels | `bg-brand-950` |
| Shadows | `shadow-soft`, `shadow-lift` (green-tinted — no heavy black) |
| Focus | `focus-visible:ring-2 ring-brand-600 ring-offset-2` |
| Errors | `text-danger`, `bg-danger-bg` |

Font is **Poppins** throughout (weights 400–800) — no other families.

## Hard rules

- **The light-green trap:** greens below `brand-600` never carry text on white. Body
  text must be `brand-700` or darker. `brand-600` is large text only. Everything lighter
  is decoration.
- No raw hex in components — the schema in `main.css` and its utilities only.
- Motion: shared `EASE = [0.23, 1, 0.32, 1]` and `SCROLL_SPRING` from
  `src/lib/motion.js`; UI ≤300ms; entrances 0.8–1.2s and staggered; `transform`/`opacity`
  only; reduced motion is global (CSS kill switch + `MotionConfig` + `useReducedMotion`
  gating) and must not be bypassed.
- Focus is never removed; every new control is keyboard-operable.
- Semantic elements — real `<button>`, `<a>`, `<label>`; one `<h1>` per page.
- Landing sections follow DESIGN.md §8 exactly (logo, layers, entry delays, scroll
  ranges, section recipes). Match the existing choreography instead of inventing new
  timing — `src/lib/motion.js` and `landing/Reveal.jsx` hold the shared primitives.
- Stack stays: Tailwind utilities + framer-motion + lucide-react. No new UI libraries,
  no CSS-in-JS.
- Decorative graphics are `aria-hidden="true"`.

## Edge cases

- **Off-scale spacing** — round to the nearest Tailwind step; arbitrary values only for
  layout math (widths, heights), never for colors.
- **New pattern needed** — check DESIGN.md §7 first; if it's genuinely new, add the rule
  alongside the code in the same change.
- **Existing violation in your path** — fix it; elsewhere — flag it, don't sweep.
- **Logo** — `/Aurora.png` is a light-green lockup on transparency; navbar `h-9`, hero
  `h-12`; keep it on white or green tints, never on deep fills.

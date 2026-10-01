# Aurora Design Rules

Single source of truth for how **Aurora** looks, moves, and behaves. Aurora is a
health-care management system: **white canvas, light green brand, deep forest ink** —
calm, clinical, trustworthy. Humans and agents both follow this file. If a change needs
a rule that isn't here, add it to this file in the same change — never invent one-off
styles.

Applies to `frontend/`. The backend serves JSON only (`api-conventions` skill).

Stack: React 19 + Vite, JavaScript (not TypeScript), **Tailwind CSS v4**
(`@tailwindcss/vite`) with the entire color scheme defined as an explicit `@theme`
schema in `src/main.css`, **framer-motion**, **lucide-react** icons, **Poppins**.

---

## 1. Principles

1. **Calm over decoration.** Clean white space, one quiet accent, nothing shouting.
2. **Green means interactive or positive — only that.** Brand green marks actions, links,
   and good states. It is never wallpaper.
3. **One schema.** Every raw color lives in `src/main.css` (`@theme`). Components use
   utilities (`bg-brand-700`, `text-ink`) — never hex codes or ad-hoc CSS.
4. **The light-green trap.** Light greens are brand *air*, not text. Greens below
   `brand-600` never carry text on white (see §2).
5. **One theme: light.** White canvas is the product. Don't add dark mode until the team
   decides — everything is tokenized, so it can come later.
6. **Motion is choreography, not garnish.** Entrances stagger; scroll moves things once,
   gently; everything survives `prefers-reduced-motion`. See §6.
7. **Accessible by default.** Keyboard, contrast, and semantics are part of "done".

---

## 2. Color tokens

The full schema is defined in `frontend/src/main.css` inside `@theme`. Components use
Tailwind utilities (`text-ink`, `bg-surface`, `border-line`, `bg-brand-700`) — never hex
codes.

One documented exception: the SVG gradient stops in `HeroBackground.jsx` spell the ramp
out by hand (gradient defs can't take utilities). Keep them in sync with this table.

### Semantic tokens

| Token | Value | Utilities | Use for |
| --- | --- | --- | --- |
| `ink` | `#052e16` (= brand-950) | `text-ink` | Headings, primary text |
| `body` | `#4b5e55` | `text-body` | Body copy (~6.9:1 on white — AA) |
| `mist` | `#62756b` | `text-mist` | Quiet/secondary copy, captions (~4.9:1 — AA) |
| `line` | `#e3ece7` | `border-line` | Borders, separators, input outlines |
| `surface` | `#f6fbf8` | `bg-surface` | Card/panel tint on white |
| `danger` / `danger-bg` | `#dc2626` / `#fef2f2` | `text-danger`, `bg-danger-bg` | Errors only — no other hues |

Canvas is always white (`bg-white`).

### Brand ramp (`brand-*`, defined in `main.css`)

| Stop | Hex | Role |
| --- | --- | --- |
| `brand-50` | `#f0fdf4` | Section tints, chips |
| `brand-100` | `#dcfce7` | Tinted surfaces, subtle fills |
| `brand-200` | `#bbf7d0` | Borders on tinted surfaces |
| `brand-300` | `#86efac` | **Decoration only** — matches the logo green (asset is ~`#90d890`) |
| `brand-400` | `#4ade80` | **Decoration only** — SVG lines, gradients |
| `brand-500` | `#22c55e` | **Decoration only** — chart fills, rings |
| `brand-600` | `#16a34a` | Large text only (≥24px, or ≥18.66px bold; ~3.3:1) + icons |
| `brand-700` | `#15803d` | **Interactive fill** with white text (~5:1 — AA), links at any size |
| `brand-800` | `#166534` | Hover/active of brand-700 |
| `brand-900` | `#14532d` | Deep accents |
| `brand-950` | `#052e16` | Deep forest panels — same as `ink` |

**Contrast rules (hard):**

- Body-size text on white: `body`, `mist`, `ink`, `brand-700`, `brand-800`, `brand-900`
  only.
- `brand-600` and lighter: never body text on white. Decorative graphics only below
  `brand-600`.

### Elevation

| Token | Value | Utility | Use |
| --- | --- | --- | --- |
| `--shadow-soft` | `0 24px 48px -24px rgb(5 46 31 / 0.16)` | `shadow-soft` | Cards, panels |
| `--shadow-lift` | `0 32px 64px -24px rgb(5 46 31 / 0.24)` | `shadow-lift` | Hover lift, floating layers |

Shadows are green-tinted and soft. No heavy black shadows.

**Adding a token:** name by meaning, define it in `@theme` in `src/main.css`, add it to
the table above — three edits in one change.

---

## 3. Typography

Font: **Poppins** (400/500/600/700/800), loaded in `main.css`; fallback
`system-ui, -apple-system, sans-serif`.

| Role | Size | Weight | Leading | Tracking |
| --- | --- | --- | --- | --- |
| Hero display | `text-4xl sm:text-5xl md:text-6xl lg:text-[5.5rem]` | 800 | 0.92 | -0.04em |
| h1 (in-app) | 36 / 28px | 800 | 1.05 | -0.03em |
| h2 | 24 / 20px | 700 | 1.18 | -0.01em |
| h3 | 20 / 18px | 600 | 1.3 | 0 |
| Body | 16px | 400–500 | 1.6 | 0 |
| Small / meta | 14px | 400–500 | 1.5 | 0 |
| Micro-label | 12px, uppercase | 700 | 1 | 0.1em (`tracking-widest`) |

- Hierarchy from size and color (`ink` → `body` → `mist`), not from extra boldness.
- **Two-tone headlines** (landing): line 1 `text-ink`, line 2 `text-brand-600` — never
  lighter than `brand-600` on white.
- Paragraph measure: 60–75 characters (`max-w-lg` / `max-w-xl`).
- `text-balance` on hero/headline text.

---

## 4. Spacing & layout

- Tailwind default scale (4px base). Stick to `1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24` for
  component spacing; no arbitrary one-offs except layout math (max-widths, hero heights).
- Container: **`.page-container`**, defined once in `main.css` — `width: 100%`,
  `max-width: 96rem` (1536px), `margin-inline: auto`, and `padding-inline` stepping
  `1rem → sm:1.5rem → lg:2rem → xl:2.5rem → 1600px:3rem` (16 / 24 / 32 / 40 / 48px). Every
  public band uses it — navbar row, hero, section, CTA panel, footer — so the whole site shares
  one left/right edge. Do not hand-roll `mx-auto max-w-* px-*` on a public section again.
  Full-width backgrounds stay full-width; only the inner container is bounded.
- Inside it, section headers keep the `max-w-2xl` recipe and long prose keeps a readable measure
  (`max-w-2xl` / `max-w-3xl`) even when its panel runs full width. One container per page.
- **Documented exception:** immersive single-purpose surfaces run full-bleed across the shell's
  content area, using the shell's own `px-4 sm:px-6 lg:px-8` as their padding instead of the
  public container — currently the patient-facing hospital profile and the AI assistant /
  Therapy room (the room's chat and memory columns stay a balanced grid, not a centred strip).
- Section rhythm: `py-24` desktop, `py-16` mobile.
- Breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- Minimum supported width **360px** — no horizontal scroll at any width.
- Landing hero is `min-h-[110vh]` so the scroll choreography has room.

---

## 5. Radius & elevation

- `rounded-full` — pills, primary CTAs, avatars.
- `rounded-xl` / `rounded-2xl` — cards, panels.
- `rounded-lg` — inputs, in-app buttons, small controls.
- Elevation is border-first: 1px `border-line` (or `border-brand-200` on tints), shadow
  only for cards (`shadow-soft`) and hover/floating layers (`shadow-lift`).
- Never heavy border + heavy shadow together.

---

## 6. Motion

Library: **framer-motion**. One shared ease curve everywhere:

```js
const EASE = [0.23, 1, 0.32, 1];
```

- **Micro-feedback** (hover color, border): 150–250ms, CSS transitions.
- **Entrances**: 0.8–1.2s fade + rise (y 20–30px), staggered — never simultaneous.
- **UI transitions**: ≤300ms. Nothing longer except hero entrances.
- Animate `transform` and `opacity` only (compositor-friendly). No animating
  `width`/`height`/`top`. **Documented exception:** the admin sidebar collapse animates the
  aside's `width` (and the content wrapper's `padding-left`) on the shared ease over 300ms,
  because the rail genuinely changes size; keep it to that one shell and its inner padding.
- Charts animate with the same rule — lines draw in via `pathLength`, rings and bars fade or
  grow with `scaleX`/opacity; never animate an SVG `width`.
- **Landing entry stagger (canonical):** wrapper 0.3s → logo 0.5s → headline 0.7s →
  sub 0.9s → CTAs 1.2s, all with `EASE`.
- **Scroll choreography:** hero content owns its exit range (y `0 → 90`, scale
  `1 → 0.94`, opacity `1 → 0` by ~75% progress); each background layer owns its own
  pass-through parallax range. Keep the ranges separate or the timing fights.
- **Spring smoothing:** scroll-linked values ride `useSpring` (`SCROLL_SPRING` in
  `src/lib/motion.js` — stiffness `150`, damping `30`) so parallax glides instead of
  stepping with the wheel.
- **Section entrances (below the hero):** `whileInView` with
  `{ once: true, amount: 0.2 }`, staggered through `RevealGroup` / `RevealItem`; section
  decorations parallax gently (≤ ±80px) against the section's own scroll range.
- **Reduced motion is global:** the CSS kill switch lives at the bottom of `src/main.css`,
  `MotionConfig reducedMotion="user"` wraps the app in `App.jsx`, and every scroll-driven
  value is additionally gated with `useReducedMotion` — reduced-motion users get the
  static composition. Don't opt out.

---

## 7. Components

### Buttons
- **Primary:** `bg-brand-700 text-white`, hover `bg-brand-800`, `rounded-full`, shadow
  `shadow-lg shadow-brand-900/20`. Uppercase micro-label on landing CTAs
  (`text-xs font-bold uppercase tracking-widest`); sentence case in-app.
- **Secondary:** white fill, `border-line`, `text-body`; hover: `border-brand-300` +
  `bg-brand-50` + `text-ink`.
- **Magnetic CTA:** `MagneticButton` (landing only) — cursor offset × 0.3, 0.15s
  cubic-bezier inline transform, `active:scale-95`. Touch devices fall back to a normal
  button automatically.
- **Icon + label CTAs** are `inline-flex items-center justify-center gap-2
  whitespace-nowrap` — never let the icon glue to the label.
- **Destructive (reject/suspend):** white fill, `border-line`, `text-body`; hover
  `border-danger` + `text-danger`. Reversible or neutral actions use the secondary style.
- **On deep panels** (`bg-brand-950`): primary is white fill + `text-ink` (hover
  `bg-brand-50`); secondary is a `border-white/20 text-white` ghost (hover `bg-white/10`);
  focus uses `ring-brand-300` + `ring-offset-brand-950`. Copy on deep panels is white with
  alpha (primary `white/80`, secondary `white/60`), micro-labels `brand-300`, icons
  `brand-400`. Deep fills never carry the logo or `btn-shine`.
- Focus (all controls): `focus-visible:ring-2 ring-brand-600 ring-offset-2`. Never
  remove focus styles. One primary per section.

### Brand mark (logo)
- `/Aurora.png` is a light-green lockup on transparency: navbar at `h-9`, hero at
  `h-12`. Keep it on white or green tints — it is not readable on deep fills.
- The hero always leads with the logo above the headline; the navbar repeats it small.

### Navbar
- Fixed, `bg-white/70 backdrop-blur-xl border-b border-line`, `h-20`.
- **Documented exception to §4:** the navbar row is full-bleed — no `max-w-6xl` cap — so the
  logo sits at the page edge and the action group at the far right, instead of the whole bar
  sitting in a narrow centred band. One flex row, three zones: `flex-1` logo zone, centred nav
  zone, `flex-1` action zone (`justify-end`). The equal `flex-1` sides put the links on the
  true centre line whenever they fit. Edge padding scales `px-6 → md:px-10 → xl:px-16 →
  2xl:px-20`; the zone gap (`xl:gap-12`) keeps the logo and actions well clear of the centre
  links. Links sit `gap-7` apart (`xl:gap-8`), actions `gap-4` (`xl:gap-6`). Below `lg` the
  centre zone is hidden and the bar reads logo-left / actions-right. Page *content* still uses
  the §4 container.
- Left: logo, then the marketing page links — `Features` (`/features`), `How it works`
  (`/how-it-works`), `For hospitals` (`/for-hospitals`), `About` (`/about`), `Contact`
  (`/contact`) — every one a `Link` to its own route, never an in-page anchor.
  Right: one route pill (`Explore` for guests, patients, and admins; `Hospital portal` for
  hospital accounts), plus one text link when signed out (`Sign in`) and one small primary
  (`Get started` / `Open Aurora`). Nothing else.

### About page
- Public route `/about`, guest-only like the other marketing routes. Composed with the landing
  `Navbar` and `Footer`: intro header (eyebrow, one `h1`, lead), story section
  (`md:grid-cols-2` — copy plus a three-point card), six-card "what's inside" grid on the
  `Features` card recipe, one deep `bg-brand-950` principles panel, and a closing CTA row.
- Same container (`max-w-6xl px-6`), section rhythm (`py-16 md:py-24`), `Reveal` entrances,
  and card/panel rules as the landing sections; the intro clears the fixed navbar with
  `pt-32 pb-16 md:pt-40 md:pb-24`.

### Contact page
- Public route `/contact`, guest-only like the other marketing routes. Landing `Navbar` and
  `Footer`, same container and section rhythm as the About page: intro header (`pt-32 pb-16
  md:pt-40 md:pb-24`), then a `lg:grid-cols-5` split — `col-span-2` contact-info card (icon
  circle + micro-label + value rows on `divide-y divide-line`), `col-span-3` message form.
- Form fields reuse `TextField`; the message textarea uses the shared field shell on white with
  a `text-xs text-mist` privacy line. Submit is the landing primary pill, full width. On submit
  it swaps to a `border-brand-200 bg-brand-50` confirmation panel with a `bg-white` icon circle,
  the reply-time line, and a secondary "Send another message" — **frontend-only, no mailbox**,
  so the panel says so and points at the support address.
- Quick help: a `max-w-3xl` accordion — one `border-line`/`shadow-soft` panel, `divide-y`
  items, each an `h3 > button` with `aria-expanded` / `aria-controls`, a `ChevronDown` that
  rotates 180° in 200ms, and a panel with `role="region"` + `aria-labelledby`. First item open.
- Closes with the deep `bg-brand-950` CTA/trust panel (eyebrow `brand-300`, white headline,
  `white/70` copy, white primary + `border-white/20` ghost per §7, check bullets). Contact
  details are obvious demo placeholders.

### Marketing pages (Features, How it works, For hospitals)
- Three standalone guest-only routes — `/features`, `/how-it-works`, `/for-hospitals` — each a
  real page, not a rehash of a landing section. Same shell as About/Contact (landing `Navbar` +
  `Footer`), same container (`max-w-6xl px-6`), rhythm (`py-16 md:py-24`), intro
  (`pt-32 pb-16 md:pt-40 md:pb-24`), card, and deep-panel recipes; entrance via `Reveal` /
  `RevealGroup` / `RevealItem`.
- `/features` — two-tone intro, nine-card capability grid (`sm:grid-cols-2 lg:grid-cols-3`:
  discovery, appointments, records, labs, vitals, emergency SOS, AI doctors, therapy, care
  navigation), a patient/hospital two-card split with check bullets, then a deep CTA panel.
- `/how-it-works` — six-step journey on a vertical rail (`max-w-3xl`, numbered
  `border-brand-200 bg-white` circles on a `w-px bg-line` line, three micro-points per step),
  then a deep CTA panel.
- `/for-hospitals` — the B2B page: apply → review → portal onboarding on the three-card recipe,
  a six-card console grid (appointments, doctors & staff, laboratory, inventory & pharmacy,
  emergency & fleet, verification), a verification + sample public-profile split (the sample
  carries `Verified` and reads "demo data only"), and closes on the deep panel with why-hospitals
  join bullets plus both hospital CTAs.
- The landing keeps short previews that link out: three feature cards + "See all features",
  the three-step strip + "See the full journey", and the hospital panel + "Everything hospitals
  get on Aurora". Landing section ids stay for direct anchors.

### Auth pages
- Split layout via `AuthSplitLayout`: the form on one side (signup right, signin left)
  and a deep forest (`bg-brand-950`) testimonial panel with quoted reviews and stars on
  the other; the panel hides below `lg`.
- Sign-in has two modes behind a segmented control (`bg-surface` pill, active = white +
  `shadow-soft`): password, and a one-time code emailed to the account. Password reset is a
  two-step code flow on `/forgot-password`. The code field is a 6-digit
  `inputMode="numeric"` text field — never a password field. The admin console uses the same
  two-mode sign-in inside its dark frame.
- Email confirmation: `/verify-email` for patients and admins, and the same card inline on
  `/hospital/pending` — a `border-line` + `shadow-soft` panel with a `bg-brand-50` icon
  circle and a code field. Unverified patients see a `border-brand-200` + `bg-brand-50`
  banner on `/explore` with a "Verify email" pill. Soft gate: unverified accounts still
  browse.
- Every sign-in footer links to the other portals: patients → hospital portal and admin
  console; hospitals → patient portal and admin console. Always plain `text-xs` links in
  `text-brand-700`, never buttons.
- **Demo access** — `/signin` opens with a `border-brand-200 bg-brand-50` panel: a role
  dropdown (patient / doctor / hospital / admin) and one primary "Sign in instantly" button
  that starts a session against the seeded demo account. Backed by
  `POST /api/auth/demo-login`, which is gated by the `DEMO_LOGIN` env flag — turn it off for a
  real deployment.

### Status screens
- Hospital application status (`/hospital/pending`): white canvas, centered `max-w-lg` card
  (`border-line`, `rounded-2xl`, `shadow-soft`), status icon in a `bg-brand-50` circle
  (`bg-danger-bg` + `text-danger` when suspended), and a three-step timeline
  (Submitted → Under review → Approved) with the active dot allowed to `animate-pulse`.
  One primary action + one ghost; no logo on these screens.

### Admin console
- Signed out: the dark `AdminFrame` card (like the auth split panel) with the two-mode
  sign-in — password or emailed code.
- Signed in: the shared shell (`components/shell/DashboardShell.jsx`) rendered with
  `variant="admin"` — the other consoles keep the base chrome. Sidebar `w-64` expanded /
  `w-20` collapsed rail (icon-only, labels hidden with `lg:hidden`, toggle in the topbar,
  state kept in `localStorage`); items are `rounded-lg` rows on a 16px left rhythm (header
  `px-4`, nav `px-2`, rows `pl-2`, sub-items `pl-8`) — active `bg-brand-50 text-brand-800`
  with a 3px `bg-brand-600` indicator bar, idle `text-body` hover `bg-surface`. The
  pending-approval count rides the Applications item as a `bg-brand-700` pill (a dot when
  collapsed). Brand mark + `Admin` chip at the top; at the bottom a profile block — avatar
  initial, account email (`truncate`), "Admin account" line — above the sign-out row.
- The rail centres exactly: nav rows and sign out `lg:pl-[23px]`, the profile avatar run
  `lg:pl-[14px]`, and the "A" monogram `hidden lg:grid lg:left-[22px]` — icons, avatar and
  monogram all land on the 80px rail's centre line.
- Below `lg` the sidebar is an off-canvas drawer: `translate-x` transition, backdrop
  `bg-brand-950/20 backdrop-blur-sm`, closes on backdrop click, Escape, or navigation. The
  drawer carries the profile block, which is where the account email lives below `sm`.
- Topbar: sticky, `h-16`, `bg-white/80 backdrop-blur-xl border-b border-line`, with the
  drawer button (mobile), the collapse toggle (desktop), then the current section's icon tile
  (`h-8 w-8 bg-brand-50 text-brand-700`) and name on the left (title truncates), and any
  `topbarExtra` chip plus the account email on the right — email truncates
  (`max-w-[200px] lg:max-w-xs`) and shows from `sm` up.
- Sections are routes — `/admin` overview, `/admin/applications`, `/admin/verification`,
  `/admin/hospitals`, `/admin/subscriptions`, `/admin/accounts` — sharing one data load
  through the outlet context. Cards, tables and chips reuse the standard patterns above.
- Collapse animation (the §6 exception): the aside's width eases `16rem ↔ 5rem` over 300ms on
  the shared curve while the content wrapper's `padding-left` follows; the inner column keeps
  a fixed `w-64` and the aside clips it, so no text reflows. Labels, the account email, the
  count pill and the logo mark cross-fade with the "A" monogram over 200ms, and item padding
  eases to the rail's centred value — `lg:pl-[31px]` on the base chrome, `[23px]`/`[14px]`/
  `[22px]` on the admin chrome above — so icons glide to the centre of the rail. The pending
  dot rides the icon's corner while collapsed.
- Charts are hand-rolled SVG (`components/admin/charts/`) — no chart library:
  `AreaChart` (smoothed 14-day signups with a crosshair, hover tooltip and legend totals),
  `DonutChart` (status and verification breakdowns with a centre total and legend), and
  `BarChart` (horizontal bars that grow with `scaleX`, origin-left). Series colours come from
  the palette via `currentColor` + a `text-*` class and `stopColor="currentColor"` gradients,
  so components still carry no hex. Wrap each in a standard card with a title and quiet
  subtitle; the Overview uses charts in place of KPI cards.

### Patient area (patients and admins)
- `/dashboard` is the patient's home after sign-in: greeting, an email-confirmation banner
  while unverified, three action cards (Find a hospital, Ask Aurora, Account settings), and a
  "Highly rated hospitals" row of compact cards with a View pill.
- The same `DashboardShell` carries the sidebar — Overview (`/dashboard`), Hospitals
  (`/explore`), Settings (`/dashboard/settings`) — with the chip reading "Patient". Sidebar,
  rail collapse and drawer behaviour use the shared base chrome (the admin console layers its
  own `variant="admin"` chrome on top; see the admin console rules).
- `/explore` and `/explore/:id` live inside this shell (no landing navbar). The shell's `main`
  supplies padding, so page content only adds its own `max-w-*` container.
- Settings: profile (name), email plus confirmation state, password change, and a sign-out
  panel; every form shows saving/saved/error states.

### Emergency SOS page (patients)
- `/dashboard/emergency`, inside the patient shell on one full-width `space-y-6` column — the
  shell supplies the page padding; the page adds no `max-w` cap.
- **Red is an accent, never a page fill** — icon circle, eyebrow, active chip, the SOS button and
  the live card's border. Green carries normal state (reached ladder steps, "No active request",
  the send button); `cancelled` is the only red status chip. `arrived` and `completed` read the
  same green, in-progress steps stay neutral.
- Compact banner (not a tall hero): eyebrow, `h1` "SOS & ambulance" with the `Siren` in a
  `bg-danger-bg` circle, one-line lead, and a right-hand status indicator — `SOS active`
  (`border-danger/30 bg-danger-bg text-danger`, dot `animate-pulse`) or `No active request`
  (`border-brand-200 bg-brand-50 text-brand-700`).
- Live request card (`border-danger/30 bg-white`): header row of `Live — …` + `StatusChip` with a
  secondary **Cancel request** (`w-full sm:w-auto`, hover `border-danger text-danger`), then
  `lg:grid-cols-2` — left is the ladder (a `w-px bg-line` rail, `ring-4 ring-white` dots, reached
  `bg-brand-600`) plus a three-cell `divide-x` metrics `dl` for ETA / distance / ambulance; right
  is the route panel (`bg-surface`, plot vertically centred, dot legend).
- Bottom: `lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6` — a proportional 40/60 split, so
  both columns grow with the page: the SOS button (horizontal `py-5`, icon in a `bg-white/15`
  circle) above the ambulance form on the left, emergency history on the right. The SOS button is
  not a tall block; it must not push the action below the fold.
- Form fields are shared `TextField`s with visible labels and `space-y-4`; history records are an
  icon circle + hospital name + `StatusChip`, then a `pl-[38px]` meta `dl` (kind + time, pickup,
  reason) on `divide-y divide-line`. Both grids collapse below `lg`; controls go full width.

### Routing & guards
- Guest-only routes (`/`, `/about`, `/signin`, `/signup`, `/forgot-password`,
  `/hospital/signin`, `/hospital/apply`) are wrapped in `GuestOnly`; a signed-in visitor is
  redirected to `homeFor(role)` — patient → `/dashboard`, hospital → `/hospital`, admin → `/admin`.
- Protected areas are wrapped in `RequireRole` (pass `roles`, or nothing for any signed-in
  account); hospital accounts that are not `active` are sent to `/hospital/pending`.
- Guards own every redirect — pages never navigate away just because someone is signed in.
- The catch-all route points at `/`, which runs through `GuestOnly`, so unknown URLs resolve
  correctly for the visitor's state.

### Hospital area (approved hospitals only)
- `/hospital` is the hospital's home. Sidebar groups (menus → sub-menus): **Clinical** —
  Appointments (`/hospital/appointments`), Doctors & staff (`/hospital/doctors`), Laboratory
  (`/hospital/lab`); **Operations** — Inventory (`/hospital/inventory`), Verification
  (`/hospital/verification`); **Listing** — Profile (`/hospital/profile`), Page & plan
  (`/hospital/public-page`); plus plain Overview and Settings rows. Group labels are
  `text-xs uppercase tracking-widest text-mist` with the group icon (hidden when the rail is
  collapsed); sub-items indent to `pl-9`, or `lg:pl-[31px]` in the collapsed rail.
- Overview: name, area · city, rating, verification chip, today's appointments, a "Needs
  attention" list (low stock, open lab orders, verification), and the next few bookings.
- Appointments: status filter chips, patient requests with Confirm / Complete / Cancel, plus a
  walk-in booking form. Doctors & staff: register doctors and the wider team with roles
  (doctor, nurse, receptionist, lab, admin), specialty, department and status. Laboratory:
  a test catalogue plus orders that move requested → collected → processing → completed with a
  result summary the patient sees. Inventory: items with quantity and reorder level, movement
  logging (in / out / set exact count) and low-stock warnings.
- Page & plan: the marketplace — pick a plan, then apply any theme that plan includes, with a
  live preview beside it. Verification: up to five labelled documents and the review status.
- Profile (`/hospital/profile`) — the listing editor. One `max-w-6xl` page, a `flex-wrap` header
  with a secondary **Preview public listing** action, then
  `lg:grid-cols-[minmax(0,1fr)_320px]`: the form card on the left and a `lg:sticky lg:top-24`
  rail on the right holding the read-only "Public listing details" summary (name, verification
  chip, specialties count) plus a tips card. The form is four `<section>`s split by
  `border-t border-line pt-8`, each with a micro-label heading and one `text-mist` hint line:
  Hospital information, Contact & location, Specialties, Hospital logo. Field pairs ride
  `sm:grid-cols-2`; the description textarea and specialties stay full width. Ends with the
  primary **Save changes** and a secondary Cancel `Link` in a `border-t` action bar.
- Nav badges: pending appointment requests, open lab orders, low stock, and a verification
  prompt when documents were rejected.

### Public hospital page (patients)
- The theme comes from the hospital's subscription: `classic` (white), `emerald` (deep
  banner), `sunrise` (tinted hero), `midnight` (dark canvas). Tokens live in
  `frontend/src/lib/themes.js` (`themeStyles(id)` → page / hero / title / muted / body / chip /
  card / primary / secondary / badge classes) and are shared by the patient-facing page and
  the hospital's own preview, so what they pick is what patients get.
- Verified hospitals carry a `ShieldCheck` badge beside the name.
- Booking card, two modes: **Ask Aurora** (describe the need → the AI suggests a doctor and the
  next free slot → confirm) and **Pick a time** (doctor, date, time, reason). Slots run
  09:00–17:00 in 30-minute steps; a taken slot returns a conflict and asks for another time.

### Admin console (additions)
- Verification queue (`/admin/verification`): documents side by side, a reviewer note, and
  Mark verified / Request new documents.
- Themes & plans (`/admin/subscriptions`): MRR, the plan catalogue, and every hospital's plan,
  theme and renewal date.

### Doctor area (doctor accounts)
- `/doctor` is the doctor's home: Overview (stats, today's schedule, next up, and an inline
  "My details" form for specialty/department/phone), Appointments, Timetable, Laboratory and
  Settings. Same `DashboardShell` (base chrome), chip reads "Doctor", status chip in the
  topbar.
- Doctors sign in through the normal `/signin` (password or emailed code) and land on
  `/doctor`; a doctor with no linked hospital profile sees an explanatory card.
- Laboratory (`/doctor/lab`): request a test (patient name, optional account email, test,
  priority, note), read results as a flagged table, add an interpretation, then **Send to
  patient** — that release is what makes the report visible in the patient's dashboard.
  Nav badge counts completed reports waiting for review.
- Timetable: the shared `Timetable` grid (day rows × 09:00–17:00 slot columns) with 7/14-day
  switches; the hospital's appointments page uses the same grid with doctor rows.

### Laboratory reports
- Test catalogue rows carry parameters (name, unit, reference low/high) and orders snapshot
  them, so results keep the ranges they were filed against.
- Results are entered per parameter; flags (`low`/`normal`/`high`) are computed server-side
  and rendered through `LabResultsTable` — red for out-of-range, `brand-700` for normal.
- Every order gets a report number (`LAB-XXXXXX`). Patients only receive results once the
  doctor releases the report; before that the API returns the order with results stripped.
- `/dashboard/lab/:orderId` is the printable report: hospital letterhead (logo, address,
  phone, verified badge), report number and release date, patient/test details, the flagged
  results table, laboratory summary, the doctor's interpretation, and a signature block, with
  a "Print or save as PDF" action. The shell hides its sidebar and topbar with `print:hidden`
  and the page prints clean.

### Marketplace (hospital equipment)
- `/hospital/marketplace` with three tabs: Browse (search, category and condition dropdowns,
  listing cards with photo, price, seller hospital and a Reserve action), My listings (create,
  mark sold, relist, delete) and Purchases (reserved/sold items with a Release action).
- Listings carry category (Imaging, Surgical, Laboratory, Monitoring, Furniture, Vehicles,
  IT & Software, Consumables, Other), condition (new/refurbished/used), price in Rs, up to
  three images and a status (`available`, `reserved`, `sold`); reserving emails the seller.
- Hospitals buy and sell; admins can browse but not list. A seller can never reserve their own
  listing.

### Forms
- Visible `<label>` above every input (14px, 600, `text-ink`) — never placeholder-as-label.
- Input: `h-11 rounded-lg border-line` white; focus `ring-2 ring-brand-600`; error:
  `border-danger` + 14px `text-danger` message below.
- Selects go through `SelectField` — same shell as inputs with `appearance-none`, a
  `ChevronDown` affordance and the same focus ring; never ship a bare native select. Sizes:
  `md` (h-11, forms) and `sm` (h-10, toolbars and list rows). List-row selects carry an
  `aria-label` instead of a visible label; anything inside a form keeps a visible `<label>`.
- Choice lists that **filter** a list (roles, statuses, categories) are dropdowns, not chip
  rows — chips are for showing a value, dropdowns are for choosing one. Values shown to users
  come from `src/lib/labels.js` (`Doctor`, `Lab technician`, `Sample collected`, …), never the
  raw enum.
- 8px label→input, 16–24px between fields; full-width on mobile.

### Cards
- White + 1px `border-line` + `rounded-2xl` + `shadow-soft` + `p-6`. Tinted variant:
  `bg-brand-50/60`. At most one level of nesting.

### Scroll regions
- A panel that scrolls keeps `overflow-y: auto` and drops the bar with `.scrollbar-none`
  (`scrollbar-width: none` for Firefox, `-ms-overflow-style: none` for legacy Edge, and
  `::-webkit-scrollbar { display: none }` for Chrome/Edge/Safari — defined in `main.css`).
  Wheel, trackpad, touch and keyboard scrolling all keep working.
- **Never `overflow: hidden` on a region that must scroll** — that removes the scrolling, not
  just the bar. Used by the AI assistant chat log and the "What Aurora remembers" panel.

### Explore (patients only)
- The whole explore area sits behind patient (or admin) sign-in; guests are sent to
  `/signin` and land back where they were.
- Page order: header, AI care-navigation card (`bg-surface`; textarea + primary
  "Find the right care"), search + location row, then the card grid. Triage results show an
  urgency chip — `bg-brand-50` routine, `bg-surface` soon, `bg-brand-950` urgent — suggested
  specialty chips (clickable, they set the search filter), advice, and the disclaimer line.
- Cards: white card, `border-line`, `rounded-2xl`, `shadow-soft`; optional logo thumbnail,
  hospital name (links to the detail page), area · city, specialty chips, short description,
  one quoted review, a single-star rating with review count, and a "View hospital" pill.
- Detail page (`/explore/:id`): logo or initials block, name, rating, specialty chips, one
  primary (Call) + one secondary (Get directions) action, photos, about, and reviews.

### Feedback states
Every async surface defines all three:
- **Loading:** skeleton for content, spinner for actions. Never blank.
- **Empty:** what will appear here + one action.
- **Error:** what failed + retry.

---

## 8. The landing page recipe (canonical)

Implementation: `src/components/landing/`. Change this recipe here first, then in code.
Shared motion constants live in `src/lib/motion.js` (`EASE`, `SCROLL_SPRING`); scroll
reveals use `Reveal` / `RevealGroup` / `RevealItem`.

**Hero structure** — `<section min-h-[110vh] bg-white overflow-hidden>`, content at `z-10`.
The content wrapper is itself `min-h-[110vh] flex flex-col items-center justify-center
pt-20 pb-24` — `pt-20` clears the fixed navbar, and centering keeps the block in the first
viewport instead of drifting up the section.

**Background layers** (`HeroBackground.jsx`, prop-driven):

1. *Optional faint photo* — ≤10% opacity, grayscale, under white gradient washes. Off by
   default (deterministic builds); enable with `photoSrc`.
2. *Green glows* — two soft radial-gradient blobs, `brand-200`/`brand-100` at low alpha.
3. *Dot grid* — `radial-gradient(rgb(5 46 22 / 0.08) 1px, transparent 1px)`, 32px tile; the
   layer overshoots the section (`-inset-y-24`) so parallax never exposes an edge.
4. *Animated SVG network* — 3 bezier paths (`viewBox 0 0 1440 900`,
   `preserveAspectRatio="slice"`), green gradient strokes, drawn in **on mount** via
   `pathLength 0 → 1` (1.8s `EASE`, staggered 0.5 / 0.75 / 1.0s); 9 dots fade in staggered
   (`0.9 + i·0.08`); whole layer capped at ~0.35 opacity. Prefix SVG gradient ids per
   instance so two instances never collide.
5. *White edge fades* — top and bottom, so the art dissolves into the white page. These
   never parallax — they are the dissolve mask.

**Hero scroll choreography** — progress measured on the hero box with
`['start start', 'end start']` (0 at page load, 1 when the hero has left), spring-smoothed:
top-left glow `y 0 → 140`, right glow `y 0 → –110`, dot grid `y 0 → –60`, network
`y 0 → –150` with opacity `0.35 → 0` from 55% progress; content per §6.

All background layers: `pointer-events-none`, `aria-hidden`.

**Hero content, in order** — brand mark (`/Aurora.png`, `h-12`) → two-tone display headline
→ quiet sub (`text-mist`, `max-w-lg`) → CTA row: `MagneticButton` primary (label +
`ArrowRight`, per §7) + ghost secondary. Entry stagger per §6.

**Sections below the hero** (same white canvas, `py-16 md:py-24` rhythm, `scroll-mt-20` so
the navbar anchors land below the fixed header):

1. `#features` — eyebrow + h2 + one-line lead, then a six-card grid
   (`sm:grid-cols-2 lg:grid-cols-3`) of white `rounded-2xl border-line shadow-soft` cards:
   icon in a `bg-brand-50` circle, title, one-sentence copy. Cards lift on hover; the grid
   staggers in via `RevealGroup`.
2. `#how-it-works` — three numbered steps on `md:grid-cols-3`. A `bg-line` track with a
   `brand-300 → brand-500` gradient overlay draws across (`scaleX`, origin-left, clamped to
   mid-section progress) while the badges — `bg-white` circles on the line — stagger in.
3. `#for-hospitals` — one deep `bg-brand-950 rounded-2xl` panel: `brand-300` eyebrow, white
   headline, `white/70` copy, `Check` bullets, primary white → `/hospital/apply`
   ("Register your hospital"), ghost secondary → `/hospital/signin`; the right column shows a
   sample public-profile card with a gentle parallax. Deep-panel colour and button rules are
   in §7.
4. Footer — `border-t border-line`, logo, jump links, one-line note. Static; no motion.

Section decorations drift at most ±80px against the section's scroll range; entrances use
`whileInView` once. Copy stays value-first and sentence case; sample data in mock UI must be
obviously fake (see §10).

---

## 9. Accessibility (non-negotiable)

- Semantic HTML first; ARIA only to fill gaps.
- One `<h1>` per page; no heading-level skips.
- Everything keyboard-operable, focus always visible (`ring-brand-600`).
- Contrast: body ≥ 4.5:1, large text ≥ 3:1 — the color table in §2 is the shortlist of
  what passes. When in doubt, darken.
- Touch targets ≥ 44px on touch layouts.
- Decorative graphics `aria-hidden`; meaningful images get real `alt`.
- `prefers-reduced-motion` honored via the global kill switch.

---

## 10. Copy

- Health-care tone: precise, calm, human — never cute, never alarmist.
- Sentence case everywhere, except the landing's uppercase micro-labels (documented
  exception).
- Buttons: verb + object ("Start free trial", "Save changes").
- Errors: what happened + how to fix ("Enter a time like 09:30").
- Never show real patient data anywhere — fixtures, screenshots, and demos use obviously
  fake sample names.

---

## 11. Do / Don't

```jsx
// Do — schema fill that passes contrast, real states
<button className="rounded-full bg-brand-700 px-8 py-4 text-xs font-bold uppercase
  tracking-widest text-white shadow-lg shadow-brand-900/20 transition-colors
  duration-300 hover:bg-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600
  focus-visible:ring-offset-2">
  Start free trial
</button>

// Don't — raw hex, light-green fill with white text (unreadable), no focus state
<button className="rounded-full bg-[#90d890] px-8 py-4 text-white">Start free trial</button>
```

```jsx
// Do
<p className="text-body leading-relaxed">Appointments, records, and billing in one place.</p>
<span className="text-mist text-sm">No credit card required</span>

// Don't — brand-300/400 text fails contrast on white
<p className="text-brand-300">Appointments, records, and billing in one place.</p>
```

```jsx
// Do — motion with the shared curve
<motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 1, ease: [0.23, 1, 0.32, 1], delay: 0.7 }} />

// Don't — springy bounce, animating layout properties
<motion.div animate={{ height: 200 }} transition={{ type: 'spring', stiffness: 800 }} />
```

---

## 12. Where things live

- Color schema + base + reduced-motion: `src/main.css` (`@theme` block). It is the only
  place raw values appear.
- Components: `src/components/`, landing pieces in `src/components/landing/`, pages in
  `src/pages/`.
- Tailwind utilities first; a component `.css` file only for keyframes or genuinely
  complex CSS that utilities can't express.
- No CSS-in-JS, no new UI libraries (Tailwind + framer-motion + lucide-react is the
  stack).

---

## 13. Changing these rules

Rules change like code: edit this file in the same change that needs the exception, keep
the token tables in sync with `src/main.css`, and say why in the commit message.

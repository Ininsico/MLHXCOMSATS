# Aurora — Agent Guide

Aurora is a health-care management system (patients, appointments, records, billing)
built for the MLH × COMSATS Islamabad Abbottabad hackathon. Presentation: white canvas,
light green brand, deep forest ink — full rules in `DESIGN.md`.

Workspaces:

- `frontend/` — React 19 + Vite, JavaScript (not TypeScript), Tailwind CSS v4
  (`@tailwindcss/vite`) with the full color scheme schema in `src/main.css`,
  framer-motion, lucide-react, Poppins. Dev server on http://localhost:5173.
- `backend/` — Express 5 + Mongoose (MongoDB Atlas), CommonJS. JSON API under `/api`:
  health, auth (`/api/auth/*` — password, emailed one-time codes, password reset, email
  confirmation, profile and password change), hospitals (`/api/hospitals` — patient-gated
  search and detail, `/apply`, `/mine`, subscription/theme/verification for hospital
  accounts), staff (`/api/staff` — doctors get linked doctor accounts), doctor
  (`/api/doctor/*` — own profile, appointments, timetable, lab requests and report
  releases), inventory (`/api/inventory`), laboratory (`/api/lab` — tests with reference
  ranges, orders with per-parameter results, automatic low/high flags, report numbers,
  `/mine` reports for patients), appointments (`/api/appointments` — hospital queue plus
  `/mine` booking for patients), marketplace (`/api/marketplace` — hospitals buy and sell
  equipment), uploads (`/api/uploads/image` → Cloudinary), AI (`/api/ai/triage`,
  `/api/ai/booking` → Groq), admin (`/api/admin/*` incl. subscriptions and verification),
  demo sign-in (`/api/auth/demo-login`, gated by `DEMO_LOGIN`). Roles: patient / hospital /
  doctor / admin. Plan and theme catalogues live in `src/lib/plans.js`; specialties in
  `src/lib/specialties.js`; email sends through Brevo (`src/lib/mailer.js`). `src/app.js`
  builds the app, `src/index.js` starts it and bootstraps the main admin; secrets live in
  `backend/.env` (never committed).

## Commands

| Where | Task | Command |
| --- | --- | --- |
| `frontend/` | install | `npm install` |
| `frontend/` | dev server | `npm run dev` |
| `frontend/` | lint | `npm run lint` |
| `frontend/` | build | `npm run build` |
| `backend/` | install | `npm install` |
| `backend/` | dev | `npm run dev` (node --watch) |
| `backend/` | start | `npm start` |
| `backend/` | seed demo data | `npm run seed` |
| `backend/` | auth smoke test (API running) | `npm run smoke` |

## Standing rules

- **Finish the task** — a request is worked to completion in one pass: build every item
  asked for, verify each one against the running system, then report. Never stop halfway,
  never ask permission to continue, and never make the user repeat a request. If an item
  genuinely cannot be finished, say exactly which one and why — after finishing the rest.
- **Done = verified** — frontend lint + build must pass, and backend changes are exercised
  with a live check against the running API, before reporting anything complete.
- **Servers** — run the API and the AI sidecar when verification needs them (the user has
  asked for working software, not static code). Stop any long-running process you started,
  or say plainly that it is still running.
- **Design** — `DESIGN.md` is binding for all UI. Load the `frontend-design` skill before
  any change that renders.
- **API** — follow the `api-conventions` skill (envelope, error codes, validation, CORS,
  single frontend API wrapper). Sessions ride the httpOnly `aurora_session` cookie through
  the Vite `/api` proxy — no tokens in JS.
- **Demo data** — `npm run seed` (backend) builds the demo world: three hospitals with
  staff, inventory, lab catalogues, bookings, lab reports and marketplace listings, plus
  `demo.patient@aurora.local`, `demo.doctor@aurora.local` and `demo.hospital@aurora.local`
  (password `Aurora@123`). The script only ever deletes and recreates those demo records —
  it never touches real data. Sample records stay obviously fake (see Privacy).
- **Privacy** — health-care data is sensitive. No real patient data in code, fixtures,
  tests, seeds, or screenshots; use obviously fake sample data. Never log patient values.
- **Accounts** — patients and hospitals self-serve; the hospital flow is
  apply → admin approval → portal, and unapproved hospital accounts stay on
  `/hospital/pending`. Signup and applications send a confirmation email the user enters on
  `/verify-email` (soft gate — unverified accounts can still browse). The main admin is
  bootstrapped on every start from `MAIN_ADMIN_EMAIL` + `MAIN_ADMIN_PASSWORD` in
  `backend/.env` (never commit those values) and signs in with that password or an emailed
  code.
- **Dependencies** — don't add one without a clear need; the stack is Tailwind +
  framer-motion + lucide-react and stays that way unless the team decides.
- **Commits** — don't commit unless asked; imperative subjects.

## Map

- Design rules → `DESIGN.md`
- App routes → `/` landing, `/dashboard` + `/dashboard/appointments|lab|lab/:orderId|
  settings` (patient home, patients and admins), `/explore` + `/explore/:id` (inside the
  patient shell), `/signin` (with instant demo access), `/signup`, `/forgot-password`,
  `/verify-email`, `/hospital/signin`, `/hospital/apply`, `/hospital/pending`, `/hospital` +
  `/hospital/appointments|doctors|lab|inventory|marketplace|verification|profile|
  public-page|settings` (hospital dashboard, approved accounts only), `/doctor` +
  `/doctor/appointments|timetable|lab|settings` (doctor dashboard), `/admin` +
  `/admin/applications|verification|hospitals|subscriptions|accounts` —
  `frontend/src/pages/` (admin pages in `frontend/src/pages/admin/`, patient pages in
  `frontend/src/pages/patient/`, hospital pages in `frontend/src/pages/hospital/`, doctor
  pages in `frontend/src/pages/doctor/`)
- Route guards → `GuestOnly` (guest pages bounce signed-in users to `homeFor(role)`) and
  `RequireRole` (protected areas); guards own the redirects, pages don't
- Dashboard shell → `frontend/src/components/shell/DashboardShell.jsx` (admin, patient,
  hospital); account forms → `frontend/src/components/shell/AccountSettings.jsx`
- Main admin → `ininsico@gmail.com` (`MAIN_ADMIN_EMAIL` / `MAIN_ADMIN_PASSWORD` in
  `backend/.env`) — signs in at `/admin` with that password or an emailed one-time code;
  the console is a sidebar shell with Overview, Applications, Hospitals, and Accounts.
- Landing hero recipe → `DESIGN.md` §8; implementation in `frontend/src/components/landing/`
- Project skills → `.commandcode/skills/` (`frontend-design`, `api-conventions`)
- Learned preferences → `.commandcode/taste/`

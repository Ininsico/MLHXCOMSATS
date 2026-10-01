---
name: api-conventions
description: 'Express 5 API conventions for backend/ — folder layout, JSON response envelope, error codes, validation, CORS, and the single frontend API wrapper. Includes health-care data (PHI) handling rules. Use when adding or changing endpoints, routes, middleware, or wiring frontend fetch calls.'
when_to_use: 'Trigger on backend work: add an endpoint or route, change a response shape, validate requests, touch middleware or CORS, connect the frontend to the API.'
argument-hint: '[resource or endpoint]'
metadata:
  author: MLHXCOMSATS
  version: "1.0"
---

# API Conventions (Aurora)

Applies to `backend/` (Express 5, CommonJS). JSON only. Patient data is sensitive —
treat every field as PHI unless proven otherwise.

## Layout

```
backend/
├── src/
│   ├── app.js          # builds and exports the Express app (no listen)
│   ├── index.js        # reads PORT, starts the server, bootstraps the main admin
│   ├── routes/<resource>.js   # auth, hospitals, admin, uploads, ai
│   ├── models/         # Mongoose schemas (user, hospital, login-code)
│   ├── middleware/     # error handler, auth and role guards
│   └── lib/            # HttpError, auth, otp, mailer (Brevo), emails, cloudinary, groq
├── .env                # never committed
└── package.json
```

Scripts exist: `npm run dev` (watch), `npm start`, `npm run smoke` (auth flow check with
cleanup). Routes mount under `/api`. Port: `process.env.PORT`, default 3000.

Accounts carry a role — `patient` (default on signup), `hospital`, `admin` — and a status:
`active`, `pending`, or `suspended`. Patients and admins are `active` from the start;
hospital accounts are created only through `POST /api/hospitals/apply` as `pending` and an
admin flips them to `active` with `PATCH /api/admin/hospitals/:id/status`. Guard
role-specific routes with `requireAuth` then `requireRole('hospital' | 'admin')`; hospital
data lives under `/api/hospitals`, admin data under `/api/admin`.

## Response envelope

Success (200):

```json
{ "data": { "id": "p_1", "name": "Sample Patient" } }
```

Collections: `{ "data": [], "meta": { "count": 0 } }`. Created → 201 with the resource
in `data`. Deleted → 204, empty body.

Errors (any status ≥ 400):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary.",
    "details": [{ "field": "email", "message": "Required." }]
  }
}
```

| Code | Status |
| --- | --- |
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `RATE_LIMITED` | 429 |
| `SERVICE_UNAVAILABLE` | 503 |
| `INTERNAL` | 500 |

`message` is safe for clients. Never include stack traces; the 500 message is generic,
the real error is logged server-side.

## Errors

- Central error middleware in `middleware/`, registered last; a 404 fallback after all
  routes returns the `NOT_FOUND` envelope.
- Express 5 forwards rejected promises from async handlers to error middleware — use
  async handlers without try/catch for control flow.
- Expected failures throw an `HttpError`:

```js
class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
```

Unknown errors → generic 500.

## Validation

- Validate every input (body, params, query) at the boundary before it touches logic.
- 400 with per-field `details`; coerce types explicitly; reject unexpected shapes rather
  than silently ignoring them.
- No validation library is installed. A small helper in `middleware/` is fine; if one is
  added later, wire it in one place and update this skill.

## Auth, email, uploads, AI

- Sessions are httpOnly `aurora_session` cookies (JWT, 7 days). Start every session through
  `startSession(res, user)` in `lib/auth.js` — signup, signin, OTP verify, and hospital
  apply all use it.
- Sign-in is password **or** a one-time code emailed to the account:
  `POST /api/auth/otp/request` then `/otp/verify`. Codes live in the `login-code` collection
  (bcrypt-hashed, 10-minute TTL, 5 attempts, 3 requests per email per 15 minutes), and the
  same store backs password reset (`purpose: 'reset'`) and email confirmation
  (`purpose: 'verify'`). Confirmation codes go out on patient signup and on hospital
  application, and are checked with `POST /api/auth/verify/request` + `/verify/confirm`.
- The main admin is bootstrapped on every start from `MAIN_ADMIN_EMAIL` and
  `MAIN_ADMIN_PASSWORD` (role `admin`, status `active`, email pre-verified) and can sign in
  with that password or an emailed code. Never put either value in docs or code.
- Email goes through Brevo's REST API in `lib/mailer.js` (no SDK). `sendEmail` throws
  `SERVICE_UNAVAILABLE` when the message must arrive (codes); `sendEmailQuietly` is for
  notifications that must never fail the request. Templates live in `lib/emails.js`.
- Uploads: `POST /api/uploads/image` takes a base64 data URL (≤ 4 MB, png/jpg/webp) and
  signs it server-side for Cloudinary. The uploads router carries its own
  `express.json({ limit: '8mb' })` and is mounted **before** the global 100kb parser in
  `app.js` — keep that order or large uploads die with a 413.
- AI: `POST /api/ai/triage` proxies Groq through `lib/groq.js` (JSON-only contract, strict
  server-side validation of the response shape). Never log the patient's free text, and
  always return the disclaimer field with the answer.
- Laboratory reports: test catalogues carry parameters (name, unit, reference low/high) and
  orders snapshot them, so results always keep the ranges they were filed against; flags
  (`low`/`normal`/`high`) are computed server-side in `lib/lab.js`, never accepted from the
  client. A report becomes patient-visible only when a doctor releases it
  (`PATCH /api/doctor/lab-orders/:id` with `send: true` → status `sent`); `GET /api/lab/mine`
  strips results and interpretation for anything not yet sent.
- Doctor accounts: adding a doctor to a hospital (`POST /api/staff`) creates or links a `User`
  with role `doctor`, which is what lets them sign in and reach `/api/doctor/*`. A staff row
  owns the profile; the user owns the session.
- Marketplace: hospitals list equipment, other hospitals reserve it (`status: reserved`,
  `buyer` set) and the seller marks it sold. Sellers cannot reserve their own listings.
- Demo sign-in: `POST /api/auth/demo-login` starts a session for the seeded demo account of a
  role. It is gated by `DEMO_LOGIN` and must be disabled in any real deployment.
- Provider config comes from `process.env`: `BREVO_*`, `CLOUDINARY_*`, `GROQ_*`,
  `MAIN_ADMIN_EMAIL`, `APP_URL`. Missing config throws `SERVICE_UNAVAILABLE`, never a 500.

## Privacy (PHI)

- Never log request bodies that may contain patient data — log record ids only.
- Third parties (Brevo, Cloudinary, Groq) receive the minimum: a code and an email address,
  an image, or the triage text. Never log the prompt, the recipient, or the image payload.
- Error `details` carry field names and rules, never the submitted value.
- Fixtures, tests, and seeds use obviously fake sample data only.
- Once auth exists, patient-scoped endpoints require it, and ownership comes from the
  session — never from a client-supplied field.

## CORS & config

- Allow only the frontend origin (`http://localhost:5173`) and the deployed origin. No
  wildcard with credentials.
- Secrets via `process.env`, `.env` gitignored (see `backend/.gitignore`).

## Frontend integration

- All calls go through one wrapper, `frontend/src/lib/api.js` — base URL, JSON parse,
  envelope unwrapping, error normalization. No ad-hoc `fetch` in components.
- Auth is an httpOnly `aurora_session` cookie; the wrapper needs no token handling, and
  everything stays same-origin through the dev proxy.
- The dev proxy is configured in `frontend/vite.config.js` (`/api` →
  `http://localhost:3000`), so the frontend calls `/api/...` with no environment config.

## Testing

- Until a test runner exists, verify manually with `curl`: happy path plus one invalid
  input per endpoint. When tests land, cover both — happy path and one validation
  failure — under `backend/test/`.

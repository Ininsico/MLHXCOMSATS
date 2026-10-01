# Aurora — Hospital Management Platform with a Local Clinical AI Stack

Aurora is a full hospital-management SaaS: public landing and hospital discovery, four
authenticated consoles (patient, doctor, hospital, platform admin), a clinical AI layer that
runs **on the hospital's own machine**, an emergency/ambulance service, hospital operations
(beds, admissions, billing, insurance claims, intake, analytics), and a platform layer for
metering, quotas, verification and audit.

Everything in this document describes code that exists in this repository. Where something is
only partially finished, it says so under [Known limits](#21-known-limits).

---

## Table of contents

1. [What Aurora is](#1-what-aurora-is)
2. [Architecture](#2-architecture)
3. [Repository layout](#3-repository-layout)
4. [Quick start](#4-quick-start)
5. [Environment variables](#5-environment-variables)
6. [Roles and journeys](#6-roles-and-journeys)
7. [Feature catalogue](#7-feature-catalogue)
8. [The AI stack](#8-the-ai-stack)
9. [The clinical knowledge graph](#9-the-clinical-knowledge-graph)
10. [The drug graph and prescription safety](#10-the-drug-graph-and-prescription-safety)
11. [AI agents](#11-ai-agents)
12. [Emergency, SOS and ambulances](#12-emergency-sos-and-ambulances)
13. [Hospital operations](#13-hospital-operations)
14. [Platform administration](#14-platform-administration)
15. [API reference](#15-api-reference)
16. [Data model](#16-data-model)
17. [Design system](#17-design-system)
18. [Verification and test suites](#18-verification-and-test-suites)
19. [Security and privacy](#19-security-and-privacy)
20. [Troubleshooting](#20-troubleshooting)
21. [Known limits](#21-known-limits)
22. [Roadmap](#22-roadmap)

---

## 1. What Aurora is

Aurora answers a specific problem: small and mid-sized hospitals run on paper, WhatsApp and
disconnected spreadsheets. Patients cannot see their own results, hospitals cannot see their own
numbers, and clinical AI is unusable because it means sending patient data to a foreign API.

Aurora is built so that:

- a **patient** can find a verified hospital, book, reschedule, check in, read released lab
  reports, keep a medical card and vitals, raise an emergency, and talk to Aurora's own AI
  doctors and therapy room — from a phone;
- a **doctor** gets a queue, AI-drafted consult notes they must approve, dictation, one-click
  follow-ups, referrals, and e-prescribing checked against a drug knowledge graph and the
  patient's own allergy card before anything is issued;
- a **hospital** registers staff, runs a lab, manages inventory and a marketplace, dispatches
  ambulances, manages beds and admissions, bills patients, files insurance claims, runs an
  emergency intake board, and sees its own analytics;
- the **platform admin** meters AI spend per hospital, verifies subscription payments before a
  plan is switched, manages the clinical corpus, flags features per hospital, reads the audit
  trail, and can export or erase a patient's data;
- the **clinical AI** — chest X-ray analysis, RAG over a local corpus, therapy, triage support —
  runs locally on the hospital machine, with a cloud text model used only where the spec allows.

---

## 2. Architecture

```
                         ┌──────────────────────────────────────────┐
   Patient / Doctor      │  frontend/  React 19 + Vite + Tailwind 4 │
   Hospital / Admin ────▶│  four consoles, one shared shell         │
                         └───────────────┬──────────────────────────┘
                                         │  /api (Vite proxy, httpOnly cookie)
                                         ▼
                         ┌──────────────────────────────────────────┐
                         │  backend/  Express 5 + Mongoose          │
                         │  routes → services → models              │
                         │  knowledge/ (clinical + drug graphs)     │
                         │  lib/ (audit, quota, queue, serializer)  │
                         └───┬──────────┬───────────┬───────────┬───┘
                             │          │           │           │
              MongoDB Atlas  │          │           │           │  RabbitMQ
              (all records) ◀┘          │           │           └──────────────▶ workers
                                        │           │                            (python)
                       Groq API         │           │  Cloudinary / Brevo
                 (gpt-oss-120b text,    │           │  (images / email)
                  Whisper STT)          │           │
                                        ▼           ▼
                         ┌──────────────────────────────────────────┐
                         │  ai-service/  FastAPI sidecar (local)    │
                         │  MedGemma 1.5 4B Q4_K_M via llama.cpp    │
                         │  Chroma vector store + hybrid retrieval  │
                         │  training/ (dataset, eval, prompt tune)  │
                         └──────────────────────────────────────────┘
                                        ▲
                                        │  WhatsApp Web session
                         ┌──────────────┴───────────────────────────┐
                         │  backend/whatsapp/nurse-bridge.js        │
                         │  whatsapp-web.js + LocalAuth, outbox     │
                         └──────────────────────────────────────────┘
```

Three processes matter in a full deployment:

| Process | What it is | Default address |
| --- | --- | --- |
| API | `backend/src/index.js` | `http://localhost:3000` |
| AI sidecar | `ai-service/app/main.py` (uvicorn) | `http://127.0.0.1:8000` |
| WhatsApp bridge | `backend/whatsapp/nurse-bridge.js` | outbound only |

The sidecar starts and manages its own `llama-server` process (default
`http://127.0.0.1:8080`) which holds the quantised MedGemma weights.

---

## 3. Repository layout

```
MLHXCOMSATS/
├── AGENTS.md                     rules for agents working in this repo
├── DESIGN.md                     binding design system (colour, motion, layout)
├── README.md                     this file
├── .gitignore                    secrets, sessions, weights, build output
│
├── backend/                      Express 5 + Mongoose API
│   ├── src/
│   │   ├── app.js                builds the app; mounts every router
│   │   ├── index.js              starts the server, bootstraps main admin
│   │   ├── knowledge/
│   │   │   ├── ontology.js       clinical schema + concept nodes + triples
│   │   │   ├── store.js          triple store: inference, resolution, query
│   │   │   └── drug-graph.js     drugs, interactions, contraindications
│   │   ├── lib/                  audit, quota, queue, share-token, serializer,
│   │   │                         slots, plans, agent-router, nurse, groq,
│   │   │                         mailer, cloudinary, otp, auth
│   │   ├── middleware/           require-auth, require-role, require-hospital, error
│   │   ├── models/               30 collections (see §16)
│   │   ├── routes/               19 routers (see §15)
│   │   └── scripts/              seed.js, nurse-demo.mjs, smoke-auth.mjs
│   └── whatsapp/nurse-bridge.js  WhatsApp Web bridge + outbox drain
│
├── ai-service/                   local clinical AI
│   ├── app/
│   │   ├── main.py               FastAPI app + llama-server manager
│   │   ├── engine.py             model lifecycle, device selection, fallbacks
│   │   ├── queue.py              RabbitMQ publisher
│   │   ├── rag/                  chunking, ingest, store, retrieve, pipeline
│   │   └── routers/              health, chat, analysis, rag, jobs
│   ├── training/                 prepare_dataset, evaluate, tune_prompt, harness
│   ├── corpus/                   clinical reference, lab ranges, platform guide
│   ├── prompts/                  baseline / calibrated / checklist prompts
│   └── data/                     chroma store, last_good.json (device memory)
│
└── frontend/                     React 19 + Vite + Tailwind v4
    ├── src/
    │   ├── App.jsx               every route + guard
    │   ├── lib/api.js            the single API wrapper
    │   ├── lib/voice.js          TTS (kitten-tts-js) + recording + STT
    │   ├── components/           shell, charts, SelectField, StatusChip, labels
    │   └── pages/                patient/, doctor/, hospital/, admin/, public
    └── public/                   logo, favicon
```

---

## 4. Quick start

### Prerequisites

- Node.js 24+
- Python 3.12 (for the AI sidecar)
- MongoDB (Atlas URI in `backend/.env`)
- Docker (optional — RabbitMQ)
- A GPU is optional; the sidecar falls back to CPU

### Backend

```bash
cd backend
npm install
cp .env.example .env          # if present, otherwise create .env (see §5)
npm run seed                  # build the demo world (safe to re-run)
npm run dev                   # node --watch src/index.js  → :3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # Vite → :5173, proxies /api to :3000
```

### AI sidecar (optional; needed for the X-ray assistant and RAG)

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt
python -m app.main                # FastAPI on :8000, manages llama-server
```

Model weights (downloaded once, ~3.2 GB, never committed):

```
models/medgemma-1.5-4b-it-Q4_K_M.gguf    (~2.37 GB)
models/mmproj-F16.gguf                   (~811 MB)
```

Fetch them with the `hf` CLI from the ungated `unsloth/medgemma-1.5-4b-it-GGUF` repo.

### WhatsApp bridge (optional)

```bash
cd backend
npm run whatsapp              # prints a QR on first run — scan once, session persists
```

### Demo accounts

`npm run seed` in `backend/` creates `demo.patient@aurora.local`, `demo.doctor@aurora.local`,
`demo.hospital@aurora.local` (password `Aurora@123`) plus three hospitals, staff, lab
catalogues, appointments, lab reports and marketplace listings. The sign-in page also has
**instant login** per role, which resolves a *provisioned* account (an approved hospital, a
doctor with a linked staff profile) rather than any account with that role string.

---

## 5. Environment variables

### `backend/.env`

| Key | Purpose |
| --- | --- |
| `PORT` | API port (default 3000) |
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | signs session cookies **and** report share links |
| `APP_URL` | frontend origin, used in emails and share URLs |
| `MAIN_ADMIN_EMAIL` / `MAIN_ADMIN_PASSWORD` | main admin, bootstrapped on every start |
| `GROQ_API_KEY` | text model (gpt-oss) and Whisper STT |
| `GROQ_MODEL` | `openai/gpt-oss-120b` |
| `GROQ_STT_MODEL` | `whisper-large-v3-turbo` |
| `CLOUDINARY_*` | logo and photo uploads |
| `BREVO_API_KEY`, `MAIL_FROM` | transactional email |
| `AI_SERVICE_URL` | `http://127.0.0.1:8000` |
| `AI_ENABLED` | `false` disables every call to the sidecar |
| `AI_CACHE_TTL_DAYS` | identical-scan cache lifetime |
| `NURSE_WEBHOOK_TOKEN` | shared secret for the WhatsApp bridge |
| `DEMO_LOGIN` | `false` turns instant login off |
| `RABBITMQ_URL`, `RABBITMQ_QUEUE` | job queue (default `aurora.ai.jobs`) |
| `AI_TOKEN_QUOTA` | default monthly token allowance per hospital |
| `MARKETPLACE_RESERVATION_DAYS` | how long a marketplace reservation holds |
| `REMINDERS_ENABLED` | toggles the medication reminder sweep |

### `ai-service` environment

| Key | Purpose |
| --- | --- |
| `MEDGEMMA_MODEL_PATH` | path to the GGUF weights |
| `MEDGEMMA_MMPROJ_PATH` | path to the vision projector |
| `LLAMA_SERVER_PORT` | llama-server port (default 8080) |
| `MEDGEMMA_TRY_FULL_OFFLOAD` | `true` attempts full GPU offload (needs ≥6 GB free VRAM) |
| `RAG_COLLECTION` | Chroma collection name |

---

## 6. Roles and journeys

### Patient

Landing → search verified hospitals → open a hospital page (theme, doctors, booking, voice
booking, Aurora AI) → book → the appointment appears in the dashboard → check in on the day →
results arrive as lab reports → rate the visit → keep vitals and a medical card → talk to AI
doctors or the therapy room → raise an SOS if something goes wrong.

### Doctor

Signs in → own dashboard (personal details, today's list, timetable) → clinical workspace: draft
a note with Aurora, dictate into it, approve and file it → prescribe (with live safety checks),
order labs, release reports, refer to another specialty → clinical AI page for scans with the
reasoning pass and feedback.

### Hospital

Applies (admin approves) → portal: overview, appointments, doctors & staff, laboratory,
inventory, marketplace, ambulance & SOS, analytics & ward, verification, public page & plan →
raises a plan request which the platform admin verifies and activates.

### Platform admin

Applications, verification, hospitals, themes & plans, AI assistant, metering & billing,
accounts, plus the audit trail and patient data requests.

### Relative (no account)

Can raise an ambulance or SOS on behalf of a patient, receives WhatsApp updates, and follows the
live tracking page through the patient's account.

---

## 7. Feature catalogue

### Patient

| Feature | Where | Notes |
| --- | --- | --- |
| Hospital discovery | `/explore`, `/explore/:id` | search by city/area/specialty, ratings, themes |
| Booking (manual) | hospital page | doctor + date + slot dropdowns |
| Booking (AI) | hospital page | describe the problem, Aurora picks specialty + doctor + slot |
| Booking (voice) | hospital page, dashboard | record a sentence, Whisper transcribes, agent offers real slots |
| Appointments | `/dashboard/appointments` | reschedule, check in, cancel, rate the visit |
| Lab results | `/dashboard/lab`, `/dashboard/lab/:id` | released reports, parameter table, print, signed expiring share links |
| Vitals | `/dashboard/vitals` | BP, weight, glucose, temperature, PHQ-9, GAD-7 with trend chart |
| Medical card | `/dashboard/medical-card` | allergies, medications, conditions, emergency contact |
| AI doctors | `/dashboard/ai-doctors` | six personas, memory panel, delete-a-memory |
| Therapy | `/dashboard/therapy` | private room, per-patient memory, crisis path |
| Emergency | `/dashboard/emergency` | SOS button, ambulance request, live tracking |
| Settings | `/dashboard/settings` | name, email verification, password, sign out |

### Doctor

| Feature | Endpoint / page | Notes |
| --- | --- | --- |
| Queue | `GET /api/doctor/queue`, workspace page | today's list, waiting, next free slot |
| AI note draft | `POST /api/doctor/notes/:id/draft` | SOAP from visit + AI findings, never auto-filed |
| Approve note | `PUT /api/doctor/notes/:id` | stamps approver and writes audit |
| Dictation | `POST /api/voice/transcribe` | records in browser, transcribes with Whisper |
| Prescriptions | `POST /api/doctor/prescriptions` | checked; serious warnings require acknowledgement |
| Safety pre-check | `POST /api/doctor/prescriptions/check` | live as the doctor types |
| Referrals | `POST/GET/PATCH /api/doctor/referrals` | create, queue, accept |
| Clinical AI | `/doctor/ai` | X-ray analysis + reasoning pass + feedback |
| Timetable | `/doctor/timetable` | weekly view |
| Lab | `/doctor/lab` | request tests, release reports |

### Hospital

| Feature | Endpoint / page | Notes |
| --- | --- | --- |
| Overview | `/hospital` | today, needs-attention, red-flag alerts panel |
| Appointments | `/hospital/appointments` | queue, status transitions |
| Staff | `/hospital/doctors` | roles, departments, leave, doctor accounts |
| Laboratory | `/hospital/lab` | tests, orders, per-parameter results, release |
| Inventory | `/hospital/inventory` | stock, reorder levels, pharmacy kind |
| Marketplace | `/hospital/marketplace` | list, reserve, release (offers API available) |
| Ambulance & SOS | `/hospital/fleet` | fleet, dispatch ladder, position updates, plan request |
| Analytics & ward | `/hospital/operations` | revenue, occupancy, no-shows, NPS, beds, admissions, intake, billing |
| Verification | `/hospital/verification` | documents, admin decision |
| Public page & plan | `/hospital/public-page` | theme, plan, subscription state |
| Profile / settings | `/hospital/profile`, `/hospital/settings` | profile completeness, account |

### Platform admin

| Feature | Endpoint / page | Notes |
| --- | --- | --- |
| Applications | `/admin/applications` | approve/reject hospital signups |
| Verification | `/admin/verification` | document review, decisions emailed |
| Hospitals | `/admin/hospitals` | status, suspend/approve |
| Themes & plans | `/admin/subscriptions` | MRR, plan catalogue, per-hospital plan |
| AI assistant | `/admin/ai` | AI settings (enabled, departments, tokens, temperature) |
| Metering & billing | `/admin/platform` | tokens per hospital, plan requests, flags, corpus, audit, export/erasure |
| Accounts | `/admin/accounts` | all users, suspend |

---

## 8. The AI stack

### 8.1 Local clinical model (vision)

- **Model**: MedGemma 1.5 4B instruction-tuned, `Q4_K_M` quantisation (~2.37 GB) with an
  `mmproj-F16` vision projector (~811 MB).
- **Runtime**: `llama.cpp` — on Windows the **Vulkan** nightly build was used, because the
  current release binaries did not cover this machine's driver and `llama-cpp-python` ships no
  cp312 wheel that fits the available CUDA toolkit.
- **Device selection**: the sidecar queries llama.cpp's device list and **pins Vulkan1
  (NVIDIA)**, because llama.cpp defaults to the *first* Vulkan device — which on this machine is
  the Intel UHD 630 iGPU, not the GTX 1050 Ti. The winning launcher configuration is persisted
  to `ai-service/data/last_good.json` so restarts come up correct on the first try.
- **Fallback ladder**: a known-good config is tried first, then progressively lower GPU offload,
  then CPU. A `vk::Queue::submit: ErrorDeviceLost` at full offload is expected on a 4 GB card
  and is why `gpu-partial-24` is the ceiling here.
- **Endpoints**: `POST /analyze-image`, `POST /chat`, `GET /health`.

### 8.2 Text model (cloud)

Groq's OpenAI-compatible API with `openai/gpt-oss-120b` for: care navigation, booking intent,
Aurora AI doctors, therapy, the WhatsApp assistant, the nurse agent, note drafting, and the
**interpretation pass** over the vision model's raw output.

Text quality matters, but privacy matters more: no patient identifier is sent with any prompt.
Prompts carry clinical context only (specialty, reason, findings, patient-supplied text).

### 8.3 Speech

- **STT**: Whisper `whisper-large-v3-turbo` via Groq. The browser records with `MediaRecorder`
  and posts the blob to `POST /api/voice/transcribe`. This replaced reliance on the browser's
  speech recognition, which silently does nothing in many setups.
- **TTS**: `kitten-tts-js` (WASM, eight voices) with the Web Speech API as a guaranteed fallback,
  so the agent always has a voice even where the WASM path cannot load.

### 8.4 Retrieval (RAG)

- Chroma vector store with hybrid ranking (dense + lexical) over a local clinical corpus
  (`ai-service/corpus/*.md`, currently ~24 chunks from 5 sources).
- `POST /rag/search` for retrieval, `POST /rag/query` for a grounded answer with citations,
  `POST /rag/documents` to add a document, `POST /rag/reindex` to rebuild, `GET /rag/stats`.
- The **platform admin has a corpus manager** that writes through these endpoints, so a guideline
  added in the UI becomes citable by every agent without touching the sidecar.
- **Per-patient memory** is embedded into the same store, tagged `source: patient:<id>`, and
  retrieval is filtered to that patient before anything reaches a model. This is isolation at the
  application layer because the sidecar's search API has no per-collection or metadata filter —
  the honest limitation is that a patient's memory can miss the top-k window, in which case the
  keyword-ranked store still covers it.
- Only the memory line is embedded, never raw therapy transcripts.

### 8.5 Jobs and events

RabbitMQ (`aurora.ai.jobs`) carries: `analysis.completed`, `rag.reindex`, `nurse.turn`,
`nurse.escalation`, `aurora.turn`, `aurora.crisis`, `whatsapp.outbox`, `emergency.sos`,
`emergency.ambulance`, `appointment.booked`, `subscription.requested`. A Python worker
(`ai-service/scripts/worker.py`) consumes them and logs outcomes; escalations print a visible
alert line. If the broker is down, publishing is skipped and logged — the request path never
fails because of the queue.

### 8.6 Training and calibration

Gradient fine-tuning of a 4B vision-language model is **not possible on a 4 GB GPU** (QLoRA needs
~16 GB+). `ai-service/training/` therefore does calibration instead:

- `prepare_dataset.py` — pulls labelled public chest X-rays (MedMNIST PneumoniaMNIST, CC BY 4.0,
  48 labelled images);
- `evaluate.py` — scores the model against labels (agreement, confusion);
- `tune_prompt.py` — evaluates prompt variants and writes the winning prompt;
- the winning prompt is what the live service loads.

A LoRA-on-rented-GPU path is documented in the sidecar README for teams that want true
fine-tuning.

---

## 9. The clinical knowledge graph

The routing layer is not a keyword dictionary. `backend/src/knowledge/` holds a real triple store
with an ontology.

### 9.1 Schema layer

Entity types: `Symptom`, `Condition`, `Specialty`, `RedFlag`, `Question`, `UrgencyLevel`,
`BodySystem`, `AgeGroup`.

Predicates, each with a declared domain and range:

| Predicate | Domain → Range | Notes |
| --- | --- | --- |
| `IS_A` | any → any | transitive; drives subsumption |
| `HAS_SYMPTOM` | Condition → Symptom | inverse of the next |
| `INDICATES_CONDITION` | Symptom → Condition | |
| `MANAGED_BY` | Condition/Symptom → Specialty | symptoms obtain it by inference |
| `REQUIRES_URGENCY` | Condition/Symptom → UrgencyLevel | inherited by symptoms |
| `HAS_RED_FLAG` | Condition/Symptom → RedFlag | inherited by symptoms |
| `ASKS_QUESTION` | Condition/Symptom → Question | inherited by symptoms |
| `CONTRAINDICATES` | Condition/Symptom → Condition/Symptom | asymmetric; declared, no instances yet |
| `PRESENTS_IN` | Condition → AgeGroup | age-specific handling |

`validate()` fails on any triple whose subject or object type is outside the predicate's
domain/range, and it fails if a `Condition` node lacks `diagnosable: false` and
`assertionRules`. **Safety is a schema property, not a convention.**

### 9.2 Inference

Every derived edge is stored with `inferred: true` and the rule that produced it:

- `R0:inverse_materialised` — `HAS_SYMPTOM` ↔ `INDICATES_CONDITION`
- `R1:IS_A_transitive` — subsumption closure
- `R2:symptom_specialty_via_condition` — a symptom reaches its specialty through the conditions
  it indicates
- `R3:redflag_inherited_by_symptom`
- `R4:question_inherited_by_symptom`
- `R5:urgency_inherited_by_symptom`

Current size: **81 nodes, 228 triples (106 asserted, 122 inferred), 9 predicates, 8 types, 15
concepts carrying real SNOMED CT / ICD-10 codes.**

### 9.3 Entity resolution

`resolve(text)` maps free text to canonical concept ids and handles:

- **aliases** — "pain in my chest", "chest tightness", "pressure in my chest" → `sym:chest_pain`
- **abbreviations** — "sob", "cp", "bp"
- **spelling variants** — Levenshtein distance 1 for tokens of 6+ characters ("headche" →
  headache)
- **negation** — a cue within the three tokens before a match flips it: *"no chest pain, just a
  mild headache"* yields chest pain **negated** and routes to general medicine, not cardiology

### 9.4 Query interface

- `query({subject, predicate, object, inferred})` — pattern reads
- `objectsOf` / `subjectsOf` — one-hop helpers
- `path(from, to)` — BFS traversal, used to explain *why* a message routed where it did
- `toCypher()` — exports the whole graph as `MERGE` statements (309 lines) so it can be loaded
  into Neo4j unchanged

### 9.5 Routing

`lib/agent-router.js` is a thin front end over the store: it resolves the message, queries
specialties, urgency, red flags and questions, and returns the agent plus the graph facts. The
only non-graph input is an **explicit service request** ("I want to talk to a therapist"), which
is a routing instruction rather than a clinical finding and is honoured directly.

---

## 10. The drug graph and prescription safety

`knowledge/drug-graph.js` reuses the same store, inference engine and resolver, adding drug nodes
and three predicates: `IS_A` (drug → class), `INTERACTS_WITH` (symmetric), `CONTRAINDICATED_IN`
(drug/class → clinical condition). Because the clinical nodes are merged in, one traversal can go
*ibuprofen → NSAID → contraindicated in gastroenteritis → managed by general medicine*.

`checkPrescription({drugs, allergies, conditions})` returns warnings — it never blocks by itself:

1. **Drug ↔ drug**, including class-level links (SSRIs with NSAIDs), evaluating every linked pair
   and keeping the **worst** severity.
2. **Allergy cross-check** against the patient's medical card: a drug matches if it *is* the
   allergen or belongs to its class — "allergic to penicillin" flags amoxicillin.
3. **Contraindications** against the patient's long-term conditions.

Severity is explicit and reviewable (`SEVERITY` map), not inferred. The API refuses to issue a
prescription while a `serious` warning is unacknowledged (`409 WARNINGS_UNACKNOWLEDGED`); the UI
disables the issue button until the box is ticked.

Only well-established, textbook interactions are seeded. Everything uncertain stays out pending
clinician sign-off.

---

## 11. AI agents

| Agent | Surface | Behaviour |
| --- | --- | --- |
| Care navigation | `POST /api/ai/triage` | problem → specialty, urgency, advice |
| Booking assistant | `POST /api/ai/booking` | roster-aware doctor + slot suggestion |
| Aurora AI doctors | `/api/aurora/*`, patient app | six personas: general, cardiology, paeds, skin, women's health, therapy |
| Therapy | `/api/aurora/chat` (persona `therapy`) | reflective listening, one question at a time, per-patient memory, crisis path |
| WhatsApp assistant | `POST /api/whatsapp/turn` | same personas over chat, per-number threads, **booking actions**, quota-aware |
| Nurse Aria | `lib/nurse.js`, `/api/nurse/*` | post-discharge script: greeting → meds → adherence → symptoms → appointment → closing, with escalation |
| Voice booking | `/api/voice/*` | record → transcribe → intent → real slots → confirm → appointment |
| Clinical assistant | `/api/ai/analyze-image`, `/doctor/ai` | local vision model + a text-model **interpretation pass** |

### Crisis handling

Crisis language ("I do not want to live", "kill myself", …) is detected by a **deterministic
pattern**, not by the model. The reply is fixed and human-first (emergency services, crisis line,
a clinician is being alerted), the session is flagged, and an `aurora.crisis` event is published.
The pattern was widened after a test showed "do **not** want to live" slipped past a
"don't"-only expression — a safety net may not depend on the model's mood.

### Escalation rules (nurse)

`needs_escalation` from the model, **plus** an independent safety net: chest pain, breathing
difficulty, self-harm, heavy bleeding, loss of consciousness, or two or more reported symptoms.
Escalations mark the session, publish `nurse.escalation`, and appear in the hospital's red-flag
alerts panel.

---

## 12. Emergency, SOS and ambulances

- **Patient side** (`/dashboard/emergency`): a full-width SOS button and an ambulance request form
  (pickup point, reason, callback number, relative who receives updates). Device location is
  attached when the browser permits.
- **Triage seeding**: the complaint is resolved against the clinical graph, so *"crushing chest
  pain spreading to the left arm"* arrives at the hospital already marked `critical`, with the red
  flags the graph found, and the intake board seeds its triage level the same way.
- **Routing**: the nearest approved hospital is chosen by haversine distance when coordinates
  exist, otherwise the requester may name one.
- **Fleet**: hospitals register ambulances (call sign, type, crew, driver, phone) and keep
  availability current.
- **Dispatch ladder**: `raised → acknowledged → dispatched → en_route → on_scene → transporting →
  arrived → completed`, with ETA computed from distance at 30 km/h.
- **Live tracking**: the patient and family see the ladder, ETA, distance, call sign, **driver name
  and phone**, and an SVG of the route travelled (patient position in brand green, ambulance in red
  — no map library).
- **Family notification**: every step that matters is queued through the WhatsApp outbox, so a
  relative without an account still gets the updates.
- **Completion** returns the ambulance to `available` and records the outcome.

---

## 13. Hospital operations

| Area | Detail |
| --- | --- |
| **Analytics** | revenue billed and collected by month, top departments, appointment totals, no-show rate, bed occupancy, inpatient count, patient experience (average, % rated 4+, NPS) |
| **Ward board** | beds by ward with status (free / occupied / cleaning / closed), admit to a bed, discharge (bed returns to cleaning) |
| **Billing** | invoices with line items (consultation, laboratory, pharmacy, procedure, other), totals, mark paid, **insurance claims** (insurer, policy, submitted/approved/rejected) |
| **Emergency intake** | arrivals board with graph-seeded triage level 1–5, concept tags, status transitions, nurse override |
| **Equipment** | service, repair, calibration, inspection and fault logs with next-due dates and cost |
| **Pharmacy** | inventory items flagged as pharmacy kind; dispensing decrements stock |
| **Marketplace** | list equipment, reserve, release, offers with accept/decline/withdraw, buyer-side completion, stale reservations lapse |
| **Audit** | every consequential action in the hospital writes an audit event |

---

## 14. Platform administration

- **AI token metering** per hospital, attributed from the channels that carry a hospital id, with
  platform-wide totals for the rest. Every agent already records tokens; this is the roll-up.
- **Quotas**: each hospital's plan carries a monthly token allowance. The WhatsApp channel enforces
  it — over the limit, the agent stops calling the model, tells the patient to ring the front desk,
  and writes a `quota.blocked` audit line. Read/set endpoints live under
  `/api/admin/hospitals/:id/quota`.
- **Subscription requests with payment verification**: a hospital asks for a plan with a payment
  reference; the admin **verifies the payment first**; approval is refused with a 409 until then.
  On approval the hospital's plan, theme and renewal date are written and an audit line recorded.
  Verified live: `limit=100 allowed=False` on a tightened quota, and a plan switched to `growth`
  with its renewal date set.
- **Feature flags** per hospital (`ai`, `voice`, `whatsapp`, `therapy`, `nurse`, `marketplace`,
  `lab`).
- **Corpus manager**: paste a guideline → it is embedded → reindex → stats. Added documents are
  immediately citable by every agent.
- **Audit trail**: who did what, to what, when.
- **Patient data requests**: export (a bundle of profile, appointments, lab orders, vitals,
  reviews, prescriptions, admissions, AI conversations and memories) and erasure (conversations,
  memories, profile and vitals deleted; clinical records anonymised rather than destroyed; the
  audit line survives).

---

## 15. API reference

All routes are mounted under `/api`. Envelope: `{ data, meta? }` on success,
`{ error: { code, message, details? } }` on failure. Sessions ride the httpOnly `aurora_session`
cookie — no tokens in JavaScript.

| Router | Base | Highlights |
| --- | --- | --- |
| auth | `/api/auth` | signup, signin, email code login, password reset, verify email, demo login, me, password change |
| hospitals | `/api/hospitals` | explore list, detail, apply, mine, subscription/theme, verification |
| staff | `/api/staff` | staff CRUD, doctor linking, timetables |
| appointments | `/api/appointments` | hospital queue, `/mine` booking, status transitions |
| doctor | `/api/doctor` | queue, notes (draft/approve), prescriptions (+check), referrals, lab requests, report release |
| lab | `/api/lab` | tests with reference ranges, orders, per-parameter results, flags, `/mine` reports |
| inventory | `/api/inventory` | stock, reorder levels, pharmacy kind |
| marketplace | `/api/marketplace` | list, mine, create/update/delete, reserve, release, **offers**, **complete** |
| ai | `/api/ai` | triage, booking, analyze-image (+interpretation), chat, inferences, feedback, settings |
| aurora | `/api/aurora` | personas, chat, sessions, memories (get/delete) |
| voice | `/api/voice` | transcribe (Whisper), turn, confirm, end, sessions |
| nurse | `/api/nurse` | webhook (bridge), simulate, sessions, alerts |
| whatsapp | `/api/whatsapp` | turn (inbound), threads, outbox (queue/pull/sent/failed) |
| patient | `/api/patients` | profile, vitals, reschedule, check-in, review, share/revoke, shared report (public) |
| emergency | `/api/emergency` | sos, ambulance, mine, track, location, cancel, fleet, requests, dispatch, subscription-request |
| operations | `/api/operations` | analytics, beds, admissions, invoices, claims, equipment, intake |
| admin | `/api/admin` | applications, verification, hospitals, subscriptions, AI settings, accounts |
| admin (platform) | `/api/admin` | usage, audit, flags, quota, corpus, subscription decisions, export, erasure |
| uploads | `/api/uploads` | Cloudinary image upload |

---

## 16. Data model

Thirty Mongoose collections. The most important:

**Identity & access** — `User` (role, status, email confirmation), `LoginCode` (hashed one-time
codes), `AuditEvent`.

**Clinical** — `Hospital`, `Staff`, `Appointment`, `ClinicalNote`, `Prescription`, `Referral`,
`PatientProfile` (medical card), `VitalsEntry`, `Review`.

**Laboratory** — `LabTest`, `LabOrder` (parameters, results, flags, report number), `ReportShare`
(signed link, expiry, views, revocation).

**Hospital operations** — `Invoice` (lines, totals, claim sub-document), `Bed`, `Admission`,
`EquipmentLog`, `Intake`, `InventoryItem`, `Listing` + `ListingOffer`.

**Emergency** — `Ambulance`, `EmergencyRequest` (kind, severity, pickup, trail, timeline, ladder
status).

**AI** — `AiInferenceLog`, `AiFeedback`, `AiCache`, `AiSettings`, `AuroraChat`, `AuroraMemory`,
`VoiceSession`, `NurseSession`, `NurseTurn`, `WhatsappThread`, `OutboxMessage`.

**Billing** — `SubscriptionRequest` (plan, payment, verification, decision).

Two schema notes worth knowing:

1. **`id` is guaranteed on every JSON response.** Mongoose does not add the `id` virtual when a
   schema declares its own `toJSON` transform, which silently shipped responses with only `_id`.
   `lib/serializer.js` wraps every schema's transform once at boot.
2. **Some fields live outside their schema on purpose** (`hospital.subscription`,
   `hospital.features`, `hospital.theme`). They are written and read through the collection
   directly, because strict mode would otherwise drop them. This is stated in the code at each
   site.

---

## 17. Design system

`DESIGN.md` is binding. In practice:

- White canvas, light-green brand ramp (`brand-50`…`brand-950`), deep forest ink, `mist` for
  secondary text, `line` for borders, `surface` for wells, one `danger` red.
- **Tokens only** — no raw hex in components.
- One easing curve and one spring configuration; motion is `framer-motion`, never a second
  animation library.
- **No chart library.** Area, bar, donut and line charts are hand-rolled SVG.
- **No GSAP.** Scroll and spring primitives already cover what is needed.
- Selects always go through `SelectField`; statuses always through `StatusChip`; human labels
  always through `lib/labels.js`.
- One `DashboardShell` for all four consoles (collapsible rail, animated collapse, off-canvas
  drawer, nested nav groups read from `entry.items`).

---

## 18. Verification and test suites

Aurora is verified by exercising the running system, not by reading code. The suites are Node
scripts that sign in through the real API (instant login), call real endpoints, and assert on real
data.

| Suite | Covers | Last result |
| --- | --- | --- |
| emergency + subscription | SOS → queue → fleet → dispatch → location → track → complete; plan request → verify payment → approve → plan switched | **23/23 green** |
| doctor · hospital · admin | queue, notes, prescriptions (interaction, allergy, gate, clean issue), referrals; beds, admissions, invoices, claims, intake (graph triage), equipment, analytics; metering, audit, flags, corpus, export | 19/20 |
| patient phase 1 | medical card, vitals, reschedule, check-in guard, reviews (unique per visit), share link mint/read/tamper/revoke; outbox confirmation | 16/18 |
| marketplace | listing visible, offer made, offers visible to buyer, withdrawn | passed |
| quotas | read back, tightened limit blocks | passed |

Frontend must pass `npm run lint && npm run build` before anything is called done; the backend must
load (`node -e "require('./src/app.js')"`) and changed endpoints must answer on the running API.

The two outstanding failures are the **outbox delivery-confirmation assertions**, which race the
live bridge (it polls every five seconds and can consume the test message before the assertion
reads the pull payload). The fix is to assert against the message's stored status rather than the
pull response.

---

## 19. Security and privacy

- **No real patient data** in code, fixtures, tests, seeds or screenshots. Demo records are
  obviously fake.
- **Patient values are never logged.** Turn logs store structure, flags and token counts; prompts
  carry clinical context, never identifiers.
- **Sessions** are httpOnly cookies signed with `SESSION_SECRET`; roles are enforced by middleware
  (`requireAuth`, `requireRole`, `requireHospital`) and client-side guards.
- **Share links** are HMAC-signed over resource id + expiry with a timing-safe comparison; expired
  links return 410, tampered links 403, revoked links 404.
- **Per-patient AI memory** is filtered to that patient before it reaches any model.
- **Secrets** live in `backend/.env` and are gitignored, along with the WhatsApp session
  (`backend/.wwebjs_auth/` — full access to a linked account), model weights, and the Chroma store.
- **Audit trail** records approvals, verification, prescriptions, admissions, invoices, quota
  changes, data exports and erasures.

---

## 20. Troubleshooting

**The X-ray assistant is slow (≈55 s).** The vision projector runs on CPU on a 4 GB card — a
hardware ceiling, not a bug. Full GPU offload needs ~6 GB free VRAM
(`MEDGEMMA_TRY_FULL_OFFLOAD=true`).

**`vk::Queue::submit: ErrorDeviceLost`.** Full offload attempted on a 4 GB card. The sidecar falls
back automatically; the known-good config is remembered in `data/last_good.json`.

**It picks the Intel iGPU instead of the NVIDIA card.** llama.cpp defaults to the first Vulkan
device. The sidecar queries the device list and pins `Vulkan1 (NVIDIA)`.

**Groq returns 404 `model_not_found`.** The model name you are asking for is not in that account's
catalogue. Check `GET https://api.groq.com/openai/v1/models`; this project uses
`openai/gpt-oss-120b` and `whisper-large-v3-turbo`.

**WhatsApp says "The browser is already running for …session-aurora-nurse".** A previous bridge
(or its Chromium children) still holds the profile. Kill the node process and its chrome children,
remove `SingletonLock`, and start again. Only ever run one bridge.

**A message got no reply.** Read `backend/whatsapp-bridge.log`: a `typing indicator skipped` line
is harmless (the API moved between releases), `outbound failed` means the number is not on
WhatsApp, and no line at all means the bridge was not running.

**Outbox messages are not arriving.** The bridge polls `/api/whatsapp/outbox/pull` every five
seconds and confirms with `/sent`; without that confirmation the message stays `pending` and is
retried up to three times before being marked `failed` — deliberately, so nothing is lost silently.

**Corpus answers cite nothing.** The AI sidecar is not running, so retrieval returns no passages;
the agent degrades to ungrounded answering rather than failing.

---

## 21. Known limits

Stated plainly, because a demo should be honest:

**Clinical content**

- Drug-interaction instances cover textbook interactions only; anything uncertain is left out
  pending clinician review.
- PHQ-9 / GAD-7 are stored as patient-entered scores; item wording has not been clinically signed
  off.
- 15 concepts carry real SNOMED CT / ICD-10 identifiers; the rest are uncoded rather than invented.
  Full coverage needs the SNOMED licence or a UMLS-backed deployment.
- `CONTRAINDICATES` is declared with domain/range and asymmetry but **has no instances yet** —
  seeding it means making clinical claims.

**Architecture**

- The clinical graph is an in-process triple store with a hand-written rule engine — **not** Neo4j
  and not RDF/OWL with a description-logic reasoner. The Cypher export is the migration path.
- Per-patient vector memory is isolated by tagging and filtering at the application layer because
  the sidecar's search API has no per-collection filter.
- Quotas are enforced on the hospital-attributable WhatsApp channel; other channels are metered but
  not yet capped.
- Multi-branch is a switcher plus record tagging, not per-branch permission isolation.
- Webhooks have no retry queue — a failed POST is logged and dropped.

**Product**

- Marketplace offers have endpoints and client methods but no buttons on the marketplace page yet.
- Appointment slots come from a fixed 09:00–17:00 half-hour grid per doctor, not per-doctor
  availability windows.
- Plan "purchase" is request → verification → activation; no card gateway is wired (the adapter is
  `manual` and works today).
- Lab results are structured parameters plus text summaries; PDF uploads are not stored.

---

## 22. Roadmap

1. Marketplace offer buttons and sold-price display on listing cards.
2. Outbox assertions rewritten against stored status; suites fully green.
3. Per-collection vector isolation on the sidecar, then per-patient collections.
4. Webhook delivery with retries and a dead-letter view.
5. Per-doctor availability windows replacing the fixed grid.
6. Payment gateway (Stripe test mode) behind the existing adapter.
7. Voice and WhatsApp agents that reschedule and cancel, not only book.
8. Nurse reminders sweep (`REMINDERS_ENABLED`) surfaced in the hospital UI.

---

## Licence

Hackathon project — MLH × COMSATS Islamabad (Abbottabad). Third-party components keep their own
licences; the MedMNIST dataset used for calibration is CC BY 4.0.

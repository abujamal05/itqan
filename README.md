# Itqan — handover

Everything built so far, why it was built that way, what is still open, and how to attach the real
agents and database. Written to be read cold by someone who was not here.

Read sections 1 to 8 for how it is built, then **section 9, the agent and database integration
guide**, which is the one that matters most. Section 11 lists what is still open.

---

## 1. What this repo is

Itqan is an Arabic native career navigator for **job seekers and job switchers** in Oman and the Gulf.

It attacks confusion and lost time. People apply to hundreds of roles that were never a fit, cannot tell
which are worth the evening, and have nobody telling them what to fix first. Itqan answers four
questions in order:

1. **Where do I stand today?**
2. **Which role should I aim for?**
3. **What is the shortest path there?** In real courses and certifications.
4. **Which jobs can I apply to now?** Matched to that position and the stated preferences.

Every answer is measured against live regional demand and what those openings currently ask for, and
carries its reason and a real source you can open.

**It is not a translation engine.** Turning "Database Systems II" into "SQL" is one step inside question
one. An earlier pitch led with it and the framing still resurfaces in copy; the product is the position,
the goal, the path and the fit.

**Pricing.** The parts that get someone into work are free and stay free: where they stand, the path, the
job matches and the advisor. A premium tier covers extended use of the AI.

The repo holds **two deployed products** that are halves of one thing:

| Folder | What it is | Vercel project |
|---|---|---|
| `itqan-website/` | Public marketing site. Astro, static. Owns **log in and sign up**. | `itqan-site` |
| `Onboarding/` | The signed-in product. React + Vite. Onboarding, dashboard, courses, job postings. | `app-itqan` |

They are separate deployments on separate domains, joined by a signed-token handshake (section 6).

```
itqan-site.vercel.app     /            marketing pages
                          /ar/… /en/…  including login and signup
                          /api/…       auth endpoints + the handoff bridge

app-itqan.vercel.app      /            the product app (SPA)
                          /api/…       session, onboarding, and agent endpoints
```

---

## 2. Quick start

```bash
cd itqan-website && npm install && npm run build
```

```bash
cd Onboarding && npm install && npm run dev -- --port 4333
```

Build the site once, then run everything from the app's dev server. Open
**http://localhost:4333/** — that is the marketing site. Log in there and you land in the app.

Locally the two halves are served as **one origin** by a Vite plugin (`Onboarding/dev/site-plugin.ts`)
which serves the site's build at `/`, the app under `/app/`, and implements every `/api/` endpoint.
In production they are two origins and the plugin does not ship. This difference is the single most
important thing to understand about the dev setup.

That includes `/api/handoff`, the endpoint the site's forms navigate to on success. There is nothing
to hand over locally — one origin, one cookie — so it is a plain redirect to `/app/`. It still has to
exist: without it every local sign in ended on the site's own 404 page and the flow could not be
walked before deploying.

### Test accounts

Password for both: `itqan1234`

| Email | Exercises |
|---|---|
| `maryam@itqan.test` | Fresh account. Walks the whole onboarding flow. |
| `nasser@itqan.test` | Already onboarded. Lands straight on the dashboard. |

They live **server side only** and are never rendered into any page. Signing up through the site's
own form also works.

Two handles for awkward paths: name a file `unreadable-anything.pdf` to force the pipeline to fail,
and reload mid-onboarding to see the "pick up where you left off" offer.

---

## 3. Stack

| | |
|---|---|
| Site | Astro 5, static output, plain CSS over design tokens. No UI framework. |
| App | React 19, TypeScript 6, Vite 8, react-router 7, lucide-react for icons. Plain CSS. |
| State | React context + `useState`. No state library: one flow and three data screens do not justify one. |
| Backend | Vercel serverless functions, **zero dependencies** (`node:crypto` only). |

**Do not add npm packages casually.** Committing `node_modules` broke the deployment repeatedly early
on; there is now a root `.gitignore` for it. Everything server-side is written against Node built-ins
for the same reason.

---

## 4. Repository layout

```
Drafts/
├─ README.md                     ← this file
├─ .gitignore                    node_modules stays out, permanently
│
├─ itqan-website/                THE SITE
│  ├─ src/pages/{ar,en}/…        routes, one tree per language
│  ├─ src/components/            Header, Footer, Hud, toggles
│  ├─ src/components/pages/      the page bodies
│  ├─ src/scripts/form.ts        client-side form validation (auth forms)
│  ├─ src/styles/tokens.css      THE design tokens — single source of truth
│  ├─ src/config.ts              form endpoints + where a successful login lands
│  ├─ api/placeholder/{login,signup}.js
│  ├─ api/handoff.js             the cross-domain bridge
│  └─ api/_lib/auth.js           signing, cookies, seeded accounts
│
└─ Onboarding/                   THE APP
   ├─ src/api/types.ts           ★ THE CONTRACT — read this first
   ├─ src/api/http.ts            the only client
   ├─ src/screens/               Upload, Questions, Confirm
   ├─ src/app/                   AppLayout, Dashboard, Jobs, Courses, Documents, Profile
   ├─ src/components/            UI kit, Hud, Journey, MatchCard, CourseCard…
   ├─ src/state/                 api, auth, onboarding providers
   ├─ src/i18n/{ar,en}.json      every string, both languages, exact parity
   ├─ src/styles/                tokens (copied), global, app, chrome
   ├─ api/                       the deployed backend (see section 9)
   ├─ dev/site-plugin.ts         DEV ONLY: serves the site + implements /api
   ├─ dev/data.ts                DEV ONLY fixtures
   └─ vercel.json                SPA rewrite, excluding /api
```

---

## 5. The two products

### The site (`itqan-website`)

Marketing pages plus the account forms. Arabic and English are separate route trees (`/ar/…`,
`/en/…`) with `hreflang` alternates. Its job ends at "create a free account".

Pages: home, how it works, proof, who we are, privacy, terms, login, signup, forgot password, 404.

Two of those are **reachable only by typing the URL**, on purpose:

- `/who-we-are/` — the team page. Unlinked until the backend exists, at the request of the owner.
- `/forgot-password/` — built and working, but it cannot send an email yet. A recovery page that
  silently does nothing is worse than no recovery page: the person using it has already lost access
  and would wait for a message that never arrives. The link goes back into the login page the day
  the two endpoints in 9.3 are live, and nothing else has to change.

### The app (`Onboarding`)

```
/upload      add documents             step 1 of 3
/questions   four preference questions step 2 of 3
/confirm     check what was read       step 3 of 3
/dashboard   where you stand
/courses     courses that close gaps
/jobs        job postings you match
/documents   replace your documents, then re-read them
/profile     see and correct everything held about you
```

There is **no login or sign-up screen in the app, and there must never be one.** The site owns them.
The API contract has no `login()` or `signup()`, and no password appears anywhere in the app
codebase. A second sign-in surface is a second thing to keep in step and the first one to drift.

---

## 6. Authentication — how it actually works

This took two attempts. The first assumed one origin and broke completely on deployment. What
follows is the working design.

### The constraint

The site and the app are separate Vercel projects on separate domains. A cookie set by one **cannot**
be read by the other. Serverless functions keep nothing between invocations, and there is no database
yet. So the session cannot live on a server, and it cannot live in a shared cookie.

### The solution: the user travels inside a signed token

```
1. User submits the SITE's own login form (unchanged markup and script)
       │  POST /api/placeholder/login        ← same origin, so the cookie sticks
       ▼
2. Site validates, signs a token carrying the user, sets its own cookie, returns 200
       │  form.ts sees response.ok and navigates to config.ts → appUrl
       ▼
3. GET /api/handoff on the SITE            ← same origin, cookie is sent
       │  reads the session, mints a SHORT-LIVED (2 min) signed handoff token
       │  302 → https://app-itqan.vercel.app/?t=<token>
       ▼
4. App boots, sees ?t=, calls GET /api/session?t=<token>
       │  verifies the HMAC, sets its OWN cookie on its OWN domain, returns the
       │  user. The client strips ?t= from the address bar.
       ▼
5. Signed in. Every later request carries the app's cookie.
```

**Why this shape.** The site's form script (`src/scripts/form.ts`) already did:

```js
const response = await fetch(form.action, { method: 'POST', body: new FormData(form) });
if (response.ok) window.location.assign(form.dataset.successUrl);
```

A 200 plus a cookie is the entire success contract, and it ignores the response body. So the token
could not be returned in the body — it had to travel in a URL. Pointing `appUrl` at a same-origin
endpoint that redirects onward is what makes it work **without touching the site's markup or script**.

### The only change made to the website for this

`itqan-website/src/config.ts`, one value:

```diff
- export const appUrl = 'https://app.itqan.example';
+ export const appUrl = '/api/handoff';
```

That file's own comment calls itself "the single place to point the forms at the real API later".

### Stateless everywhere

Because there is no database:

- the **user** rides inside the signed token;
- **"has finished onboarding"** is re-issued as a new cookie when `/api/profile` is called;
- **analysis progress** is derived from a timestamp encoded in the job id, so polling works across
  cold starts and different instances;
- **onboarding progress** is stored in a cookie on the app's domain.

Every one of these is a placeholder for a real table. Section 9.4 says what to replace them with.

### Environment variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `ITQAN_AUTH_SECRET` | **both** projects | dev fallback | HMAC signing key. **Must match.** |
| `ITQAN_APP_URL` | site | `https://app-itqan.vercel.app` | where handoff redirects |
| `VITE_SITE_URL` | app | `https://itqan-site.vercel.app` | where the app links "home" and "log in" |
| `VITE_API_BASE_URL` | app | `/api` | point at a separate gateway if ever needed |

**Set `ITQAN_AUTH_SECRET` to the same strong value on both Vercel projects.** The fallback exists so
the demo works out of the box, and is safe only because every account and record is fake.

### Password policy

Length ≥ 8 **plus** an uppercase letter, a lowercase letter, a digit and a symbol. Enforced in three
places that must stay in step: `src/scripts/form.ts` (browser), `api/placeholder/signup.js`
(deployed), and `dev/site-plugin.ts` (dev). Requirements are stated in the hint before anyone fails,
and the error names what is missing.

Deliberately **not** enforced on log in. Telling someone their own correct password is invalid helps
nobody and leaks the policy.

---

## 7. The onboarding flow

```
site login/signup → /upload → /questions → /confirm → /dashboard
```

**Upload.** One drop area, not one slot per document type — six labelled dropzones would be a wall of
empty boxes most users never fill. Files arrive however they arrive and each becomes a row stating
what Itqan thinks it is, correctable in one tap. The kind is guessed from the filename because people
name these files predictably. Kinds: transcript, CV, graduation certificate, certification,
recommendation letter, other. **Only the CV is required** (`REQUIRED_KIND`), and the requirement is explained
next to the button it blocks. "I do not have my documents right now" is a first-class path that
routes to the confirm screen with blank fields — the manual route reuses one screen instead of adding
one.

**Questions.** Five, one per screen, asked *while the pipeline runs* — or three, if the user says
they do not know what job they want, because the two after that question are about a role they have
not named. This is the best idea in the
original sketches: four agents take real time, and a user watching a progress bar is a user deciding
whether to close the tab. Choice questions advance on selection; the free-text one keeps a Continue
button because no machine can tell when someone has finished typing. All are skippable — the answers
only re-rank results and must never stand between someone and their own documents.

1. Are paid courses okay? → `coursePricing: 'free' | 'any'`
2. Where would you like to work? → `workArrangement: 'remote' | 'hybrid' | 'onsite'`
3. Do you know what job you want? → `knowsRole: 'yes' | 'no'`
4. What kind of job are you looking for? → `preferredRole: string` (free text)
5. Want to see similar jobs too? → `openToOtherRoles: 'yes' | 'no'`

Answering **"not yet"** to 3 ends the questions there and routes the user to Hud after the confirm
screen, rather than to a dashboard measuring progress towards a role they have not chosen. Confirm is
still passed through: it carries consent and starts the pipeline's second half.

**Confirm.** The most important screen. Four agents run in sequence and their errors compound, so a
human checkpoint before anything is used is the difference between a product that is 85% right and
shows its working, and one that is 95% right and cannot be checked. Name, birth date, graduation date
and extracted skills are all editable inline. Skills are split into two groups, "Skills found" and
"Skills to check", the second carrying the course each one came from; other fields below the trust
threshold are flagged "Suggested — confirm" with their provenance. It also carries the consent control, in the open, because
this is the first moment the user has seen what was actually extracted. Consent asked earlier is not
informed consent.

**Interrupted onboarding.** Progress saves after every meaningful change, debounced. Returning is
*offered*, never forced — silently restoring is disorienting and silently discarding is worse.

Landing on a later step with no in-memory state makes that offer **on the step being asked for**, not
back at step one. The earlier redirect was correct on paper and wrong in practice: a phone browser
discards a backgrounded tab, so leaving the app to find a certificate and coming back reloaded the
page and threw the user off the question they were answering. From their side the step simply did not
load, and whether it happened at all depended on the device — which is what "works here, breaks
there" usually turns out to be. The guard (`RequireFlow` in `App.tsx`) now waits for the saved
progress lookup to answer before deciding anything; deciding before it answered was the actual bug.

---

## 8. Design system and locked rules

Values come from `tokens.css` and **nothing invents one**. Four Itqan skills own the decisions:
`itqan-brand` (identity, voice, mascot), `itqan-design-system` (every value), `itqan-ux-craft`
(behaviour), `itqan-motion` (movement). Where a generic best practice and an Itqan locked rule
conflict, **the locked rule wins**.

Rules that shaped real decisions here:

- **Hud, the mascot, never appears beside a trust-critical moment.** No verdicts, scores, real
  matches, data tables, or the confirmation screen. He belongs to onboarding, the pipeline wait,
  empty states and errors. A cartoon bird next to evidence reframes it as a cute guess, which is
  exactly what the skeptical user rejects. This is why the dashboard, confirm, courses and jobs pages
  have no mascot, and why the sketch's "Hud suggests…" tip on the gap analysis was removed.
- **Lead with capability, not deficit.** The anchor user leaves for good if the first thing she sees
  is a list of failures. Gaps are always "to unlock" with a plus icon, never a deficit in a danger
  colour.
- **Every recommendation carries "why this match" plus a live source and retrieval date.** A
  recommendation the user cannot check is one the skeptic will not trust; a dead or invented link
  loses them permanently.
- **Below the trust threshold (0.85), output is labelled "Suggested — confirm"**, never stated as
  fact.
- **Gold is never body text on light.** Measured 2.65:1 on paper.
- **RTL is the base architecture.** Logical properties only — no `left`, `right`, `margin-left`.
  Arabic is the default. Mixed Arabic/Latin strings are isolated with `<bdi>`.
- **Bilingual parity is mechanical.** `ar.json` and `en.json` are kept at exactly equal keys and
  checked; both are authored, never machine-translated.

### Accessibility standard applied throughout

WCAG AA as the floor: 4.5:1 for normal text, 3:1 for large text and UI. Colour never carries meaning
alone — every state also has an icon, a label or a shape. All non-inline targets ≥ 44px. Everything
keyboard-operable with visible `:focus-visible` rings that are never removed. `prefers-reduced-motion`
honoured everywhere.

Verification on this project is done by **measuring the rendered DOM**, not by eye: contrast is
computed for every text node against its composited background, in both themes, at several widths.
Screenshots time out in this environment, so that is stated rather than implied whenever a visual
claim is made.

---

## 9. ★ Agent system and database integration guide

**This is the section to read before writing any backend.** The frontend is finished and correct; it
is waiting for real services behind a contract that already exists.

### 9.1 The one rule

> **`Onboarding/src/api/types.ts` is the contract. It is the only thing the screens depend on.**

No screen constructs a URL, parses a response, or knows a service exists. Implement these shapes and
the entire product works — swap, re-host or rewrite any agent and nothing in the UI changes.

`Onboarding/src/api/http.ts` is the only client. `dev/site-plugin.ts` and `Onboarding/api/*` are two
implementations of the same endpoints — one for local dev, one deployed. **Keep them in step**, or
dev will accept things production rejects (this already happened once, with the password rule).

### 9.2 Two trust rules are enforced by the types, not by screens remembering

1. **Every extracted field travels with its own `confidence`.** Four agents run in sequence and
   errors compound — four stages at 90% is roughly 73% end to end. A clean-looking answer downstream
   would hide that. `Extracted<T>` makes uncertainty impossible to drop.
2. **Every recommendation carries `why` and a real `source` with a retrieval date.** If the agent
   cannot explain a match, it must not return it.

If a service cannot fill these fields honestly, **fix the service, not the type.**

### 9.3 Endpoint reference

**[`BACKEND.md`](BACKEND.md) is the contract and the only copy of it.** Every call either front end
makes, what it sends, what it must return, which routes do not exist yet, and the reasoning behind the
awkward ones. It used to be restated here and the two drifted, which is the failure mode a second copy
always has.

Two rules from it are worth repeating because they are easy to get backwards:

- **`POST /api/auth/forgot-password` must answer `200` with an identical body and in the same time**
  whether or not the address has an account. Anything else turns the form into a way to discover who is
  registered. The page is already worded for it.
- **`POST /api/auth/reset-password` must be honest about a dead token** and answer `400` or `410`, so
  the page can say the link expired rather than pretending the reset worked.

Language: the app sends an `itqan_locale` cookie (`ar`/`en`). **Services return already-localised
strings** — job titles, "why this match", course names, journey labels, the readiness note. The UI never
translates service content; it only formats numbers and dates.

### 9.4 What is faked today and must become real

| Faked now | Where | Replace with |
|---|---|---|
| Two hardcoded accounts, plaintext passwords | `api/_lib/auth.js` → `ACCOUNTS` | `users` table, **hashed** passwords (argon2/bcrypt) |
| Sign-ups not persisted (user rides in the token) | `api/placeholder/signup.js` | insert a row, then issue the session |
| `onboarded` flag re-issued as a cookie | `api/profile.js` | `users.onboarded` column |
| Onboarding progress in a cookie (4KB limit, per-browser) | `api/onboarding/progress.js` | `onboarding_progress` table keyed by user |
| Uploaded file bytes discarded | `api/documents.js` | object storage; put the URL on `UploadedDocument.url` |
| Analysis progress derived from a timestamp | `api/analysis/[jobId].js` | real job row + queue |
| All results are static fixtures | `api/_lib/data.js` | the four agents |
| Saved job postings held in component state | `src/app/Jobs.tsx` | `saved_jobs` table + an endpoint |
| Confirmed profiles held in a `Map` in the dev plugin | `dev/site-plugin.ts` | the `profiles` table (9.5) |
| Password recovery has no endpoints at all | — | the two rows added to 9.3; until then the page stays unlinked |

### 9.5 A schema that fits the contract

Not prescriptive, but every column here exists because a type needs it.

```sql
users(id, full_name, email UNIQUE, password_hash, locale, onboarded BOOL,
      created_at)

documents(id, user_id → users, file_name, mime_type, size_bytes,
          kind ENUM('transcript','cv','certificate','certification',
                    'recommendation','other'),
          storage_url, uploaded_at)

analysis_jobs(id, user_id → users, document_ids[],
              stage ENUM('queued','reading','translating','matching','done','failed'),
              progress REAL, error TEXT, result JSONB, started_at, finished_at)

-- Extraction is kept SEPARATE from what the user confirmed. The confirmed row
-- drives everything downstream; the raw row is the audit trail that lets you
-- measure the pipeline against human corrections.
extracted_fields(id, job_id → analysis_jobs, field, value,
                 confidence REAL, evidence TEXT)

profiles(user_id → users PK, full_name, birth_date, graduation_date,
         skills TEXT[], preferences JSONB, confirmed_at)

onboarding_progress(user_id → users PK, step, documents JSONB,
                    preferences JSONB, updated_at)

job_postings(id, title, employer, location, arrangement,
             source_name, source_url, retrieved_at, raw JSONB)

job_matches(id, user_id → users, posting_id → job_postings,
            score REAL, why TEXT, matched_skills TEXT[], computed_at)

courses(id, title, provider, hours, price NUMERIC, currency,
        unlocks TEXT[], source_name, source_url, retrieved_at)

saved_jobs(user_id, posting_id, saved_at, PRIMARY KEY(user_id, posting_id))
```

Two notes worth keeping:

- **`extracted_fields` versus `profiles` is the whole trust architecture.** Never overwrite the raw
  extraction with the correction. The gap between them is the only measurement of how good the
  pipeline actually is, and the brief blocks publishing any accuracy figure until roughly 20–30 real
  documents have been validated.
- **`price` is a number with a `currency`, not a formatted string.** A service returning `"OMR 25"`
  makes both locale formatting and the "free only" filter impossible.

### 9.6 The four agents and what each must return

```
documents → [1 READ] → [2 TRANSLATE] → [3 MATCH] → [4 EXPLAIN] → dashboard
```

**1. Read** — OCR and parse. Fills `AnalysisResult`: name, birth date, graduation date, skills. Every
field needs a real `confidence` and, where possible, an `evidence` string naming where in the
document it came from ("Transcript header"). Dates OCR worst in practice; the UI already treats a
low-confidence date as normal rather than exceptional.

**2. Translate** — the agent's internal name, and one step, not the product. Turns "Database Systems II"
into "SQL". Each `Skill` keeps `fromCourse`, which is what lets the confirm screen show provenance and
the job cards build an evidence chain. The stage name survives in `AnalysisStage` and the DB enum; the
user-facing label for it is "Understanding your background".

**3. Match** — ranks real postings and courses against confirmed skills, filtered by `Preferences`.
`score` is 0..1; anything below `TRUST_THRESHOLD` (0.85) renders as "Suggested — confirm"
automatically. **Never fabricate a posting or a course.** Recommend only from a verified catalogue,
and always carry the live `source` with `retrievedAt`.

**4. Explain** — writes `why` for every match, in the user's language, as a documents → skill →
requirement chain. Also authors `readinessNote` and the `journey` labels. This agent is not
decoration: it is what makes the product checkable, and the brief treats that as the moat.

### 9.7 Wiring order that keeps the app working throughout

1. **Database + real auth.** Replace `ACCOUNTS` with a users table and hashed passwords. Keep the
   handoff exactly as it is — it works and is domain-agnostic. Set `ITQAN_AUTH_SECRET` on both
   projects first.
2. **Documents + storage.** Real upload, return a `storage_url`. The UI already shows real XHR upload
   progress.
3. **Agents 1 and 2** behind `POST /api/analysis` and `GET /api/analysis/:jobId`. The UI polls and
   shows a determinate meter; keep `progress` honest.
4. **Profile persistence.** `POST /api/profile` writes `profiles` and sets `users.onboarded`.
5. **Agents 3 and 4** behind `/api/dashboard`, `/api/jobs`, `/api/courses`.
6. **Saved jobs**, then delete `dev/data.ts` and `api/_lib/data.js`.

Each step is independently shippable. The app keeps working after each one.

### 9.8 If you change the frontend's assumptions

- Locale comes from a cookie, not a URL, inside the app. If you move to per-locale API routes,
  `src/api/http.ts` is the only file to change.
- The app is a **client-rendered SPA**; `vercel.json` rewrites everything except `/api` to
  `index.html`. Deep links depend on that rewrite.
- `import.meta.env.BASE_URL` drives the router basename: `/app` in dev, `/` in production.

---

## 10. Deployment

Two Vercel projects from one repo, each with its folder as the root directory. Both build with
`npm run build`. `api/` folders deploy as Node functions automatically — no config needed and **no
dependencies**, which is why they use `node:crypto` only. Files prefixed with `_` are ignored by the
router, which is how `api/_lib/` stays private.

After changing `itqan-website/src/config.ts`, **rebuild the site** — the value is baked into the HTML.

Deploy checks that have proven necessary:

```bash
curl -s https://itqan-site.vercel.app/ar/login/ | grep -o 'data-success-url="[^"]*"'
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://itqan-site.vercel.app/api/placeholder/login -F "email=maryam@itqan.test" -F "password=wrong"
```

The first must show the handoff endpoint; the second must be `401`.

One trap: the SPA rewrite returns `200` with `index.html` for **any** path that does not exist. So
polling an asset URL for a `200` is not a deploy check — it always succeeds. Poll the deployed
`index.html` for the new asset hash instead.

---

## 11. Open items

Everything below is genuinely unresolved. Contradictions found during the build that have since been
settled are not recorded here; the code and the skills are the record.

- **Forgot-password** is built and verified end to end against stubbed endpoints, and is **unlinked**
  until the backend can send an email. See section 5 for why, and 9.3 for the two endpoints it needs.
- **The Arabic on `/who-we-are/`** has not been read by a native speaker. Everything else on the site
  has. It is written to avoid gendered second-person address, which is the thing most likely to be
  wrong; have someone check it before the page is linked.
- **Saved job postings** do not persist (see 9.4).
- **Rubik loads from the Google Fonts CDN** on the app; the site self-hosts it. Self-host in both.
- **`react-router-dom@7.18.1`** carries a high advisory for **RSC mode**, which this SPA does not
  use, so it is not reachable. No patched version existed at the time. Recheck on upgrade.
- **The `/api/placeholder/…` path names are now misleading** — they are real endpoints. Renaming
  means touching the site's forms and `config.ts` together.
- **No accuracy figure may be published** until measured against real documents. The brief blocks
  this and the UI states no figure anywhere.
- **The Arabic site copy is a version behind.** The English pages were repositioned in August 2026 and
  the Arabic was deliberately left; it still sells the retired framing. Two strings on the legal pages
  were updated because they described a structure that no longer renders. Arabic is the default locale,
  so this is the next content job.
- **The mascot's eyes are holes in the alpha channel**, filled at render time by a double paper
  drop-shadow in CSS. The real fix is re-exporting the artwork with opaque eyes.
- **WebM alpha does not work in WebKit**, so every browser on iOS and Safari on macOS needs the HEVC
  companion file. Both are shipped; the contract is in `Hud.astro`.

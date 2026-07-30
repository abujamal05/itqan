# Backend integration — FastAPI + JWT + PostgreSQL

Written for the backend team. It documents what the frontend's backend-facing
layer looks like now, exactly what it will send you, and exactly what it expects
back. Read **§4 "What We Expect From Your FastAPI Backend"** first if you are
implementing endpoints; the rest is context.

Four decisions were taken with the product owner before this was written, and
everything here follows from them:

| Decision | Choice |
|---|---|
| Pipeline transport | **Synchronous** — one long request runs A → C → E |
| JWT transport | **httpOnly cookies** (not `localStorage`) |
| Localisation | **Backend returns both languages** as `{en, ar}` |
| Required document | **CV required**, transcript optional (per Agent A's contract) |

---

## 1. What the frontend is

Two deployments, one product:

| Folder | What it is | Owns |
|---|---|---|
| `itqan-website/` | Astro marketing site | **log in + sign up** |
| `Onboarding/` | React + Vite SPA | onboarding, dashboard, jobs, courses |

**The app has no login screen and must never get one.** The site owns
credentials. The app only *reads* the session and *ends* it. If you add a login
endpoint, the app will not call it.

### Files that touch the backend

Everything is funnelled through four files. There are **no bare `fetch` calls**
anywhere else in the codebase.

```
Onboarding/src/
├─ config/env.ts      environment config (base URL, timeouts)
├─ api/
│  ├─ client.ts       transport: cookies, refresh, CSRF, timeouts, errors
│  ├─ errors.ts       ApiError + the error taxonomy
│  ├─ agents.ts       ★ TypeScript mirror of your shared/contracts.py
│  ├─ types.ts        UI-facing contract (ItqanApi interface)
│  └─ http.ts         the API surface + agent-envelope → UI mapping
└─ state/
   ├─ auth.tsx        session boot, logout
   ├─ api.tsx         provides the client to the tree
   └─ onboarding.tsx  runs the pipeline, saves progress
```

`agents.ts` is the file to read alongside your `shared/contracts.py` — it is a
field-for-field mirror in TypeScript, in **snake_case**, so Pydantic's default
serialisation matches with no config.

---

## 2. Auth flow (httpOnly cookies)

### Why cookies and not `localStorage`

Tokens in `localStorage` are readable by any script on the page, so one XSS is
total account compromise. With httpOnly cookies the frontend *cannot* read the
token — there is no code in `client.ts` that touches it, by design. The browser
attaches it, you read it.

The cost is CSRF, handled by double-submit (below).

### The flow

```
1. User submits the SITE's login form
        POST /api/auth/login            (site origin, same-origin cookie)
        → you set: access_token, refresh_token, csrf_token
2. Site redirects to the app
3. App boots, calls GET /api/auth/session
        → cookies ride along automatically
        → you return { token, user, locale }
4. Access token expires mid-session → any call returns 401
        → client.ts calls POST /api/auth/refresh  (ONCE, shared)
        → on success it replays the original request
        → on failure it fires onAuthLost() and the app returns to the site
```

### Three things the client does that you must not break

**Single-flight refresh.** Six screens mounting at once produce six 401s.
`client.ts` collapses them into **one** `/auth/refresh` call and replays all six.
If you implement refresh-token rotation, this matters enormously: without it,
five concurrent refreshes race and four invalidate the session the fifth just
created. That is the classic "cookie auth randomly logs people out" bug. It is
handled on our side — just be aware that rotation + concurrency is why.

**One retry, never two.** A replayed request that 401s again is treated as a
dead session. No loops.

**`/auth/session` never triggers refresh.** A 401 there is a normal answer
("not signed in"), not an error. It is called with `retryOnAuthFailure: false`.

### Browser support note

`client.ts` composes its abort signals by hand rather than using
`AbortSignal.timeout()` / `AbortSignal.any()`. Those are Safari 16 / Safari 17.4
respectively, and on anything older every request in the app would throw
`TypeError` before being sent. If you add fetch code elsewhere, do not reach for
them — this product has real users on older iPhones.

### CSRF

You set a **non-httpOnly** `csrf_token` cookie. The client reads it and echoes it
as an `X-CSRF-Token` header on every `POST`/`PUT`/`PATCH`/`DELETE`. Verify they
match. An attacker's page can cause the cookie to be *sent* but cannot *read* it
to set the header — that is the whole mechanism.

### Cookie attributes we assume

```
access_token   HttpOnly; Secure; SameSite=Lax; Path=/;   Max-Age=900      (15 min)
refresh_token  HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=2592000 (30 d)
csrf_token     Secure; SameSite=Lax; Path=/               (readable by JS, on purpose)
```

`SameSite=Lax` works because the site and app are same-site. **If you host the
API on a different registrable domain you must switch to `SameSite=None;
Secure`** and set CORS `Access-Control-Allow-Credentials: true` with an explicit
origin (never `*`). Strongly prefer keeping the API same-origin behind a rewrite
— it removes this entire class of problem.

---

## 3. Environment config

`Onboarding/.env.example` is the reference. The only variable you usually need:

```bash
VITE_API_BASE_URL=          # unset = "/api" (same origin) — preferred
VITE_ANALYSIS_TIMEOUT_MS=120000
```

Vite inlines these at **build** time, so changing one in Vercel requires a
redeploy. Nothing secret goes in them — they ship in the bundle.

---

## 4. What We Expect From Your FastAPI Backend

Base path `/api`. All bodies JSON unless stated. All timestamps ISO-8601 UTC.

### 4.1 Endpoint summary

| Method | Path | Purpose | Agent |
|---|---|---|---|
| `POST` | `/auth/login` | Site login form posts here | — |
| `POST` | `/auth/signup` | Site signup form posts here | — |
| `POST` | `/auth/refresh` | Rotate access token from refresh cookie | — |
| `GET` | `/auth/session` | Who am I | — |
| `POST` | `/auth/logout` | Clear cookies | — |
| `GET/PUT/DELETE` | `/onboarding/progress` | Resumable onboarding state | — |
| `POST` | `/documents` | Upload one file (multipart) | — |
| `POST` | `/analysis` | **Run A → C → E synchronously** | A, C, E |
| `POST` | `/profile` | Persist the user's confirmed profile | — |
| `GET` | `/dashboard` | Assembled dashboard | C + E |
| `GET` | `/jobs` | Ranked job matches | B + C |
| `GET` | `/courses` | Course recommendations | D + E |

### 4.2 Error format

Every non-2xx returns this shape. FastAPI's default `{"detail": ...}` is also
accepted as a fallback, including its 422 validation array (we flatten it into
field errors automatically), but prefer this:

```json
{
  "code": "invalid_credentials",
  "message": "Email or password is incorrect.",
  "fields": { "email": "No account with this address." },
  "requestId": "req_01HX..."
}
```

`message` should be **already localised** using the request's locale.

**Status codes the client branches on:**

| Code | Client behaviour |
|---|---|
| 401 | Refresh once, replay; if still 401 → log out |
| 403 | Show forbidden, no retry |
| 404 | Empty state |
| 400 / 422 | Show `fields` inline on the form |
| 409 | Conflict — reload and retry |
| 429 | Back off (send `Retry-After`) |
| 5xx | "Something went wrong", retryable |

`network` and `timeout` are synthesised client-side (status `0`).

### 4.3 Auth contracts

**`POST /auth/login`** — accepts `multipart/form-data` (the site's existing form
posts this; do not require JSON).

```
email=maryam@itqan.test&password=...
```

Response `200` + the three `Set-Cookie` headers. Body may be `{"ok": true}` —
the site's form script only checks `response.ok`.

Errors: `401 invalid_credentials`. On signup: `409 email_taken`,
`400 weak_password`.

> **Password policy** is enforced in three places that must agree: the browser
> (`itqan-website/src/scripts/form.ts`), your endpoint, and the dev plugin.
> Current rule: ≥ 8 chars **and** an uppercase, a lowercase, a digit and a
> symbol. If you change it, change all three.

**`GET /auth/session`**

```json
{
  "token": "opaque-or-jwt-id",
  "user": {
    "id": "u_maryam",
    "fullName": "Maryam Al Balushi",
    "email": "maryam@itqan.test",
    "onboarded": false
  },
  "locale": "ar"
}
```

`onboarded` is **server-owned** — it decides whether the user lands on onboarding
or the dashboard, and it must live on the row, not in a cookie, so finishing on a
phone and returning on a laptop does not restart the flow.

`401` when there is no valid session. Not an error condition.

**JWT claims we assume**

```json
{
  "sub": "u_maryam",
  "email": "maryam@itqan.test",
  "locale": "ar",
  "onboarded": false,
  "iat": 1785000000,
  "exp": 1785000900,
  "jti": "..."
}
```

Access ~15 min, refresh ~30 days. `sub` must be the stable user id used as the
FK everywhere else.

### 4.4 The pipeline — `POST /analysis`

**This is the one that matters most.** One request runs Agent A → C → E and
returns all three envelopes.

Request:

```json
{ "document_ids": ["doc_a1b2", "doc_c3d4"], "locale": "ar" }
```

Response `200` — shape mirrored exactly in `Onboarding/src/api/agents.ts` as
`PipelineResult`:

```json
{
  "run_id": "run_01HX...",
  "candidate_profile": {
    "candidate_id": "u_maryam",
    "full_name": { "value": "Maryam Al Balushi", "confidence": 0.97,
                   "evidence_quote": "Maryam Al Balushi" },
    "birth_date": null,
    "graduation_date": { "value": "2025-06", "confidence": 0.88,
                         "evidence_quote": "Graduated June 2025" },
    "education": [],
    "skills": [
      { "name": "SQL", "origin": "coursework_derived", "quality": "medium",
        "evidence_quote": "Database Systems II — Grade A",
        "from_course": "Database Systems II", "esco_code": "S1.2.3" },
      { "name": "Python", "origin": "project", "quality": "high",
        "evidence_quote": "Built an inventory tracker in Python",
        "from_course": null, "esco_code": "S1.1.1" }
    ],
    "confidence": { "overall": 0.91 },
    "provenance": {
      "source_documents": ["doc_a1b2"],
      "unresolved_gaps": ["phone number not found"],
      "extracted_at": "2026-07-28T14:03:00Z"
    }
  },
  "skill_gap": { "...": "see 4.6" },
  "course_recommendations": { "...": "see 4.8" },
  "warnings": [
    { "agent": "A", "code": "transcript_unreadable",
      "message": { "en": "The transcript could not be read.", "ar": "تعذّرت قراءة كشف الدرجات." } }
  ]
}
```

**Timeouts — please read.** The client waits `VITE_ANALYSIS_TIMEOUT_MS`
(default **120s**). That is the *last* limit that applies. Every proxy in front
of you has its own and most default to 60s:

- Vercel serverless functions — hard limit, plan-dependent
- nginx `proxy_read_timeout` — 60s default
- AWS ALB idle timeout — 60s default
- Cloudflare — 100s on free tiers

If the pipeline can exceed your gateway limit, raising the client number will
**not** help — the gateway kills the connection first and the user sees a
timeout. Either raise the gateway limits to match, or tell us and we will switch
to job-id + polling (the client was built so this is a small change: fill in
`AnalysisJob.progress` and add `GET /analysis/{id}`).

**Failure:** return a normal error envelope with a `code` naming the agent that
failed, e.g. `agent_a_unreadable_document`. The UI has a first-class recovery
path — it offers re-upload or manual entry.

### 4.5 Documents — `POST /documents`

`multipart/form-data` with `file` and `kind`.

`kind` ∈ `transcript | cv | certificate | certification | recommendation | other`

**`cv` is the required kind** (Agent A's contract: CV required, transcript
optional). The UI blocks the continue button until a CV is present and says why.

```json
{ "id": "doc_a1b2", "fileName": "cv.pdf", "mimeType": "application/pdf",
  "sizeBytes": 184320, "kind": "cv", "url": "https://storage/..." }
```

Store the bytes and return `url`. Max 10 MB (the UI states this).

### 4.6 Agent C — the skill gap

Surfaced through `/dashboard` and inside `PipelineResult.skill_gap`.

```json
{
  "candidate_id": "u_maryam",
  "generated_at": "2026-07-28T14:05:00Z",
  "postings": [
    {
      "posting_id": "jp_991",
      "title": { "en": "Junior Data Analyst", "ar": "محلل بيانات مبتدئ" },
      "gap_score": 0.42,
      "gap_score_range": [0.35, 0.55],
      "requirements": [
        { "requirement": "SQL", "esco_code": "S1.2.3", "status": "matched",
          "tier": "esco_identity", "satisfied_by": ["SQL"], "similarity": null },
        { "requirement": "machine learning", "esco_code": "S2.4.1",
          "status": "matched", "tier": "llm",
          "satisfied_by": ["TensorFlow"], "similarity": 0.5982 }
      ]
    }
  ],
  "aggregate": {
    "missing_skill_details": [
      { "skill": "Power BI",
        "skill_label": { "en": "Power BI", "ar": "باور بي آي" },
        "esco_code": "S1.4.7", "priority_score": 3.21, "demand_trend": "rising" }
    ],
    "matched_skills": ["SQL", "Python"],
    "overall_gap_score": 0.42,
    "overall_gap_score_range": [0.35, 0.55]
  }
}
```

**Three honesty rules the frontend enforces — do not "helpfully" round them
away:**

1. **`gap_score` may be `null`.** When there is nothing to compute it from, send
   `null`, not `0.0`. The UI renders an empty ring and "not enough yet to judge
   your readiness". A `0.0` would read as *"you match nothing"* — the exact
   misreading your own architecture doc calls out.
2. **`possible_match` is a third state**, not a rounding error. The UI renders it
   distinctly and never collapses it into matched/missing.
3. **`gap_score_range`** is published uncertainty. Send it whenever
   `possible_match` requirements exist.

### 4.7 `GET /dashboard`

Assembled server-side from Agent C + Agent E. Strings already picked from
`{en, ar}` **or** sent bilingual — the client handles both (`pickText`).

```json
{
  "readiness": 42,
  "readinessRange": [35, 55],
  "readinessNote": "You match most of what junior analyst roles ask for.",
  "strengths": ["SQL", "Python"],
  "standings": [
    { "name": "SQL", "level": 0.9, "held": true, "status": "matched" },
    { "name": "Power BI", "level": 0.1, "held": false, "status": "missing" }
  ],
  "topMatches": [ /* JobMatch[] — see 4.9 */ ],
  "gaps": ["Power BI"],
  "nextStep": { "title": "...", "body": "...", "action": "courses" },
  "journey": [
    { "id": "documents", "label": "Documents read", "state": "done" },
    { "id": "matching", "label": "Matching", "state": "current" }
  ]
}
```

`readiness` is `gap_score × 100` **or `null`**. Same rule as 4.6.

`journey[].state` is decided by you, not the browser — a stage is "done" when
the work finished, not when a screen was visited.

### 4.8 Agent E — `GET /courses`

```json
[{
  "id": "c_88", "title": "Power BI Essentials", "provider": "Coursera",
  "hours": 12, "price": 0, "currency": "OMR",
  "unlocks": ["Power BI"],
  "coversOtherSkills": ["data visualisation"],
  "recommended": true,
  "source": { "name": "Coursera", "url": "https://...",
              "retrievedAt": "2026-07-27T02:00:00Z" }
}]
```

- `price` is a **number + currency**, never a formatted string — the UI formats
  per locale and filters on "free only". `"OMR 25"` breaks both.
- `price: null` is allowed (provider publishes none) and renders as "price not
  listed" — never coerce it to `0`, which would read as free.
- `covers_other_skills` → `coversOtherSkills`: a course is recommended **once**;
  the extra gaps it closes go here.
- `no_course_found` from Agent E should surface in `/dashboard.gaps` so the UI
  can say "no course found for this yet" rather than hiding the gap.

### 4.9 Agent B + C — `GET /jobs`

```json
[{
  "id": "jp_991", "title": "Junior Data Analyst", "employer": "Oman Data Park",
  "location": "Muscat", "arrangement": "Full time",
  "score": 0.78,
  "why": "Your Database Systems II coursework shows SQL, which this role lists first.",
  "matchedSkills": ["SQL", "Python"],
  "source": { "name": "el7far", "url": "https://...",
              "retrievedAt": "2026-07-28T02:00:00Z" }
}]
```

**`why` and `source` are mandatory.** A recommendation the user cannot check is
one the sceptical user will not trust, and a dead link loses them permanently.
If Agent E/C cannot produce a `why`, do not return the row.

Only postings that are `listing_intent='vacancy'` and `poster_type='company'`
should reach here — the same eligibility predicate `shared/job_market.py` uses.

### 4.10 Onboarding progress

`GET` → `OnboardingProgress | null`, `PUT` → `204`, `DELETE` → `204`.

```json
{ "step": "questions", "documents": [ /* UploadedDocument[] */ ],
  "preferences": { "coursePricing": "free", "workArrangement": "remote",
                   "preferredRole": "data analyst", "openToOtherRoles": "yes" },
  "documentId": "doc_a1b2", "updatedAt": 1785000000000 }
```

Currently a cookie (4 KB cap, per-browser). **Move it to a table keyed by user**
— the UI already saves through the API specifically so starting on a phone and
finishing on a laptop works.

### 4.11 Pagination & filtering

Not used yet — `/jobs` and `/courses` return complete ranked lists. When lists
grow, we assume:

```
GET /jobs?limit=20&cursor=<opaque>&arrangement=remote&free_only=true
→ { "items": [...], "nextCursor": "..." | null }
```

Cursor-based, not offset — the ranking is recomputed per run and offsets skip or
repeat rows. **Tell us before adding this**; it is a client change.

---

## 5. Agent → route map

| Agent | Trigger | Route | Returns |
|---|---|---|---|
| **A** — CV → profile | User uploads and continues | `POST /analysis` | `candidate_profile` inside `PipelineResult` |
| **B** — job ingestion | **Your 12h cron.** Never user-triggered | — (writes Postgres) | Read via `/jobs` |
| **C** — skill gap | Same request as A | `POST /analysis`, then `GET /dashboard` | `skill_gap` |
| **D** — course ingestion | **Your 3-day cron.** Never user-triggered | — (writes Postgres) | Read via `/courses` |
| **E** — course recs | Same request as A | `POST /analysis`, then `GET /courses` | `course_recommendations` |

**B and D are scheduled, not per-user.** The frontend never triggers them. `/jobs`
and `/courses` are live reads of their tables, scoped to the signed-in user's
gap. Do not run an agent inside those GETs.

---

## 6. Step-by-step: plugging in

1. **Stand FastAPI up at `/api`** on the same origin (rewrite/proxy). Confirm
   `GET /api/auth/session` returns `401` when signed out.
2. **Implement auth** (§4.3). Verify: log in on the site → land on the app
   dashboard with no login prompt.
3. **Verify refresh.** Set the access token to 60s, leave a tab open two
   minutes, click around. It must not log out. If it does, refresh rotation is
   racing — see §2.
4. **Documents + storage.** `POST /documents` returns a real `url`. The upload
   bar is already real XHR progress.
5. **`POST /analysis`.** Start by returning a canned `PipelineResult` fixture —
   the whole UI lights up before any agent is wired. Then swap in A → C → E.
6. **Persist the profile.** `POST /profile` writes the row and flips
   `users.onboarded = true`.
7. **`/dashboard`, `/jobs`, `/courses`** from real tables.
8. Delete `Onboarding/dev/site-plugin.ts` and `Onboarding/dev/data.ts`.

### Keep dev and prod in step

`Onboarding/dev/site-plugin.ts` is a dev-only stand-in implementing the same
endpoints, and it now mirrors this document exactly: `/auth/session`,
`/auth/refresh`, `/auth/logout`, the `csrf_token` cookie, and a **synchronous**
`POST /analysis` that returns a real `PipelineResult` after a deliberate delay.
`Onboarding/dev/data.ts` holds that fixture in agent shape (snake_case,
`{en, ar}`), so local dev exercises the same mapping code production will.

**It has already caused one bug** by accepting a password production rejected.
When you change a contract, change it in three places or the drift comes back:
this document, the dev plugin, and your FastAPI app. Or delete the plugin and
point `VITE_API_BASE_URL` at a real instance.

There is an E2E guard for the auth transport (`Onboarding/e2e/auth.spec.ts`)
covering cookie issuance, the no-refresh-on-`/auth/session` rule, and that a
dead session does not loop refreshes. Run it against your backend with
`QA_BASE`/`VITE_API_BASE_URL` pointed at it.

### Verifying without the UI

```bash
curl -i -X POST http://localhost:8000/api/auth/login \
  -F email=maryam@itqan.test -F password=itqan1234
```
```bash
curl -s http://localhost:8000/api/auth/session -b cookies.txt | jq
```

---

## 7. Open questions for the backend team

1. **Do B and D write into the same Postgres as the app's user tables**, or a
   separate analytics DB? Affects whether `/jobs` can join user state in one
   query.
2. **Is `candidate_id` the same as `users.id`?** The frontend assumes yes
   (`sub` claim).
3. **Who translates?** Agents emit English + ESCO. Sending `{en, ar}` is the
   agreed contract — confirm you have a translation step, or Arabic users see
   English job titles.
4. **Rate limiting** on `POST /analysis`? It is expensive and currently
   unthrottled from the client's side.
5. **Gateway timeout ceiling** — what is your actual max request duration? This
   decides whether synchronous survives contact with production (§4.4).

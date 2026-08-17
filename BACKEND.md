# What the backend has to provide

Every HTTP call either half of Itqan makes, what it sends, what it must get back,
and which ones do not exist yet.

Two front ends talk to one API:

- **the marketing site** (`itqan-website/`, static Astro) — only the sign up, log
  in and password recovery forms;
- **the app** (`Onboarding/`, React) — everything else, through one client in
  `Onboarding/src/api/http.ts` against one interface in `src/api/types.ts`.

`Onboarding/dev/site-plugin.ts` is a dev-only stub that answers most of this so
the flow can be walked locally. **It is not a specification** — it is a stand-in.
Where this document and the stub disagree, this document is right. The stub does
not ship, and it yields entirely when `apiTarget` is set.

Base path is `/api`, overridable in the app with `VITE_API_BASE_URL`.
Auth is a session **cookie** on the API origin. The app sends
`credentials: 'same-origin'` on every request and never handles a password.

---

## 1. Not built anywhere — this is the new work

### 1.1 Password recovery

**The front end is finished and integration-ready.** `ForgotPage.astro` is one
route serving four panels, chosen by the URL and by what the server answers, and
it is linked from the log in page. Nothing on it is stubbed and there is no
placeholder notice left to remove — the moment these two endpoints answer, the
flow works end to end with no front-end change.

| Panel | Reached when | What it needs from you |
|---|---|---|
| `request` | default | `POST /api/auth/forgot-password` returns 2xx |
| `sent` | the request succeeds | nothing — swapped in place, never navigates |
| `reset` | URL has `?token=…` | `POST /api/auth/reset-password` |
| `expired` | reset answers **400** or **410** | those exact statuses |

Two behaviours to build against, both already implemented on the client:

- The `sent` panel replaces the form **in place** rather than navigating, so the
  address just typed is still on screen if it was mistyped.
- The token is read from the URL and then **stripped via `history.replaceState`**,
  so it never reaches browser history, a shared link, or a `Referer` header on
  any later request from that page.

```
POST /api/auth/forgot-password
```
Body: form data, field `email`.

**Always answer 200, always with the same body, always in the same time.** The
response must not reveal whether an account exists. If a missing address answers
differently, or faster, the form becomes a way to enumerate who is registered.
The UI is already written to this rule: it shows "if that address has an account,
a link is on its way" for every non-network outcome.

The emailed link must point at:
`https://<site>/<ar|en>/forgot-password/?token=<token>`

The app strips the token from the address bar as soon as it reads it, so it never
reaches the browser history or a `Referer` header. Give the token a short life and
make it single use.

```
POST /api/auth/reset-password
```
Body: form data, fields `token`, `password`.

| Status | The UI does this |
|---|---|
| 200 | navigates to the log in page |
| **400 or 410** | swaps to the "this link has expired" panel — use these for a bad or spent token, not 401 |
| any other non-2xx | shows the generic "could not do that just now" message |

Password rule must match sign up: 8+ characters with a lower case, an upper case,
a digit and a symbol. The client enforces the same rule before it posts, so a
400 here means the two rules have drifted apart, not that a user slipped through.

**Email template requirements.** The link must be
`https://<site>/<ar|en>/forgot-password/?token=<token>` — the locale segment is
not optional, because it decides which language the reset screen renders in, and
a recovery mail that arrives in the wrong language is the one message a user
cannot afford to misread. Send it in the language of the `itqan_locale` cookie on
the request. Token short-lived and single use; spending it must start returning
410 so the `expired` panel is reachable.

**Rate limiting** belongs on the server, per address and per IP. The form has no
throttle of its own by design — a client-side limit on an anti-enumeration
endpoint is trivially bypassed and would only lull you.

### 1.2 Profile photo

```
POST /api/profile/avatar
```
`multipart/form-data`, one field `file`.
Response: `{ "avatarUrl": "<url>" }` — absolute, or same-origin.

```
DELETE /api/profile/avatar
```
`204` on success.

Notes that are contract, not preference:

- **Return the URL, never accept one.** The server owns storage; the client must
  never construct a path.
- **Keep it off `PUT /api/profile`.** A rejected image must not discard the
  graduation date typed beside it, and a profile save must never be able to blank
  someone's picture as a side effect.
- Enforce type and size server side. The UI rejects non-images and anything over
  5MB before uploading, but that is a courtesy, not a control.
- The client uses `XMLHttpRequest` here so it can show upload progress. Nothing is
  required of you for that beyond accepting a normal multipart POST.

### 1.3 Two fields to add to `GET /api/profile`

```jsonc
{
  "avatarUrl": "https://…" | null,      // written only by the endpoints above
  "suggestedRole": {                     // agent derived, READ ONLY
    "title": "Data Analyst",
    "confidence": 0.82,                  // 0..1
    "why": "…the transcript -> skill -> role chain, already localised…"
  } | null
}
```

`suggestedRole` is **not** the same thing as `preferences.preferredRole`. That one
is the role the user typed; this one is what the agents infer. They are shown side
by side and must never be merged.

It carries `confidence` and `why` for the same reason every other recommendation
does — a bare job title with no reasoning behind it is exactly the unfounded claim
the trust rules exist to prevent. `why` must arrive already localised, like every
other agent-authored string.

Both are optional on the wire: the screen degrades to initials and to "nothing
suggested yet" when they are absent.

### 1.4 Hud, the chat

**The front end is finished.** `Onboarding/src/app/Chat.tsx` and its parts work
today against `dev/site-plugin.ts`, and the Vercel handler in `api/chat/` answers
a stateless version of the same shapes. The authority is
`Onboarding/src/api/types.ts`.

It is an ordinary conversation: alternating turns, in order. One thing about it
is not ordinary, and it is the thing to implement carefully.

**Hud may talk, but nothing actionable goes in his prose.**

```
POST /api/chat/ask     { "threadId": "…" | null, "question": "…" }
                       -> { "threadId": "…", "message": ChatMessage }

                       multipart/form-data when files are attached:
                       fields `question`, `threadId`, and `files` (repeated)

POST /api/chat/rate    { "threadId": "…", "messageId": "…", "verdict": "up" | "down" }
                       -> any 2xx. The client never waits on this or shows a failure.

GET  /api/chat/threads             -> ChatThreadSummary[]   (newest first)
GET  /api/chat/threads/:id         -> ChatThread | 404
```

```jsonc
ChatMessage {
  "id": "…",
  "role": "hud" | "user",
  "text": "…",                 // already localised when role is "hud"
  "jobs": [JobMatch],          // real postings, ATTACHED not described
  "courses": [Course],         // real courses, same
  "suggestions": ["…"],        // follow-up questions, offered as chips
  "attachments": [             // on the USER's turn: metadata only, echoed back
    { "id": "…", "fileName": "…", "mimeType": "…", "sizeBytes": 12345 }
  ],
  "createdAt": 1717171717171
}

ChatThread { "id": "…", "title": "…", "messages": [ChatMessage], "updatedAt": … }
```

Five rules that are contract, not preference:

1. **Attach, never describe.** A posting belongs in `jobs` as a whole `JobMatch`;
   a course belongs in `courses` as a whole `Course`. The screen renders those
   through the same `MatchCard` and `CourseCard` that `/api/jobs` and
   `/api/courses` feed, so `why`, the live `source` with its `retrievedAt` and
   the confidence badge all come along automatically and cannot drift away from
   the rest of the product. Writing "Bank Muscat is hiring a data analyst, 94%
   match" into `text` instead moves a claim somewhere nobody can audit, and is a
   violation rather than a shortcut.

2. **This is what lets the mascot be there at all.** The brand fences Hud away
   from verdicts, scores and real matches; the exception granted for this screen
   (workspace `PRODUCT.md`, 2026-08-17) rests entirely on the separation above. A
   service that puts a score in `text` has removed the reason the exception was
   granted.

3. **`suggestions` are questions, not commands.** Three at most, phrased as
   something a person would say. They exist because the anchor user's opening
   line is "I do not know what job I want" — someone who cannot yet phrase a
   question needs real ones offered. The client shows them only on the newest
   turn.

4. **Store both turns.** `POST /api/chat/ask` returns only Hud's message, but the
   thread read back by `GET /api/chat/threads/:id` must contain the user's turns
   too, or a conversation resumed on another device is a list of answers to
   questions nobody can see. The client renders its own copy of the question
   immediately and does not wait for the response to do it.

5. **Strings arrive localised**, per the `itqan_locale` cookie, like every other
   agent-authored string — `text` and every entry in `suggestions`. Note the
   client keeps each turn in the language it was spoken and does NOT re-fetch a
   thread when the user switches language: a conversation is history, and quietly
   re-asking the questions on a language toggle would be worse than mixed
   languages in a scrollback.

**Streaming is not required and the seam does not change for it.** The client
calls `ask` and waits, showing Hud thinking. When you can stream, stream inside
`ask`: emit `text` in chunks and resolve to the same message with its cards
attached. Do not add a second endpoint. The cards are the part worth waiting
for, and a card without its source is a recommendation with its evidence
missing.

**A thread with no messages is a normal answer.** So is an empty
`GET /api/chat/threads` on a new account. Neither is an error, and the UI tells
them apart from a failure.

**Attachments are not a second door into the pipeline.** A chat upload arrives as
`files` on `ask` and comes back as `attachments` (metadata only) on the user's
turn. It must NOT be treated as the CV or transcript the analysis runs on. That
route is `POST /api/documents`, and it exists precisely because it has a human
confirmation screen in the middle of it — the product's first trust moment. A
file dropped into a conversation that silently became the document the matching
used would route around the one screen built to be checked. Acknowledge it, say
what has and has not been done with it, and point at Documents. The dev stub and
the Vercel handler both answer exactly that way; copy their wording rather than
inventing a more impressive one. Enforce type and size server side; the composer
rejects over 5MB first, but that is a courtesy, not a control.

**Ratings are fire and forget.** A thumb is a signal for whoever tunes the
service, never something a user should wait on or watch fail. Return any 2xx.
Storing it against the message and the account is enough; nothing in the UI reads
it back, and the pressed state is client-side for the session only.

**Rate limiting belongs on the server**, per account. The composer has no
throttle of its own.

**A deployment constraint, learned the hard way.** All of these routes are served
by ONE file on Vercel, `api/chat/[...path].js`, not one per route. Vercel counts
every file under `api/` as its own Serverless Function and the Hobby plan allows
12 per deployment; this project sits at 11 with the catch-all and was at 13 with
a file per route, which failed the `app-itqan` build while `itqan-site` passed.
That failure carries no compile error, so it clears `tsc`, `vite build` and the
Playwright suite and only shows up as a red check on the PR. **Adding endpoints
here means adding a branch to that switch, not a new file** — and any new
top-level `api/` route should be counted against the 12 first.

---

## 2. Already contracted — must exist in production

The dev stub answers all of these, so the shapes below are exercised daily. The
authority is `Onboarding/src/api/types.ts`.

### 2.1 Auth and the handoff

```
POST /api/placeholder/signup     form data: name, email, password, consent
POST /api/placeholder/login      form data: email, password
```

> **Rename these.** The path literally contains the word `placeholder`. The value
> lives in one place, `itqan-website/src/config.ts`, so it is a one-line change on
> the front end — but it has to happen before launch.

Contract is minimal by design: **any 2xx plus a session cookie**. The site's form
script navigates to `data-success-url` on success and shows its own message on
failure, so no response body is required. Use `409` for an email already taken on
sign up, `401` for bad credentials on log in.

```
GET /api/handoff
```
Redirects to the app, carrying a short-lived signed token as `?t=…` when the site
and the app are on different domains (the Vercel setup). On a single host the
cookie already reaches the app and this can redirect straight to it. It must
exist in every environment — it is the URL baked into the built HTML.

```
GET /api/session[?t=<handoff token>]
POST /api/logout
```

`GET /api/session` → `{ token, user: { id, fullName, email, onboarded }, locale }`,
or a non-2xx when there is no session (the client treats any failure as "signed
out"). When `?t=` is present, exchange the handoff token and establish the session
in the same request.

**`user.onboarded` is server owned and load bearing.** It is what stops a finished
user being dropped back into onboarding on a second device, and it now also drives
the browser tab's title. It must live with the account, not the browser.

### 2.2 Onboarding progress

```
GET    /api/onboarding/progress   -> OnboardingProgress | null
PUT    /api/onboarding/progress   <- OnboardingProgress
DELETE /api/onboarding/progress
```

```jsonc
{ "step": "upload" | "questions" | "confirm",
  "documents": [UploadedDocument], "preferences": Preferences,
  "documentId": "…" | null, "updatedAt": 1717171717171 }
```

Stored against the account so onboarding survives a device change. `GET` returning
null is normal, not an error.

### 2.3 Documents and the pipeline

```
POST /api/documents        multipart: file, kind ("cv" | "transcript")
                           -> UploadedDocument
POST /api/analysis         { "documentIds": ["…"] } -> { "jobId": "…" }
GET  /api/analysis/:jobId  -> AnalysisJob
```

`UploadedDocument` → `{ id, fileName, mimeType, sizeBytes, kind, url? }`

**The run pauses, and the UI depends on the pause.**

```
queued → reading → translating → awaiting_confirmation → matching → done
                                        ↑
                          stops here until POST /api/profile
```

- `progress` is `0..1` and must **only advance when a phase actually completes**.
  Do not interpolate it on a timer: a bar that creeps to 90% and stops makes a
  stalled run indistinguishable from a slow one, and the UI deliberately shows
  your number raw.
- At `awaiting_confirmation`, attach `result` (the extraction). That is what lets
  the confirm screen show real details instead of a skeleton.
- `stage: "failed"` with `error` is a real, reachable state — the UI has a
  recovery path for it. `cv` is the only document the pipeline cannot run without.
- Phase two runs **after** the user has left for the dashboard, which is why the
  progress bar follows them across pages.

`AnalysisResult` → `{ fullName, birthDate, graduationDate, skills[] }`, where each
extracted value is `{ value, confidence, evidence? }` and each skill is
`{ id, name, confidence, fromCourse? }`. **Every extracted field must carry its own
`confidence`** — four sequential agents compound error, and a clean-looking answer
downstream would hide it.

### 2.4 Profile

```
POST /api/profile   <- ConfirmedProfile  -> { ok: true, jobId? }
GET  /api/profile   -> StoredProfile | 404
PUT  /api/profile   <- ConfirmedProfile  -> { ok: true }
```

`POST` is the end of onboarding and does three things: stores the profile, sets
`user.onboarded = true`, and **starts phase two** — returning the `jobId` to keep
polling. The answers in that payload shape the matching, so the matching cannot
have run before it arrives.

`PUT` is an edit from the profile screen and must **not** re-run the pipeline.
Correcting a birth date is not a reason to re-match.

`ConfirmedProfile`:
```jsonc
{ "fullName": "…", "birthDate": "yyyy-mm-dd" | null,
  "graduationDate": "yyyy-mm" | null,
  "phone": "…" | null,                 // NEW — see below
  "skills": ["…"], "preferences": Preferences, "documentId": "…" | null }
```

`phone` is genuinely optional. Nothing in the pipeline reads it, onboarding never
asks for it, and the profile screen does not count it as missing. Store it and
give it back; do not validate it beyond being a string, and do not require it.

`StoredProfile` is `ConfirmedProfile` plus `email`, `documents[]`, `avatarUrl`,
`suggestedRole` and `updatedAt`. **`email` comes from the account, never from the
extraction** — it is the one field on that screen the pipeline must not be able to
rewrite. A `404` means "nothing confirmed yet" and is rendered as an empty state,
not an error.

### 2.5 Results

```
GET /api/dashboard   -> DashboardData
GET /api/jobs        -> JobMatch[]
GET /api/courses     -> Course[]
```

Three rules the types enforce and the UI will expose if they are broken:

1. **Everything recommended carries `why`** — the transcript → skill → requirement
   chain — **and a real `source`** (`{ name, url, retrievedAt }`). Nothing
   fabricated is displayable.
2. **Strings arrive localised.** The services decide the wording, including the
   journey stage labels and job `arrangement`. The cookie `itqan_locale` says
   which language; it is set on log in and kept in step by both front ends.
3. **`price` is a number plus a `currency`**, never a formatted string — the UI
   formats and filters on it, and `"OMR 25"` makes both impossible.

Before the first run finishes, these endpoints will legitimately have nothing to
return. Answer "nothing yet" distinguishably from a failure: the app tells the two
apart to decide between "your results are on the way" and an error state.

---

## 3. Cross-cutting

**Locale.** Cookie `itqan_locale`, values `ar` | `en`. Both front ends write it,
the site now on every page view. Services answer in whatever it says.

**Errors.** The client throws on any non-2xx and screens render their own recovery
copy, so no error body shape is required. What matters is using the right status:
`401` unauthenticated, `404` "does not exist yet" where that is a normal state,
`400`/`410` for a spent recovery token.

**Timeouts.** There is no client-side timeout on polling. If a run can hang, it
must eventually report `stage: "failed"` itself, or it will poll forever.

**CORS.** Only when the site and the app are on different origins. The single-host
deployment avoids it entirely, and the front end is configured for both
(`VITE_SITE_SAME_ORIGIN`).

---

## Checklist

| Endpoint | Status |
|---|---|
| `POST /api/auth/forgot-password` | **missing** — front end complete and waiting |
| `POST /api/auth/reset-password` | **missing** — front end complete and waiting |
| `POST /api/profile/avatar` | **missing** |
| `DELETE /api/profile/avatar` | **missing** |
| `avatarUrl` on `GET /api/profile` | **missing field** |
| `suggestedRole` on `GET /api/profile` | **missing field** |
| `phone` through `POST`/`PUT`/`GET /api/profile` | **new field, must persist** |
| `POST /api/chat/ask` | **missing** — front end complete, stubbed in dev. Accepts multipart when files are attached |
| `POST /api/chat/rate` | **missing** — fire and forget, any 2xx |
| `GET /api/chat/threads` | **missing** — needs storage; Vercel twin answers `[]` |
| `GET /api/chat/threads/:id` | **missing** — needs storage |
| all chat routes | one Vercel function, `api/chat/[...path].js` — see the note in §1.4 |
| `POST /api/placeholder/{signup,login}` | exists — **rename before launch** |
| everything else in §2 | contracted, stubbed in dev, needs a real implementation |

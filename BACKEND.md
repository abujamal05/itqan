# What the backend has to provide

Every HTTP call either half of Itqan makes, what it sends, what it must get back,
and which ones do not exist yet.

Product truth lives in [`PRODUCT.md`](PRODUCT.md); this file is the contract only.
Note that `"transcript"` as a document `kind` and `translating` as a pipeline
stage are API identifiers, not positioning. Itqan reads whatever the user has, and
the CV is the required document.

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
    "why": "…the documents -> skill -> role chain, already localised…"
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

### 1.5 Recommendation feedback, and the preferences it feeds

Every job card and every course card carries a like and a dislike. A dislike asks
why, from a closed list plus `other` with free text. On a course, the user may
also ask for a **replacement** rather than only registering the rejection.

**The point of all of it is the next run.** These are stored on the ACCOUNT and
fed to the ranker; a verdict that lives in the tab teaches nothing and reappears
as the same card after a reload, which reads as the product ignoring the person.
This is the one part of the feature a dev stub cannot stand in for, and the
Vercel twin must not pretend otherwise by answering `{ok:true}` and dropping it.

```jsonc
// POST /api/preferences/feedback     -> 200 {"ok":true}
{
  "subject": "job" | "course",
  "itemId": "j2",
  "verdict": "like" | "dislike",
  "reason": "wrongLocation" | null,   // dislike only, from the lists below
  "note": "too far to commute" | null, // only when reason === "other"
  "replaced": true                     // course only, the user asked for another
}
```

Reason ids are fixed and are the same strings the client sends; they are
translated in the front end, never on the wire. Jobs:
`notInterested` `wrongLocation` `wrongLevel` `wrongField` `employer` `other`.
Courses: `notInterested` `alreadyKnow` `tooAdvanced` `tooBasic` `tooLong`
`price` `other`.

```jsonc
// GET /api/preferences/feedback
{ "jobs": { "j2": "dislike" }, "courses": { "c1": "like" } }
```

The LATEST verdict per item, so a card can render the state the user left it in.
Absent means no opinion, which is not the same as neutral. Empty on a new account
and that is a 200, not a 404.

```jsonc
// POST /api/courses/similar   -> a Course, or null
{ "courseId": "c1", "exclude": ["c1", "c2", "c3"] }
```

Returns one course that closes the **same gap** as the rejected one — matched on
`unlocks`, not on provider or title similarity. `exclude` carries every course
already on screen, and honouring it is not optional: without it the natural
implementation returns the card sitting directly below, and the user watches a
course they can already see slide into the slot they just cleared. It must also
skip anything this account has previously disliked.

`null` is a legitimate answer and means nothing else closes that gap. The screen
says so; it must never receive an unrelated course dressed up as a match, and it
must never receive the rejected one back.

**Career goal changes** ride the existing `PUT /api/profile`
(`preferences.preferredRole`) rather than a new endpoint — it is the same field
onboarding collects, and a second write path for one string is how the two drift.
The ranker must treat a change to it as a signal, not just as a stored value.

**One new field on `preferences`**, written by onboarding and by that same PUT:

```jsonc
"knowsRole": "yes" | "no" | null
```

Asked before "what job are you looking for" and load bearing in the flow: `no`
ends the questions early and routes the user to Hud instead of the dashboard. It
is stored rather than inferred from an empty `preferredRole`, because "skipped
the question" and "stopped to say I do not know yet" are different people and
only the second should be offered role suggestions unprompted. Null on every
account that onboarded before this existed, and that must read as "not asked",
never as `no`.

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

1. **Everything recommended carries `why`** — the documents → skill → requirement
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
| `POST /api/preferences/feedback` | **missing** — front end complete, stubbed in dev. Must persist and reach the ranker |
| `GET /api/preferences/feedback` | **missing** — needs storage; empty object is a 200 |
| `POST /api/courses/similar` | **missing** — must honour `exclude` and match on `unlocks`; `null` is valid |
| `POST /api/chat/ask` | **missing** — front end complete, stubbed in dev. Accepts multipart when files are attached |
| `POST /api/chat/rate` | **missing** — fire and forget, any 2xx |
| `GET /api/chat/threads` | **missing** — needs storage; Vercel twin answers `[]` |
| `GET /api/chat/threads/:id` | **missing** — needs storage |
| all chat routes | one Vercel function, `api/chat/[...path].js` — see the note in §1.4 |
| `POST /api/placeholder/{signup,login}` | exists — **rename before launch** |
| everything else in §2 | contracted, stubbed in dev, needs a real implementation |

---

## Pending: dashboard, courses, documents and settings (added 2026-08-21)

Front-end work in progress needs these. **None is built.** Each entry says what
the UI expects and why, so the shape is decided here rather than in a hurry
later.

### 1. Course completion  — `POST /api/courses/:id/complete`

```
POST   /api/courses/:id/complete   -> { ok: true, completedAt: "…" }
DELETE /api/courses/:id/complete   -> { ok: true }        // undo
```

The course path marks a course done and greys it out **without removing it** —
seeing what you have finished is the progress signal, so a completed course must
keep coming back in `GET /api/courses` with a `completedAt: string | null`.

**It must not touch readiness.** Marking a course done is a claim by the user,
not evidence, and readiness is evidence-derived. The UI says so explicitly and
then offers the CV re-upload as the way to make it count. A service that quietly
raised the score here would make the number mean two different things.

### 1b. Course ordering — `Course.priority`  **(required, blocking)**

The course path is a route, not a list: the first item is meant to be the single
thing that moves the user furthest toward being able to apply. Today that cannot
be expressed. `Course` carries no ordering field and `gaps` is a bare
`string[]`, so nothing says which gap matters most or which course closes it.

**Until this exists the UI renders whatever order the API returns**, unsorted and
unranked. That is deliberate: sorting by hours or by price would invent a
priority the data does not carry, and a path whose first step is merely the
shortest course is worse than an unordered one, because it looks authoritative.

Two fields close it:

```jsonc
// Course
"priority": 1,              // 1 = do this first. Dense, stable, 1-based.
"closesGap": "power-bi"     // which gap this course actually closes
```

- `priority` must be a total order over the returned set, not a bucket. Ties
  force the UI to break them arbitrarily, which is the thing this field exists
  to prevent.
- `closesGap` lets the path label each step with the gap it removes, which is
  what makes the sequence legible as a route rather than a queue.
- Ordering is **per target role**. A course that is first for Data Analyst is not
  first for IT Support, so this cannot be a static property of the course.

Related: `gaps: string[]` should become objects carrying the same id, so a gap on
the dashboard and a course on the path can be matched without string comparison
on a display name that is localised.

### 1c. Course prerequisites — `Course.requires`  (needed for the `locked` state)

The course map renders five states: `completed`, `current`, `recommended`,
`available` and `locked`. **Four are derived from real data. `locked` is never
populated**, because nothing in the API can justify it — `Course` carries no
prerequisites, so no course can honestly be said to require another.

That is a deliberate hole, not an oversight. Marking a course locked on a guess
would make the map assert a product rule that does not exist, and "locked" here
is a UI state, never a gate: nothing in Itqan stops a person opening a course
they want. A locked node means *the skills this builds on are not evidenced
yet*, which is information.

```jsonc
// Course
"requires": ["sql-basics"]   // skill ids, not course ids
```

Skill ids rather than course ids on purpose: the requirement is that the user
can DO something, and that can be satisfied by evidence in their documents, by
another course, or by work history. Keying on courses would lock someone out of
a course whose prerequisite they already meet.

Until this ships, `states()` in `components/map/CoursesMap.tsx` returns the
other four and the locked styling sits unused in `CourseNode`.

### 1d. Marking a course done is stored in the BROWSER right now

`POST /api/courses/:id/complete` (§1) does not exist, so `state/completed.ts`
keeps completions in `localStorage`, keyed by user id. **This is not the truth
and the UI does not pretend it is** — completing a course does not move
readiness, and the confirmation says so and links to the CV re-upload instead.

When the route lands, `Course.completedAt` from the API becomes authoritative
and that module becomes a cache of pending writes. Nothing else changes: it is
already the only thing on the courses page that knows what "completed" means.

### 2. Re-reading a document without redoing the profile

The pipeline today is `queued → reading → translating → awaiting_confirmation →
matching → done`, and `PUT /api/profile` "must not re-run the pipeline". There is
no path between those two, which is exactly what "update the profile, do not redo
it from scratch" needs.

**Suggested:** a mode flag on the existing analysis route rather than a new
pipeline.

```
POST /api/analysis  { "documentIds": ["…"], "mode": "merge" } -> { jobId }
```

- `mode: "replace"` (default) is today's behaviour.
- `mode: "merge"` re-reads and returns **only what changed**: new skills, and
  skills whose confidence moved. Existing confirmed values are not discarded, and
  the confirmation screen shows only the delta so the user is not asked to
  re-approve a profile they already approved.

That keeps the human confirmation checkpoint, which is the thing that must not be
routed around.

### 3. Deleting a document — `DELETE /api/documents/:id`

```
DELETE /api/documents/:id  -> { ok: true } | 409 { error: "last_cv" }
```

**The front end is built.** `api.deleteDocument` and the two-tap remove control
on the profile screen came from `amin-dev`; the last-CV rule was added when that
work met the documents list from `design/website-overhaul`. Neither half had it
alone, which is worth noting: the branch with the control had no rule, and the
branch with the rule had no control.

The UI hides the remove control on the only CV — a "Required" tag sits where it
would have been, because a disabled button invites a click and then refuses it.
**The server must enforce it too**: the client rule is a courtesy, `cv` is the
one document the pipeline cannot run without, and a stale build of the app must
not be a way in. Return `409` with a machine-readable reason rather than a
message, so the front end keeps owning the wording in both languages.

`dev/site-plugin.ts` implements this route and the `409 last_cv` refusal, so the
rule is developed against rather than assumed. **Production still needs both.**

`UploadedDocument` also needs an `uploadedAt` so "the first CV" is orderable, and
ideally `isPrimary: boolean` so primacy is a server fact rather than something
the client infers from sort order.

### 4. AI usage — `GET /api/usage`  and  `User.plan`

**The limits are decided** (product owner, 2026-08-21). There are two, they are
measured in different units, and they reset on different clocks:

| | Free | Paid |
|---|---|---|
| Document rescans | 1 a week | 3 a week |
| Messages with Hud | 30 a day | 90 a day |

The paid tier's rescan figure is taken as **per week**, mirroring the free
tier's period — it was given as "3 document rescans" without one. Worth
confirming before this is built.

**The front end is built** (`components/UsageMeters.tsx`, on the profile screen)
and `dev/site-plugin.ts` implements this contract, counting real sends so the
meters move when Hud is actually used. In production the call 404s until this
ships, and the section renders NOTHING rather than zeros — a meter reading
"0 of 30" when the truth is unknown is a fabricated statistic.

The tier comparison above is not on that screen: it is general information and
belongs on a plan page of its own. Settings shows only what is specific to this
person.

```jsonc
GET /api/usage -> {
  "plan": "free",
  "rescans":  { "used": 1,  "limit": 1,  "period": "week", "resetsAt": "2026-08-24T00:00:00Z" },
  "messages": { "used": 12, "limit": 30, "period": "day",  "resetsAt": "2026-08-22T00:00:00Z" }
}
```

- **Two counters, not one.** A single `used`/`limit` pair cannot express a weekly
  allowance and a daily one at the same time, which is what the product sells.
- `resetsAt` rather than a duration, so the UI can say when it comes back in
  both languages without doing calendar arithmetic against an unknown timezone.
- `limit: null` means unlimited, and the UI renders no meter for that row.
- **`User.plan: "free" | "paid"` is needed regardless of the usage route.**
  Without it the settings screen cannot say which column is the user's, which is
  exactly why it currently presents free-versus-paid rather than "your plan".
- The server owns enforcement. When a limit is reached, the rescan and chat
  routes should refuse with `429` and a machine-readable reason
  (`{ error: "rescan_limit" | "message_limit", resetsAt }`) so the front end
  keeps owning the wording in both languages — the same rule as `409 last_cv`.

### 5. The job cut — `GET /api/jobs` returns an object, and the server decides  **(NOT BUILT — the UI waits for you)**

> **Status: the front end is ready and dormant.** The client accepts the old
> bare array AND the new object, so nothing is gated today and no job is
> hidden from anyone. The moment this endpoint starts returning a `locked`
> count above zero, the locked cards and the upgrade prompt appear on their
> own. Nothing in the front end needs to change or be remembered.
>
> This is deliberate. Typing the client to the new shape alone emptied the job
> list in every environment that had not shipped the cut — the page said "no
> job postings" to people who had four. A contract change has to be additive
> until both ends agree.

**This is the one entry on the page where a client-side implementation is not a
weaker version of the feature, it is no feature at all.**

The brief asked for locked job matches that an extension could not reveal. A CSS
blur over real data is decoration: devtools, uBlock, a user stylesheet or reader
mode each strip it in one action. The only gate that holds is one where the
hidden matches never reach the browser, so the shape has to change.

```jsonc
GET /api/jobs -> {
  "matches": [ /* free: at most 3, STRONGEST FIRST. paid: all */ ],
  "locked": 12,          // how many more exist. 0 on paid
  "plan": "free"
}
```

- **Sort before you slice.** Free is "your three strongest matches, kept
  current", not "the first three in the array". A cut taken over an unsorted
  list silently sells the wrong thing.
- `locked` is a **count and nothing else**. How many, never what. No titles, no
  employers, no ids, not even a length-3 array of nulls with real keys.
- The front end is built against this and treats the array as the whole truth.

**Two leaks to close with it, both of which route around the cut:**

1. **`POST /api/chat/ask`.** Hud attaches job cards to his answers. A free user
   who asks him for more jobs must not receive a match outside their three. Same
   cut, same place.
2. **`GET /api/dashboard` → `topMatches`.** Currently sends two, so it is inside
   the allowance by luck rather than by rule. Make it the rule.

`dev/site-plugin.ts` performs the cut the same way, deliberately: doing it in
the client locally would let a bypassable build pass every local test and ship.

### 6. Paddle — what the front end does, and what it refuses to do

The checkout is built (`Onboarding/src/lib/paddle.ts`, `src/app/Plan.tsx`)
against `@paddle/paddle-js`. It opens an overlay with the price id, passes
`customData: { userId }` so the webhook can attach the subscription to an
account, and passes `customer.email` to save the user retyping it.

**The browser never decides that somebody is premium.** `checkout.completed`
means Paddle took the money, not that the account changed. On that event the
plan screen polls `GET /api/usage` until the SERVER reports `plan: "paid"`, and
after 30 seconds says the payment is still landing rather than claiming it
failed. What the server owes:

- Handle the Paddle webhook and flip the account to `paid`.
- Reflect it in `GET /api/usage` (`plan`) and in the limits it returns: 3 rescans
  a week and 90 messages a day on paid, 1 and 30 on free.
- Reflect it in the job cut above.
- On a lapsed or cancelled subscription, return to `free` at period end. The UI
  already treats free as the normal state, so nothing needs to be told.

**Currency.** Paddle does not support OMR. The rial is pegged at a fixed
1 OMR = 2.6008 USD, so the published 2.9 OMR is charged as **$7.50** and the
two cannot drift. The Paddle price must be created in USD at 7.50.

**Config** is three build-time vars, documented in `Onboarding/.env.example`:
`VITE_PADDLE_ENV`, `VITE_PADDLE_TOKEN` (the client-side token, safe in the
browser — never the API key), `VITE_PADDLE_PRICE_ID`.

**With the vars unset the upgrade button is NOT RENDERED AT ALL** — it is not a
disabled button, and there is no message in its place. `Plan.tsx` gates it on
`isConfigured`, so the Premium column shows its price and nothing to press.

That is deliberate, and it is the same rule as the last-CV control above: a
disabled button invites a click and then refuses it. A user cannot act on a
missing environment variable and should not be shown one. The cancel policy
still renders, because it is true whether or not checkout is wired.

The explanation goes to the **dev console**, naming which var is unset. So: a
Premium column with a price and no button in a deployed environment means these
are not set, and nothing on the page will say so — check here. Vite reads env
files at startup, so the dev server needs a restart, not a reload, after adding
them.

**If a CSP is ever added** to the app it has to allow Paddle: `cdn.paddle.com`
for the script and `*.paddle.com` in `frame-src`. There is no CSP today.

### 7. Deferred: telling someone a better match appeared

Free is "your three strongest matches, **kept current**", and the second half of
that promise is not built. When a new posting outranks one of a user's three,
they should hear about it; today the list simply changes if they happen to look.

Nothing exists for this — no event, no delivery channel, no surface — so it is
deliberately out of the pricing work rather than half done. What it needs:

- An event when a user's top three changes, with what entered and what left.
- A channel. In-app is the smallest honest version; email needs a template, a
  sending path and an unsubscribe, and should not be added without them.
- An opt-out, stored with the account rather than the browser.

Until it ships, no screen may claim the user will be notified.

### 8. Carrying "I came here to buy" across the handoff

Someone who presses the premium button on `/pricing` should land on the upgrade
screen once they are through signup, verification and onboarding, rather than on
the dashboard having to go and find it.

**Built and working today, with one deployment assumption.** The pricing CTA
links to `/signup/?intent=premium`; `form.ts` turns that into a cookie
(`itqan_intent=premium`, 30 minutes) on a successful signup; the app reads it on
boot, moves it into `sessionStorage`, deletes the cookie, and spends it once —
at the end of `Confirm` for a first run, or at the app's landing route for
someone who already had an account.

**The assumption is a shared registrable domain.** A cookie set on
`itqan.com` reaches `app.itqan.com`; it does not reach a different domain
entirely. If the app ever moves off the site's domain, this stops working
silently — nobody sees an error, the intent is simply lost and they land on the
dashboard.

To make it survive that, `/api/handoff` needs to forward the parameter:

```
GET /api/handoff?intent=premium   ->  302 <app>/?intent=premium
```

**The app already reads `?intent=premium` from its own URL**, with the same
capture-and-clear path, so forwarding it is the only change required and nothing
in the front end has to be touched. Pass through only the literal value
`premium`; anything else should be dropped rather than reflected.

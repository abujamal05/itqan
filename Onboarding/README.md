# Itqan — the product app

React + TypeScript + Vite. Arabic-first, RTL-native, bilingual, responsive, light and dark.

This is **not** a standalone app. It is the signed-in half of Itqan; the marketing site is the other
half, and they run as **one origin**:

```
/            the marketing site (itqan-website), served from its build, untouched
/ar/… /en/…  the site's pages, including ITS login and signup
/api/…       the endpoints the site's forms already post to
/app/…       this app
```

## Running it

```bash
cd itqan-website && npm run build     # once, and after any site change
cd ../Onboarding  && npm install && npm run dev -- --port 4333
```

Then open **http://localhost:4333/** — the marketing site. Log in there and you land in the app.
Opening `/app/` directly is fine too; with no session it sends you to the site's login page.

## Test accounts

Password for both: `itqan1234`

| Email | What it exercises |
|---|---|
| `maryam@itqan.test` | Fresh account. Goes through the whole onboarding flow. |
| `nasser@itqan.test` | Already onboarded. Lands straight on the dashboard. |

These live **server side only**, in `dev/site-plugin.ts`, and are never rendered into any page.
Credentials belong in project notes, not in a UI a real user can see. Signing up through the site's
own form also works and creates a real session.

Two handles for awkward paths: name a file `unreadable-x.pdf` to make the pipeline fail, and reload
mid-onboarding to see the "pick up where you left off" offer.

## How the two halves connect

**This app contains no login or signup screen, and never will.** The site owns them. There is no
`login()` or `signup()` in the API contract and no password anywhere in this codebase — a second
sign-in surface is a second thing to keep in step, and the first one to drift.

The wiring is the site's existing contract, not a new one. `itqan-website/src/scripts/form.ts`
already does:

```js
const response = await fetch(form.action, { method: 'POST', body: new FormData(form) });
if (response.ok) window.location.assign(form.dataset.successUrl);
```

So a 200 plus a session cookie is the whole handshake. `dev/site-plugin.ts` implements
`/api/placeholder/login` and `/api/placeholder/signup` — the exact paths the site already posts to —
and this app reads the resulting cookie through `/api/session`.

### The one change to the website

`itqan-website/src/config.ts`, one value:

```diff
- export const appUrl = 'https://app.itqan.example';
+ export const appUrl = '/app/';
```

Nothing else in the site was touched: no markup, no styles, no copy, no components. That file's own
doc comment describes it as "the single place to point the forms at the real API later", which is
exactly what this is. Without it the site's forms would still redirect to a placeholder domain, so
the alternative was rewriting its built HTML at serve time, which is the same change made fragile.

### What carries across

- **Session** — one cookie on one origin.
- **Language** — the site's locale is in its URL; the login endpoint records which one was used and
  the app opens in it. Toggling language inside the app moves the same cookie, so the services answer
  in the new language too.
- **Theme** — the app reads and writes `itqan-theme`, the same key the site's toggle uses.
- **Assets** — the real `.webp` logo lockups and `.webm` mascot clips, straight from the site.

## Design decisions, and why

**Hud is absent from the confirmation screen, the dashboard, roles and courses.** Locked brand rule:
the mascot never appears beside a verdict, a score, a real match, or anything a user will act on,
because a cartoon bird next to evidence reframes it as a guess. He belongs to the upload and reading
screens, and his pose tracks the pipeline — `analyzing` while it runs, `error` if it fails,
`celebrating` when it lands.

**Instruction boxes are speech bubbles.** A bubble reads as someone talking to you rather than a
system notice. On wide screens he is large with the bubble beneath him, tail pointing up at his beak;
on a phone it becomes a compact row with the tail pointing sideways, because vertical space is the
scarce resource there. Every line he says also exists in the heading or body copy — he is
`aria-hidden`, and a screen-reader user must lose nothing.

**One drop area, not one slot per document type.** Six labelled dropzones would be a wall of empty
boxes most users never fill. Files arrive however they arrive and each lands as a row saying what
Itqan thinks it is, correctable in one tap; the kind is guessed from the filename because people name
these files predictably. Only the transcript is required, and the requirement is explained next to
the button it blocks.

**Dashboard order**, as specified: where you stand → your highest yield skills → skills to unlock
(with the way through to courses) → job postings. What is kept from the capability-first argument is
the framing rather than the sequence: the readiness number never appears alone (it carries a sentence
and a "how this is worked out" disclosure), and gaps stay "to unlock" with a plus icon rather than a
deficit in a danger hue.

**The sidebar collapses to an icon rail** (button, or `[`), and the choice is remembered — someone
who wants the wide view wants it every time. Labels are removed from the flow rather than hidden, so
a screen reader cannot read a label nobody can see; each control keeps its own aria-label.

**Nav order is the journey**: Dashboard, Courses, Job postings. Postings sit last because they are
the destination, not the starting point.

**There is no hamburger.** A drawer hiding three destinations costs a tap to save nothing. The
account menu *is* a dropdown, because it holds a destructive action; it closes on Escape, on
outside-click, on selection, and when focus leaves.

**Course prices are large and near the top.** Cost is the second thing anyone wants to know, and a
product that refuses affiliate commissions has no reason to bury it. Free is stated as a word, not
"0.000 OMR", which reads as an oversight.

**Both browse pages carry filters and a "look for new" action.** These lists come from sources that
change on their own schedule, so a user waiting on a posting needs a way to ask rather than reload
and hope. The result is always reported, including "nothing new" — the honest and most common answer,
and the one a silent spinner leaves ambiguous.

## Interrupted onboarding

Progress saves to the account after every meaningful change, debounced. Because it goes through the
API rather than to this browser, starting on a phone and finishing on a laptop works. Returning is
*offered*, never forced. Landing on a later step with no in-memory state sends the user back to the
first step, where the offer lives.

## Architecture

Agents are API-based. The app never runs inference or does its own matching.

```
src/api/types.ts    the contract, and the only thing screens depend on
src/api/http.ts     the client — one, always
dev/site-plugin.ts  the dev backend: serves the site, implements the endpoints
dev/data.ts         dev fixtures (real-shaped, deliberately imperfect)
```

There used to be a mock client chosen when no API URL was set. It is gone: the dev server now serves
real endpoints, so there is one code path in every environment. That branch had already caused a bug
— the mock's `session()` always returned null, so a user who had just logged in on the site was
bounced straight back to it.

Two trust rules are enforced by the types rather than by each screen remembering them: every
extracted field travels with its own `confidence`, and every recommendation carries `why` plus a real
`source` with a retrieval date.

## Verified

Screenshots time out on this machine (the pane does not composite), so verification was done through
DOM geometry and computed styles, and that is stated rather than implied.

- Signed up and logged in **through the site's own forms**; both journeys walked end to end.
  Logout returns to the site's login page in the right language and clears the session.
- Endpoints checked directly: 401 on bad password, 409 on duplicate email, 401 with no session.
- **Contrast:** every text node on every route, light and dark, against composited backgrounds. Zero
  failures. **Targets:** every non-inline control ≥ 44px.
- **RTL:** direction flips, layout mirrors, the bubble tail mirrors, Arabic gets its larger size and
  1.75 line-height, no physical CSS properties, mixed strings isolated with `<bdi>`.
- No horizontal overflow at 375 / 585 / 1280. Both dictionaries: 153 keys, exact parity, none unused.

## Open items

- **`--color-text-muted` fails AA on two of three surfaces** — 4.32:1 on paper, 3.70:1 on sand,
  against a 4.5 floor; it passes only on white. Tokens are locked, so muted is used only inside white
  cards here. **The design system needs a muted step that clears 4.5 on paper.**
- `components.md` specifies gold text for ghost buttons, contradicting the locked "gold is never body
  text on light". The locked rule was followed; worth reconciling upstream.
- `react-router-dom@7.18.1` carries a high advisory for **RSC mode**, not reachable in library mode.
- In production, `/app/` must be served under the same origin as the site, and the real API must
  implement the endpoints in `dev/site-plugin.ts`. That file does not ship.
- Saved roles are component state; persisting them is a real endpoint.
- Rubik loads from the Google Fonts CDN. Self-host before production.
#   i t q a n  
 
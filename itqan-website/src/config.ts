/**
 * Where the sign up and log in forms post.
 *
 * These were `/api/placeholder/*` — the word "placeholder" in a production URL,
 * from when no backend existed. The API now serves `/api/auth/*` and keeps the
 * old paths as aliases, because this site is static: the HTML on the box posts
 * to whatever path it was BUILT with, and it deploys from a different repo by a
 * different job than the API does. Until this build is live, older HTML is still
 * posting to the old paths.
 *
 * The aliases can be removed from the API once this has shipped and the old
 * paths show no traffic.
 */
export const formEndpoints = {
  signup: '/api/auth/signup',
  login: '/api/auth/login',
} as const;

/**
 * Which revision of the privacy policy the sign up form is consenting to.
 *
 * **BUMP THIS WHENEVER THE POLICY TEXT CHANGES.** It is posted with the consent
 * checkbox and stored against the account, so it is the record of the document
 * a person actually saw. A stored consent with no version answers "did they
 * agree"; only the version answers "to what", which is the question an audit
 * asks. Oman's PDPL has been enforceable since 5 February 2026.
 *
 * WHY THE SITE SENDS IT RATHER THAN THE SERVER STAMPING ITS OWN IDEA OF
 * "current": the site is static, and the HTML a visitor has open was built at
 * some point in the past. A server guessing gets it wrong precisely when it
 * matters — when a cached older policy is the one being read. The renderer is
 * the only party that knows which text was on screen.
 *
 * One version covers both locales: `ar.json` and `en.json` ship from the same
 * commit, so they are two renderings of one revision rather than two documents.
 *
 * `placeholder` is in the string because it is true. The current pages describe
 * practice and say plainly that the binding notice is still being drafted, so
 * consent held today is consent to that. When the lawyer's text lands this
 * becomes a dated version without the suffix, and everyone who agreed to a
 * `-placeholder` revision needs asking again — which is exactly what this field
 * makes findable.
 */
export const privacyPolicyVersion = '2026-08-24-placeholder';

/**
 * The deployed origin. Single-sourced from astro.config's `site` (Astro exposes
 * it as `import.meta.env.SITE`), so it can never drift from what canonical URLs
 * and hreflang use. Set it via the ITQAN_SITE_URL build env, not here.
 */
export const siteUrl = import.meta.env.SITE ?? 'https://itqan.example';

/**
 * Where a successful sign up or log in lands.
 *
 * This points at an endpoint on THIS origin rather than straight at the app.
 *
 * The reason used to be that the app was a separate deployment on a different
 * domain and could not read a cookie set here. **That is no longer true.**
 * Since the move to a single box, Caddy serves the site, `/app/*` and `/api/*`
 * from one origin, which is why `credentials: 'same-origin'` works and why no
 * CORS is configured anywhere. Confirmed with the API team, 2026-08-24.
 *
 * The hop stays regardless, because it does a second job: /api/handoff reads
 * the session, signs a short-lived token and redirects with it, which is what
 * lets the app come up already signed in instead of racing the cookie. Do not
 * "simplify" it away on the grounds that the domains now match.
 */
export const appUrl = '/api/handoff';

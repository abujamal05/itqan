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
 * THE VALUE IS THE EFFECTIVE DATE PRINTED ON THE PAGE, and deliberately so: an
 * auditor asking "what did this person agree to" can read the date off the
 * stored consent, find the document bearing that date, and be done. A version
 * scheme that does not correspond to anything on the page makes that a lookup
 * through someone's deployment history instead.
 *
 * It briefly carried a `-placeholder` suffix, while the pages described
 * practice rather than stating terms. They now carry the policy itself, so the
 * suffix was retired with the thing it described. Amendments after legal review
 * take the date they take effect.
 */
export const privacyPolicyVersion = '2026-08-24';

/**
 * How to reach Itqan. One address and one number for everything.
 *
 * NOT IN THE LOCALE FILES, because neither value is translatable and a string
 * duplicated across two locales is a string that will eventually disagree with
 * itself. The surrounding words are translated; these are not.
 *
 * ONE EXCEPTION TO THAT, and it is deliberate: the Privacy Policy and the Terms
 * of Use carry the address and the number inside their own prose, where they
 * cannot be interpolated without breaking the sentence in one language or the
 * other. **If either value changes here, clause 14 of the policy and clause 18
 * of the terms have to change with it, in both locales.**
 */
export const contact = {
  email: 'ItqanTeam@outlook.com',
  phone: '+968 7123 5872',
  /** `tel:` wants no spaces; the displayed form keeps them. */
  phoneHref: '+96871235872',
} as const;

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

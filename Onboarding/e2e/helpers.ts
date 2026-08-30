/**
 * Shared test helpers.
 *
 * Auth here takes the fast path the dev origin allows: the site's login
 * endpoint sets the session cookie, and because dev is one origin the app reads
 * it straight back from `/api/session` — the two-minute handoff token only
 * exists to cross domains in production. So a single POST logs a test in, with
 * no form typing and no redirect to wait on.
 */
import { expect, type Page } from '@playwright/test';

export const ACCOUNTS = {
  /** Fresh account — un-onboarded, walks the whole onboarding flow.
   *  Was maryam@itqan.test until she was seeded onboarded for manual QA (a login
   *  should always land on a populated app). That flipped /app/upload to redirect
   *  to the dashboard and broke this suite; new@itqan.test is the dedicated
   *  un-onboarded fixture and must stay onboarded:false in site-plugin.ts. */
  fresh: 'new@itqan.test',
  /** Already onboarded — lands straight on the dashboard. */
  onboarded: 'nasser@itqan.test',
  /**
   * Onboarded, and DELIBERATELY LOGGED INTO BY NOTHING ELSE.
   *
   * The stub keeps per-account state (the token counter, most of all) in memory
   * for the life of the dev server, and the suite runs fully parallel. So a
   * test that asserts an exact counter against a shared account is really
   * asserting what every other worker happened to do first — which is how the
   * token spec passed alone and failed in a full run. Anything that SPENDS
   * belongs here; if a second spec ever takes this account, that isolation is
   * gone and the flake comes back.
   */
  spender: 'maryam@itqan.test',
  /**
   * Onboarded, and the ONLY account the merge spec touches — for the same
   * reason `spender` exists. A re-upload spends a document re-read, so sharing
   * an account here would reintroduce the exact cross-project flake documented
   * above.
   */
  merger: 'reader@itqan.test',
  /**
   * Onboarded, and the ONLY account the celebration spec touches. It spends,
   * like the two above — and it also reads the readiness score before and
   * after a run, so a second spec resetting this account between those two
   * reads would move the number out from under the assertion.
   */
  celebrant: 'amal@itqan.test',
} as const;

export const PASSWORD = 'itqan1234';

/**
 * Log in as one of the seeded accounts, in a chosen language.
 *
 * Uses the browser context's own request so the session cookie lands where
 * later `page.goto` calls will send it. Language rides on the request's
 * `Referer`: the login endpoint reads it to stamp the `itqan_locale` cookie,
 * and the app adopts THAT on boot (App.tsx applies the session's locale over
 * whatever localStorage held). Setting localStorage instead does not stick —
 * the session cookie wins — which is the trap this avoids.
 */
export async function login(
  page: Page,
  email: string = ACCOUNTS.onboarded,
  locale: 'ar' | 'en' = 'en',
): Promise<void> {
  const res = await page.request.post('/api/auth/login', {
    multipart: { email, password: PASSWORD },
    // The endpoint only looks for a `/en/` or `/ar/` segment in the referer.
    headers: { referer: `http://localhost/${locale}/login/` },
  });
  expect(res.status(), `login(${email}) should return 200`).toBe(200);
}

/** Drop any saved onboarding progress so a flow test starts from a clean slate. */
export async function resetProgress(page: Page): Promise<void> {
  await page.request.delete('/api/onboarding/progress');
}

/**
 * A minimal in-memory PDF. The FILENAME is load-bearing: the upload screen
 * guesses the document kind from it, and the flow requires a CV (Agent A's
 * contract, REQUIRED_KIND='cv'). Uploading `transcript.pdf` leaves the continue
 * button correctly disabled — which is exactly the stale-test trap that broke
 * this spec when REQUIRED_KIND moved from transcript to cv.
 */
export function fakePdf(name: string) {
  return { name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 itqan e2e fixture') };
}

/** The required document — unlocks the continue button. */
export const fakeCv = () => fakePdf('cv.pdf');
/** The optional corroborating document. */
export const fakeTranscript = () => fakePdf('transcript.pdf');

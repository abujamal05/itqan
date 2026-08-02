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
  /** Fresh account — walks the whole onboarding flow. */
  fresh: 'maryam@itqan.test',
  /** Already onboarded — lands straight on the dashboard. */
  onboarded: 'nasser@itqan.test',
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
  const res = await page.request.post('/api/placeholder/login', {
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

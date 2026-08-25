/**
 * "I came here to buy", from the marketing site to the upgrade screen.
 *
 * The FIRST-RUN half of this flow lives in `onboarding.spec.ts` instead: it
 * walks the fresh account's onboarding, and that account's progress is shared
 * server-side, so it has to sit in the one serial describe that owns it. Two
 * files walking it in parallel wipe each other's save mid-flight.
 *
 * This one behaviour crosses the two halves of the product: a link on the
 * static site, a cookie written by the site's form script, a capture in the
 * app's boot, and a redirect at the end of onboarding. Nothing type-checks
 * across that boundary and no single unit test can see it, so it is exactly the
 * flow that breaks silently when one of the four moves.
 *
 * The intent is deliberately SPENT, so each test asserts it does not linger.
 */
import { test, expect } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

const COOKIE = 'itqan_intent';

/** What `form.ts` does on a successful signup from a `?intent=premium` URL. */
async function arriveWithIntent(page: import('@playwright/test').Page) {
  await page.context().addCookies([{
    name: COOKIE, value: 'premium', url: 'http://localhost:4333/',
  }]);
}

const intentCookie = async (page: import('@playwright/test').Page) =>
  (await page.context().cookies()).find((c) => c.name === COOKIE)?.value ?? null;

test.describe('the premium intent', () => {
  test('the pricing page is the only link that carries it', async ({ page }) => {
    await page.goto('/en/pricing/');
    await expect(page.locator('.tier--paid .tier__cta')).toHaveAttribute('href', /intent=premium/);
    // The free card must NOT carry it, or everyone lands on the sales screen.
    await expect(page.locator('.tier--free .tier__cta')).toHaveAttribute('href', /^(?!.*intent).*$/);
  });

  test('an account that is already onboarded goes straight to the plan', async ({ page }) => {
    await login(page, ACCOUNTS.onboarded, 'en');
    await arriveWithIntent(page);

    await page.goto('/app/');

    await expect(page).toHaveURL(/\/app\/plan/);
    await expect(page.locator('.tiers')).toBeVisible();
    // Spent, not remembered: the carrier is gone and a second entry is normal.
    expect(await intentCookie(page)).toBeNull();
    await page.goto('/app/');
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('without the intent the same entry lands on the dashboard', async ({ page }) => {
    await login(page, ACCOUNTS.onboarded, 'en');
    await page.goto('/app/');
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });
});

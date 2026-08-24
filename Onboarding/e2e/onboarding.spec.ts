/**
 * The signed-in flow, including the reload bug that started all this: landing
 * on a later onboarding step with no in-memory state must OFFER to resume, not
 * dead-end. On a phone that discards a backgrounded tab, that reload is what a
 * user experiences as "the Questions page does not load".
 *
 * The stateful part is gated to one engine on purpose. Onboarding progress
 * lives server-side keyed by account, shared across every browser context, so
 * five engines walking the same fresh account at once would clobber each
 * other's progress. The flow is engine-agnostic React; cross-browser coverage
 * of what actually differs (layout, the mascot, the glow) lives in the other
 * specs. The read-only dashboard checks below are safe everywhere.
 */
import { test, expect } from '@playwright/test';
import { login, resetProgress, fakeCv, ACCOUNTS } from './helpers';

test.describe('dashboard (onboarded account)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.onboarded, 'en');
  });

  test('greets the user by name', async ({ page }) => {
    await page.goto('/app/dashboard');
    // "Welcome, Nasser" — assert on the name, which survives either language.
    await expect(page.getByRole('heading', { name: /Nasser/ })).toBeVisible();
    // The readiness figure never appears alone — its card is present.
    await expect(page.locator('.readiness')).toBeVisible();
  });

  test('the app root sends an onboarded user to the dashboard', async ({ page }) => {
    await page.goto('/app/');
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });
});

test.describe('onboarding flow (fresh account)', () => {
  // These share one account's progress server-side, so they must not run at the
  // same time as each other either — one's reset would wipe the other's save
  // mid-flight. Serial keeps the fresh-account walk to a single worker.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }, testInfo) => {
    // Shared server-side progress — walk the stateful flow on one engine only,
    // so five engines do not clobber the same account's progress in parallel.
    test.skip(testInfo.project.name !== 'chromium',
      'onboarding progress is shared server-side; walked once on chromium');
    await login(page, ACCOUNTS.fresh, 'en');
    await resetProgress(page);
  });

  test('upload → questions, then a reload OFFERS to resume instead of dead-ending', async ({ page }) => {
    await page.goto('/app/upload');
    await expect(page.getByRole('heading', { name: 'Add your documents' })).toBeVisible();

    // Add the CV (the required document); the CTA unlocks once the upload settles.
    await page.locator('input[type="file"]').setInputFiles(fakeCv());
    await expect(page.locator('.doc')).toHaveCount(1);
    const cta = page.getByRole('button', { name: 'Read my documents' });
    await expect(cta).toBeEnabled();
    await cta.click();

    // On the questions step, mid-pipeline.
    await expect(page).toHaveURL(/\/app\/questions/);
    await expect(page.locator('.choice').first()).toBeVisible();

    // Answer one question so progress is genuinely saved, then wait for the save.
    await Promise.all([
      page.waitForResponse((r) =>
        r.url().includes('/api/onboarding/progress') && r.request().method() === 'PUT'),
      page.locator('.choice').first().click(),
    ]);

    // THE REGRESSION: reload with no in-memory state.
    await page.reload();

    // It must offer to resume, on this step — not bounce to upload, not blank.
    const offer = page.locator('.callout--offer');
    await expect(offer).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start again' })).toBeVisible();

    // Continuing restores the step.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator('.choice').first()).toBeVisible();
  });

  test('"Start again" from the resume offer returns to step one', async ({ page }) => {
    // Seed some progress, then land on a later step to trigger the offer.
    await page.goto('/app/upload');
    await page.locator('input[type="file"]').setInputFiles(fakeCv());
    const cta = page.getByRole('button', { name: 'Read my documents' });
    await expect(cta).toBeEnabled();
    await Promise.all([
      page.waitForResponse((r) =>
        r.url().includes('/api/onboarding/progress') && r.request().method() === 'PUT'),
      cta.click(),
    ]);
    await expect(page).toHaveURL(/\/app\/questions/);

    await page.reload();
    await expect(page.locator('.callout--offer')).toBeVisible();
    await page.getByRole('button', { name: 'Start again' }).click();

    await expect(page).toHaveURL(/\/app\/upload/);
    await expect(page.getByRole('heading', { name: 'Add your documents' })).toBeVisible();
  });

  /**
   * The premium intent, spent at the end of a real first run.
   *
   * Lives here rather than with the other intent tests because it walks this
   * account's onboarding, and the describe above is what serialises that.
   */
  test('a first run with the premium intent ends on the plan, not chat', async ({ page }) => {
    test.setTimeout(90_000);

    // What form.ts writes on a successful signup from a ?intent=premium URL.
    await page.context().addCookies([{
      name: 'itqan_intent', value: 'premium', url: 'http://localhost:4333/',
    }]);

    await page.goto('/app/upload');
    await page.locator('input[type="file"]').setInputFiles(fakeCv());
    await expect(page.locator('.doc')).toHaveCount(1);
    await page.getByRole('button', { name: 'Read my documents' }).click();

    /* Answer whatever the step puts up. Not every question is a choice list —
       "what kind of job are you looking for" is free text with Continue and
       Skip, and a loop that only clicks `.choice` stops dead on it. */
    await expect(page).toHaveURL(/\/app\/questions/);
    for (let i = 0; i < 12; i += 1) {
      if (!/\/app\/questions/.test(page.url())) break;
      const choice = page.locator('.choice').first();
      const skip = page.getByRole('button', { name: 'Skip this' });
      if (await choice.isVisible().catch(() => false)) await choice.click();
      else if (await skip.isVisible().catch(() => false)) await skip.click();
      else break;
      await page.waitForTimeout(300);
    }

    // The pipeline has to land before confirm can be reached.
    await page.waitForURL(/\/app\/confirm/, { timeout: 60_000 });

    /* Confirm is the product's consent checkpoint: the box is required and the
       CTA is named for the outcome, not for the act. */
    await page.locator('.consent input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'See where I stand' }).click();

    // THE ASSERTION: not /chat, which is where a first run normally ends.
    await expect(page).toHaveURL(/\/app\/plan/, { timeout: 20_000 });

    await resetProgress(page);
  });
});

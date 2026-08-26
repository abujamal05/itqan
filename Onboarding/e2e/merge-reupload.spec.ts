/**
 * Re-uploading a CV ADDS to a profile; it does not replace it.
 *
 * The defect this covers was quiet and expensive: `merge` mode existed on the
 * server, and `startAnalysis` had no `mode` parameter to reach it with, so every
 * re-upload ran `replace` and confirming overwrote the stored profile wholesale.
 * Any skill the second document happened not to mention was deleted, and the
 * only symptom was a readiness score that fell after someone improved their CV.
 *
 * Runs against the dev stub, which answers merge-shaped for exactly this reason
 * — a screen developed against a stub that cannot produce production's response
 * is a screen developed against a fiction.
 */
import { expect, test } from '@playwright/test';
import { ACCOUNTS, fakeCv, login } from './helpers';

test.describe('re-uploading a CV', () => {
  test.beforeEach(async ({ page }) => {
    // `merger` is spent against (a re-read costs tokens) and is therefore not
    // shared with any other spec — see ACCOUNTS in helpers.ts.
    await login(page, ACCOUNTS.merger);
    /* START FROM ZERO. This spec runs once per browser project against one dev
       server holding one counter, so without a reset the second project meets a
       429 and the upload never happens. The token spec learned this the hard
       way by passing on chromium and failing on the other four. */
    await page.request.post('/api/dev/tokens');
  });

  test('keeps the skills already on the profile', async ({ page }) => {
    await page.goto('/app/documents');
    await page.locator('input[type="file"]').setInputFiles(fakeCv());
    const cta = page.getByRole('button', { name: 'Read my documents again' });
    await expect(cta).toBeEnabled();
    await cta.click();

    await page.waitForURL(/\/confirm/);
    // The skills panel is the whole point: it must be populated from the UNION,
    // not from this run's extraction alone.
    const skills = page.locator('.chip--capability');
    await expect(skills.first()).toBeVisible({ timeout: 30_000 });
    expect(await skills.count()).toBeGreaterThan(0);
  });

  test('a skill removed before is offered back, not silently restored', async ({ page }) => {
    await page.goto('/app/documents');
    await page.locator('input[type="file"]').setInputFiles(fakeCv());
    const cta = page.getByRole('button', { name: 'Read my documents again' });
    await expect(cta).toBeEnabled();
    await cta.click();
    await page.waitForURL(/\/confirm/);
    await expect(page.locator('.chip--capability').first()).toBeVisible({ timeout: 30_000 });

    // The stub marks one extracted skill as previously-removed so this path is
    // reachable locally. It must render as an OFFER — a button, outside the
    // draft — because re-adding a deliberate deletion is the one thing the
    // confirm screen exists to prevent.
    const offers = page.locator('.chip--offer');
    // ASSERTED, not guarded. An `if (count > 0)` here would pass silently the
    // day the offer stopped rendering, which is the failure this test exists to
    // catch — a test that cannot fail is not a test.
    await expect(offers.first()).toBeVisible();
    const name = (await offers.first().innerText()).trim();

    // Not on the profile while it is only an offer...
    expect(await page.locator('.chip--capability', { hasText: name }).count()).toBe(0);
    // ...and on it only once the person presses.
    await offers.first().click();
    await expect(page.locator('.chip--capability', { hasText: name }).first()).toBeVisible();
    await expect(offers).toHaveCount(0);
  });
});

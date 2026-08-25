/**
 * No page may scroll horizontally. This is the machine-checkable core of the
 * responsiveness work: a document wider than its own viewport is the signature
 * of every overflow, oversized element and un-wrapped string that was fixed,
 * and it is the one thing that reads identically on every device.
 *
 * Runs the site pages and the signed-in app screens across a spread of widths,
 * in both directions, on whichever engine the project selects.
 */
import { test, expect, type Page } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

const WIDTHS = [320, 360, 414, 768, 1024, 1440];

/** True horizontal overflow, allowing a 1px rounding slack. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth - de.clientWidth;
  });
}

test.describe('marketing site has no horizontal scroll', () => {
  for (const path of ['/en/', '/ar/', '/en/signup/', '/ar/signup/', '/en/proof/']) {
    for (const width of WIDTHS) {
      test(`${path} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        expect(await horizontalOverflow(page), `${path} @ ${width}px overflows`).toBeLessThanOrEqual(1);
      });
    }
  }
});

/**
 * How Hud is allowed to appear on the chat screen.
 *
 * Two separate rules, both easy to break by accident and neither visible in a
 * screenshot of a short thread:
 *
 *  - the ILLUSTRATED mascot (`.hud`, the animated clip) appears at most once,
 *    and only on the empty state where it has room for its 120px floor. A
 *    mascot per message is the obvious way to build a chat and the fastest way
 *    to make one look cheap.
 *  - the compact MARK (`.mark`) is the per-turn avatar, exactly one per
 *    assistant turn and never on the user's own.
 */
test.describe('Hud appears exactly where he is allowed to', () => {
  for (const width of [375, 768, 1280]) {
    test(`at ${width}px, through a whole turn`, async ({ page }) => {
      await login(page, ACCOUNTS.onboarded);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/app/chat');

      const mascot = page.locator('.hud');
      const marks = page.locator('.mark');

      // Empty state: the greeting owns the single illustrated instance, and
      // there are no per-turn avatars yet.
      await expect(page.locator('.greet')).toBeVisible();
      expect(await mascot.count(), 'mascots on the empty state').toBe(1);
      expect(await marks.count(), 'marks on the empty state').toBe(0);

      await page.locator('.suggest').first().click();

      // The answer, its cards and its avatar.
      await expect(page.locator('.turn--hud').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.acts').first()).toBeVisible({ timeout: 15_000 });

      const hudTurns = await page.locator('.turn--hud').count();
      expect(await mascot.count(), 'mascots mid conversation').toBe(0);
      expect(await marks.count(), 'one mark per assistant turn').toBe(hudTurns);
      expect(await page.locator('.turn--mine .mark').count(), 'no mark on the user turn').toBe(0);
    });
  }
});

test.describe('signed-in app has no horizontal scroll', () => {
  for (const path of ['/app/chat', '/app/dashboard', '/app/jobs', '/app/courses']) {
    for (const width of [320, 360, 768, 1024]) {
      test(`${path} at ${width}px`, async ({ page }) => {
        await login(page, ACCOUNTS.onboarded);
        /* NO `resetProgress` HERE. It is a DELETE against shared server-side
           state, issued by sixteen tests (four paths x four widths) all running
           as the same onboarded account. A layout test has no business writing
           anything, and there is nothing here to clear — `nasser@itqan.test` is
           seeded onboarded.

           Honest scope: removing it did NOT stop this spec failing under
           parallel workers, so it was not the cause, or not the only one. It
           comes out because a read-only test should be read-only, not because
           it fixed the flake. What fixed that was `workers: 1`.

           Worth keeping from the hunt: measured directly at 320, 360, 768 and
           1024 with all 16 match cards present, `/app/jobs` overflows by 0px at
           every width. Whatever the failures were, there is no layout bug
           underneath them. */
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        // Wait for the data screen to actually paint before measuring.
        await expect(page.locator('h1').first()).toBeVisible();
        expect(await horizontalOverflow(page), `${path} @ ${width}px overflows`).toBeLessThanOrEqual(1);
      });
    }
  }
});

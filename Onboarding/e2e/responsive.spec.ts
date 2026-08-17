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
import { login, resetProgress, ACCOUNTS } from './helpers';

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
 * Never more than one Hud on the chat screen.
 *
 * A mascot per message is the obvious way to build a chat and the fastest way to
 * make one feel cheap, so the rule is asserted rather than trusted to comments.
 * It is a CEILING, not a quota: zero is fine, which is what a narrow viewport
 * gets mid-conversation because 120px is his floor and a phone has better uses
 * for it.
 */
test.describe('the chat screen never shows two Huds', () => {
  for (const width of [375, 768, 1280]) {
    test(`at ${width}px, through a whole turn`, async ({ page }) => {
      await login(page, ACCOUNTS.onboarded);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/app/chat');
      await expect(page.locator('h1')).toBeVisible();

      const huds = page.locator('.hud');
      // Empty state: the greeting owns the one instance.
      expect(await huds.count(), 'on the empty state').toBeLessThanOrEqual(1);

      // Ask, which unmounts the greeting and mounts the header mascot. The
      // count must not spike during the swap either.
      await page.locator('.suggest').first().click();
      expect(await huds.count(), 'mid turn').toBeLessThanOrEqual(1);

      // And once the answer with its cards has landed.
      await expect(page.locator('.turn--hud')).toBeVisible({ timeout: 15_000 });
      expect(await huds.count(), 'after the answer').toBeLessThanOrEqual(1);
    });
  }
});

test.describe('signed-in app has no horizontal scroll', () => {
  for (const path of ['/app/chat', '/app/dashboard', '/app/jobs', '/app/courses']) {
    for (const width of [320, 360, 768, 1024]) {
      test(`${path} at ${width}px`, async ({ page }) => {
        await login(page, ACCOUNTS.onboarded);
        await resetProgress(page);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        // Wait for the data screen to actually paint before measuring.
        await expect(page.locator('h1').first()).toBeVisible();
        expect(await horizontalOverflow(page), `${path} @ ${width}px overflows`).toBeLessThanOrEqual(1);
      });
    }
  }
});

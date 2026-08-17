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

/**
 * The marketing site: every public page renders, in both languages, on every
 * engine, and the language switch actually crosses between the two route trees.
 */
import { test, expect } from '@playwright/test';

const PAGES = [
  { path: '/en/', dir: 'ltr' },
  { path: '/en/how-it-works/', dir: 'ltr' },
  { path: '/en/proof/', dir: 'ltr' },
  { path: '/en/privacy/', dir: 'ltr' },
  { path: '/en/terms/', dir: 'ltr' },
  { path: '/en/login/', dir: 'ltr' },
  { path: '/en/signup/', dir: 'ltr' },
  { path: '/ar/', dir: 'rtl' },
  { path: '/ar/how-it-works/', dir: 'rtl' },
  { path: '/ar/login/', dir: 'rtl' },
  { path: '/ar/signup/', dir: 'rtl' },
] as const;

for (const p of PAGES) {
  test(`loads ${p.path} with the right direction`, async ({ page }) => {
    const res = await page.goto(p.path);
    expect(res?.status(), 'page should not 404 or 500').toBeLessThan(400);
    // Direction is the base architecture — it must be set on <html>, not guessed.
    await expect(page.locator('html')).toHaveAttribute('dir', p.dir);
    // Something real rendered, not a blank shell.
    await expect(page.locator('header.site-header')).toBeVisible();
    await expect(page.locator('h1').first()).toBeVisible();
  });
}

test('the home hero renders its heading and both CTAs', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('.hero__title')).toBeVisible();
  // Primary + secondary hero actions.
  await expect(page.locator('.hero__actions a')).toHaveCount(2);
});

test('the language switch crosses from English to Arabic', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  // The Arabic option in the segmented control.
  await page.locator('.lang-switch__opt[hreflang="ar"]').click();
  await expect(page).toHaveURL(/\/ar\//);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('an unknown path serves the 404 page', async ({ page }) => {
  const res = await page.goto('/en/does-not-exist/');
  expect(res?.status()).toBe(404);
});

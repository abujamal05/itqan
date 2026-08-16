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

/**
 * Password recovery: the emailed link must survive a language switch.
 *
 * The reported bug, and three correct behaviours colliding to produce it. The
 * link arrives as /<lang>/forgot-password/?token=…; the page reads the token and
 * strips it from the URL (deliberately — a credential does not belong in
 * history, in a pasted link, or in a Referer); and the language toggle links to
 * the pathname only. So the other language loaded with no token at all and sent
 * the user back to "enter your email" — with a link they can only use once.
 *
 * The token now rides in sessionStorage, which survives a same-origin navigation
 * and still keeps the URL clean.
 */
const TOKEN = 'e2e-test-token-value';

for (const [from, to] of [['en', 'ar'], ['ar', 'en']] as const) {
  test(`the reset panel survives switching ${from} -> ${to}`, async ({ page }) => {
    await page.goto(`/${from}/forgot-password/?token=${TOKEN}`);

    // Arrived on the reset panel, and the token is already out of the URL.
    await expect(page.locator('[data-panel="reset"]')).toBeVisible();
    await expect(page.locator('[data-panel="request"]')).toBeHidden();
    expect(page.url()).not.toContain(TOKEN);

    await page.locator(`.lang-switch__opt[hreflang="${to}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${to}/forgot-password/`));

    // THE assertion: still setting a password, not asked for an email again.
    await expect(page.locator('[data-panel="reset"]')).toBeVisible();
    await expect(page.locator('[data-panel="request"]')).toBeHidden();
    // And the token came across, or the form would post an empty one.
    await expect(page.locator('#rp-token')).toHaveValue(TOKEN);
    // Carried in storage, NOT smuggled back into the address bar.
    expect(page.url()).not.toContain(TOKEN);
  });
}

test('someone who never followed a link still gets the email form', async ({ page }) => {
  await page.goto('/en/forgot-password/');

  await expect(page.locator('[data-panel="request"]')).toBeVisible();
  await expect(page.locator('[data-panel="reset"]')).toBeHidden();
});

test('a fresh link replaces the one already stashed', async ({ page }) => {
  /* Someone who requests a second link and opens it in the same tab must reset
     with the new token, not the one it superseded. */
  await page.goto(`/en/forgot-password/?token=${TOKEN}`);
  await expect(page.locator('#rp-token')).toHaveValue(TOKEN);

  await page.goto('/en/forgot-password/?token=second-token');

  await expect(page.locator('#rp-token')).toHaveValue('second-token');
});

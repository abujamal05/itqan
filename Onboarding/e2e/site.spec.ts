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

/**
 * Hud's corner panel: where an answer lands, and what a turn is allowed to say.
 *
 * The reported bug was placement. Answers used to land in a spine ABOVE the
 * question list, so a reply appeared mid-panel with a menu underneath it and the
 * eye had to travel back up from the input to find it. The conversation now ends
 * the body, which is why the first assertion here is geometry and not DOM order:
 * the complaint was about where the answer appears on screen.
 *
 * The rest are the two things that came out of the same screenshot. A visitor
 * gets three questions and could only ever see the third, because one
 * pre-rendered block was moved back and forth. And that block is the "I need
 * your record" refusal, so its heading sat over answers that needed no record at
 * all.
 *
 * The model path is exercised for real against the dev stub's `/api/ask`. Two
 * nonsense words score nothing against any authored answer's keywords, which is
 * what sends a question to the server; the authored refusal's own wording is
 * then the thing to assert did NOT appear.
 */
const REFUSAL = 'I can answer questions about Itqan itself';

const openPanel = async (page: import('@playwright/test').Page, lang: 'en' | 'ar' = 'en') => {
  await page.goto(`/${lang}/`);
  await page.locator('.hudchat__launcher').click();
  await expect(page.locator('.hudchat__panel')).toBeVisible();
};

for (const lang of ['en', 'ar'] as const) {
  test(`Hud's answer lands below the question list (${lang})`, async ({ page }) => {
    await openPanel(page, lang);

    await page.locator('.hudchat__fork').first().click();

    const turn = page.locator('.hudchat__spine > li');
    await expect(turn).toHaveCount(1);

    const list = (await page.locator('.hudchat__forksWrap').boundingBox())!;
    const answer = (await turn.boundingBox())!;
    /* THE reported bug. RTL is included because this is a reordered flex column
       and a mistake in one would show in the other first. */
    expect(answer.y, 'the answer must sit beneath the whole question list')
      .toBeGreaterThanOrEqual(list.y + list.height - 1);
  });
}

test('a second typed question does not erase the first', async ({ page }) => {
  await openPanel(page);

  const turns = page.locator('.hudchat__spine > li');
  const input = page.locator('#hudchat-input');

  await input.fill('zzzz qqqq');
  await input.press('Enter');
  await expect(turns.first()).toContainText('You asked: zzzz qqqq');
  // It really reached the model rather than falling back to the authored text.
  await expect(turns.first()).not.toContainText(REFUSAL);

  await input.fill('wwww vvvv');
  await input.press('Enter');
  await expect(turns).toHaveCount(2);

  // THE assertion: the first question and its answer are still on the panel.
  await expect(turns.first()).toContainText('zzzz qqqq');
  await expect(turns.nth(1)).toContainText('wwww vvvv');

  /* And the person can just keep typing. An answer that steals focus makes
     someone click back into the box before every question, which is the one
     thing a conversation must not ask of them. */
  await expect(input).toBeFocused();
});

test('the refusal heading goes when Hud actually answers', async ({ page }) => {
  await openPanel(page);

  const input = page.locator('#hudchat-input');
  await input.fill('zzzz qqqq');
  await input.press('Enter');

  const turn = page.locator('.hudchat__spine > li').first();
  await expect(turn).toContainText('You asked: zzzz qqqq');

  /* The block is the pre-written refusal, reused to carry a real reply. Its
     heading said "that one needs your record" over an answer that plainly did
     not need one. */
  await expect(turn.locator('.hudchat__question')).toBeHidden();
  /* `useInnerText`, deliberately: the default reads `textContent`, which
     includes the text of a display:none element, so the naive version of this
     assertion passes and fails for the wrong reasons. What is being claimed is
     that nobody SEES the sentence. */
  await expect(page.locator('.hudchat__spine'))
    .not.toContainText('needs your record', { useInnerText: true });
});

test('a whole conversation carries at most one account offer', async ({ page }) => {
  await openPanel(page);

  const input = page.locator('#hudchat-input');
  const turns = page.locator('.hudchat__spine > li');

  for (const q of ['zzzz qqqq', 'wwww vvvv', 'xxxx yyyy']) {
    await input.fill(q);
    await input.press('Enter');
    await expect(turns.last()).toContainText(`You asked: ${q}`);
  }
  await expect(turns).toHaveCount(3);

  /* Three answers used to mean three identical gold buttons stacked down the
     panel. It is an offer, and it belongs on the turn that runs out. */
  await expect(page.locator('.hudchat__spine .hudchat__signup:visible')).toHaveCount(1);
});

test('the panel still opens on the greeting and something to pick from', async ({ page }) => {
  await openPanel(page);

  await expect(page.locator('.hudchat__greeting')).toBeVisible();
  await expect(page.locator('.hudchat__fork')).toHaveCount(4);

  /* The panel's height was measured so the questions are visible on opening —
     that is the whole affordance, and moving the conversation below them is
     exactly the change that could have cost it. */
  const first = (await page.locator('.hudchat__fork').first().boundingBox())!;
  const composer = (await page.locator('.hudchat__composer').boundingBox())!;
  expect(first.y + first.height).toBeLessThanOrEqual(composer.y + 1);
});

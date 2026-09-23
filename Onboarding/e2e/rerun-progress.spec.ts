/**
 * The bar under a re-run has to actually draw something.
 *
 * Reported 2026-08-29 as "it shows the progress bar without moving, for every
 * stage". It was not a polling problem and not a stage problem: the chip
 * rendered `<span className="meter__fill">`, and the app's stylesheet defines
 * `.meter > i` and no `.meter__fill` at all. So the fill was an INLINE element
 * carrying a percentage inline-size, which inline elements ignore, with no
 * background — an empty 6px track at every value, from the day it shipped.
 *
 * A class name that does not exist fails silently and reads as a logic bug.
 * This component already carried a note about the same mistake: `button
 * button--primary` are classes from the MARKETING site's stylesheet, which this
 * app does not have either.
 *
 * So these assert PIXELS, not markup. `toHaveClass` would have passed happily
 * against the broken version, and so would any check on the style attribute:
 * the width was set, it just did not apply to anything.
 */
import { test, expect } from '@playwright/test';
import { login } from './helpers';

/** Put the stub's re-run credit back, so each test starts from a known state.
 *
 * `rerunCredits` is one number for the whole dev server and the stub decrements
 * it on every re-run, so the second test in a file finds no credit and the chip
 * is never offered. That is the same shared-server trap `/api/dev/tokens` was
 * added for — and it is the endpoint that resets this too. */
async function reset(page: import('@playwright/test').Page) {
  await page.request.post('/api/dev/tokens');
}

/** Ask something that makes the stub offer a re-run, then accept it. */
async function startARerun(page: import('@playwright/test').Page, question: string) {
  await reset(page);
  await page.goto('/app/chat');
  await page.locator('.composer textarea, .composer input[type="text"]').first().fill(question);
  await page.keyboard.press('Enter');

  // The offer, then the confirmation behind it: the model proposes, the person
  // disposes. One tap would let a mis-tap spend somebody's day.
  const offer = page.locator('.rerun .suggest');
  await expect(offer).toBeVisible({ timeout: 15_000 });
  await offer.click();
  await page.locator('.rerun__actions .btn--primary').click();
}

test('the bar under a running re-run is actually drawn', async ({ page }) => {
  await login(page);
  await startARerun(page, 'are there any new jobs since last time?');

  const track = page.locator('.rerun__running .meter');
  await expect(track).toBeVisible({ timeout: 15_000 });

  const fill = track.locator('i');
  await expect(fill).toHaveCount(1, { timeout: 10_000 });

  /* THE assertion. The broken version rendered an element of zero width inside
     a visible track, which looks exactly like a bar that has not started. */
  const box = await fill.boundingBox();
  expect(box, 'the fill has no box at all').not.toBeNull();
  expect(box!.width, 'the fill drew nothing inside the track').toBeGreaterThan(0);
  expect(box!.height, 'the fill has no height, so it is still inline').toBeGreaterThan(0);
});

test('the bar reports its value to assistive tech as well as visually', async ({ page }) => {
  await login(page);
  await startARerun(page, 'are there any new jobs since last time?');

  const bar = page.locator('.rerun__running [role="progressbar"]');
  await expect(bar).toBeVisible({ timeout: 15_000 });
  await expect(bar).toHaveAttribute('aria-valuenow', /\d+/);
});

test('the running copy names the stage rather than always saying matching', async ({ page }) => {
  /* One sentence covered all three stages, so asking for courses said "re-running
     your matching" — which is the wrong thing AND the expensive-sounding one. */
  await login(page);
  await startARerun(page, 'can you find me new courses?');

  await expect(page.locator('.rerun__note')).toContainText(/course/i, { timeout: 15_000 });
});

test('the offer names what it will run and what that costs', async ({ page }) => {
  await login(page);
  await reset(page);
  await page.goto('/app/chat');
  await page.locator('.composer textarea, .composer input[type="text"]').first()
    .fill('can you find me new courses?');
  await page.keyboard.press('Enter');

  const offer = page.locator('.rerun .suggest');
  await expect(offer).toBeVisible({ timeout: 15_000 });
  await expect(offer).toContainText(/course/i);

  await offer.click();
  /* 2, not 19. The chip read `usage.prices.documentReread` for every stage until
     the stages existed, which overstates a course refresh nine times over. */
  await expect(page.locator('.rerun__cost')).toContainText('2');
});

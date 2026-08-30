/**
 * The dashboard has to cheer when a run actually moved the score.
 *
 * Reported 2026-08-30 as "there should be a celebration animation once it
 * finishes, where is it?" — and it was built: `components/Celebrate.tsx`, the
 * confetti, the counting ring, the sentence. What was missing is that it was
 * ARMED in exactly one place, `state/update.tsx`, the "Your journey is a step
 * behind" banner. Hud's re-run chip runs the very same engine through the very
 * same `runAgents`, spends the same tokens, and moves the same score — and
 * never armed it. So the expensive path finished in silence.
 *
 * A class name is not what fails here, so these assert the RENDERED outcome
 * after a full run rather than any internal flag: the person runs the thing
 * from the chat, walks to the dashboard, and either the page says the score
 * moved or the feature does not exist for them.
 *
 * The second test is the honest half. A courses refresh runs Agent E alone,
 * which rewrites recommendations and computes no gap, so readiness genuinely
 * does not move — and a celebration there would be the product congratulating
 * somebody for nothing. Both directions, because the whole design of
 * `lib/celebrate.ts` is that the number has to have TRAVELLED.
 */
import { test, expect, type Page } from '@playwright/test';
import { login, ACCOUNTS } from './helpers';

/** Put the account back to a known score and a known budget.
 *
 * `readinessGain` only ever climbs and is capped at 100, so without this a
 * suite that re-runs the matching a few times against one dev server pins the
 * score at the ceiling — where it stops moving and the celebration stops
 * firing for a reason that has nothing to do with the code under test. */
async function reset(page: Page) {
  await page.request.post('/api/dev/tokens');
}

/** Land on the dashboard and wait for the score to be on screen.
 *
 * THE WAIT IS THE POINT, not politeness. The celebration is a comparison
 * against the readiness this browser last SAW, and "last saw" is recorded by
 * the dashboard's own effect once the number renders. Navigating away before
 * that leaves nothing to travel from, and `takeCelebration` correctly returns
 * null — which would look exactly like the bug being tested. */
async function seeDashboard(page: Page) {
  await page.goto('/app/dashboard');
  await expect(page.locator('.readiness').first()).toBeVisible({ timeout: 20_000 });
}

/** Ask Hud for something, accept the offer, and wait for the run to land. */
async function rerunFromChat(page: Page, question: string) {
  await page.goto('/app/chat');
  await page.locator('.composer textarea, .composer input[type="text"]').first().fill(question);
  await page.keyboard.press('Enter');

  const offer = page.locator('.rerun .suggest');
  await expect(offer).toBeVisible({ timeout: 15_000 });
  await offer.click();
  await page.locator('.rerun__actions .btn--primary').click();

  // The meter appears while it runs and detaches when the server says done.
  const running = page.locator('.rerun__running');
  await expect(running).toBeVisible({ timeout: 15_000 });
  await expect(running).toBeHidden({ timeout: 45_000 });
}

test('a re-run started from Hud is celebrated on the dashboard', async ({ page }) => {
  await login(page, ACCOUNTS.celebrant);
  await reset(page);

  await seeDashboard(page);                       // records what they last saw
  await rerunFromChat(page, 'are there any new jobs since last time?');
  await seeDashboard(page);

  /* THE assertion. Before the fix this page was byte-identical to the one
     above: the run had happened, the score had moved, and nothing said so. */
  await expect(page.locator('.celebrate')).toBeVisible({ timeout: 20_000 });
});

test('a second visit does not cheer again', async ({ page }) => {
  /* The celebration reports an EVENT, not a state. Firing on every load would
     turn a real improvement into decoration, which is the thing
     `lib/celebrate.ts` consumes the mark to prevent. */
  await login(page, ACCOUNTS.celebrant);
  await reset(page);

  await seeDashboard(page);
  await rerunFromChat(page, 'are there any new jobs since last time?');
  await seeDashboard(page);
  await expect(page.locator('.celebrate')).toBeVisible({ timeout: 20_000 });

  await seeDashboard(page);
  await expect(page.locator('.celebrate')).toHaveCount(0);
});

test('a courses refresh does not fake a celebration', async ({ page }) => {
  /* Agent E alone rewrites recommendations and computes no gap, so readiness
     does not move — and the page must say nothing rather than congratulate
     somebody for a number that stayed where it was. */
  await login(page, ACCOUNTS.celebrant);
  await reset(page);

  await seeDashboard(page);
  await rerunFromChat(page, 'can you find me new courses?');
  await seeDashboard(page);

  await expect(page.locator('.celebrate')).toHaveCount(0);
});

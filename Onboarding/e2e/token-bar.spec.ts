/**
 * One bar, and it moves by what the action actually costs.
 *
 * WHY THIS IS AN E2E TEST AND NOT A UNIT TEST. The failure it exists to catch
 * shipped to production and no test saw it: `rescans` and `messages` became
 * aliases of one token pool, and the two screens that draw a meter went on
 * drawing two — the same number under two labels, with a 19-token document
 * re-read moving the one captioned "Messages with Hud". Every piece of that was
 * individually correct. Only the rendered screen was wrong, so only something
 * that looks at the rendered screen can defend it.
 *
 * The second assertion is the one that carries the file: the bar must move by
 * the PUBLISHED PRICE. A meter that moves by one whatever you did would look
 * completely healthy and quietly misdescribe the budget.
 */
import { test, expect } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

test.describe('the token bar', () => {
  test('draws ONE meter, and only on the screen that owns it', async ({ page }) => {
    await login(page);

    /* `settings`, not `profile`: "Your AI usage" moved there when the profile
       screen split in two. TWO was the bug this file exists for, and it was
       visible on more than one screen rather than only the one anybody would
       have thought to check. */
    await page.goto('/app/settings');
    await expect(page.locator('.usage')).toHaveCount(1);
    await expect(page.locator('.usage__count')).toContainText('30');

    /* NONE on the plan screen, and that is the assertion now. Somebody's own
       consumption beside a price list turns a comparison into a sales screen,
       so the meter was removed from it entirely — leaving one meter in the
       whole app, which is the strongest form of the rule this file defends. */
    await page.goto('/app/plan');
    await expect(page.locator('.usage')).toHaveCount(0);
  });

  test('the settings bar carries the price list, and the plan screen no longer does', async ({ page }) => {
    await login(page);

    // The reason a bar is worth drawing: "29 left" of what, costing what? Both
    // figures come from the server, not from the bundle.
    await page.goto('/app/settings');
    await expect(page.locator('.usage')).toContainText('19');

    /* The plan screen used to repeat the token prices in a note under the
       table. That note went with the meter: the prices are one screen's
       business now, and the comparison sells what the tiers include rather
       than what each action costs. */
    await page.goto('/app/plan');
    await expect(page.locator('main')).not.toContainText('19');
  });

  test('the plan table sells what the budget actually buys', async ({ page }) => {
    await login(page);
    await page.goto('/app/plan');

    // 30 tokens buys 30 messages or ONE 19-token re-read; 90 buys 90 or FOUR.
    // Floored, never rounded — 90/19 is 4.7 and a fifth re-read cannot be paid
    // for. These used to be four hard-coded numbers, two of which went on
    // selling a weekly rescan allowance that no longer existed.
    const rows = page.locator('.tiers tbody tr');
    await expect(rows.filter({ hasText: 'Messages' })).toContainText('30');
    await expect(rows.filter({ hasText: 'Messages' })).toContainText('90');
    const reread = rows.filter({ hasText: 're-read' });
    await expect(reread).toContainText('1');
    await expect(reread).toContainText('4');
  });

  test('the bar moves by the price of the thing you did', async ({ page }) => {
    // The one account nothing else logs into: this test spends, and the stub's
    // counter is shared across the whole suite.
    await login(page, ACCOUNTS.spender);

    /* START FROM ZERO. The suite runs this spec once PER BROWSER PROJECT
       against one dev server, and one pass costs 20 of a 30-token budget — so
       from the second project on, the re-read met a 429 and spent nothing.
       That is precisely how this passed on chromium and failed on firefox,
       webkit and both mobile projects. The reset makes each project's run
       independent of how many ran before it. */
    await page.request.post('/api/dev/tokens');

    /* DELTAS, NOT ABSOLUTE COUNTS. The stub holds its counter in memory for the
       life of the dev server, which every spec shares — asserting "used == 1"
       makes this test a report on whatever ran before it. What the budget
       actually claims is that a spend moves the pool BY the published price,
       and a delta says exactly that whatever the starting point. */
    const used = async () => (await (await page.request.get('/api/usage')).json()).tokens.used;

    const start = await used();
    await page.request.post('/api/chat/ask', {
      multipart: { question: 'what should I learn first?' },
    });
    const afterMessage = await used();
    expect(afterMessage - start, 'a message costs 1').toBe(1);

    /* THE THREE STAGES, EACH AT ITS OWN PRICE. This is the assertion that would
       fail against a stub charging one number for everything — and it very
       nearly was that stub, because every re-run was charged the re-read's 19
       until 2026-08-29 including the one that reads no documents.

       `mode` is explicit now. Asking for nothing gets a match, which costs 5,
       and a test that then asserts 19 is asserting the overcharge. */
    await page.request.post('/api/assistant/rerun',
      { multipart: { confirm: 'true', mode: 'courses' } });
    const afterCourses = await used();
    expect(afterCourses - afterMessage, 'a course refresh costs 2').toBe(2);

    await page.request.post('/api/assistant/rerun',
      { multipart: { confirm: 'true', mode: 'match' } });
    const afterMatch = await used();
    expect(afterMatch - afterCourses, 'a re-match costs 5').toBe(5);

    await page.request.post('/api/assistant/rerun',
      { multipart: { confirm: 'true', mode: 'full' } });
    const afterReread = await used();
    expect(afterReread - afterMatch, 'a re-read costs 19').toBe(19);

    // And the number the person actually sees is the one the server holds.
    await page.goto('/app/settings');
    await expect(page.locator('.usage__count')).toContainText(String(afterReread));
  });
});

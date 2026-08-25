/**
 * One bar, and it moves by what the action actually costs.
 *
 * WHY THIS IS AN E2E TEST AND NOT A UNIT TEST. The failure it exists to catch
 * shipped to production and no test saw it: `rescans` and `messages` became
 * aliases of one token pool, and the profile and plan screens went on drawing
 * two meters — the same number under two labels, with a 19-token document
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
  test('draws ONE meter, on both screens that show one', async ({ page }) => {
    await login(page);

    for (const screen of ['plan', 'profile']) {
      await page.goto(`/app/${screen}`);
      // TWO was the bug, and it was visible on both screens rather than only
      // the one anybody would have thought to check.
      await expect(page.locator('.usage'), screen).toHaveCount(1);
      await expect(page.locator('.usage__count'), screen).toContainText('30');
    }
  });

  test('the profile bar carries the price list, and the plan bar does not', async ({ page }) => {
    await login(page);

    // The reason a bar is worth drawing: "29 left" of what, costing what? Both
    // figures come from the server, not from the bundle.
    await page.goto('/app/profile');
    await expect(page.locator('.usage')).toContainText('19');

    // The plan screen states the same prices under its comparison table, so
    // the meter one card below must not repeat them.
    await page.goto('/app/plan');
    await expect(page.locator('.usage')).not.toContainText('19');
    await expect(page.locator('.tiers + p, .tiers ~ p').first()).toContainText('19');
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
    // counter is shared across a fully-parallel suite.
    await login(page, ACCOUNTS.spender);

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

    // 19, not 1. This is the assertion that would fail against a stub charging
    // one token for everything, and the only interesting thing the budget does.
    await page.request.post('/api/assistant/rerun', { multipart: { confirm: 'true' } });
    const afterReread = await used();
    expect(afterReread - afterMessage, 'a re-read costs 19').toBe(19);

    // And the number the person actually sees is the one the server holds.
    await page.goto('/app/profile');
    await expect(page.locator('.usage__count')).toContainText(String(afterReread));
  });
});

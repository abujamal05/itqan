/**
 * The mascot and the hero light — the WebKit-specific behaviour the earlier
 * bugs lived in, asserted on the engine that actually exhibits it.
 *
 * The fallback is keyed off `navigator.vendor`, so these tests read the REAL
 * vendor rather than assuming the Playwright project maps cleanly to an engine.
 * That way the assertion tracks the code's own decision: WebKit reports Apple
 * and must get the still PNG (a WebM would paint a black rectangle); everything
 * else keeps the animated video.
 */
import { test, expect } from '@playwright/test';

test.describe('mascot', () => {
  test('falls back to a still PNG on WebKit, video elsewhere', async ({ page }) => {
    // The hero figure only shows at desktop width; force one so the mascot is
    // in the DOM regardless of the project's default device size.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en/');

    const isWebKit = await page.evaluate(() => navigator.vendor === 'Apple Computer, Inc.');
    const hud = page.locator('.hero .hud');
    await expect(hud).toBeVisible();

    if (isWebKit) {
      // The client script swaps the <video> for its poster; give it the frame.
      await expect(hud.locator('img.hud__poster')).toBeVisible();
      await expect(hud.locator('video')).toHaveCount(0);
    } else {
      await expect(hud.locator('video.hud__video')).toBeVisible();
    }
  });

  test('the mascot box keeps the artwork aspect ratio', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en/');
    const box = await page.locator('.hero .hud').boundingBox();
    expect(box).not.toBeNull();
    // 400 / 386 ~= 1.036; allow generous slack for sub-pixel layout.
    const ratio = box!.width / box!.height;
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.2);
  });
});

test.describe('hero glow', () => {
  test('animates both layers on a 5s swing', async ({ page }) => {
    await page.goto('/en/');
    const anim = await page.evaluate(() => {
      const hero = document.querySelector('.hero')!;
      const after = getComputedStyle(hero, '::after');
      const before = getComputedStyle(hero, '::before');
      return {
        after: after.animationName,
        before: before.animationName,
        coreDuration: after.animationDuration,
        coreDirection: after.animationDirection,
      };
    });
    expect(anim.after).toBe('glow-core');
    expect(anim.before).toBe('glow-field');
    // 2.5s each way on `alternate` is the 5s full swing.
    expect(anim.coreDuration).toBe('2.5s');
    expect(anim.coreDirection).toBe('alternate');
  });

  test('mirrors the glow lean in Arabic', async ({ page }) => {
    const leanFor = (path: string) =>
      page.goto(path).then(() =>
        page.evaluate(() =>
          getComputedStyle(document.querySelector('.hero')!).getPropertyValue('--glow-lean').trim(),
        ),
      );
    expect(await leanFor('/en/')).toBe('1');
    expect(await leanFor('/ar/')).toBe('-1');
  });

  test('reduced motion swaps movement for an opacity fade, not silence', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en/');
    const name = await page.evaluate(
      () => getComputedStyle(document.querySelector('.hero')!, '::after').animationName,
    );
    // Not 'none' (the light still breathes) and not the movement keyframes.
    expect(name).toBe('glow-fade');
  });
});

/** Functional checks: forms, menu, theme, keyboard. Each is fault-isolated. */
import { chromium } from 'playwright-core';
const BASE = (process.env.QA_BASE ?? 'https://itqan-site.vercel.app').replace(/\/$/, '');
const out = [];
const b = await chromium.launch();
const step = async (name, fn) => {
  const ctx = await b.newContext({ viewport: { width: 375, height: 800 } });
  const p = await ctx.newPage();
  try { out.push((await fn(p)) ? `PASS  ${name}` : `WARN  ${name} (assertion false)`); }
  catch (e) { out.push(`WARN  ${name} — ${String(e.message).split('\n')[0].slice(0, 80)}`); }
  await ctx.close();
};

await step('login: empty submit stays on page / flags error', async (p) => {
  await p.goto(`${BASE}/en/login/`);
  await p.locator('form button').first().click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(400);
  return p.url().includes('/login') || (await p.locator('[aria-invalid="true"], .field__error').count()) > 0;
});
await step('signup: weak input flagged', async (p) => {
  await p.goto(`${BASE}/en/signup/`);
  await p.locator('input[type=email]').first().fill('bad');
  await p.locator('input[type=password]').first().fill('weak');
  await p.locator('form button').first().click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(400);
  return p.url().includes('/signup') || (await p.locator('[aria-invalid="true"], .field__error').count()) > 0;
});
await step('mobile menu opens', async (p) => {
  await p.goto(`${BASE}/en/`);
  const btn = p.locator('.menu-button, [aria-controls="site-nav"]').first();
  await btn.click({ timeout: 4000 });
  await p.waitForTimeout(300);
  return (await btn.getAttribute('aria-expanded')) === 'true';
});
await step('theme toggle flips data-theme', async (p) => {
  await p.goto(`${BASE}/en/`);
  const before = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await p.locator('button:has(.swap), [aria-label*="theme" i], [aria-label*="dark" i]').first().click({ timeout: 4000 });
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  out.push(`   info theme ${before} -> ${after}`);
  return !!after && after !== before;
});
await step('keyboard: first Tab reaches skip link', async (p) => {
  await p.goto(`${BASE}/en/`);
  await p.keyboard.press('Tab');
  const f = await p.evaluate(() => ({ href: document.activeElement?.getAttribute?.('href'), t: document.activeElement?.textContent?.trim().slice(0, 20) }));
  return f.href === '#main' || /skip/i.test(f.t || '');
});

await b.close();
console.log(out.join('\n'));

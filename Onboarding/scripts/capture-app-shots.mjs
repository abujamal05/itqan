/**
 * Capture real product screens for the marketing site's illustrations.
 *
 * The site used to render grey "Illustration: ..." placeholder boxes. Those are
 * the clearest tell that a marketing page has nothing to show, on a product
 * whose entire pitch is "we show our working". These are the actual app, driven
 * with a seeded account, so the site shows the thing it is describing.
 *
 * Run from Onboarding/ with the dev server already up on 4333:
 *   node scripts/capture-app-shots.mjs
 *
 * Output lands in ../itqan-website/public/app/. Re-run after any app redesign;
 * a stale screenshot is worse than none, because it advertises a UI that no
 * longer exists.
 *
 * Two accounts, because the shots come from two different states:
 *   nasser@itqan.test — already onboarded, so /dashboard, /jobs and /courses
 *                       are populated.
 *   new@itqan.test    — never onboarded, the ONLY way to reach the upload
 *                       screen and the questions. It must stay un-onboarded;
 *                       e2e/onboarding.spec.ts depends on that too, so this
 *                       script resets its progress rather than leaving it part
 *                       way through a flow.
 */
import { chromium } from '@playwright/test';
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../itqan-website/public/app');

/* sharp belongs to the WEBSITE, which is where these images are consumed and
   where the build already depends on it. Resolving it from there keeps this
   script dependency-free rather than installing a second copy into the app. */
const sharp = createRequire(path.join(OUT, 'noop.js'))('sharp');

const BASE = process.env.APP_BASE ?? 'http://localhost:4333';
const PASSWORD = 'itqan1234';
const VIEW = { width: 1200, height: 900 };

const login = async (context, email) => {
  const res = await context.request.post(`${BASE}/api/placeholder/login`, {
    multipart: { email, password: PASSWORD },
    headers: { referer: `${BASE}/en/login/` },
  });
  if (res.status() !== 200) {
    throw new Error(`login(${email}) failed: ${res.status()} — is the dev server up on ${BASE}?`);
  }
};

/** Settle the entrance animations, then write webp and drop the intermediate PNG. */
const shoot = async (page, slug) => {
  await page.waitForTimeout(1200);
  const png = path.join(OUT, `${slug}.png`);
  const webp = path.join(OUT, `${slug}.webp`);
  await page.screenshot({ path: png });
  await sharp(png).webp({ quality: 82 }).toFile(webp);
  await rm(png);
  console.log(`  ${slug.padEnd(22)} -> ${webp}`);
};

const run = async () => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();

  /* ---- Onboarded: the populated screens ---- */
  {
    const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: VIEW });
    await login(ctx, 'nasser@itqan.test');
    const page = await ctx.newPage();
    for (const [slug, route] of [
      ['dashboard', '/app/dashboard'],
      ['jobs', '/app/jobs'],
      ['courses', '/app/courses'],
    ]) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await shoot(page, slug);
    }
    await ctx.close();
  }

  /* ---- Un-onboarded: upload, and the question about the target role ---- */
  {
    const ctx = await browser.newContext({ deviceScaleFactor: 2, viewport: VIEW });
    await login(ctx, 'new@itqan.test');
    await ctx.request.delete(`${BASE}/api/onboarding/progress`);
    const page = await ctx.newPage();

    await page.goto(`${BASE}/app/upload`, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Add your documents' }).waitFor();
    await shoot(page, 'upload');

    // Walk into the questions. The role question is third, so the two before it
    // are answered to get there; the flow is the product's, not a mock of it.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'cv.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 itqan shot fixture'),
    });
    await page.locator('.doc').first().waitFor();
    const cta = page.getByRole('button', { name: 'Read my documents' });
    await cta.waitFor({ state: 'visible' });
    await cta.click();

    await page.waitForURL(/\/app\/questions/);
    for (let i = 0; i < 2; i += 1) {
      await page.locator('.choice').first().waitFor();
      await page.locator('.choice').first().click();
      await page.waitForTimeout(500);
    }
    await page.locator('.choice').first().waitFor();
    await shoot(page, 'questions-role');

    /* The confirmation screen. This is the one the marketing site's /proof page
       is built on: it shows every extracted value with its own confidence, and
       the run is genuinely paused behind it. Answer out the remaining questions
       and wait for the pipeline to reach awaiting_confirmation. */
    for (let i = 0; i < 4; i += 1) {
      const choice = page.locator('.choice').first();
      if (await choice.count()) {
        await choice.click();
        await page.waitForTimeout(400);
        continue;
      }
      const skip = page.getByRole('button', { name: /Skip/i }).first();
      if (await skip.count()) {
        await skip.click();
        await page.waitForTimeout(400);
      }
    }
    try {
      await page.waitForURL(/\/app\/confirm/, { timeout: 25000 });
      await page.locator('.card, .confirm, main').first().waitFor();
      await shoot(page, 'confirm');
    } catch {
      console.log('  confirm               -> SKIPPED (pipeline did not reach awaiting_confirmation)');
    }

    // Leave the fixture account exactly as the e2e suite expects to find it.
    await ctx.request.delete(`${BASE}/api/onboarding/progress`);
    await ctx.close();
  }

  await browser.close();
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

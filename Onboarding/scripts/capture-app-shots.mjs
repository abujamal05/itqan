/**
 * Capture real product screens for the marketing site's illustrations.
 *
 * The site used to render grey "Illustration: ..." placeholder boxes. Those are
 * the single clearest tell that a marketing page has nothing to show, on a
 * product whose entire pitch is "we show our working". These are the actual app,
 * logged in as a seeded account, so the site shows the thing it is describing.
 *
 * Run from Onboarding/ with the dev server already up on 4333:
 *   node scripts/capture-app-shots.mjs
 *
 * Output lands in ../itqan-website/public/app/. Re-run after any app redesign;
 * a stale screenshot is worse than none, because it advertises a UI that no
 * longer exists.
 */
import { chromium } from '@playwright/test';
import { mkdir, rm } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '../../itqan-website/public/app');

const BASE = process.env.APP_BASE ?? 'http://localhost:4333';
const EMAIL = 'nasser@itqan.test';
const PASSWORD = 'itqan1234';

/* Deliberately taller than wide on the two card screens: they are shown on the
   site inside a device-ish frame, and a wide crop of a card grid reads as a
   screenshot of nothing in particular. */
const SHOTS = [
  { slug: 'dashboard', path: '/app/dashboard', width: 1200, height: 900 },
  { slug: 'jobs', path: '/app/jobs', width: 1200, height: 900 },
  { slug: 'courses', path: '/app/courses', width: 1200, height: 900 },
  { slug: 'dashboard-mobile', path: '/app/dashboard', width: 420, height: 860 },
];

const run = async () => {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 2 });

  /* Log in through the API rather than the form: one origin in dev, so the
     session cookie the site sets is the one the app reads back. */
  const res = await context.request.post(`${BASE}/api/placeholder/login`, {
    multipart: { email: EMAIL, password: PASSWORD },
    headers: { referer: `${BASE}/en/login/` },
  });
  if (res.status() !== 200) {
    throw new Error(`login failed: ${res.status()} — is the dev server up on ${BASE}?`);
  }

  const page = await context.newPage();

  for (const shot of SHOTS) {
    await page.setViewportSize({ width: shot.width, height: shot.height });
    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' });

    /* The mascot clips and the reveal animations both settle within a beat.
       Capturing before they do produces a half-faded screen. */
    await page.waitForTimeout(1200);

    /* PNG first because Playwright writes PNG, then straight to webp: these are
       hero-sized images on a static marketing site and a 460KB PNG is most of a
       page's weight on its own. The PNG is deleted, only the webp is committed. */
    const png = path.join(OUT, `${shot.slug}.png`);
    const webp = path.join(OUT, `${shot.slug}.webp`);
    await page.screenshot({ path: png });
    await sharp(png).webp({ quality: 82 }).toFile(webp);
    await rm(png);
    console.log(`  ${shot.slug.padEnd(20)} ${shot.width}x${shot.height}  ->  ${webp}`);
  }

  await browser.close();
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

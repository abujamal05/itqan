/**
 * Lighthouse reports for Itqan — performance, accessibility, SEO and
 * best-practices, for the marketing site AND the signed-in app.
 *
 * Audits the same one-origin dev server the E2E suite uses (localhost:4333):
 * the site is served at `/`, the app under `/app/`. Public pages audit
 * directly; the app dashboard is behind auth, so this logs in first and passes
 * the session cookie into the Lighthouse run.
 *
 * Chrome: uses a real system Chrome when one is installed (more representative),
 * and falls back to the Chromium that Playwright already downloaded, so no
 * separate browser install is needed. Override with CHROME_PATH.
 *
 * Usage (dev server must be running):
 *   npm run e2e:serve        # in one terminal — builds the site, serves :4333
 *   npm run lighthouse       # in another
 *
 * Env: LH_BASE_URL (default http://localhost:4333), LH_ONLY=home-en,app-dashboard
 * to limit targets, CHROME_PATH to force a browser binary.
 */
import fs from 'node:fs';
import path from 'node:path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const BASE = (process.env.LH_BASE_URL ?? 'http://localhost:4333').replace(/\/$/, '');
const OUT = path.resolve(process.cwd(), 'lighthouse-reports');
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];
const PASSWORD = 'itqan1234';

/** Public pages need no auth; the app dashboard rides in on a session cookie. */
const ALL_TARGETS = [
  { name: 'home-en', url: '/en/' },
  { name: 'home-ar', url: '/ar/' },
  { name: 'how-it-works-en', url: '/en/how-it-works/' },
  { name: 'proof-en', url: '/en/proof/' },
  { name: 'login-en', url: '/en/login/' },
  { name: 'signup-en', url: '/en/signup/' },
  { name: 'app-dashboard', url: '/app/dashboard', auth: 'nasser@itqan.test' },
];

const only = process.env.LH_ONLY?.split(',').map((s) => s.trim()).filter(Boolean);
const TARGETS = only ? ALL_TARGETS.filter((t) => only.includes(t.name)) : ALL_TARGETS;

/** Resolve a Chrome/Chromium binary: env override, a system install, else Playwright's. */
async function resolveChromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  try {
    if (chromeLauncher.Launcher.getInstallations().length) return undefined; // let chrome-launcher pick
  } catch { /* fall through */ }
  const { chromium } = await import('playwright-core');
  return chromium.executablePath();
}

/** Log in through the site's own endpoint and return a Cookie header string. */
async function sessionCookie(email, locale = 'en') {
  const body = new FormData();
  body.set('email', email);
  body.set('password', PASSWORD);
  const res = await fetch(`${BASE}/api/placeholder/login`, {
    method: 'POST',
    body,
    // The endpoint reads the referer to stamp the locale cookie.
    headers: { referer: `${BASE}/${locale}/login/` },
    redirect: 'manual',
  });
  if (res.status !== 200) throw new Error(`login failed for ${email}: HTTP ${res.status}`);
  const jar = res.headers.getSetCookie?.() ?? [];
  const pairs = jar.map((c) => c.split(';')[0]).filter(Boolean);
  if (!pairs.some((p) => p.startsWith('itqan_session='))) {
    throw new Error('login returned no session cookie');
  }
  // Ensure the app renders in the requested language too.
  if (!pairs.some((p) => p.startsWith('itqan_locale='))) pairs.push(`itqan_locale=${locale}`);
  return pairs.join('; ');
}

async function ensureServerUp() {
  try {
    const res = await fetch(`${BASE}/en/`, { redirect: 'manual' });
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error(
      `\nCannot reach ${BASE}. Start the dev server first, e.g.\n` +
      `  npm run e2e:serve   (builds the site, serves site + app on :4333)\n` +
      `or point LH_BASE_URL at a running server.\n\nUnderlying error: ${err.message}\n`,
    );
    process.exit(1);
  }
}

function scoreCell(n) {
  const s = n == null ? ' n/a' : String(n).padStart(3, ' ');
  return `${s}`;
}

async function main() {
  await ensureServerUp();
  fs.mkdirSync(OUT, { recursive: true });

  const chromePath = await resolveChromePath();
  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const summary = [];
  try {
    for (const target of TARGETS) {
      const flags = {
        port: chrome.port,
        output: ['html', 'json'],
        onlyCategories: CATEGORIES,
        logLevel: 'error',
      };
      if (target.auth) {
        flags.extraHeaders = { Cookie: await sessionCookie(target.auth) };
      }

      process.stdout.write(`Auditing ${target.name.padEnd(18)} ${target.url} … `);
      const result = await lighthouse(`${BASE}${target.url}`, flags);
      if (!result) throw new Error(`no result for ${target.url}`);

      const [html, json] = result.report;
      fs.writeFileSync(path.join(OUT, `${target.name}.html`), html);
      fs.writeFileSync(path.join(OUT, `${target.name}.json`), json);

      const row = { name: target.name };
      for (const c of CATEGORIES) {
        const score = result.lhr.categories[c]?.score;
        row[c] = score == null ? null : Math.round(score * 100);
      }
      summary.push(row);
      console.log('done');
    }
  } finally {
    // On Windows chrome-launcher's temp-profile cleanup can throw EPERM because
    // Chrome has not released the directory handle yet. The audit is already
    // done and the reports are written, so a failed cleanup must not fail the
    // run — the OS reclaims its own temp dir later.
    try {
      await chrome.kill();
    } catch (err) {
      if (err?.code !== 'EPERM') throw err;
    }
  }

  // Score table (0–100; Lighthouse's own thresholds: >=90 good, 50–89 average).
  const head = ['page'.padEnd(18), 'perf', ' a11y', 'best', '  seo'].join(' ');
  console.log(`\n${head}`);
  console.log('-'.repeat(head.length));
  for (const r of summary) {
    console.log([
      r.name.padEnd(18),
      scoreCell(r.performance),
      scoreCell(r.accessibility),
      scoreCell(r['best-practices']),
      scoreCell(r.seo),
    ].join('  '));
  }
  console.log(`\nReports written to ${path.relative(process.cwd(), OUT)}/ (HTML + JSON per page).`);
}

main().catch((err) => {
  console.error('\nLighthouse run failed:', err);
  process.exit(1);
});

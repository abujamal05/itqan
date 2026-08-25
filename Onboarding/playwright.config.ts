/**
 * Cross-browser end-to-end tests for both halves of Itqan.
 *
 * The suite runs against the SAME one-origin dev server the product uses
 * locally (see README §2): the Onboarding vite server serves the built
 * marketing site at `/`, this app under `/app/`, and every `/api/` endpoint —
 * so one baseURL exercises the site pages, the auth handoff and the app flow
 * without any cross-origin plumbing that only exists in production.
 *
 * The site must be BUILT for the plugin to serve its pages, so `e2e:serve`
 * builds it first and then starts vite on a fixed, strict port. `webServer`
 * below runs that and waits for it; an already-running dev server on the port
 * is reused so a local `npm run dev` session is not fought over.
 *
 * WebKit is not optional here. The whole class of bugs this product hit —
 * the mascot painting a black rectangle, filters banding — is WebKit-only, and
 * `navigator.vendor` is how the code detects it. The `webkit` and
 * `mobile-safari` projects are the only place those code paths are exercised at
 * all, which is exactly why they earn their run time.
 */
import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'node:child_process';
import { firefox } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4333);
const baseURL = `http://localhost:${PORT}`;

/**
 * Firefox stays a first-class target, but some locked-down Windows sandboxes
 * refuse to spawn its binary at all (`spawn UNKNOWN`) while Chromium and WebKit
 * run fine. Rather than fail the whole suite there, probe once and drop only
 * the Firefox project when it genuinely cannot launch. Set E2E_FORCE_FIREFOX=1
 * to skip the probe and require it (use in CI, where it should always work).
 */
function firefoxUsable(): boolean {
  if (process.env.E2E_FORCE_FIREFOX) return true;
  try {
    execSync(`"${firefox.executablePath()}" --version`, { stdio: 'ignore', timeout: 15_000 });
    return true;
  } catch {
    console.warn('[playwright] Firefox cannot launch in this environment — skipping that project.');
    return false;
  }
}

const desktop = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ...(firefoxUsable() ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }] : []),
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
];

export default defineConfig({
  testDir: './e2e',
  /* `webServer.url` below only proves the PORT is open — it points at a static
     page from the site build. `/api/*` and the app's module graph come up after
     it, and workers starting into that gap is what produced the wandering
     "flaky test". See the file for the full account. */
  globalSetup: './e2e/global-setup.ts',
  /* THE SPECS ARE NOT INDEPENDENT, AND THE COMMENT HERE USED TO CLAIM THEY
     WERE. "Each spec is independent, so they parallelise cleanly" was the
     belief that produced a suite failing roughly one run in three on a
     rotating cast of tests, which is why it read as flakiness rather than as
     the shared resource it is.

     What is certain: three spec files drive the same seeded accounts against
     ONE dev server holding account state in memory, and the suite is green
     single-worker and intermittently red parallel. `workers` below is what
     holds the line.

     What is NOT established, and should not be written here as though it were:
     the precise interaction. The failures move around — `/app/jobs` overflow at
     four widths, the first-run intent walk, the plain dashboard entry — and no
     single write has been caught doing it. Left true because file-level
     parallelism is not obviously the culprit and the site specs are genuinely
     stateless. */
  fullyParallel: true,
  // A stray `test.only` left in a commit fails CI rather than silently
  // skipping the rest of the file.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /* ONE WORKER EVERYWHERE, not just in CI.
     CI has always been single-worker and has always been green; local runs took
     the default (half the cores) and were the only place this suite was ever
     flaky. That is the entire difference, and it is worth the wall clock:
     a run that is wrong one time in three is worse than a run that is slower,
     because the first thing a false failure costs is the next hour.
     The real fix is per-worker accounts in `dev/site-plugin.ts` so the specs
     stop sharing `nasser@itqan.test`. Until that exists, this is the honest
     setting. Override with `--workers=N` to reproduce the races deliberately. */
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL,
    // Artifacts only when something fails, so a green run stays cheap.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    ...desktop,
    // Mobile viewports, because the responsiveness work and the mascot fallback
    // both matter most on a phone. Mobile Safari is the real iPhone engine.
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],

  webServer: {
    command: 'npm run e2e:serve',
    url: `${baseURL}/en/`,
    reuseExistingServer: !process.env.CI,
    // The site build plus vite cold start needs headroom.
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

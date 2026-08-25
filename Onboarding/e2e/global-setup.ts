/**
 * Wait until the server is actually ready, not merely listening.
 *
 * WHY THIS EXISTS. `webServer.url` in the config points at `${baseURL}/en/`,
 * and that page is a STATIC FILE the vite plugin serves from the site build. It
 * answers almost the instant the port opens. The two things the tests actually
 * use come up later:
 *
 *   `/api/*`   handled by the plugin's middleware. Requests that arrive before
 *              it is wired do not 404, they are DROPPED — which surfaces as
 *              `apiRequestContext.post: read ECONNRESET` inside `login()`,
 *              attributed to whichever spec happened to go first.
 *   `/app/*`   a SPA whose module graph vite transforms on demand. The first
 *              browser to ask pays for the whole graph, and on a cold server
 *              that is slow enough to eat a 30s test timeout.
 *
 * So Playwright declared the server up and started every worker at once into a
 * window where neither was true. The symptom moved around — one run it was the
 * long onboarding walk timing out, the next a responsive spec dying on
 * ECONNRESET — which is what a readiness race looks like from the outside and
 * is why it read as flakiness in a particular test. It was never that test.
 *
 * Both halves are warmed here, once, before any worker starts.
 *
 * NOT SOLVED BY RAISING TIMEOUTS. A longer timeout would hide the slow-graph
 * case and do nothing at all for the dropped connection, because that fails
 * immediately rather than slowly.
 */
import { chromium, type FullConfig } from '@playwright/test';

/** Generous, because a cold vite server behind a site build is genuinely slow,
 *  and this cost is paid once per run rather than per test. */
const READY_TIMEOUT_MS = 90_000;
const POLL_EVERY_MS = 250;

async function waitForApi(baseURL: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError = 'never attempted';

  while (Date.now() < deadline) {
    try {
      /* ANY http response means the middleware is wired. The status is not
         checked on purpose: `/api/session` answers 401 when signed out, and a
         401 proves the route exists just as well as a 200 does. What is being
         detected is the connection being dropped, not the answer. */
      await fetch(`${baseURL}/api/session`);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
    }
  }

  throw new Error(
    `[global-setup] /api never answered within ${READY_TIMEOUT_MS}ms. `
    + `Last error: ${lastError}`,
  );
}

async function warmAppGraph(baseURL: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    /* `domcontentloaded` rather than `networkidle`: the app opens a session
       request and may retry, so networkidle can wait on something that is not
       coming. The point is to make vite transform the graph, and a rendered
       document means it has. */
    await page.goto(`${baseURL}/app/`, {
      waitUntil: 'domcontentloaded',
      timeout: READY_TIMEOUT_MS,
    });
    /* Signed out, the app redirects to the site's login. Either way the module
       graph is built by now, which is the whole objective — so no assertion
       here, and deliberately none: this is a warm-up, not a test, and failing
       it would report a product bug from the wrong place. */
    await page.waitForTimeout(500);
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL
    ?? `http://localhost:${process.env.E2E_PORT ?? 4333}`;

  const started = Date.now();
  await waitForApi(baseURL);
  await warmAppGraph(baseURL);
  // eslint-disable-next-line no-console -- one line, and it explains a delay.
  console.log(`[global-setup] server ready in ${Date.now() - started}ms`);
}

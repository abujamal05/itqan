/**
 * There is one client, always.
 *
 * There used to be a mock branch here, chosen when no API base URL was set.
 * It is gone: the dev server now serves the real endpoints (see
 * dev/site-plugin.ts), so the app talks HTTP in every environment and there is
 * no second code path that can quietly disagree with the first. That branch
 * had already caused one bug — the mock's session() always returned null, so a
 * user who had just logged in on the site was bounced straight back to it.
 *
 * VITE_API_BASE_URL points at a different gateway when you need one; unset, it
 * is the same origin, which is what makes the site's session cookie readable.
 */
import { createHttpApi } from './http';
import type { ItqanApi } from './types';

export function createApi(): ItqanApi {
  return createHttpApi();
}

export * from './types';

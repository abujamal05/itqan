/**
 * "I came here to buy", carried from the marketing site into the app.
 *
 * Someone who pressed the premium button on `/pricing` signs up, verifies an
 * email, walks the whole onboarding, and by the time it ends they are several
 * screens away from the thing they came for. This remembers the intent across
 * all of it and spends it once, at the end.
 *
 * TWO WAYS IN, because the two halves of the product are separate origins in
 * production and only one of them is reliable today:
 *
 *   Cookie   `itqan_intent=premium`, set by the site on a successful signup.
 *            Crosses when the site and app share a registrable domain, which
 *            is the current deployment, and is what makes this work now.
 *   Query    `?intent=premium` on the app's own URL. Nothing sets this yet —
 *            it needs `/api/handoff` to forward the parameter, which is
 *            BACKEND.md §8. Read here so that when it ships, it just works.
 *
 * SPENT ONCE, AND ONLY FORWARD. It is read into `sessionStorage` and deleted
 * from both carriers immediately, so a cookie left behind by an abandoned
 * signup cannot redirect a different session weeks later, and reloading the
 * plan page does not re-trigger anything. It expires with the tab.
 */
const KEY = 'itqan.intent.upgrade';
const COOKIE = 'itqan_intent';

function readCookie(name: string): string | null {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.split('=')[1] ?? null;
}

/**
 * Move the intent out of its carriers and into this session.
 *
 * Safe to call on every mount: it is a no-op once the carriers are empty, and
 * it never overwrites an intent already captured this session.
 */
export function captureUpgradeIntent(): void {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('intent');
    const fromCookie = readCookie(COOKIE);

    if (fromUrl === 'premium' || fromCookie === 'premium') {
      sessionStorage.setItem(KEY, '1');
    }

    /* Clear both regardless of what was found. A stale cookie is the failure
       mode that matters here: it would send someone to a sales screen they
       never asked for, on a later visit, with no way to explain why. */
    if (fromCookie !== null) {
      document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    }
    if (fromUrl !== null) {
      const url = new URL(window.location.href);
      url.searchParams.delete('intent');
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    /* Private mode, a blocked cookie jar, a locked-down storage partition. An
       intent that cannot be remembered simply is not one; the user lands on the
       normal screen and nothing breaks. */
  }
}

export function hasUpgradeIntent(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Spend it. Call at the moment the redirect actually happens. */
export function clearUpgradeIntent(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch { /* nothing to clear */ }
}

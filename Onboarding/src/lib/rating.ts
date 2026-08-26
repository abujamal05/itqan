/**
 * Whether this person may be asked what they think of Itqan, and when.
 *
 * ASKING AT THE WRONG MOMENT IS WORSE THAN NOT ASKING. Someone halfway through
 * onboarding has not used the product; someone watching their documents being
 * read is waiting on it. A rating collected from either is noise, and the
 * request itself reads as the product interrupting its own first impression.
 *
 * So there are three gates, and all three have to be open:
 *
 *   ONBOARDED — the account has been through the flow, so there is a product to
 *   have an opinion about.
 *
 *   NOT MID-RUN — nothing is being read or matched right now.
 *
 *   USED IN THIS SESSION — they have actually looked at a result. Reaching the
 *   dashboard, the jobs page, the courses page or the chat counts; opening the
 *   app and immediately signing out does not.
 *
 * ASKED ONCE. A rating given is never asked for again. A rating declined is not
 * asked for again either, for a long time — an ignored prompt that returns
 * tomorrow is the pattern that makes people close things without reading them.
 */
const KEY = 'itqan.rating';

/** Long enough that a declined prompt is not a weekly event. */
const ASK_AGAIN_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

interface Mark {
  /** They rated. Never ask again. */
  rated?: boolean;
  /** When they were last asked and said not now. */
  askedAt?: number;
}

type Store = Record<string, Mark>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    /* A malformed store degrades to "never asked", which is the safe
       direction: the worst case is one extra prompt, not a broken screen. */
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Store)
      : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* Private mode, or a full quota. Losing the record risks asking twice,
       which is survivable; throwing here would not be. */
  }
}

/** Which routes mean "still being set up" rather than "using it". */
const FLOW_ROUTES = ['/upload', '/questions', '/confirm'];

/** Which routes count as having seen what the product produced. */
const RESULT_ROUTES = ['/dashboard', '/jobs', '/courses', '/chat'];

export const isFlowRoute = (path: string) => FLOW_ROUTES.some((r) => path.startsWith(r));
export const isResultRoute = (path: string) => RESULT_ROUTES.some((r) => path.startsWith(r));

export function mayAsk(userId: string | undefined, {
  onboarded, running, usedThisSession, path,
}: {
  onboarded: boolean;
  running: boolean;
  usedThisSession: boolean;
  path: string;
}): boolean {
  if (!userId || !onboarded || running || !usedThisSession) return false;
  if (isFlowRoute(path)) return false;

  const mark = read()[userId] ?? {};
  if (mark.rated) return false;
  if (mark.askedAt && Date.now() - mark.askedAt < ASK_AGAIN_AFTER_MS) return false;
  return true;
}

/** They gave one. That is the end of it. */
export function markRated(userId: string): void {
  const store = read();
  store[userId] = { ...store[userId], rated: true };
  write(store);
}

/** They were asked and did not answer. Not again for a long while. */
export function markAsked(userId: string): void {
  const store = read();
  store[userId] = { ...store[userId], askedAt: Date.now() };
  write(store);
}

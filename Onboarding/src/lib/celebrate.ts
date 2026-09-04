/**
 * Knowing that the readiness score MOVED, and by how much.
 *
 * THE NUMBER HAS TO TRAVEL FROM WHAT THE PERSON LAST SAW, and that is the whole
 * reason this exists rather than a boolean. A figure counting up from zero on
 * every page load is a score dressed up to look impressive, which the design
 * system bans outright; a figure travelling once from 72 to 78, after a run the
 * person confirmed and paid for, is reporting a change they caused. Same
 * animation, opposite meaning, and the difference is entirely in where it
 * starts.
 *
 * So two facts are kept per account: the readiness last SHOWN on the dashboard,
 * and whether an update run has finished since. Both are needed — a run alone
 * cannot say what the score was before it, and a remembered score alone cannot
 * tell a real improvement from a page opened twice.
 *
 * LOCAL, AND HONEST ABOUT IT. This is the browser's memory of what it last put
 * on screen, which is exactly the right home for "what did this person last
 * see". The cost is that a run started on a phone is not celebrated on a laptop.
 * BACKEND.md §11 records the server-side version, which would fix that; until
 * then a missed celebration is the failure mode, never a false one.
 */
const KEY = 'itqan.readiness';

/**
 * WHAT THE REMEMBERED NUMBER MEANS. Bump this whenever readiness changes basis.
 *
 * On 2026-09-04 the headline moved from a market average over every retrieved
 * role to a pooling over the three roles the person fits best, which raised a
 * real student from 17 to 26. A baseline recorded under the old basis is not a
 * baseline for the new one: the first run after the deploy would have counted
 * up nine points and congratulated somebody for a change we made. A mark whose
 * basis does not match is re-seeded instead of compared, so the worst case is
 * one missed celebration rather than a false one — the same direction this file
 * already chooses everywhere else.
 */
const BASIS = 'closest-roles-2026-09-04';

interface Mark {
  /** The readiness the dashboard last rendered for this account. */
  seen?: number;
  /** An update run finished and its result has not been shown yet. */
  ran?: boolean;
  /** Which definition of readiness `seen` was recorded under. */
  basis?: string;
}

type Store = Record<string, Mark>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    /* Anything could be under this key — another tab, an older build, a user
       with devtools. A malformed store must degrade to "nothing to celebrate"
       rather than throwing on every dashboard render. */
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
    /* Private mode, or a full quota. Losing a celebration is survivable;
       taking the dashboard down with it is not. */
  }
}

/** An update run finished. The next dashboard view decides what to make of it. */
export function markRunFinished(userId: string): void {
  const store = read();
  store[userId] = { ...store[userId], ran: true };
  write(store);
}

export interface Celebration {
  /** Where the number starts counting from. */
  from: number;
  /** Where it lands, and what it says without any animation at all. */
  to: number;
}

/**
 * Ask, and record, in one call — because both have to happen exactly once.
 *
 * Returns a celebration only when a run finished AND the score is higher than
 * the one this browser last showed. A run that moved nothing is still consumed:
 * the person was told the run was happening, and an offer that stays armed
 * would fire on some unrelated later change.
 */
export function takeCelebration(userId: string, readiness: number): Celebration | null {
  const store = read();
  const mark = store[userId] ?? {};
  /* A number remembered under a different definition of readiness is not
     something this one can be compared against — see BASIS. */
  const comparable = mark.basis === BASIS && typeof mark.seen === 'number';
  const from = comparable ? (mark.seen as number) : readiness;

  const earned = mark.ran === true && readiness > from;
  store[userId] = { seen: readiness, basis: BASIS };
  write(store);

  return earned ? { from, to: readiness } : null;
}

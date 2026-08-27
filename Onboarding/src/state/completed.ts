/**
 * Which courses the user has told us they finished.
 *
 * THE SERVER IS THE TRUTH, and this is the overlay on top of it.
 *
 * It used to be the other way round: completion lived in localStorage and
 * nowhere else, which this file's own docstring called out as temporary until
 * `POST /api/courses/:id/complete` landed. That route landed on 2026-08-24 and
 * the WRITE was wired soon after — but the read never moved, so ticks stayed
 * per-browser. Another device, or cleared site data, and a person's progress
 * was gone. `Course.completedAt` is now published on `GET /api/courses` and is
 * authoritative.
 *
 * It also fixes the case a read alone cannot: Agent E recommends one course per
 * MISSING skill, so closing a gap is exactly what drops its course from the
 * next set. The server keeps returning a finished course with
 * `recommended: false`, which is what makes progress survive a rescan.
 *
 * What remains here is a PENDING-WRITES overlay: the tick has to appear the
 * instant somebody taps, and the list is not re-fetched on every toggle.
 *
 * It is deliberately IN MEMORY rather than in localStorage. A pending write
 * that outlives the page is not pending — it is a second source of truth, which
 * is what went wrong the first time. `markDone` writes to the server
 * immediately and reverts on failure, so nothing needs to survive a reload:
 * after one, the server's own answer is what renders.
 *
 * Three properties this keeps from before, all still true:
 *
 *   It never touches readiness. Marking a course done is a CLAIM, not evidence,
 *   and readiness is evidence-derived. The UI says so and offers the CV
 *   re-upload as the way to make it count.
 *
 *   It never removes a course. Completed courses stay visible, greyed — seeing
 *   what you finished is the progress signal.
 *
 *   It is keyed by user, so a shared machine cannot leak one person's progress
 *   into another's.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Ids whose write is still in flight, and which way it went.
 *
 * `true` = being added, `false` = being removed. A plain set could not express
 * the second, and removal is exactly the case where the server's answer and the
 * user's intent disagree for a moment.
 */
type Pending = Record<string, boolean>;

export function useCompletedCourses(
  userId: string | undefined,
  /**
   * Ids the SERVER says are finished — from `Course.completedAt`.
   *
   * Defaulted so a caller that has not fetched the course list yet still works;
   * it simply has nothing to show as done until it has.
   */
  serverIds: readonly string[] = [],
) {
  const [pending, setPending] = useState<Pending>({});

  // A new user is a new record. Without this, switching accounts on one machine
  // would carry the previous person's in-flight ticks across.
  useEffect(() => { setPending({}); }, [userId]);

  /** Stable across renders, so the effect below does not fire on every fetch. */
  const serverKey = serverIds.join(' ');

  /**
   * Drop pending entries the server has caught up with.
   *
   * Keyed on agreement rather than on a timer: once the server says what the
   * overlay said, the overlay has no work left. Leaving it would mean an
   * un-complete performed elsewhere could never win, because a stale `true`
   * would keep overriding the server for the life of the page.
   */
  useEffect(() => {
    setPending((cur) => {
      if (Object.keys(cur).length === 0) return cur;
      const server = new Set(serverKey ? serverKey.split(' ') : []);
      const next: Pending = {};
      for (const [id, want] of Object.entries(cur)) {
        if (server.has(id) !== want) next[id] = want;
      }
      return Object.keys(next).length === Object.keys(cur).length ? cur : next;
    });
  }, [serverKey]);

  const completed = useMemo(() => {
    const out = new Set(serverKey ? serverKey.split(' ') : []);
    for (const [id, want] of Object.entries(pending)) {
      if (want) out.add(id);
      else out.delete(id);
    }
    return out;
  }, [serverKey, pending]);

  const toggle = useCallback((courseId: string, done: boolean) => {
    if (!userId) return;
    setPending((cur) => ({ ...cur, [courseId]: done }));
  }, [userId]);

  return { completed, toggle };
}

/** The ids a course list says are finished — the argument above. */
export const completedIdsFrom = (
  // `useAsync` yields `null` before its first answer, so null is a real input
  // here rather than a defensive flourish.
  courses: readonly { id: string; completedAt: string | null }[] | null | undefined,
): string[] => (courses ?? []).filter((c) => c.completedAt).map((c) => c.id);

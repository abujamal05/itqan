/**
 * Which courses the user has told us they finished.
 *
 * THIS IS LOCAL AND IT IS NOT THE TRUTH. `POST /api/courses/:id/complete` does
 * not exist yet — it is specified in BACKEND.md — so "Done" cannot be recorded
 * anywhere authoritative. It is kept in localStorage so the path does not
 * forget on reload, which is the difference between a progression map and a
 * toy, and it is keyed by user so a shared machine does not leak one person's
 * progress into another's.
 *
 * Three properties this deliberately has:
 *
 *   It never touches readiness. Marking a course done is a CLAIM, not
 *   evidence, and readiness is evidence-derived. The UI says so and offers the
 *   CV re-upload as the way to make it count. See BACKEND.md §1.
 *
 *   It never removes a course FROM THE MAP. Completed nodes stay there, greyed
 *   and struck through, because seeing what you finished is the progress signal
 *   on the page that is the path. The dashboard's two-card shelf is the one
 *   place that filters them out: it holds two cards, its whole job is "what to
 *   do next", and a finished course spends half that answer on the past.
 *
 *   It is forward-compatible. When the route lands, `Course.completedAt` from
 *   the API becomes authoritative and this becomes a pending-writes cache; the
 *   only thing that changes is where `isComplete` reads from.
 */
import { useCallback, useEffect, useState } from 'react';

const KEY = 'itqan.courses.completed';

type Store = Record<string, string[]>;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    /* Anything could be under this key — another tab, an older build, a user
       with devtools. A malformed store must degrade to "nothing completed"
       rather than throwing on every render of the courses page. */
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
    /* Private mode, or a full quota. Losing the record is survivable; taking
       the page down with it is not. */
  }
}

/** Fires on every change so two mounted views cannot disagree. */
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((fn) => fn());

export function useCompletedCourses(userId: string | undefined) {
  const [ids, setIds] = useState<string[]>(() => (userId ? read()[userId] ?? [] : []));

  useEffect(() => {
    const sync = () => setIds(userId ? read()[userId] ?? [] : []);
    sync();
    listeners.add(sync);
    /* `storage` only fires in OTHER tabs, which is exactly the case the local
       listener set cannot cover. */
    window.addEventListener('storage', sync);
    return () => {
      listeners.delete(sync);
      window.removeEventListener('storage', sync);
    };
  }, [userId]);

  const toggle = useCallback((courseId: string, done: boolean) => {
    if (!userId) return;
    const store = read();
    const cur = new Set(store[userId] ?? []);
    if (done) cur.add(courseId);
    else cur.delete(courseId);
    store[userId] = [...cur];
    write(store);
    announce();
  }, [userId]);

  return { completed: new Set(ids), toggle };
}

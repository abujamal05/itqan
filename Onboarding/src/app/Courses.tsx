/**
 * Courses.
 *
 * NO SUBTITLE. This page used to open with "Itqan earns nothing from these",
 * and an earlier note here called it the most important line on the screen.
 * Removed on request, 2026-08-18, along with the other page subtitles.
 *
 * The commitment behind it has not changed and is not being hidden: the product
 * still refuses affiliate commissions, and the way it is now shown is the way
 * that was always the stronger half — every card states its price up front,
 * including "Free" and "Price not listed", and links to the provider's own
 * page. A cost the user has to hunt for reads as a cost someone hoped they
 * would not notice, so the prices stay prominent. If the claim needs saying in
 * words again, it belongs somewhere it can be substantiated rather than as a
 * heading's caption.
 *
 * Recommended courses sort first, because a list ordered by nothing in
 * particular asks the user to do the ranking the product exists to do.
 *
 * THE PAGE IS A MAP NOW, at every width. The grid is gone: a route is the
 * honest shape for "the shortest path there", and a three-column grid that
 * became one column on a phone was a list claiming to be a plan. What the map
 * cannot hold — the source, the retrieval date, the feedback and replace
 * controls — moved into `CourseSheet`, which opens from any node and renders
 * the same `CourseCard` unchanged. Nothing about a course is implemented twice.
 *
 * The filters survive and reshape the path rather than filtering a list. A
 * route through the free courses only is still a coherent route.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { errorText } from '../lib/errorText';
import { useChat } from '../state/chat';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { useOnboarding } from '../state/onboarding';
import { useRunInFlight } from '../components/PipelineProgress';
import { Card, EmptyState, ErrorState, LoadingBlock } from '../components/ui';
import { CoursesMap } from '../components/map/CoursesMap';
import { CourseSheet } from '../components/map/CourseSheet';
import { useCompletedCourses } from '../state/completed';
import { useAuth } from '../state/auth';
import type { Course } from '../api';
import { BrowseBar } from '../components/BrowseBar';
import type { FilterDef } from '../components/BrowseBar';

type Filter = 'all' | 'free' | 'short' | 'recommended';

export function Courses() {
  const { t, locale, formatNumber } = useI18n();
  // A re-run finishing must be visible here without a manual reload.
  const { resultsVersion } = useChat();
  const api = useApi();
  const { user } = useAuth();
  const { settled } = useOnboarding();
  const [open, setOpen] = useState<Course | null>(null);
  const inFlight = useRunInFlight();
  // Re-fetch when the run lands; see the same note in Dashboard.tsx.
  const { data, loading, error, reload } = useAsync((s) => api.getCourses(s),
                                                   [api, locale, settled, resultsVersion]);
  /* THE SERVER OWNS THIS. `completedAt` comes back on every course, including
     ones nothing recommends any more, so progress survives a rescan and a
     change of device. The hook is now only an overlay for a write still in
     flight — see `state/completed.ts`.

     Declared AFTER `data`, not beside the other hooks: `const` is in its
     temporal dead zone until initialised, so reading `data` above its own
     declaration is a ReferenceError on first render rather than an undefined. */
  const serverCompleted = useMemo(
    () => (data ?? []).filter((c) => c.completedAt).map((c) => c.id),
    [data]);
  const { completed, toggle } = useCompletedCourses(user?.id, serverCompleted);
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<ReactNode>(null);

  /**
   * The list as the USER has it, once they start replacing entries.
   *
   * Null means "no local edits, use the server's list". A local copy rather
   * than a map of overrides, because replacements chain: reject the replacement
   * and the next lookup is keyed on ITS id, which an override map keyed on the
   * original would lose. Reset whenever a fetch lands, so a real refresh is
   * authoritative and does not resurrect a swapped card.
   */
  const [edited, setEdited] = useState<Course[] | null>(null);
  useEffect(() => { setEdited(null); }, [data]);

  const replaceCourse = useCallback((id: string, next: Course) => {
    setEdited((cur) => (cur ?? data ?? []).map((c) => (c.id === id ? next : c)));
    // Said HERE because the card that asked for it has already been unmounted
    // by this swap. BrowseBar's status line is a live region, so this reaches a
    // screen reader without moving focus away from the grid.
    setStatus(t('fb.replaced'));
  }, [data, t]);

  /**
   * Mark a course finished.
   *
   * It does NOT move readiness, and the message says why. Readiness is derived
   * from evidence in the documents; a course the user says they finished is a
   * claim, and quietly raising the score on a claim would make the number mean
   * two different things. The honest offer is the CV re-upload, which turns the
   * claim into evidence — so that is what the status line points at.
   */
  const markDone = useCallback((course: Course) => {
    /* OPTIMISTIC, THEN TOLD TO THE SERVER. The local toggle is what makes the
       map respond immediately; the call is what stops the server disagreeing.
       Until this existed, completion was written to localStorage and nowhere
       else, so `GET /api/dashboard` went on naming a finished course as the
       next step — the map said done, the dashboard said do this next, and both
       were reading their own truth. */
    toggle(course.id, true);
    setStatus(
      <>
        {t('courses.doneNoted')}{' '}
        <Link to="/documents">{t('courses.updateCv')}</Link>
      </>,
    );
    void api.completeCourse(course.id).catch((err: unknown) => {
      /* PUT IT BACK. A failed write that leaves the tick on screen is worse
         than no tick: the person believes the server knows, and it does not. */
      toggle(course.id, false);
      setStatus(errorText(err, { t, formatNumber }, { fallback: t('courses.saveFailed') }));
    });
  }, [toggle, t, api]);

  /**
   * Take it back out of completed.
   *
   * The mirror of `markDone`, and it exists because that one was a one-way
   * door: the button disappeared once tapped, so a mis-tap was permanent. It
   * does not move readiness either — nothing here does — so the message says
   * only what actually happened and does not re-open the CV prompt.
   */
  const markNotDone = useCallback((course: Course) => {
    toggle(course.id, false);
    setStatus(t('courses.undoneNoted'));
    /* Idempotent on the server, per BACKEND.md, so undoing something it never
       recorded is still a success and needs no special case here. */
    void api.uncompleteCourse(course.id).catch((err: unknown) => {
      toggle(course.id, true);
      setStatus(errorText(err, { t, formatNumber }, { fallback: t('courses.saveFailed') }));
    });
  }, [toggle, t, api]);

  const filters: FilterDef<Filter>[] = [
    { id: 'all', label: t('browse.all') },
    { id: 'recommended', label: t('courses.filterRecommended') },
    { id: 'free', label: t('courses.filterFree') },
    { id: 'short', label: t('courses.filterShort') },
  ];

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setStatus(null);
    const before = data?.length ?? 0;
    try {
      const fresh = await api.getCourses();
      const added = Math.max(0, fresh.length - before);
      // Say what was found, including nothing. A silent spinner that stops is
      // indistinguishable from one that failed.
      setStatus(added > 0
        ? t('browse.foundNew', { n: formatNumber(added) })
        : t('browse.nothingNew'));
      reload();
    } catch (err: unknown) {
      setStatus(errorText(err, { t, formatNumber }, { fallback: t('state.errorSub') }));
    } finally {
      setRefreshing(false);
    }
  }, [api, data, reload, t, formatNumber]);

  const shown = useMemo(() => {
    const list = [...(edited ?? data ?? [])];
    const filtered = list.filter((c) => {
      // `priceLabel` too: a freeCodeCamp course states price 0, but the filter
      // must not silently include the 2,001 courses whose price is merely
      // UNKNOWN — null is not free, and this is where that would leak.
      if (filter === 'free') return c.price === 0 || c.priceLabel === 'free';
      // The same trap as `free`, one field over, and it was live: this read
      // `c.hours < 10` while `hours` was null for every course — and in JS
      // `null < 10` is TRUE, so "short courses" silently matched everything
      // whose duration was merely unknown.
      //
      // Judged on the LOWER bound: a course stated as 8-16 hours might well be
      // short. A course with no stated duration is not KNOWN to be short, so it
      // does not match — the same direction as refusing to invent a midpoint.
      if (filter === 'short')
        return typeof c.hoursMin === 'number' && Number.isFinite(c.hoursMin)
          && c.hoursMin < 10;
      if (filter === 'recommended') return c.recommended;
      return true;
    });
    return filtered.sort((a, b) => Number(b.recommended) - Number(a.recommended));
  }, [edited, data, filter]);

  return (
    <div className="stack stack--lg enter">
      <header>
        <h1 className="headline">{t('courses.title')}</h1>
      </header>

      <BrowseBar
        filters={filters}
        active={filter}
        onFilter={setFilter}
        onRefresh={refresh}
        refreshing={refreshing}
        refreshLabel={t('browse.refresh')}
        status={status}
      />

      {loading && <Card><LoadingBlock rows={4} /></Card>}
      {error && <ErrorState onRetry={reload} />}

      {!loading && !error && (
        shown.length === 0
          ? inFlight
            // An empty list during a run means "not yet", not "nothing exists".
            ? <EmptyState title={t('state.workingTitle')} body={t('state.workingSub')} />
            : <EmptyState title={t('courses.empty')} body={t('courses.emptySub')} />
          : (
            <>
              <CoursesMap
                courses={shown}
                completed={completed}
                onOpen={setOpen}
                onDone={markDone}
                onUndo={markNotDone}
              />
              <p className="map__hint">{t('courses.mapHint')}</p>
            </>
          )
      )}

      <CourseSheet
        course={open}
        done={open ? completed.has(open.id) : false}
        onClose={() => setOpen(null)}
        onReplace={replaceCourse}
        onDone={markDone}
        onUndo={markNotDone}
      />
    </div>
  );
}

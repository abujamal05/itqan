/**
 * Courses.
 *
 * The line that matters most on this page is "Itqan earns nothing from these".
 * The product refuses affiliate commissions, and saying so is the difference
 * between a recommendation and an advert. Showing the price prominently is the
 * other half of that: a cost the user has to hunt for reads as a cost someone
 * hoped they would not notice.
 *
 * Recommended courses sort first, because a list ordered by nothing in
 * particular asks the user to do the ranking the product exists to do.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { useOnboarding } from '../state/onboarding';
import { useRunInFlight } from '../components/PipelineProgress';
import { Card, EmptyState, ErrorState, LoadingBlock } from '../components/ui';
import { CourseCard } from '../components/CourseCard';
import type { Course } from '../api';
import { BrowseBar } from '../components/BrowseBar';
import type { FilterDef } from '../components/BrowseBar';

type Filter = 'all' | 'free' | 'short' | 'recommended';

export function Courses() {
  const { t, locale, formatNumber } = useI18n();
  const api = useApi();
  const { settled } = useOnboarding();
  const inFlight = useRunInFlight();
  // Re-fetch when the run lands; see the same note in Dashboard.tsx.
  const { data, loading, error, reload } = useAsync((s) => api.getCourses(s),
                                                   [api, locale, settled]);
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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
    } catch {
      setStatus(t('state.errorSub'));
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
      <header className="stack stack--sm">
        <h1 className="headline">{t('courses.title')}</h1>
        <p className="subhead">{t('courses.sub')}</p>
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
            <div className="grid grid--3">
              {shown.map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  onReplace={(next) => replaceCourse(c.id, next)}
                />
              ))}
            </div>
          )
      )}
    </div>
  );
}

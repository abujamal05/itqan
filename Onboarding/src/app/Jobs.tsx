/**
 * Job postings.
 *
 * Three filters, not a filter panel. Every additional control costs decision
 * time, and the useful cuts on a first visit are only: everything, the ones
 * that are genuinely strong, and the ones I kept. Location, salary and
 * contract filters belong to a later version with enough postings to warrant
 * them.
 *
 * "Look for new job postings" exists because these are scraped from sources
 * that change on their own schedule, and someone waiting on a role needs a way
 * to ask rather than reload and hope.
 *
 * Saved postings are held in component state on purpose: persisting them is a
 * real endpoint on the user's account, and faking it here would hide that work
 * rather than do it.
 */
import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { useOnboarding } from '../state/onboarding';
import { useRunInFlight } from '../components/PipelineProgress';
import { isStrong } from '../api';
import { Card, EmptyState, ErrorState, LoadingBlock } from '../components/ui';
import { MatchCard } from '../components/MatchCard';
import { BrowseBar } from '../components/BrowseBar';
import type { FilterDef } from '../components/BrowseBar';

type Filter = 'all' | 'strong' | 'saved';

export function Jobs() {
  const { t, locale, formatNumber } = useI18n();
  const api = useApi();
  const { settled } = useOnboarding();
  const inFlight = useRunInFlight();
  // Re-fetch when the run lands; see the same note in Dashboard.tsx.
  const { data, loading, error, reload } = useAsync((s) => api.getJobs(s),
                                                   [api, locale, settled]);
  const [filter, setFilter] = useState<Filter>('all');
  const [saved, setSaved] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const filters: FilterDef<Filter>[] = [
    { id: 'all', label: t('jobs.filterAll') },
    { id: 'strong', label: t('jobs.filterStrong') },
    { id: 'saved', label: t('jobs.filterSaved') },
  ];

  const toggleSave = (id: string) =>
    setSaved((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setStatus(null);
    const before = data?.length ?? 0;
    try {
      const fresh = await api.getJobs();
      const added = Math.max(0, fresh.length - before);
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
    const list = data ?? [];
    if (filter === 'strong') return list.filter((j) => isStrong(j.score));
    if (filter === 'saved') return list.filter((j) => saved.includes(j.id));
    return list;
  }, [data, filter, saved]);

  return (
    <div className="stack stack--lg enter">
      <header>
        <h1 className="headline">{t('jobs.title')}</h1>
      </header>

      <BrowseBar
        filters={filters}
        active={filter}
        onFilter={setFilter}
        onRefresh={refresh}
        refreshing={refreshing}
        refreshLabel={t('browse.refreshJobs')}
        status={status}
      />

      {loading && <Card><LoadingBlock rows={4} /></Card>}
      {error && <ErrorState onRetry={reload} />}

      {!loading && !error && (
        shown.length === 0
          ? inFlight
            // An empty list during a run means "not yet", not "nothing exists".
            ? <EmptyState title={t('state.workingTitle')} body={t('state.workingSub')} />
            : <EmptyState title={t('jobs.empty')} body={t('jobs.emptySub')} />
          : (
            <div className="grid grid--2">
              {shown.map((j) => (
                <MatchCard key={j.id} job={j} saved={saved.includes(j.id)} onToggleSave={toggleSave} />
              ))}
            </div>
          )
      )}
    </div>
  );
}

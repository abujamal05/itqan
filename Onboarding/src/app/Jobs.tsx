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
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import { errorText } from '../lib/errorText';
import { useChat } from '../state/chat';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { useOnboarding } from '../state/onboarding';
import { useRunInFlight } from '../components/PipelineProgress';
import { isStrong } from '../api';
import { Callout, Card, EmptyState, ErrorState, LoadingBlock } from '../components/ui';
import { LOW_READINESS } from '../components/map/JourneyMap';
import { MatchCard } from '../components/MatchCard';
import { LockedMatches } from '../components/LockedMatches';
import { BrowseBar } from '../components/BrowseBar';
import type { FilterDef } from '../components/BrowseBar';

type Filter = 'all' | 'strong' | 'saved';

export function Jobs() {
  const { t, locale, formatNumber } = useI18n();
  // A re-run finishing must be visible here without a manual reload.
  const { resultsVersion } = useChat();
  const api = useApi();
  const { settled } = useOnboarding();
  const inFlight = useRunInFlight();
  // Re-fetch when the run lands; see the same note in Dashboard.tsx.
  const { data, loading, error, reload } = useAsync((s) => api.getJobs(s),
                                                   [api, locale, settled, resultsVersion]);
  /**
   * Readiness, for the one reason this page needs it.
   *
   * THE TWO SCREENS WERE CONTRADICTING EACH OTHER. The dashboard withheld the
   * matches under `LOW_READINESS` and said nothing here was worth applying to
   * today — and then this page listed all of them anyway, one tap away. Either
   * the advice was wrong or the list was; a product whose two screens disagree
   * is not trusted on either.
   *
   * The same gate now applies here. It is a WITHHOLD, not a block: the advice
   * is stated, and "Show them anyway" reveals the list, because these are the
   * user's own matches and a career tool that hides someone's options from them
   * has stopped being on their side.
   */
  const { data: dash } = useAsync((s) => api.getDashboard(s), [api, locale, settled, resultsVersion]);
  const [revealed, setRevealed] = useState(false);
  const low = typeof dash?.readiness === 'number' && dash.readiness <= LOW_READINESS;
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
    const before = data?.matches.length ?? 0;
    try {
      const fresh = await api.getJobs();
      const added = Math.max(0, fresh.matches.length - before);
      setStatus(added > 0
        ? t('browse.foundNew', { n: formatNumber(added) })
        : t('browse.nothingNew'));
      reload();
    } catch (err: unknown) {
      /* Was one sentence for every outcome. A token limit and a dropped
         connection are different problems with different next steps. */
      setStatus(errorText(err, { t, formatNumber }, { fallback: t('state.errorSub') }));
    } finally {
      setRefreshing(false);
    }
  }, [api, data, reload, t, formatNumber]);

  const shown = useMemo(() => {
    const list = data?.matches ?? [];
    if (filter === 'strong') return list.filter((j) => isStrong(j.score));
    if (filter === 'saved') return list.filter((j) => saved.includes(j.id));
    return list;
  }, [data, filter, saved]);

  /**
   * How many matches this account is not allowed to see.
   *
   * Only shown on the unfiltered list. Under a filter the count would be a lie
   * in both directions: the locked matches are not filtered (we do not have
   * them), so "12 more" beside a "Saved" list would promise twelve more saved
   * jobs that do not exist.
   */
  const locked = filter === 'all' ? (data?.locked ?? 0) : 0;

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
          : low && !revealed
            ? (
              <EmptyState
                title={t('jobs.lowTitle')}
                body={t('jobs.lowBody')}
                action={(
                  <div className="row">
                    <Link className="btn btn--primary" to="/courses">{t('jobs.seePath')}</Link>
                    {/* Secondary on purpose. The path is the recommendation;
                        this is the escape hatch, and it should read as one. */}
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={() => setRevealed(true)}
                    >
                      {t('jobs.showAnyway')}
                    </button>
                  </div>
                )}
              />
            )
            : (
              <>
                {/* Shown once, above the list, when the user overrode the
                    advice — so the caveat travels with the thing it is about
                    instead of being forgotten on the previous screen. */}
                {low && revealed && <Callout>{t('jobs.lowShown')}</Callout>}
                <div className="grid grid--2">
                  {shown.map((j) => (
                    <MatchCard key={j.id} job={j} saved={saved.includes(j.id)} onToggleSave={toggleSave} />
                  ))}
                </div>
                <LockedMatches count={locked} />
              </>
            )
      )}
    </div>
  );
}

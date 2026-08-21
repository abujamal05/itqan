/**
 * Filters plus a "look for new ones" action, shared by courses and job
 * postings so the two pages behave identically.
 *
 * The refresh button exists because these lists are scraped from sources that
 * change on their own schedule, and a user who has been waiting on a posting
 * needs a way to ask rather than guess. It reports what it found — including
 * "nothing new", which is the honest and most common answer, and the one a
 * silent spinner leaves ambiguous.
 *
 * Filters are chips rather than a select: there are few of them, they are
 * togglable in one tap, and their state is visible without opening anything.
 */
import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n';
import { Chip } from './ui';

export interface FilterDef<T extends string> {
  id: T;
  label: string;
}

export function BrowseBar<T extends string>({
  filters, active, onFilter, onRefresh, refreshing, refreshLabel, status,
}: {
  filters: FilterDef<T>[];
  active: T;
  onFilter: (id: T) => void;
  onRefresh: () => void;
  refreshing: boolean;
  refreshLabel: string;
  /** Result of the last check, announced politely rather than as an alert. */
  /**
   * ReactNode, not string: some statuses have to OFFER something rather than
   * only announce it — marking a course done says the score has not moved and
   * needs to link to the CV upload that would move it. A live region can hold a
   * link perfectly well; making the caller flatten it to text is what forces
   * the useful half out.
   */
  status: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="browse">
      <div className="browse__filters" role="group" aria-label={t('browse.filter')}>
        {filters.map((f) => (
          <Chip key={f.id} selected={active === f.id} onToggle={() => onFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <div className="browse__actions">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onRefresh}
          disabled={refreshing}
          aria-busy={refreshing || undefined}
        >
          <RefreshCw size={16} aria-hidden="true" className={refreshing ? 'spin' : undefined} />
          {refreshing ? t('browse.refreshing') : refreshLabel}
        </button>
      </div>

      {/* Reserved line, so announcing a result does not shift the grid down. */}
      <p className="browse__status" role="status" aria-live="polite">{status ?? ' '}</p>
    </div>
  );
}

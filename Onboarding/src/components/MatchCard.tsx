/**
 * The product's core object: one role matched to the graduate.
 *
 * Order is fixed by components.md so it reads correctly from the top-start
 * corner in both directions: title and employer, then confidence, then the
 * evidence chain, then the source.
 *
 * Three things are non-negotiable and are why this component exists at all:
 *  - the score is never a bare number; it always carries an icon and a word,
 *    so a colour-blind user reads the same state;
 *  - "why this match" is always present, because a recommendation the user
 *    cannot check is a recommendation the skeptic will not trust;
 *  - the live source and its retrieval date are always shown, because a dead
 *    or invented link loses that user permanently.
 *
 * Hud is deliberately absent: a real job match is a trust-critical surface.
 */
import { Bookmark, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n';
import { isStrong } from '../api';
import type { JobMatch } from '../api';
import { Card, ConfidenceBadge } from './ui';

export function MatchCard({
  job, saved, onToggleSave,
}: {
  job: JobMatch;
  saved?: boolean;
  onToggleSave?: (id: string) => void;
}) {
  const { t, formatDate, formatNumber } = useI18n();
  const strong = isStrong(job.score);

  return (
    <Card>
      <div className="match">
        <div className="match__top">
          {/* `1 1 12rem`, not `1` with a zero basis. With a zero basis the
              confidence badge — which must not break mid-verdict, so it does
              not shrink — took the whole row on a 320px phone and the job
              title was squeezed to 14px of nothing. A real basis makes the two
              stop fitting instead of one starving the other, and .match__top
              wraps them onto separate lines. */}
          <div className="stack stack--sm" style={{ flex: '1 1 12rem', minWidth: 0 }}>
            <span className="eyebrow">{job.arrangement}</span>
            <h3 className="match__title"><bdi>{job.title}</bdi></h3>
            <p className="match__org">
              <bdi>{job.employer}</bdi> · <bdi>{job.location}</bdi>
            </p>
          </div>
          {/* Label and figure in one badge. Split apart they read as two
              separate claims and the number floated free of the word that
              qualifies it; together they are a single verdict. The word still
              leads, so the state survives without the number. */}
          <ConfidenceBadge
            strong={strong}
            label={strong ? t('jobs.matchStrong') : t('jobs.matchSuggested')}
            percent={formatNumber(Math.round(job.score * 100))}
          />
        </div>

        <div className="why">
          <p className="why__head">{t('jobs.why')}</p>
          <p>{job.why}</p>
        </div>

        <div className="row">
          <a
            className="btn btn--primary"
            href={job.source.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('jobs.view')}
            <ExternalLink size={16} aria-hidden="true" />
          </a>
          {onToggleSave && (
            <button
              type="button"
              className="btn btn--secondary btn--icon"
              onClick={() => onToggleSave(job.id)}
              aria-pressed={saved}
              aria-label={saved ? t('jobs.saved') : t('jobs.save')}
            >
              <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
          )}
        </div>

        <p className="source">
          {t('jobs.source', { source: job.source.name, date: formatDate(job.source.retrievedAt) })}
        </p>
      </div>
    </Card>
  );
}

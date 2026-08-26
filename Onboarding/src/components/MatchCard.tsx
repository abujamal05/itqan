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
import { isJobMatch, isStrong } from '../api';
import type { JobMatch, Usage } from '../api';
import { Card, ConfidenceBadge } from './ui';
import { FeedbackBar } from './FeedbackBar';

export function MatchCard({
  job, saved, onToggleSave, onReplace, usage,
}: {
  job: JobMatch;
  saved?: boolean;
  onToggleSave?: (id: string) => void;
  /**
   * Swap this posting for a different real one, when the person says it does
   * not fit and why.
   *
   * Passed by whoever owns the LIST, because only the owner can replace an
   * entry in place — which is the requirement: the reader keeps their filters,
   * their scroll position and everything around them.
   *
   * A posting is a real vacancy at a real employer and this never invents one.
   * What arrives is another real match with its own why, its own source and its
   * own retrieval date, and "nothing else fits right now" stays an answer the
   * screen is willing to give.
   */
  onReplace?: (next: JobMatch) => void;
  /** The token pool, so the feedback panel can price a replacement. */
  usage?: Usage | null;
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

        {/* Below the actions and above the source line. The user has to have
            READ the match before an opinion of it means anything, so the
            controls sit after the evidence rather than beside the title where
            they would compete with the verdict. No replacement affordance for a
            posting: a vacancy is a real thing at a real employer, not a slot. */}
        {/* Narrowed, not cast: this list only holds postings. */}
        <FeedbackBar
          subject="job"
          itemId={job.id}
          usage={usage}
          onReplace={onReplace && ((next) => { if (isJobMatch(next)) onReplace(next); })}
        />

        <p className="source">
          {t('jobs.source', { source: job.source.name, date: formatDate(job.source.retrievedAt) })}
        </p>
      </div>
    </Card>
  );
}

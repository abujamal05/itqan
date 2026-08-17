/**
 * One direction out of a junction.
 *
 * This is the only actionable object on the chat screen, which is why it, and
 * not Hud's line above it, carries the whole evidence load. Hud says where you
 * are; a fork says where you could go and why, with a source you can open.
 *
 * When a fork resolves to a real posting or a real course it renders through
 * MatchCard / CourseCard untouched. That is deliberate and worth keeping: those
 * two already enforce the confidence badge, the evidence chain and the live
 * source with its retrieval date, so the trust rules on this screen cannot
 * drift away from the trust rules on Jobs and Courses. Reimplementing them here
 * would be the moment they started to.
 */
import { ArrowRight, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n';
import { isStrong } from '../api';
import type { ChatFork } from '../api';
import { Card, ConfidenceBadge } from './ui';
import { MatchCard } from './MatchCard';
import { CourseCard } from './CourseCard';

export function ForkCard({
  fork, onTake, disabled,
}: {
  fork: ChatFork;
  onTake: (forkId: string) => void;
  disabled?: boolean;
}) {
  const { t, formatDate, formatNumber } = useI18n();

  // A fork that IS a job or a course renders as that object, with the walk
  // action underneath it rather than wrapped around it — the card's own primary
  // action is the source link, and two competing primaries in one box is how a
  // user ends up clicking neither.
  if (fork.job) {
    return (
      <div className="fork fork--object">
        <MatchCard job={fork.job} />
        <WalkButton fork={fork} onTake={onTake} disabled={disabled} label={t('chat.exploreJob')} />
      </div>
    );
  }

  if (fork.course) {
    return (
      <div className="fork fork--object">
        <CourseCard course={fork.course} />
        <WalkButton fork={fork} onTake={onTake} disabled={disabled} label={t('chat.exploreCourse')} />
      </div>
    );
  }

  const rated = typeof fork.confidence === 'number';
  const strong = rated && isStrong(fork.confidence as number);

  return (
    <Card className="fork">
      <button
        type="button"
        className="fork__take"
        onClick={() => onTake(fork.id)}
        disabled={disabled}
      >
        <span className="fork__body">
          <span className="fork__top">
            <span className="fork__label"><bdi>{fork.label}</bdi></span>
            {rated && (
              <ConfidenceBadge
                strong={strong}
                label={strong ? t('jobs.matchStrong') : t('jobs.matchSuggested')}
                percent={formatNumber(Math.round((fork.confidence as number) * 100))}
              />
            )}
          </span>
          <span className="fork__detail">{fork.detail}</span>
        </span>
        <ArrowRight className="fork__arrow" size={18} aria-hidden="true" />
      </button>

      {/* Evidence sits OUTSIDE the button. It is there to be read and its
          source to be opened, not to be swallowed into one giant click target
          whose accessible name would then recite the whole chain. */}
      {fork.why && (
        <div className="why">
          <p className="why__head">{t('jobs.why')}</p>
          <p>{fork.why}</p>
        </div>
      )}

      {fork.source && (
        <p className="source">
          <a href={fork.source.url} target="_blank" rel="noopener noreferrer">
            <bdi>{fork.source.name}</bdi>
            <ExternalLink size={14} aria-hidden="true" />
          </a>
          <span>
            {t('jobs.source', {
              source: fork.source.name,
              date: formatDate(fork.source.retrievedAt),
            })}
          </span>
        </p>
      )}
    </Card>
  );
}

function WalkButton({
  fork, onTake, disabled, label,
}: {
  fork: ChatFork;
  onTake: (forkId: string) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      className="btn btn--secondary fork__walk"
      onClick={() => onTake(fork.id)}
      disabled={disabled}
    >
      {label}
      <ArrowRight className="fork__arrow" size={16} aria-hidden="true" />
    </button>
  );
}

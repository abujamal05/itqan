/**
 * One node on the spine: what was asked, how Hud read it, where it leads.
 *
 * The structure carries the argument of the whole screen, so the two halves are
 * kept visibly apart:
 *
 *   Hud's READ is orientation. It never states a verdict, a score or a match,
 *   which is the condition on which the mascot is allowed here at all.
 *   The FORKS are the claims, and each carries its own evidence and source.
 *
 * Once a direction is walked, the others do not disappear. They collapse to a
 * quiet list under a heading that says what they are, and every one of them is
 * still walkable. That is the difference between this and a transcript: a
 * conversation you can re-enter at any junction rather than only continue from
 * the bottom.
 */
import { Hud } from './Hud';
import { ForkCard } from './ForkCard';
import { useI18n } from '../i18n';
import type { ChatFork, ChatJunction } from '../api';

export function Junction({
  junction, takenForkId, onTake, busy, first,
}: {
  junction: ChatJunction;
  takenForkId: string | null;
  onTake: (junctionId: string, forkId: string) => void;
  busy: boolean;
  /** The opening junction gets the larger Hud; the rest get the small one. */
  first?: boolean;
}) {
  const { t } = useI18n();
  const take = (forkId: string) => onTake(junction.id, forkId);

  const open = junction.forks.filter((f) => f.id !== takenForkId);
  const walked = junction.forks.find((f) => f.id === takenForkId) ?? null;

  return (
    <li className="junction" data-first={first || undefined}>
      <span className="junction__dot" aria-hidden="true" />

      {junction.question && (
        <p className="junction__question">
          <span className="junction__asked">{t('chat.you')}</span>
          <bdi>{junction.question}</bdi>
        </p>
      )}

      <div className="junction__read">
        <div className="junction__hud">
          <Hud pose={first ? 'waving' : 'idle'} then={first ? 'idle' : undefined} loop size={first ? 'md' : 'sm'} eager={first} />
        </div>
        <p className="junction__line">{junction.read}</p>
      </div>

      {walked && (
        <p className="junction__walked">
          {t('chat.walked', { label: walked.label })}
        </p>
      )}

      {open.length > 0 && (
        <div className="junction__forks">
          <p className="junction__forksLabel">
            {walked ? t('chat.otherDirections') : t('chat.directions')}
          </p>
          <ul className="junction__forkList" data-quiet={walked ? true : undefined}>
            {open.map((fork: ChatFork) => (
              <li key={fork.id}>
                <ForkCard fork={fork} onTake={take} disabled={busy} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

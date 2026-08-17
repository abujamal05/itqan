/**
 * One turn in the conversation.
 *
 * NO HUD IN HERE, and that is a constraint rather than an omission. Exactly one
 * mascot may be on this screen at a time; if this component rendered one, a
 * six-turn thread would show six of him. Chat.tsx owns the single instance and
 * moves it between the greeting and the composer as the state changes. Adding
 * <Hud> to this file is the one edit that breaks the rule, which is why the rule
 * is written here rather than only there.
 *
 * The two roles are shaped differently on purpose. A user's turn is a short
 * quoted thing, so it gets a filled bubble on the reading-end side. Hud's turn is
 * often several sentences plus cards, so it gets no bubble at all: a paragraph of
 * prose in a tinted balloon is harder to read than the same paragraph on the
 * page, and Claude, ChatGPT and every other assistant worth copying reached the
 * same conclusion.
 *
 * The cards are the point of the whole screen. Hud's prose may orient, suggest
 * and explain, but the moment something becomes actionable it is handed over as a
 * MatchCard or a CourseCard — the same components Jobs and Courses use, so `why`,
 * the live source and its retrieval date and the confidence badge all come along
 * and cannot drift away from the rest of the product.
 */
import { useI18n } from '../i18n';
import type { ChatMessage } from '../api';
import { MatchCard } from './MatchCard';
import { CourseCard } from './CourseCard';

export function Message({
  message, onSuggest, busy, isLast,
}: {
  message: ChatMessage;
  onSuggest: (question: string) => void;
  busy: boolean;
  isLast: boolean;
}) {
  const { t } = useI18n();
  const mine = message.role === 'user';

  if (mine) {
    return (
      <li className="turn turn--mine">
        <p className="bubble">
          <span className="sr-only">{t('chat.youSaid')}: </span>
          <bdi>{message.text}</bdi>
        </p>
      </li>
    );
  }

  const jobs = message.jobs ?? [];
  const courses = message.courses ?? [];
  /* Suggestions only on the newest turn. Older ones keep theirs in the DOM as
     history would be odd to rewrite, but offering four sets of follow-ups up
     and down a thread turns a conversation into a menu. */
  const suggestions = isLast ? message.suggestions ?? [] : [];

  return (
    <li className="turn turn--hud">
      <p className="said">
        <span className="sr-only">{t('chat.hudSaid')}: </span>
        {message.text}
      </p>

      {jobs.length > 0 && (
        <div className="turn__cards">
          <p className="turn__cardsLabel">{t('chat.jobsHere', { n: jobs.length })}</p>
          <div className="grid grid--cards">
            {jobs.map((job) => <MatchCard key={job.id} job={job} />)}
          </div>
        </div>
      )}

      {courses.length > 0 && (
        <div className="turn__cards">
          <p className="turn__cardsLabel">{t('chat.coursesHere', { n: courses.length })}</p>
          <div className="grid grid--cards">
            {courses.map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="suggests">
          <p className="suggests__label">{t('chat.askNext')}</p>
          <div className="suggests__row">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="suggest"
                onClick={() => onSuggest(s)}
                disabled={busy}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

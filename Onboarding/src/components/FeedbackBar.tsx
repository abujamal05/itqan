/**
 * Like and dislike on a recommendation, and the short flow a dislike opens.
 *
 * WHY THE DISLIKE ASKS. A thumb down on its own tells the ranker one bit, and
 * the one bit it tells is the least useful part: "no" is obvious from the fact
 * that the user pressed it. Which KIND of no is the signal — wrong place, wrong
 * level, already know it — and that is the difference between a recommender
 * that adjusts and one that reshuffles. The reasons are a closed list so they
 * aggregate, plus `other` with the user's own words so the list can be wrong
 * without losing what they meant.
 *
 * IT NEVER BLOCKS. The dislike is recorded the moment it is pressed, before any
 * reason is given, and the panel can be skipped. A modal that demanded a reason
 * before letting someone dismiss a bad suggestion would make the honest action
 * more expensive than ignoring it, which is how feedback dries up.
 *
 * IT NEVER LEAVES THE PAGE. The panel opens inside the card. Courses can also
 * ask for a replacement, which swaps in place — the parent owns the list, so
 * scroll position, filters and everything around it survive untouched.
 *
 * The mascot is not here and must not be: these sit on `MatchCard` and
 * `CourseCard`, which are real matches, and the fence keeps him away from those.
 */
import { useState } from 'react';
import { RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useI18n } from '../i18n';
import { useFeedback } from '../state/feedback';
import { COURSE_DISLIKE_REASONS, JOB_DISLIKE_REASONS } from '../api';
import type { Course, DislikeReason, FeedbackSubject } from '../api';
import { Button, Chip, TextField } from './ui';

export function FeedbackBar({
  subject, itemId, onReplace,
}: {
  subject: FeedbackSubject;
  itemId: string;
  /**
   * Courses only. Given, the panel offers "look for another similar course" and
   * hands the replacement back for the parent to drop into this slot. There is
   * deliberately no equivalent for a posting: a vacancy is a real thing at a
   * real employer, not an interchangeable slot to be refilled.
   */
  onReplace?: (next: Course) => void;
}) {
  const { t } = useI18n();
  const { verdictFor, send, clear, findSimilar } = useFeedback();

  const verdict = verdictFor(subject, itemId);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<DislikeReason | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);

  const reasons = subject === 'job' ? JOB_DISLIKE_REASONS : COURSE_DISLIKE_REASONS;

  const like = () => {
    setAsking(false);
    setDone(null);
    if (verdict === 'like') { clear(subject, itemId); return; }
    send({ subject, itemId, verdict: 'like' });
  };

  const dislike = () => {
    if (verdict === 'dislike') { clear(subject, itemId); setAsking(false); return; }
    // Recorded FIRST, then the reason is asked for. The verdict is the part
    // that must survive someone closing the panel without answering.
    send({ subject, itemId, verdict: 'dislike' });
    setReason(null);
    setNote('');
    setDone(null);
    setAsking(true);
  };

  /**
   * THE REASON IS THE ANSWER, so choosing one finishes the job.
   *
   * This used to be select-then-press-Send: two taps for one thought, on a
   * panel the user only opened to get rid of a card. The chips were also
   * competing with three buttons underneath, which put ten targets on screen at
   * the moment of least patience. Tapping a reason now records it and closes.
   *
   * `other` is the exception and has to be: it opens a text field, and there is
   * no moment a machine can call "done typing" — so that branch keeps a Send.
   */
  const submitReason = (picked: DislikeReason | null = reason) => {
    send({
      subject, itemId, verdict: 'dislike',
      reason: picked,
      // Only carried when it is the thing the user actually typed.
      note: picked === 'other' ? note.trim() || null : null,
    });
    setAsking(false);
    setDone(t('fb.thanks'));
  };

  const pickReason = (r: DislikeReason) => {
    setReason(r);
    // `other` needs the text field before it can be sent.
    if (r !== 'other') submitReason(r);
  };

  const replace = async () => {
    setFinding(true);
    try {
      // Everything currently on screen is excluded by the caller's own list;
      // this passes the rejected id and lets the service read the rest from the
      // account. See the contract note in BACKEND.md §1.5.
      const next = await findSimilar({ courseId: itemId, exclude: [itemId] });
      send({
        subject, itemId, verdict: 'dislike',
        reason, note: reason === 'other' ? note.trim() || null : null,
        replaced: true,
      });
      setAsking(false);
      if (next && onReplace) {
        /**
         * The PARENT announces this one, not us.
         *
         * A successful replacement changes the card's id, the list re-keys, and
         * this component unmounts with the new course mounted in its place — so
         * a message set here is destroyed on the same tick it is written. It
         * was, and the swap happened in complete silence. The confirmation has
         * to outlive the card, which means it belongs to whoever owns the list.
         *
         * The failure below is the opposite case: nothing was replaced, this
         * card is still here, and the message has somewhere to live.
         */
        onReplace(next);
      } else {
        setDone(t('fb.noSimilar'));
      }
    } finally {
      setFinding(false);
    }
  };

  return (
    <div className="fb">
      <div className="fb__buttons">
        <button
          type="button"
          className="fb__btn"
          aria-pressed={verdict === 'like'}
          aria-label={t('fb.like')}
          title={t('fb.like')}
          onClick={like}
        >
          <ThumbsUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="fb__btn"
          aria-pressed={verdict === 'dislike'}
          aria-label={t('fb.dislike')}
          title={t('fb.dislike')}
          onClick={dislike}
        >
          <ThumbsDown size={16} aria-hidden="true" />
        </button>
        {/* The state in words, because two icons differing only by rotation is
            exactly the pair a screen reader user and a low vision user cannot
            tell apart from the pressed state alone. */}
        {verdict && !asking && !done && (
          <span className="fb__state">
            {verdict === 'like' ? t('fb.liked') : t('fb.disliked')}
          </span>
        )}
      </div>

      {asking && (
        <div className="fb__panel">
          <p className="fb__q">{t('fb.why')}</p>
          <p className="fb__help">{t('fb.whyHelp')}</p>

          {/* `fb__reasons`, not the generic `.row`: these wrap inside a card
              column ~224px wide, where full size chips fit exactly one per line
              and turned this panel into an 822px tower inside a 257px card. */}
          <div className="fb__reasons">
            {reasons.map((r) => (
              <Chip key={r} selected={reason === r} onToggle={() => pickReason(r)}>
                {t(`fb.${subject}.${r}`)}
              </Chip>
            ))}
          </div>

          {/* Only once `other` is chosen. A free-text box sitting open beside a
              list of presets asks every user to consider writing an essay. */}
          {reason === 'other' && (
            <>
              <TextField
                label={t('fb.otherLabel')}
                placeholder={t('fb.otherPlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
              <div className="row row--tight">
                <Button onClick={() => submitReason()}>{t('fb.send')}</Button>
              </div>
            </>
          )}

          {/* Two controls, not four: the reasons above submit themselves, so
              what is left is the course-only escape hatch and a way out. */}
          <div className="row row--tight">
            {onReplace && (
              <Button variant="secondary" onClick={replace} loading={finding}>
                <RefreshCw size={15} aria-hidden="true" className={finding ? 'spin' : undefined} />
                {finding ? t('fb.finding') : t('fb.findSimilar')}
              </Button>
            )}
            <button type="button" className="btn btn--ghost" onClick={() => setAsking(false)}>
              {t('fb.skip')}
            </button>
          </div>
        </div>
      )}

      {/* Polite, never an alert: this confirms something the user did on
          purpose and must not steal focus from where they are reading. */}
      {done && <p className="fb__done" role="status" aria-live="polite">{done}</p>}
    </div>
  );
}

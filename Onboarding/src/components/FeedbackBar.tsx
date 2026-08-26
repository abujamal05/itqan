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
 * THE PANEL IS A DIALOG, and it earned that. It began inside the card, which is
 * where a light touch belongs — but these cards sit two to a row in a grid, so
 * the panel was a form squeezed into a 250px column: six reason chips wrapping
 * three lines deep, a note field the width of a thumb, and three stacked
 * buttons pushing the source line off the bottom. A dialog gives the reasons
 * room to sit on two lines, the note a real field, and the priced action a line
 * of its own. Nothing else about the flow changed.
 *
 * The replacement still swaps IN PLACE behind it — the parent owns the list, so
 * scroll position, filters and everything around it survive untouched.
 *
 * THE REASON IS THE REQUEST, and that is what changed. The reason used to be
 * recorded and then thrown away before the search, so "too expensive" and "too
 * basic" produced the same next course and the panel's own question was
 * decoration. It now goes to the agent, which is the difference between "find
 * me a cheaper one" and "shuffle".
 *
 * POSTINGS CAN BE REPLACED TOO, reversing the note that used to sit here. "A
 * vacancy is a real thing at a real employer, not an interchangeable slot to be
 * refilled" is an argument against INVENTING a posting, not against finding a
 * different real one — and what arrives carries its own why, source and
 * retrieval date exactly as the rejected one did.
 *
 * FINDING ONE COSTS TOKENS, because it is an agent call, so the price is on the
 * control and a second deliberate tap confirms it. NOT a modal: the panel is
 * already open and one card out of a list does not earn an interruption, which
 * is the same weighing that leaves `DeleteDocument` confirming in place.
 *
 * The mascot is not here and must not be: these sit on `MatchCard` and
 * `CourseCard`, which are real matches, and the fence keeps him away from those.
 */
import { useId, useRef, useState } from 'react';
import { RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useI18n } from '../i18n';
import { useFeedback } from '../state/feedback';
import { errorText } from '../lib/errorText';
import { useModalDialog } from '../lib/useModalDialog';
import { COURSE_DISLIKE_REASONS, JOB_DISLIKE_REASONS } from '../api';
import type {
  Course, DislikeReason, FeedbackSubject, JobMatch, Usage,
} from '../api';
import { Button, Chip, TextField } from './ui';

export function FeedbackBar({
  subject, itemId, onReplace, usage,
}: {
  subject: FeedbackSubject;
  itemId: string;
  /**
   * Given, the panel offers to find one replacement and hands it back for the
   * parent to drop into this slot. The parent owns the list, so only the parent
   * can swap an entry without throwing the reader off the page they are on.
   *
   * Omitted where there is no list to swap within — the course detail sheet
   * closes instead, and the map behind it re-renders.
   */
  onReplace?: (next: Course | JobMatch) => void;
  /**
   * The token pool, for pricing the search. Passed down rather than fetched
   * here: a feedback bar per card would be a usage request per card, and this
   * component appears up to a dozen times on one screen.
   *
   * Absent, or missing its `alternative` price, means the offer is not made.
   * Not made for free — an unpriced spend is the one thing this must never be.
   */
  usage?: Usage | null;
}) {
  const { t, formatNumber } = useI18n();
  const { verdictFor, send, clear, findAlternative } = useFeedback();

  const verdict = verdictFor(subject, itemId);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState<DislikeReason | null>(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  /** The second tap. The first one only states the price. */
  const [confirming, setConfirming] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const titleId = useId();
  const firstChip = useRef<HTMLButtonElement>(null);
  /* Focus lands on the first reason, which is what the dialog is asking for.
     Locked while a search is in flight: it is spending tokens, and a dialog
     that vanishes mid-request leaves nobody sure whether it did. */
  const dialog = useModalDialog({
    open: asking,
    onClose: () => setAsking(false),
    locked: finding,
    focus: () => firstChip.current,
  });

  const price = usage?.prices?.alternative;
  const left = usage?.tokens && usage.tokens.limit !== null
    ? Math.max(0, usage.tokens.limit - usage.tokens.used)
    : null;
  /* Offered only when the server has published a price for it. A button with no
     number beside it is the unpriced spend this product does not make. */
  const canOffer = onReplace !== undefined && typeof price === 'number';
  const affordable = typeof price === 'number' && (left === null || left >= price);

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
    setRefused(null);
    setConfirming(false);
    setAsking(true);
  };

  /**
   * THE REASON IS THE ANSWER, so choosing one finishes the job — unless there
   * is something to DO with it, and then it opens the next step.
   *
   * This used to be select-then-press-Send: two taps for one thought, on a
   * panel the user only opened to get rid of a card. Tapping a reason records
   * it, which is right and stays.
   *
   * WHAT CHANGED IS WHAT HAPPENS NEXT. Closing the panel on the tap also closed
   * the only route to a replacement, so the two were mutually exclusive: you
   * could say WHY, or you could ask for another one, never both. The reason
   * therefore reached the search as `null` every single time, and "too
   * expensive" and "too basic" returned the same course. Where a replacement
   * can be offered the panel now stays open and offers it, carrying the reason
   * that was just given.
   *
   * `other` still needs its Send: a text field has no moment a machine can call
   * "done typing".
   */
  const submitReason = (picked: DislikeReason | null = reason) => {
    send({
      subject, itemId, verdict: 'dislike',
      reason: picked,
      // Only carried when it is the thing the user actually typed.
      note: picked === 'other' ? note.trim() || null : null,
    });
    if (canOffer) {
      /* Kept open, on the reason just given. The panel is now an offer rather
         than a receipt, and `Skip` is still the way out. */
      setDone(null);
      setConfirming(false);
      return;
    }
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
    setRefused(null);
    try {
      /* THE REASON GOES WITH IT. Without it the agent is being asked "another
         one" when the person said "a cheaper one", and the panel's question was
         answered into a void. `exclude` carries the rejected id and the service
         reads the rest of what is on screen from the account. */
      const next = await findAlternative({
        subject,
        itemId,
        reason,
        note: reason === 'other' ? note.trim() || null : null,
        exclude: [itemId],
      });
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
        setDone(t(subject === 'job' ? 'fb.noOtherJob' : 'fb.noSimilar'));
      }
    } catch (err: unknown) {
      /* THE SERVER'S OWN REASON. A spent budget is not "nothing else fits", and
         reporting it as one would tell somebody the catalogue was empty. */
      setRefused(errorText(err, { t, formatNumber }, { fallback: t('fb.findFailed') }));
    } finally {
      setFinding(false);
      setConfirming(false);
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

      {/* A dialog, so the reasons and the note get room a grid column cannot
          give them, and so focus, Escape and the page behind are the platform's
          job. `useModalDialog` owns those three; see it for why Escape goes
          through the same door as the buttons. */}
      <dialog
        className="sheet sheet--confirm"
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => { if (e.target === dialog.current && !finding) setAsking(false); }}
      >
        {asking && (
          <div className="confirm">
            <div className="confirm__head">
              <span className="confirm__mark" aria-hidden="true">
                <ThumbsDown size={20} />
              </span>
              <h2 className="confirm__title" id={titleId}>{t('fb.why')}</h2>
            </div>

            <p>{t('fb.whyHelp')}</p>

            <div className="fb__reasons">
              {reasons.map((r, i) => (
                <Chip
                  key={r}
                  ref={i === 0 ? firstChip : undefined}
                  selected={reason === r}
                  onToggle={() => pickReason(r)}
                >
                  {t(`fb.${subject}.${r}`)}
                </Chip>
              ))}
            </div>

            {/* Only once `other` is chosen. A free-text box sitting open beside
                a list of presets asks every user to consider writing an essay. */}
            {reason === 'other' && (
              <>
                <TextField
                  label={t('fb.otherLabel')}
                  placeholder={t('fb.otherPlaceholder')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
                <div className="row row--tight">
                  <Button variant="secondary" onClick={() => submitReason()}>{t('fb.send')}</Button>
                </div>
              </>
            )}

            {refused && <p className="fb__refused" role="alert">{refused}</p>}

            {/* Not a disabled button. The numbers say why, which is the only
                thing that helps, and there is nothing to press that could
                succeed. */}
            {canOffer && !affordable && (
              <p className="fb__refused">
                {t('fb.cannotAfford', {
                  cost: formatNumber(price as number),
                  remaining: formatNumber(left ?? 0),
                })}
              </p>
            )}

            {/* THE PRICE IS ON THE CONTROL, and pressing it states the cost
                rather than spending it. Two deliberate taps for something that
                charges the person's daily budget. */}
            {confirming && (
              <div className="fb__confirm">
                <p className="fb__cost">
                  {t('fb.cost', {
                    cost: formatNumber(price as number),
                    remaining: formatNumber(left ?? 0),
                  })}
                </p>
              </div>
            )}

            <div className="confirm__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setAsking(false)}
                disabled={finding}
              >
                {t('fb.skip')}
              </button>
              <span className="spacer" />

              {canOffer && affordable && !confirming && (
                <Button variant="secondary" onClick={() => setConfirming(true)}>
                  <RefreshCw size={15} aria-hidden="true" />
                  {t(subject === 'job' ? 'fb.findJob' : 'fb.findSimilar', {
                    n: formatNumber(price as number),
                  })}
                </Button>
              )}

              {confirming && (
                <>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setConfirming(false)}
                    disabled={finding}
                  >
                    {t('action.cancel')}
                  </button>
                  <Button onClick={replace} loading={finding}>
                    {finding
                      ? t(subject === 'job' ? 'fb.findingJob' : 'fb.finding')
                      : t('fb.findConfirm')}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </dialog>

      {/* Polite, never an alert: this confirms something the user did on
          purpose and must not steal focus from where they are reading. */}
      {done && <p className="fb__done" role="status" aria-live="polite">{done}</p>}
    </div>
  );
}

/**
 * Five stars and, if they want, a sentence. That is the whole thing.
 *
 * A RATING IS NOT A SURVEY. No "how likely are you to recommend", no follow-up
 * questions, no second page. The comment is optional and says so, and skipping
 * is a plain control rather than a small grey link — someone who does not want
 * to rate the product has told you something too, and making that expensive is
 * how the answers stop being honest.
 *
 * WHEN IT APPEARS is the part that matters, and it is not decided here — see
 * `lib/rating.ts`. Never during onboarding, never while documents are being
 * read, never before the person has actually seen a result.
 *
 * MOTION. This is the "rare / first-time" row of the motion skill's frequency
 * table, so character is licensed: the stars fill with a spring-ish settle on
 * selection and press in on pointer-down. That is `feedback`, the first job on
 * the list — nothing here is a verdict, a score or a match, so the evidence
 * fence is not in play. Reduced motion collapses the travel through
 * `--motion-scale` and keeps the colour change, which is the mechanism rather
 * than a kill switch.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { useI18n } from '../i18n';
import { errorText } from '../lib/errorText';
import { useModalDialog } from '../lib/useModalDialog';
import { useApi } from '../state/api';
import { Button, TextField } from './ui';

const STARS = [1, 2, 3, 4, 5] as const;

export function RatePrompt({
  open, onClose, onDone,
}: {
  open: boolean;
  /** Dismissed without rating. */
  onClose: () => void;
  /** Rated, or skipped — either way the caller carries on with what it was
   *  doing, which on the logout path means logging out. */
  onDone: (rated: boolean) => void;
}) {
  const { t, formatNumber } = useI18n();
  const api = useApi();
  const [stars, setStars] = useState(0);
  /** What the pointer or keyboard is currently over, so the row previews. */
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleId = useId();
  const firstStar = useRef<HTMLButtonElement>(null);
  const dialog = useModalDialog({
    open,
    onClose,
    locked: busy,
    focus: () => firstStar.current,
  });

  /* Reset on open. One instance is mounted for the life of the shell, and a
     successful send leaves `busy` true on the way out — harmless while the page
     is navigating away, and a stuck spinner if it is ever reopened. */
  useEffect(() => {
    if (!open) return;
    setStars(0);
    setHover(0);
    setComment('');
    setBusy(false);
    setError(null);
  }, [open]);

  const send = useCallback(async () => {
    if (!stars || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.submitRating({ stars, comment: comment.trim() || null });
      onDone(true);
    } catch (err: unknown) {
      /* A failed rating is not worth trapping anybody over, but it must not
         claim to have been sent either. The message says what happened and the
         way out stays open. */
      setError(errorText(err, { t, formatNumber }, { fallback: t('rate.failed') }));
      setBusy(false);
    }
  }, [stars, comment, busy, api, onDone, t, formatNumber]);

  /** What the row is showing right now: the hover preview, else the choice. */
  const shown = hover || stars;

  return (
    <dialog
      className="sheet sheet--confirm"
      ref={dialog}
      aria-labelledby={titleId}
      onClick={(e) => { if (e.target === dialog.current && !busy) onClose(); }}
    >
      {open && (
        <div className="confirm">
          <div className="confirm__head">
            <span className="confirm__mark" aria-hidden="true"><Star size={20} /></span>
            <h2 className="confirm__title" id={titleId}>{t('rate.title')}</h2>
          </div>

          <p>{t('rate.lead')}</p>

          {/* A RADIO GROUP, not five toggle buttons. The choice is one of five,
              arrow keys move between them, and each carries its value in words
              — five stars differing only by fill is exactly the control a
              screen reader user cannot read. */}
          <div
            className="rate"
            role="radiogroup"
            aria-label={t('rate.title')}
            onMouseLeave={() => setHover(0)}
          >
            {STARS.map((n) => (
              <button
                key={n}
                ref={n === 1 ? firstStar : undefined}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={t('rate.stars', { n: formatNumber(n) })}
                className="rate__star"
                data-on={n <= shown || undefined}
                disabled={busy}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onBlur={() => setHover(0)}
                onClick={() => setStars(n)}
              >
                <Star size={30} aria-hidden="true" />
              </button>
            ))}
          </div>

          {/* Named in words, because the row above is fill and shape only. It
              also confirms the choice registered, which on a control with no
              text of its own is the whole of the feedback. */}
          <p className="rate__value" aria-live="polite">
            {stars ? t('rate.chosen', { n: formatNumber(stars) }) : t('rate.pick')}
          </p>

          {/* OPTIONAL, and it says so in the label rather than in a hint nobody
              reads. It appears only once a rating is chosen: an empty comment
              box under an empty star row asks for an essay before an opinion. */}
          {stars > 0 && (
            <TextField
              label={t('rate.commentLabel')}
              placeholder={t('rate.commentPlaceholder')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              disabled={busy}
            />
          )}

          {error && <p className="field__error" role="alert">{error}</p>}

          <div className="confirm__actions">
            {/* Not a small grey link. Declining is an answer, and making it
                expensive is how the ones that arrive stop being honest. */}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onDone(false)}
              disabled={busy}
            >
              {t('rate.skip')}
            </button>
            <span className="spacer" />
            <Button onClick={send} loading={busy} disabled={!stars}>
              {t('rate.send')}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}

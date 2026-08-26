/**
 * Closing the account: pause it, or destroy it.
 *
 * ONE CARD, TWO ROWS, NOT TWO CARDS. Two danger-edged panels stacked at the end
 * of Settings would end the page in a wall of alarm and make neither of them
 * the emphasis — the same argument the design system makes about accent edges
 * being a scarce resource. So there is one bordered card, and inside it the
 * reversible act is quiet and the irreversible one carries the only filled
 * danger button on the screen.
 *
 * THE CONFIRMATION IS A DIALOG, and this is the one place that is right. The
 * craft floor's rule is that a modal needs to earn interruption and protected
 * focus; erasing everything a person uploaded earns both. It is a native
 * `<dialog>`, so the focus trap, Escape, page inertness and the top layer are
 * the platform's job rather than this file's.
 *
 * WHAT THE CONFIRMATION SAYS IS THE POINT. Not "are you sure" — a list of what
 * actually goes, in the product's own nouns, because a person cannot consent to
 * a consequence nobody named. Deletion additionally asks for the phrase to be
 * typed, in whichever language they are reading, which is the difference
 * between a decision and a mis-tap.
 *
 * NEITHER ACTION IS PERFORMED HERE. The server owns what deactivation and
 * deletion mean; this screen states them, asks, and calls. See BACKEND.md §7 —
 * both routes are specified and neither is built in production yet, so both
 * calls must survive a 404 without leaving someone believing their account is
 * gone when it is not.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, PauseCircle, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { errorText } from '../lib/errorText';
import { useApi } from '../state/api';
import { siteHome, siteLogin } from '../lib/site';
import { Button, Callout, Card, InputField } from './ui';

/**
 * Compare what was typed against the phrase, forgivingly but not loosely.
 *
 * The gate exists to make deletion deliberate, not to test transcription. So
 * case and stray spacing are forgiven, and in Arabic so are the alif that
 * carries a hamza and the diacritics a phone keyboard may or may not emit —
 * `احذف` and `إحذف` are the same instruction, and a person who cannot delete
 * their own account because their keyboard chose a different alif has been
 * locked out of a right, not protected from a mistake.
 *
 * Nothing here weakens the act: the words still have to be typed, in order, in
 * the language on screen.
 */
function normalise(s: string, locale: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase(locale)
    /* Arabic diacritics and the tatweel are decoration over the same letters. */
    .replace(/[ً-ْـ]/g, '')
    /* Every alif form, plus the two ya and the two ta marbuta spellings. */
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

type Act = 'deactivate' | 'delete';

export function CloseAccount() {
  const { t } = useI18n();
  const [act, setAct] = useState<Act | null>(null);

  return (
    <>
      <Card id="sec-close" className="card--danger">
        <div className="stack">
          <div className="section__head">
            <h2 className="section__title">
              <AlertTriangle size={18} aria-hidden="true" className="profile__icon profile__icon--danger" />
              {t('settings.closeTitle')}
            </h2>
          </div>

          {/* Reversible first. Ordering these the other way round would put the
              destructive act directly under the heading, where a person
              skimming to the end of the page lands. */}
          <div className="close__act">
            <div className="close__what">
              <h3 className="close__name">{t('settings.deactivateTitle')}</h3>
              <p className="text-sm">{t('settings.deactivateBody')}</p>
            </div>
            <button type="button" className="btn btn--secondary" onClick={() => setAct('deactivate')}>
              <PauseCircle size={16} aria-hidden="true" />
              {t('settings.deactivateAction')}
            </button>
          </div>

          <hr className="divider" />

          <div className="close__act">
            <div className="close__what">
              <h3 className="close__name">{t('settings.deleteTitle')}</h3>
              <p className="text-sm">{t('settings.deleteBody')}</p>
            </div>
            {/* The only filled danger button in the app. It opens the
                confirmation; it does not delete anything. */}
            <button type="button" className="btn btn--danger" onClick={() => setAct('delete')}>
              <Trash2 size={16} aria-hidden="true" />
              {t('settings.deleteAction')}
            </button>
          </div>
        </div>
      </Card>

      <ConfirmClose act={act} onClose={() => setAct(null)} />
    </>
  );
}

/**
 * The confirmation, for both acts.
 *
 * One component rather than two, because the SHAPE is the same — name the act,
 * list what happens to real things, ask, act — and only deletion adds the typed
 * gate. Two of these would have let the reversible one quietly lose the list
 * that makes either of them honest.
 */
function ConfirmClose({ act, onClose }: { act: Act | null; onClose: () => void }) {
  const { t, locale, formatNumber } = useI18n();
  const api = useApi();
  const ref = useRef<HTMLDialogElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destructive = act === 'delete';
  const phrase = t('settings.deletePhrase');
  const matches = normalise(typed, locale) === normalise(phrase, locale);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (act && !el.open) {
      setTyped('');
      setError(null);
      el.showModal();
      /**
       * FOCUS NEVER LANDS ON THE DESTRUCTIVE BUTTON. `showModal` gives focus to
       * the first focusable child, and a dialog that opens with "Delete
       * everything" already focused is one stray Enter away from doing it. It
       * goes to the field the person has to fill, or to the way out.
       */
      requestAnimationFrame(() => {
        (firstField.current ?? cancelBtn.current)?.focus();
      });
    }
    if (!act && el.open) el.close();
  }, [act]);

  /**
   * ESCAPE AND THE BACKDROP GO THROUGH THE SAME DOOR AS THE BUTTON.
   *
   * A real `cancel` listener rather than React's `onCancel` prop, which is what
   * `CourseSheet` already learned here: left to the platform the dialog closes
   * without React knowing, `act` stays set, and the next open call finds the
   * element already `open` and does nothing. So the native close is prevented
   * and the state is asked to close instead, which then calls `el.close()`
   * above — one path, whichever way the person leaves.
   *
   * While a request is in flight Escape does nothing at all. The account is
   * mid-change, and a dialog that vanishes at that moment leaves someone with
   * no idea whether it went through.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cancel = (e: Event) => {
      e.preventDefault();
      if (!busy) onClose();
    };
    el.addEventListener('cancel', cancel);
    return () => el.removeEventListener('cancel', cancel);
  }, [busy, onClose]);

  const run = useCallback(async () => {
    if (!act || busy) return;
    if (destructive && !matches) return;
    setBusy(true);
    setError(null);
    try {
      if (destructive) await api.deleteAccount();
      else await api.deactivateAccount();

      /**
       * THE SESSION IS ENDED, BUT NOT THROUGH `useAuth().logout()`, and the
       * difference is a bug that was live: that helper sets `user` to null,
       * React re-renders, and `RequireApp` sends the now-anonymous visitor to
       * the site's LOG IN page under its own steam. Two navigations then race
       * and one aborts — so someone who had just deleted their account landed
       * on a form asking them to sign in, roughly half the time.
       *
       * The server already cleared the cookie in the response above
       * (BACKEND.md §7 requires it), and a full page navigation discards every
       * bit of client state anyway, so the only thing `logout()` added here was
       * the race. The bare API call stays as insurance for a server that
       * forgets, and it touches no React state.
       */
      await api.logout().catch(() => { /* the session is already gone */ });

      /* Deleted, so there is no account to return to: the front door. Paused,
         so log in is the destination, because logging back in is literally
         what the copy above promised would restore it. */
      window.location.assign(destructive ? siteHome(locale) : siteLogin(locale));
    } catch (err: unknown) {
      /* NOTHING HAPPENED, AND IT HAS TO SAY SO. A failure here that closed the
         dialog would leave someone believing their account was deleted. */
      setError(errorText(err, { t, formatNumber }, { fallback: t('settings.closeFailed') }));
      setBusy(false);
    }
  }, [act, busy, destructive, matches, api, locale, t, formatNumber]);

  const titleId = 'close-confirm-title';

  return (
    <dialog
      className="sheet sheet--confirm"
      ref={ref}
      aria-labelledby={titleId}
      /* A click on the backdrop is a click on the dialog itself; the panel
         inside stops it travelling. Closing this way is safe because closing
         does nothing. */
      onClick={(e) => { if (e.target === ref.current && !busy) onClose(); }}
    >
      {act && (
        <div className="confirm">
          <div className="confirm__head">
            <span className="confirm__mark" data-danger={destructive || undefined} aria-hidden="true">
              {destructive ? <Trash2 size={20} /> : <PauseCircle size={20} />}
            </span>
            <h2 className="confirm__title" id={titleId}>
              {destructive ? t('settings.deleteConfirmTitle') : t('settings.deactivateConfirmTitle')}
            </h2>
          </div>

          <p>{destructive ? t('settings.deleteConfirmLead') : t('settings.deactivateConfirmLead')}</p>

          {/* THE LIST IS THE CONFIRMATION. "Are you sure" asks someone to
              agree to a consequence nobody named; this names them, in the
              product's own nouns, so the answer can be an informed one. */}
          <ul className="confirm__list">
            {(destructive
              ? ['deleteItemDocs', 'deleteItemProfile', 'deleteItemMatches', 'deleteItemChat', 'deleteItemAccount']
              : ['deactivateItemKept', 'deactivateItemStops', 'deactivateItemBack']
            ).map((key) => (
              <li key={key}>{t(`settings.${key}`)}</li>
            ))}
          </ul>

          {/* `Callout`, not a coloured paragraph. Danger text on the dark
              theme's surface measures 3.16:1 and fails AA outright, so the
              weight has to come from a tinted ground and an icon rather than
              from the hue of the words — which is also the rule about never
              encoding meaning in colour alone, arriving at the same answer. */}
          <Callout tone={destructive ? 'danger' : 'info'}>
            {destructive ? t('settings.deleteIrreversible') : t('settings.deactivateReversible')}
          </Callout>

          {destructive && (
            <InputField
              ref={firstField}
              label={t('settings.deleteTypeLabel', { phrase })}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
            />
          )}

          {error && (
            <p className="field__error" role="alert">
              <AlertTriangle size={14} aria-hidden="true" />
              {error}
            </p>
          )}

          <div className="confirm__actions">
            {/* The way out comes FIRST in the source, so it is the first thing
                a keyboard or screen reader user meets after the field. */}
            <button
              type="button"
              className="btn btn--ghost"
              ref={cancelBtn}
              onClick={onClose}
              disabled={busy}
            >
              {t('action.cancel')}
            </button>
            <span className="spacer" />
            <Button
              variant={destructive ? 'danger' : 'primary'}
              onClick={run}
              loading={busy}
              /* Disabled until the phrase is typed. It stays visibly a button
                 rather than disappearing, so the gate reads as a gate and not
                 as a missing control. */
              disabled={destructive && !matches}
            >
              {destructive ? t('settings.deleteConfirmAction') : t('settings.deactivateConfirmAction')}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}

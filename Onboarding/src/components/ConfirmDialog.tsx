/**
 * The confirmation before something a person cannot casually undo.
 *
 * ONE IMPLEMENTATION, THREE ACTS. Deactivating, deleting and cancelling a
 * subscription all need the same thing and it is not "are you sure": a list of
 * what actually happens, in the product's own nouns, because nobody can consent
 * to a consequence nobody named. Three copies of that would have diverged the
 * first time one was touched, and the one that lost its list would be the one
 * that mattered.
 *
 * WHY A DIALOG HERE AND NOWHERE ELSE. The craft rule is that a modal has to
 * earn interruption and protected focus. Erasing everything a person uploaded
 * earns both; removing one document out of a list does not, which is why
 * `DeleteDocument` still confirms in place with no dialog at all.
 *
 * It is a native `<dialog>`, so the focus trap, Escape, page inertness and the
 * top layer are the platform's job rather than this file's. What is NOT left to
 * the platform is where focus lands and what Escape does mid-request; both are
 * below, with the reasons.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { errorText } from '../lib/errorText';
import { Button, Callout, InputField } from './ui';

export interface ConfirmDialogProps {
  /** Null closes it. An object opens it, and its identity is not read again. */
  open: boolean;
  onClose: () => void;
  /** `danger` is for the irreversible one. It tints the mark, nothing else. */
  tone?: 'neutral' | 'danger';
  icon: LucideIcon;
  title: string;
  lead: string;
  /** What actually happens, one line each. This is the confirmation. */
  items: string[];
  /** The line under the list: what makes this reversible, or what does not. */
  note: string;
  /**
   * Require a phrase to be typed before the act becomes available.
   *
   * The gate is against a mis-tap, not a test of transcription — see
   * `matchesPhrase` for what it forgives and why it still counts as deliberate.
   */
  typePhrase?: { phrase: string; label: string };
  confirmLabel: string;
  /** May navigate away. If it throws, the dialog stays open and says so. */
  onConfirm: () => Promise<void>;
  /** Shown when `onConfirm` throws something with no message of its own. */
  errorFallback: string;
  /**
   * Withhold the confirm control entirely.
   *
   * For the case where the act is not available rather than not yet unlocked —
   * a token budget that will not cover the run. The `note` above has already
   * said what it costs and what is left, and a disabled button would add
   * nothing to that but a tap that fails.
   */
  hideConfirm?: boolean;
  /**
   * Present but not yet pressable — for the case where the act is coming
   * rather than unavailable. `hideConfirm` says "not on offer"; this says
   * "not yet", and a person waiting on a price needs to be told which.
   */
  confirmDisabled?: boolean;
  /**
   * A third choice beside Cancel, for the cases where leaving and declining are
   * different answers. "Remind me later" is a decision about the future;
   * closing the dialog is not, and collapsing them would silently record one as
   * the other.
   */
  secondary?: { label: string; onSelect: () => void };
  /** An error the CALLER owns, shown in the same place as the dialog's own. */
  error?: string | null;
  /** Extra content between the note and the controls. Rarely needed. */
  children?: ReactNode;
}

/**
 * Compare what was typed against the phrase, forgivingly but not loosely.
 *
 * Case and stray spacing are forgiven, and in Arabic so are the alif that
 * carries a hamza and the diacritics a phone keyboard may or may not emit —
 * `احذف` and `إحذف` are the same instruction, and a person who cannot delete
 * their own account because their keyboard chose a different alif has been
 * locked out of a right, not protected from a mistake.
 *
 * Nothing here weakens the act: the words still have to be typed, in order, in
 * the language on screen.
 */
function matchesPhrase(typed: string, phrase: string, locale: string): boolean {
  const clean = (s: string) => s
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase(locale)
    /* Arabic diacritics and the tatweel are decoration over the same letters. */
    .replace(/[ً-ْـ]/g, '')
    /* Every alif form, plus the two ya and the two ta marbuta spellings. */
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
  return clean(typed) === clean(phrase);
}

export function ConfirmDialog({
  open, onClose, tone = 'neutral', icon: Icon, title, lead, items, note,
  typePhrase, confirmLabel, onConfirm, errorFallback, hideConfirm, confirmDisabled,
  secondary, error: externalError, children,
}: ConfirmDialogProps) {
  const { t, locale, formatNumber } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const danger = tone === 'danger';
  const gated = Boolean(typePhrase);
  const unlocked = !typePhrase || matchesPhrase(typed, typePhrase.phrase, locale);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setTyped('');
      setError(null);
      setBusy(false);
      el.showModal();
      /**
       * FOCUS NEVER LANDS ON THE DESTRUCTIVE BUTTON. `showModal` gives focus to
       * the first focusable child, and a dialog that opens with "Delete
       * everything" already focused is one stray Enter away from doing it. It
       * goes to the field the person has to fill, or to the way out.
       */
      requestAnimationFrame(() => { (field.current ?? cancelBtn.current)?.focus(); });
    }
    if (!open && el.open) el.close();
  }, [open]);

  /**
   * ESCAPE AND THE BACKDROP GO THROUGH THE SAME DOOR AS THE BUTTON.
   *
   * A real `cancel` listener rather than React's `onCancel` prop, which is what
   * `CourseSheet` already learned here: left to the platform the dialog closes
   * without React knowing, the caller's state stays open, and the next open
   * call finds the element already `open` and does nothing. So the native close
   * is prevented and the state is asked to close instead, which then calls
   * `el.close()` above — one path, whichever way the person leaves.
   *
   * While a request is in flight Escape does nothing at all. The account is
   * mid-change, and a dialog that vanishes at that moment leaves someone with
   * no idea whether it went through.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cancel = (e: Event) => { e.preventDefault(); if (!busy) onClose(); };
    el.addEventListener('cancel', cancel);
    return () => el.removeEventListener('cancel', cancel);
  }, [busy, onClose]);

  const run = useCallback(async () => {
    if (busy || !unlocked) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: unknown) {
      /* NOTHING HAPPENED, AND IT HAS TO SAY SO. A failure that closed the
         dialog would leave someone believing the act went through. */
      setError(errorText(err, { t, formatNumber }, { fallback: errorFallback }));
      setBusy(false);
    }
  }, [busy, unlocked, onConfirm, errorFallback, t, formatNumber]);

  /**
   * PER INSTANCE, because more than one of these is mounted at a time. Closing
   * the account renders both its dialogs together and only opens one — with a
   * hard-coded id that put two `id="confirm-title"` nodes in the same document,
   * so every `aria-labelledby` on the page resolved to whichever came first.
   */
  const titleId = useId();

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
      {open && (
        <div className="confirm">
          <div className="confirm__head">
            <span className="confirm__mark" data-danger={danger || undefined} aria-hidden="true">
              <Icon size={20} />
            </span>
            <h2 className="confirm__title" id={titleId}>{title}</h2>
          </div>

          <p>{lead}</p>

          <ul className="confirm__list">
            {items.map((line) => <li key={line}>{line}</li>)}
          </ul>

          {/* `Callout`, not a coloured paragraph. Danger text on the dark
              theme's surface measures 3.16:1 and fails AA outright, so the
              weight comes from a tinted ground and an icon rather than from the
              hue of the words — which is also the rule about never encoding
              meaning in colour alone, arriving at the same answer. */}
          <Callout tone={danger ? 'danger' : 'info'}>{note}</Callout>

          {children}

          {typePhrase && (
            <InputField
              ref={field}
              label={typePhrase.label}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
            />
          )}

          {(externalError ?? error) && (
            <p className="field__error" role="alert">
              <AlertTriangle size={14} aria-hidden="true" />
              {externalError ?? error}
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
            {secondary && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={secondary.onSelect}
                disabled={busy}
              >
                {secondary.label}
              </button>
            )}
            <span className="spacer" />
            {!hideConfirm && (
              <Button
                variant={danger ? 'danger' : 'primary'}
                onClick={run}
                loading={busy}
                /* Disabled until the phrase is typed. It stays visibly a button
                   rather than disappearing, so the gate reads as a gate and not
                   as a missing control. */
                disabled={confirmDisabled || (gated && !unlocked)}
              >
                {confirmLabel}
              </Button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

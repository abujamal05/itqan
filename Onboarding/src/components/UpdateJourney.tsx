/**
 * "Your journey is out of date. Bringing it up to date costs N tokens."
 *
 * ONE PROMPT, EVERY PATH. Replacing a document, editing a skill and finishing a
 * course all leave the same thing stale and all end here, so there is one place
 * that knows what a run costs, what it will do, and what to say when the budget
 * will not cover it. Three prompts would have drifted, and the one that drifted
 * would be the one asking somebody to spend.
 *
 * THE COST IS ALWAYS ON SCREEN BEFORE THE YES. Not in a tooltip, not after the
 * tap. It is the second line of the confirmation, next to what is left, because
 * "19 tokens" means nothing without "of the 30 you have today".
 *
 * WHEN IT CANNOT BE AFFORDED THE ANSWER IS THE NUMBERS, NOT A DISABLED BUTTON.
 * The dialog says what it costs, what is left, and when the pool refills, and
 * the run control is simply not offered — a greyed button would invite a tap
 * and then refuse it while explaining nothing.
 */
import { useCallback, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n';
import { errorText } from '../lib/errorText';
import { isOffered, useUpdate } from '../state/update';
import { Button, Card } from './ui';
import { ConfirmDialog } from './ConfirmDialog';

/**
 * The banner, which is the ambient half: it sits under the app chrome wherever
 * the person happens to be, exactly like the pipeline's own progress does, so
 * an out of date journey is not a thing you have to visit a screen to discover.
 */
export function UpdateBanner() {
  const { t, formatNumber } = useI18n();
  const { pending, running, silenced } = useUpdate();
  const [open, setOpen] = useState(false);

  if (!isOffered(pending, silenced) || running) return null;

  return (
    <>
      <Card className="card--sunken card--accent update">
        <div className="update__body">
          <div className="stack stack--sm update__what">
            <span className="eyebrow">
              <Sparkles size={15} aria-hidden="true" />
              {t('update.title')}
            </span>
            <p className="text-sm">{t(`update.scope.${pending.scope}`)}</p>
          </div>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <RefreshCw size={16} aria-hidden="true" />
            {/* The price is on the control, not only inside the dialog it
                opens: someone deciding whether to tap is deciding whether to
                spend, and that is the moment the number is worth having. */}
            {t('update.cta', { n: formatNumber(pending.cost) })}
          </Button>
        </div>
      </Card>

      <UpdateDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The confirmation, shared by the banner and by the course flow.
 *
 * `onDeferred` is what the course flow passes to keep its own promise: "remind
 * me later" there means the next sign-in, and the caller may want to say so.
 */
export function UpdateDialog({
  open, onClose, lead,
}: {
  open: boolean;
  onClose: () => void;
  /** Overrides the opening line, so the course flow can name what it just did. */
  lead?: string;
}) {
  const { t, formatNumber } = useI18n();
  const { pending, run, defer } = useUpdate();
  const [error, setError] = useState<string | null>(null);

  const confirm = useCallback(async () => {
    setError(null);
    try {
      await run();
      onClose();
    } catch (err: unknown) {
      /* The server's own refusal, with its numbers in it: `errorText` turns a
         `token_limit` into "that costs 19 and you have 8 left today". A
         generic sentence here would hide the only fact that matters. */
      setError(errorText(err, { t, formatNumber }, { fallback: t('update.failed') }));
      throw err;
    }
  }, [run, onClose, t, formatNumber]);

  const scope = pending.scope ?? 'skills';

  /**
   * What the run will actually do, in the person's own nouns.
   *
   * The two scopes say different things because they ARE different work, and
   * the difference is what the person is paying for. Saying "we will update
   * your results" for both would make the cheaper one look like the expensive
   * one and leave nobody able to tell why they differ.
   */
  const items = scope === 'documents'
    ? [t('update.docsItemRead'), t('update.docsItemSkills'), t('update.docsItemRest')]
    : [t('update.skillsItemFrom'), t('update.skillsItemRest'), t('update.skillsItemKeep')];

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      icon={RefreshCw}
      title={t('update.confirmTitle')}
      lead={lead ?? t(`update.scope.${scope}`)}
      items={items}
      note={pending.affordable
        ? t('update.cost', {
          cost: formatNumber(pending.cost),
          remaining: formatNumber(pending.remaining),
        })
        : t('update.cannotAfford', {
          cost: formatNumber(pending.cost),
          remaining: formatNumber(pending.remaining),
        })}
      confirmLabel={t('update.confirmAction')}
      onConfirm={confirm}
      errorFallback={t('update.failed')}
      /* NOT OFFERED WHEN IT CANNOT BE PAID FOR. The note above has already
         said what it costs and what is left; a button that fails on press
         would add nothing to that but a wasted tap. */
      hideConfirm={!pending.affordable}
      secondary={{ label: t('update.later'), onSelect: () => { defer(); onClose(); } }}
      error={error}
    />
  );
}

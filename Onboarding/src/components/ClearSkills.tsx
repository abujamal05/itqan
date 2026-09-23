/**
 * Delete every skill on the account.
 *
 * A REAL DIALOG, not the confirm-in-place that `DeleteDocument` uses, and the
 * line between them is how much is lost. One file out of a list is replaceable —
 * the person still has it, and re-uploading takes a minute. This is every skill
 * the pipeline extracted plus everything they typed by hand, and it takes the
 * matches and the readiness score with it. That earns the same treatment as
 * closing the account.
 *
 * THE DIALOG SAYS WHAT SURVIVES, which is the part people actually need. A
 * destructive confirm that lists only what it destroys leaves somebody guessing
 * whether their documents and their finished courses are about to go too — and
 * guessing, they either click through it or abandon something they meant to do.
 * Both are worse than a longer sentence.
 *
 * No `typePhrase` gate, deliberately, where closing the account has one. This is
 * recoverable in the way that matters: the documents are still on file, so a
 * re-read rebuilds the extracted skills. Making somebody type a phrase for an
 * act they can undo by pressing "read my documents again" is ceremony, and
 * ceremony everywhere is how a real gate stops being read.
 */
import { useCallback, useState } from 'react';
import { Eraser } from 'lucide-react';
import { useI18n } from '../i18n';
import { useApi } from '../state/api';
import { Button, Card } from './ui';
import { ConfirmDialog } from './ConfirmDialog';

export function ClearSkills({ count, onCleared }: {
  /** How many skills are on the profile, so the dialog can name the number. */
  count?: number;
  onCleared: () => void;
}) {
  const { t, formatNumber } = useI18n();
  const api = useApi();
  const [open, setOpen] = useState(false);

  const clear = useCallback(async () => {
    await api.clearSkills();
    setOpen(false);
    onCleared();
  }, [api, onCleared]);

  return (
    <>
      <Card>
        <div className="stack stack--sm">
          <h2 className="section__title">{t('skills.clearTitle')}</h2>
          <p className="text-sm muted">{t('skills.clearLead')}</p>
          <div className="row">
            <Button variant="secondary" onClick={() => setOpen(true)}>
              <Eraser size={16} aria-hidden="true" />
              {t('skills.clearAction')}
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        tone="danger"
        icon={Eraser}
        title={t('skills.clearConfirmTitle')}
        lead={typeof count === 'number' && count > 0
          ? t('skills.clearConfirmLead', { n: formatNumber(count) })
          : t('skills.clearConfirmLeadPlain')}
        items={[
          t('skills.clearItemSkills'),
          t('skills.clearItemResults'),
          /* What SURVIVES, in the same list and stated as plainly. */
          t('skills.clearItemKeepsDocs'),
          t('skills.clearItemKeepsCourses'),
        ]}
        note={t('skills.clearNote')}
        confirmLabel={t('skills.clearConfirmAction')}
        onConfirm={clear}
        errorFallback={t('skills.clearFailed')}
      />
    </>
  );
}

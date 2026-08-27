/**
 * Remove one document, from the list and from the server's disk.
 *
 * TWO TAPS, not one, and this is a deliberate reading of "an X that deletes it".
 * The file is somebody's CV, the delete is irreversible, and the control sits in
 * a row they are otherwise only reading — so a mis-tap would destroy something
 * they cannot get back without finding the original again.
 *
 * It is still one control and no dialog: the X becomes a short confirm in place,
 * and moving the pointer away puts it back. That costs a deliberate user one
 * extra tap and saves an accidental one entirely. The account-level acts in
 * `CloseAccount` earn a real dialog; one file out of a list does not.
 *
 * Lives here rather than inside a screen because the document list moved to
 * Settings and this moved with it; a copy left behind on Profile would have
 * been a second implementation of an irreversible control.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n';
import { HttpError } from '../api/http';
import { useApi } from '../state/api';

export function DeleteDocument({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const { t } = useI18n();
  const api = useApi();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  if (busy) return <span className="text-sm muted">{t('profile.doc.removing')}</span>;

  /* The server refused, and it said why.
     This used to be a `try/finally` with no `catch`: the request threw, the
     spinner stopped, the document stayed, and nothing on screen said anything.
     Pressing a button and watching nothing happen is the worst of the available
     outcomes — worse than an error, because there is nothing to act on. */
  if (refused) {
    return <span className="text-sm doc-remove__refused" role="alert">{refused}</span>;
  }

  if (confirming) {
    return (
      <span className="doc-remove">
        <button
          type="button"
          className="doc-remove__yes"
          onClick={async () => {
            setBusy(true);
            try {
              await api.deleteDocument(id);
              onDeleted();
            } catch (err: unknown) {
              /* `last_cv` is the one refusal a person can act on: it means this
                 is the only CV and the pipeline cannot run without one, so the
                 way out is to upload a replacement FIRST and then remove this.
                 The interface normally hides the control on the only CV, so
                 reaching this means a stale view — which is exactly why the
                 server enforces it too. */
              const code = err instanceof HttpError ? err.code : undefined;
              setRefused(code === 'last_cv'
                ? t('profile.doc.lastCv')
                : t('profile.doc.removeFailed'));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('profile.doc.removeConfirm')}
        </button>
        <button type="button" className="doc-remove__no" onClick={() => setConfirming(false)}>
          {t('action.cancel')}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="doc-remove__x"
      aria-label={t('profile.doc.remove')}
      title={t('profile.doc.remove')}
      onClick={() => setConfirming(true)}
    >
      <X size={16} aria-hidden="true" />
    </button>
  );
}

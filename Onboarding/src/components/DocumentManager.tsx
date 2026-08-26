/**
 * The documents Itqan holds, and what a person may do to them.
 *
 * THREE ACTS, AND REPLACE IS THE ONE THAT WAS MISSING. Until now the only way
 * to correct a document was to remove it and upload another, which is a
 * detour for anything and impossible for the CV: it may not be removed while it
 * is the only one, and it is always the only one. So a wrong or outdated CV had
 * no fix at all. Replacing keeps the row and its id, which is what a stored
 * profile's `documentId` and every past analysis refer to.
 *
 * ONE CV, AND THE RULE HAS TWO HALVES. It cannot reach zero, because the
 * pipeline cannot run without it; it cannot reach two, because a second would
 * make "your CV" ambiguous for every screen that names it. So the CV row shows
 * its category as a fixed tag rather than a select, and every other row has `cv`
 * disabled in its own. Neither is a control that refuses a click: one is a
 * label, and a disabled option is the conventional way a select says a value is
 * taken.
 *
 * NOTHING HERE READS ANYTHING. Extraction is a separate, paid, reviewed act
 * started from the documents screen — a file swap that quietly spent 19 tokens
 * and rewrote someone's skills is precisely what this product's confirm step
 * exists to prevent. The status line after a replace says so.
 */
import { useCallback, useRef, useState } from 'react';
import { FileText, RotateCw } from 'lucide-react';
import { useI18n } from '../i18n';
import { errorText } from '../lib/errorText';
import { fileSize } from '../lib/fileSize';
import { HttpError } from '../api/http';
import { useApi } from '../state/api';
import { DOCUMENT_KINDS, REQUIRED_KIND } from '../api';
import type { DocumentKind, UploadedDocument } from '../api';
import { DeleteDocument } from './DeleteDocument';

/** The same ceiling the upload screen enforces, from the same reason. */
const MAX_BYTES = 10 * 1024 * 1024;

export function DocumentManager({
  documents, onChanged,
}: {
  documents: UploadedDocument[];
  /** Re-reads the profile, so the list reflects what the server now holds. */
  onChanged: () => void;
}) {
  const { t, formatNumber } = useI18n();
  const api = useApi();

  /** Which row is mid-request, and how far through, so only it goes busy. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* One hidden input, retargeted, rather than one per row: a file input per
     document would put N invisible controls in the tab order for no reason. */
  const picker = useRef<HTMLInputElement>(null);
  const replacing = useRef<string | null>(null);

  const cvId = documents.find((d) => d.kind === REQUIRED_KIND)?.id ?? null;

  const askForFile = useCallback((id: string) => {
    replacing.current = id;
    setError(null);
    setStatus(null);
    picker.current?.click();
  }, []);

  const replace = useCallback(async (file: File | undefined) => {
    const id = replacing.current;
    replacing.current = null;
    if (!id || !file) return;

    /* Checked here as a courtesy and refused by the server regardless. The
       message names the limit rather than the file, because the person already
       knows which file they chose. */
    if (file.size > MAX_BYTES) { setError(t('upload.errSize')); return; }
    if (file.size === 0) { setError(t('upload.errEmpty')); return; }

    setBusyId(id);
    setProgress(0);
    try {
      await api.replaceDocument({ id, file, onProgress: setProgress });
      /* SAYS WHAT DID NOT HAPPEN, TOO. The file is swapped and nothing has read
         it; someone who assumed otherwise would go on believing their skills
         reflect a CV Itqan has never seen. */
      setStatus(t('docs.replacedNoRead'));
      onChanged();
    } catch (err: unknown) {
      setError(errorText(err, { t, formatNumber }, { fallback: t('docs.replaceFailed') }));
    } finally {
      setBusyId(null);
    }
  }, [api, onChanged, t, formatNumber]);

  const changeKind = useCallback(async (id: string, kind: DocumentKind) => {
    setBusyId(id);
    setError(null);
    setStatus(null);
    try {
      await api.updateDocumentKind(id, kind);
      setStatus(t('docs.kindSaved', { kind: t(`doc.${kind}`) }));
      onChanged();
    } catch (err: unknown) {
      /* `cv_exists` is the one refusal a person can act on: the slot is taken,
         and the way to change which file is the CV is to replace it. The
         interface disables the option, so reaching this means a stale view —
         which is exactly why the server checks as well. */
      const code = err instanceof HttpError ? err.code : undefined;
      setError(code === 'cv_exists'
        ? t('docs.cvTaken')
        : errorText(err, { t, formatNumber }, { fallback: t('docs.kindFailed') }));
    } finally {
      setBusyId(null);
    }
  }, [api, onChanged, t, formatNumber]);

  if (documents.length === 0) return <p className="text-sm muted">{t('profile.noDocuments')}</p>;

  return (
    <>
      <input
        ref={picker}
        type="file"
        className="sr-only"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
        onChange={(e) => { void replace(e.target.files?.[0]); e.target.value = ''; }}
      />

      <ul className="doclist">
        {documents.map((d) => {
          const isCv = d.id === cvId;
          const busy = busyId === d.id;

          return (
            <li key={d.id} className="doclist__item" data-busy={busy || undefined}>
              <div className="doclist__head">
                <FileText size={16} className="doclist__icon" aria-hidden="true" />
                <span className="doclist__main">
                  <span className="doclist__name"><bdi>{d.fileName}</bdi></span>
                  <span className="doclist__meta num">
                    {Number.isFinite(d.sizeBytes) && d.sizeBytes > 0
                      ? fileSize(d.sizeBytes, t, formatNumber)
                      : ''}
                  </span>
                </span>
              </div>

              {/* Identity above, controls beneath, one layout at every width —
                  the same arrangement the upload screen arrived at, and for the
                  same measured reason: the category select needs about 12rem to
                  show its longest option, which does not fit beside a filename
                  and two buttons on a phone. */}
              <div className="doclist__controls">
                {isCv ? (
                  /* A LABEL, NOT A DISABLED SELECT. There is exactly one CV and
                     it is required, so its category has no other value to take;
                     a select that cannot change is a control pretending to be
                     one. The tag says what it is and that it is required in the
                     same breath. */
                  <span className="doclist__tag">
                    {t('doc.cv')} · {t('profile.docRequired')}
                  </span>
                ) : (
                  <>
                    <label className="sr-only" htmlFor={`kind-${d.id}`}>
                      {t('upload.kindLabel')}
                    </label>
                    <select
                      id={`kind-${d.id}`}
                      className="select"
                      value={d.kind}
                      disabled={busy}
                      onChange={(e) => void changeKind(d.id, e.target.value as DocumentKind)}
                    >
                      {DOCUMENT_KINDS.map((k) => (
                        <option
                          key={k}
                          value={k}
                          /* Taken. The option stays visible so the category is
                             known to exist and known to be spoken for. */
                          disabled={k === REQUIRED_KIND && cvId !== null}
                        >
                          {t(`doc.${k}`)}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <span className="spacer" />

                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => askForFile(d.id)}
                  disabled={busy}
                >
                  <RotateCw size={15} aria-hidden="true" />
                  {t('docs.replace')}
                </button>

                {/* The CV keeps no remove control: it cannot reach zero, and
                    there is never a second one to make this one removable. */}
                {!isCv && <DeleteDocument id={d.id} onDeleted={onChanged} />}
              </div>

              {busy && (
                <div className="doclist__progress">
                  <div className="meter"><i style={{ inlineSize: `${Math.round(progress * 100)}%` }} /></div>
                  <span className="doclist__status num">
                    {t('docs.replacing')} {formatNumber(Math.round(progress * 100))}%
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Outlives the row it describes, and polite, so it never pulls focus off
          whatever the person is reading. */}
      {status && <p className="text-sm" role="status" aria-live="polite">{status}</p>}
      {error && (
        <p className="field__error" role="alert">{error}</p>
      )}
    </>
  );
}

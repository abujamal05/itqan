/**
 * Multi-document upload.
 *
 * The shape of this screen is one decision: a SINGLE drop area, not one slot
 * per document type. Six labelled dropzones would state the taxonomy clearly
 * and make the screen a wall of empty boxes, most of which most users will
 * never fill. Instead files come in however they arrive — dragged in a batch,
 * picked one at a time, photographed on a phone — and each lands as a row that
 * says what Itqan thinks it is, which the user can correct in one tap.
 *
 * The kind is guessed from the filename because people name these files
 * predictably ("CV_2025.pdf", "transcript.pdf"). A guess the user can see and
 * override beats an empty required dropdown they must fill six times.
 *
 * Only the CV is required, and the requirement is stated where it is
 * felt — on the disabled Continue button — rather than as an asterisk they
 * have to hunt for.
 *
 * Failure is per file, not per screen: one rejected file never discards the
 * others, and each row carries its own retry.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Check, FileText, Image as ImageIcon, Paperclip, RotateCw, Upload as UploadIcon, X,
} from 'lucide-react';
import { useI18n } from '../i18n';
import { DeleteDocument } from './DeleteDocument';
import { fileSize } from '../lib/fileSize';
import { DOCUMENT_KINDS, REQUIRED_KIND, normaliseKind } from '../api';
import { HttpError } from '../api/http';
import { errorText } from '../lib/errorText';
import type { DocumentKind, UploadedDocument } from '../api';
import { useApi } from '../state/api';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*';
const OK_EXT = /\.(pdf|png|jpe?g|webp|docx?)$/i;

/**
 * Filename hints, most specific first.
 *
 * Note the CV pattern does not use \b: real filenames are "CV_Maryam_2025.pdf",
 * and an underscore is a word character, so \bcv\b would never fire on exactly
 * the names people actually use. The separator class is explicit instead.
 */
/**
 * Only two kinds exist, so this is one question: is it a transcript?
 * Anything else is treated as the CV, because that is the document the screen
 * is asking for and the one the flow is blocked on — and the guess is shown
 * in a dropdown the user can correct in one tap, so a wrong guess costs a tap
 * rather than a failed run.
 */
const TRANSCRIPT_HINTS = /transcript|kashf|كشف|درجات|marks|grades|academic|record/i;

const guessKind = (name: string): DocumentKind =>
  (TRANSCRIPT_HINTS.test(name) ? 'transcript' : 'cv');

/**
 * A row in the list. `file` is absent for documents restored from saved
 * progress: those are already stored server-side, and a File object cannot
 * survive a reload. Everything the row displays therefore lives on the item
 * itself rather than being read back off a File that may not be there.
 */
export interface Item {
  localId: string;
  name: string;
  sizeBytes: number;
  kind: DocumentKind;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  /** Object URL for image previews; revoked on removal. */
  preview?: string;
  /** Present only for files picked in this session, so retry needs it. */
  file?: File;
  uploaded?: UploadedDocument;
}

/** Rebuilds rows for documents that were already uploaded in a past session. */
export const itemsFromDocuments = (docs: UploadedDocument[]): Item[] =>
  docs.map((d) => ({
    localId: d.id,
    name: d.fileName,
    sizeBytes: d.sizeBytes,
    kind: normaliseKind(d.kind),
    progress: 1,
    status: 'done',
    uploaded: d,
  }));

const uid = () => Math.random().toString(36).slice(2);

export function DocumentUpload({
  items, setItems,
}: {
  items: Item[];
  setItems: React.Dispatch<React.SetStateAction<Item[]>>;
}) {
  const { t, formatNumber } = useI18n();
  const api = useApi();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  // Object URLs are a leak if they outlive their row.
  useEffect(() => () => { items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  const send = useCallback(async (item: Item) => {
    if (!item.file) return;                       // restored rows are already stored
    try {
      const uploaded = await api.uploadDocument({
        file: item.file,
        kind: item.kind,
        onProgress: (p) => setItems((cur) =>
          cur.map((i) => (i.localId === item.localId ? { ...i, progress: p } : i))),
      });
      /* ONE ROW PER DOCUMENT, and the server decides which document this is.
         Uploading a CV when the account already has one REPLACES it and comes
         back carrying the existing id, so without this the screen showed the
         old filename and the new one as two rows of a single document. */
      setItems((cur) => cur
        .filter((i) => i.localId === item.localId || i.uploaded?.id !== uploaded.id)
        .map((i) => (i.localId === item.localId
          ? { ...i, status: 'done', progress: 1, uploaded }
          : i)));
    } catch (err: unknown) {
      /* A REFUSAL IS NOT A FAILURE TO RETRY, and this row could not tell the
         two apart: every outcome rendered as "Something went wrong" beside a
         retry button, including the ones retrying could only meet again. If the
         SERVER answered, its reason is shown and the retry is withheld; if
         nothing answered, the generic line and the retry are still right.
         `error` was on `Item` from the start and had never once been set. */
      const answered = err instanceof HttpError && err.status > 0;
      setItems((cur) => cur.map((i) => (i.localId === item.localId
        ? {
          ...i,
          status: 'error',
          error: answered
            ? errorText(err, { t, formatNumber }, { fallback: t('state.errorTitle') })
            : undefined,
        }
        : i)));
    }
  }, [api, setItems, t, formatNumber]);

  const accept = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const bad: string[] = [];
    const fresh: Item[] = [];

    Array.from(files).forEach((file) => {
      if (!OK_EXT.test(file.name)) return bad.push(`${file.name}: ${t('upload.errType')}`);
      if (file.size > MAX_BYTES) return bad.push(`${file.name}: ${t('upload.errSize')}`);
      if (file.size === 0) return bad.push(`${file.name}: ${t('upload.errEmpty')}`);
      fresh.push({
        localId: uid(),
        name: file.name,
        sizeBytes: file.size,
        file,
        kind: guessKind(file.name),
        progress: 0,
        status: 'uploading',
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      });
    });

    setRejected(bad);
    if (fresh.length) {
      setItems((cur) => [...cur, ...fresh]);
      fresh.forEach((i) => void send(i));
    }
  }, [send, setItems, t]);

  const remove = (localId: string) => setItems((cur) => {
    const hit = cur.find((i) => i.localId === localId);
    if (hit?.preview) URL.revokeObjectURL(hit.preview);
    return cur.filter((i) => i.localId !== localId);
  });

  /**
   * Correct a document's category, and make it STICK.
   *
   * The kind is guessed from the filename and the file is uploaded with that
   * guess immediately, so this dropdown is how a wrong guess gets corrected —
   * and it only ever changed local state. The row on the server kept the guess,
   * so a transcript filed as a CV stayed one: it came back wrong on the next
   * reload, and the pipeline read it as the wrong kind of document.
   *
   * That matters more now that uploading a CV REPLACES the held one: a
   * transcript mis-guessed as a CV would take the real CV's place, and putting
   * the dropdown right has to be able to undo that.
   *
   * Optimistic, then reverted if the server refuses — `cv_exists` when another
   * document already holds the slot, `last_cv` when this IS the CV. Both are
   * states the interface tries to prevent, so arriving here means a stale view,
   * and the revert is what stops the screen showing a category the account does
   * not have.
   */
  const changeKind = async (localId: string, kind: DocumentKind) => {
    const hit = items.find((i) => i.localId === localId);
    const was = hit?.kind;
    setItems((cur) => cur.map((i) => (i.localId === localId ? { ...i, kind } : i)));

    const id = hit?.uploaded?.id;
    if (!id) return;                    // not on the server yet; it uploads with this kind
    try {
      setRejected([]);
      await api.updateDocumentKind(id, kind);
    } catch (err: unknown) {
      setItems((cur) => cur.map((i) => (i.localId === localId ? { ...i, kind: was ?? i.kind } : i)));
      const code = err instanceof HttpError ? err.code : undefined;
      setRejected([code === 'cv_exists' ? t('docs.cvTaken')
                   : code === 'last_cv' ? t('docs.cvRequired')
                   : t('docs.kindFailed')]);
    }
  };

  const retry = (localId: string) => {
    const hit = items.find((i) => i.localId === localId);
    if (!hit?.file) return;
    setItems((cur) => cur.map((i) =>
      i.localId === localId ? { ...i, status: 'uploading', progress: 0 } : i));
    void send({ ...hit, status: 'uploading', progress: 0 });
  };

  return (
    <div className="stack">
      <div
        className="drop"
        role="button"
        tabIndex={0}
        data-over={over || undefined}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); }
        }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); accept(e.dataTransfer.files); }}
      >
        <span className="drop__icon"><UploadIcon size={24} aria-hidden="true" /></span>
        <span className="drop__title">{t('upload.drop')}</span>
        <span className="drop__hint">{t('upload.browse')}</span>
        <div className="formats" aria-hidden="true">
          <span className="format"><FileText size={14} /> {t('upload.formatPdf')}</span>
          <span className="format"><ImageIcon size={14} /> {t('upload.formatImage')}</span>
          <span className="format"><Paperclip size={14} /> {t('upload.formatDoc')}</span>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => { accept(e.target.files); e.target.value = ''; }}
      />

      {rejected.length > 0 && (
        <div className="callout callout--danger" role="alert">
          <AlertCircle size={18} className="callout__icon" aria-hidden="true" />
          <ul className="stack stack--sm">
            {rejected.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}

      {/* Each row is stacked rather than three columns side by side. The kind
          select needs about 12rem to show its longest option, which does not
          fit beside a thumbnail and two buttons on a narrow phone: it used to
          overflow its column and collide with the remove button. Identity on
          top, controls beneath, one layout at every width. */}
      {items.length > 0 && (
        <ul className="docs">
          {items.map((i) => (
            <li key={i.localId} className="doc" data-status={i.status}>
              <div className="doc__head">
                <span className="doc__thumb">
                  {i.preview
                    ? <img src={i.preview} alt={t('upload.previewOf', { name: i.name })} />
                    : <FileText size={20} aria-hidden="true" />}
                </span>

                <p className="doc__name"><bdi>{i.name}</bdi></p>

                <div className="doc__actions">
                  {/* Retry only where retrying could work. A refusal the
                      server explained will be refused identically. */}
                  {i.status === 'error' && i.file && !i.error && (
                    <button
                      type="button" className="btn btn--secondary btn--icon"
                      onClick={() => retry(i.localId)} aria-label={t('upload.retry')}
                    >
                      <RotateCw size={16} aria-hidden="true" />
                    </button>
                  )}
                  {/* A stored document is deleted on the SERVER, through the
                      control Settings already uses. This × used to filter the
                      row out of local state and send nothing, so the file and
                      its row survived and the document was back on the next
                      reload — a remove that removed nothing.

                      `DeleteDocument` rather than a second implementation: it
                      confirms in place, and it is the one that already knows
                      what to do when the server answers `last_cv`. Its own
                      docstring asks not to be copied, having been copied once
                      already.

                      A row with no id has nothing on the server yet — a failed
                      or in-flight upload — so for those the local drop IS the
                      whole of it. */}
                  {i.uploaded?.id ? (
                    <DeleteDocument
                      id={i.uploaded.id}
                      onDeleted={() => remove(i.localId)}
                    />
                  ) : (
                    <button
                      type="button" className="btn btn--secondary btn--icon"
                      onClick={() => remove(i.localId)}
                      aria-label={`${t('action.remove')}: ${i.name}`}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <div className="doc__meta">
                <label className="sr-only" htmlFor={`kind-${i.localId}`}>
                  {t('upload.kindLabel')}
                </label>
                <select
                  id={`kind-${i.localId}`}
                  className="select"
                  value={i.kind}
                  onChange={(e) => changeKind(i.localId, e.target.value as DocumentKind)}
                >
                  {DOCUMENT_KINDS.map((k) => (
                    <option key={k} value={k}>{t(`doc.${k}`)}</option>
                  ))}
                </select>
                <span className="doc__size num">
                  {fileSize(i.sizeBytes, t, formatNumber)}
                </span>
              </div>

              {i.status === 'uploading' && (
                <div className="doc__progress">
                  <div className="meter"><i style={{ inlineSize: `${Math.round(i.progress * 100)}%` }} /></div>
                  <span className="doc__status num">
                    {t('upload.uploading')} {formatNumber(Math.round(i.progress * 100))}%
                  </span>
                </div>
              )}
              {i.status === 'done' && (
                <span className="doc__status doc__status--ok">
                  <Check size={14} aria-hidden="true" /> {t('upload.done')}
                </span>
              )}
              {i.status === 'error' && (
                <span className="doc__status doc__status--bad">
                  <AlertCircle size={14} aria-hidden="true" /> {i.error ?? t('state.errorTitle')}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Named for the RULE, not for one document: the required kind is `cv`, and a
 *  helper called hasTranscript would be a lie the next reader has to discover. */
export const hasRequiredDocument = (items: Item[]) =>
  items.some((i) => i.kind === REQUIRED_KIND && i.status === 'done');
export const anyUploading = (items: Item[]) => items.some((i) => i.status === 'uploading');

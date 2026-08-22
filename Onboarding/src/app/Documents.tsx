/**
 * Documents — where a user who has already finished onboarding replaces their
 * documents.
 *
 * It exists as its own route rather than reusing /upload because /upload is
 * behind RequireOnboarding, which by design bounces a finished user to the
 * dashboard: onboarding is a gate you pass once, and re-opening it would be the
 * "returning user feels forgotten" bug the guards exist to prevent. This is the
 * same upload component in a screen that belongs to the signed-in product.
 *
 * The flow deliberately ends at /confirm rather than silently replacing the
 * profile. Re-reading is an extraction, and every extraction in this product is
 * reviewed by the person before it is used — a new CV quietly rewriting someone's
 * skills behind their back is exactly the kind of thing that loses their trust.
 *
 * IT SHOWS WHAT IS ALREADY ON FILE, and that is not decoration. This screen used
 * to judge the person by what they had uploaded in the last thirty seconds: its
 * button was enabled only by a CV added in THIS session. So someone who onboarded
 * with a CV and came back to add their transcript met a disabled button and
 * "add your CV to continue" — while their CV sat on our disk. The screen could
 * not keep the promise its own heading makes.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { useOnboarding } from '../state/onboarding';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { Button, Callout } from '../components/ui';
import {
  DocumentUpload, hasRequiredDocument, anyUploading, itemsFromDocuments,
} from '../components/DocumentUpload';
import type { Item } from '../components/DocumentUpload';
import { HttpError } from '../api/http';

export function Documents() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { beginReupload } = useOnboarding();
  const api = useApi();

  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the account already holds. A 404 here means nothing has been confirmed
  // yet, which `getProfile` returns as null — an empty state, not an error.
  const stored = useAsync((s) => api.getProfile(s), [api]);

  /*
   * Show the documents already on file, as finished rows.
   *
   * WITHOUT THIS the screen judged the person by what they had uploaded in the
   * last thirty seconds: someone who onboarded with a CV and came back to add
   * their transcript saw a disabled button and "add your CV to continue" — while
   * we were holding their CV. The screen's own promise is "read my documents
   * again", and it could not keep it.
   *
   * Merged by document id, exactly as `Upload.tsx` folds in documents restored
   * from saved progress, so a file uploaded in this session is never duplicated
   * by the fetch landing afterwards.
   */
  useEffect(() => {
    const known = stored.data?.documents;
    if (!known || known.length === 0) return;
    setItems((cur) => {
      const have = new Set(cur.map((i) => i.uploaded?.id).filter(Boolean));
      const missing = known.filter((d) => !have.has(d.id));
      return missing.length ? [...itemsFromDocuments(missing), ...cur] : cur;
    });
  }, [stored.data]);

  /*
   * Two files of one kind are read TOGETHER, as one document — which is right
   * for a transcript photographed a page at a time, and wrong for a replacement
   * CV sitting beside the old one.
   *
   * Nothing here can tell those apart, and the previous attempt to guess (read
   * only the newest) silently discarded pages of real documents. So the choice
   * is handed back: this says what will happen, beside the delete control, and
   * the person decides. Visible and correctable beats silent and wrong.
   */
  const duplicateKind = ['cv', 'transcript'].some(
    (kind) => items.filter((i) => i.kind === kind && i.status === 'done').length > 1,
  );

  const ready = hasRequiredDocument(items);
  const uploading = anyUploading(items);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const uploaded = items.filter((i) => i.uploaded).map((i) => i.uploaded!);
      await beginReupload(uploaded);
      navigate('/confirm');
    } catch (err: unknown) {
      // Kept on this screen rather than thrown: the files are already stored,
      // so the recoverable action is to retry the read, not to upload again.
      setError(err instanceof HttpError ? t('documents.failedHelp') : t('state.errorSub'));
      setBusy(false);
    }
  };

  return (
    <div className="stack stack--lg enter">
      <header className="stack stack--sm">
        <h1 className="headline">{t('documents.title')}</h1>
        <p className="subhead">{t('documents.sub')}</p>
      </header>

      <DocumentUpload items={items} setItems={setItems} />

      <div className="callout">
        <ShieldCheck size={18} className="callout__icon" aria-hidden="true" />
        <div>{t('documents.privacy')}</div>
      </div>

      {/* The requirement is explained next to the control it blocks. */}
      {!ready && items.length > 0 && <Callout>{t('upload.missingRequired')}</Callout>}

      {duplicateKind && <Callout>{t('documents.duplicateKind')}</Callout>}

      {error && (
        <Callout tone="danger">
          <div className="stack stack--sm">
            <strong>{t('documents.failed')}</strong>
            <p>{error}</p>
          </div>
        </Callout>
      )}

      <div className="row">
        <Button onClick={submit} disabled={!ready || uploading} loading={busy}>
          <RefreshCw size={16} aria-hidden="true" />
          {t('documents.cta')}
        </Button>
      </div>

      <p className="text-sm muted">{t('documents.reviewNote')}</p>
    </div>
  );
}

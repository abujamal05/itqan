/**
 * Documents — where a user who has already finished onboarding replaces their
 * CV or transcript.
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
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { useOnboarding } from '../state/onboarding';
import { Button, Callout } from '../components/ui';
import {
  DocumentUpload, hasRequiredDocument, anyUploading,
} from '../components/DocumentUpload';
import type { Item } from '../components/DocumentUpload';
import { HttpError } from '../api/http';

export function Documents() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { beginReupload } = useOnboarding();

  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

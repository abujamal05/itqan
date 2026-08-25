/**
 * Step 1 — the documents.
 *
 * Only the CV is required; everything else widens what can be matched. (Agent A
 * requires a CV and treats the transcript as optional — the gate follows the
 * pipeline, not the other way round.)
 * That asymmetry is stated plainly rather than enforced silently: Continue is
 * disabled without a CV AND says why, because a disabled button with no
 * explanation is the most common dead end in a signup flow.
 *
 * Two additions the sketch did not have:
 *  - the privacy line sits on the screen itself. This is the moment a stranger
 *    hands over a personal document, and the skeptical user decides here
 *    whether the product is worth trusting. One honest line costs less than
 *    losing him.
 *  - "I do not have my documents right now" is a real path, not a dead end.
 *    Plenty of graduates cannot lay hands on a PDF at the moment they sign up.
 *    It routes to the confirmation screen with blank fields, so the manual
 *    route reuses one screen instead of adding one.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useI18n } from '../i18n';
import { useOnboarding } from '../state/onboarding';
import { Button, Callout } from '../components/ui';
import { errorText } from '../lib/errorText';
import { DocumentUpload, hasRequiredDocument, anyUploading, itemsFromDocuments } from '../components/DocumentUpload';
import type { Item } from '../components/DocumentUpload';
import { HudGuide } from '../components/HudGuide';
import { SiteHeader } from '../components/SiteHeader';
import { ResumeBanner } from '../components/ResumeBanner';

export function Upload() {
  const { t, formatNumber } = useI18n();
  const { begin, startManual, documents } = useOnboarding();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  /* Same silence as the confirmation screen had: the pipeline refused, the
     spinner cleared, and nothing on the page said why. */
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Documents restored from saved progress are already stored, so they are
  // folded into the list as finished rows. Without this the user resumes and
  // sees an empty screen, which reads as "my work was lost" even though it
  // was not.
  useEffect(() => {
    if (documents.length === 0) return;
    setItems((cur) => {
      const known = new Set(cur.map((i) => i.uploaded?.id).filter(Boolean));
      const missing = documents.filter((d) => !known.has(d.id));
      return missing.length ? [...itemsFromDocuments(missing), ...cur] : cur;
    });
  }, [documents]);

  const ready = hasRequiredDocument(items);
  const uploading = anyUploading(items);

  const submit = async () => {
    setBusy(true);
    try {
      await begin(items.filter((i) => i.uploaded).map((i) => i.uploaded!));
      navigate('/questions');
    } catch (err: unknown) {
      setSubmitError(errorText(err, { t, formatNumber }));
      setBusy(false);
    }
  };

  const goManual = () => { startManual(); navigate('/confirm'); };

  return (
    <div className="ob">
      <SiteHeader step={0} />
      <main className="ob__main" id="main" tabIndex={-1}>
        <div className="stage stage--split enter">
          <aside className="stage__aside">
            <HudGuide pose="idle" says={t('upload.hud')} eager />
          </aside>

          <div className="stage__content">
            <ResumeBanner />

            {/* The subtitle is gone. It read "Your CV is the one Itqan needs to
                start. Add your transcript too and it will read that as well." —
                which is the same requirement the drop zone labels and the
                `upload.missingRequired` callout already state, twice, closer to
                the control they apply to. */}
            <h1 className="headline">{t('upload.title')}</h1>

            <DocumentUpload items={items} setItems={setItems} />

            <p className="text-sm muted">
              {t('upload.recommend')} <span className="num">{t('upload.maxSize')}</span>
            </p>

            <div className="callout">
              <ShieldCheck size={18} className="callout__icon" aria-hidden="true" />
              <div>{t('upload.privacy')}</div>
            </div>

            {/* The requirement is explained next to the control it blocks. */}
            {!ready && items.length > 0 && (
              <Callout>{t('upload.missingRequired')}</Callout>
            )}
            {ready && <p className="text-sm muted">{t('upload.othersLater')}</p>}

            {/* THE TWO ROUTES OUT OF THIS SCREEN, SIDE BY SIDE.
                They used to be separated by a horizontal rule, which framed
                "I do not have my documents" as a footnote below the real
                action rather than as the other way through — and for the
                graduate who cannot lay hands on a PDF right now, it is the
                only way through. Presenting them as a pair says both are
                allowed. The primary still leads: filled against bordered, and
                first in the reading order.

                `upload__routes` wraps to a column below 30rem, where two full
                width buttons beat two cramped ones. */}
            {submitError && <Callout tone="danger">{submitError}</Callout>}
            <div className="upload__routes">
              <Button onClick={submit} disabled={!ready || uploading} loading={busy}>
                {t('upload.cta')}
              </Button>
              <Button variant="secondary" onClick={goManual}>
                {t('upload.noDoc')}
              </Button>
            </div>
            <p className="text-sm muted">{t('upload.noDocHint')}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

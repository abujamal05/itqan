/**
 * Step 1 — the documents.
 *
 * Only the CV is required; everything else widens what can be matched. The
 * transcript is the highest-value optional one — Agent A uses it to corroborate
 * claimed skills and to promote skills from passed courses.
 * That asymmetry is stated plainly rather than enforced silently: Continue is
 * disabled without a transcript AND says why, because a disabled button with no
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
import { DocumentUpload, hasRequiredDocument, anyUploading, itemsFromDocuments } from '../components/DocumentUpload';
import type { Item } from '../components/DocumentUpload';
import { HudGuide } from '../components/HudGuide';
import { SiteHeader } from '../components/SiteHeader';
import { ResumeBanner } from '../components/ResumeBanner';

export function Upload() {
  const { t } = useI18n();
  const { begin, startManual, documents } = useOnboarding();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

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
    } catch {
      setBusy(false);
    }
  };

  const goManual = () => { startManual(); navigate('/confirm'); };

  return (
    <div className="ob">
      <SiteHeader step={0} />
      <main className="ob__main" id="main">
        <div className="stage stage--split enter">
          <aside className="stage__aside">
            <HudGuide pose="idle" says={t('upload.hud')} eager />
          </aside>

          <div className="stage__content">
            <ResumeBanner />

            <div className="stack stack--sm">
              <h1 className="headline">{t('upload.title')}</h1>
              <p className="subhead">{t('upload.sub')}</p>
            </div>

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
              <Callout>{t('upload.missingTranscript')}</Callout>
            )}
            {ready && <p className="text-sm muted">{t('upload.othersLater')}</p>}

            <div className="row">
              <Button onClick={submit} disabled={!ready || uploading} loading={busy}>
                {t('upload.cta')}
              </Button>
            </div>

            <hr className="divider" />

            {/* A real bordered button, not a ghost. As a ghost it was
                invisible until hovered, so the one escape route for someone
                without their documents read as body text and was missed. It
                stays visually quieter than the primary action — secondary,
                not hidden. */}
            <div className="stack stack--sm">
              <Button variant="secondary" onClick={goManual} style={{ alignSelf: 'flex-start' }}>
                {t('upload.noDoc')}
              </Button>
              <p className="text-sm muted">{t('upload.noDocHint')}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

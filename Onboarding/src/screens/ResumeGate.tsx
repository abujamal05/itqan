/**
 * What a later onboarding step shows when the page is reloaded.
 *
 * The flow's state lives in memory, so a reload on /questions or /confirm has
 * nothing to render from. The old behaviour was to redirect to /upload, where
 * the resume offer lives. That is correct on paper and wrong in practice: a
 * phone browser discards a backgrounded tab, so going to find a certificate and
 * coming back reloads the page and throws the user off the step they were on.
 * From their side the step simply "does not load", and whether it happens at all
 * depends on the device, which is exactly the inconsistency being reported.
 *
 * So the offer is made HERE instead, on the step they were already on. The rule
 * it has to respect is unchanged — offered, never forced. Continue restores and
 * the step renders; Start again clears the saved copy and returns to step one.
 */
import { History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useOnboarding } from '../state/onboarding';
import { Button } from '../components/ui';
import { HudGuide } from '../components/HudGuide';
import { SiteHeader } from '../components/SiteHeader';

export function ResumeGate() {
  const { t } = useI18n();
  const { resume, dismissResume } = useOnboarding();
  const navigate = useNavigate();

  const startAgain = () => {
    dismissResume();
    navigate('/upload', { replace: true });
  };

  return (
    <div className="ob">
      <SiteHeader />
      <main className="ob__main" id="main" tabIndex={-1}>
        <div className="stage stage--split enter">
          <aside className="stage__aside">
            <HudGuide pose="thinking" says={t('resume.title')} eager />
          </aside>

          <div className="stage__content">
            <div className="callout callout--offer" role="status">
              <History size={18} className="callout__icon" aria-hidden="true" />
              <div className="stack stack--sm">
                <strong>{t('resume.title')}</strong>
                <p>{t('resume.body')}</p>
                <div className="row">
                  <Button onClick={resume}>{t('resume.continue')}</Button>
                  <Button variant="ghost" onClick={startAgain}>{t('resume.restart')}</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

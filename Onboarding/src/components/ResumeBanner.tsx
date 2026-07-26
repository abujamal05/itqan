/**
 * Offered, never forced. Finding saved progress and silently restoring it is
 * disorienting — the user does not remember what they entered and cannot tell
 * what is theirs. Finding it and throwing it away is worse. So it is stated,
 * with both answers available and neither pre-chosen.
 *
 * "Start again" clears the saved copy rather than hiding it, so the offer does
 * not reappear on the next screen and make the choice feel unheard.
 */
import { History } from 'lucide-react';
import { useI18n } from '../i18n';
import { useOnboarding } from '../state/onboarding';
import { Button } from './ui';

export function ResumeBanner() {
  const { t } = useI18n();
  const { resumable, resume, dismissResume } = useOnboarding();
  if (!resumable) return null;

  return (
    <div className="callout callout--offer enter" role="status">
      <History size={18} className="callout__icon" aria-hidden="true" />
      <div className="stack stack--sm">
        <strong>{t('resume.title')}</strong>
        <p>{t('resume.body')}</p>
        <div className="row">
          <Button onClick={resume}>{t('resume.continue')}</Button>
          <Button variant="ghost" onClick={dismissResume}>{t('resume.restart')}</Button>
        </div>
      </div>
    </div>
  );
}

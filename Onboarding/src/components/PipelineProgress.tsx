/**
 * The pipeline's real progress, wherever the user happens to be.
 *
 * The run is deliberately in two halves. Agent A reads the documents, then the
 * run PAUSES so the user can correct the extraction and answer the direction
 * questions — and confirming is what starts Agent C and Agent E. So the second
 * half runs while the user is already on the dashboard, and if nothing said so,
 * a finished-looking app would sit there with an empty dashboard and no
 * explanation. That is what this is for: the bar follows them.
 *
 * Extracted from the copy that was inline in Questions.tsx rather than written
 * twice. Two progress bars claiming different things about one run is a bug
 * waiting to happen.
 *
 * The percentage is the server's `progress`, which only advances when a phase
 * actually completes. It is never interpolated on a timer: a bar that creeps to
 * 90% and stops makes a stalled run indistinguishable from a slow one.
 */
import { useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n';
import { useOnboarding } from '../state/onboarding';

export function PipelineProgress({ variant = 'card' }: { variant?: 'card' | 'bare' }) {
  const { t, formatNumber } = useI18n();
  const { analysis, entry, settled, failed } = useOnboarding();
  /**
   * Dismissed only once the run is over.
   *
   * A finished bar reading "Finished 100%" has said everything it will ever
   * say, but it sat above every page permanently, pushing the actual content
   * down on every route. While the run is still going the bar is the only
   * thing explaining why the dashboard is half empty, so there is no close
   * control then — hiding it would leave a working product looking broken with
   * no way to find out otherwise.
   */
  const [dismissed, setDismissed] = useState(false);

  // Nothing to report: the manual route runs no agents, and neither does a
  // session that has not submitted anything.
  if (entry !== 'document' || !analysis || failed) return null;
  if (settled && dismissed) return null;

  const pct = Math.round((analysis.progress ?? 0) * 100);
  const waitingOnUser = analysis.stage === 'awaiting_confirmation';
  /**
   * The label follows the STAGE, the number follows the work.
   *
   * `translating` covers most of Agent A — pulling out the details, grounding each
   * one against the document, rating the skills — and it used to fall through to
   * "Reading your documents", which stayed on screen long after the reading was
   * done. The stages the server reports are the honest source for this.
   */
  const label = settled
    ? t('progress.done')
    // The pause is not work, and saying "still reading your documents" while the
    // system is in fact waiting for the person reads as a system that is stuck.
    : waitingOnUser ? t('progress.awaitingYou')
      : analysis.stage === 'matching' ? t('progress.matching')
        : analysis.stage === 'translating' ? t('progress.understanding')
          : t('progress.reading');
  // Waiting on a person is not work in progress, and neither is a finished run.
  const working = !settled && !waitingOnUser;

  const body = (
    <div className="stack stack--sm">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>{label}</span>
        <div className="row row--tight">
          <span className="text-sm num">{formatNumber(pct)}%</span>
          {settled && (
            <button
              type="button"
              className="progress__dismiss"
              onClick={() => setDismissed(true)}
              aria-label={t('progress.dismiss')}
              title={t('progress.dismiss')}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className="meter">
        <i className={working ? 'is-working' : undefined} style={{ inlineSize: `${pct}%` }} />
      </div>
    </div>
  );

  if (variant === 'bare') return body;
  return (
    // Announced politely: it must reach a screen reader without stealing focus
    // from whatever the user is actually doing.
    <div className="card card--sunken" role="status" aria-live="polite">{body}</div>
  );
}

/**
 * True while the agents are still working on a run this session started.
 *
 * The dashboard, jobs and courses pages all read from the FINISHED run, so
 * before phase two lands their endpoints answer "nothing yet". Distinguishing
 * that from a real failure is the difference between "your results are on the
 * way" and an error state on a product that is working correctly.
 */
export function useRunInFlight(): boolean {
  const { analysis, entry, settled, failed } = useOnboarding();
  return entry === 'document' && !!analysis && !settled && !failed;
}

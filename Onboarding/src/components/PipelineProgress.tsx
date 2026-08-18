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

/**
 * Where the server's `progress` sits when Agent A has finished and the run
 * pauses for the user. See BACKEND.md §2.3 — the run is two halves, and this is
 * the seam between them.
 *
 * Only the `reading` scope uses it, and only to SCALE a bar that has already
 * been told by the STAGE whether reading is done. So a backend that moves the
 * seam makes this bar advance at a slightly wrong rate; it cannot make it claim
 * the documents are read when they are not.
 */
const PAUSE_AT = 0.75;

export function PipelineProgress({
  variant = 'card', scope = 'full',
}: {
  variant?: 'card' | 'bare' | 'strip';
  /**
   * WHICH RUN THE BAR IS ABOUT, and it is two different questions.
   *
   * `reading` — Agent A only. Used during onboarding, where the user is waiting
   * for their documents to be read and nothing else is happening yet. It reaches
   * 100% when, and only when, that reading is finished.
   *
   * `full` — the whole pipeline, used on the dashboard after confirmation, where
   * the second half is running and the bar explains why the page is half empty.
   *
   * They were one bar reporting the whole run, which meant the onboarding
   * screens sat at 75% at the exact moment the documents HAD been read, with
   * the remaining quarter reserved for work that cannot start until the user
   * acts. That is the opposite of what a progress bar is for.
   */
  scope?: 'reading' | 'full';
}) {
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

  const waitingOnUser = analysis.stage === 'awaiting_confirmation';
  /**
   * Agent A is finished. Read from the STAGE, never from the number, which is
   * the whole point: the bar may only say 100% once the pipeline has said the
   * documents were read, not once a percentage happens to round up to it.
   */
  const readingDone = waitingOnUser || analysis.stage === 'matching' || settled;
  const raw = analysis.progress ?? 0;
  const pct = scope === 'reading'
    ? (readingDone
      ? 100
      // Capped at 99 until the stage says otherwise. A run that stalls at the
      // very end of Agent A must not be indistinguishable from a finished one.
      : Math.min(99, Math.round((raw / PAUSE_AT) * 100)))
    : Math.round(raw * 100);
  /**
   * The label follows the STAGE, the number follows the work.
   *
   * `translating` covers most of Agent A — pulling out the details, grounding each
   * one against the document, rating the skills — and it used to fall through to
   * "Reading your documents", which stayed on screen long after the reading was
   * done. The stages the server reports are the honest source for this.
   */
  const label = scope === 'reading' && readingDone && !settled
    // In the reading scope, the pause is not "waiting for you", it is the
    // finish line: the documents have been read and the bar has just said 100%.
    ? t('questions.readingDone')
    : settled
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
          {/* The dismiss control belongs to the card that used to sit above
              every page. The onboarding strip is transient by construction, so
              offering a way to hide it is a control with nothing to do. */}
          {settled && variant !== 'strip' && (
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
  /**
   * The onboarding strip: a full width band directly under the step indicator.
   *
   * It renders its own container so the header can ask for it unconditionally —
   * this component returns null when there is no run to report, and a wrapper
   * owned by the caller would leave an empty padded band on the upload screen,
   * before anything has been submitted.
   */
  if (variant === 'strip') {
    return (
      <div className="obprogress" role="status" aria-live="polite">
        <div className="obprogress__inner">{body}</div>
      </div>
    );
  }
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

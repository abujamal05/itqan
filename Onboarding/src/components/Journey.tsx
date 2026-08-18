/**
 * The user's journey through the product, and where they are in it.
 *
 * This answers one question — "how far along am I, and what comes next" — and it
 * answers it from the service, not from which screen was last opened: a stage is
 * done when the work finished, not when a page was visited.
 *
 * WHY IT NO LONGER LOOKS LIKE A STEPPER. It was an `auto-fit` grid of equal
 * columns: every stage the same width, the same weight, the same centred
 * treatment, whether it had already happened or was the one thing the user
 * should be looking at. That is a diagram of a process rather than an answer
 * about a person, and it is what made the section feel fixed and rigid. Now the
 * three states are three different sizes: done collapses to a compact marker and
 * label, CURRENT is a raised card carrying its detail, and upcoming sits quiet
 * behind it. The one stage that matters is the one you see first.
 *
 * The gold thread that runs behind the stages is the marketing site's motif —
 * the same drawn line that ties the three steps together on the home page and
 * runs down the how-it-works timeline. Reusing it here is deliberate: the site
 * and the product should feel like one thing, and this is the one place in the
 * app where a continuous path is literally what is being described. It fills only
 * as far as the user has actually got.
 *
 * Three states, and none of them is carried by colour alone. Done has a check,
 * current has a filled ring plus `aria-current`, upcoming is an open outline;
 * each also states its condition in words for a screen reader. That matters more
 * here than usual, because a progress track drawn only in gold and grey is
 * exactly the kind of thing that vanishes for a colour-blind reader.
 */
import { ArrowRight, Check, Flag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { JourneyStage } from '../api';

/**
 * Stages that lead somewhere, by stage id.
 *
 * Only the last one does today, and that is deliberate rather than unfinished:
 * "reading your documents" has no page to be the destination of, and a stage
 * that navigates somewhere unhelpful is worse than one that does not navigate.
 * Applying for jobs is the exception because the postings page IS that stage.
 *
 * Keyed by the SERVICE's stage id, and applied only to the final stage, so a
 * pipeline that grows a step in the middle cannot silently turn it into a link.
 */
const STAGE_LINKS: Record<string, string> = { jobs: '/jobs' };

export function Journey({ stages, target }: { stages: JourneyStage[]; target?: string }) {
  const { t, formatNumber } = useI18n();
  if (stages.length === 0) return null;

  const currentIndex = stages.findIndex((s) => s.state === 'current');
  const done = stages.filter((s) => s.state === 'done').length;
  const complete = currentIndex === -1 && done === stages.length;

  /**
   * How far the thread is drawn, 0..1 — as a fraction of the MARKER-TO-MARKER
   * span, which is what the CSS now scales.
   *
   * The previous version computed the same fraction but the CSS stretched the
   * track across the full padding box, roughly 200px wider than the span
   * between the first and last marker. Measured in the browser: the fill
   * overshot its own marker by 45px, with 109px of bare track hanging off each
   * end. The fix is not an offset — stage widths differ, so no constant
   * corrects it — it is making the track BE the marker-to-marker span. See the
   * geometry note in chrome.css.
   */
  const reached = complete
    ? 1
    : stages.length > 1
      ? Math.max(0, currentIndex === -1 ? done - 1 : currentIndex) / (stages.length - 1)
      : 0;

  return (
    <section className="stack" aria-labelledby="journey-title">
      <div className="section__head">
        <h2 className="section__title" id="journey-title">{t('journey.title')}</h2>
        <span className="spacer" />
        <span className="journey__count num">
          {t('journey.progress', {
            done: formatNumber(done),
            total: formatNumber(stages.length),
          })}
        </span>
      </div>

      <ol className="journey" data-reached={reached}>
        {stages.map((s, i) => {
          // Last stage only. See STAGE_LINKS.
          const to = i === stages.length - 1 ? STAGE_LINKS[s.id] : undefined;
          return (
          <li
            key={s.id}
            className="journey__stage"
            data-state={s.state}
            data-linked={to ? '' : undefined}
            /* The one stage a screen reader should land on as "you are here". */
            aria-current={s.state === 'current' ? 'step' : undefined}
          >
            {/* The rail runs through THIS stage's own marker, so it is correct
                whatever width the stage takes. A single absolutely positioned
                track across the whole list cannot be: the current stage is
                wider than the others, so the marker centres are not evenly
                spaced and no constant inset lands on them. Measured on the
                previous version: 12px above the markers, 109px of bare line at
                each end, fill overshooting its marker by 45px. */}
            <span className="journey__rail" aria-hidden="true" />

            <span className="journey__marker">
              {s.state === 'done'
                ? <Check size={16} aria-hidden="true" />
                : <span className="journey__dot" aria-hidden="true" />}
            </span>

            <span className="journey__body">
              {/* A linked stage puts the LABEL in the anchor, and the anchor
                  stretches over the whole stage through `.journey__go::after`.
                  Wrapping the <li> in a link instead would put the rail and the
                  marker inside the accessible name, and a stage that reads as
                  "check mark Applying for jobs Next milestone Still to come" is
                  not a link label anyone can act on. */}
              {to ? (
                <Link className="journey__go" to={to}>
                  <span className="journey__label">{s.label}</span>
                  <ArrowRight size={14} aria-hidden="true" className="go" />
                </Link>
              ) : (
                <span className="journey__label">{s.label}</span>
              )}
              {/* Only the current stage carries its detail into the layout. On
                  the others it is a tooltip's worth of information competing
                  with the one line the user needs. */}
              {s.detail && <span className="journey__detail">{s.detail}</span>}
            </span>

            {/* Spoken, never drawn: the visual state is already obvious. */}
            <span className="sr-only">{t(`journey.state.${s.state}`)}</span>
          </li>
          );
        })}
      </ol>

      {/* Where the road goes. A progress track with no destination is a
          progress bar; naming the target is what makes it a journey, and it is
          the same target the readiness score above is measured against. */}
      {target && (
        <p className="journey__target">
          <Flag size={15} aria-hidden="true" />
          <span>{t('journey.towards')} <strong><bdi>{target}</bdi></strong></span>
        </p>
      )}

      {complete && <p className="text-sm">{t('journey.complete')}</p>}
    </section>
  );
}

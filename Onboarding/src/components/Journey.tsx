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
import { Check } from 'lucide-react';
import { useI18n } from '../i18n';
import type { JourneyStage } from '../api';

export function Journey({ stages }: { stages: JourneyStage[] }) {
  const { t, formatNumber } = useI18n();
  if (stages.length === 0) return null;

  const currentIndex = stages.findIndex((s) => s.state === 'current');
  const done = stages.filter((s) => s.state === 'done').length;
  const complete = currentIndex === -1 && done === stages.length;

  /**
   * How far the thread is drawn, 0..1.
   *
   * Measured to the CURRENT stage rather than to the count of finished ones, so
   * the line reaches the marker the user is standing on instead of stopping
   * short of it. A single-stage journey has nothing to span, hence the guard.
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

      <ol
        className="journey"
        /* The fill is a scale factor on a single drawn line rather than a width,
           so it animates on the compositor and mirrors for free in Arabic. */
        style={{ '--journey-reached': reached } as React.CSSProperties}
      >
        {/* One continuous track behind every stage, not a segment per item. The
            old per-item connector had to be suppressed on the first child and
            still left the line stopping at each marker's edge. */}
        <span className="journey__track" aria-hidden="true">
          <span className="journey__fill" />
        </span>

        {stages.map((s) => (
          <li
            key={s.id}
            className="journey__stage"
            data-state={s.state}
            /* The one stage a screen reader should land on as "you are here". */
            aria-current={s.state === 'current' ? 'step' : undefined}
          >
            <span className="journey__marker">
              {s.state === 'done'
                ? <Check size={16} aria-hidden="true" />
                : <span className="journey__dot" aria-hidden="true" />}
            </span>

            <span className="journey__body">
              <span className="journey__label">{s.label}</span>
              {/* Only the current stage carries its detail into the layout. On
                  the others it is a tooltip's worth of information competing
                  with the one line the user needs. */}
              {s.detail && <span className="journey__detail">{s.detail}</span>}
            </span>

            {/* Spoken, never drawn: the visual state is already obvious. */}
            <span className="sr-only">{t(`journey.state.${s.state}`)}</span>
          </li>
        ))}
      </ol>

      {complete && <p className="text-sm">{t('journey.complete')}</p>}
    </section>
  );
}

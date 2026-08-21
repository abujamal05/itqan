/**
 * The user's journey through the product, and where they are in it.
 *
 * This answers one question — "how far along am I, and what comes next" — and it
 * answers it from the service, not from which screen was last opened: a stage is
 * done when the work finished, not when a page was visited.
 *
 * WHY IT WINDS. It was a straight rail through evenly weighted stages, which
 * reads as a progress bar with words under it. A path that turns is a path
 * somebody is walking, and the turns are where this product actually asks
 * something of the person: read, confirm, learn, apply. The curve is generated
 * by `d3-shape` rather than written out by hand — a Catmull-Rom spline through
 * the marker centres, so the line is guaranteed to pass through every node it
 * connects at any stage count.
 *
 * GEOMETRY IS NORMALISED, NOT MEASURED. The stages are positioned at the same
 * 0..1 coordinates the curve is generated from, so the line cannot drift off the
 * markers the way the previous absolutely-positioned track did — measured then
 * at 12px above the markers, 109px of bare line at each end, and a fill
 * overshooting its own marker by 45px. Nothing here reads the DOM.
 *
 * Three states, and none of them is carried by colour alone. Done has a check,
 * current has a filled ring plus `aria-current`, upcoming is an open outline;
 * each also states its condition in words for a screen reader. That matters more
 * here than usual, because a progress track drawn only in gold and grey is
 * exactly the kind of thing that vanishes for a colour-blind reader.
 *
 * THE LOW-READINESS PATH. Under `LOW_READINESS`, the last milestone stops being
 * "applying for jobs" and stops linking there, because sending someone to a page
 * of roles they cannot get is not kindness. It becomes the building stage, and
 * the section says what to do next instead of what is missing.
 */
import { ArrowRight, Check, Flag, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { line, curveBasis } from 'd3-shape';
import { useI18n } from '../i18n';
import type { JourneyStage } from '../api';

/**
 * Stages that lead somewhere, by stage id.
 *
 * Only the last one does today, and that is deliberate rather than unfinished:
 * "reading your documents" has no page to be the destination of, and a stage
 * that navigates somewhere unhelpful is worse than one that does not navigate.
 *
 * Keyed by the SERVICE's stage id, and applied only to the final stage, so a
 * pipeline that grows a step in the middle cannot silently turn it into a link.
 */
const STAGE_LINKS: Record<string, string> = { jobs: '/jobs' };

/**
 * At or below this, the journey ends at building rather than at applying.
 *
 * A product decision, not a display one, which is why it is a named constant
 * next to the component that acts on it rather than a bare 30 inside a
 * condition. `readiness` is 0..100 and agent-computed.
 */
export const LOW_READINESS = 30;

/** Design-space box the curve is generated in. Ratio matters, not the units. */
const BOX = { w: 1000, h: 260 };

/**
 * How far the first and last markers sit from the edges, in 0..1.
 *
 * A stage is a centred label translated back by half its own width, so a marker
 * at the very edge puts half that label outside the panel.
 */
const EDGE_PAD = 0.16;

/** How far the wave rises and falls from the midline, in 0..1. */
const AMPLITUDE = 0.2;

/** Samples used to draw the wave. Enough that straight segments are invisible. */
const SAMPLES = 160;

/**
 * The wave, as a cosine.
 *
 * WHY NOT A SPLINE THROUGH THE MARKERS. That was the first attempt and it looked
 * hand drawn, for two compounding reasons. A Catmull-Rom through four unevenly
 * placed control points overshoots between them, so the curve bulged on one side
 * of a marker and pinched on the other; and the SVG stretches its viewBox to the
 * panel (`preserveAspectRatio: none`), which scales those bulges horizontally by
 * a different factor than vertically and turns an uneven curve into a lumpy one.
 *
 * A cosine has neither problem. It is regular by construction, so there is
 * nothing to overshoot, and stretching a cosine horizontally yields a cosine.
 * The period is set so consecutive markers land exactly half a period apart,
 * which puts every marker on an extreme — alternating above and below the
 * midline — and the curve through them is then guaranteed to be the same shape
 * between every pair.
 */
const waveY = (t: number, step: number) =>
  0.5 - AMPLITUDE * Math.cos((Math.PI * (t - EDGE_PAD)) / step);

/** Marker positions in 0..1. Markers sit ON the wave, by evaluating it. */
const pointsFor = (count: number, rtl: boolean) => {
  const span = 1 - EDGE_PAD * 2;
  const step = count > 1 ? span / (count - 1) : span;
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : EDGE_PAD + i * step;
    return { x: rtl ? 1 - t : t, y: count === 1 ? 0.5 : waveY(t, step), step };
  });
};

export function Journey({
  stages,
  target,
  readiness,
}: {
  stages: JourneyStage[];
  target?: string;
  /** 0..100. Below LOW_READINESS the destination changes; see the note above. */
  readiness?: number;
}) {
  const { t, formatNumber, locale } = useI18n();
  if (stages.length === 0) return null;

  const rtl = locale === 'ar';
  const currentIndex = stages.findIndex((s) => s.state === 'current');
  const done = stages.filter((s) => s.state === 'done').length;
  const complete = currentIndex === -1 && done === stages.length;
  const low = typeof readiness === 'number' && readiness <= LOW_READINESS;

  /** How far the line is drawn, 0..1, as a fraction of the marker-to-marker span. */
  const reached = complete
    ? 1
    : stages.length > 1
      ? Math.max(0, currentIndex === -1 ? done - 1 : currentIndex) / (stages.length - 1)
      : 0;

  const pts = pointsFor(stages.length, rtl);
  const span = 1 - EDGE_PAD * 2;
  const step = stages.length > 1 ? span / (stages.length - 1) : span;

  /* d3 turns the samples into the path. `curveBasis` smooths whatever tiny
     faceting 160 samples still leave, and because the samples already describe a
     cosine there is nothing for it to distort. */
  const curve =
    stages.length > 1
      ? line<number>()
          .x((k) => {
            const t = EDGE_PAD + (k / SAMPLES) * span;
            return (rtl ? 1 - t : t) * BOX.w;
          })
          .y((k) => waveY(EDGE_PAD + (k / SAMPLES) * span, step) * BOX.h)
          .curve(curveBasis)(Array.from({ length: SAMPLES + 1 }, (_, k) => k)) ?? ''
      : '';

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

      <div className="journey" data-low={low ? '' : undefined}>
        {/* Decorative: every stage below states its own position in words, so
            the line carries no information a screen reader needs. */}
        <svg
          className="journey__curve"
          viewBox={`0 0 ${BOX.w} ${BOX.h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path className="journey__track" d={curve} />
          {/* pathLength=1 makes the fill a plain 0..1 fraction, independent of
              how long the generated path actually is. */}
          <path
            className="journey__fill"
            d={curve}
            pathLength={1}
            style={{ strokeDashoffset: 1 - reached }}
          />
        </svg>

        <ol className="journey__stages">
          {stages.map((s, i) => {
            const isLast = i === stages.length - 1;
            /* Under LOW_READINESS the destination stops being a link: a page of
               roles they cannot get is not a helpful place to send someone. */
            const to = isLast && !low ? STAGE_LINKS[s.id] : undefined;
            const label = isLast && low ? t('journey.building') : s.label;
            const p = pts[i];

            return (
              <li
                key={s.id}
                className="journey__stage"
                data-state={s.state}
                /* Which side of the curve the label sits on. A marker above the
                   midline puts its label ABOVE itself, so the descending line
                   passes under the words instead of straight through them —
                   which is exactly what it did on the first render. */
                data-side={p.y < 0.5 ? 'up' : 'down'}
                data-linked={to ? '' : undefined}
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                aria-current={s.state === 'current' ? 'step' : undefined}
              >
                <span className="journey__marker">
                  {s.state === 'done'
                    ? <Check size={16} aria-hidden="true" />
                    : <span className="journey__dot" aria-hidden="true" />}
                </span>

                <span className="journey__body">
                  {to ? (
                    <Link className="journey__go" to={to}>
                      <span className="journey__label">{label}</span>
                      <ArrowRight size={14} aria-hidden="true" className="go" />
                    </Link>
                  ) : (
                    <span className="journey__label">{label}</span>
                  )}
                  {s.detail && <span className="journey__detail">{s.detail}</span>}
                </span>

                {/* Spoken, never drawn: the visual state is already obvious. */}
                <span className="sr-only">{t(`journey.state.${s.state}`)}</span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* What to do next, not what is missing. This replaces the destination
          line rather than sitting beside it, so the section still makes exactly
          one statement about where the user is headed. */}
      {low ? (
        <p className="journey__building">
          <Sparkles size={15} aria-hidden="true" />
          <span>{t('journey.buildingBody')}</span>
        </p>
      ) : (
        target && (
          <p className="journey__target">
            <Flag size={15} aria-hidden="true" />
            <span>{t('journey.towards')} <strong><bdi>{target}</bdi></strong></span>
          </p>
        )
      )}

      {complete && !low && <p className="text-sm">{t('journey.complete')}</p>}
    </section>
  );
}

/**
 * The dashboard journey, as a spatial map.
 *
 * Four milestones on a continuous arc: documents read, role chosen, skills
 * built, jobs applied to. React Flow owns the canvas and the edges, so the path
 * is derived from the nodes rather than drawn beside them — which is what every
 * previous version of this got wrong, in a different way each time.
 *
 * THE EDGE CARRIES THE PROGRESS. Edges behind the user are accent and solid;
 * the edge into the next milestone is dashed and animated, so the map shows
 * movement toward the thing that has not happened yet rather than decorating
 * the part that has.
 *
 * LOW READINESS changes the destination. Under `LOW_READINESS` the last
 * milestone stops being "applying for jobs" and stops linking there, because
 * sending someone to a page of roles they cannot get is not kindness.
 */
import { useMemo } from 'react';
import { Position, type Edge, type Node } from '@xyflow/react';
import { Flag, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useMediaQuery } from '../../lib/useMediaQuery';
import type { JourneyStage } from '../../api';
import { MapCanvas } from './MapCanvas';
import { MilestoneNode, type MilestoneData } from './MilestoneNode';
import { arc, serpentine, NODE } from './layout';

/**
 * At or below this, the journey ends at building rather than at applying.
 *
 * A product decision, not a display one, which is why it is a named constant
 * rather than a bare 30 inside a condition. `readiness` is 0..100.
 */
export const LOW_READINESS = 30;

const STAGE_LINKS: Record<string, string> = { jobs: '/jobs' };

const nodeTypes = { milestone: MilestoneNode };

export function JourneyMap({
  stages,
  target,
  readiness,
}: {
  stages: JourneyStage[];
  target?: string;
  readiness?: number;
}) {
  const { t, formatNumber, locale } = useI18n();
  const rtl = locale === 'ar';
  /**
   * Four pins in a row need about 700px to stay legible, and a phone has half
   * that. Because the map is STATIC there is no panning to fall back on, so the
   * arrangement itself has to change: one row on a laptop, two rows of two on a
   * phone, which fits a 375px screen at nearly full size. A media query in CSS
   * could not do this — these are coordinates, not styles.
   */
  const narrow = useMediaQuery('(max-width: 40rem)');

  const done = stages.filter((s) => s.state === 'done').length;
  const currentIndex = stages.findIndex((s) => s.state === 'current');
  const complete = currentIndex === -1 && done === stages.length;
  const low = typeof readiness === 'number' && readiness <= LOW_READINESS;

  const { nodes, edges } = useMemo(() => {
    const pts = narrow
      ? serpentine(stages.length, {
        perRow: 2,
        stepX: NODE.milestone.w + 54,
        stepY: NODE.milestone.h + 48,
        amplitude: 0,
        rtl,
      })
      : arc(stages.length, NODE.milestone.w + 54, 56, rtl);

    /* Attachment sides flip with direction, or every edge would leave from the
       wrong side of its node and loop back on itself in Arabic. */
    const incoming = rtl ? Position.Right : Position.Left;
    const outgoing = rtl ? Position.Left : Position.Right;

    const ns: Node[] = stages.map((s, i) => {
      const isLast = i === stages.length - 1;
      const data: MilestoneData = {
        label: isLast && low ? t('journey.building') : s.label,
        detail: s.detail,
        state: s.state,
        to: isLast && !low ? STAGE_LINKS[s.id] : undefined,
        incoming,
        outgoing,
      };
      return {
        id: s.id,
        type: 'milestone',
        position: pts[i],
        data,
        width: NODE.milestone.w,
        height: NODE.milestone.h,
        draggable: false,
      };
    });

    const es: Edge[] = stages.slice(1).map((s, i) => {
      const from = stages[i];
      /* Reached means the user has already been through this join. The edge
         INTO the current stage is the live one, so it animates. */
      const reached = from.state === 'done';
      const live = reached && s.state === 'current';
      return {
        id: `${from.id}->${s.id}`,
        source: from.id,
        target: s.id,
        /* Bezier, not smoothstep. Smoothstep routes in right angles, which is
           exactly the flowchart read the map is meant to avoid; a career does
           not turn ninety degrees. The curve is what makes this a route. */
        type: 'default',
        animated: live,
        className: reached ? 'mapedge mapedge--reached' : 'mapedge',
      };
    });

    return { nodes: ns, edges: es };
  }, [stages, rtl, low, t, narrow]);

  if (stages.length === 0) return null;

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

      <MapCanvas
        className="map map--journey"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitKey={`${locale}:${stages.length}:${low}:${narrow}`}
        /* STATIC. Four milestones are the whole story and they all fit, so
           there is nothing off-frame to pan to — dragging could only move the
           picture somewhere worse, and the grab cursor was promising an
           interaction with no payoff. The courses map is the one you travel;
           this one you just read. */
        isStatic
        focusNodeId={(stages.find((s) => s.state === 'current') ?? stages[stages.length - 1])?.id}
        srList={stages.map((s, i) => {
          const isLast = i === stages.length - 1;
          return (
            <li key={s.id}>
              {isLast && low ? t('journey.building') : s.label}
              {' — '}
              {t(`journey.state.${s.state}`)}
              {s.detail ? ` — ${s.detail}` : ''}
            </li>
          );
        })}
      />

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

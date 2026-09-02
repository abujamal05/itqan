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
 *
 * ONE SHAPE, TWO WAYS OF READING IT. The arc is the journey at every width; the
 * phone no longer folds it into two rows of two. A different arrangement per
 * viewport meant the map a person learnt on their laptop was not the map they
 * met on their phone, and the fold introduced a turn that exists for no reason
 * in the thing being described: a career does not double back at milestone two.
 *
 * What changes on a phone is the FRAMING, not the shape. Four milestones need
 * about 700px and a phone has half that, so the map opens at full size on the
 * milestone the user is standing on and is walked with the arrows: previous,
 * next, and an overview that pulls back to the whole route. Dragging is off
 * there — see `guided` in MapCanvas for why a swipe cannot be trusted inside a
 * scrolling page. The laptop still shows everything at once and stays static.
 */
import { useMemo } from 'react';
import { Position, type Edge, type Node } from '@xyflow/react';
import { Flag, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useMediaQuery } from '../../lib/useMediaQuery';
import type { JourneyStage } from '../../api';
import { MapCanvas } from './MapCanvas';
import { MilestoneNode, type MilestoneData } from './MilestoneNode';
import { arc, NODE } from './layout';

/**
 * At or below this, the journey ends at building rather than at applying.
 *
 * A product decision, not a display one, which is why it is a named constant
 * rather than a bare 30 inside a condition. `readiness` is 0..100.
 */
export const LOW_READINESS = 30;

const STAGE_LINKS: Record<string, string> = { jobs: '/jobs' };

const nodeTypes = { milestone: MilestoneNode };

/**
 * A stage's name, in the reader's language.
 *
 * The service sends `label` in English and the contract used to claim it was
 * "already localised by the service" — it never was, so the Arabic dashboard
 * read "Documents read · Skills identified · Matching · Applying for jobs".
 * That kind of string is invisible to the i18n parity check too, because a
 * string that never becomes a key cannot fail it.
 *
 * The id is the translatable thing; `label` remains the fallback so a client
 * that reaches an older service still shows words rather than a raw key.
 */
function stageName(stage: JourneyStage, t: (k: string) => string): string {
  const key = `journey.stage.${stage.id}`;
  const translated = t(key);
  return translated === key ? stage.label : translated;
}


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
   * Which INTERACTION the map gets, not which layout.
   *
   * Both widths lay the same arc out at the same coordinates. A laptop fits all
   * four milestones at a legible size, so the map is a picture and nothing about
   * it offers to move. A phone cannot, so it becomes `guided`: opened on the
   * current milestone at full size and stepped through with the arrows.
   * `MapCanvas` decides the opening frame by MEASURING — below `fitFloor` it
   * centres on `focusNodeId` instead of fitting — so this flag only has to say
   * which controls exist.
   */
  const narrow = useMediaQuery('(max-width: 40rem)');

  const done = stages.filter((s) => s.state === 'done').length;
  const currentIndex = stages.findIndex((s) => s.state === 'current');
  const complete = currentIndex === -1 && done === stages.length;
  const low = typeof readiness === 'number' && readiness <= LOW_READINESS;

  const { nodes, edges } = useMemo(() => {
    const pts = arc(stages.length, NODE.milestone.w + 54, 56, rtl);

    /* One unbroken row, so every edge leaves one side and arrives at the other,
       and the only thing direction changes is WHICH side is which. The
       bottom-to-top case that `sides()` exists for belonged to the wrapped
       phone layout and went with it. */
    const turn = {
      incoming: rtl ? Position.Right : Position.Left,
      outgoing: rtl ? Position.Left : Position.Right,
    };

    const ns: Node[] = stages.map((s, i) => {
      const isLast = i === stages.length - 1;

      const data: MilestoneData = {
        label: isLast && low ? t('journey.building') : stageName(s, t),
        detail: s.detail,
        state: s.state,
        to: isLast && !low ? STAGE_LINKS[s.id] : undefined,
        incoming: turn.incoming,
        outgoing: turn.outgoing,
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
           not turn ninety degrees. The curve is what makes this a route.
           `path` is the local edge that normalises dash length — see
           PathEdge.tsx. */
        type: 'path',
        animated: live,
        className: reached ? 'mapedge mapedge--reached' : 'mapedge',
      };
    });

    return { nodes: ns, edges: es };
  }, [stages, rtl, low, t]);

  /**
   * The order the arrows walk, memoised.
   *
   * `Tools` resets which stop it is standing on whenever this array's IDENTITY
   * changes, not its contents. Built inline it would be a new array on every
   * render, so the next time anything above re-rendered the dashboard — a
   * refetch flipping `aria-busy` is enough — the arrows would snap back to the
   * current milestone under someone who had walked ahead of it.
   */
  const stops = useMemo(() => stages.map((s) => s.id), [stages]);

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
        /* STATIC ON A LAPTOP. Four milestones are the whole story and they all
           fit, so there is nothing off-frame to pan to — dragging could only
           move the picture somewhere worse, and the grab cursor was promising
           an interaction with no payoff. */
        isStatic={!narrow}
        /* GUIDED ON A PHONE, where they do not all fit. The viewport moves, but
           only when a button is pressed. */
        guided={narrow}
        stops={narrow ? stops : undefined}
        tools={narrow ? {
          /* No zoom pair. The two frames worth having here are "this milestone"
             and "the whole route", and both are already a button. */
          recentre: t('a11y.journeyOverview'),
          next: t('a11y.journeyNext'),
          prev: t('a11y.journeyPrev'),
        } : undefined}
        focusNodeId={(stages.find((s) => s.state === 'current') ?? stages[stages.length - 1])?.id}
        srList={stages.map((s, i) => {
          const isLast = i === stages.length - 1;
          return (
            <li key={s.id}>
              {isLast && low ? t('journey.building') : stageName(s, t)}
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

/**
 * The course path: the shortest route from where the user stands to the role
 * they are aiming at, as a map they can move around in.
 *
 * WHY A SERPENTINE AND NOT A ROW. The path folds back on itself every few
 * nodes. A single long row would put the tenth course ten screens to the side
 * and give the map nothing to wind around; a serpentine keeps every node within
 * one row's reach of the last, which is what makes panning feel like following
 * a route rather than scrolling a table sideways.
 *
 * THE ORDER IS THE API'S, AND THAT IS DELIBERATE. `Course` carries no ordering
 * field — no `priority`, no `closesGap` — so nothing in the data says which gap
 * matters most or which course closes it. Sorting by hours or by price here
 * would invent a priority the data does not carry, and a path whose first step
 * is merely the shortest course is WORSE than an unordered one, because it
 * looks authoritative. Recommended courses are pulled forward, because that
 * flag is real; everything else keeps the order it arrived in. BACKEND.md §1b
 * specifies the fields that close this.
 *
 * MOBILE KEEPS THE MAP. There is no vertical-list fallback and no stacking
 * breakpoint: the canvas opens at full size on the current node and the rest is
 * a drag away. The screen-reader list in MapCanvas is the linear version, and
 * it is the only one anybody needed.
 */
import { useMemo } from 'react';
import { Position, type Edge, type Node } from '@xyflow/react';
import { useI18n } from '../../i18n';
import type { Course } from '../../api';
import { courseFacts } from '../../lib/courseFacts';
import { MapCanvas } from './MapCanvas';
import { CourseNode, type CourseNodeData, type CourseState } from './CourseNode';
import { serpentine, NODE } from './layout';

const nodeTypes = { course: CourseNode };

/** Courses per row before the path turns back. Narrow enough that a turn is
 *  always in reach, wide enough that the map is not a column. */
const PER_ROW = 3;

export interface CoursesMapProps {
  courses: Course[];
  completed: Set<string>;
  /** Null while the target role is still undetermined. */
  target?: string;
  onDone: (course: Course) => void;
  onOpen: (course: Course) => void;
}

/**
 * Which state each course is in, in path order.
 *
 * Four of the five states are derived from real data. **`locked` is not
 * populated**, and that is a data limit rather than an oversight: the API
 * carries no prerequisites, so nothing here could say honestly that one course
 * requires another. Inventing a lock would make the map assert a product rule
 * that does not exist — and "locked" in this product is a UI state, never a
 * gate. The node renders it, ready for the field; see BACKEND.md §1c.
 */
function states(courses: Course[], completed: Set<string>): CourseState[] {
  const firstOpen = courses.findIndex((c) => !completed.has(c.id));
  return courses.map((c, i) => {
    if (completed.has(c.id)) return 'completed';
    if (i === firstOpen) return 'current';
    return c.recommended ? 'recommended' : 'available';
  });
}

export function CoursesMap({ courses, completed, onDone, onOpen }: CoursesMapProps) {
  const { t, locale, formatNumber, formatMoney } = useI18n();
  const rtl = locale === 'ar';

  const { nodes, edges, order, st, labels } = useMemo(() => {
    /* Recommended first, otherwise untouched. `sort` is stable in every engine
       this runs on, so equal keys keep the API's order — which is the whole
       point of not ranking here. */
    const order = [...courses].sort((a, b) => Number(b.recommended) - Number(a.recommended));
    const st = states(order, completed);

    const pts = serpentine(order.length, {
      perRow: PER_ROW,
      /* The gap has to be WIDER than the rise between two nodes. A bezier
         leaving one node's side and entering the next node's side sets its
         control points from the distance between them; when the vertical drop
         is bigger than the horizontal run, the curve loops back on itself and
         disappears behind the cards it connects. Measured, not guessed: at a
         96px gap with a 92px rise, the edge's bounding box was three times the
         width of the space it had to cross. */
      stepX: NODE.course.w + 200,
      stepY: NODE.course.h + 168,
      amplitude: 40,
      rtl,
    });

    const labels = {
      open: t('courses.open'),
      done: t('courses.markDone'),
      completed: t('courses.stateCompleted'),
      recommended: t('courses.recommended'),
      locked: t('courses.stateLocked'),
      current: t('courses.stateCurrent'),
      /* `available` carries no badge on the node — a quiet state is stated by
         being quiet. The hidden list has no such option, so it needs a word. */
      available: t('courses.stateAvailable'),
    };

    const ns: Node[] = order.map((c, i) => {
      const { price, duration } = courseFacts(c, { t, formatNumber, formatMoney });
      /* Which side an edge attaches to depends on which way this row runs, and
         the rows alternate. Getting this from the row parity rather than from a
         fixed left/right is what stops every turn looping back on itself. */
      const row = Math.floor(i / PER_ROW);
      const forward = row % 2 === 0;
      const lead = forward ? Position.Left : Position.Right;
      const trail = forward ? Position.Right : Position.Left;

      const data: CourseNodeData = {
        title: c.title,
        provider: c.provider,
        price,
        duration,
        unlocks: c.unlocks,
        state: st[i],
        url: c.source.url,
        labels,
        onDone: st[i] === 'completed' ? undefined : () => onDone(c),
        /* The pair swaps in Arabic for the same reason the coordinates are
           negated: the journey travels the other way. */
        incoming: rtl ? trail : lead,
        outgoing: rtl ? lead : trail,
      };

      return {
        id: c.id,
        type: 'course',
        position: pts[i],
        data,
        width: NODE.course.w,
        height: NODE.course.h,
        draggable: false,
      };
    });

    const es: Edge[] = order.slice(1).map((c, i) => {
      const from = order[i];
      /* The route behind the user is the part they have finished. It is drawn
         solid and accented; everything ahead is a hairline. */
      const reached = st[i] === 'completed';
      const live = reached && st[i + 1] === 'current';
      return {
        id: `${from.id}->${c.id}`,
        source: from.id,
        target: c.id,
        type: 'default',
        animated: live,
        className: reached ? 'mapedge mapedge--reached' : 'mapedge',
      };
    });

    return { nodes: ns, edges: es, order, st, labels };
  }, [courses, completed, rtl, t, formatNumber, formatMoney, onDone, onOpen]);

  const current = order.find((c) => !completed.has(c.id)) ?? order[order.length - 1];

  return (
    <MapCanvas
      className="map map--courses"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitKey={`${locale}:${order.map((c) => c.id).join(',')}`}
      /* Always opens on the next thing to do. A course map is big enough that
         fitting it would be unreadable at any width, so `fitFloor` is never
         met and this is the framing every time. */
      focusNodeId={current?.id}
      fitFloor={1}
      minZoom={0.3}
      maxZoom={1.4}
      tools={{
        zoomIn: t('a11y.mapZoomIn'),
        zoomOut: t('a11y.mapZoomOut'),
        recentre: t('a11y.mapRecentre'),
        next: t('a11y.mapNext'),
        prev: t('a11y.mapPrev'),
      }}
      /* The arrows walk the route in path order, so "next" always means the
         next course rather than whatever happens to be to the right — which is
         the opposite direction on every second row of a serpentine. */
      stops={order.map((c) => c.id)}
      /* The whole card opens the detail — the source, the retrieval date and
         the feedback controls a node has no room for. */
      onNodeOpen={(id) => {
        const c = order.find((x) => x.id === id);
        if (c) onOpen(c);
      }}
      srList={order.map((c, i) => (
        <li key={c.id}>
          {c.title} — {c.provider} — {labels[st[i]]}
        </li>
      ))}
    />
  );
}

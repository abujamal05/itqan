/**
 * The shared React Flow canvas both maps sit on.
 *
 * WHY A REAL CANVAS. The journey was a row of divs with a line drawn behind
 * them, and every version of that had the same failure: the line and the nodes
 * were positioned by two different systems, so they drifted apart at some
 * viewport nobody tested. Here the nodes ARE the graph and the edges are
 * derived from it, so an edge cannot miss the node it connects.
 *
 * WHEEL BEHAVIOUR IS THE THING TO GET RIGHT. React Flow's default is to zoom on
 * wheel and swallow the event, which on the dashboard means the page stops
 * scrolling the moment the pointer crosses the map. Both maps therefore disable
 * wheel zoom and let the event through; zooming is pinch and the controls, and
 * panning is dragging. On a full-page map that is the whole interaction anyway,
 * and on an embedded one it is the difference between a map and a scroll trap.
 *
 * ACCESSIBILITY. A canvas is not a list, and replacing an <ol> with one would
 * lose the sequence for anyone not looking at it. Every map therefore renders a
 * visually hidden ordered list of the same nodes, in path order, carrying each
 * node's state in words. The canvas itself is `aria-hidden`, so assistive tech
 * gets the list and never the graph.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Minus, Plus } from 'lucide-react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  getNodesBounds,
  type Edge,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PathEdge } from './PathEdge';

/**
 * One edge type, shared by both maps.
 *
 * Declared at module scope, not inline: React Flow treats a new `edgeTypes`
 * object as a new set of types and remounts every edge, which would restart the
 * dash animation on every render — the exact flicker this edge exists to fix.
 */
const edgeTypes = { path: PathEdge };

interface MapCanvasProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  /** Spoken sequence. The canvas is hidden from assistive tech; this is not. */
  srList: ReactNode;
  /**
   * The node to open on when the whole map will not fit legibly.
   *
   * FRAMING IS DECIDED BY MEASUREMENT, not by a breakpoint. Showing everything
   * is better when everything is readable, so the map fits first — but fitting
   * takes whatever zoom it needs, and on a 375px screen the dashboard strip fit
   * at 0.6, which renders a 14px label at 8px. Below `fitFloor` the map instead
   * opens at full size on this node, which shows a PORTION and invites the pan.
   * That is the same behaviour the courses map wants at every width, and it
   * falls out of the same rule rather than a second one.
   */
  focusNodeId?: string;
  /** Zoom below which fitting is abandoned in favour of `focusNodeId`. */
  fitFloor?: number;
  /** Full-page maps may zoom further out than an embedded strip. */
  minZoom?: number;
  maxZoom?: number;
  className?: string;
  /** Re-frame when this changes — e.g. the locale flipping the map's direction. */
  fitKey?: string | number;
  /**
   * Zoom in / zoom out / recentre, and their labels.
   *
   * Pinch and drag are the real gestures, so these are not the main way in.
   * They exist because a pointer user with no trackpad has no other way to
   * zoom, and because a "take me back" affordance is what stops a pannable
   * canvas from being a place to get lost. Omitted on maps small enough that
   * getting lost is not possible.
   */
  tools?: {
    /**
     * Omit BOTH and the zoom buttons are not rendered.
     *
     * The journey uses that. It is walked one milestone at a time and framed
     * for you at each stop, so a zoom control there is only a way to arrive at
     * a view nobody asked for and then need the recentre to get out of.
     */
    zoomIn?: string; zoomOut?: string;
    recentre: string;
    next: string; prev: string;
  };
  /**
   * A picture, not a place you can go.
   *
   * The dashboard journey is four milestones that all fit on screen — there is
   * nothing off-frame to pan to, so dragging it could only ever move the
   * picture somewhere worse, and a grab cursor over it promises an interaction
   * that has no payoff. Static maps do not pan, do not zoom, and show no tools.
   */
  isStatic?: boolean;
  /**
   * A map you are WALKED through rather than one you handle.
   *
   * Between `isStatic` (a picture) and the default (a canvas you drag). The
   * viewport moves, but only through the tools: drag and pinch are off and the
   * arrows and the overview button are the whole vocabulary. That is the phone
   * journey. Four milestones do not fit a 375px screen at a legible size, and
   * the two answers that do not work are shrinking them to 8pt type and handing
   * someone a draggable canvas inside a scrolling page, where every vertical
   * swipe is a coin toss between panning the map and scrolling the article.
   * A button cannot be ambiguous about which one it meant.
   */
  guided?: boolean;
  /**
   * Ordered node ids the prev/next arrows step through.
   *
   * Given, the map also refuses to be panned past the graph — `translateExtent`
   * is derived from the node bounds, so the furthest you can drag is the edge
   * of the content plus a margin. Without it a hard flick leaves you looking at
   * empty canvas with no way back except the recentre button.
   */
  stops?: string[];
  /** Opening a node. See the note on `onNodeClick` in the component below. */
  onNodeOpen?: (id: string) => void;
}

/** Margin fitView leaves around the graph, as a fraction of the graph's size. */
const FIT_PADDING = 0.06;

/**
 * Fitting never ENLARGES.
 *
 * When a graph is smaller than its canvas, fitView happily scales it up to the
 * maxZoom — the dashboard journey came out at 1.53 on a laptop, with 44px
 * markers rendered at 67px and type to match. Every node in these maps is drawn
 * at its intended size already, so fitting may only ever shrink to make things
 * visible, never magnify to fill space.
 */
const FIT = { padding: FIT_PADDING, maxZoom: 1 } as const;

function Frame({
  fitKey,
  focusNodeId,
  fitFloor = 0.8,
}: {
  fitKey?: string | number;
  focusNodeId?: string;
  fitFloor?: number;
}) {
  const flow = useReactFlow();
  /* Canvas size and zoom limits straight from React Flow's own store, so the
     map re-frames when the window changes rather than staying at whatever a
     phone measured in portrait. */
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const minZoom = useStore((s) => s.minZoom);
  const maxZoom = useStore((s) => s.maxZoom);
  const first = useRef(true);

  useEffect(() => {
    if (!width || !height) return;

    /* `requestAnimationFrame` because the viewport is measured from the
       container, and on the first paint after a route change that container can
       still be zero-height — which frames the graph to nothing and looks like an
       empty map. */
    const id = requestAnimationFrame(() => {
      const duration = first.current ? 0 : 500;
      first.current = false;

      /* The zoom a fit WOULD take, computed rather than performed. Calling
         fitView and reading the viewport back does not work: fitView resolves
         asynchronously, so the value read is the previous frame's, and doing it
         only to undo it costs a visible re-frame. */
      const b = getNodesBounds(flow.getNodes());
      const pad = 1 + FIT_PADDING * 2;
      const fit = Math.min(width / (b.width * pad), height / (b.height * pad));
      const clamped = Math.min(Math.max(fit, minZoom), maxZoom);

      const node = focusNodeId ? flow.getNode(focusNodeId) : undefined;

      if (clamped >= fitFloor || !node) {
        flow.fitView({ ...FIT, duration });
        return;
      }

      const w = node.measured?.width ?? node.width ?? 0;
      const h = node.measured?.height ?? node.height ?? 0;
      flow.setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom: 1,
        duration,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [flow, fitKey, focusNodeId, fitFloor, width, height, minZoom, maxZoom]);

  return null;
}

function Tools({
  labels,
  focusNodeId,
  stops,
}: {
  labels: NonNullable<MapCanvasProps['tools']>;
  focusNodeId?: string;
  stops?: string[];
}) {
  const flow = useReactFlow();
  /* Which stop the viewport is currently nearest. Tracked rather than derived
     from the viewport on every frame: the arrows are a sequence the user is
     walking, and a purely positional answer would jump two steps when a drag
     landed between nodes. */
  const [at, setAt] = useState(() => Math.max(0, stops?.indexOf(focusNodeId ?? '') ?? 0));

  useEffect(() => {
    setAt(Math.max(0, stops?.indexOf(focusNodeId ?? '') ?? 0));
  }, [stops, focusNodeId]);

  const centreOn = useCallback((id: string | undefined, zoom = 1) => {
    const node = id ? flow.getNode(id) : undefined;
    if (!node) { flow.fitView({ ...FIT, duration: 400 }); return; }
    const w = node.measured?.width ?? node.width ?? 0;
    const h = node.measured?.height ?? node.height ?? 0;
    flow.setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom, duration: 400 });
  }, [flow]);

  const step = useCallback((by: number) => {
    if (!stops?.length) return;
    const next = Math.min(stops.length - 1, Math.max(0, at + by));
    setAt(next);
    centreOn(stops[next]);
  }, [at, stops, centreOn]);

  /* Overview frames the WHOLE route. It is the answer to "where am I in this",
     which neither arrow can give — and the way back from a lost viewport. */
  const overview = useCallback(() => {
    flow.fitView({ ...FIT, duration: 400 });
  }, [flow]);

  const first = at <= 0;
  const last = !stops?.length || at >= stops.length - 1;

  return (
    <div className="map__tools">
      {stops && stops.length > 1 && (
        <>
          <button className="map__tool" type="button" onClick={() => step(-1)} disabled={first}>
            <ChevronLeft className="map__tool-back" size={16} aria-hidden="true" />
            <span className="sr-only">{labels.prev}</span>
          </button>
          <button className="map__tool" type="button" onClick={() => step(1)} disabled={last}>
            <ChevronRight className="map__tool-fwd" size={16} aria-hidden="true" />
            <span className="sr-only">{labels.next}</span>
          </button>
        </>
      )}

      <button className="map__tool" type="button" onClick={overview}>
        <Maximize size={16} aria-hidden="true" />
        <span className="sr-only">{labels.recentre}</span>
      </button>

      {labels.zoomOut && labels.zoomIn && (
        <>
          <button className="map__tool" type="button" onClick={() => flow.zoomOut({ duration: 200 })}>
            <Minus size={16} aria-hidden="true" />
            <span className="sr-only">{labels.zoomOut}</span>
          </button>
          <button className="map__tool" type="button" onClick={() => flow.zoomIn({ duration: 200 })}>
            <Plus size={16} aria-hidden="true" />
            <span className="sr-only">{labels.zoomIn}</span>
          </button>
        </>
      )}
    </div>
  );
}

export function MapCanvas({
  nodes,
  edges,
  nodeTypes,
  srList,
  focusNodeId,
  fitFloor,
  minZoom = 0.4,
  maxZoom = 1.6,
  className,
  fitKey,
  tools,
  isStatic = false,
  guided = false,
  stops,
  onNodeOpen,
}: MapCanvasProps) {
  /**
   * How far the viewport may travel, in canvas coordinates.
   *
   * WITHOUT THIS A HARD FLICK LOSES THE MAP. React Flow pans infinitely by
   * default, so one enthusiastic drag leaves the user staring at empty dotted
   * paper with no clue which way the route went. The extent is the node bounds
   * plus a screen's worth of margin on each side — enough that the outermost
   * card can still be centred, and no further.
   */
  const extent = useMemo(() => {
    if (isStatic || nodes.length === 0) return undefined;
    const b = getNodesBounds(nodes);
    /* A margin, not a proportion. Scaling the slack with the graph meant a
       three-course path allowed 1,100px of travel past its own last card, which
       is a screen and a half of empty paper — bounded in principle and lost in
       practice. A flat margin is roughly one screen: enough that the outermost
       node can sit near the middle, not enough to leave the route behind. */
    const mx = 380;
    const my = 260;
    return [
      [b.x - mx, b.y - my],
      [b.x + b.width + mx, b.y + b.height + my],
    ] as [[number, number], [number, number]];
  }, [nodes, isStatic]);

  return (
    /* The provider wraps the WHOLE component, not just the canvas, so the
       controls can live outside the `aria-hidden` region and still reach the
       flow instance. Inside it they would have been focusable but hidden from
       assistive tech, which is the worst of both. */
    <ReactFlowProvider>
      <div className={className}>
        <div
          className="map__canvas"
          data-static={isStatic || undefined}
          data-guided={guided || undefined}
          aria-hidden="true"
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            /* The map is a map, not an editor. Nothing here is draggable,
               connectable or deletable; the only gestures are pan and zoom. */
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            edgesFocusable={false}
            nodesFocusable={false}
            /* A STATIC MAP IS A PICTURE. The dashboard journey fits entirely
               on screen, so there is nothing to pan to and dragging could only
               move it somewhere worse — and a grab cursor over it promises an
               interaction with no payoff. */
            /* A GUIDED MAP MOVES, BUT NOT UNDER THE FINGER. It is embedded in
               a scrolling page on the one viewport where a vertical drag is
               already spoken for, so the gestures stay off and the arrows carry
               the whole interaction. */
            panOnDrag={!isStatic && !guided}
            zoomOnScroll={false}
            zoomOnPinch={!isStatic && !guided}
            zoomOnDoubleClick={false}
            panOnScroll={false}
            preventScrolling={false}
            translateExtent={extent}
            /* ALWAYS SET, even when nothing listens, and the reason is not the
               callback. React Flow decides whether a node gets pointer events
               from whether anything could possibly want them — no drag, no
               selection, no focus and no click handler means it writes
               `pointer-events: none` as an INLINE style on every node. That is
               why the provider link could not be clicked and the pane's grab
               cursor showed through the cards: the clicks were landing on the
               canvas behind them, and CSS could not override an inline style
               without `!important`. Handing it a click handler is the API-level
               answer to the same problem. */
            onNodeClick={(_, node) => onNodeOpen?.(node.id)}
            /* A static map still needs fitView to be ABLE to zoom out — that
               is the only way it can show everything without panning. The user
               cannot zoom either way: wheel, pinch and double-click are all off
               above, so these bounds only constrain the framing code. */
            minZoom={minZoom}
            maxZoom={maxZoom}
            proOptions={{ hideAttribution: true }}
          >
            <Frame fitKey={fitKey} focusNodeId={focusNodeId} fitFloor={fitFloor} />
          </ReactFlow>
        </div>

        {tools && !isStatic && (
          <Tools labels={tools} focusNodeId={focusNodeId} stops={stops} />
        )}

        {/* The same route, in order, for anyone who is not looking at it — and
            the KEYBOARD path through the map, which is why it is not plain
            `.sr-only`. The canvas is aria-hidden and its controls are removed
            from the tab order, so if this list holds links and buttons they are
            the only way to reach them. It reveals itself the moment anything
            inside takes focus, so a sighted keyboard user can see what they are
            operating instead of tabbing into an invisible control. */}
        <ol className="map__list">{srList}</ol>
      </div>
    </ReactFlowProvider>
  );
}

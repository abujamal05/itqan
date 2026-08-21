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
import { useEffect, useRef, type ReactNode } from 'react';
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
}

/** Margin fitView leaves around the graph, as a fraction of the graph's size. */
const FIT_PADDING = 0.06;

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
        flow.fitView({ padding: FIT_PADDING, duration });
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
}: MapCanvasProps) {
  return (
    <div className={className}>
      <div className="map__canvas" aria-hidden="true">
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            /* The map is a map, not an editor. Nothing here is draggable,
               connectable or deletable; the only gestures are pan and zoom. */
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            edgesFocusable={false}
            nodesFocusable={false}
            panOnDrag
            zoomOnScroll={false}
            zoomOnPinch
            zoomOnDoubleClick={false}
            panOnScroll={false}
            preventScrolling={false}
            minZoom={minZoom}
            maxZoom={maxZoom}
            proOptions={{ hideAttribution: true }}
          >
            <Frame fitKey={fitKey} focusNodeId={focusNodeId} fitFloor={fitFloor} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {/* The same journey, in order, for anyone who is not looking at it. */}
      <ol className="sr-only">{srList}</ol>
    </div>
  );
}

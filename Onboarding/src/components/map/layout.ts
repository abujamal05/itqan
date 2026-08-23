import { Position } from '@xyflow/react';

/**
 * Where nodes sit on the career map.
 *
 * React Flow owns the canvas, the panning and the edges; this owns only the
 * COORDINATES, because "which way does the path wind" is a design decision and
 * should be readable in one place rather than scattered through JSX.
 *
 * The layout is a serpentine: the path runs along a row, drops, and comes back
 * the other way. That is deliberate rather than a diagonal or a spiral — a
 * serpentine keeps every node at a readable scale on a narrow viewport, because
 * the map only ever needs to be one row wide to be legible, and panning down
 * follows the same reading direction the rest of the product uses.
 *
 * RTL is handled by NEGATING x, not by transforming the canvas. Flipping the
 * whole viewport with a CSS transform would mirror the node contents too, so
 * Arabic labels would render backwards and every icon would point the wrong
 * way. Negating the coordinate keeps the nodes upright and only reverses the
 * direction the journey travels.
 */

export interface Placed {
  x: number;
  y: number;
}

/**
 * Which sides of a node its edges attach to, for a node at `i` in a serpentine.
 *
 * THE TURN IS THE WHOLE REASON THIS EXISTS. Along a row the edges attach to the
 * left and right, and which is which flips every row because the path doubles
 * back. But at the END of a row the next node is directly BELOW, not beside —
 * and attaching that edge to the side sends it out sideways and back in again,
 * curving straight across the node's own caption. That is exactly what it did:
 * the live dashed edge ran through the words "Identifying your skills".
 *
 * So a row change attaches bottom-to-top, and only the horizontal legs use the
 * sides. RTL flips left and right and nothing else — down is down in both
 * languages.
 */
export function sides(i: number, count: number, perRow: number, rtl: boolean) {
  const row = Math.floor(i / perRow);
  const forward = row % 2 === 0;
  /* `lead` is the side the PREVIOUS node is on, `trail` the side the next one
     is on, for a row running in this direction. */
  const lead = forward ? Position.Left : Position.Right;
  const trail = forward ? Position.Right : Position.Left;

  const firstInRow = i % perRow === 0;
  const lastInRow = i % perRow === perRow - 1;

  const incoming = i > 0 && firstInRow ? Position.Top : (rtl ? trail : lead);
  const outgoing = i < count - 1 && lastInRow ? Position.Bottom : (rtl ? lead : trail);

  return { incoming, outgoing };
}

/**
 * Node footprints, in canvas units. Kept here so spacing can reason about them.
 *
 * A milestone is a PIN, not a card, and the size is the reason. At card width
 * only one of the four fitted the dashboard strip, so the map opened looking
 * clipped; fitting all four meant zooming to 0.55 and rendering every label at
 * 8px. A pin is small enough that the whole journey is legible at full size,
 * which is what "a visually continuous path" actually requires. Course nodes
 * stay cards because they carry a price, a duration and an action.
 */
export const NODE = {
  milestone: { w: 136, h: 92 },
  course: { w: 248, h: 156 },
};

interface SerpentineOptions {
  /** How many nodes fit before the path turns back. */
  perRow: number;
  /** Distance between node centres along a row. */
  stepX: number;
  /** Distance between rows. */
  stepY: number;
  /**
   * How far alternate nodes rise and fall WITHIN a row.
   *
   * Without this a row is a straight line, and a user with three courses gets
   * three cards in a row with a ruler drawn through them — which is a table,
   * not a route. The wave means the path winds from the second node onward,
   * however few there are, and it is what the turns at the row ends curve into.
   */
  amplitude: number;
  rtl: boolean;
}

/**
 * Lay `count` nodes out as a serpentine and return their positions.
 *
 * Row parity decides direction, so odd rows read right-to-left in LTR and the
 * mirror of that in RTL. The turn happens at the row end, which is what gives
 * the connecting edge something to curve around and stops the map reading as a
 * grid with lines drawn on it.
 */
export function serpentine(
  count: number,
  { perRow, stepX, stepY, amplitude, rtl }: SerpentineOptions,
): Placed[] {
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    // Reverse every other row so the path snakes rather than jumping back.
    const along = row % 2 === 0 ? col : perRow - 1 - col;
    const x = along * stepX;
    /* Alternate up and down along the row. Keyed on the ABSOLUTE index, not on
       the column, so the wave carries on across a row break instead of
       resetting and putting two nodes at the same height either side of it. */
    const wave = i % 2 === 0 ? -amplitude : amplitude;
    return { x: rtl ? -x : x, y: row * stepY + wave };
  });
}

/**
 * The dashboard's four milestones, as one gentle arc rather than a serpentine.
 *
 * Four nodes do not need wrapping, and a wave across a single row is what makes
 * this read as a journey rather than as a process diagram. The rise and fall is
 * a cosine so the spacing between turns is even; an eyeballed set of offsets is
 * what made an earlier version of this look hand drawn.
 */
export function arc(count: number, stepX: number, amplitude: number, rtl: boolean): Placed[] {
  return Array.from({ length: count }, (_, i) => {
    const x = i * stepX;
    const phase = count > 1 ? (i / (count - 1)) * Math.PI * 2 : 0;
    return { x: rtl ? -x : x, y: -Math.cos(phase) * amplitude };
  });
}

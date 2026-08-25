/**
 * The line between two milestones, with its dashes normalised.
 *
 * WHY A CUSTOM EDGE EXISTS AT ALL. React Flow's default edge draws a path whose
 * length is whatever the geometry happens to be. Dash patterns are measured in
 * user units along that length, and two consequences follow, both of which were
 * visible:
 *
 *   THE FLICKER. A marching dash animates `stroke-dashoffset` by exactly one
 *   period so the pattern lands back where it started. That is only seamless if
 *   the path length is a whole number of periods. It never is, so the dash at
 *   the far end was permanently half-drawn and blinked in and out once per
 *   cycle. It looked like a rendering fault because it was one.
 *
 *   UNEVEN DOTS. A short hop between two adjacent cards got four dashes; the
 *   long return at the end of a serpentine row got fifteen. Same road, two
 *   different textures, for no reason the reader could see.
 *
 * `pathLength="100"` fixes both at once. It tells the renderer to treat this
 * path as being 100 units long whatever its real geometry, so dash values
 * become percentages. Every edge then gets the SAME number of dashes, and a
 * period that divides 100 leaves no partial dash at either end — which is what
 * makes the march seamless. The CSS picks periods that divide 100 exactly.
 */
import { getBezierPath, type EdgeProps } from '@xyflow/react';

/**
 * The normalised length every edge reports.
 *
 * 100 so the dash values in `map.css` read as percentages of the run. Changing
 * it means re-checking that each `stroke-dasharray` period still divides it.
 */
export const EDGE_PATH_LENGTH = 100;

export function PathEdge({
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
}: EdgeProps) {
  const [d] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  /* The class is React Flow's own, so every rule already written against
     `.react-flow__edge-path` keeps applying. `fill: none` is set in their
     stylesheet too but repeated here: a bezier with a fill paints a solid
     wedge under the curve, and that is a spectacular way to fail. */
  return (
    <path
      className="react-flow__edge-path"
      d={d}
      pathLength={EDGE_PATH_LENGTH}
      fill="none"
    />
  );
}

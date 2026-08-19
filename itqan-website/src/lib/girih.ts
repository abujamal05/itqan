/* ============================================================================
   GIRIH — the construction system this site is built from.

   Girih is not drawn freehand. It is assembled from a small set of decorated
   polygons whose strap lines meet at fixed angles, so the strapwork continues
   across every join automatically. That is the whole argument of the site:
   a position is a set of pieces you already hold, a role is a pattern, and the
   path is the ordered list of pieces still missing.

   Everything here runs in Astro's frontmatter, which means it executes at BUILD
   time and emits static SVG. The pattern costs the visitor zero JavaScript.

   All angles are degrees at the API edge and radians internally.
   ============================================================================ */

export interface Point {
  x: number;
  y: number;
}

/** A single strap segment: the girih line that runs between two edge midpoints. */
export type Chord = [Point, Point];

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Round to 3dp so the emitted SVG path data stays small and diff-stable. */
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function pt(cx: number, cy: number, radius: number, deg: number): Point {
  return {
    x: cx + radius * Math.cos(rad(deg)),
    y: cy + radius * Math.sin(rad(deg)),
  };
}

/** Vertices of a regular n-gon. `rotation` is degrees, 0 = first vertex at 3 o'clock. */
export function polygon(
  n: number,
  radius: number,
  cx = 0,
  cy = 0,
  rotation = -90
): Point[] {
  return Array.from({ length: n }, (_, i) => pt(cx, cy, radius, rotation + (360 / n) * i));
}

export function toPath(points: Point[], close = true): string {
  if (points.length === 0) return '';
  const [head, ...rest] = points;
  const body = rest.map((p) => `L${r3(p.x)} ${r3(p.y)}`).join('');
  return `M${r3(head.x)} ${r3(head.y)}${body}${close ? 'Z' : ''}`;
}

export function chordPath([a, b]: Chord): string {
  return `M${r3(a.x)} ${r3(a.y)}L${r3(b.x)} ${r3(b.y)}`;
}

/**
 * The chords of a star polygon {n/step}, returned in traversal order.
 *
 * Traversal order is the whole point. Each chord is stroked twice — once wide
 * in the ground colour, once narrow in the strap colour — and drawing them in
 * sequence makes every crossing resolve as an over/under. That is how the
 * interlace appears without computing a single intersection.
 *
 * When gcd(n, step) > 1 the star is several closed circuits rather than one;
 * they are concatenated, which keeps the weave reading correctly across all.
 */
export function starChords(
  n: number,
  step: number,
  radius: number,
  cx = 0,
  cy = 0,
  rotation = -90
): Chord[] {
  const verts = polygon(n, radius, cx, cy, rotation);
  const chords: Chord[] = [];
  const seen = new Set<string>();

  for (let start = 0; start < n; start += 1) {
    let i = start;
    do {
      const j = (i + step) % n;
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        chords.push([verts[i], verts[j]]);
      }
      i = j;
    } while (i !== start);
  }

  return chords;
}

/**
 * A rosette — the shamsa at the centre of a girih panel.
 *
 * Three concentric registers, each a real part of the construction rather than
 * decoration: the bounding decagon a tile would occupy, the star strap itself,
 * and the small core polygon the straps enclose.
 */
export interface Rosette {
  /** The tile outline this rosette sits inside. */
  frame: string;
  /** Strap chords, in weave order. */
  straps: string[];
  /** The enclosed core. */
  core: string;
  /** Tip points, for anchoring labels or markers to the star's points. */
  tips: Point[];
}

export function rosette(
  radius: number,
  cx = 0,
  cy = 0,
  { n = 10, step = 3, rotation = -90 } = {}
): Rosette {
  const tips = polygon(n, radius, cx, cy, rotation);
  // cos(step·halfTurn)/cos(halfTurn) is the radius at which the star's chords
  // stay straight through the inner ring rather than kinking at it.
  const half = 180 / n;
  const coreRadius = radius * (Math.cos(rad(step * half)) / Math.cos(rad(half)));

  return {
    frame: toPath(polygon(n, radius, cx, cy, rotation + half)),
    straps: starChords(n, step, radius, cx, cy, rotation).map(chordPath),
    core: toPath(polygon(n, Math.abs(coreRadius), cx, cy, rotation + half)),
    tips,
  };
}

/* ---------------------------------------------------------------------------
   THE TILE SET

   Five decorated polygons, all sharing one edge length. These are the actual
   girih tiles, not shapes that resemble them: the interior angles below are
   what make the strapwork continue across a join, and changing one breaks the
   system rather than restyling it.

   They are this site's icon system. An icon here is a tile the visitor either
   holds or does not, so the marks carry meaning instead of decorating a
   heading.
   --------------------------------------------------------------------------- */

export type TileName = 'decagon' | 'pentagon' | 'hexagon' | 'bowtie' | 'rhombus';

/** Interior angles, in order, for each tile. All edges are length 1. */
const TILE_ANGLES: Record<TileName, number[]> = {
  decagon: [144, 144, 144, 144, 144, 144, 144, 144, 144, 144],
  pentagon: [108, 108, 108, 108, 108],
  hexagon: [72, 144, 144, 72, 144, 144],
  bowtie: [72, 72, 216, 72, 72, 216],
  rhombus: [72, 108, 72, 108],
};

/**
 * Walk a polygon from its interior angles.
 *
 * Turning by the exterior angle at each vertex traces the outline; because
 * every girih tile is equilateral, edge length is a single scalar and the walk
 * closes exactly. The result is recentred on its own bounding box so tiles of
 * different shapes drop into the same slot without eyeballed offsets.
 */
function walk(angles: number[], edge: number): Point[] {
  const points: Point[] = [];
  let x = 0;
  let y = 0;
  let heading = 0;

  for (const interior of angles) {
    points.push({ x, y });
    x += edge * Math.cos(rad(heading));
    y += edge * Math.sin(rad(heading));
    heading += 180 - interior;
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2;

  return points.map((p) => ({ x: p.x - midX, y: p.y - midY }));
}

export interface Tile {
  /** The tile outline. */
  outline: string;
  /** Its strap decoration, in weave order. */
  straps: string[];
  /** viewBox that fits the tile with room for the strap's stroke width. */
  viewBox: string;
}

/**
 * A tile with its girih decoration.
 *
 * The straps enter at each edge midpoint at 54 degrees to the edge — that
 * constant is what makes any two tiles continue each other's lines — and are
 * connected midpoint to midpoint across the tile's interior.
 */
export function tile(name: TileName, edge = 24): Tile {
  const verts = walk(TILE_ANGLES[name], edge);
  const n = verts.length;

  const mids = verts.map((v, i) => {
    const next = verts[(i + 1) % n];
    return { x: (v.x + next.x) / 2, y: (v.y + next.y) / 2 };
  });

  // Connect each edge midpoint to the midpoint two edges along. On every tile
  // in the set this is the connection whose angle to the edge is 54 degrees,
  // which is why one rule decorates all five.
  const straps: Chord[] = [];
  const seen = new Set<string>();
  const skip = n <= 4 ? 1 : 2;

  for (let i = 0; i < n; i += 1) {
    const j = (i + skip) % n;
    const key = i < j ? `${i}:${j}` : `${j}:${i}`;
    if (seen.has(key)) continue;
    seen.add(key);
    straps.push([mids[i], mids[j]]);
  }

  const all = [...verts, ...mids];
  const pad = edge * 0.28;
  const minX = Math.min(...all.map((p) => p.x)) - pad;
  const minY = Math.min(...all.map((p) => p.y)) - pad;
  const w = Math.max(...all.map((p) => p.x)) - minX + pad;
  const h = Math.max(...all.map((p) => p.y)) - minY + pad;

  return {
    outline: toPath(verts),
    straps: straps.map(chordPath),
    viewBox: `${r3(minX)} ${r3(minY)} ${r3(w)} ${r3(h)}`,
  };
}

/**
 * A field of rosettes on a staggered lattice, for large background surfaces.
 *
 * The cells carry POSITIONS ONLY. The rosette geometry is emitted once into a
 * <defs> and every cell instantiates it with <use>, because the naive version
 * of this — full path data per cell — put 874KB of duplicated coordinates into
 * the home page's HTML. One shared definition takes that to a few kilobytes,
 * and the pattern is identical in every cell anyway.
 *
 * `held` decides which cells read as set and which read as open edge. It takes
 * the cell's row and column so a caller can describe a real state (a position
 * part built, a path part walked) rather than scattering random highlights.
 */
export interface FieldCell {
  cx: number;
  cy: number;
  row: number;
  col: number;
  held: boolean;
  /** Distance from the origin corner, in lattice steps. Drives the stagger. */
  order: number;
}

export function field(
  width: number,
  height: number,
  radius: number,
  held: (row: number, col: number) => boolean = () => true
): FieldCell[] {
  const stepX = radius * 1.9;
  const stepY = radius * 1.62;
  const cols = Math.ceil(width / stepX) + 2;
  const rows = Math.ceil(height / stepY) + 2;
  const cells: FieldCell[] = [];

  for (let row = -1; row < rows; row += 1) {
    for (let col = -1; col < cols; col += 1) {
      cells.push({
        cx: r3(col * stepX + (row % 2 === 0 ? 0 : stepX / 2)),
        cy: r3(row * stepY),
        row,
        col,
        held: held(row, col),
        order: row + col,
      });
    }
  }

  return cells;
}

/**
 * Hud with a speech bubble — the mascot and his line as one unit.
 *
 * Replaces the plain instruction box. A bubble reads as someone talking to you
 * rather than a system notice, which is the difference between a guide and a
 * label, and it is the only treatment that makes the mascot feel present in the
 * flow instead of parked beside it.
 *
 * Placement adapts rather than scales:
 *   wide   — Hud above, bubble beneath him, tail pointing up at his beak.
 *            He has room, so he is large and the line sits where the eye
 *            travels next.
 *   narrow — a compact row: small Hud, bubble beside him, tail pointing at him
 *            horizontally. Vertical space is the scarce resource on a phone and
 *            a stacked mascot would push the actual task below the fold.
 *
 * The line is decorative support and never the only place something is said —
 * every instruction it carries also exists in the heading or body copy, because
 * Hud is aria-hidden and a screen-reader user must lose nothing.
 */
import { useEffect, useRef, useState } from 'react';
import { Hud } from './Hud';
import type { Pose } from './Hud';

export function HudGuide({
  pose,
  then,
  says,
  loop = true,
  eager = false,
}: {
  pose: Pose;
  then?: Pose;
  says: string;
  loop?: boolean;
  eager?: boolean;
}) {
  // Re-animate the bubble whenever the line changes, so a new message is
  // noticed without the user having to re-read the whole screen.
  const [pulse, setPulse] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setPulse((n) => n + 1);
  }, [says]);

  return (
    <div className="guide">
      <div className="guide__hud">
        <Hud pose={pose} then={then} loop={loop} eager={eager} />
      </div>
      <p className="guide__bubble" key={pulse}>{says}</p>
    </div>
  );
}

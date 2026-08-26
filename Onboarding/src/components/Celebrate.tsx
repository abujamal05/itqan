/**
 * The one moment this product is allowed to cheer.
 *
 * THE SCORE MOVING IS THE CELEBRATION; the confetti is the accompaniment. That
 * ordering is the whole design. A readiness figure counting up from zero on
 * every page load is a number dressed to look impressive, which the evidence
 * fence bans outright and rightly — it makes a measurement read as a reveal,
 * and a reveal reads as a guess. A figure travelling ONCE, from the value this
 * person last saw to the value their own work produced, is reporting a change
 * they caused. Same animation, opposite meaning, and the entire difference is
 * where it starts.
 *
 * So: it never runs on an ordinary visit, it never starts from zero, and it
 * only follows a run that finished and actually moved the number. See
 * `lib/celebrate.ts` for how that is established.
 *
 * REDUCED MOTION KEEPS THE CELEBRATION AND DROPS THE MOVEMENT. The message and
 * the delta are words; the counting and the confetti are not. So the number
 * lands immediately and no canvas is created at all — which is the reduced
 * motion MECHANISM the design system requires, rather than a kill switch that
 * would leave someone who asked for less movement with no idea anything had
 * happened.
 */
import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { PartyPopper } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Celebration } from '../lib/celebrate';

/** Longer than a routine transition, because this one is the authored moment. */
const COUNT_MS = 900;

/** True when the person has asked the system for less movement. */
const reduced = () =>
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that travels, once.
 *
 * `requestAnimationFrame` rather than a CSS transition because the thing being
 * animated is the TEXT, not a style — there is no interpolable property between
 * "72" and "78". Exponential ease-out, the same curve the rest of the system
 * uses for a confident arrival, so it decelerates into the real value rather
 * than ticking mechanically to it.
 */
export function CountUp({ from, to, format }: {
  from: number;
  to: number;
  format: (n: number) => string;
}) {
  const [shown, setShown] = useState(() => (reduced() ? to : from));

  useEffect(() => {
    if (reduced()) { setShown(to); return undefined; }

    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / COUNT_MS);
      /* cubic ease-out: fast, then settling. Matches `--ease-out`'s character
         closely enough that the arc under the number and the number itself
         read as one movement. */
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);

  /* The FINAL value is what assistive tech reads, always. A screen reader
     following a counter would announce a dozen numbers that were never true. */
  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(to)}</span>
    </>
  );
}

/**
 * The confetti, and the sentence that carries the news without it.
 *
 * The canvas is created and destroyed with the component and sits behind
 * everything, `pointer-events: none`, so it cannot intercept a tap on the page
 * it is celebrating.
 */
export function Celebrate({ celebration }: { celebration: Celebration }) {
  const { t, formatNumber } = useI18n();
  const host = useRef<HTMLDivElement>(null);
  const gained = celebration.to - celebration.from;

  useEffect(() => {
    if (reduced() || !host.current) return undefined;

    const canvas = document.createElement('canvas');
    canvas.className = 'celebrate__canvas';
    host.current.appendChild(canvas);

    const fire = confetti.create(canvas, { resize: true, useWorker: true });
    /* TWO BURSTS FROM THE EDGES, not one from the middle. A centred burst over
       a centred glow is the stock-template move the design system names by
       hand; from the sides it reads as something thrown rather than something
       generated. Navy, gold and paper only — the brand five, so even the
       confetti is recognisably this product. */
    const common = { particleCount: 34, spread: 62, startVelocity: 42, ticks: 140, disableForReducedMotion: true, colors: ['#F39F1C', '#071055', '#FAF8F3', '#FFB443'] };
    void fire({ ...common, angle: 60, origin: { x: 0.08, y: 0.7 } });
    void fire({ ...common, angle: 120, origin: { x: 0.92, y: 0.7 } });

    return () => {
      fire.reset();
      canvas.remove();
    };
  }, []);

  return (
    <div className="celebrate" ref={host}>
      <p className="celebrate__line" role="status">
        <PartyPopper size={18} aria-hidden="true" />
        {/* The news is in words first. Someone with reduced motion, a blocked
            canvas or a screen reader gets the whole of it from this line. */}
        <span>{t('dash.celebrate', { n: formatNumber(gained) })}</span>
      </p>
    </div>
  );
}

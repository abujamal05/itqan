/**
 * Reveals text the way it would arrive if it were streaming.
 *
 * The service returns a whole message today, so this is presentation rather than
 * transport — but it is not decoration. A wall of text appearing in one frame
 * gives a reader no idea where to start; the same text arriving at reading pace
 * tells them, and it is the difference between a screen that answered and a
 * screen that dumped.
 *
 * When the endpoint does stream, this hook is what it replaces: the view already
 * renders a growing string, so only the source of the string changes.
 *
 * Three things it gets right that a naive setInterval does not:
 *   - it advances on a CLOCK, not per tick, so a slow frame catches up instead of
 *     falling behind and stretching a long answer into something tedious;
 *   - it cancels on unmount and when the text changes, so switching threads
 *     mid-reveal cannot leave a loop writing into a gone component;
 *   - reduced motion gets the whole string immediately, because a typewriter is
 *     movement and someone who asked for less of it still needs the answer.
 */
import { useEffect, useRef, useState } from 'react';

/**
 * Characters per second.
 *
 * Tuned against what real assistants actually stream at, roughly 30 to 80 tokens
 * a second, which lands around here. The first pass used 900 and a typical
 * answer finished inside 400ms — technically an animation, and invisible. Slower
 * would be worse than none: a reader who can outpace the text is being made to
 * wait for their own answer.
 */
const RATE = 260;

export function useTypewriter(
  text: string,
  { enabled, onDone }: { enabled: boolean; onDone?: () => void },
) {
  const [shown, setShown] = useState(() => (enabled ? '' : text));
  /* A ref so the effect does not restart every time the parent re-renders with a
     fresh closure. The callback only ever fires once per reveal anyway. */
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (!enabled) {
      setShown(text);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(text);
      done.current?.();
      return;
    }

    let raf = 0;
    const started = performance.now();
    setShown('');

    const step = (now: number) => {
      const chars = Math.floor(((now - started) / 1000) * RATE);
      if (chars >= text.length) {
        setShown(text);
        done.current?.();
        return;
      }
      setShown(text.slice(0, chars));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, enabled]);

  return shown;
}

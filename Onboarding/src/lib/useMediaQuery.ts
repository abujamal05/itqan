/**
 * A media query, as state.
 *
 * For the cases CSS cannot reach: a layout computed in JavaScript, where the
 * arrangement itself changes rather than its styling. The dashboard journey is
 * the reason it exists — four milestones sit in one row on a laptop and two
 * rows of two on a phone, and those are different COORDINATES, not different
 * CSS. Anything a media query can do in the stylesheet still belongs there.
 *
 * Reads once on mount rather than during render, so server-side and first-paint
 * are consistent, and subscribes for changes so rotating a phone re-lays it out.
 */
import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);

  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);

  return matches;
}

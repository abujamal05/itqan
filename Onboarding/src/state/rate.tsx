/**
 * When to ask what they think, and who gets to trigger it.
 *
 * TWO MOMENTS, AND ONLY ONE OF THEM IS FULLY IN OUR GIFT.
 *
 *   LOGGING OUT is ours. The menu asks before it signs anybody out, and either
 *   answer carries on to the log out — the prompt is a question, not a toll.
 *
 *   CLOSING THE WINDOW is not. **A page cannot show its own dialog on close.**
 *   `beforeunload` may only ask the browser to show ITS generic "leave site?"
 *   box, which is not a rating and which browsers increasingly ignore, and
 *   `pagehide` fires too late to render anything. So the closest honest thing
 *   is to catch the INTENT: the pointer leaving the top edge of the viewport,
 *   heading for the tab bar or the close button. That is a real signal on a
 *   desktop and has no equivalent on a phone, which is stated here rather than
 *   pretended around.
 *
 * ONCE PER SESSION, whichever fires first, and only when `lib/rating.ts` says
 * the person has actually used the product.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { useRunInFlight } from '../components/PipelineProgress';
import { isResultRoute, markAsked, markRated, mayAsk } from '../lib/rating';

interface RateValue {
  open: boolean;
  /** Ask now if the gates allow it. Returns whether it actually opened. */
  ask: () => boolean;
  /** Rated or skipped; either way the prompt closes and does not return. */
  finish: (rated: boolean) => void;
  /** Dismissed without answering — Escape, the backdrop. */
  dismiss: () => void;
}

const RateContext = createContext<RateValue | null>(null);

export function RateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const running = useRunInFlight();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  /**
   * Have they LOOKED at anything this session?
   *
   * A ref rather than state: it only ever turns true, nothing renders from it,
   * and putting it in state would re-render every screen on the first
   * navigation for no visible reason.
   */
  const used = useRef(false);
  useEffect(() => {
    if (isResultRoute(pathname)) used.current = true;
  }, [pathname]);

  /** Once per session, whichever trigger gets there first. */
  const asked = useRef(false);

  const ask = useCallback(() => {
    if (asked.current || open) return false;
    if (!mayAsk(user?.id, {
      onboarded: !!user?.onboarded,
      running,
      usedThisSession: used.current,
      path: pathname,
    })) return false;
    asked.current = true;
    setOpen(true);
    return true;
  }, [user, running, pathname, open]);

  /**
   * Leaving the top of the window, which is where the tab bar and the close
   * button are.
   *
   * Guarded behind a fine pointer: a touch device has no cursor to leave the
   * viewport, and `mouseout` there fires for reasons that have nothing to do
   * with leaving. `relatedTarget` being null is what separates "left the
   * document" from "moved between two elements inside it".
   */
  useEffect(() => {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return undefined;
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget || e.clientY > 0) return;
      ask();
    };
    document.addEventListener('mouseout', onOut);
    return () => document.removeEventListener('mouseout', onOut);
  }, [ask]);

  const finish = useCallback((rated: boolean) => {
    if (user) {
      if (rated) markRated(user.id);
      else markAsked(user.id);
    }
    setOpen(false);
  }, [user]);

  const dismiss = useCallback(() => {
    if (user) markAsked(user.id);
    setOpen(false);
  }, [user]);

  const value = useMemo(
    () => ({ open, ask, finish, dismiss }),
    [open, ask, finish, dismiss],
  );

  return <RateContext.Provider value={value}>{children}</RateContext.Provider>;
}

export function useRate(): RateValue {
  const v = useContext(RateContext);
  if (!v) throw new Error('useRate must be used inside <RateProvider>');
  return v;
}

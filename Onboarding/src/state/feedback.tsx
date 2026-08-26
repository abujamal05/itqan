/**
 * What the user thinks of the things they are shown, held once for the app.
 *
 * WHY A PROVIDER RATHER THAN LOCAL STATE. The same course appears on the
 * dashboard and on the courses page, and the same posting on the dashboard and
 * on jobs. Local state in each list means disliking a card on one screen and
 * finding it unmarked on the other — which reads as the product forgetting,
 * one navigation after the user told it something. One record, read once, is
 * also one request instead of one per list.
 *
 * WHY IT IS OPTIMISTIC. The verdict is applied to the local record before the
 * request goes out, and the request is fire and forget (see the note on
 * `sendFeedback` in types.ts). A thumb that waits for a round trip before it
 * moves feels broken on a phone, and there is nothing the user could usefully
 * do about a failure anyway.
 *
 * `saved` is what makes it a preference rather than a highlight: it comes back
 * from the account on load, so a like survives a reload. That is the whole
 * contract with the ranker, and the reason the endpoint exists.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import type { ReactNode } from 'react';
import { emptyFeedback } from '../api';
import type {
  Course, Feedback, FeedbackState, FeedbackSubject, FeedbackVerdict, ItqanApi,
  DislikeReason, JobMatch,
} from '../api';

interface FeedbackValue {
  /** The verdict this account left on an item, or undefined for no opinion. */
  verdictFor: (subject: FeedbackSubject, itemId: string) => FeedbackVerdict | undefined;
  /** Record a verdict. Optimistic; the request is fire and forget. */
  send: (input: Feedback) => void;
  /** Drop a verdict locally. Used by undo, which also re-sends the opposite. */
  clear: (subject: FeedbackSubject, itemId: string) => void;
  /** A replacement course for one the user rejected, or null if none exists. */
  /**
   * One replacement for a rejected recommendation of either kind, carrying the
   * reason it was rejected. Throws the server's refusal rather than swallowing
   * it — a spent budget is not "nothing else fits".
   */
  findAlternative: (input: {
    subject: FeedbackSubject;
    itemId: string;
    reason: DislikeReason | null;
    note: string | null;
    exclude: string[];
  }) => Promise<Course | JobMatch | null>;
}

const Ctx = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({
  api, enabled, children,
}: {
  api: ItqanApi;
  /** Only for a signed-in user who has finished onboarding; nothing to rate before. */
  enabled: boolean;
  children: ReactNode;
}) {
  const [state, setState] = useState<FeedbackState>(emptyFeedback);

  useEffect(() => {
    if (!enabled) { setState(emptyFeedback()); return; }
    let alive = true;
    // Failure is indistinguishable from "no opinions yet" to the user, and the
    // client already turns a failed read into an empty state, so there is
    // nothing to report here.
    void api.getFeedback().then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  }, [api, enabled]);

  const verdictFor = useCallback(
    (subject: FeedbackSubject, itemId: string) =>
      state[subject === 'job' ? 'jobs' : 'courses'][itemId],
    [state],
  );

  const send = useCallback((input: Feedback) => {
    const key = input.subject === 'job' ? 'jobs' : 'courses';
    setState((cur) => ({ ...cur, [key]: { ...cur[key], [input.itemId]: input.verdict } }));
    void api.sendFeedback(input);
  }, [api]);

  const clear = useCallback((subject: FeedbackSubject, itemId: string) => {
    const key = subject === 'job' ? 'jobs' : 'courses';
    setState((cur) => {
      const next = { ...cur[key] };
      delete next[itemId];
      return { ...cur, [key]: next };
    });
  }, []);

  const findAlternative = useCallback(
    (input: Parameters<FeedbackValue['findAlternative']>[0]) => api.findAlternative(input),
    [api],
  );

  const value = useMemo<FeedbackValue>(
    () => ({ verdictFor, send, clear, findAlternative }),
    [verdictFor, send, clear, findAlternative],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFeedback() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>');
  return ctx;
}

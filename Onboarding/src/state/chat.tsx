/**
 * Hud's chat state.
 *
 * Deliberately free of the DOM, like the onboarding provider it is modelled on:
 * the transport lives in src/api, the state machine lives here, and the view is
 * a thin consumer. That is the line that keeps the view layer liftable later.
 *
 * The thing this holds that a message list would not: a junction is not
 * consumed when it is answered. Walking a direction APPENDS the junction it
 * leads to and records the choice on the one it came from; the directions not
 * walked stay exactly where they were and stay re-enterable. Nothing on this
 * screen is ever removed, so `taken` is a record of choices rather than a
 * pointer to the only branch that survived.
 *
 * NOT A BUG: switching language does not re-translate junctions already on the
 * spine. Every data screen in this app re-fetches on `locale` because a list of
 * jobs is a view of current state, and the services answer in whatever the
 * cookie says. A conversation is not state, it is history — re-fetching it
 * would mean re-asking the questions, and quietly re-asking on a language
 * toggle is worse than a spine that keeps each turn in the language it was
 * spoken. Past turns stay as they were; the next one follows the new locale.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChatJunction, ItqanApi } from '../api';

/** What a failed turn was trying to do, so retrying repeats it exactly. */
type LastTurn =
  | { kind: 'ask'; question: string }
  | { kind: 'fork'; junctionId: string; forkId: string }
  | null;

interface ChatValue {
  threadId: string | null;
  /** Server junctions, in order. Junction zero is authored in the view. */
  junctions: ChatJunction[];
  /** Which fork was walked, per junction. Covers the view's junction zero too. */
  taken: Record<string, string>;
  /** A turn is in flight. Drives Hud's pose and the live region. */
  pending: boolean;
  failed: boolean;
  ask: (question: string) => void;
  takeFork: (junctionId: string, forkId: string) => void;
  retry: () => void;
  /** Starts a fresh thread. The old one stays on the server. */
  reset: () => void;
}

const Ctx = createContext<ChatValue | null>(null);

export function ChatProvider({ api, children }: { api: ItqanApi; children: ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [junctions, setJunctions] = useState<ChatJunction[]>([]);
  const [taken, setTaken] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * A ref, not state, and both halves matter.
   *
   * `last` is only read when retry is pressed, so holding it in state would
   * re-render the whole spine on every turn for nothing. `inFlight` is what
   * stops a double submit — a second turn arriving mid-flight would append its
   * junction out of order, and the spine's order is the user's own path.
   */
  const last = useRef<LastTurn>(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async (turn: Exclude<LastTurn, null>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      last.current = turn;
      setPending(true);
      setFailed(false);

      // Optimistic in ORDER, never in content: the choice is recorded now so
      // the fork does not sit un-acknowledged for the length of a turn. The
      // server's own junction is what actually gets appended.
      if (turn.kind === 'fork') {
        setTaken((t) => ({ ...t, [turn.junctionId]: turn.forkId }));
      }

      try {
        const result =
          turn.kind === 'ask'
            ? await api.ask({ threadId, question: turn.question })
            : await api.takeFork({ threadId, junctionId: turn.junctionId, forkId: turn.forkId });

        setThreadId(result.threadId);
        setJunctions((js) => [...js, result.junction]);
      } catch {
        setFailed(true);
        // Give the fork back. A direction that appears walked when the turn
        // never landed would leave the user looking at a path they cannot see.
        if (turn.kind === 'fork') {
          setTaken((t) => {
            const next = { ...t };
            delete next[turn.junctionId];
            return next;
          });
        }
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [api, threadId],
  );

  const ask = useCallback(
    (question: string) => {
      const q = question.trim();
      if (q) void run({ kind: 'ask', question: q });
    },
    [run],
  );

  const takeFork = useCallback(
    (junctionId: string, forkId: string) => void run({ kind: 'fork', junctionId, forkId }),
    [run],
  );

  const retry = useCallback(() => {
    if (last.current) void run(last.current);
  }, [run]);

  const reset = useCallback(() => {
    setThreadId(null);
    setJunctions([]);
    setTaken({});
    setFailed(false);
    last.current = null;
  }, []);

  const value = useMemo(
    () => ({ threadId, junctions, taken, pending, failed, ask, takeFork, retry, reset }),
    [threadId, junctions, taken, pending, failed, ask, takeFork, retry, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChat() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}

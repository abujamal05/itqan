/**
 * Hud's chat state.
 *
 * Deliberately free of the DOM, like the onboarding provider it is modelled on:
 * the transport lives in src/api, the state machine lives here, and the view is
 * a thin consumer. That is the line that keeps the view layer liftable later.
 *
 * NOT A BUG: switching language does not re-translate messages already in the
 * thread. Every data screen in this app re-fetches on `locale` because a list of
 * jobs is a view of current state, and the services answer in whatever the
 * cookie says. A conversation is not state, it is history — re-fetching it would
 * mean re-asking the questions, and quietly re-asking on a language toggle is
 * worse than a thread that keeps each turn in the language it was spoken. Past
 * turns stay as they were; the next one follows the new locale.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChatMessage, ItqanApi } from '../api';

interface ChatValue {
  threadId: string | null;
  messages: ChatMessage[];
  /** A turn is in flight. Drives Hud's pose and the live region. */
  pending: boolean;
  failed: boolean;
  ask: (question: string) => void;
  retry: () => void;
  /** Starts a fresh thread. The old one stays on the server. */
  reset: () => void;
}

const Ctx = createContext<ChatValue | null>(null);

export function ChatProvider({ api, children }: { api: ItqanApi; children: ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Refs, not state, and both halves matter.
   *
   * `last` is only read when retry is pressed, so holding it in state would
   * re-render the whole thread on every turn for nothing. `inFlight` is what
   * stops a double submit — a second turn arriving mid-flight would append out
   * of order, and the order of a conversation is the whole of its meaning.
   */
  const last = useRef<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(
    async (question: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      last.current = question;
      setPending(true);
      setFailed(false);

      /* The user's own turn appears immediately, before the request goes out.
         Optimistic in ORDER, never in content: it is their text, so there is
         nothing to be wrong about, and waiting a second to echo back what
         somebody just typed is the thing that makes a chat feel broken. */
      const mine: ChatMessage = {
        id: `local-${Date.now().toString(36)}`,
        role: 'user',
        text: question,
        createdAt: Date.now(),
      };
      setMessages((ms) => [...ms, mine]);

      try {
        const result = await api.ask({ threadId, question });
        setThreadId(result.threadId);
        setMessages((ms) => [...ms, result.message]);
      } catch {
        setFailed(true);
        /* Take the question back out. Leaving it sitting there under a failure
           notice reads as "sent", and the retry would then post it twice. */
        setMessages((ms) => ms.filter((m) => m.id !== mine.id));
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
      if (q) void run(q);
    },
    [run],
  );

  const retry = useCallback(() => {
    if (last.current) void run(last.current);
  }, [run]);

  const reset = useCallback(() => {
    setThreadId(null);
    setMessages([]);
    setFailed(false);
    last.current = null;
  }, []);

  const value = useMemo(
    () => ({ threadId, messages, pending, failed, ask, retry, reset }),
    [threadId, messages, pending, failed, ask, retry, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChat() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}

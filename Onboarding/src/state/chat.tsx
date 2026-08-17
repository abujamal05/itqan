/**
 * Hud's chat state.
 *
 * Free of the DOM, like the onboarding provider it is modelled on: the transport
 * lives in src/api, the state machine lives here, and the view is a thin
 * consumer. That is the line that keeps the view layer liftable later.
 *
 * NOT A BUG: switching language does not re-translate messages already in the
 * thread. Every data screen re-fetches on `locale` because a list of jobs is a
 * view of current state. A conversation is history — re-fetching it would mean
 * re-asking the questions, and quietly re-asking on a language toggle is worse
 * than a thread that keeps each turn in the language it was spoken.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { ReactNode } from 'react';
import type { ChatMessage, ChatThreadSummary, ChatVerdict, ItqanApi } from '../api';

interface ChatValue {
  threadId: string | null;
  messages: ChatMessage[];
  /** Saved conversations, newest first. Empty is a normal answer. */
  threads: ChatThreadSummary[];
  /** True while an existing thread is being read back. */
  loading: boolean;
  /** A turn is in flight. */
  pending: boolean;
  failed: boolean;
  /**
   * The id of the message currently being revealed, if any. The view types it
   * out; nothing here knows how that looks.
   */
  writingId: string | null;
  /** Ratings this session, so a pressed thumb can stay pressed. */
  verdicts: Record<string, ChatVerdict>;
  ask: (question: string, files?: File[]) => void;
  /** Re-asks the question that produced a given answer, replacing it. */
  retryMessage: (messageId: string) => void;
  retry: () => void;
  rate: (messageId: string, verdict: ChatVerdict) => void;
  /** Loads a saved conversation. */
  open: (id: string) => void;
  /** Starts a fresh one. The old one stays on the server. */
  reset: () => void;
  /** Marks the reveal finished, so the view stops animating. */
  doneWriting: (id: string) => void;
}

const Ctx = createContext<ChatValue | null>(null);

export function ChatProvider({ api, children }: { api: ItqanApi; children: ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [writingId, setWritingId] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, ChatVerdict>>({});

  /**
   * Refs, not state. `last` is only read when retry is pressed, so keeping it in
   * state would re-render the thread on every turn for nothing. `inFlight` stops
   * a double submit: a second turn arriving mid-flight would append out of
   * order, and the order of a conversation is the whole of its meaning.
   */
  const last = useRef<{ question: string; files?: File[] } | null>(null);
  const inFlight = useRef(false);

  const loadThreads = useCallback(() => {
    void api.listThreads().then(setThreads).catch(() => setThreads([]));
  }, [api]);

  useEffect(loadThreads, [loadThreads]);

  const run = useCallback(
    async (question: string, files?: File[], replacing?: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      last.current = { question, files };
      setPending(true);
      setFailed(false);

      /**
       * The user's own turn appears before the request goes out. Optimistic in
       * ORDER, never in content: it is their text, so there is nothing to be
       * wrong about, and waiting a second to echo back what somebody just typed
       * is what makes a chat feel broken.
       *
       * A retry instead truncates back to just before the answer being replaced,
       * so the question is not asked twice on screen.
       */
      const mine: ChatMessage = {
        id: `local-${Date.now().toString(36)}`,
        role: 'user',
        text: question,
        ...(files?.length
          ? {
            attachments: files.map((f, i) => ({
              id: `local-att-${i}`,
              fileName: f.name,
              mimeType: f.type || 'application/octet-stream',
              sizeBytes: f.size,
            })),
          }
          : {}),
        createdAt: Date.now(),
      };

      let restore: ChatMessage[] | null = null;
      setMessages((ms) => {
        restore = ms;
        if (replacing) {
          const at = ms.findIndex((m) => m.id === replacing);
          return at > 0 ? ms.slice(0, at) : ms;
        }
        return [...ms, mine];
      });

      try {
        const result = await api.ask({ threadId, question, files });
        setThreadId(result.threadId);
        setMessages((ms) => [...ms, result.message]);
        setWritingId(result.message.id);
        // The title comes from the first question, so the list is only right
        // after a turn lands.
        loadThreads();
      } catch {
        setFailed(true);
        // Put the thread back exactly as it was. Leaving the question sitting
        // under a failure notice reads as "sent", and the retry would post it
        // twice.
        if (restore) setMessages(restore);
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [api, threadId, loadThreads],
  );

  const ask = useCallback(
    (question: string, files?: File[]) => {
      const q = question.trim();
      if (q || files?.length) void run(q, files);
    },
    [run],
  );

  const retryMessage = useCallback(
    (messageId: string) => {
      const at = messages.findIndex((m) => m.id === messageId);
      const asked = at > 0 ? messages[at - 1] : null;
      if (asked?.role === 'user') void run(asked.text, undefined, messageId);
    },
    [messages, run],
  );

  const retry = useCallback(() => {
    if (last.current) void run(last.current.question, last.current.files);
  }, [run]);

  const rate = useCallback(
    (messageId: string, verdict: ChatVerdict) => {
      // Pressing the same thumb again clears it, which is the only way to undo.
      setVerdicts((v) => {
        const next = { ...v };
        if (next[messageId] === verdict) delete next[messageId];
        else next[messageId] = verdict;
        return next;
      });
      if (threadId) void api.rateMessage({ threadId, messageId, verdict });
    },
    [api, threadId],
  );

  const open = useCallback(
    (id: string) => {
      if (id === threadId) return;
      setLoading(true);
      setFailed(false);
      setWritingId(null);
      void api
        .getThread(id)
        .then((thread) => {
          setThreadId(thread.id);
          // Read back, not written out: replaying a typewriter over history
          // would be a lie about when it was said.
          setMessages(thread.messages);
        })
        .catch(() => setFailed(true))
        .finally(() => setLoading(false));
    },
    [api, threadId],
  );

  const reset = useCallback(() => {
    setThreadId(null);
    setMessages([]);
    setFailed(false);
    setWritingId(null);
    last.current = null;
  }, []);

  const doneWriting = useCallback((id: string) => {
    setWritingId((current) => (current === id ? null : current));
  }, []);

  const value = useMemo(
    () => ({
      threadId, messages, threads, loading, pending, failed, writingId, verdicts,
      ask, retryMessage, retry, rate, open, reset, doneWriting,
    }),
    [
      threadId, messages, threads, loading, pending, failed, writingId, verdicts,
      ask, retryMessage, retry, rate, open, reset, doneWriting,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChat() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>');
  return ctx;
}

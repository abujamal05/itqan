/**
 * Keeping the journey in step with what the person has actually done.
 *
 * THE PROBLEM THIS SOLVES. Replacing a CV, correcting a skill and finishing a
 * course all change what the answers should be, and none of them changed the
 * answers. Someone could add three skills and watch a readiness score, a course
 * path and a job list go on describing the person they were last week, with
 * nothing on screen admitting it.
 *
 * SCOPE IS THE WHOLE IDEA. A changed document invalidates the extraction, so
 * the documents are read again and everything downstream is rebuilt from what
 * that finds. Changed skills do not: the reading was fine and the person is
 * correcting its output, so the run starts from the corrected skills and
 * carries on with what it already knows. Charging someone to re-read documents
 * nobody touched, and dropping them back at a confirmation screen for an
 * extraction they never asked to redo, is what "one big rerun" costs.
 *
 * NOTHING RUNS WITHOUT A PRICE ON SCREEN AND A YES. Every path into this ends
 * at a confirmation naming the token cost, and the cost is the SERVER'S — there
 * is no published price for a partial run the way there is for a message, and a
 * figure the browser guessed would be a fabricated number in front of somebody
 * about to spend their day's budget.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { useApi } from './api';
import { useAuth } from './auth';
import { useChat } from './chat';
import { markRunFinished } from '../lib/celebrate';
import type { PendingUpdate, UpdateScope } from '../api';

const NOTHING: PendingUpdate = {
  scope: null, reasons: [], cost: 0, remaining: 0, affordable: false, deferred: false,
};

interface UpdateValue {
  pending: PendingUpdate;
  /** Re-ask the server. Called after anything that could make work stale. */
  refresh: () => void;
  /** True while the agents are working, so callers can show it rather than guess. */
  running: boolean;
  /** Runs the pending scope. Throws the server's refusal for the caller to show. */
  run: () => Promise<void>;
  /** "Remind me later." Hidden for this session; the server brings it back. */
  defer: () => void;
  /**
   * Hidden for this session only, without telling the server.
   *
   * The course flow uses it: someone who has just been asked and said "later"
   * must not be asked again by the banner two seconds afterwards, but the
   * server's own deferral is a separate promise about the NEXT sign-in.
   */
  silenced: boolean;
}

const UpdateContext = createContext<UpdateValue | null>(null);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const { user } = useAuth();
  const { runAgents, resultsVersion } = useChat();
  const [pending, setPending] = useState<PendingUpdate>(NOTHING);
  const [running, setRunning] = useState(false);
  const [silenced, setSilenced] = useState(false);
  const [asked, setAsked] = useState(0);

  /* Re-asked when a run lands, too: finishing one update can leave another
     legitimately pending, and a stale "nothing to do" is how the prompt would
     have gone missing exactly when it was most needed. */
  useEffect(() => {
    if (!user) { setPending(NOTHING); return undefined; }
    const ac = new AbortController();
    api.getPendingUpdate(ac.signal)
      .then((p) => { if (!ac.signal.aborted) setPending(p); })
      .catch(() => { /* a missing route means nothing pending, never a failure */ });
    return () => ac.abort();
  }, [api, user, asked, resultsVersion]);

  const refresh = useCallback(() => {
    setSilenced(false);
    setAsked((n) => n + 1);
  }, []);

  const run = useCallback(async () => {
    if (!pending.scope) return;
    setRunning(true);
    try {
      const outcome = await runAgents(pending.scope);
      /* MARKED ONLY WHEN IT ACTUALLY FINISHED. The dashboard celebrates a
         readiness that moved; a run that failed or stopped for confirmation
         has not moved anything, and congratulating someone for it would be the
         product cheering at nothing. */
      if (outcome === 'done' && user) markRunFinished(user.id);
      setSilenced(true);
    } finally {
      setRunning(false);
    }
  }, [pending.scope, runAgents, user]);

  const defer = useCallback(() => {
    setSilenced(true);
    void api.deferUpdate();
  }, [api]);

  const value = useMemo(
    () => ({ pending, refresh, running, run, defer, silenced }),
    [pending, refresh, running, run, defer, silenced],
  );

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdate(): UpdateValue {
  const v = useContext(UpdateContext);
  if (!v) throw new Error('useUpdate must be used inside <UpdateProvider>');
  return v;
}

/** Whether there is something to offer right now, in one place. */
export function isOffered(pending: PendingUpdate, silenced: boolean): boolean {
  return !!pending.scope && !pending.deferred && !silenced;
}

export type { UpdateScope };

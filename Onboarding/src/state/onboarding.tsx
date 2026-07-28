/**
 * Onboarding flow state.
 *
 * Two load-bearing behaviours live here.
 *
 * 1. The analysis poll starts the moment the documents are submitted and keeps
 *    running while the user answers the direction questions. The wait is real —
 *    four agents run in sequence — so rather than parking them on a spinner we
 *    spend it collecting something useful. Failure must not be destructive:
 *    if the documents cannot be read, the answers already given survive.
 *
 * 2. Progress is saved to the account after every meaningful change. Nobody
 *    owes us one uninterrupted sitting: a phone dies, a tab closes, someone
 *    goes to find their certificate. Because the save goes through the API
 *    rather than to this browser, finishing on a laptop after starting on a
 *    phone works too. Saves are debounced so typing does not spam the endpoint.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  AnalysisJob, ConfirmedProfile, ItqanApi, OnboardingProgress, Preferences, UploadedDocument,
} from '../api';
import { emptyPreferences } from '../api';

export type Entry = 'document' | 'manual';
export type Step = OnboardingProgress['step'];

interface OnboardingValue {
  entry: Entry;
  documents: UploadedDocument[];
  jobId: string | null;
  analysis: AnalysisJob | null;
  settled: boolean;
  failed: boolean;
  preferences: Preferences;
  profile: ConfirmedProfile | null;

  /** Saved progress found on boot, offered rather than forced. */
  resumable: OnboardingProgress | null;
  /**
   * True until the saved-progress lookup has answered. Anything that decides
   * where the user belongs has to wait for it, or a reload races the fetch and
   * throws them off the step they were on. See RequireFlow in App.tsx.
   */
  checking: boolean;
  dismissResume: () => void;
  resume: () => void;

  begin: (documents: UploadedDocument[]) => Promise<void>;
  startManual: () => void;
  /** Merges one answer; the rest are left alone. */
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  completeProfile: (p: ConfirmedProfile) => void;
  reset: () => void;
}

const Ctx = createContext<OnboardingValue | null>(null);
const POLL_MS = 700;
const SAVE_DEBOUNCE_MS = 600;

export function OnboardingProvider({
  api, enabled, children,
}: {
  api: ItqanApi;
  /** Only load and save progress for a signed-in user still onboarding. */
  enabled: boolean;
  children: ReactNode;
}) {
  const [entry, setEntry] = useState<Entry>('document');
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisJob | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(emptyPreferences);
  const [profile, setProfile] = useState<ConfirmedProfile | null>(null);
  const [resumable, setResumable] = useState<OnboardingProgress | null>(null);
  /**
   * Which value of `enabled` the saved-progress lookup has answered for, or
   * null before it has run at all.
   *
   * A plain boolean is not enough. `enabled` is false for the first renders,
   * while the session is still being read, and flips to true in the same render
   * that first shows a guarded route — one render before the effect below can
   * react. A flag saying "checked" would still be set from the disabled pass and
   * the route would decide on stale information, which is the whole bug.
   * Comparing against the current `enabled` closes that window synchronously.
   */
  const [checkedFor, setCheckedFor] = useState<boolean | null>(null);
  const checking = checkedFor !== enabled;
  const timer = useRef<number | null>(null);
  const saveTimer = useRef<number | null>(null);
  const step = useRef<Step>('upload');

  /* ------------------------------------------------------------ resume -- */
  useEffect(() => {
    if (!enabled) { setResumable(null); setCheckedFor(false); return; }
    let alive = true;
    api.getProgress()
      .then((p) => {
        // Only worth offering if they actually got somewhere.
        const answered = p && Object.values(p.preferences ?? {}).some((v) => v !== null && v !== '');
        if (alive && p && (p.documents.length > 0 || answered)) {
          setResumable(p);
        }
      })
      .catch(() => {})
      // Settled either way. A failed lookup must not leave the flow waiting
      // forever; it just means there is nothing to offer.
      .finally(() => { if (alive) setCheckedFor(true); });
    return () => { alive = false; };
  }, [api, enabled]);

  const resume = useCallback(() => {
    const p = resumable;
    if (!p) return;
    setDocuments(p.documents);
    setPreferences(p.preferences ?? emptyPreferences());
    step.current = p.step;
    setResumable(null);
    // The job is not resumable across sessions, so the pipeline is re-run over
    // the documents that were already stored. Cheaper than making them re-upload.
    if (p.documents.length > 0) {
      setEntry('document');
      void api.startAnalysis(p.documents.map((d) => d.id)).then(({ jobId: id }) => setJobId(id));
    } else {
      // Answers but no documents is the manual route. Without this the entry
      // stays 'document' with nothing to analyse, the flow never counts as
      // started, and the resume offer reappears on every screen.
      setEntry('manual');
    }
  }, [resumable, api]);

  const dismissResume = useCallback(() => {
    setResumable(null);
    void api.clearProgress();
  }, [api]);

  /* -------------------------------------------------------------- save -- */
  /**
   * Two guards, both learned the hard way:
   *
   *  - Nothing is saved while a resume offer is on screen. The provider mounts
   *    with empty state, so an unguarded auto-save would immediately overwrite
   *    the very progress it just found and the "continue" button would restore
   *    nothing.
   *  - Empty state is never saved at all, so an untouched visit cannot leave a
   *    hollow record that later triggers a pointless resume prompt.
   */
  const persist = useCallback(() => {
    if (!enabled || resumable) return;
    const answered = Object.values(preferences).some((v) => v !== null && v !== '');
    const empty = documents.length === 0 && !answered;
    if (empty) return;

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void api.saveProgress({
        step: step.current,
        documents,
        preferences,
        documentId: documents[0]?.id ?? null,
        updatedAt: Date.now(),
      }).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  }, [api, enabled, resumable, documents, preferences]);

  useEffect(() => { persist(); }, [persist]);
  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  /* -------------------------------------------------------------- poll -- */
  const stopPolling = useCallback(() => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const job = await api.getAnalysis(jobId);
        if (cancelled) return;
        setAnalysis(job);
        if (job.stage !== 'done' && job.stage !== 'failed') {
          timer.current = window.setTimeout(tick, POLL_MS);
        }
      } catch {
        if (!cancelled) setAnalysis({ jobId, stage: 'failed', progress: 0, error: 'network' });
      }
    };
    void tick();
    return () => { cancelled = true; stopPolling(); };
  }, [jobId, api, stopPolling]);

  /* ------------------------------------------------------------ actions -- */
  const begin = useCallback(async (docs: UploadedDocument[]) => {
    setEntry('document');
    setDocuments(docs);
    setAnalysis(null);
    step.current = 'questions';
    const { jobId: id } = await api.startAnalysis(docs.map((d) => d.id));
    setJobId(id);
  }, [api]);

  const startManual = useCallback(() => {
    stopPolling();
    setEntry('manual');
    setDocuments([]);
    setJobId(null);
    setAnalysis(null);
    step.current = 'confirm';
  }, [stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setEntry('document');
    setDocuments([]);
    setJobId(null);
    setAnalysis(null);
    setPreferences(emptyPreferences());
    setProfile(null);
    step.current = 'upload';
    void api.clearProgress();
  }, [stopPolling, api]);

  const setPreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPreferences((cur) => ({ ...cur, [key]: value }));
    }, []);

  const settled = analysis?.stage === 'done' || analysis?.stage === 'failed';
  const failed = analysis?.stage === 'failed';

  const value = useMemo<OnboardingValue>(() => ({
    entry, documents, jobId, analysis,
    settled: entry === 'manual' ? true : !!settled,
    failed: !!failed,
    preferences, profile,
    resumable, checking, dismissResume, resume,
    begin, startManual, setPreference,
    completeProfile: setProfile, reset,
  }), [entry, documents, jobId, analysis, settled, failed, preferences, profile,
       resumable, checking, dismissResume, resume, begin, startManual, setPreference, reset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return ctx;
}

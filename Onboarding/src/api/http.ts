/**
 * The API surface, and the one place agent envelopes become UI types.
 *
 * Transport (auth, refresh, CSRF, timeouts, errors) lives in `client.ts`; the
 * agent JSON shapes live in `agents.ts`. This file is the seam between them.
 * Mapping happens HERE and only here, so a screen never learns an agent's field
 * name and a backend rename never reaches a component.
 *
 * Auth is deliberately incomplete, on purpose: the marketing site owns log in
 * and sign up. This app only READS the session (`/auth/session`) and ends it
 * (`/auth/logout`). There is no login() method and there must never be one — a
 * second sign-in surface is a second thing to keep in step and the first to
 * drift.
 */
import type {
  AnalysisJob, AnalysisResult, ConfirmedProfile, Course, DashboardData, ItqanApi,
  JobMatch, OnboardingProgress, Session, Skill, UploadedDocument,
} from './types';
import type { CandidateProfile, LocalizedText, PipelineResult } from './agents';
import { request, upload } from './client';
import { ANALYSIS_TIMEOUT_MS } from '../config/env';
import { takeHandoffToken } from '../lib/site';

/* --------------------------------------------------------------- mapping -- */

/** Current UI language. Set by the i18n provider; drives bilingual picking. */
let activeLocale: 'ar' | 'en' = 'ar';
export function setApiLocale(locale: 'ar' | 'en') { activeLocale = locale; }

/**
 * Picks a language out of a bilingual field. Falls back to English when the
 * Arabic is genuinely absent — better an English job title than the literal
 * string "null" on screen.
 */
export function pickText(t: LocalizedText | string | null | undefined): string {
  if (t == null) return '';
  if (typeof t === 'string') return t;
  return (activeLocale === 'ar' ? t.ar : t.en) || t.en || '';
}

/** 0..1 -> 0..100, preserving null. Never invents a number for "unknown". */
export const toPercent = (n: number | null | undefined): number | null =>
  n == null ? null : Math.round(n * 100);

/** Agent A's skills -> the confirm screen's editable list. */
function mapSkills(profile: CandidateProfile): Skill[] {
  return profile.skills.map((s, i) => ({
    id: s.esco_code ?? `${s.name}-${i}`,
    name: s.name,
    // Quality is Agent A's clamped evidence tier; it maps onto the UI's 0..1
    // confidence so the existing "Suggested — confirm" threshold keeps working
    // without every screen learning about tiers.
    confidence: s.quality === 'high' ? 0.95 : s.quality === 'medium' ? 0.8 : 0.5,
    fromCourse: s.from_course ?? undefined,
    origin: s.origin,
    quality: s.quality,
    evidenceQuote: s.evidence_quote,
  }));
}

function mapAnalysisResult(profile: CandidateProfile): AnalysisResult {
  const field = <T,>(f: { value: T; confidence: number; evidence_quote: string | null } | null) =>
    (f == null ? null : { value: f.value, confidence: f.confidence, evidence: f.evidence_quote ?? undefined });
  return {
    fullName: field(profile.full_name),
    birthDate: field(profile.birth_date),
    graduationDate: field(profile.graduation_date),
    skills: mapSkills(profile),
  };
}

/* ------------------------------------------------------------------ api -- */

export function createHttpApi(): ItqanApi {
  return {
    /**
     * Reads the session the site established. Null means "not signed in", which
     * is a normal answer here — so a 401 must NOT trigger the refresh/replay
     * dance, hence `retryOnAuthFailure: false`.
     *
     * On the first load after signing in, the URL carries a short-lived handoff
     * token; it is exchanged in this same request so there is no window where
     * the app is loaded but not yet authenticated.
     */
    async session(signal) {
      const handoff = takeHandoffToken();
      try {
        return await request<Session>(
          handoff ? `/auth/session?t=${encodeURIComponent(handoff)}` : '/auth/session',
          { signal, retryOnAuthFailure: false },
        );
      } catch {
        return null;
      }
    },

    async logout() {
      await request<void>('/auth/logout', { method: 'POST' }).catch(() => {});
    },

    saveProgress(p, signal) {
      return request<void>('/onboarding/progress', { method: 'PUT', body: p, signal });
    },
    getProgress(signal) {
      return request<OnboardingProgress | null>('/onboarding/progress', { signal }).catch(() => null);
    },
    async clearProgress() {
      await request<void>('/onboarding/progress', { method: 'DELETE' }).catch(() => {});
    },

    uploadDocument({ file, kind, onProgress }, signal) {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      return upload<UploadedDocument>('/documents', form, onProgress, signal);
    },

    /**
     * The synchronous pipeline. One request, held open while Agent A reads the
     * documents, Agent C computes the gap and Agent E picks the courses; it
     * resolves with everything at once.
     *
     * `progress` is null throughout by design — the server reports none, and
     * inventing one would put a fabricated number on the screen whose whole
     * argument is that Itqan does not fabricate.
     */
    async runAnalysis(documentIds, signal) {
      const res = await request<PipelineResult>('/analysis', {
        method: 'POST',
        body: { document_ids: documentIds, locale: activeLocale },
        timeoutMs: ANALYSIS_TIMEOUT_MS,
        signal,
      });
      return {
        jobId: res.run_id,
        stage: 'done',
        progress: null,
        result: mapAnalysisResult(res.candidate_profile),
      } satisfies AnalysisJob;
    },

    confirmProfile(profile: ConfirmedProfile, signal) {
      return request<{ ok: true }>('/profile', { method: 'POST', body: profile, signal });
    },

    /**
     * Assembled by the backend from Agent C's skill_gap and Agent E's
     * recommendations. `readiness` stays null when Agent C could not compute a
     * gap score; the UI says so rather than showing a zero.
     */
    getDashboard(signal) { return request<DashboardData>('/dashboard', { signal }); },
    getJobs(signal) { return request<JobMatch[]>('/jobs', { signal }); },
    getCourses(signal) { return request<Course[]>('/courses', { signal }); },
  };
}

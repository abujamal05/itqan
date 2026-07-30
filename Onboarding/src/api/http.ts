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
    async getDashboard(signal) {
      return localiseDashboard(await request<RawDashboard>('/dashboard', { signal }));
    },
    async getJobs(signal) {
      return (await request<RawJobMatch[]>('/jobs', { signal })).map(localiseJob);
    },
    async getCourses(signal) {
      return (await request<RawCourse[]>('/courses', { signal })).map(localiseCourse);
    },
  };
}

/* ------------------------------------------------------------ localising -- */

/**
 * The bilingual seam.
 *
 * The backend sends human-readable strings as `{en, ar}` (the agreed contract),
 * but every screen expects a plain string. Collapsing them here — once, at the
 * boundary — is what keeps `pickText` out of components. Miss this and React
 * renders the literal text "[object Object]" wherever a title should be, which
 * is exactly what happened before these mappers existed.
 *
 * `Localisable<T>` marks the fields that may arrive either way: the backend is
 * allowed to send a plain string (already picked) OR the pair, and both work.
 * That tolerance is deliberate — it lets the backend adopt bilingual payloads
 * field by field without breaking the app mid-migration.
 */
type Localisable<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | LocalizedText };

type RawJobMatch = Localisable<JobMatch, 'title' | 'arrangement' | 'why' | 'location'>;
type RawCourse = Localisable<Course, 'title'>;
type RawDashboard = Omit<DashboardData, 'readinessNote' | 'topMatches' | 'nextStep' | 'journey'> & {
  readinessNote: string | LocalizedText;
  topMatches: RawJobMatch[];
  nextStep: { title: string | LocalizedText; body: string | LocalizedText; action: DashboardData['nextStep']['action'] };
  journey: Array<Omit<DashboardData['journey'][number], 'label' | 'detail'>
    & { label: string | LocalizedText; detail?: string | LocalizedText }>;
};

const localiseJob = (j: RawJobMatch): JobMatch => ({
  ...j,
  title: pickText(j.title),
  arrangement: pickText(j.arrangement),
  location: pickText(j.location),
  why: pickText(j.why),
});

const localiseCourse = (c: RawCourse): Course => ({ ...c, title: pickText(c.title) });

const localiseDashboard = (d: RawDashboard): DashboardData => ({
  ...d,
  readinessNote: pickText(d.readinessNote),
  topMatches: d.topMatches.map(localiseJob),
  nextStep: {
    action: d.nextStep.action,
    title: pickText(d.nextStep.title),
    body: pickText(d.nextStep.body),
  },
  journey: d.journey.map((s) => ({
    ...s,
    label: pickText(s.label),
    detail: s.detail == null ? undefined : pickText(s.detail),
  })),
});

/**
 * API CONTRACT — the seam between this UI and the agent services.
 *
 * The agents are API-based: this app never runs inference, never holds a model,
 * and never does its own matching. It POSTs a document, awaits ONE synchronous
 * analysis call that runs A -> C -> E, and GETs already-ranked results.
 * Swapping or re-hosting an agent changes nothing here as long as these shapes
 * hold. The agent-side envelopes live in ./agents.ts; see BACKEND_INTEGRATION.md.
 *
 * Trust rules baked into the types (itqan-brand §8), not left to the UI to
 * remember:
 *   - every extracted field carries its own `confidence`, because four
 *     sequential agents compound error and a clean-looking answer downstream
 *     would hide it;
 *   - every recommendation carries `why` (the evidence chain) and a real
 *     `source`, because nothing fabricated is displayable.
 */

import type { SkillOrigin, EvidenceQuality, MatchStatus } from './agents';

/**
 * Re-exported one by one, NOT with `export *`.
 *
 * A star re-export would collide: this file's `Confidence` is a bare 0..1
 * number used all over the UI, while agents.ts has an `interface Confidence`
 * (Agent A's `{overall, by_field}` envelope). Under `export *` the local one
 * silently wins and any import of the agent envelope resolves to `number`
 * instead — a type error that only shows up wherever someone reads
 * `.overall`. Agent envelopes are imported from './agents' directly.
 */
export type { SkillOrigin, EvidenceQuality, MatchStatus };
export type {
  LocalizedText, CandidateProfile, SkillGap, CourseRecommendations,
  PipelineResult, AgentId, MissingSkillDetail, RequirementMatch,
} from './agents';

/** Confidence threshold above which output may be stated as fact. */
export const TRUST_THRESHOLD = 0.85;

export type Confidence = number; // 0..1

/** A value the agent extracted, always travelling with its own certainty. */
export interface Extracted<T> {
  value: T;
  confidence: Confidence;
  /** Where in the document this came from, shown to the user as provenance. */
  evidence?: string;
}

export interface Skill {
  id: string;
  name: string;
  confidence: Confidence;
  /** The transcript course this skill was translated from. */
  fromCourse?: string;
  /**
   * How Agent A came by this skill. Load-bearing, not decoration: a
   * `claim_only` skill is an unverified assertion and must never be presented
   * with the same force as a project-proven one.
   */
  origin?: SkillOrigin;
  /** Agent A's clamped evidence tier. */
  quality?: EvidenceQuality;
  /** A verified verbatim quote from the document, or null. Never paraphrased. */
  evidenceQuote?: string | null;
}

/* ------------------------------------------------------------ DOCUMENTS -- */

/**
 * What kind of document this is. The transcript is the only one the pipeline
 * strictly needs; the rest add evidence and widen what can be matched.
 * Keeping the kind explicit lets the reader agent pick the right extractor
 * instead of inferring it from content, and lets the UI say plainly which
 * evidence is still missing rather than silently under-reading.
 */
export type DocumentKind =
  | 'transcript'
  | 'cv'
  | 'certificate'
  | 'certification'
  | 'recommendation'
  | 'other';

/**
 * The one kind the pipeline cannot run without.
 *
 * This is the CV, not the transcript: Agent A's input contract is "CV required,
 * transcript optional", and the transcript's job is corroboration —
 * `research_curriculum` uses it to raise a rating, and `derive_coursework_skills`
 * promotes skills from passed courses. Neither can run without a CV to enrich.
 */
export const REQUIRED_KIND: DocumentKind = 'cv';

export const DOCUMENT_KINDS: DocumentKind[] = [
  'transcript', 'cv', 'certificate', 'certification', 'recommendation', 'other',
];

export interface UploadedDocument {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: DocumentKind;
  /** Where the bytes live once stored. */
  url?: string;
}

/** Everything the reader agent pulled out of the uploaded document. */
export interface AnalysisResult {
  fullName: Extracted<string> | null;
  birthDate: Extracted<string> | null;      // ISO yyyy-mm-dd
  graduationDate: Extracted<string> | null; // ISO yyyy-mm
  skills: Skill[];
}

export type AnalysisStage = 'queued' | 'reading' | 'translating' | 'matching' | 'done' | 'failed';

export interface AnalysisJob {
  jobId: string;
  stage: AnalysisStage;
  /**
   * 0..1 when the server can report it, NULL when it cannot.
   *
   * With the synchronous backend it is null for the whole wait and the meter
   * renders indeterminate. Driving a bar from elapsed time instead would be a
   * fabricated number on a screen whose entire argument is that Itqan does not
   * fabricate — so the UI admits it does not know. If the backend later moves
   * to job+polling, filling this in restores the determinate meter with no
   * other change.
   */
  progress: number | null;
  result?: AnalysisResult;
  error?: string;
}

/**
 * What the user told us about the work they want, asked one question at a time
 * during the pipeline wait.
 *
 * Structured rather than free tags: every field here is something the matching
 * agent can filter or rank on directly. `preferredRole` is the one open field,
 * because a job title is a thing people already have words for and a fixed list
 * would be wrong for most of them.
 *
 * Every field is nullable. The questions only re-rank results, so refusing to
 * answer must never block anyone from their own transcript.
 */
export interface Preferences {
  /** 'free' = free courses only. 'any' = free and paid both fine. */
  coursePricing: 'free' | 'any' | null;
  workArrangement: 'remote' | 'hybrid' | 'onsite' | null;
  /** Free text, in the user's own words. May be empty. */
  preferredRole: string;
  /** Whether to surface adjacent roles they did not name. */
  openToOtherRoles: 'yes' | 'no' | null;
}

export const emptyPreferences = (): Preferences => ({
  coursePricing: null,
  workArrangement: null,
  preferredRole: '',
  openToOtherRoles: null,
});

/** What the user confirmed. This, not the raw extraction, drives everything. */
export interface ConfirmedProfile {
  fullName: string;
  birthDate: string | null;
  graduationDate: string | null;
  skills: string[];
  preferences: Preferences;
  documentId: string | null;
}

/** Provenance attached to anything recommended. Never optional in practice. */
export interface Source {
  name: string;
  url: string;
  retrievedAt: string; // ISO date
}

export interface JobMatch {
  id: string;
  title: string;
  employer: string;
  location: string;
  /** e.g. "Full time", "Remote", already localised by the service. */
  arrangement: string;
  score: Confidence;
  /** The transcript -> skill -> requirement chain, in the user's language. */
  why: string;
  matchedSkills: string[];
  source: Source;
}

export interface Course {
  id: string;
  title: string;
  provider: string;
  hours: number;
  /**
   * Cost in `currency`, or 0 for free. Kept as a number rather than a
   * pre-formatted string so the UI can format it in the user's locale and
   * filter on it; a service that returns "OMR 25" makes both impossible.
   */
  price: number;
  currency: string;
  /** Skills this course unlocks — ties every course to a real gap. */
  unlocks: string[];
  /**
   * Gaps this course also closes beyond the ones it was selected for. Agent E's
   * set-cover recommends a course once and lists the rest here, so the UI shows
   * the full value instead of repeating the card per skill.
   */
  coversOtherSkills?: string[];
  recommended: boolean;
  source: Source;
}

export interface SkillStanding {
  name: string;
  /** 0..1 how well evidenced this is by the documents. */
  level: number;
  held: boolean;
  /**
   * Agent C's verdict. `possible_match` is published uncertainty, not a
   * rounding error — it must render as its own state and never be collapsed
   * into held/missing, which would resolve the doubt in one direction silently.
   */
  status?: MatchStatus;
}

/**
 * One stage of the user's journey through the product.
 *
 * The service decides both the labels and which stage is current, because the
 * truth lives with the pipeline, not the browser: a stage is "done" when the
 * work actually finished, not when a screen was visited.
 */
export interface JourneyStage {
  id: string;
  /** Already localised by the service. */
  label: string;
  state: 'done' | 'current' | 'upcoming';
  /** e.g. a completion date, or what happens next. Optional. */
  detail?: string;
}

export interface DashboardData {
  /**
   * 0..100, derived from Agent C's gap_score — or NULL when there was nothing
   * to compute it from (no parsable requirements, or everything landed
   * unresolved). Null must render as "not enough to judge yet", never as 0:
   * a fabricated zero reads as a perfect gap and is the exact failure the
   * architecture doc calls out.
   */
  readiness: number | null;
  /** [lower, upper] band expressing the uncertainty `possible_match` carries. */
  readinessRange?: [number, number] | null;
  readinessNote: string;      // plain-language explanation, authored by the agent
  strengths: string[];        // capability first — always shown before gaps
  standings: SkillStanding[];
  topMatches: JobMatch[];
  gaps: string[];
  nextStep: { title: string; body: string; action: 'courses' | 'jobs' | 'documents' };
  /** Where the user is in the overall process, oldest stage first. */
  journey: JourneyStage[];
}

/* ----------------------------------------------------------------- AUTH -- */

export interface User {
  id: string;
  fullName: string;
  email: string;
  /** Server-owned: whether this account has finished onboarding. It lives with
   *  the account, not the browser, so finishing on a phone and returning on a
   *  laptop does not restart the flow. */
  onboarded: boolean;
}

/**
 * The session, as established by the marketing site's own log in / sign up
 * forms. `locale` is whichever language the user was using on the site, so the
 * app opens in the same one rather than making them choose twice.
 */
export interface Session {
  token: string;
  user: User;
  locale: 'ar' | 'en';
}

/** Onboarding progress, stored against the account so it survives a device change. */
export interface OnboardingProgress {
  step: 'upload' | 'questions' | 'confirm';
  documents: UploadedDocument[];
  preferences: Preferences;
  documentId: string | null;
  updatedAt: number;
}

/** The whole surface the UI depends on. Implemented by http.ts and mock.ts. */
export interface ItqanApi {
  /**
   * Reads the session the SITE established. This app never creates one: log in
   * and sign up live on the marketing site and must not be duplicated here.
   */
  session(signal?: AbortSignal): Promise<Session | null>;
  logout(): Promise<void>;

  saveProgress(p: OnboardingProgress, signal?: AbortSignal): Promise<void>;
  getProgress(signal?: AbortSignal): Promise<OnboardingProgress | null>;
  clearProgress(): Promise<void>;

  /**
   * Uploads one document. `onProgress` reports 0..1 so the UI can show real
   * movement instead of an indeterminate spinner — on a phone connection a
   * transcript scan is not instant, and a stalled bar is the difference
   * between "still working" and "broken".
   */
  uploadDocument(
    input: { file: File; kind: DocumentKind; onProgress?: (fraction: number) => void },
    signal?: AbortSignal,
  ): Promise<UploadedDocument>;

  /**
   * Runs the whole A -> C -> E pipeline over the uploaded set and resolves with
   * the finished result. ONE request, held open for the duration — the backend
   * is synchronous by decision, so there is no job id and nothing to poll.
   *
   * Consequences the callers must handle, and the reason this is documented
   * here rather than discovered: there is no server-reported progress, so the
   * wait is indeterminate; and the request is long enough that every gateway
   * timeout in front of FastAPI matters (see ANALYSIS_TIMEOUT_MS). A timeout
   * arrives as an ApiError of kind 'timeout', which is retryable.
   */
  runAnalysis(documentIds: string[], signal?: AbortSignal): Promise<AnalysisJob>;
  confirmProfile(profile: ConfirmedProfile, signal?: AbortSignal): Promise<{ ok: true }>;
  getDashboard(signal?: AbortSignal): Promise<DashboardData>;
  getJobs(signal?: AbortSignal): Promise<JobMatch[]>;
  getCourses(signal?: AbortSignal): Promise<Course[]>;
}

export const isStrong = (c: Confidence) => c >= TRUST_THRESHOLD;

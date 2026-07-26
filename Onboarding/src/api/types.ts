/**
 * API CONTRACT — the seam between this UI and the agent services.
 *
 * The agents are API-based: this app never runs inference, never holds a model,
 * and never does its own matching. It POSTs a document, polls an analysis job,
 * and GETs already-ranked results. Swapping or re-hosting an agent changes
 * nothing here as long as these shapes hold.
 *
 * Trust rules baked into the types (itqan-brand §8), not left to the UI to
 * remember:
 *   - every extracted field carries its own `confidence`, because four
 *     sequential agents compound error and a clean-looking answer downstream
 *     would hide it;
 *   - every recommendation carries `why` (the evidence chain) and a real
 *     `source`, because nothing fabricated is displayable.
 */

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

/** The one kind the pipeline cannot run without. */
export const REQUIRED_KIND: DocumentKind = 'transcript';

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
  /** 0..1, for a determinate meter. Users tolerate a wait they can see. */
  progress: number;
  result?: AnalysisResult;
  error?: string;
}

/** What the user confirmed. This, not the raw extraction, drives everything. */
export interface ConfirmedProfile {
  fullName: string;
  birthDate: string | null;
  graduationDate: string | null;
  skills: string[];
  interests: string[];
  notes: string;
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
  recommended: boolean;
  source: Source;
}

export interface SkillStanding {
  name: string;
  /** 0..1 how well evidenced this is by the transcript. */
  level: number;
  held: boolean;
}

export interface DashboardData {
  readiness: number;          // 0..100, agent-computed
  readinessNote: string;      // plain-language explanation, authored by the agent
  strengths: string[];        // capability first — always shown before gaps
  standings: SkillStanding[];
  topMatches: JobMatch[];
  gaps: string[];
  nextStep: { title: string; body: string; action: 'courses' | 'jobs' | 'documents' };
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
  interests: string[];
  notes: string;
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

  /** Starts the pipeline over the whole set. Returns the job to poll. */
  startAnalysis(documentIds: string[], signal?: AbortSignal): Promise<{ jobId: string }>;
  getAnalysis(jobId: string, signal?: AbortSignal): Promise<AnalysisJob>;
  confirmProfile(profile: ConfirmedProfile, signal?: AbortSignal): Promise<{ ok: true }>;
  getDashboard(signal?: AbortSignal): Promise<DashboardData>;
  getJobs(signal?: AbortSignal): Promise<JobMatch[]>;
  getCourses(signal?: AbortSignal): Promise<Course[]>;
}

export const isStrong = (c: Confidence) => c >= TRUST_THRESHOLD;

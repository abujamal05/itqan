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
 * What kind of document this is. The CV is the only one the pipeline strictly
 * needs; the transcript and the rest add evidence and widen what can be matched.
 * Keeping the kind explicit lets the reader agent pick the right extractor
 * instead of inferring it from content, and lets the UI say plainly which
 * evidence is still missing rather than silently under-reading.
 */
export type DocumentKind =
  | 'cv'
  | 'transcript';

/**
 * The one kind the pipeline cannot run without.
 *
 * This is `cv`, not `transcript`, because the pipeline is the authority: Agent A
 * requires `--cv` and treats `--transcript` as optional, and an unreadable CV is
 * the only fatal case in its graph. This constant previously said `transcript`,
 * which let a user satisfy the gate with no CV at all — the one document the
 * extraction cannot proceed without.
 */
export const REQUIRED_KIND: DocumentKind = 'cv';

/**
 * The only two kinds offered, required first.
 *
 * Narrowed from six. The extra kinds (certificate, certification,
 * recommendation, other) were choices the pipeline could not act on: Agent A
 * takes a CV and an optional transcript and nothing else, so every other option
 * was a decision asked of the user that changed no outcome — and one of them,
 * 'other', was the silent default that let a file sit in the list satisfying
 * nothing while looking accepted.
 */
export const DOCUMENT_KINDS: DocumentKind[] = ['cv', 'transcript'];

/**
 * Coerces any kind that is not one of the two into the SUPPORTING one.
 *
 * Two sources can still hand us a retired value: onboarding progress saved
 * before this change, and a backend row created then. Mapping them to
 * 'transcript' rather than 'cv' is deliberate — an old 'certificate' must not
 * silently satisfy the CV requirement, which is the one gate the pipeline
 * cannot run without.
 */
export const normaliseKind = (kind: string): DocumentKind =>
  (kind === 'cv' ? 'cv' : 'transcript');

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

/**
 * `awaiting_confirmation` is the pause, and it is different in kind from the
 * others: every other stage advances when work finishes, this one advances when
 * the USER acts. Agent A has read the documents and its extraction is attached;
 * Agent C does not start until the details are confirmed, so the answers given
 * during the wait are inputs to the matching rather than a record of it.
 */
export type AnalysisStage =
  | 'queued' | 'reading' | 'translating'
  | 'awaiting_confirmation'
  | 'matching' | 'done' | 'failed';

export interface AnalysisJob {
  jobId: string;
  stage: AnalysisStage;
  /** 0..1, for a determinate meter. Users tolerate a wait they can see. */
  progress: number;
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
  /**
   * OPTIONAL, and never asked for during onboarding.
   *
   * Nothing in the pipeline reads it: matching runs on skills and preferences,
   * and an employer is not contacted by this product. It exists only so someone
   * who wants their own record complete can complete it, which is why it is
   * nullable, never validated beyond being a string, and never counted as
   * "missing" on the profile screen. Asking a graduate for a phone number
   * before showing them anything would be the most familiar dark pattern in
   * recruitment, and this product does not have a reason to.
   */
  phone: string | null;
  skills: string[];
  preferences: Preferences;
  documentId: string | null;
}

/**
 * A role the agents think fits, as opposed to `preferences.preferredRole`,
 * which is the one the user named.
 *
 * Carries its evidence for the same reason every other recommendation does:
 * this is the product telling someone what it thinks they could be, which is
 * the single most consequential sentence it will say to them. A bare job title
 * with no reasoning behind it is exactly the unfounded claim the trust rules
 * exist to prevent.
 */
export interface SuggestedRole {
  title: string;
  confidence: Confidence;
  /** The transcript -> skill -> role chain, in the user's language. */
  why: string;
}

/**
 * Confirming the profile is what STARTS the matching, so the response carries the
 * job to keep watching. Absent when there was no paused run to start — the manual
 * route, where the user typed their details instead of uploading anything.
 */
export interface ConfirmProfileResult {
  ok: true;
  jobId?: string;
}

/**
 * The stored profile, as the profile screen reads it back.
 *
 * `ConfirmedProfile` is what the user SENDS at the end of onboarding; this is
 * what comes back afterwards, and the two differ deliberately. The documents
 * are included because the profile screen has to show what the answers were
 * derived from, and `email` comes from the ACCOUNT rather than the extraction:
 * it is the one field on the screen the pipeline must never be able to rewrite.
 */
export interface StoredProfile extends ConfirmedProfile {
  email: string;
  documents: UploadedDocument[];
  /**
   * Where the profile picture lives, or null when none was set. Server owned:
   * it is written by uploadAvatar/removeAvatar, never by updateProfile, so a
   * profile save can never blank someone's picture as a side effect.
   */
  avatarUrl: string | null;
  /**
   * READ ONLY. The agents' suggestion, not the user's choice — the user's
   * choice is `preferences.preferredRole` and the two are shown side by side
   * on purpose. Null until a run has produced one.
   */
  suggestedRole: SuggestedRole | null;
  /** When the profile was last confirmed. Null if it never has been. */
  updatedAt: number | null;
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
   * Cost in `currency`, 0 for free, or **null when the provider publishes no
   * price at all**. Kept as a number rather than a pre-formatted string so the
   * UI can format it in the user's locale and filter on it; a service that
   * returns "OMR 25" makes both impossible.
   *
   * Null is the COMMON case, not an edge case: 2,001 of 2,099 courses come from
   * Coursera, which publishes none. Typing this as `number` is what produced a
   * card reading `null 0` — `formatMoney(null, null)` throws on the currency and
   * falls back to string interpolation. Had the currency been valid it would
   * have rendered `OMR 0.000`, indistinguishable from genuinely free.
   */
  price: number | null;
  currency: string | null;
  /**
   * What can honestly be SAID about the price when there is no number.
   *
   * A claim about the PLATFORM's catalogue, not a measurement of this course:
   * Coursera sells its courses, so `paid`; freeCodeCamp gives them away, so
   * `free`. Null for a platform we have no basis to characterise — which must
   * read as "not listed", never as a guess in either direction.
   */
  priceLabel: 'free' | 'paid' | null;
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
  readiness: number;          // 0..100, agent-computed
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

/* -------------------------------------------------------------- chat -- */

/**
 * Hud's chat surface. PENDING BACKEND — see BACKEND.md §1.4.
 *
 * The shape encodes the whole argument of that screen, so read this before
 * implementing the service. Hud does not answer a question; he opens a
 * JUNCTION. Every turn returns one junction carrying his short orientation
 * plus the two or three real directions available from where the user stands,
 * and the user walks one of them. Directions not taken are never discarded.
 *
 * Which is why there is no `message` type here and no array of them. A chat
 * log would let a service return prose with a recommendation buried in it, and
 * prose cannot carry an evidence chain a skeptic can check.
 */
export type ForkKind = 'role' | 'course' | 'job' | 'skill' | 'topic';

/**
 * One direction out of a junction, and the only actionable object on the
 * screen.
 *
 * The trust rules live HERE rather than in Hud's `read`, and that split is
 * deliberate: it is what lets the mascot stand on a surface the brand
 * otherwise fences him out of. Anything a user might act on carries its own
 * evidence and its own source, so the claim is auditable whoever delivered it.
 */
export interface ChatFork {
  id: string;
  kind: ForkKind;
  /** The direction itself, phrased as somewhere to go. Already localised. */
  label: string;
  /** The distance: what is already held, and what this would unlock. */
  detail: string;
  /**
   * The evidence chain, in the product's fixed wording: "why this match".
   * REQUIRED for `role`, `course` and `job` — a direction that would have a
   * user apply, enrol or aim somewhere without saying why is exactly the
   * unfounded claim the whole product exists to refuse. Optional only for
   * `topic` and `skill`, which lead to another junction rather than an action.
   */
  why?: string;
  confidence?: Confidence;
  /** Required wherever `why` is. Carries its own retrieval date. */
  source?: Source;
  /**
   * When a fork resolves to something the app already renders, the service
   * sends the whole object and the screen reuses `MatchCard` / `CourseCard`
   * untouched. That is not a convenience: those components already enforce
   * `why`, the source and the confidence badge, so reusing them means the
   * trust rules cannot drift on this screen independently of the others.
   */
  job?: JobMatch;
  course?: Course;
}

/** One node on the spine: what was asked, how Hud read it, where it leads. */
export interface ChatJunction {
  id: string;
  /** What the user asked. Null for junction zero, which opens the thread. */
  question: string | null;
  /**
   * Hud's orientation, one or two sentences, already localised.
   *
   * NEVER a verdict, a score, a match or a percentage. He names what he is
   * looking at and what the options are; the options carry their own claims.
   * A service that puts "you are a 94% match for X" in here has moved a claim
   * out of the structure that makes it checkable.
   */
  read: string;
  forks: ChatFork[];
  /** Set once the user walks one. The others stay on the junction, re-enterable. */
  takenForkId: string | null;
  parentId: string | null;
  createdAt: number;
}

export interface ChatThread {
  id: string;
  title: string;
  junctions: ChatJunction[];
  updatedAt: number;
}

export type ChatThreadSummary = Pick<ChatThread, 'id' | 'title' | 'updatedAt'>;

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
  confirmProfile(profile: ConfirmedProfile, signal?: AbortSignal): Promise<ConfirmProfileResult>;
  /** Reads the stored profile back. Null when nothing has been confirmed yet. */
  getProfile(signal?: AbortSignal): Promise<StoredProfile | null>;
  /** Saves edits made from the profile screen, outside the onboarding flow. */
  updateProfile(profile: ConfirmedProfile, signal?: AbortSignal): Promise<{ ok: true }>;

  /**
   * PENDING BACKEND — `POST /api/profile/avatar`, multipart, field `file`.
   * Responds `{ "avatarUrl": "<absolute or same-origin URL>" }`.
   *
   * Its own endpoint rather than a field on updateProfile because an image is
   * bytes, not JSON, and because the two have different failure modes: a
   * rejected picture must not also discard the graduation date typed beside it.
   * Returns the URL rather than taking one, so the server owns storage and the
   * client never guesses a path.
   *
   * `onProgress` for the same reason uploadDocument has it — this is a request
   * where the user watches something happen.
   *
   * The server should enforce the real limits (type and size); the UI checks
   * them too, but a client-side check is a courtesy, never a control.
   */
  uploadAvatar(
    input: { file: File; onProgress?: (fraction: number) => void },
    signal?: AbortSignal,
  ): Promise<{ avatarUrl: string }>;

  /**
   * PENDING BACKEND — `DELETE /api/profile/avatar`. 204 on success.
   * Separate from uploading an empty file, which is not a way to say "remove".
   */
  removeAvatar(signal?: AbortSignal): Promise<void>;
  getDashboard(signal?: AbortSignal): Promise<DashboardData>;
  getJobs(signal?: AbortSignal): Promise<JobMatch[]>;
  getCourses(signal?: AbortSignal): Promise<Course[]>;

  /**
   * PENDING BACKEND — Hud's chat. See BACKEND.md §1.4 for the full contract.
   *
   * Deliberately request/response rather than a token stream. Nothing in this
   * codebase reads a stream today (`req<T>` ends in `res.json()`), and a
   * junction is not usefully partial: half of a fork is a recommendation
   * missing its evidence. When streaming does arrive it belongs INSIDE `ask`,
   * which can start emitting `read` early and still resolve to the same
   * junction, so none of these signatures have to change.
   */
  listThreads(signal?: AbortSignal): Promise<ChatThreadSummary[]>;
  /** A thread with no junctions is a normal answer, not an error. */
  getThread(id: string, signal?: AbortSignal): Promise<ChatThread>;
  /** `threadId: null` opens a new thread and returns the id it was given. */
  ask(
    input: { threadId: string | null; question: string },
    signal?: AbortSignal,
  ): Promise<{ threadId: string; junction: ChatJunction }>;
  /**
   * Walks a direction. Returns the junction it leads to.
   *
   * `threadId: null` for the same reason `ask` allows it: the opening junction
   * is authored on the client so the screen renders instantly with no network
   * call, which means the very first thing a user does can be walking one of
   * its forks, before any thread exists.
   */
  takeFork(
    input: { threadId: string | null; junctionId: string | null; forkId: string },
    signal?: AbortSignal,
  ): Promise<{ threadId: string; junction: ChatJunction }>;
}

export const isStrong = (c: Confidence) => c >= TRUST_THRESHOLD;

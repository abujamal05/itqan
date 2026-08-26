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

/**
 * Where a skill on the confirm screen came from, which decides whether
 * `confidence` means anything.
 *
 * `extracted` — read from the documents on THIS run, and scored.
 * `confirmed` — already on the person's profile and not found again by a
 *   re-read. Carried over rather than dropped, because a second CV is an
 *   addition to what we know and not a replacement for it.
 */
export type SkillOrigin = 'extracted' | 'confirmed';

export interface Skill {
  id: string;
  name: string;
  /**
   * NULL for a carried-over skill, and deliberately not 1.0.
   *
   * The stored profile keeps names and no scores, so nothing measured this
   * skill on this run. A fabricated number would read as certainty the system
   * does not have — the same bug class as a `0` price rendering as "free".
   * `origin: 'confirmed'` carries the real justification instead: the person
   * approved it, which the interface treats as settled without inventing a
   * measurement.
   */
  confidence: Confidence | null;
  origin?: SkillOrigin;
  /** The transcript course this skill was translated from. */
  fromCourse?: string;
}

/**
 * What a re-read changed, so somebody is not asked to re-approve a profile they
 * have already approved. Present only on a `merge` run.
 *
 * `previouslyRemoved` is separate from `addedSkills` on purpose: those are
 * skills a past run extracted and the person chose not to keep. They are
 * OFFERED again, unticked, never silently restored — re-adding a deliberate
 * deletion behind someone's back is what the confirm step exists to prevent.
 */
export interface ProfileDelta {
  addedSkills: Skill[];
  changedSkills: (Skill & { previousConfidence: Confidence })[];
  previouslyRemoved: Skill[];
  /** A count, not a list — "and 24 others unchanged". */
  unchangedCount: number;
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
  /**
   * What could not be read, as ids the interface translates (`notice.*`).
   *
   * A transcript that fails to extract is optional-by-design: the run finishes
   * on the CV rather than losing everything. Until this existed it finished
   * SILENTLY, so "your transcript could not be read" and "you did not upload a
   * transcript" looked identical from the outside — which is why people saw one
   * of their two documents apparently ignored and had nothing to act on.
   *
   * Ids, never sentences: the backend's warnings carry exception text, and prose
   * on the wire cannot be translated.
   */
  notices: string[];
  fullName: Extracted<string> | null;
  birthDate: Extracted<string> | null;      // ISO yyyy-mm-dd
  graduationDate: Extracted<string> | null; // ISO yyyy-mm
  /**
   * On a `replace` run: what the documents said, and nothing else.
   *
   * On a `merge` run: the UNION of that with the skills already on the profile,
   * so re-uploading a CV adds to what is known instead of overwriting it. The
   * confirm screen seeds its draft from this list, which is why the union is
   * published here rather than left for the client to assemble.
   */
  skills: Skill[];
  /** Only on a `merge` run — what actually changed. */
  delta?: ProfileDelta;
}

/**
 * How a run treats the profile that already exists.
 *
 * `replace` — the default, and first-time onboarding: there is nothing to merge
 *   with, and the extraction stands alone.
 * `merge` — a re-upload. Keeps what was already approved, adds what is new.
 */
export type AnalysisMode = 'replace' | 'merge';

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
 * answer must never block anyone from their own documents.
 */
export interface Preferences {
  /** 'free' = free courses only. 'any' = free and paid both fine. */
  coursePricing: 'free' | 'any' | null;
  workArrangement: 'remote' | 'hybrid' | 'onsite' | null;
  /**
   * Whether the user knows what they are aiming for at all, asked before we ask
   * WHICH role. Kept as its own field rather than inferred from an empty
   * `preferredRole`, because the two are genuinely different people: someone who
   * skipped the question, and someone who stopped to say they do not know yet.
   * The second is the person this product exists for, and the flow branches on
   * it — 'no' ends the questions and hands them to Hud.
   */
  knowsRole: 'yes' | 'no' | null;
  /** Free text, in the user's own words. May be empty. */
  preferredRole: string;
  /** Whether to surface adjacent roles they did not name. */
  openToOtherRoles: 'yes' | 'no' | null;
}

export const emptyPreferences = (): Preferences => ({
  coursePricing: null,
  workArrangement: null,
  knowsRole: null,
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
  /** The documents -> skill -> role chain, in the user's language. */
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
  /** The documents -> skill -> requirement chain, in the user's language. */
  why: string;
  matchedSkills: string[];
  source: Source;
}

export interface Course {
  id: string;
  title: string;
  provider: string;
  /**
   * How long the provider says it takes, as a RANGE — because that is what they
   * actually state. "4 weeks of study, 2-4 hours a week" is 8 to 16 hours, and
   * reporting 12 would be a figure nobody published. Equal ends mean the
   * provider stated ONE figure, not that a range was averaged.
   *
   * **Null is the common case and must render as SILENCE.** This replaced a
   * single `hours: number` that the API had always sent as null — with a comment
   * in `api/mapping.py` reading "not 0, which would render as '0 hours'" — and
   * the card rendered exactly that, because this type asserted a number was
   * always there. The identical mistake to the `null 0` price bug below, one
   * field up.
   */
  hoursMin: number | null;
  hoursMax: number | null;
  /** The provider's own words, so a range can be checked against what it came
   *  from and an unparseable-but-present duration is still worth showing. */
  durationText: string | null;
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

/**
 * One AI allowance and how much of it is gone.
 *
 * ONE COUNTER NOW, not two. Rescans and messages used to be separate things on
 * separate clocks; they are one daily pool of tokens spent at published prices,
 * so a single used/limit pair is exactly what the product sells.
 */
export interface UsageCounter {
  used: number;
  /** Null means unlimited, and the UI renders no meter for it. */
  limit: number | null;
  period: 'day' | 'week';
  /** ISO. WHEN it goes back to zero, not how long until — a duration would
   *  make the browser do calendar arithmetic in an unknown timezone. */
  resetsAt: string;
}

/**
 * What each action costs out of the daily pool.
 *
 * PUBLISHED DELIBERATELY, and the reason the bar is worth drawing at all. The
 * meter says how much is left; these say what things cost. Together they make
 * "spend it however you like" something a person can act on — a budget with no
 * price list is a number that drains for reasons nobody can predict.
 */
export interface TokenPrices {
  message: number;
  documentReread: number;
}

/**
 * What this person has used of their AI allowance.
 *
 * Server-owned, and the server enforces it too: the chat and re-read routes
 * refuse with `429 token_limit` once the pool is spent. This is for showing,
 * not gating.
 *
 * `rescans` and `messages` are OPTIONAL because they are on their way out. The
 * server still sends them, reporting the same pool under their old names so
 * nothing vanished the day the token budget deployed — and they come off the
 * wire one release after this ships, never the same day. `tokens` is optional
 * for the mirror-image reason: this app deploys from its own job, so a build
 * can reach a box whose API predates the budget, and a required field would
 * render that as "NaN of 0". See `UsageMeters`, which falls back rather than
 * inventing a number.
 */
export interface Usage {
  plan: 'free' | 'paid';
  tokens?: UsageCounter;
  prices?: TokenPrices;
  /** @deprecated An alias of `tokens`. Reports the same pool; leaving the wire. */
  rescans?: UsageCounter;
  /** @deprecated An alias of `tokens`. Reports the same pool; leaving the wire. */
  messages?: UsageCounter;
}

/**
 * The job list, and how much of it this account is allowed to see.
 *
 * WHY THIS IS NOT A BARE ARRAY ANY MORE. A free account sees its three
 * strongest matches; the rest are paid. That cut is made by the SERVER and the
 * locked matches are never sent — the only gate that survives an extension or
 * a devtools session is one where the data does not arrive. `locked` is a
 * COUNT, never content: it says how many more exist so the UI can be honest
 * about the size of what is behind the wall, and says nothing about what they
 * are. See BACKEND.md §5.
 */
export interface JobsResult {
  /** Free: at most three, strongest first. Paid: all of them. */
  matches: JobMatch[];
  /** How many more exist that this account cannot see. Zero on paid. */
  locked: number;
  plan: 'free' | 'paid';
}

export interface SkillStanding {
  name: string;
  /** 0..1 how well evidenced this is by the documents. */
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
  /** Has this address been proved with the code emailed at signup?
   *
   *  The app only READS this, to send someone to the site's verification page
   *  rather than leaving them in a flow that cannot progress. It is not the
   *  control: the API refuses uploads, analysis and profile writes for an
   *  unverified account with 403 `email_unverified`, so a stale build of this
   *  app is a worse experience and not a way in. */
  emailVerified: boolean;
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
 * A conversation: alternating turns, in order, the shape anyone who has used an
 * assistant already expects. What is NOT ordinary is where the claims live.
 *
 * Hud's text is prose and prose cannot carry an evidence chain a skeptic can
 * check. So anything the user might act on does not live in the text at all: a
 * job arrives as a JobMatch and a course as a Course, in their own fields, and
 * the screen renders them through the same MatchCard and CourseCard that Jobs
 * and Courses use. That is the condition on which the mascot is allowed on this
 * screen (workspace PRODUCT.md, 2026-08-17): he may talk, and the things he
 * hands over carry their own why, source and confidence.
 *
 * A service that describes a posting in `text` instead of attaching it has
 * moved a claim somewhere unauditable, and has broken the rule rather than bent
 * it.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'hud';
  /** Already localised when the role is `hud`; verbatim when it is `user`. */
  text: string;
  /**
   * Real postings attached to this turn. Rendered as MatchCard, so `why` and
   * `source` come along and the trust rules cannot drift from the Jobs screen.
   */
  jobs?: JobMatch[];
  /** Real courses, rendered as CourseCard, for the same reason. */
  courses?: Course[];
  /**
   * Follow-up questions to offer as one-tap chips.
   *
   * The anchor user's opening line is "I do not know what job I want", which is
   * someone who cannot yet phrase a question. Offering real next questions is
   * what makes the surface usable for her; they are ordinary suggestions, not a
   * branching structure.
   */
  suggestions?: string[];
  /**
   * Files the user attached to their own turn, echoed back so a thread read on
   * another device still shows what was sent.
   *
   * Metadata only. The bytes are NOT the onboarding pipeline's input: a
   * transcript dropped into a chat must not quietly become the document the
   * matching runs on, because that path has a human confirmation screen and
   * this one does not. See BACKEND.md §1.4.
   */
  attachments?: ChatAttachment[];
  /**
   * Hud has noticed that new results might change the answer, and is raising a
   * hand. Present only when a credit actually remains.
   *
   * NOT an action, and the distinction is the whole design: this is a
   * suggestion the model may make, and the only thing that spends the single
   * weekly credit is `rerunMatching()` behind an explicit confirmation. A
   * persuasive sentence — or an injected one — can produce this field and
   * nothing else. It is rendered as a chip that opens a confirm, never as a
   * chip that runs.
   */
  proposedRerun?: {
    reason: string | null;
    credits: { used: number; limit: number; remaining: number; resetsAt: string };
  };
  createdAt: number;
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Which way a user rated an answer. Nothing else is inferred from it. */
export type ChatVerdict = 'up' | 'down';

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export type ChatThreadSummary = Pick<ChatThread, 'id' | 'title' | 'updatedAt'>;

/* --------------------------------------------------- RECOMMENDATION FEEDBACK -- */

/**
 * What the user thought of a recommendation. PENDING BACKEND — see BACKEND.md §1.5.
 *
 * The whole point of collecting this is that the next run is better than the
 * last, so it is stored on the ACCOUNT rather than in the tab. A thumb that
 * survives only until a reload teaches the recommender nothing, and the user
 * finds their dislikes back in the list, which reads as the product ignoring
 * them.
 *
 * `reason` is deliberately a closed list plus `other`. Free text alone cannot
 * be aggregated across users, and a preset alone cannot say the thing the user
 * actually meant; both, and the ranker gets a signal it can act on today
 * without losing the sentence that explains the outliers.
 */
export type FeedbackVerdict = 'like' | 'dislike';

/** Which list the item came from. Job and course reasons do not overlap. */
export type FeedbackSubject = 'job' | 'course';

/**
 * Why a recommendation was rejected.
 *
 * Split by subject because the useful reasons genuinely differ: a job can be in
 * the wrong place or want the wrong experience, a course cannot be "too far to
 * commute" and can be too expensive. `other` exists in both and is the only one
 * that carries a note.
 */
export const JOB_DISLIKE_REASONS = [
  'notInterested', 'wrongLocation', 'wrongLevel', 'wrongField', 'employer', 'other',
] as const;
export const COURSE_DISLIKE_REASONS = [
  'notInterested', 'alreadyKnow', 'tooAdvanced', 'tooBasic', 'tooLong', 'price', 'other',
] as const;

export type JobDislikeReason = (typeof JOB_DISLIKE_REASONS)[number];
export type CourseDislikeReason = (typeof COURSE_DISLIKE_REASONS)[number];
export type DislikeReason = JobDislikeReason | CourseDislikeReason;

export interface Feedback {
  subject: FeedbackSubject;
  /** The job or course id, as the service issued it. */
  itemId: string;
  verdict: FeedbackVerdict;
  /** Only on a dislike, and only once the user has chosen one. */
  reason?: DislikeReason | null;
  /** Only when `reason` is `other`. The user's own words, never parsed here. */
  note?: string | null;
  /**
   * The user asked for a replacement rather than only registering the dislike.
   * Courses only — there is no "find me a different posting for this one" idea,
   * because a posting is a real vacancy and not an interchangeable slot.
   */
  replaced?: boolean;
}

/**
 * Every verdict this account has given, so a card can render the state the user
 * left it in. Keyed by item id; absent means no opinion, which is different
 * from a neutral one.
 */
export interface FeedbackState {
  jobs: Record<string, FeedbackVerdict>;
  courses: Record<string, FeedbackVerdict>;
}

export const emptyFeedback = (): FeedbackState => ({ jobs: {}, courses: {} });

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
   * document scan is not instant, and a stalled bar is the difference
   * between "still working" and "broken".
   */
  uploadDocument(
    input: { file: File; kind: DocumentKind; onProgress?: (fraction: number) => void },
    signal?: AbortSignal,
  ): Promise<UploadedDocument>;

  /** Starts the pipeline over the whole set. Returns the job to poll. */
  /** `mode` defaults to `replace`; only a re-upload passes `merge`. */
  startAnalysis(documentIds: string[], mode?: AnalysisMode,
                signal?: AbortSignal): Promise<{ jobId: string }>;
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
  getJobs(signal?: AbortSignal): Promise<JobsResult>;
  getCourses(signal?: AbortSignal): Promise<Course[]>;

  /**
   * Mark a course finished, and take it back.
   *
   * LIVE, and this client did not call it. Completion was written to
   * localStorage and nowhere else, so the courses map moved on while the
   * server kept its own idea of the next step — which is what the dashboard
   * reads. The two disagreed from the moment anything was completed.
   *
   * Per BACKEND.md these must NOT touch readiness: finishing a course is a
   * claim, readiness is evidence, and the CV re-upload is what turns one into
   * the other. `DELETE` is idempotent, so undoing something never completed is
   * still a success.
   */
  completeCourse(courseId: string, signal?: AbortSignal): Promise<void>;
  uncompleteCourse(courseId: string, signal?: AbortSignal): Promise<void>;
  /** Not built yet in production — BACKEND.md §4. Callers must tolerate a 404. */
  getUsage(signal?: AbortSignal): Promise<Usage>;

  /**
   * PENDING BACKEND — Hud's chat. See BACKEND.md §1.4 for the full contract.
   *
   * Request/response rather than a token stream, for now. Nothing in this
   * codebase reads a stream (`req<T>` ends in `res.json()`), and a half-arrived
   * message is not useful here: the cards are the part worth waiting for, and a
   * card without its source is a recommendation with its evidence missing.
   *
   * When streaming does arrive it belongs INSIDE `ask` — emit `text` in chunks,
   * resolve to the same message with its cards attached — so none of these
   * signatures have to change.
   */
  /**
   * Spends the single weekly credit and re-matches against the current corpus.
   *
   * Called ONLY from an explicit confirmation, never from Hud's proposal
   * directly: `proposedRerun` on a message is the model raising a hand, and a
   * chip that ran on one tap would let a mis-tap — or a persuasive sentence —
   * cost someone their whole week. The model proposes, the user disposes, the
   * server executes.
   */
  rerunMatching(
    signal?: AbortSignal,
  ): Promise<{ jobId: string; awaitingConfirmation?: boolean }>;
  /** Removes one uploaded document, from the list AND from the server's disk. */
  deleteDocument(id: string, signal?: AbortSignal): Promise<void>;

  listThreads(signal?: AbortSignal): Promise<ChatThreadSummary[]>;
  /** A thread with no messages is a normal answer, not an error. */
  getThread(id: string, signal?: AbortSignal): Promise<ChatThread>;
  /**
   * One turn. `threadId: null` opens a thread and returns the id it was given,
   * so the screen can render its greeting with no network call and still let the
   * very first thing a user does be a question.
   */
  ask(
    input: { threadId: string | null; question: string; files?: File[] },
    signal?: AbortSignal,
  ): Promise<{ threadId: string; message: ChatMessage }>;
  /**
   * Rates an answer. Fire and forget by design — a thumb is a signal for whoever
   * tunes the service, never something the user should have to wait on or see
   * fail. The client keeps its own record of which way it went so the button can
   * show a state; this call is the only place the rating leaves the browser.
   */
  rateMessage(
    input: { threadId: string; messageId: string; verdict: ChatVerdict },
    signal?: AbortSignal,
  ): Promise<void>;

  /**
   * PENDING BACKEND — recommendation feedback. See BACKEND.md §1.5.
   *
   * Fire and forget for the same reason `rateMessage` is: the user has already
   * seen the card change state, and an error toast over a thumb would cost more
   * than the lost signal. The failure that matters is silent loss across a
   * whole account, which is a server concern, not something to surface here.
   */
  sendFeedback(input: Feedback, signal?: AbortSignal): Promise<void>;
  /**
   * What this account has already said. Read once per list screen so a like
   * survives a reload — the thing that makes it a preference rather than a
   * highlight. An empty state is a normal answer on a new account.
   */
  getFeedback(signal?: AbortSignal): Promise<FeedbackState>;
  /**
   * A different course that closes the SAME gap, to drop into the slot the
   * rejected one occupied.
   *
   * `exclude` carries every course already on screen, not just the rejected
   * one: without it the obvious implementation hands back the card sitting
   * directly below, and the user watches a course they can already see slide
   * into the gap they just made.
   *
   * Null when there is genuinely nothing else — which the UI must say, rather
   * than leaving a hole or silently restoring the disliked course.
   */
  findSimilarCourse(
    input: { courseId: string; exclude: string[] },
    signal?: AbortSignal,
  ): Promise<Course | null>;
}

/**
 * Null is NOT strong. An absent score is the absence of evidence, and treating
 * it as a pass would let anything unmeasured render as fact — use `isSettled`
 * for a skill, which knows the one case where a missing score is fine.
 */
export const isStrong = (c: Confidence | null | undefined) =>
  typeof c === 'number' && c >= TRUST_THRESHOLD;

/**
 * Whether a skill can be shown as established rather than needing a look.
 *
 * Two ways to qualify, different in kind: the documents evidenced it strongly
 * enough this run, OR the person already approved it and a re-read did not find
 * it again. The second has no confidence to test — that is why it carries
 * `origin` instead of a fabricated 1.0 — and a human decision is better
 * evidence than a model score, so it does not belong in the "please check" pile.
 */
export const isSettled = (s: Skill) =>
  s.origin === 'confirmed' || isStrong(s.confidence);

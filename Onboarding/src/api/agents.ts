/**
 * AGENT CONTRACTS — the TypeScript mirror of `shared/contracts.py`.
 *
 * These are the JSON envelopes the five LangGraph agents publish, as the API
 * hands them to this app. They are kept in their own file, separate from the
 * UI-facing types in `types.ts`, for one reason: this file must track the
 * BACKEND's shape, and `types.ts` must track the SCREENS' shape. Where the two
 * differ the mapping is explicit and lives in `http.ts`, instead of a screen
 * quietly depending on an agent's field name.
 *
 * Naming: fields are snake_case here because that is what the agents emit and
 * what FastAPI/Pydantic will serialise by default. Do NOT camelCase them in
 * transit — the translation happens once, in the mapper, not in every screen.
 *
 * Every honesty field in the architecture doc has a home here. If a value can
 * legitimately be "unknown", it is `| null` and the UI is expected to say so
 * rather than substitute a number.
 */

/* ------------------------------------------------------------ PRIMITIVES -- */

/**
 * Bilingual text. The agents work in English (ESCO labels, Coursera titles,
 * LLM rationales); the product is Arabic-first. Rather than have the backend
 * guess from a header, every human-readable string ships in both languages and
 * the client picks — one cache entry serves both, and switching language needs
 * no refetch.
 *
 * `ar` may be null when a translation genuinely does not exist yet; the client
 * falls back to `en` and never renders "null".
 */
export interface LocalizedText {
  en: string;
  ar: string | null;
}

/** ISO-8601 timestamp, UTC, e.g. "2026-07-28T14:03:00Z". */
export type IsoTimestamp = string;
/** ISO date, "YYYY-MM-DD". Partial dates use "YYYY-MM" or "YYYY". */
export type IsoDate = string;

/**
 * Agent A's confidence envelope. `overall` is the fraction of fields that
 * actually grounded, computed AFTER hallucinated fields are dropped — so
 * catching a hallucination does not lower it.
 */
export interface Confidence {
  overall: number;               // 0..1
  by_field?: Record<string, number>;
}

/**
 * Provenance. `unresolved_gaps` is load-bearing: the architecture doc's rule is
 * that nothing computed is silently discarded, so anything the pipeline could
 * not resolve is published here and the UI surfaces it.
 */
export interface Provenance {
  source_documents: string[];
  unresolved_gaps: string[];
  extracted_at: IsoTimestamp;
}

/* ------------------------------------------------- AGENT A: candidate_profile -- */

/**
 * How a skill came to be on the profile. This drives what the UI may claim:
 * `claim_only` is an unverified assertion and must never be shown with the same
 * force as a project-proven skill (and per Agent C, it can only ever cap a
 * requirement at `possible_match`).
 */
export type SkillOrigin =
  | 'project'
  | 'experience'
  | 'certification'
  | 'course'
  | 'claim_only'
  | 'coursework_derived'  // promoted from a passed course the CV never claimed
  | 'adjacent';           // tool implied by a demonstrated domain; capped medium

/** Evidence tier, clamped in Agent A's code — not merely requested in a prompt. */
export type EvidenceQuality = 'high' | 'medium' | 'low';

export interface AgentSkill {
  name: string;
  origin: SkillOrigin;
  quality: EvidenceQuality;
  /** A verified verbatim quote from the source, or null. Never paraphrased. */
  evidence_quote: string | null;
  /** The course/credential this was derived from, when origin says so. */
  from_course?: string | null;
  /** Canonical ESCO concept, or null when honestly unmapped. */
  esco_code?: string | null;
}

/** A field Agent A extracted, travelling with its own certainty. */
export interface ExtractedField<T> {
  value: T;
  confidence: number;            // 0..1
  evidence_quote: string | null;
}

/** `candidate_profile.json` — Agent A's published envelope. */
export interface CandidateProfile {
  candidate_id: string;
  full_name: ExtractedField<string> | null;
  email: ExtractedField<string> | null;
  phone: ExtractedField<string> | null;
  birth_date: ExtractedField<IsoDate> | null;
  graduation_date: ExtractedField<IsoDate> | null;
  education: Array<{
    institution: ExtractedField<string> | null;
    degree: ExtractedField<string> | null;
    graduation_date: ExtractedField<IsoDate> | null;
  }>;
  skills: AgentSkill[];
  confidence: Confidence;
  provenance: Provenance;
}

/* ------------------------------------------------- AGENT B: job_postings -- */

/** Agent B flags thin windows rather than reporting a confident trend. */
export type DemandTrend = 'rising' | 'stable' | 'falling' | 'low_confidence';

/** A posting as published through `shared/job_market.py`. */
export interface JobPostingExport {
  posting_id: string;
  title: LocalizedText;
  employer: string | null;
  location: LocalizedText | null;
  /** Already filtered: only `vacancy` + `company` postings reach the client. */
  arrangement: LocalizedText | null;
  required_skills: string[];
  esco_codes: string[];
  /** ISCO sector, used by Agent C to scope demand weighting. */
  isco_sector?: string | null;
  source_name: string;
  source_url: string;
  retrieved_at: IsoTimestamp;
  posted_at?: IsoTimestamp | null;
}

export interface SkillDemandStat {
  esco_code: string;
  skill_label: LocalizedText;
  frequency_count: number;
  prior_frequency_count: number | null;
  trend: DemandTrend;
  window_start: IsoDate;
  window_end: IsoDate;
}

/* ---------------------------------------------------- AGENT C: skill_gap -- */

/**
 * The four-tier match verdict. `possible_match` is NOT a rounding error to be
 * resolved in the candidate's favour — it is published uncertainty and the UI
 * must render it as its own state, never collapsed into matched or missing.
 */
export type MatchStatus = 'matched' | 'possible_match' | 'missing';

/** Which tier produced the verdict — shown as provenance, and useful in QA. */
export type MatchTier = 'esco_identity' | 'exact_string' | 'token_containment' | 'cosine' | 'llm';

export interface RequirementMatch {
  requirement: string;
  esco_code: string | null;
  status: MatchStatus;
  tier: MatchTier;
  /** Candidate skills that satisfied it. Verified to exist on the profile. */
  satisfied_by: string[];
  similarity: number | null;     // 0..1, present for the cosine tier
}

export interface MissingSkillDetail {
  skill: string;
  skill_label: LocalizedText;
  esco_code: string | null;
  /** Demand weight, log1p-damped and counted once per canonical skill. */
  priority_score: number;
  demand_trend: DemandTrend | null;
}

export interface SkillGapForPosting {
  posting_id: string;
  title: LocalizedText;
  /**
   * 0..1, or NULL when there is nothing to compute it from — no parsable
   * requirements, or every requirement landed unresolved. The architecture doc
   * is explicit that this must not be reported as 0.0, which would read as a
   * perfect gap. The UI renders null as "not enough to judge".
   */
  gap_score: number | null;
  /** [lower, upper] — the uncertainty `possible_match` represents, published. */
  gap_score_range: [number, number] | null;
  requirements: RequirementMatch[];
}

/** `skill_gap.json` — Agent C's published envelope. */
export interface SkillGap {
  candidate_id: string;
  generated_at: IsoTimestamp;
  postings: SkillGapForPosting[];
  aggregate: {
    /** Agent E consumes exactly this. */
    missing_skill_details: MissingSkillDetail[];
    matched_skills: string[];
    /** Same nullability rule as per-posting gap_score. */
    overall_gap_score: number | null;
    overall_gap_score_range: [number, number] | null;
  };
}

/* ------------------------------------------- AGENT D + E: course recommendations -- */

export interface CourseCandidate {
  course_id: string;
  title: LocalizedText;
  provider: string;
  /** Null when the provider does not publish one — never coerced to 0. */
  price: number | null;
  currency: string | null;
  duration_hours: number | null;
  rating: number | null;
  review_count: number | null;
  last_updated: IsoDate | null;
  teaches_skills: string[];
  esco_codes: string[];
  source_name: string;
  source_url: string;
  retrieved_at: IsoTimestamp;
  /** Required for CC-BY-SA sources such as freeCodeCamp. */
  attribution?: string | null;
}

export interface CourseRecommendation {
  course: CourseCandidate;
  /** The gap skills this course was selected to close. */
  covers_skills: string[];
  /** Also-covered skills, so a course is recommended once, not per skill. */
  covers_other_skills: string[];
  /** Coarse bucket only — the rationale LLM never sees raw priority scores. */
  priority_bucket: 'high' | 'medium' | 'low';
  /** Short generated explanation, fenced to a plain fact sheet. */
  rationale: LocalizedText;
}

/** `course_recommendations.json` — Agent E's published envelope. */
export interface CourseRecommendations {
  candidate_id: string;
  generated_at: IsoTimestamp;
  recommendations: CourseRecommendation[];
  /**
   * Skills with zero course candidates. Honest emptiness: the UI says "no
   * course found for this yet" instead of hiding the gap.
   */
  no_course_found: string[];
}

/* ------------------------------------------------------------- PIPELINE -- */

/** Which agent produced a failure, so the UI can say what to retry. */
export type AgentId = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * The synchronous A -> C -> E response. One request runs the whole pipeline and
 * returns all three envelopes together, so the confirm screen and the dashboard
 * are populated from a single round trip.
 */
export interface PipelineResult {
  run_id: string;
  candidate_profile: CandidateProfile;
  skill_gap: SkillGap;
  course_recommendations: CourseRecommendations;
  /** Non-fatal problems worth surfacing, e.g. "transcript unreadable". */
  warnings: Array<{ agent: AgentId; code: string; message: LocalizedText }>;
}

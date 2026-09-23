/**
 * The dashboard.
 *
 * ORDER — where you stand, what you already have, what to learn, how far along
 * you are, and only then the postings. Jobs moved to LAST deliberately: they are
 * the destination, not the starting point, and a graduate who lands on a wall of
 * vacancies before they know where they stand reads the page as a job board that
 * happens to know their name. The journey sits just above them, because it is
 * the bridge — it answers "how far along am I" immediately before the page shows
 * what is at the end of the road.
 *
 * VOLUME — courses and jobs show two each with a way through to the full page.
 * The two courses are the two still OPEN: a course the user has marked done
 * leaves this shelf, and the next step names the one after it. It keeps its
 * place on the courses map, struck through, because seeing what you finished is
 * the progress signal there — but here there is room for two cards and their
 * only job is "what to do next".
 * Skills sit behind ONE closed disclosure carrying all of them, rather than the
 * first four with a "show more" underneath: a partial list cut at an arbitrary
 * number is the worst of both, and the skills are this card's detail, not its
 * point. A dashboard's job is to be read in one screen and acted on; a complete
 * inventory of what the pipeline produced is what the dedicated pages are for.
 *
 * The one thing kept from the capability-first argument is the framing rather
 * than the sequence. The readiness number never appears alone — it carries a
 * plain sentence and a "how this is worked out" disclosure, because a figure the
 * user cannot interrogate is exactly what loses a skeptical reader. And gaps stay
 * "to unlock" with a plus icon rather than a deficit in a danger hue: a graduate
 * who reads the first screen as a list of failures closes the tab, and nothing
 * below it gets seen.
 *
 * MOTION — the page arrives in sequence rather than as one block, and the ring
 * draws its arc once. Both are `focus` jobs in the motion skill's terms: they
 * tell the eye where to start. What deliberately does NOT animate is the
 * readiness NUMBER and every confidence badge — a score has to read as fact, and
 * counting it up would be animating a figure so it looks impressive, which the
 * skill bans outright. All travel is expressed through `--motion-scale`, so
 * reduced motion collapses distance while every fade keeps its full duration.
 *
 * Hud is deliberately absent from this whole page: the brand locks the mascot out
 * of verdicts, scores, real matches and data tables, all of which are here.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Plus, Target } from 'lucide-react';
import { useI18n } from '../i18n';
import { skillCase } from '../lib/skillCase';
import { useChat } from '../state/chat';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { useOnboarding } from '../state/onboarding';
import { completedIdsFrom, useCompletedCourses } from '../state/completed';
import { useAuth } from '../state/auth';
import { Card, EmptyState, ErrorState, GapChip, LoadingBlock } from '../components/ui';
import { CareerGoal } from '../components/CareerGoal';
import type { Course, JobMatch } from '../api';
import { MatchCard } from '../components/MatchCard';
import { CourseCard } from '../components/CourseCard';
import { JourneyMap, LOW_READINESS } from '../components/map/JourneyMap';
import { useRunInFlight } from '../components/PipelineProgress';
import { Celebrate, CountUp } from '../components/Celebrate';
import { takeCelebration, type Celebration } from '../lib/celebrate';

/** How much of each list the dashboard shows before handing off to its page.
 *  Skills are no longer truncated — they live behind one disclosure instead. */
const CARDS_SHOWN = 2;

/**
 * Where the user stands today, in a word: still studying, or out.
 *
 * DERIVED from the graduation date they confirmed, not stated by the service.
 * That date is the one fact on the profile that answers this question, and
 * deriving it means this line cannot disagree with the date shown on the
 * profile screen. It is also why there is no third guess: no date, no claim,
 * and the line is simply absent rather than defaulting to either.
 */
/**
 * The rung a score was measured against, as a word in the reader's language.
 *
 * A lookup rather than `t('dash.level' + level)`: a key built by concatenation
 * is invisible to the i18n parity check, and an English string on the wire is
 * exactly the bug that put an English sentence on the Arabic dashboard.
 */
const LEVEL_KEY = {
  entry: 'dash.levelEntry',
  associate: 'dash.levelAssociate',
  mid: 'dash.levelMid',
  senior: 'dash.levelSenior',
  executive: 'dash.levelExecutive',
} as const;

/**
 * Which readiness sentence to use for a pool of `n` roles.
 *
 * Split by grammatical number because Arabic has three forms where English has
 * two, and a single key with `{n}` interpolated produces "أقرب 2 وظائف" — the
 * plural where the dual is required. `n` is still passed for the three-or-more
 * case, which does take a numeral.
 */
function closestKey(n: number, hasGaps: boolean): string {
  const size = n === 1 ? 'One' : n === 2 ? 'Two' : '';
  return `dash.noteClosest${size}${hasGaps ? 'Gaps' : ''}`;
}

function standingOf(
  graduationDate: string | null | undefined,
  t: (k: string) => string,
): string | null {
  if (!graduationDate) return null;
  // `yyyy-mm` is what <input type="month"> stores and what Agent A returns.
  const grad = new Date(`${graduationDate.slice(0, 7)}-01T00:00:00`);
  if (Number.isNaN(grad.getTime())) return null;
  const now = new Date();
  // Compared at month granularity, because that is the precision of the value.
  // A day-level comparison would call someone graduating this month a student
  // for up to 30 days after their own certificate says otherwise.
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return grad > thisMonth ? t('dash.standingStudent') : t('dash.standingGraduate');
}

/**
 * "SQL, data modelling and Power BI", in the reader's own language.
 *
 * `Intl.ListFormat` rather than a join on ", ": Arabic separates a list with
 * the Arabic comma and joins the last pair with a word, and hard-coding either
 * writes English punctuation into an Arabic sentence.
 */
function listOf(items: string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}

export function Dashboard() {
  const { t, locale, formatNumber } = useI18n();
  // A re-run finishing must be visible here without a manual reload.
  const { resultsVersion } = useChat();
  const api = useApi();
  const { profile } = useOnboarding();
  const { user } = useAuth();
  const { settled } = useOnboarding();
  const inFlight = useRunInFlight();
  // `settled` in the deps is what makes the page fill itself in: the dashboard
  // reads the FINISHED run, so it has to re-fetch the moment one exists rather
  // than making the user reload a page that was correct when it loaded.
  const { data, loading, error, reload } = useAsync((s) => api.getDashboard(s),
                                                   [api, locale, settled, resultsVersion]);
  /**
   * Courses are their own request because `DashboardData` does not carry them.
   * Its failure is deliberately NOT the page's failure: the dashboard is still
   * worth reading without a course shelf, so this section simply does not render
   * rather than taking the readiness score down with it.
   */
  const { data: courses } = useAsync((s) => api.getCourses(s), [api, locale, settled, resultsVersion]);
  /**
   * The target role. Not in `DashboardData` — readiness is measured against a
   * target the payload never names, which is why the score had nothing to be a
   * score OF. Read from the stored profile: `preferences.preferredRole` is what
   * the user said they want, `suggestedRole` is what the agents infer. Shown as
   * the user's own where they gave one, the suggestion only as a fallback, and
   * never merged — see the note in api/types.ts.
   * Same fire-and-forget pattern as the courses fetch: no target, no banner.
   */
  const { data: stored, reload: reloadProfile } = useAsync((s) => api.getProfile(s),
                                                          [api, locale, settled, resultsVersion]);
  /** The token pool, so a card can price a replacement before spending one. */
  const { data: usage } = useAsync((s) => api.getUsage(s), [api, locale, resultsVersion]);

  /* The same in-place replacement the jobs page has, for the two cards shown
     here. Rejecting a posting must not throw the reader off the dashboard. */
  const [editedMatches, setEditedMatches] = useState<JobMatch[] | null>(null);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const replaceMatch = useCallback((id: string, next: JobMatch) => {
    setEditedMatches((cur) => (cur ?? data?.topMatches ?? []).map((j) => (j.id === id ? next : j)));
    setMatchNotice(t('fb.replacedJob'));
  }, [data, t]);

  /**
   * Which courses the user has told us they finished.
   *
   * FROM THE SERVER. `completedAt` on `GET /api/courses` is built and published
   * now, so this reads the same record every device sees rather than one
   * browser's localStorage — which is what made progress vanish on a new phone
   * or after clearing site data. The list is already fetched above for the
   * shelf, so this costs no extra request.
   *
   * The server also stops naming a finished course as the next step, so this is
   * belt and braces on a decision made there rather than the only thing
   * preventing it.
   */
  const { completed } = useCompletedCourses(user?.id, completedIdsFrom(courses));

  /**
   * Did the score move because of something this person did?
   *
   * Taken ONCE per arrival, and taking it is what records the new value as
   * seen — so a second visit has nothing to celebrate and the number is simply
   * the number. `data.readiness` is in the deps rather than the whole payload
   * because a refetch that returns the same score is not a new event.
   */
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const readiness = data?.readiness;
  /**
   * TAKEN ONCE PER SCORE, and the ref is what makes that true rather than
   * hoped for. `takeCelebration` both reads and CONSUMES — it clears the mark
   * and records the new value as seen — so calling it twice returns null the
   * second time and wipes the celebration that the first call earned.
   *
   * StrictMode invokes every effect twice on mount, so this was one render
   * away from never celebrating at all: it survived only because the dashboard
   * happens to mount with no data, which makes both invocations return early
   * before the score exists. A cached first paint would have eaten it.
   */
  const taken = useRef<number | null>(null);
  useEffect(() => {
    if (!user || typeof readiness !== 'number') return;
    if (taken.current === readiness) return;
    taken.current = readiness;
    setCelebration(takeCelebration(user.id, readiness));
  }, [user, readiness]);

  // Closed by default: the skills are the card's DETAIL, not its point.
  const [showAllSkills, setShowAllSkills] = useState(false);
  /**
   * The career-goal editor, owned here because two controls open it: the
   * three-dot menu inside <CareerGoal>, and the "set your goal" button in the
   * readiness block, which sits where the missing goal is actually noticed.
   */
  const [editingGoal, setEditingGoal] = useState(false);
  const openGoalEditor = useCallback(() => setEditingGoal(true), []);
  /**
   * Same in-place replacement the courses page has, for the two cards shown
   * here. See the longer note in Courses.tsx — the point is that rejecting a
   * course must not throw the user off the dashboard they were reading.
   */
  const [editedCourses, setEditedCourses] = useState<Course[] | null>(null);
  useEffect(() => { setEditedCourses(null); }, [courses]);
  useEffect(() => { setEditedMatches(null); }, [data]);
  const [courseNotice, setCourseNotice] = useState<string | null>(null);
  const replaceCourse = useCallback((id: string, next: Course) => {
    setEditedCourses((cur) => (cur ?? courses ?? []).map((c) => (c.id === id ? next : c)));
    // See the same note in Courses.tsx: the card that asked is already gone.
    setCourseNotice(t('fb.replaced'));
  }, [courses, t]);

  // The account is the source of truth for who this is: the onboarding profile
  // only exists in the session that ran onboarding, so a returning user has
  // none, and reading it first would greet them by the brand's own name.
  const firstName = (user?.fullName || profile?.fullName || '').trim().split(/\s+/)[0] || '';

  /**
   * The skeleton is for the FIRST load only.
   *
   * `useAsync` flips `loading` on every dep change, and the deps include
   * `settled` — which turns true at the exact moment the user is watching the
   * progress banner resolve. Returning the skeleton on any `loading` therefore
   * unmounted the dashboard someone was mid-way through reading, threw scroll
   * back to the top and replayed the entrance. The product's best moment was
   * rendered as a crash. A refetch now keeps the page it already has and marks
   * it busy instead.
   */
  /**
   * Every branch below keeps the page heading.
   *
   * Three of the four used to drop it: the skeleton rendered no heading at all,
   * and the in-flight and error branches went straight to EmptyState's h3, so a
   * screen reader met a document whose first heading was level three and whose
   * h1 did not exist. Which branch rendered is a data condition; it should not
   * change the shape of the document outline.
   */
  const header = (
    // No subtitle. It read "Here is what your transcript shows you can do
    // today", which is a description of the page the page itself already is —
    // the readiness block, the journey and the matches below it say it with
    // data. A greeting does not need a caption.
    <header>
      <h1 className="headline">{t('dash.greeting', { name: firstName })}</h1>
    </header>
  );

  if (loading && !data) return <DashboardSkeleton header={header} />;
  // The dashboard 404s until the pipeline's second half lands, and rendering an
  // error for that told a working product's users it was broken.
  if ((error || !data) && inFlight) {
    return (
      <div className="stack stack--page seq">
        {header}
        <Card><EmptyState title={t('state.workingTitle')} body={t('state.workingSub')} /></Card>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="stack stack--page seq">
        {header}
        {/* Carded, like the in-flight branch beside it. One of these two was
            bare and the other was not, for no reason either could state. */}
        <Card><ErrorState onRetry={reload} /></Card>
      </div>
    );
  }

  const allCourses = editedCourses ?? courses ?? [];
  const remaining = allCourses.filter((c) => !completed.has(c.id));
  const topCourses = remaining.slice(0, CARDS_SHOWN);
  const topMatches = (editedMatches ?? data.topMatches).slice(0, CARDS_SHOWN);

  /**
   * The readiness sentence, written here rather than shipped from the service.
   *
   * The service still sends `readinessNote` as English prose; a string on the
   * wire cannot be translated, and because it never becomes an i18n key the
   * parity check cannot catch it either — which is how the Arabic dashboard came
   * to read an English sentence. `gapCount` is every gap found, not `gaps.length`
   * (that is the actionable subset), so the count matches what was measured.
   */
  const level = data.comparedAgainst?.level
    ? t(LEVEL_KEY[data.comparedAgainst.level])
    : null;
  /* WHICH roles the headline was measured against, by name.
     The number is pooled over the roles this person fits best rather than over
     the whole retrieved set, and that is only honest while the sentence says so
     and the roles are on screen. If `pooled` is 0 the service is an older one
     that sends no such set, and the wording falls back to the market phrasing
     it published then. */
  const pooled = data.comparedAgainst?.rolesPooled ?? 0;
  const closestRoles = data.comparedAgainst?.roles ?? [];

  const readinessNote = data.readinessReason
    ? data.readinessReason === 'insufficient'
      ? t('dash.noteInsufficient')
      : pooled > 0
        ? t(
          /* One key per grammatical number, not one key with a digit dropped
             into it: Arabic takes the dual for two and the plural for three or
             more, so "أقرب 2 وظائف" is simply wrong. English reads better for
             the small counts too. */
          closestKey(pooled, (data.gapCount ?? 0) > 0),
          {
            pct: formatNumber(data.readiness ?? 0),
            n: formatNumber(pooled),
            g: formatNumber(data.gapCount ?? data.gaps.length),
          },
        )
        : data.readinessReason === 'no_gaps'
          ? t(level ? 'dash.noteNoGapsLevel' : 'dash.noteNoGaps',
            { pct: formatNumber(data.readiness ?? 0), level: level ?? '' })
          : t(level ? 'dash.noteWithGapsLevel' : 'dash.noteWithGaps', {
            pct: formatNumber(data.readiness ?? 0),
            n: formatNumber(data.gapCount ?? data.gaps.length),
            level: level ?? '',
          })
    : data.readinessNote;

  /**
   * The one named action on the page, and it has to survive being acted on.
   *
   * The service authors this card and its copy names a specific course, so the
   * moment that course is marked done the dashboard is telling someone to do a
   * thing they have just told it they did. The service cannot know: completion
   * is a write it accepts and does not feed back.
   *
   * So the server's step stands until the user finishes ANY course, and from
   * then on the card names the next one still open. Its copy states only what
   * the card beside it already states — the title, the provider, the skills it
   * opens. Nothing here invents a reason ("three roles ask for this"): that
   * figure is the service's to make, and making one up is the fabricated
   * statistic the trust rules bar outright.
   */
  const nextCourse = remaining[0];
  const nextStep: { title: React.ReactNode; body: string; action: string; cta: string } =
    !allCourses.some((c) => completed.has(c.id))
      ? {
        /* The service's `reason` and values, written here in the reader's
           language. `title`/`body` are its English fallback, for a client that
           reaches a service predating `reason`. `listOf` rather than a join,
           because Arabic punctuates a list its own way. */
        title: data.nextStep.reason
          ? (data.nextStep.reason === 'course'
            ? t('dash.stepCourseTitle', { course: data.nextStep.subject ?? '' })
            : t(`dash.step.${data.nextStep.reason}.title`))
          : data.nextStep.title,
        body: data.nextStep.reason
          ? (data.nextStep.reason === 'add_document'
            ? t('dash.step.add_document.body')
            : t(`dash.step.${data.nextStep.reason}.body`, {
              skills: listOf((data.nextStep.subjects ?? []).map(skillCase), locale),
            }))
          : data.nextStep.body,
        action: data.nextStep.action,
        cta: t('dash.startNextStep'),
      }
      : nextCourse
        ? {
          title: <bdi>{nextCourse.title}</bdi>,
          body: nextCourse.unlocks.length > 0
            ? t('dash.nextCourse', {
              provider: nextCourse.provider,
              skills: listOf(nextCourse.unlocks.map(skillCase), locale),
            })
            : t('dash.nextCoursePlain', { provider: nextCourse.provider }),
          action: 'courses',
          cta: t('dash.startNextStep'),
        }
        : {
          /* Nothing left on the path. The honest next move is not another
             course — it is the CV re-upload, which is the only thing that turns
             what they have finished into evidence readiness can read. */
          title: t('dash.pathClear'),
          body: t('dash.pathClearBody'),
          action: 'documents',
          cta: t('courses.updateCv'),
        };

  /**
   * Below this the matches are withheld deliberately.
   *
   * A product decision, and an uncomfortable one: PRODUCT.md's second principle
   * is capability before deficit, and an empty matches area is a deficit. It is
   * kept honest by never rendering a bare empty state — the block below says
   * what to do next and points at the ordered course path, so the user leaves
   * this section with an action rather than a verdict.
   */
  const lowReadiness = data.readiness <= LOW_READINESS;

  // What the user named beats what the agents guessed; the suggestion is only
  // ever a fallback, and it is labelled as a suggestion when it is used.
  // `target` is still needed here for the journey's destination line; the
  // readiness block's copy of it now lives in <CareerGoal>.
  const namedTarget = stored?.preferences?.preferredRole?.trim() || '';
  const target = namedTarget || stored?.suggestedRole?.title || '';
  const standing = standingOf(stored?.graduationDate, t);

  return (
    // `seq` staggers the direct children in, rather than the old single fade on
    // the whole page. A page that arrives as one block tells the eye nothing
    // about where to begin; one that assembles top-down does.
    <div className="stack stack--page seq" aria-busy={loading || undefined}>
      {header}

      {/* The one moment this page cheers, and only after a run that moved the
          number. See `Celebrate` for why the score is allowed to travel here
          and nowhere else. */}
      {celebration && <Celebrate celebration={celebration} />}

      {/* 1. Where you stand. */}
      <section aria-labelledby="dash-readiness">
        {/* The page's one expressive surface — see the depth block in app.css.
            Everything below this stays product register. */}
        <Card className="card--anchor">
          <div className="readiness">
            <Ring value={data.readiness} from={celebration?.from} />
            {/* `min(16rem, 100%)`, not a bare 16rem. The bare value is a hard
                floor: on a 320px phone the card's content box is 215px, the
                block refused to go under 256, and the readiness sentence — the
                first thing on the first screen — hung 16px outside the card. */}
            {/* LEFT: where you are, and nothing else. The target used to sit
                here too, as a line of body copy under the heading, which read
                as a footnote on the score instead of as the other half of the
                sentence. It is now its own side. */}
            <div className="stack stack--sm readiness__where">
              <h2 className="section__title" id="dash-readiness">{t('dash.readiness')}</h2>
              {standing && <p className="standing">{standing}</p>}
              {/* Composed here, in the reader's language, from the reason and
                  the two numbers. `readinessNote` is the service's English and
                  is the fallback only while an older service is still deployed. */}
              <p>{readinessNote}</p>

              {/* THE PRECISION THE NUMBER ACTUALLY HAS.
                  Agent C computes this band from the requirements it could
                  neither confirm nor rule out, so it is measured uncertainty
                  rather than decoration. Showing it is what stops an ordinary
                  two-point movement — the same person, a fresh ingest — reading
                  as decline, which is the complaint this whole change answers. */}
              {data.readinessRange && (
                <p className="text-sm muted readiness__band">
                  <span className="readiness__label">
                    {t('dash.readinessRange', {
                      lo: formatNumber(data.readinessRange[0]),
                      hi: formatNumber(data.readinessRange[1]),
                    })}
                  </span>
                  {' '}
                  {t('dash.readinessRangeWhy')}
                </p>
              )}

              {/* The roles it was measured against, named. Not decoration: the
                  headline is pooled over these and nothing else, and a reader
                  who cannot see them cannot check the claim. */}
              {closestRoles.length > 0 && (
                <p className="text-sm muted">
                  <span className="readiness__label">{t('dash.comparedRoles')}</span>
                  {' '}
                  {listOf(closestRoles, locale)}
                </p>
              )}

              {/* NOT RENDERED: `data.marketReadiness`, the average across every
                  matched role. It is on the payload and it is true, but showing
                  it beside the headline was a third reading on a card that
                  already carries a figure, a band and a role list — and the
                  decision taken was the headline alone. The key
                  `dash.marketReadiness` exists in both languages for whenever
                  that is revisited. */}

              {/* A SCORE HAS TO SAY WHAT IT IS A SCORE OF.
                  With no goal set, the ring was reporting a hard figure out of
                  100 while the block beside it said "finding your career goal"
                  — a number measured against nothing, next to an admission
                  that nothing had been chosen. That is exactly the
                  uninterrogable figure this product's own rules say loses a
                  skeptical reader.
                  So when there is no target the ring is labelled as the general
                  reading it is, and the fix is offered next to the problem
                  rather than left for the user to go hunting for. */}
              {!target && (
                <div className="nogoal">
                  <p className="nogoal__what">{t('dash.readinessNoGoal')}</p>
                  <button type="button" className="btn btn--secondary btn--sm" onClick={openGoalEditor}>
                    <Target size={15} aria-hidden="true" />
                    {t('dash.readinessSetGoal')}
                  </button>
                </div>
              )}

              <details>
                <summary className="disclosure">{t('dash.readinessHow')}</summary>
                <p className="text-sm muted" style={{ marginBlockStart: 'var(--space-2)' }}>
                  {t('dash.readinessHowBody')}
                </p>
              </details>
            </div>

            {/* RIGHT: where you are going, and the control that changes it.
                Both reloads, because readiness and the journey are both
                measured against this role — changing it and leaving a score
                computed for the old one on screen is the worst of both. */}
            <CareerGoal
              profile={stored ?? null}
              onSaved={() => { reloadProfile(); reload(); }}
              editing={editingGoal}
              setEditing={setEditingGoal}
            />
          </div>

          <hr className="divider" style={{ marginBlock: 'var(--space-6)' }} />

          {/* ONE DISCLOSURE, ALL THE SKILLS, CLOSED BY DEFAULT.
              This used to print the first four and offer "show more (1)",
              which is the worst of both: a partial list nobody asked for,
              cut at a number that means nothing to the reader, under a
              button whose count changes with the data. Either the skills
              are the point of this card or they are its detail — they are
              its detail, because the score and the goal above them are
              what the card is for.
              A real <button> with `aria-expanded` and `aria-controls`, not
              a <details>: the count belongs in the accessible name and the
              open/closed state has to be announced. */}
          {data.standings.length > 0 && (
            <div className="skills">
              <button
                type="button"
                className="skills__toggle"
                onClick={() => setShowAllSkills((v) => !v)}
                aria-expanded={showAllSkills}
                aria-controls="dash-skills-list"
              >
                <span className="skills__title">{t('dash.yourSkills')}</span>
                {/* The profile's real total, not `standings.length` — that is a
                    sample of six held skills plus six gaps, so counting it told
                    someone with 173 skills they had 12, half of which were
                    things they did not have. */}
                <span className="skills__count num">
                  {t('dash.yourSkillsCount', {
                    n: formatNumber(data.skillsHeld ?? data.standings.filter((s) => s.held).length),
                  })}
                </span>
                <ChevronDown
                  size={18}
                  aria-hidden="true"
                  className="chevron"
                  data-open={showAllSkills || undefined}
                />
              </button>

              {showAllSkills && (
                <div className="skills__panel" id="dash-skills-list">
                  <p className="text-sm muted">{t('dash.yourSkillsSub')}</p>
                  <ul className="stack" aria-label={t('dash.skillsLabel')}>
                    {data.standings.map((s) => (
                      <li key={s.name} className="skill">
                        <div className="skill__head">
                          <span className="skill__name"><bdi>{skillCase(s.name)}</bdi></span>
                          <span className="skill__state" data-held={s.held || undefined}>
                            {s.held
                              ? <><Check size={14} aria-hidden="true" />{t('dash.held')}</>
                              : <><Plus size={14} aria-hidden="true" />{t('dash.toUnlock')}</>}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </section>

      {/* 2. How far along you are — the bridge from the score to the target. */}
      <JourneyMap stages={data.journey} target={target} readiness={data.readiness} />

      {/* "Your highest yield skills" used to sit here. Removed: it restated the
          `held` rows of the standings list ~200px above it, in a second visual
          language, leaving the reader to perform the join. Capability still
          leads the page — the readiness block and its "You have this" rows are
          the first thing on it — so the capability-before-deficit rule is met
          without the duplicate. */}

      {/* 3. What to learn next, then two real courses that close it. */}
      <section className="stack" aria-labelledby="dash-gaps">
        <div className="section__head">
          <h2 className="section__title" id="dash-gaps">{t('dash.gaps')}</h2>
          <span className="spacer" />
          <Link className="btn btn--ghost btn--sm" to="/courses">
            {t('dash.seeAllCourses')}
            <ArrowRight size={16} aria-hidden="true" className="go" />
          </Link>
        </div>
        <p className="section__note">{t('dash.gapsSub')}</p>
        {data.gaps.length > 0 ? (
          <div className="chips">
            {data.gaps.map((g) => <GapChip key={g}><bdi>{g}</bdi></GapChip>)}
          </div>
        ) : (
          <p className="text-sm muted">{t('dash.noGaps')}</p>
        )}

        {topCourses.length > 0 && (
          <div className="grid grid--2">
            {topCourses.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                usage={usage}
                onReplace={(next) => replaceCourse(c.id, next)}
              />
            ))}
          </div>
        )}

        {/* Outlives the card it describes. Polite, so it never pulls focus off
            whatever the user is reading. */}
        {courseNotice && (
          <p className="text-sm" role="status" aria-live="polite">{courseNotice}</p>
        )}

        {/* The single most important thing on the page: one named action. It is
            the only primary button here, so the two "browse all" links cannot
            compete with it. Product register — a plain sunken well with a gold
            hairline, not a second expressive surface. The gold anchor for this
            viewport is spent on the readiness block above. */}
        <Card className="card--sunken card--accent">
          <div className="stack stack--sm">
            <span className="eyebrow">{t('dash.next')}</span>
            {/* `card__title`, not `section__title`: an h3 nested inside a
                section must not render at the same size and weight as the five
                h2s around it, or the DOM has a hierarchy the eye cannot see. */}
            <h3 className="card__title">{nextStep.title}</h3>
            <p>{nextStep.body}</p>
            <div className="row" style={{ marginBlockStart: 'var(--space-2)' }}>
              {/* Was labelled "See all courses", the same string as the section
                  link above it — two different destinations wearing one name. */}
              <Link className="btn btn--primary" to={`/${nextStep.action}`}>
                {nextStep.cta}
                <ArrowRight size={16} aria-hidden="true" className="go" />
              </Link>
            </div>
          </div>
        </Card>
      </section>

      {/* 4. The destination, last: real postings, each checkable at its source. */}
      <section className="stack" aria-labelledby="dash-matches">
        <div className="section__head">
          <h2 className="section__title" id="dash-matches">{t('dash.matches')}</h2>
          <span className="spacer" />
          <Link className="btn btn--ghost btn--sm" to="/jobs">
            {t('dash.seeAllJobs')}
            <ArrowRight size={16} aria-hidden="true" className="go" />
          </Link>
        </div>
        {lowReadiness ? (
          /* Not an empty state, and not a list of roles they cannot get. The
             action points at the course path, which is ordered so the first
             item is the one that moves them furthest. */
          <Card>
            <EmptyState
              title={t('dash.lowMatchesTitle')}
              body={t('dash.lowMatchesBody')}
              action={<Link className="btn btn--primary" to="/courses">{t('dash.startNextStep')}</Link>}
            />
          </Card>
        ) : topMatches.length === 0 ? (
          <Card>
            <EmptyState
              title={t('dash.emptyMatches')}
              body={t('dash.emptyMatchesSub')}
              action={<Link className="btn btn--primary" to="/upload">{t('dash.addDoc')}</Link>}
            />
          </Card>
        ) : (
          <>
            <div className="grid grid--2">
              {topMatches.map((j) => (
                <MatchCard
                  key={j.id}
                  job={j}
                  usage={usage}
                  onReplace={(next) => replaceMatch(j.id, next)}
                />
              ))}
            </div>
            {/* Outlives the card it describes, like the course notice above. */}
            {matchNotice && (
              <p className="text-sm" role="status" aria-live="polite">{matchNotice}</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/**
 * The loading state mirrors the real page's SHAPE — a wide card, then two pairs
 * — instead of one card of five grey lines standing in for five sections and two
 * grids. A skeleton's whole job is to tell the eye what is coming; one that
 * describes a different layout makes the arrival feel like a jump.
 */
function DashboardSkeleton({ header }: { header: React.ReactNode }) {
  return (
    <div className="stack stack--page">
      {header}
      <Card><LoadingBlock rows={4} /></Card>
      <div className="grid grid--2">
        <Card><LoadingBlock rows={3} /></Card>
        <Card><LoadingBlock rows={3} /></Card>
      </div>
    </div>
  );
}

/**
 * Readiness ring. The arc is decorative; the number and the sentence beside it
 * carry the meaning, so nothing is lost if colour cannot be perceived.
 *
 * The arc DRAWS once on arrival — a `focus` job, pointing the eye at the top of
 * the page. The NUMBER does not count up. That distinction is the motion skill's,
 * and it is the right one: drawing the arc is choreography, animating the figure
 * would be dressing up a score so it looks more impressive than it is.
 */
function Ring({ value, from }: { value: number; from?: number }) {
  const { t, formatNumber } = useI18n();
  const r = 48;
  const c = 2 * Math.PI * r;
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  const target = (clamp(value) / 100) * c;
  /* THE ARC STARTS WHERE THE NUMBER DOES. Given a `from`, both travel the same
     distance over the same beat, so the ring and the figure read as one
     movement rather than two things that happen to change at once. */
  const start = typeof from === 'number' ? (clamp(from) / 100) * c : 0;

  // Starts empty, fills on the frame after mount so the transition has two
  // values to move between. Under reduced motion the CSS drops the transition
  // and this lands instantly, with no flash of an empty ring.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    /* The denominator sits UNDER the ring, not inside it. A bare "72" gives the
       reader no scale — the explanation never states the range either — but at
       display size the caption measured ~59px wide against a disc that is only
       ~51px across at that height, so inside the ring it printed over the arc.
       Below it, the figure stays the hero and the scale is still stated. */
    <div className="ringBlock">
      <div className="ring">
        <svg width="108" height="108" viewBox="0 0 108 108" aria-hidden="true" focusable="false">
        <circle cx="54" cy="54" r={r} fill="none" stroke="var(--color-surface-sunken)" strokeWidth="8" />
        <circle
          className="ring__arc"
          cx="54" cy="54" r={r} fill="none"
          stroke="var(--color-accent)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={drawn ? c - target : c - start}
        />
        </svg>
        <span className="ring__val num">
          {typeof from === 'number'
            ? <CountUp from={from} to={value} format={formatNumber} />
            : formatNumber(value)}
        </span>
      </div>
      <span className="ring__of">{t('dash.outOf100')}</span>
    </div>
  );
}

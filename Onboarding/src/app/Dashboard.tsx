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
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Plus, RefreshCw, Target } from 'lucide-react';
import { useI18n } from '../i18n';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { useOnboarding } from '../state/onboarding';
import { useAuth } from '../state/auth';
import { Button, Card, EmptyState, ErrorState, GapChip, LoadingBlock } from '../components/ui';
import { CareerGoal } from '../components/CareerGoal';
import type { Course } from '../api';
import { MatchCard } from '../components/MatchCard';
import { CourseCard } from '../components/CourseCard';
import { Journey } from '../components/Journey';
import { useRunInFlight } from '../components/PipelineProgress';

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

export function Dashboard() {
  const { t, locale, formatNumber } = useI18n();
  const api = useApi();
  const { profile } = useOnboarding();
  const { user } = useAuth();
  const { settled } = useOnboarding();
  const inFlight = useRunInFlight();
  // `settled` in the deps is what makes the page fill itself in: the dashboard
  // reads the FINISHED run, so it has to re-fetch the moment one exists rather
  // than making the user reload a page that was correct when it loaded.
  const { data, loading, error, reload } = useAsync((s) => api.getDashboard(s),
                                                   [api, locale, settled]);
  /**
   * Courses are their own request because `DashboardData` does not carry them.
   * Its failure is deliberately NOT the page's failure: the dashboard is still
   * worth reading without a course shelf, so this section simply does not render
   * rather than taking the readiness score down with it.
   */
  const { data: courses } = useAsync((s) => api.getCourses(s), [api, locale, settled]);
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
                                                          [api, locale, settled]);

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
   * THE GOAL CHANGED AND THE NUMBERS DID NOT.
   *
   * `PUT /api/profile` deliberately does not re-run the pipeline — correcting a
   * birth date is no reason to re-match. But the readiness score, the journey
   * and every job match ARE measured against the target role, so changing it
   * leaves all three quietly computed for a goal the user has abandoned. The
   * screen refetched and got the same stale numbers back, which looked like
   * nothing had happened because, on the server, nothing had.
   *
   * The re-match is NOT fired automatically. It spends a scarce weekly credit,
   * and someone fixing a typo in their job title must not lose their week to
   * it. So the staleness is stated, the cost is stated, and the user decides.
   *
   * Session-scoped: a reload forgets it. Knowing that results predate a profile
   * edit is genuinely the server's to answer — see the note added to BACKEND.md.
   */
  const [staleGoal, setStaleGoal] = useState<string | null>(null);
  const [rematch, setRematch] = useState<'idle' | 'starting' | 'failed' | 'running'>('idle');
  const { watchJob } = useOnboarding();

  const startRematch = useCallback(async () => {
    setRematch('starting');
    try {
      const { jobId } = await api.rerunMatching();
      // Hand it to the poll so the bar, `settled` and the refetch all follow.
      watchJob(jobId);
      setStaleGoal(null);
      setRematch('running');
    } catch {
      // Almost always "no credit left this week", which is what the copy says.
      setRematch('failed');
    }
  }, [api, watchJob]);
  /**
   * Same in-place replacement the courses page has, for the two cards shown
   * here. See the longer note in Courses.tsx — the point is that rejecting a
   * course must not throw the user off the dashboard they were reading.
   */
  const [editedCourses, setEditedCourses] = useState<Course[] | null>(null);
  useEffect(() => { setEditedCourses(null); }, [courses]);
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

  const topCourses = (editedCourses ?? courses ?? []).slice(0, CARDS_SHOWN);
  const topMatches = data.topMatches.slice(0, CARDS_SHOWN);

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

      {/* 1. Where you stand. */}
      <section aria-labelledby="dash-readiness">
        {/* The page's one expressive surface — see the depth block in app.css.
            Everything below this stays product register. */}
        <Card className="card--anchor">
          <div className="readiness">
            <Ring value={data.readiness} />
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
              <p>{data.readinessNote}</p>

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

              {/* The goal moved, so the numbers above it are about the old one.
                  Same well as the no-goal case: it is the same class of problem,
                  a score that is not about what the user thinks it is about. */}
              {staleGoal && rematch !== 'running' && (
                <div className="nogoal">
                  <div className="nogoal__what">
                    <p>{t('dash.goalStale', { role: staleGoal })}</p>
                    {/* The cost, before the tap that spends it. */}
                    <p className="text-sm muted">{t('dash.goalRematchCost')}</p>
                    {rematch === 'failed' && (
                      <p className="text-sm" role="alert">{t('dash.goalRematchFail')}</p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    onClick={startRematch}
                    loading={rematch === 'starting'}
                  >
                    <RefreshCw size={15} aria-hidden="true" />
                    {t('dash.goalRematch')}
                  </Button>
                </div>
              )}
              {rematch === 'running' && (
                <p className="text-sm" role="status" aria-live="polite">
                  {t('dash.goalRematchGo')}
                </p>
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
              onSaved={(nextRole, changed) => {
                reloadProfile();
                reload();
                // Only when the role actually MOVED. Saving the same string,
                // or clearing it, is not a reason to offer a re-match.
                if (changed && nextRole) { setStaleGoal(nextRole); setRematch('idle'); }
              }}
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
                <span className="skills__count num">
                  {t('dash.yourSkillsCount', { n: formatNumber(data.standings.length) })}
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
                          <span className="skill__name"><bdi>{s.name}</bdi></span>
                          <span className="skill__state" data-held={s.held || undefined}>
                            {s.held
                              ? <><Check size={14} aria-hidden="true" />{t('dash.held')}</>
                              : <><Plus size={14} aria-hidden="true" />{t('dash.toUnlock')}</>}
                          </span>
                        </div>
                        <Meter value={s.level} />
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
      <Journey stages={data.journey} target={target} />

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
            <h3 className="card__title">{data.nextStep.title}</h3>
            <p>{data.nextStep.body}</p>
            <div className="row" style={{ marginBlockStart: 'var(--space-2)' }}>
              {/* Was labelled "See all courses", the same string as the section
                  link above it — two different destinations wearing one name. */}
              <Link className="btn btn--primary" to={`/${data.nextStep.action}`}>
                {t('dash.startNextStep')}
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
        {topMatches.length === 0 ? (
          <Card>
            <EmptyState
              title={t('dash.emptyMatches')}
              body={t('dash.emptyMatchesSub')}
              action={<Link className="btn btn--primary" to="/upload">{t('dash.addDoc')}</Link>}
            />
          </Card>
        ) : (
          <div className="grid grid--2">
            {topMatches.map((j) => <MatchCard key={j.id} job={j} />)}
          </div>
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
 * A skill meter.
 *
 * Animates `transform: scaleX`, never `inline-size`: width is a layout property
 * and animating it re-runs layout on every frame, which the motion skill's
 * performance floor rules out. The fill grows from the reading-start edge, so it
 * mirrors correctly in Arabic.
 *
 * `role="meter"` with the ARIA value attributes, because the level was previously
 * visible only as a coloured bar — a screen reader was told a skill existed but
 * never how well it was evidenced.
 */
function Meter({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      /* `meter--level` distinguishes this from the pipeline's progress bar,
         which is the same class. When a run is in flight the identical 6px gold
         bar appeared in the banner meaning "OCR is 40% done" and here meaning
         "you are 40% evidenced in SQL" — one shape, two unrelated meanings. */
      className="meter meter--level"
      role="meter"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i style={{ transform: `scaleX(${pct / 100})` }} />
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
function Ring({ value }: { value: number }) {
  const { t, formatNumber } = useI18n();
  const r = 48;
  const c = 2 * Math.PI * r;
  const target = (Math.min(100, Math.max(0, value)) / 100) * c;

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
          strokeDashoffset={drawn ? c - target : c}
        />
        </svg>
        <span className="ring__val num">{formatNumber(value)}</span>
      </div>
      <span className="ring__of">{t('dash.outOf100')}</span>
    </div>
  );
}

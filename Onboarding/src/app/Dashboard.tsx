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
 * VOLUME — every list on this page is capped. Skills collapse to the first four,
 * courses and jobs show two each with a way through to the full page. A
 * dashboard's job is to be read in one screen and acted on; a complete inventory
 * of everything the pipeline produced is what the dedicated pages are for.
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
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { useOnboarding } from '../state/onboarding';
import { useAuth } from '../state/auth';
import { Card, CapabilityChip, EmptyState, ErrorState, GapChip, LoadingBlock } from '../components/ui';
import { MatchCard } from '../components/MatchCard';
import { CourseCard } from '../components/CourseCard';
import { Journey } from '../components/Journey';
import { useRunInFlight } from '../components/PipelineProgress';

/** How much of each list the dashboard shows before handing off to its page. */
const SKILLS_SHOWN = 4;
const CARDS_SHOWN = 2;

export function Dashboard() {
  const { t, locale } = useI18n();
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

  const [showAllSkills, setShowAllSkills] = useState(false);

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
  if (loading && !data) return <DashboardSkeleton />;
  // The dashboard 404s until the pipeline's second half lands, and rendering an
  // error for that told a working product's users it was broken.
  if ((error || !data) && inFlight) {
    return <Card><EmptyState title={t('state.workingTitle')} body={t('state.workingSub')} /></Card>;
  }
  if (error || !data) return <ErrorState onRetry={reload} />;

  const standings = showAllSkills ? data.standings : data.standings.slice(0, SKILLS_SHOWN);
  const hiddenSkills = Math.max(0, data.standings.length - SKILLS_SHOWN);
  const topCourses = (courses ?? []).slice(0, CARDS_SHOWN);
  const topMatches = data.topMatches.slice(0, CARDS_SHOWN);

  return (
    // `seq` staggers the direct children in, rather than the old single fade on
    // the whole page. A page that arrives as one block tells the eye nothing
    // about where to begin; one that assembles top-down does.
    <div className="stack stack--page seq" aria-busy={loading || undefined}>
      <header className="stack stack--sm">
        <h1 className="headline">{t('dash.greeting', { name: firstName })}</h1>
        <p className="subhead">{t('dash.sub')}</p>
      </header>

      {/* 1. Where you stand. */}
      <section aria-labelledby="dash-readiness">
        <Card>
          <div className="readiness">
            <Ring value={data.readiness} />
            {/* `min(16rem, 100%)`, not a bare 16rem. The bare value is a hard
                floor: on a 320px phone the card's content box is 215px, the
                block refused to go under 256, and the readiness sentence — the
                first thing on the first screen — hung 16px outside the card. */}
            <div className="stack stack--sm" style={{ flex: 1, minWidth: 'min(16rem, 100%)' }}>
              <h2 className="section__title" id="dash-readiness">{t('dash.readiness')}</h2>
              <p>{data.readinessNote}</p>
              <details>
                <summary className="disclosure">{t('dash.readinessHow')}</summary>
                <p className="text-sm muted" style={{ marginBlockStart: 'var(--space-2)' }}>
                  {t('dash.readinessHowBody')}
                </p>
              </details>
            </div>
          </div>

          <hr className="divider" style={{ marginBlock: 'var(--space-6)' }} />

          <ul className="stack" aria-label={t('dash.skillsLabel')}>
            {standings.map((s) => (
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

          {/* Collapsed by default. A pipeline that read a full transcript can
              return twenty of these, and twenty meters is a data table wearing a
              dashboard's clothes — it buries everything below it. A real button
              rather than <details>, so the count is in the accessible name and
              the state is announced. */}
          {hiddenSkills > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => setShowAllSkills((v) => !v)}
              aria-expanded={showAllSkills}
            >
              {showAllSkills
                ? t('dash.showFewerSkills')
                : t('dash.showAllSkills', { n: String(hiddenSkills) })}
              <ChevronDown size={16} aria-hidden="true" className="chevron" data-open={showAllSkills || undefined} />
            </button>
          )}
        </Card>
      </section>

      {/* 2. The skills already carrying the most weight. */}
      <section className="stack" aria-labelledby="dash-strengths">
        <div className="section__head">
          <h2 className="section__title" id="dash-strengths">{t('dash.strengths')}</h2>
          <span className="section__note">{t('dash.strengthsSub')}</span>
        </div>
        {/* Guarded. An unguarded map renders an orphan heading over blank space
            for the user whose transcript yielded little — precisely the user who
            most needs to be told what to do about it. */}
        {data.strengths.length > 0 ? (
          <div className="chips">
            {data.strengths.map((s) => <CapabilityChip key={s}>{s}</CapabilityChip>)}
          </div>
        ) : (
          <p className="text-sm muted">{t('dash.noStrengths')}</p>
        )}
      </section>

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
            {data.gaps.map((g) => <GapChip key={g}>{g}</GapChip>)}
          </div>
        ) : (
          <p className="text-sm muted">{t('dash.noGaps')}</p>
        )}

        {topCourses.length > 0 && (
          <div className="grid grid--2">
            {topCourses.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        )}

        {/* The single most important thing on the page: one named action. It is
            the only primary button here, so the three "see all" links cannot
            compete with it. */}
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

      {/* 4. How far along you are — the bridge to the destination below. */}
      <Journey stages={data.journey} />

      {/* 5. The destination, last: real postings, each checkable at its source. */}
      <section className="stack" aria-labelledby="dash-matches">
        <div className="section__head">
          <h2 className="section__title" id="dash-matches">{t('dash.matches')}</h2>
          <span className="spacer" />
          <Link className="btn btn--ghost btn--sm" to="/jobs">
            {t('dash.seeAllJobs')}
            <ArrowRight size={16} aria-hidden="true" className="go" />
          </Link>
        </div>
        <p className="section__note">{t('dash.matchesSub')}</p>
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
function DashboardSkeleton() {
  return (
    <div className="stack stack--page" aria-hidden="true">
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
      {/* The denominator is not decoration. Shown a bare "62", nobody can tell
          whether that is good, and the explanation underneath never states the
          range either. It is a separate, quieter span so the figure still reads
          as one number rather than as a fraction. */}
      <span className="ring__val num">
        {formatNumber(value)}
        <span className="ring__of">{t('dash.outOf100')}</span>
      </span>
    </div>
  );
}

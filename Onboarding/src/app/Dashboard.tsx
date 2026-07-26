/**
 * The dashboard.
 *
 * Order, as specified: where you stand, then the skills worth having, then
 * what to learn, then the job postings.
 *
 * The one thing kept from the capability-first argument is the framing rather
 * than the sequence. The readiness number never appears alone — it carries a
 * plain sentence and a "how this is worked out" disclosure, because a figure
 * the user cannot interrogate is exactly what loses a skeptical reader. And
 * gaps stay "to unlock" with a plus icon rather than a deficit in a danger
 * hue: a graduate who reads the first screen as a list of failures closes the
 * tab, and nothing below it gets seen.
 *
 * Hud is deliberately absent from this whole page: the brand locks the mascot
 * out of verdicts, scores, real matches and data tables, all of which are here.
 */
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Plus } from 'lucide-react';
import { useI18n } from '../i18n';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { useOnboarding } from '../state/onboarding';
import { useAuth } from '../state/auth';
import { Card, CapabilityChip, EmptyState, ErrorState, GapChip, LoadingBlock } from '../components/ui';
import { MatchCard } from '../components/MatchCard';

export function Dashboard() {
  const { t, locale } = useI18n();
  const api = useApi();
  const { profile } = useOnboarding();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync((s) => api.getDashboard(s), [api, locale]);

  // The account is the source of truth for who this is: the onboarding profile
  // only exists in the session that ran onboarding, so a returning user has
  // none, and reading it first would greet them by the brand's own name.
  const firstName = (user?.fullName || profile?.fullName || '').trim().split(/\s+/)[0] || '';

  if (loading) return <Card><LoadingBlock rows={5} /></Card>;
  if (error || !data) return <ErrorState onRetry={reload} />;

  return (
    <div className="stack stack--lg enter">
      <header className="stack stack--sm">
        <h1 className="headline">{t('dash.greeting', { name: firstName })}</h1>
        <p className="subhead">{t('dash.sub')}</p>
      </header>

      {/* 1. Where you stand. */}
      <section>
        <Card>
          <div className="readiness">
            <Ring value={data.readiness} />
            <div className="stack stack--sm" style={{ flex: 1, minWidth: '16rem' }}>
              <h2 className="section__title">{t('dash.readiness')}</h2>
              <p>{data.readinessNote}</p>
              <details>
                <summary className="disclosure">{t('dash.readinessHow')}</summary>
                <p className="text-sm" style={{ marginBlockStart: 'var(--space-2)' }}>
                  {t('dash.readinessHowBody')}
                </p>
              </details>
            </div>
          </div>

          <hr className="divider" style={{ marginBlock: 'var(--space-6)' }} />

          <ul className="stack">
            {data.standings.map((s) => (
              <li key={s.name} className="skill">
                <div className="skill__head">
                  <span className="skill__name"><bdi>{s.name}</bdi></span>
                  <span className="skill__state">
                    {s.held
                      ? <><Check size={14} aria-hidden="true" />{t('dash.held')}</>
                      : <><Plus size={14} aria-hidden="true" />{t('dash.toUnlock')}</>}
                  </span>
                </div>
                <div className="meter">
                  <i style={{ inlineSize: `${Math.round(s.level * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* 2. The skills already carrying the most weight. */}
      <section className="stack">
        <div className="section__head">
          <h2 className="section__title">{t('dash.strengths')}</h2>
          <span className="section__note">{t('dash.strengthsSub')}</span>
        </div>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {data.strengths.map((s) => <CapabilityChip key={s}>{s}</CapabilityChip>)}
        </div>
      </section>

      {/* 3. What to learn next, with the way through to the courses. */}
      <section className="stack">
        <div className="section__head">
          <h2 className="section__title">{t('dash.gaps')}</h2>
          <span className="spacer" />
          <Link className="btn btn--ghost" to="/courses">
            {t('dash.viewAllCourses')}
            <ArrowRight size={16} aria-hidden="true" className="choice__go" />
          </Link>
        </div>
        <p className="section__note">{t('dash.gapsSub')}</p>
        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {data.gaps.map((g) => <GapChip key={g}>{g}</GapChip>)}
        </div>

        <Card className="card--sunken">
          <div className="stack stack--sm">
            <span className="eyebrow">{t('dash.next')}</span>
            <h3 className="section__title">{data.nextStep.title}</h3>
            <p>{data.nextStep.body}</p>
            <div className="row" style={{ marginBlockStart: 'var(--space-2)' }}>
              <Link className="btn btn--primary" to={`/${data.nextStep.action}`}>
                {t('dash.viewAllCourses')}
              </Link>
            </div>
          </div>
        </Card>
      </section>

      {/* 4. The destination: real postings, each checkable at its source. */}
      <section className="stack">
        <div className="section__head">
          <h2 className="section__title">{t('dash.matches')}</h2>
          <span className="spacer" />
          <Link className="btn btn--ghost" to="/jobs">
            {t('dash.viewAllJobs')}
            <ArrowRight size={16} aria-hidden="true" className="choice__go" />
          </Link>
        </div>
        <p className="section__note">{t('dash.matchesSub')}</p>
        {data.topMatches.length === 0 ? (
          <Card>
            <EmptyState
              title={t('dash.emptyMatches')}
              body={t('dash.emptyMatchesSub')}
              action={<Link className="btn btn--primary" to="/upload">{t('dash.addDoc')}</Link>}
            />
          </Card>
        ) : (
          <div className="grid grid--2">
            {data.topMatches.map((j) => <MatchCard key={j.id} job={j} />)}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Readiness ring. The arc is decorative; the number and the sentence beside it
 * carry the meaning, so nothing is lost if colour cannot be perceived.
 */
function Ring({ value }: { value: number }) {
  const { formatNumber } = useI18n();
  const r = 48;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, value)) / 100) * c;

  return (
    <div className="ring">
      <svg width="108" height="108" viewBox="0 0 108 108" aria-hidden="true" focusable="false">
        <circle cx="54" cy="54" r={r} fill="none" stroke="var(--color-surface-sunken)" strokeWidth="8" />
        <circle
          cx="54" cy="54" r={r} fill="none"
          stroke="var(--color-accent)" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <span className="ring__val num">{formatNumber(value)}</span>
    </div>
  );
}

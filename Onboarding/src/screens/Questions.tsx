/**
 * Screen 3 — direction, asked while the document is being read.
 *
 * This is the best idea in the sketches and it is kept: the four agents take
 * real time, and a user staring at a progress bar is a user deciding whether
 * to close the tab. Asking something useful during the wait converts dead time
 * into signal, and by the time the answers are given the reading is usually
 * finished. The wait effectively costs nothing.
 *
 * Changes from the sketch:
 *  - The sketch asked one open ended question. A blank box is the highest
 *    effort input there is, and this user may be demoralised and on a phone.
 *    Selectable interests come first (recognition rather than recall), with
 *    the free text kept as an optional elaboration for people who want it.
 *  - Everything here is skippable. The answers only re-rank results; refusing
 *    to answer must never block someone from their own transcript.
 *  - Continue is never blocked on the pipeline. If the reading is still
 *    running the user may move on, and the confirmation screen shows its own
 *    loading state. Trapping someone behind a spinner they did not ask for is
 *    the thing this screen exists to avoid.
 *  - Failure is non destructive: the answers survive, and the user is offered
 *    another file or the manual route.
 */
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useOnboarding } from '../state/onboarding';
import { Button, Callout, Chip, TextField } from '../components/ui';
import { HudGuide } from '../components/HudGuide';
import { SiteHeader } from '../components/SiteHeader';

const INTERESTS = [
  'tech', 'data', 'engineering', 'business', 'finance',
  'health', 'education', 'design', 'energy', 'public',
] as const;

export function Questions() {
  const { t, formatNumber } = useI18n();
  const navigate = useNavigate();
  const {
    interests, toggleInterest, notes, setNotes,
    analysis, settled, failed, entry,
  } = useOnboarding();

  const pct = Math.round((analysis?.progress ?? 0) * 100);
  const reading = entry === 'document' && !settled;
  const done = entry === 'document' && settled && !failed;

  return (
    <div className="ob">
      <SiteHeader step={1} />
      <main className="ob__main" id="main">
        <div className="stage stage--split enter">
          <aside className="stage__aside">
            {/* His pose tracks the pipeline: analysing while it runs, erroring
                if it fails, celebrating when it lands. */}
            <HudGuide
              pose={failed ? 'error' : done ? 'celebrating' : 'analyzing'}
              says={failed ? t('questions.failed') : done ? t('questions.readingDone') : t('questions.hud')}
              eager
            />
          </aside>

          <div className="stage__content">
            {/* Pipeline status. Announced politely so it reaches a screen
                reader without stealing focus from the question below. */}
            {entry === 'document' && !failed && (
              <div className="card card--sunken" role="status" aria-live="polite">
                <div className="stack stack--sm">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                      {done ? t('questions.readingDone') : t('questions.reading')}
                    </span>
                    <span className="text-sm muted num">{formatNumber(pct)}%</span>
                  </div>
                  <div className="meter">
                    <i style={{ inlineSize: `${pct}%` }} />
                  </div>
                </div>
              </div>
            )}

            {failed && (
              <Callout tone="danger">
                <div className="stack stack--sm">
                  <strong>{t('questions.failed')}</strong>
                  <p>{t('questions.failedHelp')}</p>
                  <div className="row">
                    <Button variant="secondary" onClick={() => navigate('/upload')}>
                      {t('questions.reupload')}
                    </Button>
                    <Button variant="ghost" onClick={() => navigate('/confirm')}>
                      {t('questions.manual')}
                    </Button>
                  </div>
                </div>
              </Callout>
            )}

            <div className="stack stack--sm">
              <span className="eyebrow">{t('questions.eyebrow')}</span>
              <h1 className="headline">{t('questions.title')}</h1>
              <p className="subhead">{t('questions.sub')}</p>
            </div>

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field__label" style={{ marginBlockEnd: 'var(--space-3)' }}>
                {t('questions.pickHint')}
              </legend>
              <div className="row" style={{ gap: 'var(--space-2)' }}>
                {INTERESTS.map((id) => (
                  <Chip
                    key={id}
                    selected={interests.includes(id)}
                    onToggle={() => toggleInterest(id)}
                  >
                    {t(`interest.${id}`)}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <TextField
              label={t('questions.freeLabel')}
              placeholder={t('questions.freePlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />

            {reading && <p className="text-sm muted">{t('questions.waiting')}</p>}

            <div className="row">
              <Button variant="secondary" onClick={() => navigate('/upload')}>
                {t('action.back')}
              </Button>
              <Button onClick={() => navigate('/confirm')}>{t('questions.cta')}</Button>
              <button type="button" className="btn btn--ghost" onClick={() => navigate('/confirm')}>
                {t('questions.skip')}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

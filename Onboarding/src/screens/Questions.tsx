/**
 * Step 2 — four questions about the work they want, asked one at a time,
 * while the documents are being read.
 *
 * The parallel wait is the best idea in the original sketches and it is kept:
 * four agents take real time, and a user watching a progress bar is a user
 * deciding whether to close the tab. Asking something useful during that wait
 * turns dead time into signal, and by the time the answers are given the
 * reading has usually finished.
 *
 * One question per screen rather than a single long form. Each question is a
 * different kind of decision, and stacking them makes the screen read as
 * paperwork; alone, each is a two second answer. The cost is more steps, which
 * is why the count is stated up front and every question can be skipped.
 *
 * Choice questions advance on selection. There is no Continue to hunt for and
 * no second tap to confirm something already decided; Back is always there,
 * and the selection stays visible so a change of mind is one tap. The open
 * question needs Continue, because there is no moment a machine can call "done
 * typing".
 *
 * Nothing here blocks anything. The answers only re-rank results, so refusing
 * to answer must never stand between someone and their own transcript.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useOnboarding } from '../state/onboarding';
import type { Preferences } from '../api';
import { Button, Callout, TextField } from '../components/ui';
import { HudGuide } from '../components/HudGuide';
import { SiteHeader } from '../components/SiteHeader';

/** Each question names the field it fills, so answers cannot drift from state. */
type ChoiceQuestion = {
  kind: 'choice';
  field: 'coursePricing' | 'workArrangement' | 'openToOtherRoles';
  options: string[];
};
type TextQuestion = { kind: 'text'; field: 'preferredRole' };
type Question = (ChoiceQuestion | TextQuestion) & { id: string };

const QUESTIONS: Question[] = [
  { id: 'coursePricing', kind: 'choice', field: 'coursePricing', options: ['free', 'any'] },
  { id: 'workArrangement', kind: 'choice', field: 'workArrangement', options: ['remote', 'hybrid', 'onsite'] },
  { id: 'preferredRole', kind: 'text', field: 'preferredRole' },
  { id: 'openToOtherRoles', kind: 'choice', field: 'openToOtherRoles', options: ['yes', 'no'] },
];

export function Questions() {
  const { t, formatNumber } = useI18n();
  const navigate = useNavigate();
  const { preferences, setPreference, analysis, settled, failed, entry } = useOnboarding();
  const [index, setIndex] = useState(0);

  const q = QUESTIONS[index];
  const isLast = index === QUESTIONS.length - 1;
  /**
   * Null progress means the server reports none — the pipeline runs inside one
   * synchronous request, so there is nothing to report until it finishes. The
   * meter goes indeterminate rather than sitting at 0%, which reads as stalled.
   */
  const pct = analysis?.progress == null ? null : Math.round(analysis.progress * 100);
  const reading = entry === 'document' && !settled;
  const done = entry === 'document' && settled && !failed;

  const goNext = () => (isLast ? navigate('/confirm') : setIndex((i) => i + 1));
  const goBack = () => (index === 0 ? navigate('/upload') : setIndex((i) => i - 1));

  const choose = (value: string) => {
    setPreference(q.field as keyof Preferences, value as never);
    // A beat so the selection is seen before the screen moves on.
    window.setTimeout(goNext, 220);
  };

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
                reader without stealing focus from the question. */}
            {entry === 'document' && !failed && (
              <div className="card card--sunken" role="status" aria-live="polite">
                <div className="stack stack--sm">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="text-sm" style={{ fontWeight: 'var(--weight-medium)' }}>
                      {done ? t('questions.readingDone') : t('questions.reading')}
                    </span>
                    {pct !== null && <span className="text-sm num">{formatNumber(pct)}%</span>}
                  </div>
                  {/* Determinate when the server gives a number, indeterminate
                      when it cannot. Never a fabricated bar. */}
                  <div
                    className={`meter${pct === null && !done ? ' meter--indeterminate' : ''}`}
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    {...(pct === null ? {} : { 'aria-valuenow': done ? 100 : pct })}
                    aria-label={done ? t('questions.readingDone') : t('questions.reading')}
                  >
                    <i style={pct === null ? undefined : { inlineSize: `${done ? 100 : pct}%` }} />
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
              <span className="eyebrow">
                {t('questions.counter', {
                  current: formatNumber(index + 1),
                  total: formatNumber(QUESTIONS.length),
                })}
              </span>
              {/* key remounts the heading so a screen reader re-reads the new
                  question rather than leaving focus on stale text. */}
              <h1 className="headline" key={q.id}>{t(`q.${q.id}.title`)}</h1>
              <p className="subhead">{t(`q.${q.id}.help`)}</p>
            </div>

            {q.kind === 'choice' ? (
              <div className="stack" role="group" aria-label={t(`q.${q.id}.title`)}>
                {q.options.map((opt) => {
                  const selected = preferences[q.field] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      className="choice"
                      aria-pressed={selected}
                      onClick={() => choose(opt)}
                    >
                      <span className="choice__label">
                        {t(`q.${q.id}.opt.${opt}`)}
                        <span className="choice__sub">{t(`q.${q.id}.optHelp.${opt}`)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <TextField
                label={t(`q.${q.id}.label`)}
                placeholder={t(`q.${q.id}.placeholder`)}
                value={preferences.preferredRole}
                onChange={(e) => setPreference('preferredRole', e.target.value)}
                rows={2}
              />
            )}

            {reading && <p className="text-sm muted">{t('questions.waiting')}</p>}

            <div className="row">
              <Button variant="secondary" onClick={goBack}>{t('action.back')}</Button>
              {/* Choice questions advance themselves, so Continue would be a
                  second way to do the same thing. It appears only where the
                  user has to say when they are finished. */}
              {q.kind === 'text' && (
                <Button onClick={goNext}>{t('questions.cta')}</Button>
              )}
              <button type="button" className="btn btn--ghost" onClick={goNext}>
                {t('questions.skip')}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

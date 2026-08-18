/**
 * Step 2 — a few questions about the work they want, asked one at a time,
 * while the documents are being read.
 *
 * FIVE OR THREE, depending on one answer. The middle question asks whether they
 * know what job they want at all; "not yet" makes the two questions after it
 * meaningless, so they are not asked and the flow ends early, handing the user
 * to Hud. See the note above QUESTIONS.
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
 * to answer must never stand between someone and their own documents.
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
  field: 'coursePricing' | 'workArrangement' | 'knowsRole' | 'openToOtherRoles';
  options: string[];
};
type TextQuestion = { kind: 'text'; field: 'preferredRole' };
type Question = (ChoiceQuestion | TextQuestion) & { id: string };

/**
 * THE FORK SITS BEFORE THE ROLE QUESTION, and that order is the point.
 *
 * "What job are you looking for?" is a question that assumes an answer exists.
 * Asked of a final year student who genuinely does not know, it is not a
 * question, it is a small failure — and the honest answer, a blank field, is
 * indistinguishable from not bothering. Asking whether they know FIRST turns
 * "I do not know" from a non-answer into a route: the remaining questions are
 * about a role they have not chosen, so they are not asked, and the flow ends
 * with Hud rather than with a dashboard measuring progress towards nothing.
 */
const QUESTIONS: Question[] = [
  { id: 'coursePricing', kind: 'choice', field: 'coursePricing', options: ['free', 'any'] },
  { id: 'workArrangement', kind: 'choice', field: 'workArrangement', options: ['remote', 'hybrid', 'onsite'] },
  { id: 'knowsRole', kind: 'choice', field: 'knowsRole', options: ['yes', 'no'] },
  { id: 'preferredRole', kind: 'text', field: 'preferredRole' },
  { id: 'openToOtherRoles', kind: 'choice', field: 'openToOtherRoles', options: ['yes', 'no'] },
];

/** The questions that still apply, given what has been answered so far. */
const flowFor = (knowsRole: Preferences['knowsRole']) => QUESTIONS.filter((q) => (
  // Both of the remaining questions are ABOUT a named role. With no role named
  // they have nothing to be about, so they are dropped rather than asked and
  // ignored — which is also what keeps the counter honest.
  q.id === 'preferredRole' || q.id === 'openToOtherRoles'
    ? knowsRole !== 'no'
    : true
));

export function Questions() {
  const { t, formatNumber } = useI18n();
  const navigate = useNavigate();
  const { preferences, setPreference, ready, failed, entry } = useOnboarding();
  const [index, setIndex] = useState(0);

  const flow = flowFor(preferences.knowsRole);
  /**
   * Clamped, because the flow can SHRINK under the index: answering "not yet"
   * drops the last two questions, and coming back from the confirm screen would
   * otherwise land on an index the list no longer has.
   */
  const at = Math.min(index, flow.length - 1);
  const q = flow[at];
  const isLast = at === flow.length - 1;
  // `ready`, not `settled`: what this screen is waiting on is Agent A's reading.
  // Agent C and Agent E do not start until the user confirms, so waiting for the
  // whole pipeline here would wait for something that cannot happen yet.
  const done = entry === 'document' && ready && !failed;

  const goNext = () => (isLast ? navigate('/confirm') : setIndex(at + 1));
  const goBack = () => (at === 0 ? navigate('/upload') : setIndex(at - 1));

  const choose = (value: string) => {
    setPreference(q.field as keyof Preferences, value as never);
    // A beat so the selection is seen before the screen moves on.
    window.setTimeout(() => {
      /**
       * "Not yet" ends the questions here.
       *
       * It goes to CONFIRM, not straight to chat, and that is a deliberate
       * departure from a literal reading of "finish the onboarding flow at that
       * point". Confirm is not another question — it is where the user checks
       * what was read from their documents and gives consent, and it is the call
       * that flips the account to onboarded and starts the second half of the
       * pipeline. Skipping it would leave an account that the route guards send
       * straight back to /upload, with no profile, no consent and a run that
       * never finishes. What the user is spared is the questions, which is what
       * was actually being asked for; Confirm then hands them to Hud rather than
       * to the dashboard.
       */
      if (q.id === 'knowsRole' && value === 'no') { navigate('/confirm'); return; }
      goNext();
    }, 220);
  };

  return (
    <div className="ob">
      <SiteHeader step={1} />
      <main className="ob__main" id="main" tabIndex={-1}>
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
              {/* Counts the questions this user will ACTUALLY be asked, so
                  answering "not yet" shortens the total rather than leaving a
                  promise of two more that never arrive. */}
              <span className="eyebrow">
                {t('questions.counter', {
                  current: formatNumber(at + 1),
                  total: formatNumber(flow.length),
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

            {/* NOT `muted`. This is the only line telling the user the pipeline
                is still alive while they answer; it is system status, not a
                footnote. */}
            {!done && <p className="text-sm">{t('questions.waiting')}</p>}

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

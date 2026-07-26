/**
 * Onboarding progress.
 *
 * Three steps, not four: choosing a language is a preference, not work, so the
 * welcome screen sits outside the count. Showing "step 1 of 4" before the user
 * knows what the product does adds noise to a single-decision screen, and a
 * shorter honest count reads as less commitment.
 *
 * Segments rather than a single bar: a discrete count answers "how much is
 * left" at a glance, which is the only question this element exists to answer.
 */
import { useI18n } from '../i18n';

export const STEP_KEYS = ['step.upload', 'step.questions', 'step.confirm'] as const;
export type StepIndex = 0 | 1 | 2;

export function Steps({ current }: { current: StepIndex }) {
  const { t } = useI18n();
  const total = STEP_KEYS.length;
  const name = t(STEP_KEYS[current]);
  const label = t('step.progress', { current: current + 1, total, name });

  return (
    <div className="steps">
      {/* One accessible announcement; the segments themselves are decorative. */}
      <ol
        className="steps__list"
        role="group"
        aria-label={label}
      >
        {STEP_KEYS.map((key, i) => (
          <li
            key={key}
            className="steps__seg"
            data-state={i < current ? 'done' : i === current ? 'current' : 'todo'}
          >
            <i />
          </li>
        ))}
      </ol>
      <span className="steps__label num">{current + 1}/{total}</span>
      <span className="sr-only" aria-live="polite">{label}</span>
    </div>
  );
}

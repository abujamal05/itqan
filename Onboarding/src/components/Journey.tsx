/**
 * The user's journey through the product, and where they are in it.
 *
 * This answers one question — "how far along am I, and what comes next" — and
 * it answers it from the service, not from which screen was last opened: a
 * stage is done when the work finished, not when a page was visited.
 *
 * Three states, and none of them is carried by colour alone. Done has a check,
 * current has a filled ring plus `aria-current`, upcoming is an open outline;
 * each also states its condition in words underneath. That matters more here
 * than usual, because a progress track drawn only in gold and grey is exactly
 * the kind of thing that vanishes for a colour-blind reader.
 *
 * It sits at the end of the dashboard, where the original design had it: it is
 * orientation rather than an action, and putting it above the day's actual
 * content would push the work down the page to make room for a status bar.
 */
import { Check } from 'lucide-react';
import { useI18n } from '../i18n';
import type { JourneyStage } from '../api';

export function Journey({ stages }: { stages: JourneyStage[] }) {
  const { t } = useI18n();
  if (stages.length === 0) return null;

  const current = stages.findIndex((s) => s.state === 'current');
  const done = stages.filter((s) => s.state === 'done').length;

  return (
    <section className="stack">
      <div className="section__head">
        <h2 className="section__title">{t('journey.title')}</h2>
        <span className="section__note">
          {t('journey.progress', {
            done: String(done),
            total: String(stages.length),
          })}
        </span>
      </div>

      <ol className="journey">
        {stages.map((s, i) => (
          <li
            key={s.id}
            className="journey__stage"
            data-state={s.state}
            /* The one stage a screen reader should land on as "you are here". */
            aria-current={s.state === 'current' ? 'step' : undefined}
          >
            {/* The connector is drawn on the item, not between items, so it
                mirrors with direction for free and never orphans at the end. */}
            {i > 0 && <span className="journey__line" aria-hidden="true" />}

            <span className="journey__marker">
              {s.state === 'done'
                ? <Check size={16} aria-hidden="true" />
                : <span className="journey__dot" aria-hidden="true" />}
            </span>

            <span className="journey__label">{s.label}</span>
            {s.detail && <span className="journey__detail">{s.detail}</span>}
            {/* Spoken, never drawn: the visual state is already obvious. */}
            <span className="sr-only">{t(`journey.state.${s.state}`)}</span>
          </li>
        ))}
      </ol>

      {current === -1 && done === stages.length && (
        <p className="text-sm">{t('journey.complete')}</p>
      )}
    </section>
  );
}

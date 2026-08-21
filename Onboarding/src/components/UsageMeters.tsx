/**
 * What this person has used of their AI allowance.
 *
 * THE NUMBER IS THE POINT, and the bar is a second reading of it. A meter on
 * its own tells a job seeker how full a rectangle is; "22 of 30" tells them
 * whether they can keep going today. So the figure leads, the bar supports it,
 * and the reset line says when it comes back — because "none left" is only
 * frightening until you know it is a few hours.
 *
 * Two counters, on two clocks: rescans reset weekly, messages daily. They are
 * not summed into a single "AI usage" percentage, which would be a number that
 * means nothing — half of one allowance and none of another is not 25% of
 * anything.
 *
 * Product register: precise and quiet. No celebration at low usage, no alarm at
 * high usage. A spent allowance is stated, not warned about — this is the
 * user's own account, not a limit they broke.
 */
import { FileText, MessageSquare } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Usage, UsageCounter } from '../api';

function Meter({
  label,
  icon: Icon,
  counter,
}: {
  label: string;
  icon: typeof FileText;
  counter: UsageCounter;
}) {
  const { t, formatNumber, formatDate } = useI18n();

  /* An unlimited allowance has nothing to be a proportion OF, so it renders as
     a word and no bar. Rendering a full bar for "unlimited" would say the exact
     opposite of what it means. */
  const unlimited = counter.limit === null;
  const limit = counter.limit ?? 0;
  const left = Math.max(0, limit - counter.used);
  /* A 0..1 SCALE FACTOR, not a percentage: the fill is a `scaleX`, and
     `scaleX(66%)` is invalid CSS that silently drops the whole declaration.
     Clamped, because a server that counted one more than it allows must not
     paint a bar past its own track. */
  const fill = unlimited || limit === 0
    ? 0
    : Math.min(1, counter.used / limit);

  return (
    <div className="usage">
      <div className="usage__head">
        <Icon size={15} className="usage__icon" aria-hidden="true" />
        <span className="usage__label">{label}</span>
        <span className="spacer" />
        <span className="usage__count num">
          {unlimited
            ? t('profile.aiUnlimited')
            : t('profile.aiUsedOf', {
              used: formatNumber(counter.used),
              limit: formatNumber(limit),
            })}
        </span>
      </div>

      {!unlimited && (
        <>
          {/* `--pct` rather than an inline width so the fill can be animated by
              transform, which is what the motion floor allows. */}
          <div
            className="meter usage__bar"
            data-spent={left === 0 || undefined}
            style={{ '--pct': fill } as React.CSSProperties}
          >
            <i />
          </div>

          <p className="usage__note">
            <span>{left === 0 ? t('profile.aiNoneLeft') : t('profile.aiLeft', { n: formatNumber(left) })}</span>
            {' · '}
            <span>
              {counter.period === 'day'
                ? t('profile.aiResetsDay', { limit: formatNumber(limit) })
                : t('profile.aiResetsWeek', {
                  limit: formatNumber(limit),
                  date: formatDate(counter.resetsAt),
                })}
            </span>
          </p>
        </>
      )}
    </div>
  );
}

export function UsageMeters({ usage }: { usage: Usage }) {
  const { t } = useI18n();
  return (
    <div className="stack stack--sm">
      <span className="usage__plan">
        {t(usage.plan === 'paid' ? 'profile.aiPlanPaid' : 'profile.aiPlanFree')}
      </span>
      <Meter label={t('profile.aiRescans')} icon={FileText} counter={usage.rescans} />
      <Meter label={t('profile.aiMessages')} icon={MessageSquare} counter={usage.messages} />
    </div>
  );
}

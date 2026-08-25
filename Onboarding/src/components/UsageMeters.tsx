/**
 * What this person has left of today's AI allowance.
 *
 * THE NUMBER IS THE POINT, and the bar is a second reading of it. A meter on
 * its own tells a job seeker how full a rectangle is; "22 of 30" tells them
 * whether they can keep going today. So the figure leads, the bar supports it,
 * and the reset line says when it comes back — because "none left" is only
 * frightening until you know it is a few hours.
 *
 * ONE POOL, AND ITS PRICE LIST. There used to be two meters on two clocks —
 * rescans weekly, messages daily. There is now one daily budget spent on
 * whichever of those a person wants, so a second meter would be the same number
 * twice. The prices sit under it deliberately: the bar says how much is left
 * and the prices say what things cost, which is what makes "spend it however
 * you like" a decision somebody can actually make rather than a slogan.
 *
 * Product register: precise and quiet. No celebration at low usage, no alarm at
 * high usage. A spent allowance is stated, not warned about — this is the
 * user's own account, not a limit they broke.
 */
import { FileText, MessageSquare, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Usage, UsageCounter } from '../api';

function Meter({
  label,
  icon: Icon,
  counter,
  note,
}: {
  label: string;
  icon: typeof FileText;
  counter: UsageCounter;
  /** The price list, under the bar. Omitted by the legacy meters below, which
   *  describe allowances that were never priced in anything. */
  note?: string;
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

      {/* Shown even on an unlimited account: what a message costs is true of
          the product, not of one person's remaining balance. */}
      {note && <p className="usage__note">{note}</p>}
    </div>
  );
}

export function UsageMeters({
  usage,
  /* The plan screen states the price list under its own comparison table, so a
     second copy one card below is noise. The profile screen has no table, and
     there the bar has to carry them or "18 left" is 18 of nothing in
     particular. */
  prices = true,
}: { usage: Usage; prices?: boolean }) {
  const { t, formatNumber } = useI18n();

  /* WHY THIS FALLS BACK RATHER THAN ASSUMING `tokens`. This app deploys from
     its own job, separately from the API, so a build can reach a browser
     talking to a server that predates the token budget. Reading `used / limit`
     off an absent object renders "NaN of 0" — a number nobody computed,
     presented as fact, which is the bug this product has already shipped twice
     on the course card. An older server still sends the two counters, so the
     honest answer is to draw what it actually said. */
  const tokens = usage.tokens;

  return (
    <div className="stack stack--sm">
      <span className="usage__plan">
        {t(usage.plan === 'paid' ? 'profile.aiPlanPaid' : 'profile.aiPlanFree')}
      </span>

      {tokens ? (
        <Meter
          label={t('profile.aiTokens')}
          icon={Sparkles}
          counter={tokens}
          note={prices && usage.prices ? t('profile.aiPrices', {
            message: formatNumber(usage.prices.message),
            reread: formatNumber(usage.prices.documentReread),
          }) : undefined}
        />
      ) : (
        <>
          {usage.rescans && (
            <Meter label={t('profile.aiRescans')} icon={FileText} counter={usage.rescans} />
          )}
          {usage.messages && (
            <Meter label={t('profile.aiMessages')} icon={MessageSquare} counter={usage.messages} />
          )}
        </>
      )}
    </div>
  );
}

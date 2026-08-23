/**
 * The plan: what each tier includes, what this account is on, and the way up.
 *
 * WHY THIS IS ITS OWN PAGE. The profile screen shows a person their own
 * consumption and nothing else — a price list beside your usage turns a
 * settings screen into a sales screen. The comparison lives here, and the
 * profile links to it.
 *
 * TWO TIERS, NO DECOY. Standard pricing advice is a three-tier good/better/best
 * with a middle option engineered to win. There are genuinely two things to
 * sell here, and a manufactured third would be visible to the user this product
 * is built to survive: the one who leaves permanently on a single unverifiable
 * claim. Same reason there is no countdown, no "was $X", and no social proof —
 * none of it has been measured, so none of it can be said.
 *
 * THE SERVER DECIDES WHEN YOU ARE PREMIUM. `checkout.completed` is Paddle
 * telling the browser that money moved; the plan flips when Paddle's webhook
 * reaches the server. So a completed checkout puts this screen into a
 * CONFIRMING state and polls `GET /api/usage` until the server agrees, rather
 * than flipping a badge the server would contradict on the next request.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n';
import { useApi } from '../state/api';
import { useAuth } from '../state/auth';
import { useTheme } from '../lib/theme';
import { useAsync } from '../lib/useAsync';
import { Callout, Card, ErrorState, LoadingBlock } from '../components/ui';
import { UsageMeters } from '../components/UsageMeters';
import { isConfigured, openCheckout } from '../lib/paddle';

/** How long to wait for the webhook before saying so, and how often to ask. */
const POLL_EVERY_MS = 2000;
const POLL_FOR_MS = 30000;

type Phase = 'idle' | 'confirming' | 'failed';

export function Plan() {
  const { t, locale, formatNumber } = useI18n();
  const api = useApi();
  const { user } = useAuth();
  const { theme } = useTheme();

  const { data, loading, error, reload } = useAsync((s) => api.getUsage(s), [api, locale]);
  const [phase, setPhase] = useState<Phase>('idle');
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  /**
   * Ask the server, repeatedly, whether it agrees the account is premium.
   *
   * Stops on the first `paid`, and gives up after `POLL_FOR_MS` with a message
   * that says it is still coming rather than that it failed — a slow webhook is
   * not a failed payment, and telling someone their payment failed when it did
   * not is the worse error by a distance.
   */
  const awaitPlan = useCallback(() => {
    setPhase('confirming');
    const started = Date.now();
    const tick = async () => {
      try {
        const fresh = await api.getUsage();
        if (fresh.plan === 'paid') { setPhase('idle'); reload(); return; }
      } catch { /* keep waiting; a failed poll is not a failed payment */ }
      if (Date.now() - started < POLL_FOR_MS) {
        timers.current.push(window.setTimeout(tick, POLL_EVERY_MS));
      }
    };
    timers.current.push(window.setTimeout(tick, POLL_EVERY_MS));
  }, [api, reload]);

  const upgrade = useCallback(() => {
    if (!user) return;
    setPhase('idle');
    void openCheckout({
      email: user.email,
      userId: user.id,
      locale,
      theme,
      onCompleted: awaitPlan,
      onError: () => setPhase('failed'),
    });
  }, [user, locale, theme, awaitPlan]);

  if (loading) return <div className="stack stack--lg enter"><Card><LoadingBlock rows={5} /></Card></div>;
  if (error || !data) return <div className="stack stack--lg enter"><ErrorState onRetry={reload} /></div>;

  const paid = data.plan === 'paid';

  return (
    <div className="stack stack--lg enter">
      <header>
        <h1 className="headline">{t('plan.title')}</h1>
      </header>

      {phase === 'confirming' && <Callout>{t('plan.confirming')}</Callout>}
      {phase === 'failed' && <Callout tone="danger">{t('plan.failed')}</Callout>}

      <Card>
        <div className="stack">
          {/* WHICH PLAN YOU ARE ON, ON A PHONE. Stacking the table hides the
              header row, and the header row is where the "Current" marker
              lives — so the mobile layout silently dropped the one fact this
              screen exists to state. Shown only where the columns are gone. */}
          <p className="tiers__youare">
            {t('plan.youAreOn', { plan: paid ? t('plan.paidName') : t('plan.freeName') })}
          </p>

          <table className="tiers">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">{t('plan.title')}</span></th>
                <th scope="col">
                  {t('plan.freeName')}
                  {!paid && <span className="tiers__now">{t('plan.current')}</span>}
                </th>
                <th scope="col">
                  {t('plan.paidName')}
                  {paid && <span className="tiers__now">{t('plan.current')}</span>}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{t('plan.rowCore')}</th>
                <td data-tier={t('plan.freeName')}><Check size={16} aria-label={t('plan.included')} /></td>
                <td data-tier={t('plan.paidName')}><Check size={16} aria-label={t('plan.included')} /></td>
              </tr>
              <tr>
                <th scope="row">{t('plan.rowMatches')}</th>
                <td data-tier={t('plan.freeName')}>{t('plan.rowMatchesFree')}</td>
                <td data-tier={t('plan.paidName')}>{t('plan.rowMatchesPaid')}</td>
              </tr>
              <tr>
                <th scope="row">{t('plan.rowMessages')}</th>
                <td className="num" data-tier={t('plan.freeName')}>{t('plan.perDay', { n: formatNumber(30) })}</td>
                <td className="num" data-tier={t('plan.paidName')}>{t('plan.perDay', { n: formatNumber(90) })}</td>
              </tr>
              <tr>
                <th scope="row">{t('plan.rowRescans')}</th>
                <td className="num" data-tier={t('plan.freeName')}>{t('plan.perWeek', { n: formatNumber(1) })}</td>
                <td className="num" data-tier={t('plan.paidName')}>{t('plan.perWeek', { n: formatNumber(3) })}</td>
              </tr>
            </tbody>

            {/* THE PRICE BELONGS TO THE COLUMN IT PRICES. It used to sit under
                the table as a block, which put it under the row-LABEL column
                with 600px of empty space to its right — spatially pricing
                "Where you stand, your path, the advisor". In the footer it
                lands in the Premium cell, where it is the price of. */}
            {!paid && (
              <tfoot>
                <tr>
                  <td /><td />
                  <td>
                    <p className="tiers__price num">{t('plan.price')}</p>
                    {/* Quiet, and underneath. Not what anyone is quoted, but it
                        is what reaches the statement. */}
                    <p className="tiers__usd num">{t('plan.priceUsd')}</p>
                    {isConfigured && (
                      <button
                        className="btn btn--primary tiers__buy"
                        type="button"
                        onClick={upgrade}
                        disabled={phase === 'confirming'}
                      >
                        <Sparkles size={16} aria-hidden="true" />
                        {t('plan.upgrade')}
                      </button>
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* The cancel policy is true whether or not checkout is wired, so it
              is no longer gated behind it. Previously an unconfigured build
              silently dropped the one piece of reassurance on the page. */}
          {!paid && <p className="text-sm muted">{t('plan.cancelNote')}</p>}

          {paid ? (
            <div className="stack stack--sm">
              <p className="text-sm">{t('plan.onPaid')}</p>
              <p className="text-sm muted">{t('plan.manage')}</p>
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="stack">
          <h2 className="section__title">{t('plan.usageTitle')}</h2>
          <UsageMeters usage={data} />
        </div>
      </Card>
    </div>
  );
}

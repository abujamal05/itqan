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
import { Button, Callout, Card, ErrorState, LoadingBlock } from '../components/ui';
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
                <td><Check size={16} aria-label={t('plan.included')} /></td>
                <td><Check size={16} aria-label={t('plan.included')} /></td>
              </tr>
              <tr>
                <th scope="row">{t('plan.rowMatches')}</th>
                <td>{t('plan.rowMatchesFree')}</td>
                <td>{t('plan.rowMatchesPaid')}</td>
              </tr>
              <tr>
                <th scope="row">{t('plan.rowMessages')}</th>
                <td className="num">{t('plan.perDay', { n: formatNumber(30) })}</td>
                <td className="num">{t('plan.perDay', { n: formatNumber(90) })}</td>
              </tr>
              <tr>
                <th scope="row">{t('plan.rowRescans')}</th>
                <td className="num">{t('plan.perWeek', { n: formatNumber(1) })}</td>
                <td className="num">{t('plan.perWeek', { n: formatNumber(3) })}</td>
              </tr>
            </tbody>
          </table>

          {paid ? (
            <div className="stack stack--sm">
              <p className="text-sm">{t('plan.onPaid')}</p>
              <p className="text-sm muted">{t('plan.manage')}</p>
            </div>
          ) : (
            <div className="stack stack--sm">
              <div>
                <p className="tiers__price num">{t('plan.price')}</p>
                {/* Quiet, and underneath. Not what anyone is quoted, but it is
                    what reaches the statement, and omitting it would be a price
                    that changes at checkout. */}
                <p className="tiers__usd num">{t('plan.priceUsd')}</p>
              </div>
              <div className="row">
                <Button onClick={upgrade} disabled={!isConfigured || phase === 'confirming'}>
                  <Sparkles size={16} aria-hidden="true" />
                  {t('plan.upgrade')}
                </Button>
              </div>
              {/* Nothing is said when checkout is not configured. A user cannot
                  act on it, and a line explaining an unfinished deployment is
                  noise in the middle of a plan they are reading. The button is
                  disabled, the console says why, and BACKEND.md §6 carries it. */}
              {isConfigured && <p className="text-sm muted">{t('plan.cancelNote')}</p>}
            </div>
          )}
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

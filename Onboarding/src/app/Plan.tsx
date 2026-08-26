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
 *
 * ONE ACTION, UNDER THE TABLE, THE WIDTH OF THE TABLE. The upgrade used to live
 * inside the Premium column's footer cell, which priced that column correctly
 * and made the single most important control on the page a third of its width.
 * It is now a full-width control under the comparison, and it is the ONE thing
 * the state of the account changes: Free is offered the way up, Premium is
 * offered the way out. The price stays in the footer cell, because a price
 * belongs to the column it prices.
 *
 * CANCELLING IS FINISHED SOMEWHERE ELSE, and this screen never says where. The
 * server mints a session with the payment provider and returns a URL; naming
 * the provider would tell a person cancelling a subscription something that
 * cannot help them, and would make a vendor swap a copy change across two
 * locales. See BACKEND.md §8.
 *
 * WHAT YOU HAVE USED IS NOT HERE. It moved to Settings, whole. Someone's own
 * consumption beside a price list turns a comparison into a sales screen, and
 * the meter answers a different question from the one this page is for.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, CircleX, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n';
import { useApi } from '../state/api';
import { useAuth } from '../state/auth';
import { useTheme } from '../lib/theme';
import { useAsync } from '../lib/useAsync';
import { Button, Callout, Card, ErrorState, LoadingBlock } from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { isConfigured, openCheckout } from '../lib/paddle';

/** How long to wait for the webhook before saying so, and how often to ask. */
const POLL_EVERY_MS = 2000;
const POLL_FOR_MS = 30000;

type Phase = 'idle' | 'confirming' | 'failed';

export function Plan() {
  const { t, locale, formatDate, formatNumber } = useI18n();
  const navigate = useNavigate();
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

  /**
   * Begin cancelling, and go where it is finished.
   *
   * NOTHING IS CANCELLED BY THIS CALL and the copy is careful not to imply it
   * was — the server opens a session with the payment provider and hands back a
   * URL, and the subscription changes when that provider says so and its
   * webhook lands. Exactly the rule the upgrade already follows in the other
   * direction.
   *
   * A full navigation rather than a new tab: this is a payment surface and the
   * person is meant to finish there, not to be left with two windows and no
   * idea which one is current. Coming back re-mounts this screen, which
   * re-reads `GET /api/usage` and shows whatever the server now says.
   */
  const [cancelling, setCancelling] = useState(false);
  const startCancel = useCallback(async () => {
    const { url } = await api.startCancellation();
    window.location.assign(url);
    /* Held open deliberately. The navigation is in flight and closing the
       dialog first would flash the plan screen back with no explanation. */
    await new Promise(() => {});
  }, [api]);

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
  /* When the paid period runs to, if the server said. Only a subscription that
     still renews can be cancelled; one already cancelled is running out on its
     own and offering to cancel it again would be a control with no act. */
  const endsAt = data.subscription?.currentPeriodEnd ?? null;
  const renewing = data.subscription?.status !== 'cancelled';

  /* WHAT EACH TIER BUYS, DERIVED RATHER THAN TYPED IN. The two rows below used
     to be four hard-coded numbers, and two of them ("1 a week", "3 a week")
     went on selling a weekly rescan allowance for as long as it took somebody
     to notice — there is one daily pool now, spent at published prices.
     Dividing the budget by the price cannot fall out of step with what the
     server enforces the way a copied constant did.

     The payload knows ONE ceiling: the tier this account is on. So that column
     is read from the server and the other stays a constant — half the table
     that cannot drift beats none of it, and the live half is the one a person
     checks against their own bar. An unlimited account reports `limit: null`
     and falls back, because "up to null a day" is worse than a stale 30. */
  const budget = data.tokens?.limit ?? null;
  const freeTokens = !paid && budget !== null ? budget : 30;
  const paidTokens = paid && budget !== null ? budget : 90;
  const priceMessage = Math.max(1, data.prices?.message ?? 1);
  const priceReread = Math.max(1, data.prices?.documentReread ?? 19);
  /* Floored, never rounded: a ceiling that rounds up promises an action the
     budget cannot pay for. 90 tokens buys four 19-token re-reads, not five. */
  const buys = (tokens: number, price: number) => Math.floor(tokens / price);

  return (
    <div className="stack stack--lg enter">
      <header className="stack stack--sm">
        {/* A WAY OUT. This screen is reached from the profile and from the
            locked-jobs prompt, and it had no back control at all — the only
            exit was the account menu, which means re-opening your own profile
            to leave a page about billing.
            `navigate(-1)` rather than a fixed link to /profile, because the
            two entry points are different places and sending someone to the
            profile from the jobs prompt would be a lie about where they were.
            The icon flips with direction on its own: it is inside a flex row
            whose order reverses under RTL. */}
        <button type="button" className="btn btn--ghost btn--sm plan__back" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t('action.back')}
        </button>
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
              {/* "UP TO", ON BOTH ROWS, AND THE NOTE UNDERNEATH IS WHAT MAKES
                  THAT HONEST. Each figure is true and they cannot both happen:
                  together they promise 90 messages AND 4 re-reads, which is 166
                  tokens of a 90-token budget. If the note ever goes for space,
                  these rows go with it. */}
              <tr>
                <th scope="row">{t('plan.rowMessages')}</th>
                <td className="num" data-tier={t('plan.freeName')}>
                  {t('plan.upToPerDay', { n: formatNumber(buys(freeTokens, priceMessage)) })}
                </td>
                <td className="num" data-tier={t('plan.paidName')}>
                  {t('plan.upToPerDay', { n: formatNumber(buys(paidTokens, priceMessage)) })}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('plan.rowRescans')}</th>
                <td className="num" data-tier={t('plan.freeName')}>
                  {t('plan.upToPerDay', { n: formatNumber(buys(freeTokens, priceReread)) })}
                </td>
                <td className="num" data-tier={t('plan.paidName')}>
                  {t('plan.upToPerDay', { n: formatNumber(buys(paidTokens, priceReread)) })}
                </td>
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
                    {/* The button used to sit here, a third of the table wide.
                        It is under the table now, full width. */}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {paid && <p className="text-sm">{t('plan.onPaid')}</p>}

          {/* THE ONE ACTION, THE WIDTH OF THE THING IT ACTS ON.
              Free is offered the way up and Premium the way out, and which one
              renders is the only thing the account's state changes here.

              The upgrade is omitted rather than disabled when checkout is not
              configured — a disabled button invites a click and then refuses
              it, and a missing environment variable is not something a job
              seeker can act on. Cancelling has no such gate: the server owns
              that session, so the control is honest in any build. */}
          {paid && renewing && (
            <Button variant="secondary" block onClick={() => setCancelling(true)}>
              <CircleX size={16} aria-hidden="true" />
              {t('plan.cancel')}
            </Button>
          )}
          {!paid && isConfigured && (
            <Button block onClick={upgrade} disabled={phase === 'confirming'}>
              <Sparkles size={16} aria-hidden="true" />
              {t('plan.upgrade')}
            </Button>
          )}

          {/* ALREADY CANCELLED IS ITS OWN STATE, and it gets no button: there
              is nothing left to cancel, and offering it again would be a
              control with no act behind it. What it needs instead is the date,
              because "am I still paying" is the only question left here. */}
          {paid && !renewing && (
            <p className="text-sm">
              {endsAt
                ? t('plan.alreadyCancelled', { date: formatDate(endsAt) })
                : t('plan.alreadyCancelledNoDate')}
            </p>
          )}

          {/* Under the button it qualifies, and only where there is one. Buying,
              it is the reassurance; cancelling, it is the fact that answers "do
              I lose it today". True whether or not checkout is wired, so it is
              not gated behind that — an unconfigured build used to drop the one
              piece of reassurance on the page. */}
          {(!paid || renewing) && <p className="text-sm muted">{t('plan.cancelNote')}</p>}

          {paid && <p className="text-sm muted">{t('plan.card')}</p>}
        </div>
      </Card>

      <ConfirmDialog
        open={cancelling}
        onClose={() => setCancelling(false)}
        icon={CircleX}
        title={t('plan.cancelConfirmTitle')}
        lead={t('plan.cancelConfirmLead')}
        items={[
          /* The date, when the server knows it. "Premium runs until null" is
             worse than the general form, and a date reconstructed from a
             month's arithmetic would be an invented fact about money. */
          endsAt
            ? t('plan.cancelItemUntil', { date: formatDate(endsAt) })
            : t('plan.cancelItemUntilNoDate'),
          t('plan.cancelItemAfter'),
          t('plan.cancelItemBilling'),
        ]}
        note={t('plan.cancelComeBack')}
        confirmLabel={t('plan.cancelConfirmAction')}
        onConfirm={startCancel}
        errorFallback={t('plan.cancelFailed')}
      />
    </div>
  );
}

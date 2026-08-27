/**
 * Closing the account: pause it, or destroy it.
 *
 * ONE CARD, TWO ROWS, NOT TWO CARDS. Two danger-edged panels stacked at the end
 * of Settings would end the page in a wall of alarm and make neither of them
 * the emphasis — the same argument the design system makes about accent edges
 * being a scarce resource. So there is one bordered card, and inside it the
 * reversible act is quiet and the irreversible one carries the only filled
 * danger button on the screen.
 *
 * THE SUBSCRIPTION COMES FIRST, AND THAT IS NOT UI POLISH. Deleting the account
 * does not stop the billing — the subscription lives with the payment provider,
 * and a row disappearing from a database is not a message to it. So while one is
 * still renewing, deletion is not offered at all: the row says why and points at
 * the plan screen. It is not a disabled button, because a blocked control
 * invites a click and then refuses it, which is the rule the last-CV document
 * row already follows.
 *
 * Once it has been cancelled the account can be deleted immediately, even with
 * paid time left on it. That time is STATED in the confirmation rather than used
 * as a reason to refuse: it is the person's own month and their own decision.
 *
 * The dialogs themselves are `ConfirmDialog`, shared with the plan screen — see
 * that file for why the confirmation is a list of consequences rather than "are
 * you sure", and for where focus lands.
 *
 * NEITHER ACTION IS PERFORMED HERE. The server owns what deactivation and
 * deletion mean; this screen states them, asks, and calls. See BACKEND.md §9 —
 * both routes are specified and neither is built in production yet, so both
 * calls must survive a 404 without leaving someone believing their account is
 * gone when it is not.
 */
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, PauseCircle, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { useApi } from '../state/api';
import { siteHome, siteLogin } from '../lib/site';
import { Card } from './ui';
import { ConfirmDialog } from './ConfirmDialog';
import type { Usage } from '../api';

type Act = 'deactivate' | 'delete';

/**
 * What the subscription lets a person do to their own account.
 *
 * UNKNOWN IS NOT "NONE", and unknown is the common case: `GET /api/usage` is not
 * built in production, so most of the time this screen knows nothing about the
 * billing. Blocking deletion on missing information would refuse a legal right
 * on a guess, so silence resolves to "not blocked" — and the server refuses with
 * 409 `subscription_active` if the browser turns out to have been wrong, which
 * is why the client rule is a courtesy rather than the control.
 */
function billingState(usage: Usage | 'unavailable' | null) {
  const none = { blocked: false, endsAt: null as string | null };
  if (!usage || usage === 'unavailable') return none;
  const sub = usage.subscription;
  if (!sub) return none;
  return { blocked: sub.status === 'active', endsAt: sub.currentPeriodEnd };
}

export function CloseAccount({ usage }: { usage: Usage | 'unavailable' | null }) {
  const { t, locale, formatDate } = useI18n();
  const api = useApi();
  const [act, setAct] = useState<Act | null>(null);
  const { blocked, endsAt } = billingState(usage);

  const close = useCallback(() => setAct(null), []);

  /**
   * End the session, but NOT through `useAuth().logout()`, and the difference is
   * a bug that was live: that helper sets `user` to null, React re-renders, and
   * `RequireApp` sends the now-anonymous visitor to the site's LOG IN page under
   * its own steam. Two navigations then race and one aborts — so someone who had
   * just deleted their account landed on a form asking them to sign in, roughly
   * half the time.
   *
   * The server already cleared the cookie (BACKEND.md §9 requires it), and a
   * full page navigation discards every bit of client state anyway, so the only
   * thing `logout()` added here was the race. The bare API call stays as
   * insurance for a server that forgets, and it touches no React state.
   */
  const leave = useCallback(async (to: string) => {
    await api.logout().catch(() => { /* the session is already gone */ });
    window.location.assign(to);
  }, [api]);

  const deleteAccount = useCallback(async () => {
    await api.deleteAccount();
    /* Deleted, so there is no account to return to: the front door. */
    await leave(siteHome(locale));
  }, [api, leave, locale]);

  const deactivate = useCallback(async () => {
    await api.deactivateAccount();
    /* Paused, so log in is the destination, because logging back in is
       literally what the copy above promised would restore it. */
    await leave(siteLogin(locale));
  }, [api, leave, locale]);

  /**
   * The paid time still left, named in the confirmation.
   *
   * Only when the server gave a date. "Your subscription runs until null" is
   * worse than saying nothing, and a date reconstructed from a month's
   * arithmetic would be a fabricated fact about somebody's money.
   */
  const paidUntil = endsAt && !blocked
    ? t('settings.deleteItemSubscription', { date: formatDate(endsAt) })
    : null;

  const deleteItems = [
    /* First, because it is the one consequence that reaches outside the
       account, and the only one with a date on it. */
    ...(paidUntil ? [paidUntil] : []),
    t('settings.deleteItemDocs'),
    t('settings.deleteItemProfile'),
    t('settings.deleteItemMatches'),
    t('settings.deleteItemChat'),
    t('settings.deleteItemAccount'),
  ];

  return (
    <>
      <Card id="sec-close" className="card--danger">
        <div className="stack">
          <div className="section__head">
            <h2 className="section__title">
              <AlertTriangle size={18} aria-hidden="true" className="profile__icon profile__icon--danger" />
              {t('settings.closeTitle')}
            </h2>
          </div>

          {/* Reversible first. Ordering these the other way round would put the
              destructive act directly under the heading, where a person
              skimming to the end of the page lands. */}
          <div className="close__act">
            <div className="close__what">
              <h3 className="close__name">{t('settings.deactivateTitle')}</h3>
              <p className="text-sm">{t('settings.deactivateBody')}</p>
            </div>
            <button type="button" className="btn btn--secondary" onClick={() => setAct('deactivate')}>
              <PauseCircle size={16} aria-hidden="true" />
              {t('settings.deactivateAction')}
            </button>
          </div>

          <hr className="divider" />

          <div className="close__act">
            <div className="close__what">
              <h3 className="close__name">{t('settings.deleteTitle')}</h3>
              <p className="text-sm">
                {blocked ? t('settings.deleteBlockedBody') : t('settings.deleteBody')}
              </p>
            </div>

            {blocked ? (
              /* The way to the thing that unblocks it, not a refused button.
                 Someone who has to cancel first needs the plan screen, and this
                 is one tap to it rather than a sentence telling them to go and
                 find it themselves. */
              <Link className="btn btn--secondary" to="/plan">
                {t('settings.deleteBlockedAction')}
                <ArrowRight size={16} aria-hidden="true" className="go" />
              </Link>
            ) : (
              /* The only filled danger button in the app. It opens the
                 confirmation; it does not delete anything. */
              <button type="button" className="btn btn--danger" onClick={() => setAct('delete')}>
                <Trash2 size={16} aria-hidden="true" />
                {t('settings.deleteAction')}
              </button>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={act === 'deactivate'}
        onClose={close}
        icon={PauseCircle}
        title={t('settings.deactivateConfirmTitle')}
        lead={t('settings.deactivateConfirmLead')}
        items={[
          t('settings.deactivateItemKept'),
          t('settings.deactivateItemStops'),
          t('settings.deactivateItemBack'),
        ]}
        note={t('settings.deactivateReversible')}
        confirmLabel={t('settings.deactivateConfirmAction')}
        onConfirm={deactivate}
        errorFallback={t('settings.closeFailed')}
      />

      <ConfirmDialog
        open={act === 'delete'}
        onClose={close}
        tone="danger"
        icon={Trash2}
        title={t('settings.deleteConfirmTitle')}
        lead={t('settings.deleteConfirmLead')}
        items={deleteItems}
        note={t('settings.deleteIrreversible')}
        typePhrase={{
          phrase: t('settings.deletePhrase'),
          label: t('settings.deleteTypeLabel', { phrase: t('settings.deletePhrase') }),
        }}
        confirmLabel={t('settings.deleteConfirmAction')}
        onConfirm={deleteAccount}
        errorFallback={t('settings.closeFailed')}
      />
    </>
  );
}

/**
 * The signed-in shell: sidebar on desktop, bottom tab bar on phones.
 *
 * The sidebar collapses to an icon rail so the dashboard can be read close to
 * full width. The choice is remembered, because someone who wants the wide
 * view wants it every time, not once per visit. Collapsing hides labels by
 * removing them from the flow rather than visually — a label a screen reader
 * can still read while nobody can see it is worse than no label, so each
 * control keeps its own aria-label instead.
 *
 * The account menu is the one dropdown here, because it holds a destructive
 * action that should not sit a stray tap from the nav. It closes on Escape,
 * outside click, selection, and focus leaving — see Menu.tsx.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen, Briefcase, LayoutDashboard, LogOut, PanelLeftClose,
  Settings as SettingsIcon, Sparkles, SquarePen, User as UserIcon, Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuth } from '../state/auth';
import { useApi } from '../state/api';
import { useChat } from '../state/chat';
import { Logo } from '../components/Logo';
import { PipelineProgress } from '../components/PipelineProgress';
import { UpdateBanner } from '../components/UpdateJourney';
import { RatePrompt } from '../components/RatePrompt';
import { useRate } from '../state/rate';
import { LangToggle, ThemeToggle } from '../components/Controls';
import { Menu, MenuItem } from '../components/Menu';
import { siteLogin } from '../lib/site';
import type { Usage } from '../api';

/**
 * Order is the user's journey, not the data model: see where you stand, then
 * what to learn, then what to apply for. Job postings sit last because they
 * are the destination, not the starting point.
 *
 * Chat leads, ahead of that sequence rather than inside it, because it is the
 * way IN to all three: a graduate who does not yet know which of these they
 * need is exactly who Hud is for, and the answers he gives end up pointing
 * at one of the rows below. The journey argument still governs those three.
 *
 * The icon is Waypoints, not a speech bubble. What the screen actually is, is a
 * path with nodes on it; a message icon would promise a transcript.
 */
const DESTS: { to: string; key: string; icon: LucideIcon }[] = [
  { to: '/chat', key: 'nav.chat', icon: Waypoints },
  { to: '/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/courses', key: 'nav.courses', icon: BookOpen },
  { to: '/jobs', key: 'nav.jobs', icon: Briefcase },
];

/*
 * Profile and Documents are deliberately NOT destinations.
 *
 * The three above are the daily loop: where you stand, what to learn, what to
 * apply for. Profile is your account, and every product this audience already
 * uses puts the account behind the avatar — so it lives in the menu under your
 * own name, which is also where people look for it first.
 *
 * Documents used to be a highlighted fourth row. It is gone from here because
 * it was a second door into the same room: replacing a document is one thing
 * you do to your profile, alongside correcting your phone number or your
 * graduation date, and splitting it out made the sidebar advertise an action
 * over the three places the user actually lives. The route still exists and
 * Profile owns the entry point.
 */

const COLLAPSE_KEY = 'itqan.sidebar.collapsed';

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function AccountMenu({ askToRate }: {
  /**
   * Ask for a rating first, then run the callback. Returns false when the
   * moment is wrong — still onboarding, mid-run, already asked — and the
   * caller carries on immediately.
   */
  askToRate: (then: () => void) => boolean;
}) {
  const { t, locale, formatNumber } = useI18n();
  const { user } = useAuth();
  const api = useApi();

  /**
   * SIGN OUT WITHOUT RACING OURSELVES.
   *
   * `useAuth().logout()` sets `user` to null, React re-renders, and `RequireApp`
   * sends the now-anonymous visitor to the site's log in page under its own
   * steam — then this line navigates there too, and one of the two aborts. Both
   * targets happen to be the same page, so it looked harmless and stayed;
   * `CloseAccount` hit the identical race with two DIFFERENT targets and that is
   * where it was finally visible.
   *
   * The bare API call ends the session without touching React state, and a full
   * navigation discards everything the store was holding anyway.
   */
  const leave = useCallback(async () => {
    await api.logout().catch(() => { /* the session is going either way */ });
    window.location.assign(siteLogin(locale));
  }, [api, locale]);

  /**
   * What is left of today's tokens, shown as a figure and nothing else.
   *
   * NOT A BAR. The profile screen already draws the meter, with the price list
   * under it; repeating that here would put the same widget in two places and
   * make the menu a second dashboard. What a person wants from a dropdown is
   * the number.
   *
   * SILENT WHEN UNAVAILABLE, which is a product rule rather than a nicety: if
   * `/api/usage` is missing or fails, no screen may show a usage figure at
   * all. A zero here would read as "you have none left" and send someone to
   * the plan page to fix a problem they do not have.
   */
  const [usage, setUsage] = useState<Usage | null>(null);
  useEffect(() => {
    if (!user) return undefined;
    const ac = new AbortController();
    api.getUsage(ac.signal).then(setUsage).catch(() => { /* stays silent */ });
    return () => ac.abort();
  }, [api, user]);

  if (!user) return null;

  const tokens = usage?.tokens;
  const left = tokens && tokens.limit !== null ? Math.max(0, tokens.limit - tokens.used) : null;

  return (
    <Menu
      label={t('account.menu')}
      trigger={
        <>
          <span className="avatar" aria-hidden="true">{initials(user.fullName) || <UserIcon size={16} />}</span>
          <span className="menu__name"><bdi>{user.fullName}</bdi></span>
        </>
      }
    >
      {(close) => (
        <>
          <div className="menu__head">
            <p className="menu__headName"><bdi>{user.fullName}</bdi></p>
            <p className="menu__headMail"><bdi>{user.email}</bdi></p>
            {left !== null && (
              /* The icon is the same Sparkles the profile meter uses, so the
                 two read as one thing seen twice rather than two features. */
              <p className="menu__tokens">
                <Sparkles size={14} aria-hidden="true" />
                <span className="num">{formatNumber(left)}</span>
                <span className="sr-only">{t('account.tokensLeft')}</span>
              </p>
            )}
          </div>
          {/* Your account, under your own name — where this audience looks for
              it first, and no longer competing with the daily loop in the nav.

              TWO ENTRIES, because they answer different questions. Profile is
              "is this me, and is it right"; Settings is what Itqan holds, what
              it spends, and how to stop. One screen carrying both had grown to
              eight sections, and the menu is where the two become findable
              rather than scrollable. */}
          <Link className="menu__item" role="menuitem" to="/profile" onClick={close}>
            <UserIcon size={16} aria-hidden="true" />
            {t('nav.profile')}
          </Link>
          <Link className="menu__item" role="menuitem" to="/settings" onClick={close}>
            {/* A cog is one of the icons that must NOT mirror in Arabic: it
                encodes a thing, not a direction. Nothing flips it, which is
                the correct default and worth not "fixing" later. */}
            <SettingsIcon size={16} aria-hidden="true" />
            {t('nav.settings')}
          </Link>
          <MenuItem
            danger
            onSelect={() => {
              close();
              /* ASKED BEFORE THE DOOR CLOSES, and never instead of it. If the
                 gates say no — still onboarding, mid-run, already asked — this
                 signs out immediately and nothing appears. If they say yes, the
                 prompt takes over and logs out on either answer. */
              if (!askToRate(() => void leave())) void leave();
            }}
          >
            <LogOut size={16} aria-hidden="true" />
            {t('account.logout')}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

export function AppLayout() {
  // `locale` is intentionally not read here: the mark now routes to /dashboard
  // rather than to a locale-prefixed marketing URL. The account menu still uses
  // it for the "visit the site" item, where leaving the product is deliberate.
  const { t } = useI18n();
  const rate = useRate();
  /**
   * What to do once the prompt is done with, when it was opened on the way OUT.
   *
   * Held here rather than inside the menu because the menu unmounts the moment
   * it closes, and the callback has to outlive it — the person is answering a
   * question that was asked by something no longer on screen.
   */
  const afterRating = useRef<(() => void) | null>(null);
  const askToRate = useCallback((then: () => void) => {
    if (!rate.ask()) return false;
    afterRating.current = then;
    return true;
  }, [rate]);
  const { threads, reset: resetChat } = useChat();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* private mode */ }
      return next;
    });
  }, []);

  // "[" is the convention for this in editors and a few web apps; it costs
  // nothing and the people who want a wide view are the ones who will use it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        || (el instanceof HTMLElement && el.isContentEditable);
      if (!typing && e.key === '[') { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <div className="shell">
      <nav
        className="sidebar"
        aria-label={t('a11y.mainNav')}
        data-collapsed={collapsed || undefined}
      >
        <div className="sidebar__head">
          {/* A ROUTER link to the dashboard, not an anchor to the marketing site.
              For a signed-in user "home" is the dashboard: they live in here, and
              sending them out to the public landing page — then making them find
              their way back in — is a detour from the one screen the mark should
              return them to. The marketing site is still reachable from the
              account menu, where leaving the product is an explicit choice. */}
          <Link to="/dashboard" className="brand brand--side" aria-label={t('a11y.dashboardLink')}>
            <Logo variant={collapsed ? 'icon' : 'lockup'} />
          </Link>
          <button
            type="button"
            className="sidebar__collapse"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="nav">
          {DESTS.map(({ to, key, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="nav__item"
              aria-label={collapsed ? t(key) : undefined}
              title={collapsed ? t(key) : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="nav__label">{t(key)}</span>
            </NavLink>
          ))}
        </div>

        {/* STARTING A NEW CONVERSATION HAD NO CONTROL AT ALL.
            The only way to leave a thread was to click "Chat" in the nav and
            notice that it happened to reset — a side effect, not an offer, and
            invisible to anyone who had not already discovered it. It sits
            directly above the saved conversations because that is the pair:
            the ones you had, and starting another.

            A button, not a nav row. The four rows above are destinations and
            look alike on purpose; this performs an action and has to read
            differently or it becomes a fifth place to go. It is always
            present, including when there are no saved threads yet — the first
            conversation is the one most worth making easy to start. */}
        <Link
          to="/chat"
          className="newchat"
          aria-label={collapsed ? t('chat.new') : undefined}
          title={collapsed ? t('chat.new') : t('chat.newHint')}
          /**
           * `reset()` HERE, not left to the route change, and this is load
           * bearing rather than belt and braces.
           *
           * Chat.tsx has two effects on the URL: one resets the thread when the
           * param disappears, and one restores `/chat/:threadId` when a thread
           * exists without a param. Navigating alone fires both, and the second
           * still sees the old `threadId` in its closure, so it pushes the URL
           * straight back and the conversation never clears. Clearing the state
           * in the same interaction means the restore effect has nothing to
           * restore by the time it runs.
           */
          onClick={resetChat}
        >
          <SquarePen size={17} aria-hidden="true" />
          <span className="nav__label">{t('chat.new')}</span>
        </Link>

        {/* Saved conversations, the way Claude and ChatGPT list them: newest
            first, titled by their opening question, no heading needed beyond
            one quiet word. Hidden entirely when there are none and when the rail
            is collapsed, because a truncated list of titles in a 64px column is
            noise rather than navigation. */}
        {!collapsed && threads.length > 0 && (
          <div className="recents">
            <p className="recents__label">{t('nav.recents')}</p>
            <div className="recents__list">
              {threads.slice(0, 8).map((thread) => (
                <NavLink key={thread.id} to={`/chat/${thread.id}`} className="recents__item" title={thread.title}>
                  <bdi>{thread.title}</bdi>
                </NavLink>
              ))}
            </div>
          </div>
        )}

        <div className="spacer" />

        <div className="stack stack--sm">
          <div className="sidebar__foot">
            <LangToggle compact />
            <ThemeToggle compact />
          </div>
          <AccountMenu askToRate={askToRate} />
        </div>
      </nav>

      <div className="main">
        {/* Phones get the mark and the same controls in a compact header. */}
        <header className="topbar" data-mobile-header>
          <Link to="/dashboard" className="brand" aria-label={t('a11y.dashboardLink')}>
            <Logo variant="icon" />
          </Link>
          <span className="spacer" />
          <LangToggle compact />
          <ThemeToggle compact />
          <AccountMenu askToRate={askToRate} />
        </header>

        {/* tabIndex -1: the skip link and the route-change focus move both
            target this, and neither can land on an element that is not
            focusable. Programmatic focus does not trigger :focus-visible, so
            no ring appears. */}
        <main className="main__inner" id="main" tabIndex={-1}>
          {/* Above the page, on every page.
              Confirming the profile is what starts Agent C and Agent E, so the
              user reaches the dashboard while those are still running. Without
              this they would see empty pages on a working product and conclude
              it was broken — the bar has to follow them, not live back on the
              screen they have already left. It renders nothing once the run is
              done, or for a session that ran no agents at all. */}
          <PipelineProgress />
          {/* Beside the pipeline's own bar, and for the same reason: an out of
              date journey is not something a person should have to visit a
              screen to discover. It follows them. */}
          <UpdateBanner />
          <Outlet />
        </main>

      {/* ONE INSTANCE, in the shell, so whichever trigger fires — the account
          menu on its way out, or the pointer heading for the tab bar — there is
          exactly one prompt and one answer. */}
      <RatePrompt
        open={rate.open}
        onClose={() => { rate.dismiss(); afterRating.current?.(); afterRating.current = null; }}
        onDone={(rated) => {
          rate.finish(rated);
          afterRating.current?.();
          afterRating.current = null;
        }}
      />
      </div>

      <nav className="tabbar" aria-label={t('a11y.mainNav')}>
        {DESTS.map(({ to, key, icon: Icon }) => (
          <NavLink key={to} to={to} className="tabbar__item">
            <Icon size={20} aria-hidden="true" />
            {t(key)}
            <span className="tabbar__dot" aria-hidden="true" />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

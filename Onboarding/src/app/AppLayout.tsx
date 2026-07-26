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
import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  BookOpen, Briefcase, ExternalLink, LayoutDashboard, LogOut,
  PanelLeftClose, User as UserIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { useAuth } from '../state/auth';
import { Logo } from '../components/Logo';
import { LangToggle, ThemeToggle } from '../components/Controls';
import { Menu, MenuItem } from '../components/Menu';
import { siteHome, siteLogin } from '../lib/site';

/**
 * Order is the user's journey, not the data model: see where you stand, then
 * what to learn, then what to apply for. Job postings sit last because they
 * are the destination, not the starting point.
 */
const DESTS: { to: string; key: string; icon: LucideIcon }[] = [
  { to: '/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/courses', key: 'nav.courses', icon: BookOpen },
  { to: '/jobs', key: 'nav.jobs', icon: Briefcase },
];

const COLLAPSE_KEY = 'itqan.sidebar.collapsed';

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function AccountMenu() {
  const { t, locale } = useI18n();
  const { user, logout } = useAuth();
  if (!user) return null;

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
          </div>
          {/* A real navigation, not a route: the site is the other half. */}
          <a className="menu__item" role="menuitem" href={siteHome(locale)} onClick={close}>
            <ExternalLink size={16} aria-hidden="true" />
            {t('nav.site')}
          </a>
          <MenuItem
            danger
            onSelect={async () => {
              close();
              await logout();
              window.location.assign(siteLogin(locale));
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
  const { t } = useI18n();
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
          <NavLink to="/dashboard" className="brand brand--side" aria-label={t('brand.name')}>
            <Logo variant={collapsed ? 'icon' : 'lockup'} />
          </NavLink>
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

        <div className="spacer" />

        <div className="stack stack--sm">
          <div className="sidebar__foot">
            <LangToggle compact />
            <ThemeToggle compact />
          </div>
          <AccountMenu />
        </div>
      </nav>

      <div className="main">
        {/* Phones get the mark and the same controls in a compact header. */}
        <header className="topbar" data-mobile-header>
          <NavLink to="/dashboard" className="brand" aria-label={t('brand.name')}>
            <Logo variant="icon" />
          </NavLink>
          <span className="spacer" />
          <LangToggle compact />
          <ThemeToggle compact />
          <AccountMenu />
        </header>

        <main className="main__inner" id="main">
          <Outlet />
        </main>
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

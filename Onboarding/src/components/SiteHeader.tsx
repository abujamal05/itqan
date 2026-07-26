/**
 * Header for the public and onboarding screens.
 *
 * The mark is the lockup on wide screens, where it can be read at its minimum
 * legible width, and the icon on narrow ones — a squeezed lockup is a brand
 * misuse, not a responsive layout. Both swap for dark surfaces.
 *
 * Language and theme stay as visible buttons rather than folding into a menu:
 * there are only two of them, they fit at 320px, and hiding the language
 * switch behind an icon is a trap for the user who most needs it.
 */
import { Logo } from './Logo';
import { LangToggle, ThemeToggle } from './Controls';
import { Steps } from './Steps';
import type { StepIndex } from './Steps';
import { useI18n } from '../i18n';
import { siteHome } from '../lib/site';

export function SiteHeader({ step }: { step?: StepIndex }) {
  const { t, locale } = useI18n();
  return (
    <header className="topbar">
      {/* A plain anchor, not a router Link: the mark leads to the marketing
          site, which is a different app on the same origin. */}
      <a className="brand" href={siteHome(locale)} aria-label={t('brand.name')}>
        <span className="brand__lockup"><Logo variant="lockup" /></span>
        <span className="brand__icon"><Logo variant="icon" /></span>
      </a>

      {step !== undefined ? <Steps current={step} /> : <span className="spacer" />}

      <div className="topbar__tools">
        <LangToggle compact />
        <ThemeToggle compact />
      </div>
    </header>
  );
}

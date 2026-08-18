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
import { PipelineProgress } from './PipelineProgress';
import { useI18n } from '../i18n';
import { siteHome } from '../lib/site';

/**
 * The pipeline bar lives HERE, directly under the step indicator, rather than
 * inside each screen's content.
 *
 * It used to be placed by Questions and Confirm individually, part way down the
 * page, where it competed with the question being asked and moved position
 * between the two screens. One fixed place under the steps means it is the same
 * object throughout onboarding, and the two progress indicators — which step you
 * are on, and how far the reading has got — sit together instead of at opposite
 * ends of the page.
 */
export function SiteHeader({ step }: { step?: StepIndex }) {
  const { t, locale } = useI18n();
  return (
    <>
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

    {/* Only in the flow, and only once there is a run to report — the strip
        renders nothing at all before the documents are submitted. `reading`
        scope: during onboarding the only thing the user is waiting for is
        Agent A, and the bar has to reach 100% when that finishes. */}
    {step !== undefined && <PipelineProgress variant="strip" scope="reading" />}
    </>
  );
}

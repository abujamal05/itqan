/**
 * The two controls that must be reachable on every screen: language and theme.
 *
 * Language stays visible rather than hiding in a menu because a user who picked
 * the wrong one cannot read the menu that would let them fix it. It is the one
 * control that must never be behind a label the user cannot parse, which is
 * also why it always shows the *other* language in its own script.
 */
import { Moon, Sun } from 'lucide-react';
import { useI18n } from '../i18n';
import { useTheme } from '../lib/theme';

export function LangToggle({ compact = false }: { compact?: boolean }) {
  const { t, toggleLocale, locale } = useI18n();
  return (
    <button
      type="button"
      className={`btn btn--secondary${compact ? ' btn--sm' : ''}`}
      onClick={toggleLocale}
      lang={locale === 'ar' ? 'en' : 'ar'}
    >
      {t('a11y.langToggle')}
    </button>
  );
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      className={`btn btn--secondary btn--icon${compact ? ' btn--sm' : ''}`}
      onClick={toggle}
      aria-label={t('a11y.themeToggle')}
      aria-pressed={theme === 'dark'}
    >
      {/* Both icons render and cross-fade, so the button never reflows. */}
      <span className="swap" data-on={theme === 'dark'}>
        <Sun size={18} aria-hidden="true" className="swap__a" />
        <Moon size={18} aria-hidden="true" className="swap__b" />
      </span>
    </button>
  );
}

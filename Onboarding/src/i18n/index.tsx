/**
 * i18n — Arabic-first, bilingual, direction-aware.
 *
 * Direction is set once on <html> and cascades; every stylesheet uses logical
 * properties so nothing else needs to know which way the page runs.
 * Numerals default to Western (0-9) per rtl-bilingual §3 — standard across
 * Gulf UIs — and are never auto-converted.
 */
import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import ar from './ar.json';
import en from './en.json';

export type Locale = 'ar' | 'en';
export type Dir = 'rtl' | 'ltr';

const DICTS: Record<Locale, Record<string, string>> = { ar, en };
const STORAGE_KEY = 'itqan.locale';
/**
 * The key the MARKETING SITE writes when its language switch is used.
 *
 * It is a different key from this app's, and that mismatch was the bug behind
 * "onboarding changes my language": a user who chose English on the site had it
 * recorded under `itqan-lang`, which this app never read, so onboarding opened
 * in the Arabic default and looked like it had thrown the choice away. Both are
 * read here, and both are written on every change, so the preference survives
 * crossing between the two halves in either direction.
 */
const SITE_STORAGE_KEY = 'itqan-lang';

export const dirFor = (l: Locale): Dir => (l === 'ar' ? 'rtl' : 'ltr');

/**
 * Force Latin digits even in Arabic, so dates and scores read consistently.
 *
 * The tag is resolved through Intl once rather than trusted. A build with
 * trimmed ICU data throws RangeError on an unsupported tag, and because these
 * formatters are called during render that throw is a blank screen on whichever
 * device shipped the smaller build and nowhere else — the hardest class of bug
 * to report. Falling back to the bare language keeps the numerals right on every
 * engine that does support the extension and keeps the page up on any that does
 * not.
 */
const LOCALE_TAGS: Record<Locale, string[]> = {
  ar: ['ar-OM-u-nu-latn', 'ar-OM', 'ar'],
  en: ['en-GB', 'en'],
};

const resolveTag = (l: Locale): string | undefined => {
  for (const tag of LOCALE_TAGS[l]) {
    try {
      new Intl.NumberFormat(tag);
      new Intl.DateTimeFormat(tag);
      return tag;
    } catch {
      /* try the next, less specific tag */
    }
  }
  return undefined;   // the engine's own default; never throws
};

const RESOLVED: Record<Locale, string | undefined> = {
  ar: resolveTag('ar'),
  en: resolveTag('en'),
};

const intlLocale = (l: Locale) => RESOLVED[l];

interface I18nValue {
  locale: Locale;
  dir: Dir;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  formatDate: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (n: number) => string;
  /** Price plus its currency. A service returns the two separately, never a
   *  formatted string, so the "free only" filter and locale formatting both
   *  keep working. */
  formatMoney: (amount: number, currency: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const interpolate = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;

const asLocale = (v: string | null | undefined): Locale | null =>
  (v === 'ar' || v === 'en' ? v : null);

/** Reads the locale cookie the session was created with. */
function readCookieLocale(): Locale | null {
  if (typeof document === 'undefined') return null;
  return asLocale((document.cookie.match(/(?:^|; )itqan_locale=([^;]*)/) ?? [])[1]);
}

/**
 * Resolution order, most specific first: a choice made in this app, then one
 * made on the site, then the language the session was established in. Only if
 * all three are silent does the Arabic default apply.
 */
function readStored(): Locale | null {
  try {
    return asLocale(localStorage.getItem(STORAGE_KEY))
      ?? asLocale(localStorage.getItem(SITE_STORAGE_KEY))
      ?? readCookieLocale();
  } catch {
    return readCookieLocale();
  }
}

/**
 * Whether the user has actually chosen a language, on either half of the
 * product. Distinct from `readStored`, which also falls back to the session
 * cookie: the cookie records how the account was created, not a preference.
 */
export function hasStoredLocale(): boolean {
  try {
    return asLocale(localStorage.getItem(STORAGE_KEY)) !== null
      || asLocale(localStorage.getItem(SITE_STORAGE_KEY)) !== null;
  } catch {
    return false;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStored() ?? 'ar');
  const dir = dirFor(locale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      // Both keys, so returning to the marketing site keeps the same language.
      localStorage.setItem(STORAGE_KEY, l);
      localStorage.setItem(SITE_STORAGE_KEY, l);
    } catch {
      /* storage unavailable (private mode) — the choice just will not persist */
    }
    // The services answer in whatever language the session says, so the cookie
    // has to move with the toggle or the UI would flip while the data did not.
    // Same cookie the site sets at sign in, so both halves stay in step.
    document.cookie = `itqan_locale=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  const toggleLocale = useCallback(
    () => setLocale(locale === 'ar' ? 'en' : 'ar'),
    [locale, setLocale],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      interpolate(DICTS[locale][key] ?? DICTS.en[key] ?? key, vars),
    [locale],
  );

  const formatDate = useCallback(
    (iso: string, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      // Formatting is presentation. It is never worth taking a screen down for,
      // so anything the engine refuses degrades to the raw value.
      try {
        return new Intl.DateTimeFormat(intlLocale(locale), opts).format(d);
      } catch {
        return iso;
      }
    },
    [locale],
  );

  const formatNumber = useCallback(
    (n: number) => {
      try {
        return new Intl.NumberFormat(intlLocale(locale)).format(n);
      } catch {
        return String(n);
      }
    },
    [locale],
  );

  const formatMoney = useCallback(
    (amount: number, currency: string) => {
      try {
        return new Intl.NumberFormat(intlLocale(locale), {
          style: 'currency',
          currency,
          maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
        }).format(amount);
      } catch {
        // An unknown currency code throws too, and a price the user can still
        // read beats a screen that will not render.
        return `${currency} ${formatNumber(amount)}`;
      }
    },
    [locale, formatNumber],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;

    /**
     * Keep the SERVICES' language in step with the one on screen, on every
     * render of this provider rather than only when the toggle is used.
     *
     * The invariant that matters: `itqan_locale` always says whatever the user
     * is reading. Writing it only in setLocale left a gap with no way out — the
     * cookie can arrive already wrong (the site's login derives it from the
     * Referer, so signing in from a URL with no locale segment defaults it to
     * Arabic) and `FollowSessionLocale` deliberately refuses to overwrite a
     * stored UI preference, so nothing reconciled the two. An English UI then
     * asked the services for Arabic and they correctly obliged.
     *
     * Every agent-authored string arrives pre-localised, so the symptom was
     * Arabic content under English chrome across the dashboard, jobs and
     * courses. Hud's chat is only where it became impossible to miss, because
     * there the service's prose is the content.
     */
    document.cookie = `itqan_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [locale, dir]);

  const value = useMemo(
    () => ({ locale, dir, t, setLocale, toggleLocale, formatDate, formatNumber, formatMoney }),
    [locale, dir, t, setLocale, toggleLocale, formatDate, formatNumber, formatMoney],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

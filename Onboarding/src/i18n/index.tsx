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

export const dirFor = (l: Locale): Dir => (l === 'ar' ? 'rtl' : 'ltr');
/** Force Latin digits even in Arabic, so dates and scores read consistently. */
const intlLocale = (l: Locale) => (l === 'ar' ? 'ar-OM-u-nu-latn' : 'en-GB');

interface I18nValue {
  locale: Locale;
  dir: Dir;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  formatDate: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (n: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const interpolate = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;

function readStored(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'ar' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStored() ?? 'ar');
  const dir = dirFor(locale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
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
      return new Intl.DateTimeFormat(intlLocale(locale), opts).format(d);
    },
    [locale],
  );

  const formatNumber = useCallback(
    (n: number) => new Intl.NumberFormat(intlLocale(locale)).format(n),
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const value = useMemo(
    () => ({ locale, dir, t, setLocale, toggleLocale, formatDate, formatNumber }),
    [locale, dir, t, setLocale, toggleLocale, formatDate, formatNumber],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

import ar from './ar.json';
import en from './en.json';

export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ar';

const dictionaries = { ar, en } as const;

export type Dictionary = typeof ar;

export function t(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function isLocale(value: string | undefined): value is Locale {
  return value === 'ar' || value === 'en';
}

/** Swap the locale segment of a pathname, preserving the rest of the page path. */
export function alternatePath(pathname: string, target: Locale): string {
  const segments = pathname.split('/');
  if (isLocale(segments[1])) {
    segments[1] = target;
  } else {
    segments.splice(1, 0, target);
  }
  const joined = segments.join('/');
  return joined === '' ? `/${target}/` : joined;
}

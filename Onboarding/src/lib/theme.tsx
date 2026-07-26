/**
 * Theme — light/dark by flipping [data-theme] on <html>. Dark mode is a
 * semantic token swap in tokens.css, so nothing here knows about colour.
 * Defaults to the OS preference, then remembers the user's explicit choice.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark';
/* The SAME key the marketing site writes, so a theme chosen on either side
   is honoured by the other. One product, one preference. */
const KEY = 'itqan-theme';

const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

function initial(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch { /* private mode */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/**
 * Makes the API client available to any screen. Kept separate from the
 * onboarding state so data screens (roles, courses) can use it without
 * depending on onboarding at all.
 */
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createApi } from '../api';
import type { ItqanApi } from '../api';

const Ctx = createContext<ItqanApi | null>(null);

export function ApiProvider({ children }: { children: ReactNode }) {
  // Created once. Language is carried by the session cookie the site set, so
  // the client needs no locale of its own and switching language never tears
  // down in-flight work.
  const api = useMemo(() => createApi(), []);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApi() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApi must be used inside <ApiProvider>');
  return ctx;
}

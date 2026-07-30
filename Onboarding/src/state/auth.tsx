/**
 * Session state.
 *
 * This app does NOT sign anyone in. The marketing site owns log in and sign up;
 * its forms set a session cookie on this origin, and all this does is read it.
 * That is why there is no login(), no signup(), and no password anywhere in
 * this codebase — a second sign-in surface would be a second thing to keep in
 * step, and the first one to drift.
 *
 * `booting` exists so guarded routes can wait instead of bouncing a signed-in
 * user back to the site for the split second before the session resolves. That
 * flash is the classic auth bug and it is worth one extra state to avoid.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Locale } from '../i18n';
import type { User } from '../api';
import { useApi } from './api';
import { onAuthLost, resetAuthState } from '../api/client';

interface AuthValue {
  user: User | null;
  booting: boolean;
  /** The language the user was using on the site, if the session carried one. */
  sessionLocale: Locale | null;
  logout: () => Promise<void>;
  /** Called once onboarding completes so guards stop redirecting into it. */
  markOnboarded: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [user, setUser] = useState<User | null>(null);
  const [sessionLocale, setSessionLocale] = useState<Locale | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let alive = true;
    api.session()
      .then((s) => {
        if (!alive) return;
        setUser(s?.user ?? null);
        setSessionLocale(s?.locale ?? null);
      })
      .catch(() => { if (alive) setUser(null); })
      .finally(() => { if (alive) { setBooting(false); resetAuthState(); } });
    return () => { alive = false; };
  }, [api]);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
    resetAuthState();
  }, [api]);

  /**
   * A dead session has to clear THIS state, not just fail the request that
   * discovered it. Without this the app keeps rendering as signed-in while
   * every call 401s — the user sees a dashboard full of error states instead
   * of being sent back to sign in.
   *
   * The transport fires this once per dead session (see client.ts), so a screen
   * with six parallel requests does not produce six logouts.
   */
  useEffect(() => onAuthLost(() => {
    setUser(null);
    setBooting(false);
  }), []);

  const markOnboarded = useCallback(() => {
    setUser((u) => (u ? { ...u, onboarded: true } : u));
  }, []);

  const value = useMemo(
    () => ({ user, booting, sessionLocale, logout, markOnboarded }),
    [user, booting, sessionLocale, logout, markOnboarded],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

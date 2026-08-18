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

interface AuthValue {
  user: User | null;
  booting: boolean;
  /** The language the user was using on the site, if the session carried one. */
  sessionLocale: Locale | null;
  /**
   * The account's photo, or null for none.
   *
   * IT LIVES HERE because it is identity, and identity is what this context is
   * for. It used to live nowhere: `avatarUrl` is a field on `StoredProfile`,
   * read by exactly one component — the profile screen — so the sidebar had no
   * code path to a photo at all and always drew initials. Uploading one changed
   * the profile page and nothing else, and signing out and back in could not
   * help, because there was nothing to load it into.
   *
   * The SESSION does not carry it yet (see BACKEND.md §1.3), so it is fetched
   * from the profile once on boot. When the session starts returning it, seed
   * it from there and delete the fetch.
   */
  avatarUrl: string | null;
  /** Called by the profile screen the moment a photo is uploaded or removed,
   *  so the sidebar changes in the same breath rather than on the next reload. */
  setAvatarUrl: (url: string | null) => void;
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.session()
      .then((s) => {
        if (!alive) return;
        setUser(s?.user ?? null);
        setSessionLocale(s?.locale ?? null);
      })
      .catch(() => { if (alive) setUser(null); })
      .finally(() => { if (alive) setBooting(false); });
    return () => { alive = false; };
  }, [api]);

  /**
   * The photo, fetched once the session says who this is.
   *
   * A second request purely for one field, and deliberately so until the
   * session carries it: `booting` must not wait on it. The identity that gates
   * the routes is the session; the picture is decoration on top, and blocking
   * the whole app on it would trade a real bug for a slower boot.
   *
   * Only for a user who has ONBOARDED — before that there is no stored profile
   * to read, and asking would be a guaranteed 404 on every boot of the flow.
   */
  useEffect(() => {
    if (!user?.onboarded) { setAvatarUrl(null); return; }
    let alive = true;
    // A failure here means no picture, which is exactly the initials fallback.
    void api.getProfile()
      .then((p) => { if (alive) setAvatarUrl(p?.avatarUrl ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [api, user?.id, user?.onboarded]);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
    setAvatarUrl(null);
  }, [api]);

  const markOnboarded = useCallback(() => {
    setUser((u) => (u ? { ...u, onboarded: true } : u));
  }, []);

  const value = useMemo(
    () => ({ user, booting, sessionLocale, avatarUrl, setAvatarUrl, logout, markOnboarded }),
    [user, booting, sessionLocale, avatarUrl, logout, markOnboarded],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Routes, providers and guards.
 *
 * There are no log in or sign up routes here on purpose. Those pages exist on
 * the marketing site and are the only place an account is created. A visitor
 * without a session is sent to the SITE's login page, in their language,
 * rather than to a second one built here.
 *
 * The remaining guards encode two rules:
 *   - onboarding is a gate, not a suggestion: a signed-in user who has not
 *     finished it cannot reach the dashboard by typing a URL;
 *   - it is a gate you pass once: a user who HAS finished can never be dropped
 *     back into it, which is the bug that makes returning users feel forgotten.
 *
 * Everything waits on `booting` so a signed-in user is never bounced back to
 * the site while the session is still being read.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { I18nProvider, useI18n } from './i18n';
import { ThemeProvider } from './lib/theme';
import { ApiProvider, useApi } from './state/api';
import { AuthProvider, useAuth } from './state/auth';
import { OnboardingProvider, useOnboarding } from './state/onboarding';

import { Upload } from './screens/Upload';
import { Questions } from './screens/Questions';
import { Confirm } from './screens/Confirm';
import { AppLayout } from './app/AppLayout';
import { Dashboard } from './app/Dashboard';
import { Jobs } from './app/Jobs';
import { Courses } from './app/Courses';

/** Full-page hold while the session is read. Deliberately quiet. */
function Booting() {
  const { t } = useI18n();
  return (
    <div className="boot" role="status" aria-live="polite">
      <span className="spinner spinner--lg" aria-hidden="true" />
      <span className="sr-only">{t('state.loading')}</span>
    </div>
  );
}

/**
 * Hands an unauthenticated visitor back to the site's own login page. A full
 * navigation, not a route change: the login page belongs to the other app.
 */
function ToSiteLogin() {
  const { locale } = useI18n();
  useEffect(() => {
    window.location.assign(`/${locale}/login/`);
  }, [locale]);
  return <Booting />;
}

/** Signed in, and still onboarding. */
function RequireOnboarding({ children }: { children: ReactNode }) {
  const { user, booting } = useAuth();
  if (booting) return <Booting />;
  if (!user) return <ToSiteLogin />;
  if (user.onboarded) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Signed in, and finished. */
function RequireApp({ children }: { children: ReactNode }) {
  const { user, booting } = useAuth();
  if (booting) return <Booting />;
  if (!user) return <ToSiteLogin />;
  if (!user.onboarded) return <Navigate to="/upload" replace />;
  return <>{children}</>;
}

/**
 * The later onboarding steps need flow state that only exists in memory. A
 * reload or a pasted URL lands there with nothing, so this sends them back to
 * the first step, which is where the "pick up where you left off" offer lives.
 */
function RequireFlow({ children }: { children: ReactNode }) {
  const { entry, documents, analysis } = useOnboarding();
  const started = entry === 'manual' || documents.length > 0 || !!analysis;
  if (!started) return <Navigate to="/upload" replace />;
  return <>{children}</>;
}

/** Onboarding state needs the client and only tracks progress while relevant. */
function WithOnboarding({ children }: { children: ReactNode }) {
  const api = useApi();
  const { user } = useAuth();
  return (
    <OnboardingProvider api={api} enabled={!!user && !user.onboarded}>
      {children}
    </OnboardingProvider>
  );
}

/** Adopts the language the user was already using on the site. */
function FollowSessionLocale() {
  const { sessionLocale } = useAuth();
  const { locale, setLocale } = useI18n();
  useEffect(() => {
    if (sessionLocale && sessionLocale !== locale) setLocale(sessionLocale);
    // Runs only when the session first reports a language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLocale]);
  return null;
}

function SkipLink() {
  const { t } = useI18n();
  return <a href="#main" className="skip-link">{t('a11y.skipToContent')}</a>;
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        {/* basename keeps the site at the root and this app under /app. */}
        <BrowserRouter basename="/app">
          <ApiProvider>
            <AuthProvider>
              <FollowSessionLocale />
              <WithOnboarding>
                <SkipLink />
                <Routes>
                  <Route path="/upload" element={<RequireOnboarding><Upload /></RequireOnboarding>} />
                  <Route path="/questions" element={<RequireOnboarding><RequireFlow><Questions /></RequireFlow></RequireOnboarding>} />
                  <Route path="/confirm" element={<RequireOnboarding><RequireFlow><Confirm /></RequireFlow></RequireOnboarding>} />

                  <Route element={<RequireApp><AppLayout /></RequireApp>}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/jobs" element={<Jobs />} />
                    <Route path="/courses" element={<Courses />} />
                  </Route>

                  {/* Entry point: the guards decide where this actually lands. */}
                  <Route path="*" element={<RequireApp><Navigate to="/dashboard" replace /></RequireApp>} />
                </Routes>
              </WithOnboarding>
            </AuthProvider>
          </ApiProvider>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

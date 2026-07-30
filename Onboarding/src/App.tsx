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
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { I18nProvider, useI18n } from './i18n';
import { ThemeProvider } from './lib/theme';
import { ApiProvider, useApi } from './state/api';
import { AuthProvider, useAuth } from './state/auth';
import { OnboardingProvider, useOnboarding } from './state/onboarding';
import { siteLogin } from './lib/site';
import { setApiLocale } from './api/http';
import { ErrorBoundary } from './components/ErrorBoundary';

import { Upload } from './screens/Upload';
import { Questions } from './screens/Questions';
import { Confirm } from './screens/Confirm';
import { ResumeGate } from './screens/ResumeGate';
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
    window.location.assign(siteLogin(locale));
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
 * The later onboarding steps need flow state that only exists in memory, so a
 * reload or a pasted URL lands there with nothing.
 *
 * Three cases, in order, and the order is the fix:
 *   still checking  — hold. Deciding before the saved-progress lookup answers
 *                     is what made a reload race the fetch and always lose.
 *   saved progress  — offer to restore it HERE, on the step they were on. A
 *                     phone browser reloads a backgrounded tab, so bouncing to
 *                     step one meant this screen "did not load" on exactly the
 *                     devices that discard tabs and worked everywhere else.
 *   nothing saved   — step one really is where they belong.
 */
function RequireFlow({ children }: { children: ReactNode }) {
  const { entry, documents, analysis, resumable, checking } = useOnboarding();
  const started = entry === 'manual' || documents.length > 0 || !!analysis;
  if (started) return <>{children}</>;
  if (checking) return <Booting />;
  if (resumable) return <ResumeGate />;
  return <Navigate to="/upload" replace />;
}

/**
 * One boundary around the routed screen rather than around the whole tree, so a
 * screen that throws does not take the providers, the session or the language
 * with it — and so navigating away is enough to recover.
 */
function ScreenBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  return (
    <ErrorBoundary
      resetKey={pathname}
      title={t('state.errorTitle')}
      body={t('state.errorSub')}
      retryLabel={t('action.retry')}
    >
      {children}
    </ErrorBoundary>
  );
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

  /**
   * Keeps the API layer's language in step with the UI's.
   *
   * The backend sends human-readable strings as {en, ar} pairs and the mapper
   * in http.ts picks one. It needs to know which — and it is a plain module,
   * not a hook, so it cannot read the i18n context itself. Without this the
   * picker silently stays on its default and an English user gets Arabic job
   * titles, which looks like a backend bug and is not one.
   */
  useEffect(() => { setApiLocale(locale); }, [locale]);

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
        {/* Follows Vite's base: /app in dev where the site owns the root, and
            / in production where this app is its own deployment. */}
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <ApiProvider>
            <AuthProvider>
              <FollowSessionLocale />
              <WithOnboarding>
                <SkipLink />
                <ScreenBoundary>
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
                </ScreenBoundary>
              </WithOnboarding>
            </AuthProvider>
          </ApiProvider>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

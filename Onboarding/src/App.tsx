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
import { useEffect, useRef, type ReactNode } from 'react';
import { I18nProvider, useI18n, hasStoredLocale } from './i18n';
import { ThemeProvider } from './lib/theme';
import { ApiProvider, useApi } from './state/api';
import { AuthProvider, useAuth } from './state/auth';
import { OnboardingProvider, useOnboarding } from './state/onboarding';
import { ChatProvider } from './state/chat';
import { UpdateProvider } from './state/update';
import { RateProvider } from './state/rate';
import { FeedbackProvider } from './state/feedback';
import { siteLogin, siteVerify } from './lib/site';
import { ErrorBoundary } from './components/ErrorBoundary';

import { Upload } from './screens/Upload';
import { Questions } from './screens/Questions';
import { Confirm } from './screens/Confirm';
import { ResumeGate } from './screens/ResumeGate';
import { AppLayout } from './app/AppLayout';
import { Chat } from './app/Chat';
import { Dashboard } from './app/Dashboard';
import { Jobs } from './app/Jobs';
import { Courses } from './app/Courses';
import { Documents } from './app/Documents';
import { Profile } from './app/Profile';
import { Settings } from './app/Settings';
import { Plan } from './app/Plan';
import { captureUpgradeIntent, clearUpgradeIntent, hasUpgradeIntent } from './state/upgradeIntent';

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

/**
 * Signed in but the address is not proved yet — back to the site's code page.
 *
 * A full navigation, like `ToSiteLogin`, because verification is an auth screen
 * and the site owns those. Note this is NOT what enforces verification: the API
 * answers 403 `email_unverified` on every route that advances onboarding, so a
 * build of this app made before the guard existed is a confusing experience
 * rather than a way past it.
 */
function ToSiteVerify() {
  const { locale } = useI18n();
  useEffect(() => {
    window.location.assign(siteVerify(locale));
  }, [locale]);
  return <Booting />;
}

/** Signed in, and still onboarding. */
function RequireOnboarding({ children }: { children: ReactNode }) {
  const { user, booting } = useAuth();
  if (booting) return <Booting />;
  if (!user) return <ToSiteLogin />;
  // Before the `onboarded` check, not after: an unverified account cannot have
  // finished onboarding, so testing that first would bounce them to /upload —
  // a screen whose every action the API refuses — instead of to the one page
  // that can actually unblock them.
  if (!user.emailVerified) return <ToSiteVerify />;
  if (user.onboarded) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/**
 * The upload step, when a run is already under way.
 *
 * Signing in again mid-run landed here at step 1/3, with the bar reading
 * "Finished reading your documents — 100%", both files listed "Ready", and a
 * primary button offering to read them again — which starts a SECOND run and
 * charges for it. The "Pick up where you left off" offer routes correctly but
 * appeared on two logins out of four, because it depends on the resumable check
 * racing the poll; deciding it at the route removes the race rather than making
 * the offer more reliable.
 *
 * To /questions and NOT /confirm, even when the extraction has finished. The
 * flow deliberately overlaps answering the questions with Agent A's reading, so
 * jumping to confirm would silently discard answers the person had not given
 * yet — and /questions already knows what to do with a finished run: it has its
 * own `done` state and moves on by itself.
 *
 * Scoped to THIS route rather than living in `RequireOnboarding`, which is the
 * mistake the first version made: that guard also wraps /questions, so a run
 * finishing while somebody was mid-answer yanked the page out from under them.
 * The e2e suite caught it as a `.choice` button detaching from the DOM.
 *
 * `reuploading` is excluded: that flow deliberately re-enters /upload while a
 * finished result already exists on the profile.
 */
function UploadStep({ children }: { children: ReactNode }) {
  const { documents, analysis, reuploading } = useOnboarding();
  const started = !!analysis && documents.length > 0;
  if (started && !reuploading) return <Navigate to="/questions" replace />;
  return <>{children}</>;
}

/**
 * The confirm step, which two different users can legitimately reach: someone
 * finishing onboarding, and someone who has already finished and is re-reading
 * replaced documents from /documents.
 *
 * The plain onboarding guard cannot express that — it sends every finished user
 * to the dashboard, which would make the re-upload button a dead end. The extra
 * door only opens while a re-read is actually in flight, so a finished user
 * still cannot wander back into the flow by typing the URL.
 */
function RequireConfirmable({ children }: { children: ReactNode }) {
  const { user, booting } = useAuth();
  const { reuploading, profile } = useOnboarding();
  if (booting) return <Booting />;
  if (!user) return <ToSiteLogin />;
  if (!user.emailVerified) return <ToSiteVerify />;
  /**
   * `!profile` is what stops this guard racing the screen it guards.
   *
   * Confirm finishes by calling `markOnboarded()` and then `navigate('/chat')`.
   * React Router 7 wraps its location update in `startTransition`, so it is a
   * LOW priority update, while `markOnboarded` is an ordinary urgent one. React
   * therefore renders the urgent one first — still on `/confirm`, but now with
   * `onboarded: true` — this guard fired, and its `<Navigate to="/dashboard">`
   * committed and cancelled the pending transition to `/chat`.
   *
   * The effect was that a first run always landed on the dashboard, silently,
   * while the comments here and at the end of Confirm both said it lands in
   * chat. It never did.
   *
   * `profile` is set by `completeProfile()` in the same breath as the confirm
   * succeeding, so it marks exactly the window in which Confirm owns where the
   * user goes next. A returning user typing this URL has no in-memory profile
   * and is still sent to the dashboard, which is the case this guard is for.
   */
  if (user.onboarded && !reuploading && !profile) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** Signed in, and finished. */
function RequireApp({ children }: { children: ReactNode }) {
  const { user, booting } = useAuth();
  if (booting) return <Booting />;
  if (!user) return <ToSiteLogin />;
  if (!user.emailVerified) return <ToSiteVerify />;
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
  const { user } = useAuth();
  const started = entry === 'manual' || documents.length > 0 || !!analysis;
  if (started) return <>{children}</>;
  if (checking) return <Booting />;
  if (resumable) return <ResumeGate />;
  // Step one differs by user: onboarding starts at /upload, but a finished user
  // who lost their re-read state belongs on /documents. Sending them to /upload
  // would bounce them to the dashboard and lose the action they just took.
  return <Navigate to={user?.onboarded ? '/documents' : '/upload'} replace />;
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

/**
 * Chat state lives above the router so a thread survives a trip to Jobs and
 * back, and so the sidebar can list saved ones from anywhere in the app. The
 * open thread is deliberately NOT restored on a cold boot: a conversation
 * resumed silently a week later reads as the product
 * having remembered something the user did not ask it to.
 */
function WithChat({ children }: { children: ReactNode }) {
  const api = useApi();
  /* INSIDE the chat provider, because the update run reuses its poll loop and
     its results counter. Two poll loops racing one counter is a bug nobody
     would find until two screens disagreed about the same run. */
  /* `RateProvider` reads the route and the pipeline, so it sits inside both the
     router and the onboarding state. It renders nothing on its own — the prompt
     is mounted by the app shell. */
  return (
    <ChatProvider api={api}>
      <UpdateProvider>
        <RateProvider>{children}</RateProvider>
      </UpdateProvider>
    </ChatProvider>
  );
}

/**
 * Likes and dislikes, above the router so a verdict given on the dashboard is
 * still there on the courses page. Only loaded for a finished user: there is
 * nothing to rate during onboarding, and asking the endpoint before the account
 * has any recommendations would be a request that can only answer "none".
 */
function WithFeedback({ children }: { children: ReactNode }) {
  const api = useApi();
  const { user } = useAuth();
  return (
    <FeedbackProvider api={api} enabled={!!user?.onboarded}>
      {children}
    </FeedbackProvider>
  );
}

/** Adopts the language the user was already using on the site. */
function FollowSessionLocale() {
  const { sessionLocale } = useAuth();
  const { locale, setLocale } = useI18n();
  useEffect(() => {
    /*
     * The session's language is a FALLBACK, not an instruction.
     *
     * It used to be applied unconditionally, which is why the language could
     * change part way through onboarding: the session carries whichever locale
     * the account was created in, so a user who signed up on the Arabic site
     * and then switched to English had their choice overwritten the moment
     * /auth/session answered. A stored preference is the more recent and more
     * deliberate signal, so it wins; the session only speaks when nothing has
     * been chosen on either half of the product.
     */
    if (!sessionLocale || sessionLocale === locale) return;
    if (hasStoredLocale()) return;
    setLocale(sessionLocale);
    // Runs only when the session first reports a language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLocale]);
  return null;
}

function SkipLink() {
  const { t } = useI18n();
  return <a href="#main" className="skip-link">{t('a11y.skipToContent')}</a>;
}

/**
 * Move focus and scroll to the top of the new screen on every route change.
 *
 * A single page app gets none of this for free. The browser does it on a real
 * navigation; React just swaps the subtree and changes the URL, so focus stays
 * where it was — and after a "Continue" button that is an element which no
 * longer exists, which drops focus to <body>. The practical effect was that
 * someone advancing upload -> questions -> confirm on a screen reader was told
 * nothing at each step and had to walk the document from the top to find out
 * where they had landed. Every one of the ten routes had this.
 *
 * `#main` is the same landmark the skip link targets, and it is the right
 * destination for both: it skips the chrome and starts at the screen's heading.
 *
 * Deliberately skipped on first paint. The initial load already starts at the
 * top, and taking focus there would fight the skip link before the user has
 * pressed anything.
 *
 * `preventScroll` because the scroll reset below owns vertical position;
 * letting focus() also scroll makes the two fight on a short screen.
 */
/**
 * Keeps the browser tab's title honest.
 *
 * index.html can only ship one static string, and it said "Itqan — Onboarding"
 * for the life of the session: still there on the dashboard, on jobs, on
 * courses, months after onboarding was finished. Onboarding is a phase, not the
 * product, and a tab that keeps announcing it makes a finished account look
 * unfinished — in a browser with a dozen tabs open, the title IS the product's
 * name.
 *
 * Driven by `user.onboarded`, the server-owned flag, rather than by the route:
 * an onboarded user glancing at /documents to re-upload is not onboarding
 * again. Localised, because the title is the most visible piece of copy the
 * product has and the Arabic side should not read English in the tab.
 */
function DocumentTitle() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const onboarded = !!user?.onboarded;

  useEffect(() => {
    document.title = onboarded ? t('doc.title.brand') : t('doc.title.onboarding');
  }, [onboarded, t, locale]);

  return null;
}

/**
 * Take the "I came to buy" intent out of its carriers, once, on arrival.
 *
 * Runs before any route resolves so the catch-all below can already see it.
 * Everything about spending it lives in the two places that redirect: the end
 * of Confirm for a first run, and the catch-all here for someone who already
 * had an account.
 */
function CaptureIntent() {
  useEffect(() => { captureUpgradeIntent(); }, []);
  return null;
}

/**
 * Where a signed-in user with no route actually lands.
 *
 * Normally the dashboard: a returning user is coming back to their results.
 * But someone who pressed premium on the marketing site and turned out to
 * ALREADY have a finished account never passes through Confirm, so this is the
 * only place their intent can be honoured. Spent here rather than remembered,
 * so a second visit behaves normally.
 */
function Landing() {
  const onboarded = useAuth().user?.onboarded;
  const wants = onboarded && hasUpgradeIntent();
  useEffect(() => { if (wants) clearUpgradeIntent(); }, [wants]);
  return <Navigate to={wants ? '/plan' : '/dashboard'} replace />;
}

function RouteFocus() {
  const { pathname } = useLocation();
  const firstPaint = useRef(true);

  useEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <CaptureIntent />
        {/* Follows Vite's base: /app in dev where the site owns the root, and
            / in production where this app is its own deployment. */}
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <ApiProvider>
            <AuthProvider>
              <FollowSessionLocale />
              <WithOnboarding>
                <WithFeedback>
                <WithChat>
                  <SkipLink />
                  <DocumentTitle />
                  <RouteFocus />
                  <ScreenBoundary>
                    <Routes>
                      <Route path="/upload" element={<RequireOnboarding><UploadStep><Upload /></UploadStep></RequireOnboarding>} />
                      <Route path="/questions" element={<RequireOnboarding><RequireFlow><Questions /></RequireFlow></RequireOnboarding>} />
                      <Route path="/confirm" element={<RequireConfirmable><RequireFlow><Confirm /></RequireFlow></RequireConfirmable>} />

                      <Route element={<RequireApp><AppLayout /></RequireApp>}>
                        {/* Chat leads because it is now the way in to the rest.
                            A saved conversation gets its own address so it
                            survives a reload and can be linked. */}
                        <Route path="/chat" element={<Chat />} />
                        <Route path="/chat/:threadId" element={<Chat />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/jobs" element={<Jobs />} />
                        <Route path="/courses" element={<Courses />} />
                        <Route path="/documents" element={<Documents />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/plan" element={<Plan />} />
                      </Route>

                      {/* Entry point: the guards decide where this actually lands.
                          Still the dashboard, not chat: a returning user is coming
                          back to their results. A FIRST run lands in chat instead,
                          and that redirect lives at the end of Confirm, where the
                          state that decides it actually exists. */}
                      <Route path="*" element={<RequireApp><Landing /></RequireApp>} />
                    </Routes>
                  </ScreenBoundary>
                </WithChat>
                </WithFeedback>
              </WithOnboarding>
            </AuthProvider>
          </ApiProvider>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}

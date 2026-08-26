/**
 * Hud. A conversation, with the actionable parts handed over as cards.
 *
 * SCROLLING IS THE DETAIL WORTH READING TWICE. Every chat wants to follow the
 * bottom of the newest text, and every chat is wrong to: an answer of any length
 * then finishes with its last line on screen and its first line somewhere above,
 * so the reader has to scroll UP to start reading. This scrolls each new turn so
 * its TOP is at the top, and then leaves the page alone while the text grows
 * downward into the space already in front of them. They read forwards.
 *
 * WHERE HUD IS. The illustrated, animated mascot appears once, in the greeting,
 * at his 120px floor. Once a thread starts he is not in the chrome at all: each
 * assistant turn carries the compact icon mark beside it, still when idle and
 * bobbing while the text arrives, scrolling with the message the way Claude's and
 * ChatGPT's marks do. See Message.tsx for why the avatar is the mark rather than
 * a shrunken bird.
 *
 * HE IS HERE AT ALL by an explicit, dated exception to the brand fence
 * (workspace PRODUCT.md, 2026-08-17). The condition is the split this screen
 * enforces structurally: Hud talks, and anything the user might act on is handed
 * over as a MatchCard or CourseCard carrying its own why, source and confidence.
 *
 * The greeting is authored on the client, not fetched, because an empty state
 * that waits on a round trip is a blank screen with extra steps.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useChat } from '../state/chat';
import { useApi } from '../state/api';
import { useAsync } from '../lib/useAsync';
import { Message } from '../components/Message';
import { Composer } from '../components/Composer';
import { Hud } from '../components/Hud';
import { Callout, LoadingBlock } from '../components/ui';
import { Button } from '../components/ui';

export function Chat() {
  const { t } = useI18n();
  const { threadId: param } = useParams();
  const navigate = useNavigate();
  const api = useApi();

  /**
   * ONE FETCH FOR THE WHOLE THREAD, handed down to every turn.
   *
   * It lived inside `Message` for a moment, which renders once per turn — so a
   * twenty message conversation asked the server for the same token pool twenty
   * times on open. The thread is the thing that has one budget, so the thread is
   * what asks.
   */
  const { data: usage } = useAsync((s) => api.getUsage(s), [api]);

  const {
    threadId, messages, loading, pending, failed, failedReason, writingId, verdicts,
    ask, retryMessage, retry, rate, rerun, open, reset, doneWriting,
    setOnAwaitingConfirmation,
  } = useChat();

  /* A full re-run ends at the confirm step, and the person belongs there rather
     than on a finished-looking chat card. Registered here because this is the
     layer that owns navigation. */
  useEffect(() => {
    setOnAwaitingConfirmation(() => () => navigate('/confirm'));
    return () => setOnAwaitingConfirmation(undefined);
  }, [navigate, setOnAwaitingConfirmation]);

  const thread = useRef<HTMLOListElement>(null);
  const count = messages.length;
  const started = count > 0;

  /**
   * ARRIVING FROM ONBOARDING WITHOUT A ROLE IN MIND.
   *
   * The confirm screen sets `findRole` when the user answered "not yet" to
   * whether they know what job they want. Two things follow, and they are
   * separate on purpose:
   *
   *  - a welcome line is rendered ABOVE the thread, authored on the client for
   *    the same reason the greeting is: it is orientation, not an answer, and
   *    waiting on a round trip to say hello is a blank screen with extra steps;
   *  - the roles question is asked once, automatically, so Hud's first turn is
   *    the real one — three roles drawn from their own courses, each with the
   *    reasoning, plus live postings attached as cards. That answer has to come
   *    from the service. Authoring role names on the client would be inventing
   *    the single most consequential sentence this product says to anyone.
   *
   * Captured into state on the first render because the effect below rewrites
   * the URL to `/chat/:threadId`, which discards `location.state` — reading it
   * lazily would lose the flag before the auto-ask fires.
   */
  const location = useLocation();
  const [findRole] = useState(
    () => (location.state as { findRole?: boolean } | null)?.findRole === true);
  const asked = useRef(false);

  useEffect(() => {
    if (!findRole || asked.current) return;
    // Guarded against a thread that already exists: arriving back here later
    // must not append the same question to a conversation in progress.
    if (param || threadId || count > 0 || loading) return;
    asked.current = true;
    ask(t('chat.open.roles'));
    // Fires once, on arrival. `ask` and `t` are stable enough that adding them
    // would only risk re-running this against a thread the user has moved on in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findRole, param, threadId, count, loading]);

  /* The URL owns which conversation is showing. A param that does not match the
     loaded thread means the user arrived by link or by the sidebar; no param at
     all means a new one. */
  useEffect(() => {
    if (param && param !== threadId) open(param);
    if (!param && threadId) reset();
    // Reacting to the URL only. Adding the callbacks would re-run this on every
    // state change and fight the user for control of the thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param]);

  /* A thread created by asking gets its own address, so it survives a reload and
     can be linked. `replace`, because the empty composer is not a place anyone
     wants to come back to. */
  useEffect(() => {
    if (threadId && !param) navigate(`/chat/${threadId}`, { replace: true });
  }, [threadId, param, navigate]);

  /**
   * Put the newest turn's TOP at the top. Keyed on the count so it fires when a
   * turn arrives and not while one is being typed out — re-running mid-reveal
   * would drag the page down line by line, which is the behaviour this exists to
   * avoid.
   */
  useEffect(() => {
    if (count === 0) return;
    const turns = thread.current?.children;
    const newest = turns?.[turns.length - 1];
    newest?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [count]);

  return (
    <div className="chat" data-started={started || undefined}>
      {/* Suppressed on the findRole path: the generic "how can I help today"
          would flash for the moment between arriving and the auto-asked turn
          landing, which is the wrong question asked of someone who has just
          told us they do not know the answer. */}
      {!started && !loading && !findRole && (
        <div className="greet">
          <div className="greet__hud">
            <Hud pose="waving" then="idle" loop size="md" eager />
          </div>
          <h1 className="greet__title">{t('chat.opening')}</h1>
          <div className="suggests suggests--center">
            {[t('chat.open.roles'), t('chat.open.skills'), t('chat.open.courses')].map((s) => (
              <button key={s} type="button" className="suggest" onClick={() => ask(s)} disabled={pending}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <LoadingBlock rows={4} />}

      {/* The welcome for someone who arrived here without a role in mind. It
          sits above the thread and stays there, because it is the frame for the
          whole conversation rather than a turn in it — and because a greeting
          that vanishes the moment the first answer lands never gets read. */}
      {findRole && (
        <p className="chat__welcome">{t('chat.welcomeRoles')}</p>
      )}

      {started && (
        <>
          {/* Visible headings belong on screens you scan; a conversation is one
              you read. The heading still exists, because a screen without one
              leaves a screen-reader user with nothing to orient by. */}
          <h1 className="sr-only">{t('chat.title')}</h1>
          <ol className="thread" ref={thread}>
          {messages.map((m, i) => (
            <Message
              key={m.id}
              message={m}
              onSuggest={ask}
              onRetry={retryMessage}
              onRate={rate}
              onRerun={rerun}
              verdict={verdicts[m.id]}
              busy={pending}
              isLast={i === count - 1}
              writing={writingId === m.id}
              onWritten={doneWriting}
              usage={usage}
            />
            ))}
          </ol>
        </>
      )}

      {/* Announced without stealing focus, the same pattern PipelineProgress
          uses: the reader may be part way through a card when this resolves. */}
      <div className="chat__status" role="status" aria-live="polite">
        {pending && (
          <p className="waiting">
            <span className="waiting__dots" aria-hidden="true"><i /><i /><i /></span>
            {t('chat.thinking')}
          </p>
        )}
      </div>

      {failed && (
        <Callout tone="danger">
          <div className="stack stack--sm">
            {/* THE SERVER'S REASON WHERE THERE IS ONE. Every failure used to
                read "that did not come back", including the one a person can
                act on: no tokens left today. That told somebody their question
                was lost when their budget was spent, and offered a retry that
                could only be refused again. */}
            <p>{failedReason ?? t('chat.failed')}</p>
            {!failedReason && (
              <div><Button variant="secondary" onClick={retry}>{t('action.retry')}</Button></div>
            )}
          </div>
        </Callout>
      )}

      <Composer onAsk={ask} busy={pending} />
    </div>
  );
}

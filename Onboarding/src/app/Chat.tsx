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
import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useChat } from '../state/chat';
import { Message } from '../components/Message';
import { Composer } from '../components/Composer';
import { Hud } from '../components/Hud';
import { Callout, LoadingBlock } from '../components/ui';
import { Button } from '../components/ui';

export function Chat() {
  const { t } = useI18n();
  const { threadId: param } = useParams();
  const navigate = useNavigate();
  const {
    threadId, messages, loading, pending, failed, writingId, verdicts,
    ask, retryMessage, retry, rate, rerun, open, reset, doneWriting,
  } = useChat();

  const thread = useRef<HTMLOListElement>(null);
  const count = messages.length;
  const started = count > 0;

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
      {!started && !loading && (
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
            <p>{t('chat.failed')}</p>
            <div><Button variant="secondary" onClick={retry}>{t('action.retry')}</Button></div>
          </div>
        </Callout>
      )}

      <Composer onAsk={ask} busy={pending} />
    </div>
  );
}

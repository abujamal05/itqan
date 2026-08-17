/**
 * Hud. A conversation, with the actionable parts handed over as cards.
 *
 * ONE HUD, EVER — and it is worth being precise about how that is guaranteed,
 * because it is the kind of rule that decays quietly.
 *
 * There are exactly two <Hud> call sites below and they are mutually exclusive
 * on `started`: the greeting owns him while the thread is empty, the page header
 * owns him once it is not. They can never both be mounted, because the same flag
 * that shows one hides the other, and `ask()` flips it in a single React commit.
 *
 * He is NOT rendered per message. Message.tsx contains no mascot on purpose: a
 * six-turn thread would otherwise show six of him, which is both the obvious bug
 * and the thing that makes a mascot feel cheap. That is the one edit that breaks
 * this, so the rule is written in that file too.
 *
 * `key={pose}` is load bearing, not habit. Hud's own loader bails out with
 * `if (video.src) return`, so handing a mounted instance a new pose changes the
 * prop and nothing else — the old clip keeps playing. Keying on the pose remounts
 * it, which swaps the clip without touching mascot code the onboarding screens
 * also depend on.
 *
 * Below 34rem of content column the header mascot steps aside entirely rather
 * than shrinking: 120px is his floor, under which the brand rules call him visual
 * noise, and a phone mid-conversation has better uses for 120px than a bird. One
 * is the ceiling here, never a quota.
 *
 * HE IS HERE AT ALL by an explicit, dated exception to the brand fence
 * (workspace PRODUCT.md, 2026-08-17). The condition is the split this screen
 * enforces structurally: Hud talks, and anything the user might act on is handed
 * over as a MatchCard or CourseCard carrying its own why, source and confidence.
 * A score or a match written into his prose would break the exception rather
 * than use it.
 *
 * The greeting is authored on the client, not fetched, because an empty state
 * that waits on a round trip is a blank screen with extra steps.
 */
import { useEffect, useRef } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useI18n } from '../i18n';
import { useChat } from '../state/chat';
import { Message } from '../components/Message';
import { Composer } from '../components/Composer';
import { Hud } from '../components/Hud';
import { Button, Callout } from '../components/ui';
import type { Pose } from '../components/Hud';

export function Chat() {
  const { t } = useI18n();
  const { messages, pending, failed, ask, retry, reset } = useChat();
  const end = useRef<HTMLDivElement>(null);
  const count = messages.length;
  const started = count > 0;

  /**
   * Follow the conversation as it grows.
   *
   * Keyed on the count rather than the array so it fires when a turn arrives and
   * not when anything else changes — being yanked to the bottom while reading a
   * card further up is the classic chat annoyance.
   */
  useEffect(() => {
    if (count === 0) return;
    end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [count]);

  const pose: Pose = pending ? 'thinking' : failed ? 'error' : 'idle';
  const openers = [t('chat.open.roles'), t('chat.open.skills'), t('chat.open.courses')];

  return (
    <div className="chat" data-started={started || undefined}>
      <div className="chat__head">
        <div className="stack stack--sm chat__headText">
          <h1 className="headline">{t('chat.title')}</h1>
          <p className="subhead">{t('chat.sub')}</p>
        </div>

        {started && (
          <>
            {/* Hud's second and only other home. */}
            <div className="chat__hud" data-pose={pose}>
              <Hud key={pose} pose={pose} loop size="sm" />
            </div>
            <Button variant="ghost" onClick={reset}>
              <MessageSquarePlus size={16} aria-hidden="true" />
              {t('chat.newThread')}
            </Button>
          </>
        )}
      </div>

      {!started && (
        <div className="greet">
          <div className="greet__hud">
            <Hud pose="waving" then="idle" loop size="md" eager />
          </div>
          <p className="greet__line">{t('chat.opening')}</p>
          <div className="suggests__row suggests__row--center">
            {openers.map((s) => (
              <button key={s} type="button" className="suggest" onClick={() => ask(s)} disabled={pending}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {started && (
        <ol className="thread">
          {messages.map((m, i) => (
            <Message
              key={m.id}
              message={m}
              onSuggest={ask}
              busy={pending}
              isLast={i === count - 1}
            />
          ))}
        </ol>
      )}

      {/* Announced without stealing focus, the same pattern PipelineProgress
          uses: the reader may well be part way through a card when this
          resolves, and pulling them out of it would be the wrong trade. */}
      <div className="chat__status" role="status" aria-live="polite">
        {pending && <p className="thinking__line">{t('chat.thinking')}</p>}
      </div>

      {failed && (
        <Callout tone="danger">
          <div className="stack stack--sm">
            <p>{t('chat.failed')}</p>
            <div>
              <Button variant="secondary" onClick={retry}>{t('action.retry')}</Button>
            </div>
          </div>
        </Callout>
      )}

      <div ref={end} />

      <Composer onAsk={ask} busy={pending} />
    </div>
  );
}

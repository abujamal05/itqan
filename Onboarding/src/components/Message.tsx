/**
 * One turn in the conversation.
 *
 * THE AVATAR IS THE MARK, NOT THE MASCOT ARTWORK, and that is a deliberate
 * resolution rather than a shortcut. The brand floors Hud's illustrated form at
 * 120px, below which it is noise — so a 24px crop of the animated bird would
 * break a locked rule and look bad doing it. The compact icon mark is the asset
 * drawn for this size and already used in chrome at 36px; it is the same hoopoe,
 * and it is exactly what Claude and ChatGPT put beside a turn. The illustrated,
 * animated Hud keeps its floor in the greeting, where there is room for it.
 *
 * He is STILL when idle and MOVES while writing: the mark gets a slow bob for as
 * long as the text is arriving, then stops. One avatar per assistant turn, beside
 * the message and scrolling with it, so it is where the eye already is rather
 * than parked in the chrome.
 *
 * The two roles are shaped differently on purpose. A user's turn is a short
 * quoted thing, so it gets a filled bubble on the reading-end side. Hud's turn is
 * often several sentences plus cards, so it gets no bubble at all: a paragraph in
 * a tinted balloon is harder to read than the same paragraph on the page.
 *
 * NO LABELS over the cards or the chips. They are self-evident, and a heading
 * over three pills is the kind of caption that turns a conversation into a form.
 */
import { useState } from 'react';
import { Check, Copy, Paperclip, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useI18n } from '../i18n';
import type { ChatMessage, ChatVerdict } from '../api';
import { Logo } from './Logo';
import { MatchCard } from './MatchCard';
import { CourseCard } from './CourseCard';
import { useTypewriter } from '../lib/useTypewriter';

export function Message({
  message, onSuggest, onRetry, onRate, onRerun, verdict, busy, isLast, writing, onWritten,
}: {
  message: ChatMessage;
  onSuggest: (question: string) => void;
  /** Confirmed re-run. Reaching this already required a second, deliberate tap. */
  onRerun: () => Promise<void> | void;
  onRetry: (messageId: string) => void;
  onRate: (messageId: string, verdict: ChatVerdict) => void;
  verdict?: ChatVerdict;
  busy: boolean;
  isLast: boolean;
  writing: boolean;
  onWritten: (id: string) => void;
}) {
  const { t, formatNumber } = useI18n();
  const mine = message.role === 'user';

  if (mine) {
    return (
      <li className="turn turn--mine">
        <div className="bubble">
          <span className="sr-only">{t('chat.youSaid')}: </span>
          {message.text && <p className="bubble__text"><bdi>{message.text}</bdi></p>}
          {message.attachments?.map((a) => (
            <p key={a.id} className="clip">
              <Paperclip size={13} aria-hidden="true" />
              <bdi>{a.fileName}</bdi>
              <span className="num">{formatNumber(Math.max(1, Math.round(a.sizeBytes / 1024)))}KB</span>
            </p>
          ))}
        </div>
      </li>
    );
  }

  return (
    <li className="turn turn--hud">
      {/* Still when idle, bobbing while the text arrives. */}
      <span className="mark" data-writing={writing || undefined} aria-hidden="true">
        <Logo variant="icon" height={24} />
      </span>

      <div className="turn__body">
        <HudText
          message={message}
          writing={writing}
          onWritten={onWritten}
          label={t('chat.hudSaid')}
        />

        {/* Cards only once the text has finished, so they do not shuffle into
            place under a paragraph the reader is still following. */}
        {!writing && (
          <>
            {message.jobs?.length ? (
              <div className="grid grid--chat">
                {message.jobs.map((job) => <MatchCard key={job.id} job={job} />)}
              </div>
            ) : null}

            {message.courses?.length ? (
              <div className="grid grid--chat">
                {message.courses.map((course) => <CourseCard key={course.id} course={course} />)}
              </div>
            ) : null}

            <Actions
              message={message}
              onRetry={onRetry}
              onRate={onRate}
              verdict={verdict}
              busy={busy}
            />

            {isLast && message.proposedRerun ? (
              <RerunProposal proposal={message.proposedRerun} onRerun={onRerun} busy={busy} />
            ) : null}

            {isLast && message.suggestions?.length ? (
              <div className="suggests">
                {message.suggestions.map((s) => (
                  <button key={s} type="button" className="suggest" onClick={() => onSuggest(s)} disabled={busy}>
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

function HudText({
  message, writing, onWritten, label,
}: {
  message: ChatMessage;
  writing: boolean;
  onWritten: (id: string) => void;
  label: string;
}) {
  const shown = useTypewriter(message.text, {
    enabled: writing,
    onDone: () => onWritten(message.id),
  });
  return (
    <p className="said">
      <span className="sr-only">{label}: </span>
      {shown}
      {writing && <span className="caret" aria-hidden="true" />}
    </p>
  );
}

/**
 * Copy, rate, retry — the row every assistant puts under an answer.
 *
 * Icon only, no captions, because the icons are the convention and three labels
 * under every turn would out-weigh the turn. Each still carries an aria-label,
 * and copy swaps to a tick for a moment so the press has an answer.
 */
function Actions({
  message, onRetry, onRate, verdict, busy,
}: {
  message: ChatMessage;
  onRetry: (messageId: string) => void;
  onRate: (messageId: string, verdict: ChatVerdict) => void;
  verdict?: ChatVerdict;
  busy: boolean;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard refused (permissions, insecure origin). Nothing useful to say
         about it, and an error toast over a copy button is worse than silence. */
    }
  };

  return (
    <div className="acts">
      <button type="button" className="act" onClick={copy} aria-label={copied ? t('chat.copied') : t('chat.copy')}>
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      </button>
      <button
        type="button"
        className="act"
        onClick={() => onRate(message.id, 'up')}
        aria-label={t('chat.good')}
        aria-pressed={verdict === 'up'}
      >
        <ThumbsUp size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="act"
        onClick={() => onRate(message.id, 'down')}
        aria-label={t('chat.bad')}
        aria-pressed={verdict === 'down'}
      >
        <ThumbsDown size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="act"
        onClick={() => onRetry(message.id)}
        aria-label={t('chat.again')}
        disabled={busy}
      >
        <RefreshCw size={15} aria-hidden="true" />
      </button>
    </div>
  );
}


/**
 * Hud has suggested re-running the matching. This is where that becomes an
 * action, and the two-step is the point.
 *
 * The proposal is a MODEL OUTPUT. A single-tap chip would mean a persuasive
 * sentence — or an injected one — could spend the user's only re-run for the
 * week, which is the whole allowance. So the chip opens a confirm that states
 * the cost, and only the confirm calls the server. The model proposes, the user
 * disposes, the server executes.
 */
function RerunProposal({
  proposal, onRerun, busy,
}: {
  proposal: NonNullable<ChatMessage['proposedRerun']>;
  onRerun: () => Promise<void> | void;
  busy: boolean;
}) {
  const { t, formatNumber } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [spending, setSpending] = useState(false);

  if (spending) return <p className="rerun__note">{t('chat.rerun.started')}</p>;

  return (
    <div className="rerun">
      {proposal.reason ? <p className="rerun__why">{proposal.reason}</p> : null}
      {!confirming ? (
        <button type="button" className="suggest" disabled={busy}
                onClick={() => setConfirming(true)}>
          {t('chat.rerun.offer')}
        </button>
      ) : (
        <div className="rerun__confirm">
          {/* The cost, stated before the tap that spends it — not after. */}
          <p className="rerun__cost">
            {t('chat.rerun.cost', { n: formatNumber(proposal.credits.remaining) })}
          </p>
          <div className="rerun__actions">
            <button type="button" className="button button--primary" disabled={busy}
                    onClick={async () => { setSpending(true); await onRerun(); }}>
              {t('chat.rerun.confirm')}
            </button>
            <button type="button" className="button button--ghost"
                    onClick={() => setConfirming(false)}>
              {t('chat.rerun.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

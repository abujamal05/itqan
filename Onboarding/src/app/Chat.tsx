/**
 * Hud. The chat surface, built as a junction spine.
 *
 * The shape of this screen is an argument about the product, so it is worth
 * stating before the code: the anchor user's own opening line is "I do not know
 * what job I want", and that is not a question with an answer. It is a person
 * standing at a fork. A scrollback of bubbles is the wrong container for it,
 * because the one thing such a person needs — seeing the options side by side,
 * and being able to go back and take the other one — is the one thing a
 * transcript makes hard.
 *
 * So every exchange lands as a node on a spine, carrying the two or three real
 * directions available from where the user actually stands. Walking one extends
 * the spine. The ones not walked stay on their junction, quiet but intact, and
 * remain walkable. Nothing the user learned ever scrolls away.
 *
 * HUD IS HERE, and that is an explicit, dated exception to the brand fence
 * (workspace PRODUCT.md, 2026-08-17). What keeps the fence's argument alive is
 * the split the markup enforces: he speaks orientation, the forks carry the
 * claims and their evidence. If a score or a match ever appears inside his
 * read, the exception has been misread.
 *
 * JUNCTION ZERO IS AUTHORED HERE rather than fetched. It is the empty state,
 * and an empty state that waits on a network round trip is a blank screen with
 * extra steps. It also means the screen has something true to show a user whose
 * pipeline has not finished.
 */
import { useEffect, useRef } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useI18n } from '../i18n';
import { useChat } from '../state/chat';
import { Junction } from '../components/Junction';
import { Composer } from '../components/Composer';
import { Hud } from '../components/Hud';
import { Button, Callout } from '../components/ui';
import type { ChatJunction } from '../api';

export function Chat() {
  const { t } = useI18n();
  const { junctions, taken, pending, failed, ask, takeFork, retry, reset } = useChat();
  const spineEnd = useRef<HTMLDivElement>(null);
  const count = junctions.length;

  /**
   * Bring the newest junction into view when one arrives.
   *
   * Keyed on the COUNT, not on the array: re-running when `taken` changes would
   * yank the page down every time someone walked a fork higher up the spine,
   * which is exactly the moment they are reading something further up.
   */
  useEffect(() => {
    if (count === 0) return;
    spineEnd.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [count]);

  const opening: ChatJunction = {
    id: 'j0',
    question: null,
    read: t('chat.opening'),
    takenForkId: null,
    parentId: null,
    createdAt: 0,
    forks: [
      {
        id: 'f-roles',
        kind: 'topic',
        label: t('chat.open.roles'),
        detail: t('chat.open.rolesDetail'),
      },
      {
        id: 'f-skills',
        kind: 'topic',
        label: t('chat.open.skills'),
        detail: t('chat.open.skillsDetail'),
      },
      {
        id: 'f-courses',
        kind: 'topic',
        label: t('chat.open.courses'),
        detail: t('chat.open.coursesDetail'),
      },
    ],
  };

  const all = [opening, ...junctions];

  return (
    <div className="chat">
      <div className="chat__head">
        <div className="stack stack--sm">
          <h1 className="headline">{t('chat.title')}</h1>
          <p className="subhead">{t('chat.sub')}</p>
        </div>
        {count > 0 && (
          <Button variant="ghost" onClick={reset}>
            <MessageSquarePlus size={16} aria-hidden="true" />
            {t('chat.newThread')}
          </Button>
        )}
      </div>

      <ol className="spine">
        {all.map((junction, i) => (
          <Junction
            key={junction.id}
            junction={junction}
            takenForkId={taken[junction.id] ?? junction.takenForkId}
            onTake={takeFork}
            busy={pending}
            first={i === 0}
          />
        ))}
      </ol>

      {/* Announced without stealing focus, the same pattern PipelineProgress
          uses: the user may well be reading a fork further up while this
          resolves, and pulling them away from it would be the wrong trade. */}
      <div className="chat__status" role="status" aria-live="polite">
        {pending && (
          <div className="thinking">
            <div className="thinking__hud">
              <Hud pose="thinking" loop size="sm" />
            </div>
            <p className="thinking__line">{t('chat.thinking')}</p>
          </div>
        )}
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

      <div ref={spineEnd} />

      <Composer onAsk={ask} busy={pending} />
    </div>
  );
}

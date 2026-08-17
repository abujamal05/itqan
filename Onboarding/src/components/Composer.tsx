/**
 * The ask field.
 *
 * Sticky to the block end of the content column rather than fixed to the
 * viewport, and that is a structural choice, not a styling one: anything
 * rendered inside `.main` is trapped at `z-index: 1` beneath the sidebar's 200
 * (see the note in app.css), so a fixed overlay here would need a portal this
 * codebase does not have. Sticky sidesteps the whole problem and keeps the
 * field inside the column it belongs to.
 *
 * The label is visible. A placeholder standing in for one disappears the moment
 * someone starts typing, which is exactly when a person who was interrupted
 * needs to know what the field was for.
 */
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n';

export function Composer({
  onAsk, busy,
}: {
  onAsk: (question: string) => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState('');

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (!q || busy) return;
        onAsk(q);
        setValue('');
      }}
    >
      <label className="composer__label" htmlFor="chat-ask">{t('chat.ask')}</label>
      <div className="composer__row">
        <input
          id="chat-ask"
          className="input composer__input"
          type="text"
          autoComplete="off"
          placeholder={t('chat.placeholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="submit"
          className="btn btn--primary composer__send"
          disabled={busy || !value.trim()}
          aria-label={t('chat.send')}
        >
          <ArrowRight className="composer__arrow" size={18} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

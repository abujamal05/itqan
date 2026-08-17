/**
 * The ask field.
 *
 * Sticky inside the content column, NOT fixed to the viewport. Anything inside
 * `.main` is trapped at `z-index: 1` beneath the sidebar's 200 (see the stacking
 * note in app.css), so a fixed composer would need a portal this codebase does
 * not have. Sticky avoids the question entirely.
 *
 * A textarea rather than an input, because people paste paragraphs into
 * assistants. It grows to a few lines and then scrolls, Enter sends, and
 * Shift+Enter breaks the line — the convention everywhere, and the one thing that
 * makes a multi-line field usable without a visible "send" habit.
 *
 * No visible label. This is the one field on the screen, it sits under a heading
 * that names the assistant, and it carries a placeholder plus an aria-label; a
 * caption above it would be the sort of form furniture this surface is trying not
 * to be. Every other field in the product keeps its visible label.
 */
import { useRef, useState } from 'react';
import { ArrowUp, Paperclip, X } from 'lucide-react';
import { useI18n } from '../i18n';

/** Same ceiling the document upload enforces, for the same reason. */
const MAX_BYTES = 5 * 1024 * 1024;

export function Composer({
  onAsk, busy,
}: {
  onAsk: (question: string, files?: File[]) => void;
  busy: boolean;
}) {
  const { t, formatNumber } = useI18n();
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [tooBig, setTooBig] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const send = () => {
    const q = value.trim();
    if ((!q && !files.length) || busy) return;
    onAsk(q, files.length ? files : undefined);
    setValue('');
    setFiles([]);
    setTooBig(null);
  };

  const take = (picked: FileList | null) => {
    if (!picked) return;
    const kept: File[] = [];
    let rejected: string | null = null;
    Array.from(picked).forEach((f) => {
      // Checked here as a courtesy, never as a control: the server enforces the
      // real limit, because a client-side size check is trivially bypassed.
      if (f.size > MAX_BYTES) rejected = f.name;
      else kept.push(f);
    });
    setFiles((current) => [...current, ...kept]);
    setTooBig(rejected);
    // Let the same file be picked again after being removed.
    if (picker.current) picker.current.value = '';
  };

  return (
    <div className="composer">
      {files.length > 0 && (
        <ul className="clips">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="clip clip--pending">
              <Paperclip size={13} aria-hidden="true" />
              <bdi>{f.name}</bdi>
              <span className="num">{formatNumber(Math.max(1, Math.round(f.size / 1024)))}KB</span>
              <button
                type="button"
                className="clip__x"
                onClick={() => setFiles((c) => c.filter((_, n) => n !== i))}
                aria-label={t('chat.removeFile', { name: f.name })}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {tooBig && <p className="composer__note" role="alert">{t('chat.tooBig', { name: tooBig })}</p>}

      <div className="ask">
        <textarea
          className="ask__field"
          rows={1}
          value={value}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.ask')}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />

        <div className="ask__row">
          <input
            ref={picker}
            className="sr-only"
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={(e) => take(e.target.files)}
          />
          <button
            type="button"
            className="act act--ask"
            onClick={() => picker.current?.click()}
            aria-label={t('chat.attach')}
          >
            <Paperclip size={17} aria-hidden="true" />
          </button>
          <span className="spacer" />
          <button
            type="button"
            className="ask__send"
            onClick={send}
            disabled={busy || (!value.trim() && !files.length)}
            aria-label={t('chat.send')}
          >
            <ArrowUp size={17} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* The same line every assistant carries, for the same reason. On this
          product it is load bearing rather than boilerplate: the whole design
          asks the reader to check the evidence rather than take Hud's word. */}
      <p className="composer__fineprint">{t('chat.disclaimer')}</p>
    </div>
  );
}

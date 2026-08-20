/**
 * Shared primitives. Each one carries its full interaction-state set in
 * app.css; this file only decides structure and semantics.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { AlertCircle, Check, HelpCircle, Info, Plus, X } from 'lucide-react';
import { useI18n } from '../i18n';
import { skillCase } from '../lib/skillCase';

/* ------------------------------------------------------------------ Button */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  block?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary', block, loading, className = '', children, disabled, ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant}${block ? ' btn--block' : ''} ${className}`.trim()}
      data-loading={loading || undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`.trim()} {...rest}>{children}</div>;
}

/* ------------------------------------------------------------------- Badge */

/**
 * Confidence badge. Above the trust threshold it may read as fact; below it, it
 * must hedge and never state the result plainly. Colour, icon and word all carry
 * the state so hue is never load-bearing.
 *
 * THE LABEL IS THE CALLER'S, and the two callers now differ on purpose.
 * `confirm.lowConfidence` is still "Suggested — confirm", because the
 * confirmation screen is a form and confirming is the literal next action there.
 * `jobs.matchSuggested` is now just "Suggested": a job card has no confirm
 * control and never had one, so the word was instructing the user to press
 * something that does not exist. The hedge survives in the word, the dashed
 * outline and the question icon; only the dead instruction is gone.
 */
export function ConfidenceBadge({
  strong, label, percent,
}: { strong: boolean; label: string; percent?: string }) {
  const Icon = strong ? Check : HelpCircle;
  return (
    <span className={`badge ${strong ? 'badge--strong' : 'badge--suggested'}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
      {percent && (
        <>
          {/* Decorative separator: the space in the accessible name is enough,
              and a screen reader announcing "bullet" adds nothing. */}
          <span className="badge__sep" aria-hidden="true">•</span>
          <span className="num">{percent}%</span>
        </>
      )}
    </span>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'strong' }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

/* -------------------------------------------------------------------- Chip */

/**
 * A chip. Interactive when it can do something, inert markup when it cannot.
 *
 * It used to render a `<button>` unconditionally, so Profile's "still missing"
 * list and its read-only skills list — neither of which has an `onToggle` —
 * were buttons that announced themselves as buttons, took focus, offered a
 * hover state and did nothing when pressed. A hover state is a promise. That
 * exact bug was fixed on the dashboard by rescoping the CSS while these two
 * lists, which are the same bug in the same component, were left standing.
 * Deciding the element from the props fixes both, and any future caller.
 */
export function Chip({
  children, selected, onToggle, ...rest
}: { children: ReactNode; selected?: boolean; onToggle?: () => void } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const interactive = !!onToggle || !!rest.onClick;

  if (!interactive) {
    return (
      <span className="chip chip--static">
        {selected && <Check size={14} aria-hidden="true" />}
        {children}
      </span>
    );
  }

  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onToggle} {...rest}>
      {selected && <Check size={14} aria-hidden="true" />}
      {children}
    </button>
  );
}

/** A skill the user already has. Check icon + tint; never colour alone. */
export function CapabilityChip({ children, onRemove, removeLabel }: { children: ReactNode; onRemove?: () => void; removeLabel?: string }) {
  return (
    <span className={`chip chip--capability${onRemove ? ' chip--removable' : ''}`}>
      <Check size={14} aria-hidden="true" />
      {children}
      {onRemove && (
        <button type="button" className="chip__x" onClick={onRemove} aria-label={removeLabel}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** A skill to acquire. Framed as "unlock", never as missing. */
export function GapChip({ children }: { children: ReactNode }) {
  return (
    <span className="chip chip--gap">
      <Plus size={14} aria-hidden="true" />
      {/* Cased here rather than at each call site: every gap and every
          `unlocks` entry comes through this component, so one place decides how
          a skill is written. See `skillCase` for why this is not CSS. */}
      {typeof children === 'string' ? skillCase(children) : children}
    </span>
  );
}

/* ----------------------------------------------------------------- Callout */

export function Callout({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'danger' }) {
  const Icon = tone === 'danger' ? AlertCircle : Info;
  return (
    <div className={`callout callout--${tone}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon size={18} className="callout__icon" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------- Field */

interface FieldShell {
  label: string;
  hint?: string;
  error?: string;
  /** Rendered next to the label — used for provenance and confidence. */
  adornment?: ReactNode;
}

export function TextField({
  label, hint, error, ...rest
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        {...rest}
      />
      {hint && !error && <p className="field__hint">{hint}</p>}
      {error && (
        <p id={errId} className="field__error">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Single line field. TextField is a textarea, which cannot carry a `type`, so
 * anything dated or short belongs here instead. Same shell and same states, so
 * the two are interchangeable to a reader of the markup.
 */
export function InputField({
  label, hint, error, ...rest
}: FieldShell & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        {...rest}
      />
      {hint && !error && <p className="field__hint">{hint}</p>}
      {error && (
        <p id={errId} className="field__error">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ h = 16, w = '100%' }: { h?: number; w?: string | number }) {
  return <div className="skeleton" style={{ blockSize: h, inlineSize: w }} aria-hidden="true" />;
}

/** Loading is announced, not just drawn, so it reaches screen readers too. */
export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div className="stack" role="status" aria-live="polite">
      <span className="sr-only">{t('state.loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} h={i === 0 ? 24 : 16} w={i === 0 ? '40%' : '100%'} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- EmptyState */

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="stack stack--sm">
        {/* card__title, not section__title: this h3 sits INSIDE a section and
            was rendering at the same 20px/600 as the h2 above it on Jobs,
            Courses, Profile and the dashboard. Completing a fix that was only
            half applied when .card__title was introduced. */}
        <h3 className="card__title">{title}</h3>
        <p className="muted">{body}</p>
      </div>
      {action}
    </div>
  );
}

/** Error state always offers a way out; it never dead-ends. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <EmptyState
      title={t('state.errorTitle')}
      body={t('state.errorSub')}
      action={<Button variant="secondary" onClick={onRetry}>{t('action.retry')}</Button>}
    />
  );
}

/**
 * A dropdown that behaves. Closing is the part most menus get wrong, so all
 * four ways out are wired: Escape, a click outside, choosing an item, and
 * moving focus away with the keyboard.
 *
 * Focus returns to the trigger on close, which is what makes it usable without
 * a mouse — otherwise focus lands back at the top of the document and the user
 * has to tab all the way in again.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export function Menu({
  trigger,
  children,
  label,
  align = 'start',
  drop = 'up',
}: {
  /** Rendered inside the trigger button. */
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  label: string;
  /**
   * Which edge of the TRIGGER the panel hangs from.
   *
   * The default is `start`, and it used to be `end` — but `data-align` was
   * written to the DOM and read by no CSS at all, so every menu in the app
   * actually rendered start-aligned whatever it asked for. Implementing the
   * rule without changing this default silently moved the account menu: with
   * the sidebar collapsed its trigger is 59px wide and the panel is 240px, so
   * pinning the panel's end to the trigger's end put it 173px off the left of
   * the viewport. Measured, not guessed.
   *
   * `start` therefore preserves what every existing caller was really getting.
   * Pass `end` only where the trigger sits at the inline end of a container and
   * the panel needs to hang back into it.
   */
  align?: 'start' | 'end';
  /**
   * Which way the panel opens. `up` is the default because the first caller was
   * the account menu, which lives at the BOTTOM of the sidebar. A menu near the
   * top of the page needs `down`, or it opens off the top of its own container.
   */
  drop?: 'up' | 'down';
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) btn.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close(false);
    };
    // Focus leaving the whole menu (tabbing past the last item) closes it.
    const onFocusIn = (e: FocusEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, close]);

  return (
    <div className="menu" ref={wrap}>
      <button
        ref={btn}
        type="button"
        className="menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>

      {open && (
        <div className="menu__panel" id={id} role="menu" data-align={align} data-drop={drop}>
          {children(() => close())}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children, onSelect, danger,
}: { children: ReactNode; onSelect: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`menu__item${danger ? ' menu__item--danger' : ''}`}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

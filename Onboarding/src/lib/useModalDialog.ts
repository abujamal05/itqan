/**
 * The mechanics every modal in this app needs, in one place.
 *
 * THREE COPIES OF THIS HAD ALREADY APPEARED — the course sheet, the
 * confirmation dialog, and now the feedback panel — and each one is fifteen
 * lines of the same subtle thing. `CourseSheet` learned the important half the
 * hard way and wrote it down; a fourth copy would have been the one that
 * forgot.
 *
 * WHAT IS SUBTLE:
 *
 *   Escape and the backdrop must go through the SAME door as the button. Left
 *   to the platform a `<dialog>` closes itself without React knowing, the
 *   caller's state stays "open", and the next open call finds the element
 *   already open and does nothing. So the native close is prevented and the
 *   caller is asked to close instead, which then closes the element.
 *
 *   React's `onCancel` prop is not the way to hear about it. A real listener
 *   is, which is what `CourseSheet` settled on.
 *
 *   Focus must land somewhere deliberate. `showModal` gives it to the first
 *   focusable child, and on a destructive dialog that is one stray Enter away
 *   from acting.
 *
 *   `locked` exists for the moment a request is in flight: the account is
 *   mid-change and a dialog that vanishes then leaves someone with no idea
 *   whether it went through.
 */
import { useEffect, useRef, type RefObject } from 'react';

export function useModalDialog({
  open, onClose, locked = false, focus,
}: {
  open: boolean;
  onClose: () => void;
  /** While true, Escape and the backdrop do nothing. */
  locked?: boolean;
  /** Where focus goes on open. Falsy, or a ref with nothing in it, leaves it
   *  to the platform. */
  focus?: () => HTMLElement | null | undefined;
}): RefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      requestAnimationFrame(() => { focus?.()?.focus(); });
    }
    if (!open && el.open) el.close();
    // `focus` is a fresh closure every render and must not re-open anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cancel = (e: Event) => { e.preventDefault(); if (!locked) onClose(); };
    el.addEventListener('cancel', cancel);
    return () => el.removeEventListener('cancel', cancel);
  }, [locked, onClose]);

  return ref;
}

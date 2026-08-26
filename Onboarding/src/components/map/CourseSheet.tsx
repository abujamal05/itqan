/**
 * One course, in full, opened from the map.
 *
 * WHY THIS EXISTS. Moving the courses page from a grid to a map shrank each
 * course from a card to a node, and a node has no room for the source line, the
 * retrieval date or the feedback controls. Rather than drop them — they are the
 * trust surface, and "every recommendation carries `why` and a real source" is
 * not negotiable — the node became a summary and this is where the rest went.
 * It renders `CourseCard` UNCHANGED, so nothing about a course is reimplemented
 * in a second place and `FeedbackBar`, the source and the price rules are
 * inherited rather than copied.
 *
 * WHY A NATIVE <dialog>. Focus trapping, Escape, inertness of the page behind
 * and the top layer are all free and correct, which no hand-rolled overlay in
 * this app would have been. It also needs no dependency, which matters here:
 * the alternative was a component library the project's rules exclude.
 */
import { useEffect, useRef } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { Course, Usage } from '../../api';
import { CourseCard } from '../CourseCard';

export function CourseSheet({
  course,
  onClose,
  onReplace,
  onDone,
  onUndo,
  done,
  usage,
}: {
  /** Null closes it. Kept mounted so the close transition has something to run on. */
  course: Course | null;
  onClose: () => void;
  onReplace: (id: string, next: Course) => void;
  onDone: (course: Course) => void;
  onUndo: (course: Course) => void;
  done: boolean;
  /** Passed straight through so the card's feedback panel can price a
   *  replacement. Without it the offer is simply not made. */
  usage?: Usage | null;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (course && !el.open) el.showModal();
    if (!course && el.open) el.close();
  }, [course]);

  /* Escape and the backdrop both close, and both must go through the same
     handler as the button — otherwise the dialog closes without React knowing
     and the next open call finds it already `open`. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cancel = (e: Event) => { e.preventDefault(); onClose(); };
    el.addEventListener('cancel', cancel);
    return () => el.removeEventListener('cancel', cancel);
  }, [onClose]);

  return (
    <dialog
      className="sheet"
      ref={ref}
      aria-label={course?.title ?? ''}
      /* Clicking the backdrop is a click on the dialog itself — the card
         inside stops it going further. */
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
    >
      {course && (
        <div className="sheet__body">
          <button className="sheet__close" type="button" onClick={onClose}>
            <X size={18} aria-hidden="true" />
            <span className="sr-only">{t('a11y.closeDialog')}</span>
          </button>

          <CourseCard
            course={course}
            usage={usage}
            onReplace={(next) => { onReplace(course.id, next); onClose(); }}
            /* INSIDE the card, beside "Open the course". It used to sit on its
               own surface underneath, which made the one control the user came
               for look like a separate object parked below the thing it acts
               on. Done and Undo occupy the same slot, so the card never grows
               or shrinks when the state flips. */
            action={done ? (
              /* Reversible, and quieter than the action that got here: undoing
                 is a correction, not an achievement. A course marked done by a
                 mis-tap used to be permanent — the button simply vanished. */
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => { onUndo(course); onClose(); }}
              >
                <RotateCcw size={16} aria-hidden="true" />
                {t('courses.markNotDone')}
              </button>
            ) : (
              <button
                className="btn btn--primary"
                type="button"
                onClick={() => { onDone(course); onClose(); }}
              >
                <Check size={16} aria-hidden="true" />
                {t('courses.markDone')}
              </button>
            )}
          />
        </div>
      )}
    </dialog>
  );
}

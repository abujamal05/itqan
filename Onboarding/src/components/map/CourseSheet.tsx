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
import { X } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { Course } from '../../api';
import { CourseCard } from '../CourseCard';

export function CourseSheet({
  course,
  onClose,
  onReplace,
  onDone,
  done,
}: {
  /** Null closes it. Kept mounted so the close transition has something to run on. */
  course: Course | null;
  onClose: () => void;
  onReplace: (id: string, next: Course) => void;
  onDone: (course: Course) => void;
  done: boolean;
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
            onReplace={(next) => { onReplace(course.id, next); onClose(); }}
          />

          {/* The one control the card does not carry, because marking a course
              done is a claim about the USER, not about the course. On its own
              surface so it reads as part of the sheet rather than a gold button
              left floating on the backdrop. */}
          {!done && (
            <div className="sheet__foot">
              <button
                className="btn btn--primary"
                type="button"
                onClick={() => { onDone(course); onClose(); }}
              >
                {t('courses.markDone')}
              </button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}

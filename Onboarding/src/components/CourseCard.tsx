/**
 * A course, tied to the specific gap it closes.
 *
 * "No fabricated courses, ever" — so provider, live link and retrieval date are
 * structural, not optional. The card leads with what the course *unlocks*
 * rather than what the user lacks, which is the same capability-first framing
 * used everywhere else.
 *
 * Price is large and near the top because it is the second thing anyone wants
 * to know after "what is this", and because a product that refuses affiliate
 * commissions has no reason to bury a cost. Free is stated as a word, not as
 * "0.000 OMR" — the number is technically the same and reads as an oversight.
 *
 * The sketch put a large image on each card. Images are dropped: they were
 * decorative, pushed the decision content below the fold on mobile, and a
 * stock photo cannot tell anyone whether a course is worth eight hours.
 */
import { Clock, ExternalLink } from 'lucide-react';
import { useI18n } from '../i18n';
import type { Course } from '../api';
import { courseFacts } from '../lib/courseFacts';
import { Badge, Card, GapChip } from './ui';
import { FeedbackBar } from './FeedbackBar';

export function CourseCard({
  course, onReplace,
}: {
  course: Course;
  /**
   * Swap this card for another course closing the same gap. Passed by the
   * screens that own a course LIST, because only the owner of the list can
   * replace an entry in place — which is the whole requirement: the user stays
   * where they are, with their filters and scroll position intact.
   */
  onReplace?: (next: Course) => void;
}) {
  const { t, formatDate, formatNumber, formatMoney } = useI18n();

  /* Price and duration come from `courseFacts`, shared with the map nodes.
     Both fields have shipped invented numbers before — see the history kept in
     that module; it is the reason this is not inlined here any more. */
  const { price, duration, free } = courseFacts(course, { t, formatNumber, formatMoney });

  return (
    <Card>
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow"><bdi>{course.provider}</bdi></span>
          {course.recommended && <Badge tone="strong">{t('courses.recommended')}</Badge>}
        </div>

        <h3 className="match__title"><bdi>{course.title}</bdi></h3>

        <p className="price" data-free={free || undefined}>
          <span className="sr-only">{t('courses.price')}: </span>
          <span className="num">{price}</span>
        </p>

        {duration && (
          <p className="source">
            <Clock size={14} aria-hidden="true" />
            <span className="num">{duration}</span>
          </p>
        )}

        <div className="stack stack--sm">
          <p className="text-sm">{t('courses.unlocks')}</p>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            {course.unlocks.map((s) => <GapChip key={s}>{s}</GapChip>)}
          </div>
        </div>

        <div className="row">
          <a className="btn btn--secondary" href={course.source.url} target="_blank" rel="noopener noreferrer">
            {t('courses.view')}
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>

        <FeedbackBar subject="course" itemId={course.id} onReplace={onReplace} />

        <p className="source">
          {t('jobs.source', { source: course.source.name, date: formatDate(course.source.retrievedAt) })}
        </p>
      </div>
    </Card>
  );
}

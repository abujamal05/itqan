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
import { Badge, Card, GapChip } from './ui';

export function CourseCard({ course }: { course: Course }) {
  const { t, formatDate, formatNumber, formatMoney } = useI18n();

  /**
   * What to say about the price, in four cases rather than two.
   *
   * `price === 0` used to be the only branch, and everything else fell through
   * to `formatMoney(price, currency)`. For the 2,001 Coursera courses that is
   * `formatMoney(null, null)`: Intl throws on the null currency code and the
   * fallback prints the literal string `null 0`. With a valid currency it would
   * have printed `OMR 0.000` — identical to genuinely free, which is worse,
   * because it is a false claim rather than an obvious bug.
   *
   * The order matters. A real number wins over a label; a label wins over
   * nothing; and "nothing" says so rather than guessing in either direction.
   */
  const free = course.price === 0 || course.priceLabel === 'free';
  const hasAmount = typeof course.price === 'number' && course.price > 0 && !!course.currency;

  const price = free
    ? t('courses.free')
    : hasAmount
      ? formatMoney(course.price as number, course.currency as string)
      : course.priceLabel === 'paid'
        ? t('courses.paid')
        : t('courses.priceUnknown');

  /**
   * Duration, and the same rule the price above had to learn.
   *
   * This line used to read `t('courses.hours', { n: formatNumber(course.hours) })`
   * with `hours` typed `number` — while the API had always sent null, and said
   * so in a comment. Every card therefore claimed **"0 hours"**: not a missing
   * value, a false one, and the more dangerous kind because it looks like data.
   *
   * A range when the provider gave one, a single figure when they gave that, and
   * **null renders as nothing at all** — the line is not shown. `durationText`
   * is the last resort, so a duration we could not parse is still their words
   * rather than our silence.
   */
  /* `Number.isFinite`, not a null check, and the difference is the whole bug.
     This line has now printed a number nobody computed TWICE: `0` when the API
     sent null (`format(null)` is "0"), then `NaN` when the field was renamed and
     the old build read `undefined` (`format(undefined)` is "NaN"). Both looked
     like data. A finiteness test rejects null, undefined, NaN and numeric
     strings alike, so the next shape change hides the line instead of inventing
     a figure. */
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const lo = num(course.hoursMin) ? course.hoursMin : null;
  const hi = num(course.hoursMax) ? course.hoursMax : null;
  const duration =
    lo != null && hi != null && hi > lo
      ? t('courses.hoursRange', { min: formatNumber(lo), max: formatNumber(hi) })
      : lo != null
        // "1 hours" appeared on a real card. English needs the singular; Arabic
        // uses the same form after a numeral, so both keys exist and only one
        // language's wording differs.
        ? t(lo === 1 ? 'courses.hour' : 'courses.hours', { n: formatNumber(lo) })
        : course.durationText || null;

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

        <p className="source">
          {t('jobs.source', { source: course.source.name, date: formatDate(course.source.retrievedAt) })}
        </p>
      </div>
    </Card>
  );
}

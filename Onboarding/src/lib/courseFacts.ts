/**
 * What a course COSTS and how long it TAKES, said honestly.
 *
 * Extracted from CourseCard so the map nodes cannot get it wrong a third time.
 * Both of these fields have already shipped a number nobody computed, and the
 * failures are worth keeping in front of whoever touches this next:
 *
 *   `null 0`    — price typed `number` while the API sent null for the 2,001
 *                 Coursera courses that publish no price. `formatMoney(null,
 *                 null)` throws on the currency and the fallback interpolates
 *                 the literal string. With a valid currency it would have read
 *                 `OMR 0.000`, indistinguishable from genuinely free, which is
 *                 worse — a false claim instead of an obvious bug.
 *   `0 hours`   — duration typed `number` while the API sent null, with a
 *                 comment in the mapper explicitly saying "not 0, which would
 *                 render as '0 hours'". Every card rendered exactly that.
 *   `NaN hours` — the same line again after the field was renamed and an old
 *                 build read `undefined`.
 *
 * The rule both arrived at: a missing value renders as SILENCE, never as a
 * figure, and never as a guess in either direction.
 */
import type { Course } from '../api';

/** The i18n surface this needs, so it stays a pure function. */
export interface Fmt {
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatNumber: (n: number) => string;
  formatMoney: (n: number, currency: string) => string;
}

export interface CourseFacts {
  /** Always a string: there is always something honest to say about price. */
  price: string;
  /** Null means the provider stated no duration, and the line is not shown. */
  duration: string | null;
  free: boolean;
}

/* `Number.isFinite`, not a null check, and the difference is the whole bug: it
   rejects null, undefined, NaN and numeric strings alike, so the next shape
   change hides the line instead of inventing a figure. */
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function courseFacts(course: Course, { t, formatNumber, formatMoney }: Fmt): CourseFacts {
  const free = course.price === 0 || course.priceLabel === 'free';
  const hasAmount = num(course.price) && course.price > 0 && !!course.currency;

  /* The order matters. A real number wins over a label; a label wins over
     nothing; and "nothing" says so rather than guessing. */
  const price = free
    ? t('courses.free')
    : hasAmount
      ? formatMoney(course.price as number, course.currency as string)
      : course.priceLabel === 'paid'
        ? t('courses.paid')
        : t('courses.priceUnknown');

  /* A range when the provider gave one, a single figure when they gave that,
     and `durationText` as the last resort — a duration we could not parse is
     still their words rather than our silence. */
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

  return { price, duration, free };
}

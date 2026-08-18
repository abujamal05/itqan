/**
 * The date-of-birth rules, in one place because two screens collect one.
 *
 * The confirm screen asks for a birth date during onboarding and the profile
 * screen lets it be corrected later. When the bounds lived only on the first,
 * the second happily accepted a date the first would have rejected — so the
 * rule was enforced exactly once, on the one path a determined user does not
 * have to take.
 *
 * EVERYTHING IS DERIVED FROM TODAY. No year is written down anywhere here.
 * A hardcoded floor is wrong from the day it is typed and gets worse every
 * January, and the previous version of this check carried a literal `1940`.
 */

/**
 * Itqan is for people entering work. Below this there are no roles to match and
 * no transcript to read, so the form says so rather than producing an empty
 * dashboard.
 */
export const MIN_AGE = 17;

/**
 * A floor for the picker, not a claim about anybody. It exists so a mistyped
 * year lands as an error instead of as a plausible looking date.
 */
export const OLDEST_YEARS = 100;

/**
 * `yyyy-mm-dd` in LOCAL time, which is what `<input type="date">` speaks.
 *
 * Deliberately not `toISOString().slice(0, 10)`: that converts to UTC first, so
 * east of Greenwich a local midnight stamps a day early and west of it a day
 * late. One day either side of a birthday is precisely the boundary these
 * bounds have to get right.
 */
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const shiftYears = (d: Date, years: number) =>
  new Date(d.getFullYear() - years, d.getMonth(), d.getDate());

/**
 * The latest birth date that still clears the minimum age.
 *
 * Does double duty, and the second job is the one worth naming: as an input's
 * `max` it is also where the native picker OPENS when the field is empty.
 * Without it the calendar opens on the current month, so the year in front of
 * someone entering their date of birth is this year — not a plausible birth year
 * for any user of this product, and it reads as the form having already
 * answered for them.
 */
export const latestBirthDate = (from: Date = new Date()) => shiftYears(from, MIN_AGE);

/** The earliest date the picker will offer. */
export const earliestBirthDate = (from: Date = new Date()) => shiftYears(from, OLDEST_YEARS);

/**
 * Which rule a given value breaks, or null when it is fine.
 *
 * Returns a KEY rather than a message so both callers render it through their
 * own `t`, and an empty value is explicitly `null`: the field is optional
 * (nothing in the pipeline reads a birth date), so blank is not a failure.
 */
export function birthDateProblem(
  value: string | null | undefined,
  from: Date = new Date(),
): 'confirm.errBirthFuture' | 'confirm.errBirthTooYoung' | 'confirm.errBirthRange' | null {
  if (!value) return null;
  // `T00:00:00` forces LOCAL parsing. A bare `yyyy-mm-dd` is parsed as UTC,
  // which moves the comparison by a day and puts someone who turns 17 today on
  // the wrong side of the line in half the world's timezones.
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'confirm.errBirthRange';
  if (d > from) return 'confirm.errBirthFuture';
  if (d > latestBirthDate(from)) return 'confirm.errBirthTooYoung';
  if (d < earliestBirthDate(from)) return 'confirm.errBirthRange';
  return null;
}

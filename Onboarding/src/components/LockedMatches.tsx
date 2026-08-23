/**
 * The matches this account cannot see, and the way out.
 *
 * THERE IS NOTHING BEHIND THE FROST, AND THAT IS THE WHOLE DESIGN. The brief
 * asked for blurred job cards that an extension could not defeat, and a blur
 * over real text is not a gate — devtools, uBlock, a user stylesheet, or
 * "Reader mode" all strip it in one action. So the locked matches are never
 * sent to the browser at all (see `JobsResult` and BACKEND.md §5), and these
 * cards are drawn from nothing but a COUNT.
 *
 * The consequence is worth stating plainly: peel the CSS off these and you find
 * grey rectangles. That is not a weaker version of hiding the data, it is the
 * only version that works, and it is also the honest one — we are not
 * pretending to withhold something we already handed over.
 *
 * NO HUD HERE. These sit in the matches list, and the fence keeps the mascot
 * away from anything that looks like a result.
 */
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

/** Cards drawn before it stops being information and starts being wallpaper. */
const MAX_CARDS = 3;

export function LockedMatches({ count }: { count: number }) {
  const { t, formatNumber } = useI18n();
  if (count <= 0) return null;

  /* Never more cards than there are matches: three placeholders above a
     "2 more" count would be claiming more than the server said exists. */
  const cards = Math.min(count, MAX_CARDS);

  return (
    <section className="locked" aria-labelledby="locked-title">
      <ul className="grid grid--2 locked__ghosts" aria-hidden="true">
        {Array.from({ length: cards }, (_, i) => (
          <li className="locked__ghost" key={i}>
            {/* Deliberately meaningless. These are bars, not redacted text. */}
            <span className="locked__bar locked__bar--sm" />
            <span className="locked__bar locked__bar--lg" />
            <span className="locked__bar locked__bar--md" />
            <span className="locked__chips">
              <span className="locked__chip" />
              <span className="locked__chip" />
            </span>
          </li>
        ))}
      </ul>

      <div className="locked__ask">
        <Lock size={18} className="locked__icon" aria-hidden="true" />
        <div className="stack stack--sm">
          <h2 className="locked__title" id="locked-title">
            {/* "1 more matches you fit" shipped for about a minute. English
                needs the singular; Arabic uses the same form after a numeral,
                so both keys exist and only one language's wording differs. */}
            {count === 1
              ? t('jobs.lockedTitleOne')
              : t('jobs.lockedTitle', { n: formatNumber(count) })}
          </h2>
          <p className="text-sm">{t('jobs.lockedBody')}</p>
        </div>
        <Link className="btn btn--primary locked__cta" to="/plan">
          {t('jobs.lockedCta')}
        </Link>
      </div>
    </section>
  );
}

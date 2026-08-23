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

/**
 * Ghosts drawn, and why it is an even number.
 *
 * The grid is two across. Three ghosts filled one row and orphaned a single
 * card in the next, which reads as a rendering fault rather than as "there is
 * more". Two fills the row exactly at every count above one.
 */
const MAX_CARDS = 2;

/**
 * Below this the ghosts are dropped entirely.
 *
 * At one locked match the whole apparatus — a ghost card, a frosted fade and an
 * ask panel — was deployed to sell a single job, which costs more attention
 * than the thing it is selling is worth. One match gets the ask row alone.
 */
const MIN_GHOSTS = 2;

export function LockedMatches({ count }: { count: number }) {
  const { t, formatNumber } = useI18n();
  if (count <= 0) return null;

  /* Never more cards than there are matches: placeholders above a "2 more"
     count would be claiming more than the server said exists. */
  const cards = count >= MIN_GHOSTS ? Math.min(count, MAX_CARDS) : 0;

  return (
    <section className="locked" aria-labelledby="locked-title">
      {cards > 0 && (
        <ul className="grid grid--2 locked__ghosts" aria-hidden="true">
          {Array.from({ length: cards }, (_, i) => (
            <li className="locked__ghost" key={i}>
              {/* A LOCK, NOT A SPINNER. Blurred grey bars are the universal
                  loading idiom, and without this the region asked the reader to
                  work out whether to wait or to pay. The glyph settles it
                  before they have to think about it. */}
              <Lock className="locked__ghostmark" size={18} />
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
      )}

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
        {/* SECONDARY, not primary. Gold on this screen already means "apply to
            this job" — three of them are directly above. A fourth gold fill
            selling an upgrade competes with the product's core action and
            breaks the one-gold-anchor rule. The lock and the accent border
            carry this well enough. */}
        <Link className="btn btn--secondary locked__cta" to="/plan">
          {t('jobs.lockedCta')}
        </Link>
      </div>
    </section>
  );
}

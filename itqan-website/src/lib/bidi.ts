/**
 * Split text so inline Latin runs can be wrapped in `<bdi>`.
 *
 * WHY THIS EXISTS. Arabic text containing a Latin token — a domain, a vendor
 * name, an email address — hands the bidirectional algorithm a decision it
 * makes per neighbour rather than per intent. `tryitqan.com.` in an RTL
 * paragraph can put the full stop on the wrong side, and an address like
 * `privacy@tryitqan.com` sitting next to a comma reorders around it. `<bdi>`
 * isolates the run so the surrounding direction stops leaking into it.
 *
 * The site already does this by hand where Latin is expected — a person's
 * name, a typed query. The legal pages are the first place where the Latin is
 * scattered through long prose and cannot be wrapped at the point it is
 * written, because the text lives in a JSON locale file with no markup.
 *
 * TRAILING PUNCTUATION IS DELIBERATELY EXCLUDED. The pattern requires an
 * alphanumeric after every internal dot, so `tryitqan.com` matches and the
 * sentence's final stop stays outside the isolate, where it belongs to the
 * Arabic and should be ordered with it.
 */

/** A Latin word, domain or email address. Internal dots only. */
const LATIN_RUN = /[A-Za-z][A-Za-z0-9_+-]*(?:[.@][A-Za-z0-9_+-]+)*/g;

export interface BidiPart {
  text: string;
  /** True when this part must be isolated in a `<bdi>`. */
  latin: boolean;
}

/**
 * Break a string into alternating native and Latin parts.
 *
 * Returns a single non-Latin part for text with nothing to isolate, so callers
 * can render the result unconditionally without a special case.
 */
export function bidiParts(text: string): BidiPart[] {
  const parts: BidiPart[] = [];
  let last = 0;

  for (const match of text.matchAll(LATIN_RUN)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), latin: false });
    parts.push({ text: match[0], latin: true });
    last = start + match[0].length;
  }

  if (last < text.length) parts.push({ text: text.slice(last), latin: false });
  return parts;
}

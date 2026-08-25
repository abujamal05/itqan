/**
 * Turn a thrown error into a sentence a person can act on.
 *
 * WHY THIS EXISTS. The wire contract has been right from the start: the server
 * answers with a CODE — `last_cv`, `token_limit`, `email_taken` — never a
 * sentence, because this product is bilingual and an English string on the wire
 * cannot be shown to an Arabic reader. The front end owns the wording.
 *
 * It owned it in two files. Everywhere else a refusal became "Something did not
 * load", and in two places it became NOTHING AT ALL: `Confirm` and `Upload`
 * caught the error, cleared the spinner and returned, so a failed submit looked
 * exactly like a button that had not been pressed. On the confirmation step,
 * which is the product's consent checkpoint, that is the worst place in the
 * app to say nothing.
 *
 * THE DISTINCTION THAT MATTERS MOST is not which code came back. It is whether
 * the server answered at all. A refusal is a fact about your account and
 * retrying will not change it; a network failure is a fact about the moment and
 * retrying probably will. Those need different sentences, and a single "try
 * again" for both sends people to retry things that cannot succeed.
 *
 * ADDITIVE BY DESIGN. An unmapped code falls back rather than rendering a key
 * or an empty string, so a server that grows a new code degrades to a sentence
 * that still reads properly, and a screen can adopt one code at a time.
 */
import { HttpError } from '../api/http';

/** `t` and `formatNumber`, as `useI18n` returns them. */
export interface ErrorTextDeps {
  t: (key: string, vars?: Record<string, string | number>) => string;
  formatNumber: (n: number) => string;
}

export interface ErrorTextOptions {
  /**
   * Screen-specific wording, already translated, keyed by server code.
   *
   * Beats the shared map. It is for the cases where the same refusal means
   * something different depending on where you are standing: `cv_required` on
   * the documents screen is "you removed your only CV", and the generic line
   * cannot know that.
   */
  overrides?: Record<string, string>;
  /** Used when the server answered but the code is unmapped or absent. */
  fallback?: string;
}

/** Server code to i18n key. One entry per code the API is known to send. */
const KEYS: Record<string, string> = {
  no_session: 'err.session',
  unauthenticated: 'err.session',
  invalid_credentials: 'err.credentials',
  email_taken: 'err.emailTaken',
  consent_required: 'err.consentRequired',
  cv_required: 'err.cvRequired',
  no_documents: 'err.cvRequired',
  last_cv: 'err.lastCv',
  invalid_code: 'err.invalidCode',
  code_expired: 'err.codeExpired',
  invalid_input: 'err.invalidInput',
  unreadable: 'err.unreadable',
  confirmation_required: 'err.confirmationRequired',
  no_profile: 'err.noProfile',
  not_found: 'err.notFound',
  token_limit: 'err.tokenLimit',
  /* A browser talking to a server that predates the single token budget. One
     line, and it stops that reading as an unknown code. */
  rescan_limit: 'err.tokenLimit',
};

function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

export function errorText(
  err: unknown,
  { t, formatNumber }: ErrorTextDeps,
  { overrides, fallback }: ErrorTextOptions = {},
): string {
  /* Not an HttpError: the request never got an answer. Says so, because
     "try again" is genuinely the right advice here and nowhere else. */
  if (!(err instanceof HttpError)) return t('err.network');

  const code = err.code;
  if (code && overrides?.[code]) return overrides[code];

  /* A refusal that DIAGNOSES. The server sends `needed` and `remaining` with
     every `token_limit` for exactly this sentence: "that costs 19 and you have
     8 left" tells someone what to do, where "you are out of tokens" leaves them
     guessing what it even cost. Falls back to the plain wording when the
     numbers are absent, because a sentence with a hole in it is worse than a
     vaguer one that reads. */
  if (code === 'token_limit' || code === 'rescan_limit') {
    const needed = num(err.details.needed);
    const remaining = num(err.details.remaining);
    if (needed !== undefined && remaining !== undefined) {
      return t('err.tokenLimitDetail', {
        needed: formatNumber(needed),
        remaining: formatNumber(remaining),
      });
    }
  }

  const key = code ? KEYS[code] : undefined;
  if (key) return t(key);

  /* The server answered and we do not recognise what it said. Deliberately NOT
     the network wording: telling someone to check their connection when the
     connection is fine is how a person spends ten minutes on the wrong thing. */
  return fallback ?? t('err.refused');
}

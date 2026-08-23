/**
 * Paddle, loaded only when somebody actually intends to pay.
 *
 * LAZY AND MEMOISED. `initializePaddle` injects a script from Paddle's CDN, so
 * calling it at module scope would put a third-party request on every signed-in
 * screen, including the ones a free user never leaves. It runs on the first
 * checkout attempt and the promise is cached, so a second click reuses the same
 * instance rather than loading Paddle twice.
 *
 * CONFIG IS OPTIONAL AT BUILD TIME, DELIBERATELY. Without a token the upgrade
 * button has to render disabled with an honest line, not throw when pressed —
 * `isConfigured` exists so the UI can ask before it offers. A build with no
 * Paddle keys is a normal state here: the app ships to environments that have
 * not been wired yet, and it must not white-screen in them.
 *
 * THE PLAN DOES NOT FLIP HERE. Paddle tells the SERVER, by webhook, and the
 * server owns the account. `checkout.completed` means "payment taken", not
 * "you are premium" — the caller polls `GET /api/usage` and waits for the
 * server to agree. Trusting the browser's word for it would let anyone grant
 * themselves premium from the console.
 */
import { initializePaddle, type Paddle, type Environments } from '@paddle/paddle-js';

const TOKEN = import.meta.env.VITE_PADDLE_TOKEN as string | undefined;
const PRICE_ID = import.meta.env.VITE_PADDLE_PRICE_ID as string | undefined;
const ENV = (import.meta.env.VITE_PADDLE_ENV as Environments | undefined) ?? 'sandbox';

/** Both are needed. A token with no price buys nothing. */
export const isConfigured = Boolean(TOKEN && PRICE_ID);

export const priceId = PRICE_ID;

let pending: Promise<Paddle | undefined> | null = null;

function load(onEvent?: (name: string) => void) {
  if (!pending) {
    pending = initializePaddle({
      environment: ENV,
      token: TOKEN as string,
      eventCallback: (e) => onEvent?.(String(e.name ?? '')),
    }).catch((err) => {
      /* Let the next attempt retry rather than caching a rejected promise
         forever — a dropped CDN request should not disable checkout for the
         rest of the session. */
      pending = null;
      throw err;
    });
  }
  return pending;
}

export interface CheckoutArgs {
  email: string;
  /** Sent as `customData` so the webhook can attach the subscription to this
   *  account. Without it the server gets a payment it cannot place. */
  userId: string;
  locale: 'ar' | 'en';
  theme: 'light' | 'dark';
  /** Fired on Paddle's own `checkout.completed`. */
  onCompleted: () => void;
  onError: (err: unknown) => void;
}

export async function openCheckout({
  email, userId, locale, theme, onCompleted, onError,
}: CheckoutArgs) {
  if (!isConfigured) { onError(new Error('paddle_not_configured')); return; }
  try {
    const paddle = await load((name) => {
      if (name === 'checkout.completed') onCompleted();
    });

    /* RESOLVES UNDEFINED RATHER THAN REJECTING when Paddle refuses the token.
       The optional-chained `paddle?.Checkout.open` that used to be here turned
       that into a button that could be clicked forever with no checkout and no
       error — the worst of the three outcomes. A missing instance is a failure
       and has to be reported as one. */
    if (!paddle) { onError(new Error('paddle_unavailable')); return; }

    paddle.Checkout.open({
      items: [{ priceId: PRICE_ID as string, quantity: 1 }],
      customer: { email },
      customData: { userId },
      /* Paddle's overlay renders in the user's language and theme rather than
         defaulting to English on light while the app behind it is Arabic on
         dark. */
      settings: { displayMode: 'overlay', locale, theme },
    });
  } catch (err) {
    onError(err);
  }
}
